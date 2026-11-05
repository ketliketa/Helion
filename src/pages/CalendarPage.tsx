import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { active, days, fmt, money, shift, weekday } from "../lib/shared";
import type { PageProps } from "../lib/useWorkspace";
export function CalendarPage({ context }: PageProps) {
  const {
    calendarSpan,
    setCalendarSpan,
    query,
    setQuery,
    filter,
    calendarDate,
    setCalendarDate,
    today,
    rooms,
    reservations,
    openReservation,
    openDetails,
    title,
    PageIntro,
  } = context;
  return (
    <>
      <PageIntro
        eyebrow="REZERVIMET NË RRJEDHË"
        heading="Çdo dhomë. Çdo qëndrim."
        description="Shiko disponueshmërinë dhe planifiko me qartësi."
      >
        <button className="btn primary" onClick={() => openReservation()}>
          <Plus size={17} />
          Rezervim i ri
        </button>
      </PageIntro>
      <section className="card calendar-card">
        <div className="calendar-toolbar">
          <div className="calendar-controls">
            <button
              className="icon-btn"
              aria-label="Java e mëparshme"
              onClick={() => setCalendarDate(shift(calendarDate, -7))}
            >
              <ChevronLeft size={18} />
            </button>
            <h2>
              {fmt(calendarDate)} —{" "}
              {fmt(shift(calendarDate, calendarSpan - 1), true)}
            </h2>
            <button
              className="icon-btn"
              aria-label="Java tjetër"
              onClick={() => setCalendarDate(shift(calendarDate, 7))}
            >
              <ChevronRight size={18} />
            </button>
            <button className="btn slim" onClick={() => setCalendarDate(today)}>
              Sot
            </button>
          </div>
          <select
            className="calendar-span"
            aria-label="Ditët e kalendarit"
            value={calendarSpan}
            onChange={(e) => setCalendarSpan(Number(e.target.value))}
          >
            <option value={7}>7 ditë</option>
            <option value={14}>14 ditë</option>
          </select>
          <label className="search small-search">
            <Search size={16} />
            <input
              placeholder="Kërko dhomën…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="calendar-scroll">
          <div
            className="calendar-grid"
            style={{
              gridTemplateColumns: `180px repeat(${calendarSpan},minmax(105px,1fr))`,
              minWidth: 180 + calendarSpan * 105,
            }}
          >
            <div className="cal-head-room">
              DHOMA <small>{rooms.length} gjithsej</small>
            </div>
            {Array.from({ length: calendarSpan }, (_, i) => {
              const d = shift(calendarDate, i);
              return (
                <div
                  key={d}
                  className={"cal-head " + (d === today ? "is-today" : "")}
                >
                  <span>{weekday(d)}</span>
                  <b>{Number(d.slice(-2))}</b>
                </div>
              );
            })}
            {rooms
              .filter((r) =>
                (r.name + " " + r.type)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((room) => (
                <div className="cal-row" key={room.id}>
                  <div className="cal-room">
                    <span className="room-chip">{room.name}</span>
                    <div>
                      <strong>{room.type}</strong>
                      <small>{money(room.price)} / natë</small>
                    </div>
                  </div>
                  <div
                    className="cal-days"
                    style={{
                      gridTemplateColumns: `repeat(${calendarSpan},minmax(0,1fr))`,
                      gridColumn: `span ${calendarSpan}`,
                    }}
                  >
                    {Array.from({ length: calendarSpan }, (_, i) => (
                      <button
                        aria-label={`Rezervo dhomën ${room.name}, ${shift(calendarDate, i)}`}
                        className={
                          "cal-day " +
                          (shift(calendarDate, i) === today ? "is-today" : "") +
                          (room.blocked ? " blocked" : "")
                        }
                        key={i}
                        disabled={
                          !!room.blocked || shift(calendarDate, i) < today
                        }
                        onClick={() =>
                          openReservation(room.id, shift(calendarDate, i))
                        }
                      />
                    ))}
                    {reservations
                      .filter(
                        (r) =>
                          r.room_id === room.id &&
                          active(r) &&
                          r.check_in < shift(calendarDate, calendarSpan) &&
                          r.check_out > calendarDate,
                      )
                      .map((r) => {
                        const start = Math.max(
                            0,
                            days(calendarDate, r.check_in),
                          ),
                          end = Math.min(
                            calendarSpan,
                            days(calendarDate, r.check_out),
                          );
                        return (
                          <button
                            key={r.id}
                            className={"cal-event " + r.status}
                            style={{
                              left: `calc(${(start / calendarSpan) * 100}% + 3px)`,
                              width: `calc(${((end - start) / calendarSpan) * 100}% - 6px)`,
                            }}
                            onClick={() => openDetails(r)}
                            title={`${r.guest}: ${r.check_in} → ${r.check_out}`}
                          >
                            <span className="event-dot" />
                            {r.guest}
                            <span className="event-extra">
                              {days(r.check_in, r.check_out)} net
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="calendar-legend">
          <span>
            <i className="dot green" />
            Në qëndrim
          </span>
          <span>
            <i className="dot blue" />
            Konfirmuar
          </span>
          <span>
            <i className="dot gray" />
            Përfunduar
          </span>
          <small>Kliko një hapësirë të lirë për rezervim të ri.</small>
        </div>
      </section>
    </>
  );
}
