import { Mail, RefreshCw } from "lucide-react";
import type { PageProps } from "../lib/useWorkspace";
const labels: Record<string, string> = {
  queued: "Në pritje",
  retrying: "Në riprovim",
  sending: "Në dërgim",
  accepted: "Pranuar nga ofruesi",
  failed: "Dështuar",
};
export function EmailsPage({ context }: PageProps) {
  const { data, mutate, busy } = context;
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">KOMUNIKIMI ME KLIENTËT DHE EKIPIN</span>
          <h1>Email-et, nën kontroll.</h1>
          <p>
            Konfirmime rezervimesh, ndryshime, ftesa stafi dhe rikuperim
            llogarie.
          </p>
        </div>
        <span
          className={
            "badge " + (data.integrations?.email ? "in_house" : "pending")
          }
        >
          {data.integrations?.email
            ? "Dërgimi i konfiguruar"
            : "Kërkon konfigurim"}
        </span>
      </div>
      {!data.integrations?.email && (
        <div className="notice">
          <h2>Dërgimi jashtë nuk është aktiv</h2>
          <p>
            Email-et ruhen në radhë. Vendos RESEND_API_KEY dhe MAIL_FROM në
            konfigurimin e serverit dhe verifiko domenin te ofruesi. Asnjë email
            në pritje nuk paraqitet si i dërguar.
          </p>
        </div>
      )}
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Historiku i dërgimit</h2>
            <p>
              Pranuar nga ofruesi nuk do të thotë domosdoshmërisht dorëzuar në
              inbox.
            </p>
          </div>
          <Mail size={25} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Marrësi</th>
                <th>Subjekti</th>
                <th>Statusi</th>
                <th>Tentativa</th>
                <th>Veprim</th>
              </tr>
            </thead>
            <tbody>
              {(data.emails || []).map((e) => (
                <tr key={e.id}>
                  <td>{e.recipient}</td>
                  <td>
                    <strong>{e.subject}</strong>
                    <small>{new Date(e.created).toLocaleString("sq-AL")}</small>
                  </td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (e.status === "accepted"
                          ? "in_house"
                          : e.status === "failed"
                            ? "cancelled"
                            : "pending")
                      }
                    >
                      {labels[e.status] || e.status}
                    </span>
                    {e.error && <small>{e.error}</small>}
                  </td>
                  <td>{e.attempts}</td>
                  <td>
                    {["failed", "retrying"].includes(e.status) ? (
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          mutate(
                            "retryEmail",
                            { id: e.id },
                            "Email-i u kthye në radhë.",
                          )
                        }
                      >
                        <RefreshCw size={17} />
                        Riprovo
                      </button>
                    ) : (
                      <span className="muted">Automatik</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.emails?.length && (
            <p className="no-results">Nuk ka email-e në historik.</p>
          )}
        </div>
      </section>
    </>
  );
}
