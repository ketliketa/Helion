import { AlertCircle, Link2, Wallet } from "lucide-react";
import { money } from "../lib/shared";
import type { PageProps } from "../lib/useWorkspace";
export function PaymentsPage({ context }: PageProps) {
  const { data, reservations, openDetails } = context;
  const payments = data.payments.filter((p) =>
      reservations.some((r) => r.id === p.reservation_id),
    ),
    reviews = data.checkouts?.filter((c) => c.status === "needs_review") || [];
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">ARKËTIMET E PRONËS</span>
          <h1>Pagesat dhe pajtimi.</h1>
          <p>Pagesat manuale dhe online në një histori të vetme.</p>
        </div>
        <Wallet size={28} />
      </div>
      {reviews.length > 0 && (
        <div className="notice">
          <h2>
            <AlertCircle size={21} /> {reviews.length} pagesa kërkojnë pajtim
          </h2>
          <p>
            Ofruesi mori pagesën pasi rezervimi ndryshoi ose u anulua. Ajo nuk
            është shtuar automatikisht në bilanc. Kontrollo pagesën te ofruesi
            dhe kryej pajtimin ose rimbursimin e nevojshëm.
          </p>
          {reviews.map((r) => (
            <p key={r.id}>
              <strong>{r.id}</strong> · {money(r.amount)}
            </p>
          ))}
        </div>
      )}
      <section className="card">
        <div className="card-heading">
          <h2>Historiku i arkëtimeve</h2>
          <span>{payments.length} regjistrime</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Klienti</th>
                <th>Koha</th>
                <th>Mënyra</th>
                <th>Shuma</th>
                <th>Rezervimi</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const r = reservations.find((r) => r.id === p.reservation_id)!;
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{r.guest}</strong>
                    </td>
                    <td>{new Date(p.created).toLocaleString("sq-AL")}</td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (p.method === "online" ? "in_house" : "neutral")
                        }
                      >
                        {p.method === "online"
                          ? "Online · konfirmuar"
                          : p.method === "cash"
                            ? "Cash"
                            : p.method === "card"
                              ? "Kartë · manuale"
                              : "Transfertë bankare"}
                      </span>
                    </td>
                    <td>{money(p.amount)}</td>
                    <td>
                      <button className="btn" onClick={() => openDetails(r)}>
                        <Link2 size={17} />
                        Hap rezervimin
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!payments.length && (
            <p className="no-results">
              Pagesat e regjistruara do të shfaqen këtu.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
