import { Download, Plus, Search } from "lucide-react";
import { statusNames } from "../lib/shared";
import type { PageProps } from "../lib/useWorkspace";
export function ReservationsPage({ context }: PageProps) {
  const {
    query,
    setQuery,
    filter,
    setFilter,
    openReservation,
    filtered,
    exportCSV,
    ReservationTable,
    PageIntro,
  } = context;
  return (
    <>
      <PageIntro
        eyebrow="TË GJITHA REZERVIMET"
        heading="Qëndrimet, të organizuara."
        description="Nga rezervimi i parë deri te mirupafshim."
      >
        <div className="intro-actions">
          <button className="btn" onClick={exportCSV}>
            <Download size={16} />
            Eksporto
          </button>
          <button className="btn primary" onClick={() => openReservation()}>
            <Plus size={17} />
            Rezervim i ri
          </button>
        </div>
      </PageIntro>
      <section className="card">
        <div className="list-toolbar">
          <label className="search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kërko klientin, dhomën ose kodin…"
            />
          </label>
          <select
            className="filter-select"
            aria-label="Filtro statusin"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Të gjitha statuset</option>
            {Object.entries(statusNames).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
          <span className="muted">{filtered.length} rezervime</span>
        </div>
        <ReservationTable items={filtered} />
      </section>
    </>
  );
}
