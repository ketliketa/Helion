import { Building2, Check, Plus } from "lucide-react";
import { Field } from "../components/ui";
import type { PageProps } from "../lib/useWorkspace";
export function SettingsPage({ context }: PageProps) {
  const {
    data,
    busy,
    setModal,
    setSetupStep,
    setSetup,
    property,
    mutate,
    PageIntro,
  } = context;
  return (
    <>
      <PageIntro
        eyebrow="PRONA JOTE, SIPAS TEJE"
        heading="Gjithçka në vendin e vet."
        description="Të dhënat bazë dhe cilësimet e hapësirës së punës."
      />
      <div className="settings-grid">
        <section className="card settings-card">
          <div className="card-heading">
            <h2>Profili i pronës</h2>
            <Building2 size={19} />
          </div>
          <form
            key={property.id}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await mutate(
                "saveProperty",
                { propertyId: property.id, ...Object.fromEntries(f) },
                "Cilësimet u ruajtën.",
              );
            }}
          >
            <Field label="Emri i pronës">
              <input name="name" required defaultValue={property.name} />
            </Field>
            <Field label="Qyteti dhe shteti">
              <input name="city" required defaultValue={property.city} />
            </Field>
            <div className="form-grid">
              <Field label="Email kontakti">
                <input
                  name="email"
                  type="email"
                  defaultValue={property.email}
                />
              </Field>
              <Field label="Telefoni">
                <input name="phone" defaultValue={property.phone} />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Monedha">
                <input value="EUR · Euro" readOnly />
              </Field>
              <Field label="Zona kohore">
                <input value={property.timezone} readOnly />
              </Field>
            </div>
            <button className="btn primary" disabled={busy}>
              <Check size={17} />
              Ruaj ndryshimet
            </button>
          </form>
        </section>
        <div className="right-stack">
          <section className="card settings-card">
            <h2>Hapësira e biznesit</h2>
            <p className="muted">
              {data.properties.length} prona në llogarinë tënde.
            </p>
            <button
              className="btn wide"
              onClick={() => {
                setSetupStep(1);
                setSetup({
                  name: "",
                  city: "",
                  email: "",
                  phone: "",
                  count: 6,
                  type: "Standard",
                  capacity: 2,
                  price: 65,
                });
                setModal("setup");
              }}
            >
              <Plus size={17} />
              Shto një pronë tjetër
            </button>
          </section>
          <section className="card settings-card">
            <h2>Aksesi dhe abonimi</h2>
            <div className="settings-line">
              <span>Roli yt</span>
              <strong>Pronar</strong>
            </div>
            <div className="settings-line">
              <span>Versioni</span>
              <span className="badge pending">Zhvillim</span>
            </div>
            <p className="muted">
              Menaxho ekipin, ftesat dhe aksesin nga faqja Stafi. Abonimin e
              menaxhon pronari nga faqja Abonimi.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
