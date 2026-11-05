import { CheckCircle2, Clock } from "lucide-react";
import type { PageProps } from "../../lib/useWorkspace";
import { Modal } from "../ui";
export function AboutDialog({ context }: PageProps) {
  const { modal, title, closeModal } = context;
  return (
    modal === "about" && (
      <Modal
        title="HotelFlow, hapi i parë"
        subtitle="Version funksional zhvillimi · 0.2"
        onClose={closeModal}
      >
        <div className="about-list">
          <h3>Funksionon tani</h3>
          {[
            "Hyrje me email dhe fjalëkalim; prona të ndara",
            "Konfigurimi i pronës, dhomat dhe çmimet bazë",
            "Rezervime me kontroll mbivendosjeje dhe kalendar",
            "Ndryshim datash, anulim, check-in dhe check-out",
            "Pastrimi, pagesat, 12 raporte dhe eksport PDF, Word e CSV",
            "Booking Engine publik me link të veçantë për pronën",
          ].map((s) => (
            <p key={s}>
              <CheckCircle2 size={17} />
              {s}
            </p>
          ))}
          <h3>Në fazat e ardhshme</h3>
          <p>
            <Clock size={17} />
            Tarifa sezonale, rimbursime automatike dhe kanale reale. Pagesat dhe
            email-et kërkojnë konfigurimin e ofruesve.
          </p>
        </div>
        <div className="note">
          Versioni i marsit kërkon zhvillim dhe testim të mëtejshëm. Përdore
          këtë version për provë, jo për operim kritik të një hoteli.
        </div>
      </Modal>
    )
  );
}
