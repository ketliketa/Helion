import { Brush, Check, ClipboardList, Users } from "lucide-react";
import { cleanNames } from "../lib/shared";
import type { PageProps } from "../lib/useWorkspace";
export function HousekeepingPage({ context }: PageProps) {
  const { rooms, property, data, user, busy, mutate } = context;
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">GATI PËR MIRËSEARDHJEN</span>
          <h1>Çdo dhomë, gati në kohë.</h1>
          <p>
            Cakto përgjegjësin, lër shënime dhe ndiq pastrimin hap pas hapi.
          </p>
        </div>
        <span className="date-label">
          <Brush size={21} />
          {rooms.filter((r) => r.housekeeping !== "clean").length} dhoma në
          pritje
        </span>
      </div>
      <div className="housekeeping-columns">
        {["dirty", "cleaning", "clean"].map((status) => (
          <section className="hk-column" key={status}>
            <h2>
              <i
                className={
                  "dot " +
                  (status === "clean"
                    ? "green"
                    : status === "dirty"
                      ? "amber"
                      : "blue")
                }
              />
              {cleanNames[status]}
              <span className="counter">
                {rooms.filter((r) => r.housekeeping === status).length}
              </span>
            </h2>
            {rooms
              .filter((r) => r.housekeeping === status)
              .map((r) => {
                const a = data.assignments?.find((a) => a.room_id === r.id),
                  canManage = ["owner", "manager"].includes(user.role),
                  canChange =
                    user.role !== "housekeeper" ||
                    !a?.user_id ||
                    a.user_id === user.id;
                return (
                  <article className="card hk-card" key={r.id}>
                    <div>
                      <span className="room-chip">{r.name}</span>
                      <strong>{r.type}</strong>
                    </div>
                    <p>
                      Kati {r.floor} · {r.capacity} persona
                    </p>
                    {canManage ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const f = Object.fromEntries(
                            new FormData(e.currentTarget),
                          );
                          await mutate(
                            "assignRoom",
                            { propertyId: property.id, roomId: r.id, ...f },
                            "Detyra u caktua.",
                          );
                        }}
                      >
                        <label className="field">
                          <span>Përgjegjësi</span>
                          <select name="userId" defaultValue={a?.user_id || ""}>
                            <option value="">Pa caktuar</option>
                            {(data.staff || [])
                              .filter((s) => s.active)
                              .map((s) => (
                                <option value={s.id} key={s.id}>
                                  {s.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Shënim për ekipin</span>
                          <textarea
                            name="note"
                            rows={2}
                            maxLength={1000}
                            defaultValue={a?.note || ""}
                            placeholder="P.sh. shtro krevatin shtesë"
                          />
                        </label>
                        <button className="btn wide" disabled={busy}>
                          <ClipboardList size={17} />
                          Ruaj detyrën
                        </button>
                      </form>
                    ) : (
                      <div className="task-summary">
                        <p>
                          <Users size={17} />
                          {a?.assigned_name || "Pa caktuar"}
                        </p>
                        {a?.note && <p>{a.note}</p>}
                      </div>
                    )}
                    <button
                      className={
                        "btn wide " + (status === "cleaning" ? "primary" : "")
                      }
                      disabled={busy || !canChange}
                      onClick={() =>
                        mutate(
                          "saveRoom",
                          {
                            propertyId: property.id,
                            roomId: r.id,
                            price: r.price,
                            blocked: r.blocked,
                            housekeeping:
                              status === "dirty"
                                ? "cleaning"
                                : status === "cleaning"
                                  ? "clean"
                                  : "dirty",
                          },
                          "Gjendja e dhomës u ruajt.",
                        )
                      }
                    >
                      <Check size={19} />
                      {status === "dirty"
                        ? "Fillo pastrimin"
                        : status === "cleaning"
                          ? "Përfundo pastrimin"
                          : "Shëno për pastrim"}
                    </button>
                    {!canChange && (
                      <small className="muted">
                        Caktuar një punonjësi tjetër
                      </small>
                    )}
                  </article>
                );
              })}
            {!rooms.some((r) => r.housekeeping === status) && (
              <p className="muted hk-empty">Asnjë dhomë në këtë gjendje.</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
