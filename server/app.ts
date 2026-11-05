import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, relative, isAbsolute } from "node:path";
import { Database, type Row } from "./db/database.ts";
import { AppError, text, integer, range, today } from "./modules/domain.ts";
import {
  createAccount,
  login,
  getIdentity,
  issueSession,
  hash,
  createToken,
  consumeToken,
  email,
  passwordHash,
  passwordMatches,
  requireRole,
  safeUser,
  type Identity,
  type Role,
} from "./modules/auth.ts";
import { service } from "./modules/service.ts";
import { queueEmail, processEmails } from "./providers/email.ts";
import {
  stripeReady,
  stripeRequest,
  reservationCheckout,
  subscriptionCheckout,
  verifySignature,
  processStripeEvent,
} from "./providers/stripe.ts";
import {
  makeReport,
  allowedReports,
  reportCatalog,
} from "./modules/reports.ts";
import { pdfReport, wordReport, csvReport } from "./providers/exports.ts";
export type AppOptions = {
  db?: Database;
  baseUrl?: string;
  production?: boolean;
  fetcher?: typeof fetch;
};
export function createApp(options: AppOptions = {}) {
  const db = options.db || new Database(),
    base = options.baseUrl || process.env.APP_URL || "http://localhost:5173",
    production = options.production ?? process.env.NODE_ENV === "production",
    fetcher = options.fetcher || fetch;
  const counters = new Map<string, { count: number; until: number }>();
  function limit(key: string, max = 25) {
    const now = Date.now();
    if (counters.size > 5000)
      for (const [k, v] of counters) if (v.until < now) counters.delete(k);
    let c = counters.get(key);
    if (!c || c.until < now) {
      c = { count: 0, until: now + 15 * 60000 };
      counters.set(key, c);
    }
    if (++c.count > max)
      throw new AppError(429, "Shumë kërkesa. Provo pas pak.");
  }
  async function body(req: IncomingMessage) {
    const buffers: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 128)
        throw new AppError(413, "Kërkesa është shumë e madhe.");
      buffers.push(Buffer.from(chunk));
    }
    return Buffer.concat(buffers);
  }
  function json(res: ServerResponse, value: unknown, status = 200) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  }
  function session(res: ServerResponse, uid: string, org: string) {
    const s = issueSession(db, uid, org);
    res.setHeader(
      "Set-Cookie",
      `hf_session=${s.raw}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${production ? "; Secure" : ""}`,
    );
    return s;
  }
  function audit(user: Identity, pid: string, action: string, detail: string) {
    db.run(
      "INSERT INTO audit VALUES (?,?,?,?,?,?)",
      crypto.randomUUID(),
      pid,
      user.id,
      action,
      detail,
      new Date().toISOString(),
    );
  }
  function ownProperty(user: Identity, pid: unknown) {
    const p = db.one(
      "SELECT * FROM properties WHERE id=? AND owner=?",
      text(pid, "Prona", 80),
      user.organization_id,
    );
    if (!p) throw new AppError(404, "Prona nuk u gjet.");
    return p;
  }
  function requirePlan(user: Identity) {
    const org = db.one(
      "SELECT * FROM organizations WHERE id=?",
      user.organization_id,
    )!;
    if (
      !["active", "trialing"].includes(org.subscription_status) ||
      (org.plan === "trial" && org.trial_until < new Date().toISOString())
    )
      throw new AppError(
        403,
        "Prova ose abonimi ka përfunduar. Menaxho abonimin për të shtuar rezervime të reja.",
      );
  }
  function reservationMail(user: Identity, id: string, subject: string) {
    const r = db.one(
      "SELECT r.*,p.name AS property_name FROM reservations r JOIN properties p ON r.property_id=p.id WHERE r.id=? AND p.owner=?",
      id,
      user.organization_id,
    );
    if (r?.email)
      queueEmail(
        db,
        user.organization_id,
        r.email,
        subject,
        `${r.property_name}\nPërshëndetje ${r.guest},\nRezervimi ${r.id}\nMbërritja ${r.check_in}\nLargimi ${r.check_out}\nTotali ${(r.total / 100).toFixed(2)} EUR\nStatusi ${r.status}\nKontaktoni pronën për ndryshime.`,
        `${id}-${r.version}-${subject}`,
      );
  }
  async function state(user: Identity) {
    const data = (await service(
      db,
      user.organization_id,
      "state",
      {},
      user.id,
    )) as Row;
    const props = data.properties.map((p: Row) => p.id);
    const placeholders = props.map(() => "?").join(",") || "''";
    data.assignments = db.all(
      `SELECT a.*,u.name AS assigned_name FROM room_assignments a JOIN rooms r ON r.id=a.room_id LEFT JOIN users u ON u.id=a.user_id WHERE r.property_id IN (${placeholders})`,
      ...props,
    );
    data.propertySettings = db.all(
      `SELECT * FROM property_settings WHERE property_id IN (${placeholders})`,
      ...props,
    );
    data.staff = db.all(
      "SELECT u.id,u.name,u.email,m.role,m.active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=?",
      user.organization_id,
    );
    const org = db.one(
      "SELECT * FROM organizations WHERE id=?",
      user.organization_id,
    )!;
    data.subscription = {
      plan: org.plan,
      status: org.subscription_status,
      trialUntil: org.trial_until,
      connected: !!org.connected_account,
    };
    data.integrations = {
      stripe: stripeReady(),
      email: !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM),
      subscription: !!(
        stripeReady() &&
        (process.env.STRIPE_PRICE_STARTER || process.env.STRIPE_PRICE_PRO)
      ),
    };
    data.user = safeUser(user);
    data.reportCatalog = reportCatalog.filter((r) =>
      allowedReports(user.role).includes(r.id),
    );
    data.emails = ["owner", "manager"].includes(user.role)
      ? db.all(
          "SELECT id,recipient,subject,status,attempts,error,created FROM email_jobs WHERE organization_id=? ORDER BY created DESC LIMIT 100",
          user.organization_id,
        )
      : [];
    data.checkouts = ["owner", "manager", "receptionist"].includes(user.role)
      ? db.all(
          "SELECT id,reservation_id,status,amount,created FROM checkout_sessions WHERE organization_id=? AND kind=? ORDER BY created DESC LIMIT 100",
          user.organization_id,
          "reservation",
        )
      : [];
    if (user.role === "housekeeper") {
      data.reservations = [];
      data.payments = [];
      data.audit = [];
      data.channelJobs = [];
      data.rooms = data.rooms.map((r: Row) => ({ ...r, price: 0 }));
      data.staff = data.staff.map((s: Row) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        active: s.active,
      }));
      data.propertySettings = [];
    }
    return data;
  }
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    try {
      const url = new URL(req.url || "/", base),
        path = url.pathname,
        write = !["GET", "HEAD"].includes(req.method || "GET");
      if (path === "/api/health") {
        json(res, { ok: true, database: "ready", version: "0.2.0" });
        return;
      }
      if (path === "/api/webhooks/stripe") {
        if (req.method !== "POST") throw new AppError(405, "Përdor POST.");
        if (!process.env.STRIPE_WEBHOOK_SECRET)
          throw new AppError(503, "Webhook nuk është konfiguruar.");
        const raw = await body(req);
        verifySignature(
          raw,
          String(req.headers["stripe-signature"] || ""),
          process.env.STRIPE_WEBHOOK_SECRET,
        );
        await processStripeEvent(db, JSON.parse(raw.toString()), fetcher);
        json(res, { received: true });
        return;
      }
      let b: Row = {};
      if (path.startsWith("/api/") && write) {
        const origin = req.headers.origin;
        // Development accepts only explicit loopback origins used by this app.
        // Production continues to require the configured exact origin.
        const localOrigins = new Set([
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
        ]);
        if (
          origin &&
          origin !== new URL(base).origin &&
          (production || !localOrigins.has(origin))
        )
          throw new AppError(403, "Origjinë e palejuar.");
        if (!String(req.headers["content-type"]).includes("application/json"))
          throw new AppError(415, "Kërkohet JSON.");
        try {
          b = JSON.parse((await body(req)).toString());
        } catch (e) {
          if (e instanceof AppError) throw e;
          throw new AppError(400, "JSON i pavlefshëm.");
        }
        if (!b || typeof b !== "object" || Array.isArray(b))
          throw new AppError(400, "Kërkesë e pavlefshme.");
      }
      const user = getIdentity(db, req.headers.cookie);
      if (path === "/api/auth/me") {
        json(res, { user: user ? safeUser(user) : null });
        return;
      }
      if (path.startsWith("/api/auth/") && write) {
        const action = path.split("/").pop()!;
        limit(
          (req.socket.remoteAddress || "local") + "-" + action,
          action === "login" ? 30 : 15,
        );
        if (action === "demo") {
          if (production) throw new AppError(404, "Veprim i panjohur.");
          const account = createAccount(db, {
            name: "Demo",
            business: "Hapësirë prove",
            email: `demo-${crypto.randomUUID()}@example.invalid`,
            password: crypto.randomUUID() + crypto.randomUUID(),
          });
          const result = (await service(
            db,
            account.org,
            "demo",
            {},
            account.uid,
          )) as Row;
          db.run(
            "INSERT INTO property_settings (property_id,public_slug) VALUES (?,?)",
            result.id,
            "demo-" + result.id.slice(0, 8),
          );
          const s = session(res, account.uid, account.org);
          json(res, { ok: true, csrf: s.csrf });
          return;
        }
        if (action === "register") {
          const { uid, org } = createAccount(db, b),
            s = session(res, uid, org);
          const raw = createToken(db, "verify", email(b.email), org, uid, null);
          queueEmail(
            db,
            org,
            email(b.email),
            "Verifiko llogarinë HotelFlow",
            `Për të verifikuar email-in hap këtë link:\n${base}/verify?token=${raw}`,
          );
          json(res, { ok: true, csrf: s.csrf }, 201);
          return;
        }
        if (action === "login") {
          const { uid, org } = login(db, b),
            s = session(res, uid, org);
          json(res, { ok: true, csrf: s.csrf });
          return;
        }
        if (action === "forgot") {
          const e = email(b.email),
            u = db.one(
              "SELECT u.*,m.organization_id FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.email=? LIMIT 1",
              e,
            );
          if (u) {
            const raw = createToken(
              db,
              "reset",
              e,
              u.organization_id,
              u.id,
              null,
              1,
            );
            queueEmail(
              db,
              u.organization_id,
              e,
              "Rikupero fjalëkalimin",
              `Linku skadon pas një ore:\n${base}/reset?token=${raw}`,
            );
          }
          json(res, {
            ok: true,
            message:
              "Nëse llogaria ekziston, do të marrësh udhëzimet me email.",
          });
          return;
        }
        if (action === "reset") {
          const t = consumeToken(db, b.token, "reset"),
            password = passwordHash(b.password);
          db.transaction(() => {
            db.run(
              "UPDATE users SET password_hash=? WHERE id=?",
              password,
              t.user_id,
            );
            db.run("UPDATE tokens SET used=1 WHERE token_hash=?", t.token_hash);
            db.run("DELETE FROM sessions WHERE user_id=?", t.user_id);
          });
          json(res, { ok: true });
          return;
        }
        if (action === "verify") {
          const t = consumeToken(db, b.token, "verify");
          db.transaction(() => {
            db.run("UPDATE users SET verified=1 WHERE id=?", t.user_id);
            db.run("UPDATE tokens SET used=1 WHERE token_hash=?", t.token_hash);
          });
          json(res, { ok: true });
          return;
        }
        if (action === "accept-invite") {
          const t = consumeToken(db, b.token, "invite"),
            existing = db.one("SELECT * FROM users WHERE email=?", t.email);
          let uid = existing?.id;
          if (existing && !passwordMatches(b.password, existing.password_hash))
            throw new AppError(
              401,
              "Vendos fjalëkalimin e llogarisë ekzistuese.",
            );
          const p = existing ? null : passwordHash(b.password);
          if (!uid) uid = crypto.randomUUID();
          db.transaction(() => {
            if (!existing)
              db.run(
                "INSERT INTO users (id,email,name,password_hash,verified,created) VALUES (?,?,?,?,1,?)",
                uid,
                t.email,
                text(b.name, "Emri"),
                p,
                new Date().toISOString(),
              );
            db.run(
              "INSERT INTO memberships (organization_id,user_id,role,active) VALUES (?,?,?,1) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role,active=1",
              t.organization_id,
              uid,
              t.role,
            );
            db.run("UPDATE tokens SET used=1 WHERE token_hash=?", t.token_hash);
          });
          session(res, uid, t.organization_id);
          json(res, { ok: true });
          return;
        }
        if (action === "logout") {
          if (user && req.headers["x-csrf-token"] !== user.csrf)
            throw new AppError(403, "Rifresko faqen dhe provo sërish.");
          const raw = req.headers.cookie
            ?.split(";")
            .map((x) => x.trim())
            .find((x) => x.startsWith("hf_session="))
            ?.slice(11);
          if (raw) db.run("DELETE FROM sessions WHERE token_hash=?", hash(raw));
          res.setHeader(
            "Set-Cookie",
            "hf_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
          );
          json(res, { ok: true });
          return;
        }
        throw new AppError(404, "Veprim i panjohur.");
      }
      if (path.startsWith("/api/public/")) {
        const slug = decodeURIComponent(path.slice("/api/public/".length));
        limit((req.socket.remoteAddress || "local") + "public", 100);
        const p = db.one(
          "SELECT p.*,s.policy FROM properties p JOIN property_settings s ON s.property_id=p.id WHERE s.public_slug=? AND s.published=1",
          slug,
        );
        if (!p)
          throw new AppError(404, "Faqja e rezervimit nuk është publikuar.");
        const org = db.one("SELECT * FROM organizations WHERE id=?", p.owner)!;
        if (
          (org.plan === "trial" &&
            org.trial_until < new Date().toISOString()) ||
          !["active", "trialing"].includes(org.subscription_status)
        )
          throw new AppError(
            503,
            "Rezervimi online është përkohësisht i pezulluar. Kontaktoni pronën.",
          );
        if (!write) {
          const {
            a,
            b: out,
            n,
          } = range(
            url.searchParams.get("from") || today(),
            url.searchParams.get("to") ||
              new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          );
          if (a < today()) throw new AppError(400, "Zgjidh data të ardhshme.");
          const adults = integer(
            Number(url.searchParams.get("adults") || 2),
            1,
            20,
            "Personat",
          );
          const rooms = db.all(
            "SELECT id,name,type,capacity,price FROM rooms r WHERE property_id=? AND blocked=0 AND capacity>=? AND NOT EXISTS(SELECT 1 FROM reservations v WHERE v.room_id=r.id AND status NOT IN ('cancelled','no_show') AND v.check_in<? AND v.check_out>?) ORDER BY price",
            p.id,
            adults,
            out,
            a,
          );
          json(res, {
            property: {
              name: p.name,
              city: p.city,
              email: p.email,
              phone: p.phone,
              policy: p.policy,
            },
            rooms,
            nights: n,
            from: a,
            to: out,
          });
          return;
        }
        b.email = email(b.email);
        const key = text(b.id, "Identifikuesi", 80);
        const existing = db.one(
          "SELECT email,guest FROM reservations WHERE id=?",
          key,
        );
        if (
          existing &&
          (existing.email !== b.email || existing.guest !== b.guest)
        )
          throw new AppError(409, "Identifikues i përdorur.");
        await service(
          db,
          p.owner,
          "createReservation",
          { ...b, propertyId: p.id, source: "Booking Engine" },
          "public",
        );
        const r = db.one(
          "SELECT * FROM reservations WHERE id=? AND property_id=?",
          key,
          p.id,
        )!;
        const account: Identity = {
          id: "public",
          name: "Vizitor",
          email: b.email,
          role: "receptionist",
          organization_id: p.owner,
          csrf: "",
          verified: 1,
        };
        reservationMail(account, r.id, "Konfirmim rezervimi");
        json(
          res,
          {
            id: r.id,
            total: r.total,
            status: r.status,
            message:
              "Rezervimi u ruajt. Pagesa bëhet sipas marrëveshjes me pronën.",
          },
          201,
        );
        return;
      }
      if (path.startsWith("/api/")) {
        if (!user) throw new AppError(401, "Hyr në llogari për të vazhduar.");
        if (write && req.headers["x-csrf-token"] !== user.csrf)
          throw new AppError(
            403,
            "Sesioni i formularit ka ndryshuar. Rifresko faqen.",
          );
        if (path === "/api/pms" && !write) {
          json(res, await state(user));
          return;
        }
        if (path === "/api/reports" && !write) {
          const type = url.searchParams.get("type") || "occupancy",
            report = makeReport(
              db,
              user,
              url.searchParams.get("propertyId") || "",
              type,
              url.searchParams.get("from") || today(),
              url.searchParams.get("to") || today(),
            ),
            format = url.searchParams.get("format");
          if (format) {
            const buffer =
              format === "pdf"
                ? await pdfReport(report)
                : format === "docx"
                  ? await wordReport(report)
                  : Buffer.from(csvReport(report));
            res.writeHead(200, {
              "Content-Type":
                format === "pdf"
                  ? "application/pdf"
                  : format === "docx"
                    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    : "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="HotelFlow-${type}.${format === "docx" ? "docx" : format === "pdf" ? "pdf" : "csv"}"`,
              "Cache-Control": "no-store",
            });
            res.end(buffer);
            return;
          }
          json(res, report);
          return;
        }
        if (path === "/api/pms" && write) {
          const action = b.action;
          if (action === "invite") {
            requireRole(user, ["owner"]);
            const e = email(b.email);
            if (!["manager", "receptionist", "housekeeper"].includes(b.role))
              throw new AppError(400, "Roli është i pavlefshëm.");
            if (
              db.one(
                "SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.email=? AND m.organization_id=? AND m.role=?",
                e,
                user.organization_id,
                "owner",
              )
            )
              throw new AppError(
                409,
                "Pronari nuk mund të ftohet me rol tjetër.",
              );
            const raw = createToken(
              db,
              "invite",
              e,
              user.organization_id,
              null,
              b.role,
              48,
            );
            queueEmail(
              db,
              user.organization_id,
              e,
              "Ftesë për ekipin HotelFlow",
              `Je ftuar si ${b.role}. Linku skadon pas 48 orësh:\n${base}/invite?token=${raw}`,
            );
            json(res, {
              ok: true,
              ...(!production && !process.env.RESEND_API_KEY
                ? { inviteUrl: `${base}/invite?token=${raw}` }
                : {}),
            });
            return;
          }
          if (action === "updateMember") {
            requireRole(user, ["owner"]);
            const member = db.one(
              "SELECT * FROM memberships WHERE organization_id=? AND user_id=?",
              user.organization_id,
              b.userId,
            );
            if (!member || member.role === "owner")
              throw new AppError(403, "Roli i pronarit nuk ndryshohet këtu.");
            if (!["manager", "receptionist", "housekeeper"].includes(b.role))
              throw new AppError(400, "Rol i pavlefshëm.");
            db.transaction(() => {
              db.run(
                "UPDATE memberships SET role=?,active=? WHERE organization_id=? AND user_id=?",
                b.role,
                b.active ? 1 : 0,
                user.organization_id,
                b.userId,
              );
              db.run(
                "DELETE FROM sessions WHERE user_id=? AND organization_id=?",
                b.userId,
                user.organization_id,
              );
            });
            json(res, { ok: true });
            return;
          }
          if (action === "assignRoom") {
            requireRole(user, ["owner", "manager"]);
            const p = ownProperty(user, b.propertyId),
              r = db.one(
                "SELECT * FROM rooms WHERE id=? AND property_id=?",
                b.roomId,
                p.id,
              );
            if (!r) throw new AppError(404, "Dhoma nuk u gjet.");
            if (
              b.userId &&
              !db.one(
                "SELECT user_id FROM memberships WHERE user_id=? AND organization_id=? AND active=1",
                b.userId,
                user.organization_id,
              )
            )
              throw new AppError(400, "Punonjësi nuk ka akses aktiv.");
            db.transaction(() => {
              db.run(
                "INSERT INTO room_assignments (room_id,user_id,note,updated) VALUES (?,?,?,?) ON CONFLICT(room_id) DO UPDATE SET user_id=excluded.user_id,note=excluded.note,updated=excluded.updated",
                r.id,
                b.userId || null,
                text(b.note || "", "Shënimi", 1000, false),
                new Date().toISOString(),
              );
              audit(user, p.id, "Detyra u caktua", r.name);
            });
            json(res, { ok: true });
            return;
          }
          if (action === "saveBookingSettings") {
            requireRole(user, ["owner", "manager"]);
            const p = ownProperty(user, b.propertyId),
              slug = text(b.slug, "Adresa", 70);
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
              throw new AppError(
                400,
                "Adresa lejon shkronja të vogla, numra dhe viza.",
              );
            db.run(
              "INSERT INTO property_settings (property_id,public_slug,published,policy) VALUES (?,?,?,?) ON CONFLICT(property_id) DO UPDATE SET public_slug=excluded.public_slug,published=excluded.published,policy=excluded.policy",
              p.id,
              slug,
              b.published ? 1 : 0,
              text(b.policy, "Politika", 2000),
            );
            json(res, { ok: true });
            return;
          }
          if (action === "retryEmail") {
            requireRole(user, ["owner", "manager"]);
            db.run(
              "UPDATE email_jobs SET status='queued',attempts=0,next_attempt=? WHERE id=? AND organization_id=? AND status IN ('failed','retrying')",
              new Date().toISOString(),
              b.id,
              user.organization_id,
            );
            json(res, { ok: true });
            return;
          }
          if (action === "checkout") {
            requireRole(user, ["owner", "manager", "receptionist"]);
            if (!user.verified && production)
              throw new AppError(
                403,
                "Verifiko email-in përpara aktivizimit të pagesave.",
              );
            json(
              res,
              await reservationCheckout(
                db,
                user.organization_id,
                b.reservationId,
                base,
              ),
            );
            return;
          }
          if (action === "subscriptionCheckout") {
            requireRole(user, ["owner"]);
            json(
              res,
              await subscriptionCheckout(
                db,
                user.organization_id,
                b.plan,
                user.email,
                base,
              ),
            );
            return;
          }
          if (action === "billingPortal") {
            requireRole(user, ["owner"]);
            const org = db.one(
              "SELECT * FROM organizations WHERE id=?",
              user.organization_id,
            )!;
            if (!org.stripe_customer)
              throw new AppError(409, "Nuk ka ende abonim online.");
            const portal = await stripeRequest("billing_portal/sessions", {
              customer: org.stripe_customer,
              return_url: base,
            });
            json(res, { url: portal.url });
            return;
          }
          if (action === "connectAccount") {
            requireRole(user, ["owner"]);
            if (!stripeReady())
              throw new AppError(
                503,
                "Integrimi i pagesave nuk është konfiguruar.",
              );
            if (production && !user.verified)
              throw new AppError(403, "Verifiko email-in.");
            let org = db.one(
              "SELECT * FROM organizations WHERE id=?",
              user.organization_id,
            )!;
            if (!org.connected_account) {
              const acc = await stripeRequest(
                "accounts",
                {
                  type: "express",
                  email: user.email,
                  "capabilities[card_payments][requested]": "true",
                  "capabilities[transfers][requested]": "true",
                },
                "connect-" + org.id,
              );
              db.run(
                "UPDATE organizations SET connected_account=? WHERE id=?",
                acc.id,
                org.id,
              );
              org = db.one("SELECT * FROM organizations WHERE id=?", org.id)!;
            }
            const link = await stripeRequest("account_links", {
              account: org.connected_account,
              type: "account_onboarding",
              refresh_url: `${base}/?connect=retry`,
              return_url: `${base}/?connect=returned`,
            });
            json(res, { url: link.url });
            return;
          }
          const allowed: Record<string, Role[]> = {
            createProperty: ["owner"],
            demo: ["owner"],
            saveProperty: ["owner", "manager"],
            createRoom: ["owner", "manager"],
            saveRoom: ["owner", "manager", "housekeeper"],
            createReservation: ["owner", "manager", "receptionist"],
            changeDates: ["owner", "manager", "receptionist"],
            status: ["owner", "manager", "receptionist"],
            payment: ["owner", "manager", "receptionist"],
            simulateChannel: ["owner", "manager"],
          };
          if (!allowed[action]) throw new AppError(400, "Veprim i panjohur.");
          requireRole(user, allowed[action]);
          if (["createProperty", "createReservation", "demo"].includes(action))
            requirePlan(user);
          if (user.role === "housekeeper") {
            const r = db.one(
              "SELECT r.*,a.user_id FROM rooms r LEFT JOIN room_assignments a ON a.room_id=r.id WHERE r.id=? AND r.property_id=?",
              b.roomId,
              b.propertyId,
            );
            ownProperty(user, b.propertyId);
            if (!r || (r.user_id && r.user_id !== user.id))
              throw new AppError(
                403,
                "Kjo detyrë i është caktuar një punonjësi tjetër.",
              );
            b.price = r.price;
            b.blocked = r.blocked;
          }
          const result = (await service(
            db,
            user.organization_id,
            action,
            b,
            user.id,
          )) as Row;
          if (action === "createProperty" || action === "demo") {
            db.run(
              "INSERT OR IGNORE INTO property_settings (property_id,public_slug) VALUES (?,?)",
              result.id,
              "prona-" + result.id.slice(0, 8),
            );
          }
          if (action === "createReservation")
            reservationMail(user, result.id, "Konfirmim rezervimi");
          if (action === "changeDates" || action === "status")
            reservationMail(user, b.id, "Përditësim rezervimi");
          json(res, result);
          return;
        }
        throw new AppError(404, "Rruga nuk ekziston.");
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        throw new AppError(405, "Veprim i palejuar.");
      const root = resolve("dist"),
        file = resolve(root, "." + decodeURIComponent(path));
      if (
        relative(root, file).startsWith("..") ||
        isAbsolute(relative(root, file))
      )
        throw new AppError(403, "Rrugë e palejuar.");
      let target = file;
      try {
        if (!(await stat(file)).isFile()) target = resolve(root, "index.html");
      } catch {
        target = resolve(root, "index.html");
      }
      const contents = await readFile(target),
        types: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".svg": "image/svg+xml",
        };
      res.writeHead(200, {
        "Content-Type": types[extname(target)] || "application/octet-stream",
        "Cache-Control": target.endsWith("index.html")
          ? "no-store"
          : "public,max-age=3600",
      });
      res.end(contents);
    } catch (error) {
      let status = error instanceof AppError ? error.status : 500,
        message =
          error instanceof AppError
            ? error.message
            : "Veprimi dështoi. Kontrollo terminalin e serverit.";
      const raw = String(error);
      if (raw.includes("ROOM_CONFLICT")) {
        status = 409;
        message =
          "Dhoma është e zënë ose nuk është gati. Kontrollo kalendarin dhe pastrimin.";
      }
      if (raw.includes("PAYMENT_EXCEEDS")) {
        status = 409;
        message = "Pagesa tejkalon bilancin ose rezervimi është anuluar.";
      }
      if (raw.includes("STALE_VERSION")) {
        status = 409;
        message = "Rezervimi ka ndryshuar. Rifresko të dhënat.";
      }
      if (raw.includes("UNIQUE constraint")) {
        status = 409;
        message = "Ky regjistrim ekziston tashmë.";
      }
      if (status >= 500)
        console.error(
          "Gabim backend-i:",
          error instanceof Error ? error.message : "Gabim i panjohur",
        );
      json(res, { error: message }, status);
    }
  };
  return { db, handler, server: createServer(handler) };
}
