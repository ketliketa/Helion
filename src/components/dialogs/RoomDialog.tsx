import { Plus } from "lucide-react";
import type { PageProps } from "../../lib/useWorkspace";
import { Field, Modal } from "../ui";
export function RoomDialog({ context }: PageProps) {
  const {
    busy,
    error,
    modal,
    roomForm,
    setRoomForm,
    property,
    mutate,
    title,
    closeModal,
  } = context;
  return (
    modal === "room" && (
      <Modal
        title="Një hapësirë e re"
        subtitle="Shto dhomë në inventarin e pronës."
        onClose={closeModal}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const d = await mutate(
              "createRoom",
              {
                propertyId: property.id,
                ...roomForm,
                price: Math.round(roomForm.price * 100),
              },
              "Dhoma u shtua.",
            );
            if (d) closeModal();
          }}
        >
          <div className="form-grid">
            <Field label="Numri / emri">
              <input
                required
                value={roomForm.name}
                maxLength={30}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, name: e.target.value })
                }
              />
            </Field>
            <Field label="Tipi">
              <select
                value={roomForm.type}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, type: e.target.value })
                }
              >
                {["Standard", "Deluxe", "Suite", "Family", "Apartament"].map(
                  (t) => (
                    <option key={t}>{t}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Kapaciteti">
              <input
                type="number"
                min="1"
                max="20"
                required
                value={roomForm.capacity}
                onChange={(e) =>
                  setRoomForm({
                    ...roomForm,
                    capacity: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Kati">
              <input
                required
                value={roomForm.floor}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, floor: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Çmimi për natë · EUR">
            <input
              type="number"
              required
              min="1"
              max="100000"
              step="0.01"
              value={roomForm.price}
              onChange={(e) =>
                setRoomForm({ ...roomForm, price: Number(e.target.value) })
              }
            />
          </Field>
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button className="btn primary" disabled={busy}>
              <Plus size={17} />
              Shto dhomën
            </button>
          </div>
        </form>
      </Modal>
    )
  );
}
