import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Globe,
  Link2,
  Mail,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  days,
  fmt,
  initials,
  money,
  newId,
  shift,
  statusNames,
} from "../../lib/shared";
import type { PageProps } from "../../lib/useWorkspace";
import { Field } from "../ui";
export function ReservationDetailsDialog({ context }: PageProps) {
  const {
    data,
    busy,
    error,
    setError,
    setSelected,
    filter,
    payAmount,
    setPayAmount,
    payMethod,
    setPayMethod,
    editing,
    setEditing,
    editDates,
    setEditDates,
    confirmAction,
    setConfirmAction,
    today,
    rooms,
    paid,
    roomOf,
    chosen,
    notify,
    mutate,
    changeStatus,
  } = context;
  return (
    chosen && (
      <div
        className="drawer-backdrop"
        onClick={() => {
          setSelected(null);
          setError("");
        }}
      >
        <section
          className="drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="drawer-header">
            <div>
              <span className="eyebrow">DETAJET E REZERVIMIT</span>
              <small>#{chosen.id.slice(0, 8).toUpperCase()}</small>
            </div>
            <button
              className="icon-btn"
              aria-label="Mbyll detajet"
              onClick={() => setSelected(null)}
            >
              <X size={21} />
            </button>
          </div>
          <div className="drawer-body">
            <div className="detail-guest">
              <span className="avatar large color-0">
                {initials(chosen.guest)}
              </span>
              <h2 id="detail-title">{chosen.guest}</h2>
              <span className={"badge " + chosen.status}>
                <i />
                {statusNames[chosen.status]}
              </span>
            </div>
            <div className="detail-dates">
              <div>
                <span>MBËRRITJA</span>
                <strong>{fmt(chosen.check_in, true)}</strong>
              </div>
              <ArrowRight size={19} />
              <div>
                <span>LARGIMI</span>
                <strong>{fmt(chosen.check_out, true)}</strong>
              </div>
            </div>
            <div className="detail-info">
              <span>
                <BedDouble size={17} />
                Dhoma {roomOf(chosen)?.name} · {roomOf(chosen)?.type}
              </span>
              <span>
                <Users size={17} />
                {chosen.adults} persona ·{" "}
                {days(chosen.check_in, chosen.check_out)} net
              </span>
              <span>
                <Mail size={17} />
                {chosen.email || "Nuk është dhënë email"}
              </span>
              <span>
                <Globe size={17} />
                {chosen.source}
              </span>
            </div>
            {chosen.notes && <div className="detail-note">{chosen.notes}</div>}
            <div className="detail-section">
              <h3>Veprimet e qëndrimit</h3>
              {chosen.status === "confirmed" && (
                <div className="action-grid">
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() => changeStatus(chosen, "in_house")}
                  >
                    <ArrowDownLeft size={17} />
                    Check-in
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setEditing(!editing);
                      setEditDates({
                        checkIn: chosen.check_in,
                        checkOut: chosen.check_out,
                        roomId: chosen.room_id,
                      });
                    }}
                  >
                    <CalendarDays size={17} />
                    Ndrysho
                  </button>
                  <button
                    className="btn danger-text"
                    onClick={() => setConfirmAction("cancelled")}
                  >
                    Anulo rezervimin
                  </button>
                  <button
                    className="btn"
                    onClick={() => setConfirmAction("no_show")}
                  >
                    Nuk u paraqit
                  </button>
                </div>
              )}
              {chosen.status === "in_house" && (
                <button
                  className="btn primary wide"
                  onClick={() => setConfirmAction("checked_out")}
                >
                  <ArrowUpRight size={17} />
                  Përfundo check-out
                </button>
              )}
              {["checked_out", "cancelled", "no_show"].includes(
                chosen.status,
              ) && (
                <p className="muted">
                  Ky qëndrim është mbyllur. Historiku dhe pagesat ruhen.
                </p>
              )}
              {confirmAction && (
                <div className="confirm-box">
                  <strong>
                    {confirmAction === "checked_out"
                      ? "Përfundon qëndrimin?"
                      : confirmAction === "cancelled"
                        ? "Anulon rezervimin?"
                        : "Shënon që nuk u paraqit?"}
                  </strong>
                  <p>
                    {confirmAction === "checked_out"
                      ? `Dhoma do të shënohet për pastrim. Bilanci i mbetur: ${money(Math.max(0, chosen.total - paid(chosen)))}.`
                      : paid(chosen) > 0
                        ? "Pagesat ruhen; rimbursimi duhet trajtuar veçmas."
                        : "Inventari përkatës do të lirohet."}
                  </p>
                  <div>
                    <button
                      className="btn"
                      onClick={() => setConfirmAction("")}
                    >
                      Mbyll
                    </button>
                    <button
                      className="btn primary"
                      disabled={busy}
                      onClick={() => changeStatus(chosen, confirmAction)}
                    >
                      Konfirmo
                    </button>
                  </div>
                </div>
              )}
              {editing && (
                <form
                  className="edit-date-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const d = await mutate(
                      "changeDates",
                      {
                        id: chosen.id,
                        version: chosen.version,
                        ...editDates,
                      },
                      "Datat u ndryshuan.",
                    );
                    if (d) setEditing(false);
                  }}
                >
                  <div className="form-grid">
                    <Field label="Mbërritja">
                      <input
                        type="date"
                        min={today}
                        required
                        value={editDates.checkIn}
                        onChange={(e) =>
                          setEditDates({
                            ...editDates,
                            checkIn: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Largimi">
                      <input
                        type="date"
                        required
                        min={shift(editDates.checkIn, 1)}
                        value={editDates.checkOut}
                        onChange={(e) =>
                          setEditDates({
                            ...editDates,
                            checkOut: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Dhoma">
                    <select
                      value={editDates.roomId}
                      onChange={(e) =>
                        setEditDates({ ...editDates, roomId: e.target.value })
                      }
                    >
                      {rooms
                        .filter(
                          (r) => !r.blocked && r.capacity >= chosen.adults,
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} · {r.type}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <p className="muted">
                    E njëjta dhomë ruan çmimin historik; dhoma tjetër përdor
                    çmimin bazë aktual.
                  </p>
                  <button className="btn primary" disabled={busy}>
                    Ruaj ndryshimin
                  </button>
                </form>
              )}
            </div>
            <div className="detail-section">
              <h3>
                Pagesat <span className="badge neutral">Regjistrim manual</span>
              </h3>
              <div className="balance-lines">
                <div>
                  <span>Totali i qëndrimit</span>
                  <strong>{money(chosen.total)}</strong>
                </div>
                <div>
                  <span>Pagesa të regjistruara</span>
                  <strong className="teal">{money(paid(chosen))}</strong>
                </div>
                <div className="balance-total">
                  <span>Bilanci i mbetur</span>
                  <strong>
                    {money(Math.max(0, chosen.total - paid(chosen)))}
                  </strong>
                </div>
              </div>
              {data.payments
                .filter((p) => p.reservation_id === chosen.id)
                .map((p) => (
                  <div className="payment-line" key={p.id}>
                    <CheckCircle2 size={15} />
                    <span>
                      {p.method === "cash"
                        ? "Cash"
                        : p.method === "card"
                          ? "Kartë · manuale"
                          : "Transfertë bankare"}
                      <small>
                        {new Date(p.created).toLocaleDateString("sq-AL")}
                      </small>
                    </span>
                    <strong>{money(p.amount)}</strong>
                  </div>
                ))}
              {paid(chosen) < chosen.total &&
                !["cancelled", "no_show"].includes(chosen.status) && (
                  <form
                    className="payment-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await mutate(
                        "payment",
                        {
                          id: newId(),
                          reservationId: chosen.id,
                          amount: Math.round(Number(payAmount) * 100),
                          method: payMethod,
                        },
                        "Pagesa manuale u regjistrua.",
                      );
                    }}
                  >
                    <Field label="Shuma · EUR">
                      <input
                        required
                        type="number"
                        min="0.01"
                        max={(chosen.total - paid(chosen)) / 100}
                        step="0.01"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                    </Field>
                    <Field label="Mënyra">
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value)}
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Kartë · regjistrim manual</option>
                        <option value="bank">Transfertë bankare</option>
                      </select>
                    </Field>
                    <button className="btn primary" disabled={busy}>
                      <Plus size={16} />
                      Regjistro
                    </button>
                  </form>
                )}
            </div>
            <div className="detail-section">
              <h3>Pagesë online</h3>
              <p className="muted">
                Krijo një link për bilancin e mbetur. Statusi ndryshon vetëm pas
                konfirmimit të ofruesit.
              </p>
              <button
                className="btn primary wide"
                disabled={busy || paid(chosen) >= chosen.total}
                onClick={async () => {
                  const r = await mutate(
                    "checkout",
                    { reservationId: chosen.id },
                    "",
                  );
                  if (r?.url) {
                    await navigator.clipboard.writeText(r.url);
                    notify("Linku i pagesës u kopjua. Dërgoja klientit.");
                  }
                }}
              >
                <Link2 size={18} />
                Krijo dhe kopjo linkun
              </button>
              {!data.integrations?.stripe && (
                <p className="muted">
                  Ofruesi i pagesave nuk është konfiguruar ende.
                </p>
              )}
            </div>
            {error && (
              <div className="error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
          <div className="drawer-footer">
            <ShieldCheck size={15} />
            Ndryshimet ruhen në historikun e pronës.
          </div>
        </section>
      </div>
    )
  );
}
