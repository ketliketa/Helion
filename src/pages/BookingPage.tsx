import {
  ArrowRight,
  BedDouble,
  CheckCircle2,
  House,
  Info,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { BookingSettings } from "../components/BookingSettings";
import { Empty, Field } from "../components/ui";
import { days, money, shift } from "../lib/shared";
import type { PageProps } from "../lib/useWorkspace";
export function BookingPage({ context }: PageProps) {
  const {
    filter,
    bookingIn,
    setBookingIn,
    bookingOut,
    setBookingOut,
    persons,
    setPersons,
    setResForm,
    today,
    property,
    rooms,
    available,
    openReservation,
    title,
    PageIntro,
  } = context;
  return (
    <>
      <PageIntro
        eyebrow="BOOKING ENGINE"
        heading="Më afër vizitorit tënd."
        description="Provo rrjedhën e rezervimit direkt me inventarin e kësaj prone."
      />
      <BookingSettings context={context} />
      <div className="booking-preview">
        <div className="booking-top">
          <div className="property-wordmark">
            <span className="property-icon">
              <House size={23} />
            </span>
            <div>
              <strong>{property.name}</strong>
              <small>
                <MapPin size={12} />
                {property.city}
              </small>
            </div>
          </div>
          <span className="badge confirmed">
            <ShieldCheck size={12} />
            Pamja e pronës
          </span>
        </div>
        <div className="booking-hero">
          <span className="eyebrow">NJË PUSHIM QË FILLON MIRË</span>
          <h2>
            Hapësira jote.
            <br />
            Me ritmin tënd.
          </h2>
          <p>Zgjidh datat dhe gjej qëndrimin tënd të ardhshëm.</p>
          <div className="booking-art">
            <div className="arch arch1" />
            <div className="arch arch2" />
            <div className="arch arch3" />
            <div className="sun" />
          </div>
        </div>
        <div className="booking-search">
          <Field label="Mbërritja">
            <input
              type="date"
              min={today}
              value={bookingIn}
              onChange={(e) => {
                setBookingIn(e.target.value);
                if (e.target.value >= bookingOut)
                  setBookingOut(shift(e.target.value, 1));
              }}
            />
          </Field>
          <Field label="Largimi">
            <input
              type="date"
              min={shift(bookingIn, 1)}
              value={bookingOut}
              onChange={(e) => setBookingOut(e.target.value)}
            />
          </Field>
          <Field label="Persona">
            <select
              value={persons}
              onChange={(e) => setPersons(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <div className="availability-count">
            <CheckCircle2 size={18} />
            <strong>
              {
                rooms.filter(
                  (r) =>
                    r.capacity >= persons &&
                    available(r, bookingIn, bookingOut),
                ).length
              }{" "}
              dhoma të lira
            </strong>
          </div>
        </div>
        <div className="booking-results">
          <h3>
            Zgjidh hapësirën tënde{" "}
            <span>
              {days(bookingIn, bookingOut) > 0
                ? days(bookingIn, bookingOut)
                : 0}{" "}
              net
            </span>
          </h3>
          {rooms
            .filter(
              (r) =>
                r.capacity >= persons && available(r, bookingIn, bookingOut),
            )
            .map((r, i) => (
              <div className="booking-result" key={r.id}>
                <div className={"booking-room-art room-visual-" + (i % 4)}>
                  <BedDouble size={44} strokeWidth={1} />
                </div>
                <div>
                  <h3>
                    {r.type} · {r.name}
                  </h3>
                  <p>
                    <Users size={14} />
                    Deri në {r.capacity} persona
                  </p>
                  <small>Çmimi bazë i dhomës · pa pagesë online</small>
                </div>
                <div className="booking-result-price">
                  <strong>
                    {money(r.price * days(bookingIn, bookingOut))}
                  </strong>
                  <small>{money(r.price)} / natë</small>
                  <button
                    className="btn primary"
                    onClick={() => {
                      openReservation(r.id, bookingIn, "Booking Engine");
                      setResForm((f) => ({
                        ...f,
                        checkOut: bookingOut,
                        adults: persons,
                      }));
                    }}
                  >
                    Zgjidh dhomën <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            ))}
          {!rooms.some(
            (r) => r.capacity >= persons && available(r, bookingIn, bookingOut),
          ) && (
            <Empty
              icon={BedDouble}
              title="Nuk ka dhoma për këtë kërkim"
              detail="Provo data ose numër tjetër personash."
            />
          )}
        </div>
        <div className="booking-note">
          <Info size={16} />
          Kjo parapamje krijon rezervime në pronën tënde. Linku publik
          kontrollohet nga konfigurimi më sipër. Email-et dhe pagesat kërkojnë
          konfigurimin e ofruesve.
        </div>
      </div>
    </>
  );
}
