import { Check, Info } from "lucide-react";
import { cleanNames } from "../../lib/shared";
import type { PageProps } from "../../lib/useWorkspace";
import { Field, Modal } from "../ui";
export function EditRoomDialog({ context }: PageProps) {
  const {
    busy,
    error,
    modal,
    bookingRoom,
    property,
    rooms,
    mutate,
    title,
    closeModal,
  } = context;
  return (
    modal === "editRoom" &&
    (() => {
      const r = rooms.find((r) => r.id === bookingRoom)!;
      return (
        <Modal
          title={`Dhoma ${r.name} · ${r.type}`}
          subtitle="Çmimi dhe gjendja operacionale."
          onClose={closeModal}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                d = await mutate(
                  "saveRoom",
                  {
                    propertyId: property.id,
                    roomId: r.id,
                    price: Math.round(Number(f.get("price")) * 100),
                    housekeeping: f.get("housekeeping"),
                    blocked: f.get("blocked") === "on",
                  },
                  "Dhoma u përditësua.",
                );
              if (d) closeModal();
            }}
          >
            <Field label="Çmimi bazë për natë · EUR">
              <input
                name="price"
                type="number"
                required
                min="1"
                max="100000"
                step="0.01"
                defaultValue={r.price / 100}
              />
            </Field>
            <Field label="Pastërtia">
              <select name="housekeeping" defaultValue={r.housekeeping}>
                {Object.entries(cleanNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <label className="checkbox-line">
              <input
                name="blocked"
                type="checkbox"
                defaultChecked={!!r.blocked}
              />
              Blloko dhomën për rezervime të reja
            </label>
            <div className="note">
              <Info size={16} />
              Bllokimi lejohet vetëm pa rezervime aktive të ardhshme.
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn primary" disabled={busy}>
                <Check size={16} />
                Ruaj
              </button>
            </div>
          </form>
        </Modal>
      );
    })()
  );
}
