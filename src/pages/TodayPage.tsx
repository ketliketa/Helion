import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  Brush,
  CalendarDays,
  CheckCircle2,
  Clock,
  DoorOpen,
  House,
  Plus,
  Wallet,
} from "lucide-react";
import { Stat } from "../components/ui";
import {
  active,
  fmt,
  money,
  propertyDate,
  shift,
  weekday,
} from "../lib/shared";
import type { PageProps } from "../lib/useWorkspace";
export function TodayPage({ context }: PageProps) {
  const {
    data,
    tab,
    setTab,
    filter,
    setCalendarDate,
    today,
    rooms,
    reservations,
    paid,
    occupied,
    arrivals,
    departures,
    dirty,
    rate,
    navigate,
    openReservation,
    ReservationTable,
    PageIntro,
    user,
  } = context;
  return (
    <>
      <PageIntro
        eyebrow="DITA JOTE, NË NJË VËSHTRIM"
        heading={`Mirë se erdhe, ${user.name.split(/[ .@]/)[0]}.`}
        description="Gjithçka gati për një ditë të mirë mikpritjeje."
      >
        <div className="intro-actions">
          <span className="date-label">
            <CalendarDays size={16} />
            {fmt(today, true)}
          </span>
          <button className="btn primary" onClick={() => openReservation()}>
            <Plus size={17} />
            Rezervim i ri
          </button>
        </div>
      </PageIntro>
      <div className="stats-grid">
        <Stat
          label="Zënia sot"
          value={rate + "%"}
          icon={BedDouble}
          note={`${occupied.length} nga ${rooms.filter((r) => !r.blocked).length} dhoma në shitje`}
        >
          <div className="occupancy-mini">
            {rooms.map((r, i) => (
              <i key={r.id} className={i < occupied.length ? "filled" : ""} />
            ))}
          </div>
        </Stat>
        <Stat
          label="Mbërritje"
          value={String(arrivals.length).padStart(2, "0")}
          icon={ArrowDownLeft}
          note="Për t'u pritur sot"
        >
          <span className="stat-context">
            Një mirëseardhje e ngrohtë <ArrowRight size={13} />
          </span>
        </Stat>
        <Stat
          label="Largime"
          value={String(departures.length).padStart(2, "0")}
          icon={ArrowUpRight}
          note="Check-out për t'u përfunduar"
        >
          <span className="stat-context">Kujdesu për detajet e fundit</span>
        </Stat>
        <Stat
          label="Pagesat sot"
          value={money(
            data.payments
              .filter(
                (p) =>
                  propertyDate(p.created) === today &&
                  reservations.some((r) => r.id === p.reservation_id),
              )
              .reduce((s, p) => s + p.amount, 0),
          )}
          icon={Wallet}
          note="Pagesa të regjistruara manualisht"
        >
          <span className="stat-context teal">
            <CheckCircle2 size={13} /> Historik i ruajtur
          </span>
        </Stat>
      </div>
      <div className="dashboard-grid">
        <section className="card arrivals-card">
          <div className="card-heading">
            <div>
              <h2>
                Lëvizjet e ditës{" "}
                <span className="counter">
                  {arrivals.length + departures.length}
                </span>
              </h2>
              <p>Çdo ardhje dhe largim, nën kontroll.</p>
            </div>
            <button
              className="text-btn"
              onClick={() => navigate("reservations")}
            >
              Të gjitha <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="tabs">
            <button
              className={tab === "arrivals" ? "selected" : ""}
              onClick={() => setTab("arrivals")}
            >
              Mbërritje <span>{arrivals.length}</span>
            </button>
            <button
              className={tab === "departures" ? "selected" : ""}
              onClick={() => setTab("departures")}
            >
              Largime <span>{departures.length}</span>
            </button>
            <button
              className={tab === "staying" ? "selected" : ""}
              onClick={() => setTab("staying")}
            >
              Në qëndrim{" "}
              <span>
                {reservations.filter((r) => r.status === "in_house").length}
              </span>
            </button>
          </div>
          <ReservationTable
            compact
            items={
              tab === "arrivals"
                ? arrivals
                : tab === "departures"
                  ? departures
                  : reservations.filter((r) => r.status === "in_house")
            }
          />
          <div className="card-footer">
            <span>
              <Clock size={13} />
              Sipas datës lokale të pronës
            </span>
            <button className="text-btn" onClick={() => navigate("calendar")}>
              Hap kalendarin <ArrowRight size={14} />
            </button>
          </div>
        </section>
        <aside className="right-stack">
          <section className="day-card">
            <span className="eyebrow">RRJEDHA E DITËS</span>
            <h2>
              Detajet e vogla.
              <br />
              Qëndrimet e mëdha.
            </h2>
            <div className="day-task">
              <span className="task-icon">
                <Brush size={18} />
              </span>
              <div>
                <strong>{dirty.length} dhoma për t'u përgatitur</strong>
                <small>Një hap përpara mbërritjes.</small>
              </div>
              <button
                className="icon-btn"
                aria-label="Hap pastrimin"
                onClick={() => navigate("housekeeping")}
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="day-task">
              <span className="task-icon">
                <Wallet size={18} />
              </span>
              <div>
                <strong>
                  {
                    reservations.filter(
                      (r) =>
                        active(r) &&
                        r.status !== "checked_out" &&
                        paid(r) < r.total,
                    ).length
                  }{" "}
                  rezervime me bilanc
                </strong>
                <small>Kontrollo pagesat e mbetura.</small>
              </div>
              <button
                className="icon-btn"
                aria-label="Hap rezervimet"
                onClick={() => navigate("reservations")}
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="day-decoration">
              <span />
              <span />
              <span />
              <House size={50} strokeWidth={1} />
            </div>
          </section>
          <section className="card room-overview">
            <div className="card-heading">
              <h2>Gjendja e dhomave</h2>
              <DoorOpen size={17} />
            </div>
            <div className="room-status-numbers">
              <div>
                <b>
                  {
                    rooms.filter(
                      (r) => r.housekeeping === "clean" && !r.blocked,
                    ).length
                  }
                </b>
                <span>
                  <i className="dot green" />
                  Të pastra
                </span>
              </div>
              <div>
                <b>{dirty.length}</b>
                <span>
                  <i className="dot amber" />
                  Për pastrim
                </span>
              </div>
              <div>
                <b>{rooms.filter((r) => r.blocked).length}</b>
                <span>
                  <i className="dot gray" />
                  Të bllokuara
                </span>
              </div>
            </div>
            <button className="text-btn" onClick={() => navigate("rooms")}>
              Menaxho dhomat <ArrowRight size={14} />
            </button>
          </section>
        </aside>
      </div>
      <section className="card week-card">
        <div className="card-heading">
          <div>
            <h2>Java në vazhdim</h2>
            <p>Një pamje e qartë e asaj që vjen.</p>
          </div>
          <button className="text-btn" onClick={() => navigate("calendar")}>
            Shiko kalendarin <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="week-bars">
          {Array.from({ length: 7 }, (_, i) => {
            const d = shift(today, i),
              count = reservations.filter(
                (r) => active(r) && r.check_in <= d && r.check_out > d,
              ).length;
            return (
              <button
                key={d}
                className={i === 0 ? "current" : ""}
                onClick={() => {
                  setCalendarDate(d);
                  navigate("calendar");
                }}
              >
                <div className="week-bar-label">
                  <span>{i === 0 ? "Sot" : weekday(d)}</span>
                  <b>
                    {count}
                    <small> / {rooms.length}</small>
                  </b>
                </div>
                <div className="week-track">
                  <span
                    style={{
                      width:
                        Math.max(3, (count / Math.max(1, rooms.length)) * 100) +
                        "%",
                    }}
                  />
                </div>
                <small>{fmt(d)}</small>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
