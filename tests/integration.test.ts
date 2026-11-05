import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createApp } from "../server/app.ts";
import { Database } from "../server/db/database.ts";
import { service } from "../server/modules/service.ts";
import { processEmails } from "../server/providers/email.ts";
import { makeReport } from "../server/modules/reports.ts";
import { pdfReport, wordReport } from "../server/providers/exports.ts";
import {
  verifySignature,
  processStripeEvent,
  reservationCheckout,
  subscriptionCheckout,
} from "../server/providers/stripe.ts";
const nativeFetch = fetch;
async function fixture() {
  const db = new Database(":memory:"),
    app = createApp({
      db,
      baseUrl: "http://localhost:5173",
      production: false,
    });
  await new Promise<void>((resolve) =>
    app.server.listen(0, "127.0.0.1", resolve),
  );
  const address = app.server.address() as any,
    base = `http://127.0.0.1:${address.port}`;
  async function req(path: string, body?: any, auth?: any) {
    const r = await nativeFetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body
          ? {
              "Content-Type": "application/json",
              Origin: "http://localhost:5173",
            }
          : {}),
        ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await r.json();
    return {
      status: r.status,
      json,
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function register(address = "owner@example.com") {
    const r = await req("/api/auth/register", {
      name: "Owner Test",
      business: "Test Hotel",
      email: address,
      password: "CorrectPassword123!",
    });
    assert.equal(r.status, 201);
    return { cookie: r.cookie!, csrf: r.json.csrf };
  }
  const close = async () => {
    await new Promise<void>((resolve) => app.server.close(() => resolve()));
    db.close();
  };
  return { db, app, req, register, close, base };
}
async function own(f: Awaited<ReturnType<typeof fixture>>) {
  const auth = await f.register(),
    p = await f.req(
      "/api/pms",
      {
        action: "createProperty",
        name: "Test Hotel",
        city: "Tirana",
        count: 2,
        type: "Standard",
        capacity: 2,
        price: 6500,
      },
      auth,
    );
  assert.equal(p.status, 200);
  const s = (await f.req("/api/pms", undefined, auth)).json;
  return {
    auth,
    pid: p.json.id,
    room: s.rooms[0],
    room2: s.rooms[1],
    state: s,
  };
}
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tirane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const shift = (n: number) =>
  new Date(Date.parse(today()) + n * 86400000).toISOString().slice(0, 10);
const reservation = (pid: string, room: any, extra = {}) => ({
  action: "createReservation",
  id: crypto.randomUUID(),
  propertyId: pid,
  roomId: room.id,
  guest: "Vizitor Test",
  email: "guest@example.com",
  phone: "123",
  checkIn: today(),
  checkOut: shift(2),
  adults: 2,
  ...extra,
});
test("fresh startup applies all migrations automatically and is repeatable", () => {
  const db = new Database(":memory:");
  assert.equal(db.one("SELECT count(*) AS n FROM schema_migrations")!.n, 5);
  assert.ok(db.one("SELECT name FROM sqlite_master WHERE name='email_jobs'"));
  db.close();
});
test("registration, session, login failure, logout and CSRF", async () => {
  const f = await fixture();
  try {
    const auth = await f.register();
    assert.equal(
      (await f.req("/api/auth/me", undefined, auth)).json.user.role,
      "owner",
    );
    assert.equal(
      (await f.req("/api/pms", { action: "demo" }, { ...auth, csrf: "wrong" }))
        .status,
      403,
    );
    assert.equal(
      (
        await f.req("/api/auth/login", {
          email: "owner@example.com",
          password: "wrong",
        })
      ).status,
      401,
    );
    assert.equal((await f.req("/api/auth/logout", {}, auth)).status, 200);
    assert.equal((await f.req("/api/pms", undefined, auth)).status, 401);
  } finally {
    await f.close();
  }
});
test("separate businesses cannot read or mutate each other", async () => {
  const f = await fixture();
  try {
    const { auth, pid, room } = await own(f),
      other = await f.register("other@example.com");
    assert.equal(
      (await f.req("/api/pms", undefined, other)).json.rooms.length,
      0,
    );
    assert.equal(
      (await f.req("/api/pms", reservation(pid, room), other)).status,
      404,
    );
    assert.equal(
      (
        await f.req(
          "/api/reports?propertyId=" +
            pid +
            "&type=payments&from=" +
            today() +
            "&to=" +
            today(),
          undefined,
          other,
        )
      ).status,
      404,
    );
  } finally {
    await f.close();
  }
});
test("simultaneous reservation conflict, retry idempotency and adjacent dates", async () => {
  const f = await fixture();
  try {
    const { auth, pid, room } = await own(f),
      a = reservation(pid, room),
      b = reservation(pid, room);
    const results = await Promise.all([
      f.req("/api/pms", a, auth),
      f.req("/api/pms", b, auth),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const good = results[0].status === 200 ? a : b;
    assert.equal((await f.req("/api/pms", good, auth)).status, 200);
    assert.equal(
      (
        await f.req(
          "/api/pms",
          reservation(pid, room, { checkIn: shift(2), checkOut: shift(3) }),
          auth,
        )
      ).status,
      200,
    );
  } finally {
    await f.close();
  }
});
test("check-in, stale update and checkout to housekeeping", async () => {
  const f = await fixture();
  try {
    const { auth, pid, room } = await own(f),
      r = reservation(pid, room);
    await f.req("/api/pms", r, auth);
    assert.equal(
      (
        await f.req(
          "/api/pms",
          { action: "status", id: r.id, version: 1, status: "in_house" },
          auth,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await f.req(
          "/api/pms",
          { action: "status", id: r.id, version: 1, status: "cancelled" },
          auth,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await f.req(
          "/api/pms",
          { action: "status", id: r.id, version: 2, status: "checked_out" },
          auth,
        )
      ).status,
      200,
    );
    assert.equal(
      (await f.req("/api/pms", undefined, auth)).json.rooms.find(
        (x: any) => x.id === room.id,
      ).housekeeping,
      "dirty",
    );
  } finally {
    await f.close();
  }
});
test("conflicting move preserves old dates and room", async () => {
  const f = await fixture();
  try {
    const { auth, pid, room, room2 } = await own(f),
      a = reservation(pid, room),
      b = reservation(pid, room2);
    await f.req("/api/pms", a, auth);
    await f.req("/api/pms", b, auth);
    assert.equal(
      (
        await f.req(
          "/api/pms",
          {
            action: "changeDates",
            id: b.id,
            version: 1,
            roomId: room.id,
            checkIn: today(),
            checkOut: shift(2),
          },
          auth,
        )
      ).status,
      409,
    );
    assert.equal(
      (await f.req("/api/pms", undefined, auth)).json.reservations.find(
        (r: any) => r.id === b.id,
      ).room_id,
      room2.id,
    );
  } finally {
    await f.close();
  }
});
test("manual payment replay, overpayment and preserved history on cancellation", async () => {
  const f = await fixture();
  try {
    const { auth, pid, room } = await own(f),
      r = reservation(pid, room);
    await f.req("/api/pms", r, auth);
    const p = {
      action: "payment",
      id: crypto.randomUUID(),
      reservationId: r.id,
      amount: 8000,
      method: "cash",
    };
    assert.equal((await f.req("/api/pms", p, auth)).status, 200);
    assert.equal((await f.req("/api/pms", p, auth)).status, 200);
    assert.equal(
      (await f.req("/api/pms", { ...p, id: crypto.randomUUID() }, auth)).status,
      409,
    );
    await f.req(
      "/api/pms",
      { action: "status", id: r.id, version: 1, status: "cancelled" },
      auth,
    );
    assert.equal(
      (await f.req("/api/pms", undefined, auth)).json.payments.length,
      1,
    );
  } finally {
    await f.close();
  }
});
test("staff invitation, acceptance, permissions and revocation", async () => {
  const f = await fixture();
  try {
    const { auth, pid, room } = await own(f),
      inv = await f.req(
        "/api/pms",
        { action: "invite", email: "cleaner@example.com", role: "housekeeper" },
        auth,
      );
    const token = new URL(inv.json.inviteUrl).searchParams.get("token");
    const accepted = await f.req("/api/auth/accept-invite", {
      token,
      name: "Cleaner",
      password: "CleanerPassword123!",
    });
    assert.equal(accepted.status, 200);
    const me = await f.req("/api/auth/me", undefined, {
        cookie: accepted.cookie,
      }),
      hk = { cookie: accepted.cookie, csrf: me.json.user.csrf };
    assert.equal(
      (await f.req("/api/pms", reservation(pid, room), hk)).status,
      403,
    );
    assert.equal(
      (
        await f.req(
          "/api/reports?propertyId=" +
            pid +
            "&type=revenue&from=" +
            today() +
            "&to=" +
            today(),
          undefined,
          hk,
        )
      ).status,
      403,
    );
    const state = (await f.req("/api/pms", undefined, hk)).json;
    assert.deepEqual(state.payments, []);
    assert.equal(state.rooms[0].price, 0);
    assert.equal(
      (
        await f.req(
          "/api/pms",
          {
            action: "saveRoom",
            propertyId: pid,
            roomId: room.id,
            housekeeping: "cleaning",
            price: 1,
            blocked: true,
          },
          hk,
        )
      ).status,
      200,
    );
    assert.equal(
      f.db.one("SELECT price,blocked FROM rooms WHERE id=?", room.id)!.price,
      6500,
    );
    await f.req(
      "/api/pms",
      {
        action: "updateMember",
        userId: me.json.user.id,
        role: "housekeeper",
        active: false,
      },
      auth,
    );
    assert.equal((await f.req("/api/pms", undefined, hk)).status, 401);
  } finally {
    await f.close();
  }
});
test("assigned housekeeping cannot be changed by another worker", async () => {
  const f = await fixture();
  try {
    const { auth, pid, room } = await own(f),
      inv = await f.req(
        "/api/pms",
        { action: "invite", email: "cleaner@example.com", role: "housekeeper" },
        auth,
      ),
      t = new URL(inv.json.inviteUrl).searchParams.get("token"),
      a = await f.req("/api/auth/accept-invite", {
        token: t,
        name: "Cleaner",
        password: "CleanerPassword123!",
      }),
      me = await f.req("/api/auth/me", undefined, { cookie: a.cookie }),
      hk = { cookie: a.cookie, csrf: me.json.user.csrf };
    await f.req(
      "/api/pms",
      {
        action: "assignRoom",
        propertyId: pid,
        roomId: room.id,
        userId: (await f.req("/api/auth/me", undefined, auth)).json.user.id,
        note: "Owner task",
      },
      auth,
    );
    assert.equal(
      (
        await f.req(
          "/api/pms",
          {
            action: "saveRoom",
            propertyId: pid,
            roomId: room.id,
            housekeeping: "cleaning",
          },
          hk,
        )
      ).status,
      403,
    );
  } finally {
    await f.close();
  }
});
test("verification and reset tokens expire after use; reset revokes sessions", async () => {
  const f = await fixture();
  try {
    const { auth } = await own(f);
    const verify = f.db
      .one("SELECT body FROM email_jobs WHERE subject LIKE 'Verifiko%'")!
      .body.match(/token=([a-f0-9]+)/)[1];
    assert.equal(
      (await f.req("/api/auth/verify", { token: verify })).status,
      200,
    );
    assert.equal(
      (await f.req("/api/auth/verify", { token: verify })).status,
      400,
    );
    await f.req("/api/auth/forgot", { email: "owner@example.com" });
    const reset = f.db
      .one("SELECT body FROM email_jobs WHERE subject LIKE 'Rikupero%'")!
      .body.match(/token=([a-f0-9]+)/)[1];
    assert.equal(
      (
        await f.req("/api/auth/reset", {
          token: reset,
          password: "ChangedPassword123!",
        })
      ).status,
      200,
    );
    assert.equal((await f.req("/api/pms", undefined, auth)).status, 401);
    assert.equal(
      (
        await f.req("/api/auth/login", {
          email: "owner@example.com",
          password: "ChangedPassword123!",
        })
      ).status,
      200,
    );
  } finally {
    await f.close();
  }
});
test("public engine is opt-in, uses shared inventory and exposes no private records", async () => {
  const f = await fixture();
  try {
    const { auth, pid, room } = await own(f);
    assert.equal((await f.req("/api/public/test")).status, 404);
    await f.req(
      "/api/pms",
      {
        action: "saveBookingSettings",
        propertyId: pid,
        slug: "test-hotel",
        policy: "Pay at property.",
        published: true,
      },
      auth,
    );
    const listing = await f.req(
      "/api/public/test-hotel?from=" + today() + "&to=" + shift(2),
    );
    assert.equal(listing.status, 200);
    assert.equal(listing.json.reservations, undefined);
    const r = reservation(pid, room);
    assert.equal((await f.req("/api/public/test-hotel", r)).status, 201);
    assert.equal(
      (await f.req("/api/pms", reservation(pid, room), auth)).status,
      409,
    );
    const state = (await f.req("/api/pms", undefined, auth)).json;
    assert.equal(state.reservations[0].source, "Booking Engine");
  } finally {
    await f.close();
  }
});
test("reports match records and produce PDF, real DOCX and CSV", async () => {
  const f = await fixture();
  try {
    const { auth, pid, room } = await own(f);
    await f.req("/api/pms", reservation(pid, room), auth);
    const report = (
      await f.req(
        "/api/reports?propertyId=" +
          pid +
          "&type=occupancy&from=" +
          today() +
          "&to=" +
          shift(1),
        undefined,
        auth,
      )
    ).json;
    assert.equal(report.summary[0].value, "2");
    const pdf = await pdfReport(report),
      docx = await wordReport(report);
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    assert.equal(docx.subarray(0, 2).toString(), "PK");
    const r = await nativeFetch(
      f.base +
        "/api/reports?propertyId=" +
        pid +
        "&type=payments&from=" +
        today() +
        "&to=" +
        shift(1) +
        "&format=csv",
      { headers: { Cookie: auth.cookie } },
    );
    assert.equal(r.status, 200);
    assert.ok(r.headers.get("content-disposition")!.includes(".csv"));
  } finally {
    await f.close();
  }
});
test("email remains queued without config; provider acceptance is explicit and retries preserve idempotency", async () => {
  const f = await fixture();
  const oldKey = process.env.RESEND_API_KEY,
    oldFrom = process.env.MAIL_FROM;
  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
    await f.register();
    await processEmails(f.db);
    assert.equal(f.db.one("SELECT status FROM email_jobs")!.status, "queued");
    process.env.RESEND_API_KEY = "test";
    process.env.MAIL_FROM = "test@example.com";
    await processEmails(
      f.db,
      async () =>
        new Response(JSON.stringify({ id: "email-test" }), {
          status: 200,
        }) as any,
    );
    assert.equal(f.db.one("SELECT status FROM email_jobs")!.status, "accepted");
  } finally {
    if (oldKey) process.env.RESEND_API_KEY = oldKey;
    else delete process.env.RESEND_API_KEY;
    if (oldFrom) process.env.MAIL_FROM = oldFrom;
    else delete process.env.MAIL_FROM;
    await f.close();
  }
});
test("Stripe signature rejects invalid and stale requests", () => {
  const raw = Buffer.from("{}"),
    secret = "test-secret",
    t = Math.floor(Date.now() / 1000),
    sig = createHmac("sha256", secret)
      .update(`${t}.`)
      .update(raw)
      .digest("hex");
  assert.doesNotThrow(() => verifySignature(raw, `t=${t},v1=${sig}`, secret));
  assert.throws(() => verifySignature(raw, `t=${t},v1=abc`, secret));
  assert.throws(() => verifySignature(raw, `t=${t - 1000},v1=${sig}`, secret));
});
test("verified Stripe payment is exactly once; excess or cancelled payment flagged for review", async () => {
  const f = await fixture();
  const old = process.env.STRIPE_SECRET_KEY;
  try {
    process.env.STRIPE_SECRET_KEY = "test";
    const { auth, pid, room } = await own(f),
      r = reservation(pid, room);
    await f.req("/api/pms", r, auth);
    const org = f.db.one("SELECT * FROM organizations")!;
    f.db.run(
      "INSERT INTO checkout_sessions (id,organization_id,reservation_id,kind,amount,stripe_account,checkout_url,created) VALUES (?,?,?,?,?,?,?,?)",
      "cs_test",
      org.id,
      r.id,
      "reservation",
      13000,
      "acct_test",
      "https://checkout.stripe.com/test",
      new Date().toISOString(),
    );
    const event = {
        id: "evt_test",
        type: "checkout.session.completed",
        account: "acct_test",
        data: { object: { id: "cs_test" } },
      },
      mock = async () =>
        new Response(
          JSON.stringify({
            id: "cs_test",
            payment_status: "paid",
            currency: "eur",
            amount_total: 13000,
          }),
          { status: 200 },
        );
    await processStripeEvent(f.db, event, mock as any);
    await processStripeEvent(f.db, { ...event, id: "evt_second" }, mock as any);
    assert.equal(f.db.one("SELECT count(*) AS n FROM payments")!.n, 1);
    await assert.rejects(() =>
      processStripeEvent(
        f.db,
        { ...event, id: "wrong_account", account: "acct_wrong" },
        mock as any,
      ),
    );
    const other = reservation(pid, {
      id: (await f.req("/api/pms", undefined, auth)).json.rooms[1].id,
    });
    await f.req("/api/pms", other, auth);
    await f.req(
      "/api/pms",
      { action: "status", id: other.id, version: 1, status: "cancelled" },
      auth,
    );
    f.db.run(
      "INSERT INTO checkout_sessions (id,organization_id,reservation_id,kind,amount,stripe_account,checkout_url,created) VALUES (?,?,?,?,?,?,?,?)",
      "cs_cancel",
      org.id,
      other.id,
      "reservation",
      13000,
      "acct_test",
      "https://checkout.stripe.com/test",
      new Date().toISOString(),
    );
    await processStripeEvent(
      f.db,
      { ...event, id: "evt_cancel", data: { object: { id: "cs_cancel" } } },
      mock as any,
    );
    assert.equal(
      f.db.one("SELECT status FROM checkout_sessions WHERE id=?", "cs_cancel")!
        .status,
      "needs_review",
    );
    assert.equal(f.db.one("SELECT count(*) AS n FROM payments")!.n, 1);
  } finally {
    if (old) process.env.STRIPE_SECRET_KEY = old;
    else delete process.env.STRIPE_SECRET_KEY;
    await f.close();
  }
});
test("unconfigured real providers never report successful payment or subscription", async () => {
  const f = await fixture();
  try {
    const { auth, pid, room } = await own(f),
      r = reservation(pid, room);
    await f.req("/api/pms", r, auth);
    assert.equal(
      (
        await f.req(
          "/api/pms",
          { action: "checkout", reservationId: r.id },
          auth,
        )
      ).status,
      503,
    );
    assert.equal(
      (
        await f.req(
          "/api/pms",
          { action: "subscriptionCheckout", plan: "starter" },
          auth,
        )
      ).status,
      503,
    );
    assert.equal(
      (await f.req("/api/pms", undefined, auth)).json.subscription.plan,
      "trial",
    );
  } finally {
    await f.close();
  }
});

test("subscription checkout reuses pending session; late events preserve current provider status", async () => {
  const f = await fixture(),
    old = {
      key: process.env.STRIPE_SECRET_KEY,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
      price: process.env.STRIPE_PRICE_STARTER,
    },
    originalFetch = globalThis.fetch;
  try {
    process.env.STRIPE_SECRET_KEY = "test";
    process.env.STRIPE_WEBHOOK_SECRET = "test";
    process.env.STRIPE_PRICE_STARTER = "price_test";
    const { auth } = await own(f),
      org = f.db.one("SELECT * FROM organizations")!;
    let calls = 0;
    globalThis.fetch = (async (url: any, options: any) => {
      assert.ok(String(url).includes("api.stripe.com"));
      calls++;
      return new Response(
        JSON.stringify({
          id: "cs_subscription",
          url: "https://checkout.stripe.com/subscription",
          amount_total: 2900,
        }),
        { status: 200 },
      );
    }) as any;
    const a = await subscriptionCheckout(
        f.db,
        org.id,
        "starter",
        "owner@example.com",
        "http://localhost:5173",
      ),
      b = await subscriptionCheckout(
        f.db,
        org.id,
        "starter",
        "owner@example.com",
        "http://localhost:5173",
      );
    assert.equal(a.url, b.url);
    assert.equal(calls, 1);
    const event = {
      id: "evt_subscription",
      type: "checkout.session.completed",
      data: { object: { id: "cs_subscription" } },
    };
    const mocked = (async (url: any) =>
      new Response(
        JSON.stringify(
          String(url).includes("/subscriptions/")
            ? { id: "sub_test", status: "canceled" }
            : {
                id: "cs_subscription",
                payment_status: "paid",
                subscription: "sub_test",
                customer: "cus_test",
              },
        ),
        { status: 200 },
      )) as any;
    await processStripeEvent(f.db, event, mocked);
    assert.equal(
      f.db.one("SELECT subscription_status FROM organizations")!
        .subscription_status,
      "canceled",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (old.key) process.env.STRIPE_SECRET_KEY = old.key;
    else delete process.env.STRIPE_SECRET_KEY;
    if (old.secret) process.env.STRIPE_WEBHOOK_SECRET = old.secret;
    else delete process.env.STRIPE_WEBHOOK_SECRET;
    if (old.price) process.env.STRIPE_PRICE_STARTER = old.price;
    else delete process.env.STRIPE_PRICE_STARTER;
    await f.close();
  }
});

test("local demo accepts loopback aliases and rejects foreign origins; production stays strict", async () => {
  const f = await fixture();
  try {
    for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173"]) {
      const r = await nativeFetch(f.base + "/api/auth/demo", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(r.status, 200);
      const cookie = r.headers.get("set-cookie");
      assert.ok(cookie);
      const state = await nativeFetch(f.base + "/api/pms", {
        headers: { Cookie: cookie!.split(";")[0] },
      });
      assert.equal(state.status, 200);
      assert.ok((await state.json()).rooms.length > 0);
    }
    const denied = await nativeFetch(f.base + "/api/auth/demo", {
      method: "POST",
      headers: {
        Origin: "https://foreign.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(denied.status, 403);
  } finally {
    await f.close();
  }
  const db = new Database(":memory:");
  const app = createApp({
    db,
    production: true,
    baseUrl: "https://hotel.example",
  });
  await new Promise<void>((resolve) =>
    app.server.listen(0, "127.0.0.1", resolve),
  );
  try {
    const address = app.server.address() as any;
    const denied = await nativeFetch(
      `http://127.0.0.1:${address.port}/api/auth/login`,
      {
        method: "POST",
        headers: {
          Origin: "http://localhost:5173",
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
    assert.equal(denied.status, 403);
  } finally {
    await new Promise<void>((resolve) => app.server.close(() => resolve()));
    db.close();
  }
});
