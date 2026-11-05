import { ArrowUpRight, Search, Users } from "lucide-react";
import { Empty } from "../components/ui";
import { Reservation, active, initials, money } from "../lib/shared";
import type { PageProps } from "../lib/useWorkspace";
export function GuestsPage({ context }: PageProps) {
  const {
    query,
    setQuery,
    filter,
    reservations,
    openDetails,
    title,
    PageIntro,
  } = context;
  return (
    <>
      <PageIntro
        eyebrow="NJERËZIT PAS QËNDRIMEVE"
        heading="Mikpritje që mbahet mend."
        description="Kontaktet dhe historiku i vizitorëve nga rezervimet e pronës."
      />
      <section className="card">
        <div className="list-toolbar">
          <label className="search">
            <Search size={17} />
            <input
              placeholder="Kërko klientin…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Klienti</th>
                <th>Kontakti</th>
                <th>Rezervime</th>
                <th>Vlera e rezervimeve aktive</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {Object.values(
                reservations.reduce((a: Record<string, Reservation[]>, r) => {
                  const k = r.email || r.guest;
                  (a[k] ??= []).push(r);
                  return a;
                }, {}),
              )
                .filter((rs) =>
                  rs[0].guest.toLowerCase().includes(query.toLowerCase()),
                )
                .map((rs, i) => (
                  <tr key={rs[0].id} onClick={() => openDetails(rs[0])}>
                    <td>
                      <div className="guest-cell">
                        <span className={"avatar color-" + (i % 4)}>
                          {initials(rs[0].guest)}
                        </span>
                        <strong>{rs[0].guest}</strong>
                      </div>
                    </td>
                    <td>
                      {rs[0].email || "Pa email"}
                      <small>{rs[0].phone || "Pa telefon"}</small>
                    </td>
                    <td>{rs.length}</td>
                    <td>
                      {money(
                        rs.filter(active).reduce((s, r) => s + r.total, 0),
                      )}
                    </td>
                    <td>
                      <ArrowUpRight size={16} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!reservations.length && (
            <Empty
              icon={Users}
              title="Klientët e parë po vijnë"
              detail="Kontaktet shfaqen pasi krijon rezervimin e parë."
            />
          )}
        </div>
      </section>
    </>
  );
}
