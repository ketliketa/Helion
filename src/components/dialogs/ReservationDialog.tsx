import { CalendarDays, Check, Loader2, Users } from "lucide-react";
import { money, shift } from "../../lib/shared";
import type { PageProps } from "../../lib/useWorkspace";
import { Field, Modal } from "../ui";
export function ReservationDialog({ context }: PageProps) {
  const {
    busy,
    error,
    modal,
    setSelected,
    resForm,
    setResForm,
    submitKey,
    today,
    property,
    mutate,
    navigate,
    title,
    closeModal,
    formRooms,
    formRoom,
    formNights,
  } = context;
  return (
    modal === "reservation" && (
      <Modal
        title={
          resForm.source === "Booking Engine"
            ? "Përfundo rezervimin direkt"
            : "Një qëndrim i ri"
        }
        subtitle="Detajet e duhura për një fillim të mbarë."
        onClose={closeModal}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const d = await mutate(
              "createReservation",
              { ...resForm, propertyId: property.id, id: submitKey.current },
              "Rezervimi u ruajt në kalendar.",
            );
            if (d) {
              closeModal();
              navigate("reservations");
              setSelected(d.id);
            }
          }}
        >
          <div className="form-section-title">
            <Users size={16} />
            KLIENTI
          </div>
          <Field label="Emri dhe mbiemri">
            <input
              required
              autoFocus
              placeholder="P.sh. Elena Rossi"
              value={resForm.guest}
              onChange={(e) =>
                setResForm({ ...resForm, guest: e.target.value })
              }
              maxLength={150}
            />
          </Field>
          <div className="form-grid">
            <Field label="Email">
              <input
                type="email"
                placeholder="email@shembull.com"
                value={resForm.email}
                onChange={(e) =>
                  setResForm({ ...resForm, email: e.target.value })
                }
              />
            </Field>
            <Field label="Telefoni">
              <input
                placeholder="+355…"
                value={resForm.phone}
                onChange={(e) =>
                  setResForm({ ...resForm, phone: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="form-section-title">
            <CalendarDays size={16} />
            QËNDRIMI
          </div>
          <div className="form-grid">
            <Field label="Mbërritja">
              <input
                type="date"
                required
                min={today}
                value={resForm.checkIn}
                onChange={(e) =>
                  setResForm({
                    ...resForm,
                    checkIn: e.target.value,
                    checkOut:
                      e.target.value >= resForm.checkOut
                        ? shift(e.target.value, 1)
                        : resForm.checkOut,
                    roomId: "",
                  })
                }
              />
            </Field>
            <Field label="Largimi">
              <input
                type="date"
                required
                min={shift(resForm.checkIn, 1)}
                value={resForm.checkOut}
                onChange={(e) =>
                  setResForm({
                    ...resForm,
                    checkOut: e.target.value,
                    roomId: "",
                  })
                }
              />
            </Field>
            <Field label="Persona">
              <input
                type="number"
                required
                min="1"
                max="20"
                value={resForm.adults}
                onChange={(e) =>
                  setResForm({
                    ...resForm,
                    adults: Number(e.target.value),
                    roomId: "",
                  })
                }
              />
            </Field>
            <Field label="Dhoma e disponueshme">
              <select
                required
                value={resForm.roomId}
                onChange={(e) =>
                  setResForm({ ...resForm, roomId: e.target.value })
                }
              >
                <option value="">Zgjidh dhomën</option>
                {formRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.type} · {money(r.price)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {!formRooms.length && (
            <div className="note warning">
              Nuk ka dhoma për këto data dhe këtë kapacitet.
            </div>
          )}
          <Field label="Shënime · opsionale">
            <textarea
              rows={2}
              maxLength={2000}
              value={resForm.notes}
              onChange={(e) =>
                setResForm({ ...resForm, notes: e.target.value })
              }
              placeholder="Kërkesa të veçanta, ora e mbërritjes…"
            />
          </Field>
          <div className="quote">
            <div>
              <span>
                {Math.max(0, formNights)} net{" "}
                {formRoom ? "× " + money(formRoom.price) : ""}
              </span>
              <small>Çmimi bazë · pa pagesë automatike</small>
            </div>
            <strong>
              {money(
                formRoom && formNights > 0 ? formRoom.price * formNights : 0,
              )}
            </strong>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={closeModal}>
              Mbyll
            </button>
            <button
              disabled={busy || !formRooms.length}
              className="btn primary"
            >
              {busy ? (
                <Loader2 className="spin" size={17} />
              ) : (
                <Check size={17} />
              )}
              Konfirmo rezervimin
            </button>
          </div>
        </form>
      </Modal>
    )
  );
}
