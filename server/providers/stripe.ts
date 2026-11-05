import { createHmac, timingSafeEqual } from "node:crypto";
import type { Database, Row } from "../db/database.ts";
import { AppError } from "../modules/domain.ts";
import { queueEmail } from "./email.ts";
export function stripeReady() {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
export async function stripeRequest(
  path: string,
  params?: Record<string, string>,
  key?: string,
  account?: string,
  fetcher: typeof fetch = fetch,
) {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new AppError(503, "Pagesat online nuk janë konfiguruar.");
  const response = await fetcher(`https://api.stripe.com/v1/${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(params
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
      ...(account ? { "Stripe-Account": account } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const body = (await response.json()) as Row;
  if (!response.ok)
    throw new AppError(
      502,
      body.error?.message || "Ofruesi i pagesës refuzoi kërkesën.",
    );
  return body;
}
export function verifySignature(
  raw: Buffer,
  header: string,
  secret: string,
  clock = Date.now(),
) {
  const parts = header.split(",").map((p) => p.split("=")),
    timestamp = parts.find((p) => p[0] === "t")?.[1];
  if (!timestamp || Math.abs(clock / 1000 - Number(timestamp)) > 300)
    throw new AppError(400, "Nënshkrim i skaduar ose i pavlefshëm.");
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(raw)
    .digest();
  const valid = parts
    .filter((p) => p[0] === "v1")
    .some((p) => {
      const given = Buffer.from(p[1] || "", "hex");
      return (
        given.length === expected.length && timingSafeEqual(given, expected)
      );
    });
  if (!valid) throw new AppError(400, "Nënshkrim i pavlefshëm.");
}
export async function reservationCheckout(
  db: Database,
  orgId: string,
  reservationId: string,
  base: string,
) {
  if (!stripeReady())
    throw new AppError(503, "Konfiguro çelësin dhe webhook-un e pagesave.");
  const r = db.one(
    "SELECT r.*,p.owner,p.name AS property_name FROM reservations r JOIN properties p ON p.id=r.property_id WHERE r.id=? AND p.owner=?",
    reservationId,
    orgId,
  );
  if (!r) throw new AppError(404, "Rezervimi nuk u gjet.");
  if (["cancelled", "no_show"].includes(r.status))
    throw new AppError(409, "Rezervimi është mbyllur.");
  const org = db.one("SELECT * FROM organizations WHERE id=?", orgId)!;
  if (!org.connected_account)
    throw new AppError(
      409,
      "Pronari duhet të lidhë llogarinë e arkëtimit për këtë biznes.",
    );
  const account = await stripeRequest(
    "accounts/" + encodeURIComponent(org.connected_account),
  );
  if (!account.charges_enabled)
    throw new AppError(
      409,
      "Llogaria e arkëtimit ende nuk është aktivizuar nga ofruesi.",
    );
  const paid = db.one(
    "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE reservation_id=?",
    r.id,
  )!.total;
  const remaining = r.total - paid;
  if (remaining <= 0) throw new AppError(409, "Rezervimi është paguar.");
  const existing = db.one(
    "SELECT * FROM checkout_sessions WHERE reservation_id=? AND status='pending' AND amount=? AND created>? ORDER BY created DESC LIMIT 1",
    r.id,
    remaining,
    new Date(Date.now() - 30 * 60000).toISOString(),
  );
  if (existing) return { url: existing.checkout_url };
  const id = crypto.randomUUID(),
    session = await stripeRequest(
      "checkout/sessions",
      {
        mode: "payment",
        client_reference_id: r.id,
        ...(r.email ? { customer_email: r.email } : {}),
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(remaining),
        "line_items[0][price_data][product_data][name]": `${r.property_name} · ${r.guest}`,
        "line_items[0][quantity]": "1",
        success_url: `${base}/?payment=received`,
        cancel_url: `${base}/?payment=cancelled`,
        "metadata[kind]": "reservation",
        "metadata[organization_id]": orgId,
        "metadata[reservation_id]": r.id,
        expires_at: String(Math.floor(Date.now() / 1000) + 1800),
      },
      id,
      org.connected_account,
    );
  db.run(
    "INSERT INTO checkout_sessions (id,organization_id,reservation_id,kind,amount,stripe_account,checkout_url,created) VALUES (?,?,?,?,?,?,?,?)",
    session.id,
    orgId,
    r.id,
    "reservation",
    remaining,
    org.connected_account,
    session.url,
    new Date().toISOString(),
  );
  return { url: session.url };
}
export async function subscriptionCheckout(
  db: Database,
  orgId: string,
  plan: string,
  email: string,
  base: string,
) {
  if (!stripeReady())
    throw new AppError(503, "Abonimet online nuk janë konfiguruar.");
  const price =
    plan === "starter"
      ? process.env.STRIPE_PRICE_STARTER
      : plan === "pro"
        ? process.env.STRIPE_PRICE_PRO
        : null;
  if (!price) throw new AppError(400, "Plani nuk është konfiguruar.");
  const org = db.one("SELECT * FROM organizations WHERE id=?", orgId)!;
  if (org.stripe_subscription && org.subscription_status !== "canceled")
    throw new AppError(409, "Menaxho abonimin ekzistues nga portali.");
  const pending = db.one(
    "SELECT * FROM checkout_sessions WHERE organization_id=? AND kind='subscription' AND status='pending' AND created>? ORDER BY created DESC LIMIT 1",
    orgId,
    new Date(Date.now() - 30 * 60000).toISOString(),
  );
  if (pending) {
    if (pending.plan !== plan)
      throw new AppError(
        409,
        "Ka një abonim në pritje. Përfundo atë Checkout ose prit skadimin e tij.",
      );
    return { url: pending.checkout_url };
  }
  const params: Record<string, string> = {
    mode: "subscription",
    expires_at: String(Math.floor(Date.now() / 1000) + 1800),
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: `${base}/?subscription=received`,
    cancel_url: `${base}/?subscription=cancelled`,
    "metadata[kind]": "subscription",
    "metadata[organization_id]": orgId,
    "metadata[plan]": plan,
    "subscription_data[metadata][organization_id]": orgId,
    "subscription_data[metadata][plan]": plan,
  };
  if (org.stripe_customer) params.customer = org.stripe_customer;
  else params.customer_email = email;
  const session = await stripeRequest(
    "checkout/sessions",
    params,
    "subscription-" + org.id + "-" + Math.floor(Date.now() / 1800000),
  );
  db.run(
    "INSERT OR IGNORE INTO checkout_sessions (id,organization_id,kind,plan,amount,checkout_url,created) VALUES (?,?,?,?,?,?,?)",
    session.id,
    orgId,
    "subscription",
    plan,
    session.amount_total || 0,
    session.url,
    new Date().toISOString(),
  );
  return { url: session.url };
}
export async function processStripeEvent(
  db: Database,
  event: Row,
  fetcher: typeof fetch = fetch,
) {
  if (db.one("SELECT id FROM webhook_events WHERE id=?", event.id)) return;
  const object = event.data?.object;
  if (!object) throw new AppError(400, "Ngjarje e pavlefshme.");
  if (
    ["customer.subscription.updated", "customer.subscription.deleted"].includes(
      event.type,
    ) &&
    !event.account
  ) {
    // Retrieve current state to tolerate out-of-order deliveries.
    const current = await stripeRequest(
      "subscriptions/" + encodeURIComponent(object.id),
      undefined,
      undefined,
      undefined,
      fetcher,
    );
    const org = db.one(
      "SELECT * FROM organizations WHERE stripe_subscription=?",
      object.id,
    );
    if (org) {
      db.transaction(() => {
        db.run(
          "UPDATE organizations SET subscription_status=? WHERE id=?",
          current.status,
          org.id,
        );
        db.run(
          "INSERT INTO webhook_events VALUES (?,?)",
          event.id,
          new Date().toISOString(),
        );
      });
      return;
    }
  }
  if (
    [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ].includes(event.type)
  ) {
    const checkout = db.one(
      "SELECT * FROM checkout_sessions WHERE id=?",
      object.id,
    );
    if (!checkout)
      throw new AppError(409, "Checkout ende nuk është ruajtur; provo sërish.");
    if ((event.account || "") !== checkout.stripe_account)
      throw new AppError(400, "Llogaria e pagesës nuk përputhet.");
    const current = await stripeRequest(
      "checkout/sessions/" + encodeURIComponent(object.id),
      undefined,
      undefined,
      checkout.stripe_account || undefined,
      fetcher,
    );
    if (current.payment_status !== "paid") return;
    let subscription: Row | null = null;
    if (checkout.kind === "subscription") {
      const subId =
        typeof current.subscription === "string"
          ? current.subscription
          : current.subscription?.id;
      if (!subId) throw new AppError(400, "Abonimi mungon.");
      subscription = await stripeRequest(
        "subscriptions/" + encodeURIComponent(subId),
        undefined,
        undefined,
        undefined,
        fetcher,
      );
    }
    db.transaction(() => {
      if (db.one("SELECT id FROM webhook_events WHERE id=?", event.id)) return;
      if (checkout.kind === "reservation") {
        if (
          current.currency !== "eur" ||
          current.amount_total !== checkout.amount
        )
          throw new AppError(400, "Shuma e pagesës nuk përputhet.");
        const r = db.one(
          "SELECT * FROM reservations WHERE id=?",
          checkout.reservation_id,
        )!;
        const paid = db.one(
          "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE reservation_id=?",
          r.id,
        )!.total;
        const paymentId = "stripe-" + checkout.id;
        if (!db.one("SELECT id FROM payments WHERE id=?", paymentId)) {
          if (
            ["cancelled", "no_show"].includes(r.status) ||
            paid + checkout.amount > r.total
          ) {
            db.run(
              "UPDATE checkout_sessions SET status='needs_review' WHERE id=?",
              checkout.id,
            );
            queueEmail(
              db,
              checkout.organization_id,
              current.customer_details?.email || r.email,
              "Pagesë për verifikim",
              `Pagesa për rezervimin ${r.id} u mor nga ofruesi, por kërkon pajtim nga prona. Kontaktoni pronën për sqarim.`,
              event.id + "-review",
            );
          } else {
            db.run(
              "INSERT INTO payments (id,reservation_id,amount,method,created) VALUES (?,?,?,?,?)",
              paymentId,
              r.id,
              checkout.amount,
              "online",
              new Date().toISOString(),
            );
            db.run(
              "UPDATE checkout_sessions SET status='paid' WHERE id=?",
              checkout.id,
            );
            if (r.email)
              queueEmail(
                db,
                checkout.organization_id,
                r.email,
                "Pagesa u konfirmua",
                `U konfirmua pagesa ${(checkout.amount / 100).toFixed(2)} EUR për rezervimin ${r.id}.`,
                event.id + "-receipt",
              );
          }
        }
      } else {
        const subId =
          typeof current.subscription === "string"
            ? current.subscription
            : current.subscription?.id;
        if (!subId) throw new AppError(400, "Abonimi mungon.");
        db.run(
          "UPDATE organizations SET stripe_customer=?,stripe_subscription=?,plan=?,subscription_status=? WHERE id=?",
          typeof current.customer === "string"
            ? current.customer
            : current.customer?.id,
          subId,
          checkout.plan,
          subscription!.status,
          checkout.organization_id,
        );
        db.run(
          "UPDATE checkout_sessions SET status='paid' WHERE id=?",
          checkout.id,
        );
      }
      db.run(
        "INSERT INTO webhook_events VALUES (?,?)",
        event.id,
        new Date().toISOString(),
      );
    });
    return;
  }
  db.run(
    "INSERT OR IGNORE INTO webhook_events VALUES (?,?)",
    event.id,
    new Date().toISOString(),
  );
}
