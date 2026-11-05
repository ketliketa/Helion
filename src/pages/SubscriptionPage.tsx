import { Check, CreditCard, ExternalLink, Wallet } from "lucide-react";
import type { PageProps } from "../lib/useWorkspace";
export function SubscriptionPage({ context }: PageProps) {
  const { data, mutate, busy } = context,
    sub = data.subscription;
  async function open(action: string, body: Record<string, unknown> = {}) {
    const r = await mutate(action, body, "");
    if (r?.url) window.location.assign(r.url);
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">PLANI I BIZNESIT</span>
          <h1>Një plan për ritmin tënd.</h1>
          <p>Abonimi i HotelFlow dhe llogaria e arkëtimit menaxhohen veçmas.</p>
        </div>
        <span className="badge in_house">
          {sub?.plan === "trial" ? "Provë 14-ditore" : sub?.plan} ·{" "}
          {sub?.status}
        </span>
      </div>
      <div className="billing-summary card">
        <div>
          <h2>Abonimi aktual</h2>
          <p>
            {sub?.plan === "trial"
              ? `Prova përfundon më ${new Date(sub.trialUntil).toLocaleDateString("sq-AL")}`
              : "Ndrysho planin ose anulo rinovimin nga portali i abonimit."}
          </p>
        </div>
        <button
          className="btn"
          disabled={busy}
          onClick={() => open("billingPortal")}
        >
          <ExternalLink size={18} />
          Menaxho abonimin
        </button>
      </div>
      {!data.integrations?.subscription && (
        <div className="notice">
          <h2>Abonimet online kërkojnë konfigurim</h2>
          <p>
            Vendos çelësat e ofruesit, webhook-un dhe ID-të e çmimeve të planeve
            në server. Çmimi dhe intervali real shfaqen në Checkout përpara
            pagesës.
          </p>
        </div>
      )}
      <div className="plans">
        {[
          {
            id: "starter",
            name: "Starter",
            description: "Për pronën që kërkon qartësi në punën e përditshme.",
            features: [
              "Front Desk dhe kalendar",
              "Rezervime direkte",
              "Pagesa dhe raporte operative",
            ],
          },
          {
            id: "pro",
            name: "Pro",
            description: "Për ekipin që kërkon më shumë kontroll në menaxhim.",
            features: [
              "Të gjitha funksionet bazë",
              "Raporte menaxheriale",
              "Staf, detyra dhe historik",
            ],
          },
        ].map((p) => (
          <section
            className={"card plan " + (p.id === "pro" ? "featured" : "")}
            key={p.id}
          >
            <span className="eyebrow">HOTELFLOW</span>
            <h2>{p.name}</h2>
            <p>{p.description}</p>
            <strong>Çmimi në Checkout</strong>
            <small>Konfigurohet nga operatori i platformës</small>
            <ul>
              {p.features.map((f) => (
                <li key={f}>
                  <Check size={18} />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className="btn primary wide"
              disabled={busy || !data.integrations?.subscription}
              onClick={() => open("subscriptionCheckout", { plan: p.id })}
            >
              Vazhdo te {p.name}
              <ExternalLink size={17} />
            </button>
          </section>
        ))}
      </div>
      <section className="card connect-card">
        <div className="card-heading">
          <div>
            <h2>Arkëtimet e qëndrimeve</h2>
            <p>
              Lidh llogarinë e këtij biznesi për të marrë pagesat e vizitorëve.
            </p>
          </div>
          <Wallet size={27} />
        </div>
        <div className="connect-body">
          <span
            className={"badge " + (sub?.connected ? "in_house" : "pending")}
          >
            {sub?.connected
              ? "Llogari e lidhur · aktivizimi kontrollohet nga ofruesi"
              : "Ende pa llogari arkëtimi"}
          </span>
          <p>
            Ofruesi përcakton vendet dhe bizneset e mbështetura. Dokumentet dhe
            të dhënat e kartës plotësohen vetëm në faqen e tij të sigurt.
          </p>
          <button
            className="btn primary"
            disabled={busy || !data.integrations?.stripe}
            onClick={() => open("connectAccount")}
          >
            <CreditCard size={19} />
            {sub?.connected
              ? "Vazhdo konfigurimin"
              : "Lidh llogarinë e arkëtimit"}
          </button>
        </div>
      </section>
    </>
  );
}
