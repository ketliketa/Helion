import { ArrowUpRight, BedDouble, Info, Plus, Users } from "lucide-react";
import { active, cleanNames, money } from "../lib/shared";
import type { PageProps } from "../lib/useWorkspace";
export function RoomsPage({ context }: PageProps) {
  const {
    setModal,
    setBookingRoom,
    setRoomForm,
    today,
    rooms,
    reservations,
    PageIntro,
  } = context;
  return (
    <>
      <PageIntro
        eyebrow="INVENTARI I PRONËS"
        heading="Vend për çdo qëndrim."
        description="Menaxho dhomat, kapacitetin dhe çmimet bazë."
      >
        <button
          className="btn primary"
          onClick={() => {
            setRoomForm({
              name: "",
              type: "Standard",
              capacity: 2,
              price: 65,
              floor: "1",
            });
            setModal("room");
          }}
        >
          <Plus size={17} />
          Shto dhomë
        </button>
      </PageIntro>
      <div className="room-grid">
        {rooms.map((r, i) => (
          <section className="card room-card" key={r.id}>
            <div className={"room-visual room-visual-" + (i % 4)}>
              <BedDouble size={47} strokeWidth={1} />
              <span className="room-number">{r.name}</span>
              <span
                className={
                  "badge " +
                  (r.blocked
                    ? "cancelled"
                    : r.housekeeping === "clean"
                      ? "in_house"
                      : "pending")
                }
              >
                {r.blocked ? "E bllokuar" : cleanNames[r.housekeeping]}
              </span>
            </div>
            <div className="room-body">
              <div>
                <h2>{r.type}</h2>
                <span className="room-price">
                  {money(r.price)}
                  <small>/ natë</small>
                </span>
              </div>
              <p>
                <Users size={14} />
                {r.capacity} persona <span>·</span>Kati {r.floor}
              </p>
              <div className="room-card-footer">
                <span>
                  {reservations.some(
                    (v) =>
                      v.room_id === r.id &&
                      active(v) &&
                      v.check_in <= today &&
                      v.check_out > today,
                  )
                    ? "E zënë sot"
                    : "E lirë sot"}
                </span>
                <button
                  className="text-btn"
                  onClick={() => {
                    setBookingRoom(r.id);
                    setRoomForm({
                      name: r.name,
                      type: r.type,
                      capacity: r.capacity,
                      price: r.price / 100,
                      floor: r.floor,
                    });
                    setModal("editRoom");
                  }}
                >
                  Menaxho <ArrowUpRight size={15} />
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
      <div className="note">
        <Info size={17} /> Ndryshimi i çmimit bazë zbatohet për rezervimet e
        reja. Rezervimet ekzistuese ruajnë çmimin e tyre.
      </div>
    </>
  );
}
