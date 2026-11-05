import { Info } from "lucide-react";
import type { PageProps } from "../../lib/useWorkspace";
import { Modal } from "../ui";
export function ChannelDialog({ context }: PageProps) {
  const { modal, bookingRoom, title, closeModal } = context;
  return (
    modal === "channel" && (
      <Modal
        title={bookingRoom}
        subtitle="Lidhje e planifikuar, ende jo aktive."
        onClose={closeModal}
      >
        <div className="note">
          <Info size={20} />
          Ky kanal nuk është i lidhur. Nuk dërgohen çmime dhe nuk importohen
          rezervime reale.
        </div>
        <ol className="requirements">
          <li>Akses ose partner i autorizuar për integrimin.</li>
          <li>Përshtatje dhe testim i adapter-it API.</li>
          <li>Përputhje dhomash dhe planesh tarifore.</li>
          <li>Testet e rezervimeve, ndryshimeve dhe anulimeve.</li>
          <li>Aktivizim pilot dhe monitorim i sinkronizimit.</li>
        </ol>
        <button className="btn primary wide" onClick={closeModal}>
          E kuptova
        </button>
      </Modal>
    )
  );
}
