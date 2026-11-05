import { CheckCircle2, Clock, Info, Link2, RefreshCw } from "lucide-react";
import { newId } from "../lib/shared";
import type { PageProps } from "../lib/useWorkspace";
export function ChannelsPage({ context }: PageProps) {
  const {
    data,
    busy,
    setModal,
    filter,
    setBookingRoom,
    property,
    mutate,
    PageIntro,
  } = context;
  return (
    <>
      <PageIntro
        eyebrow="LIDHJET ME PLATFORMAT"
        heading="Një vend. Të gjitha kanalet."
        description="Baza për lidhjet e ardhshme — pa sinkronizime reale në këtë version."
      />
      <div className="channel-notice">
        <span className="task-icon">
          <Link2 size={24} />
        </span>
        <div>
          <h2>Gati për hapin e ardhshëm</h2>
          <p>
            Rezervimet e këtij versioni ndajnë të njëjtin inventar. Lidhjet e
            jashtme do të aktivizohen pas aksesit, integrimit dhe testimit.
          </p>
        </div>
        <span className="badge pending">Në zhvillim</span>
      </div>
      <div className="channel-grid">
        {[
          { name: "Booking.com", letter: "B.", className: "bookingcom" },
          { name: "Expedia", letter: "e", className: "expedia" },
          { name: "Airbnb", letter: "A", className: "airbnb" },
        ].map((c) => (
          <section className="card channel-card" key={c.name}>
            <div className={"channel-logo " + c.className}>{c.letter}</div>
            <h2>{c.name}</h2>
            <span className="badge neutral">Nuk është lidhur</span>
            <p>Rezervime · Çmime · Disponueshmëri</p>
            <button
              className="btn wide"
              onClick={() => {
                setBookingRoom(c.name);
                setModal("channel");
              }}
            >
              <Info size={16} />
              Shiko kërkesat
            </button>
          </section>
        ))}
      </div>
      <section className="card integration-list">
        <div className="card-heading" style={{ padding: 0, marginBottom: 20 }}>
          <div>
            <h2>Simulatori i inventarit</h2>
            <p>
              Validon 14 ditë disponueshmëri dhe çmime. Nuk kontakton platforma
              të jashtme.
            </p>
          </div>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() =>
              mutate(
                "simulateChannel",
                { id: newId(), propertyId: property.id },
                "Simulimi përfundoi. Asnjë e dhënë nuk u dërgua jashtë.",
              )
            }
          >
            <RefreshCw size={15} />
            Provo sinkronizimin
          </button>
        </div>
        {data.channelJobs
          .filter((j) => j.property_id === property.id)
          .slice(0, 3)
          .map((j) => (
            <div key={j.id}>
              <CheckCircle2 size={17} />
              {JSON.parse(j.result).accepted} vlera të validuara
              <span>
                Simulim · {new Date(j.created).toLocaleString("sq-AL")}
              </span>
            </div>
          ))}
        <h2 style={{ marginTop: 25 }}>Çfarë përgatitet për integrimin</h2>
        {[
          "Përputhja e dhomave dhe planeve tarifore",
          "Ngjarje hyrëse pa dublime dhe radhë dërgimi",
          "Riprovime dhe kontroll gabimesh",
        ].map((s) => (
          <div key={s}>
            <Clock size={17} />
            {s}
            <span>Në planin e zhvillimit</span>
          </div>
        ))}
      </section>
    </>
  );
}
