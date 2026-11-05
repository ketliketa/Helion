import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  House,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { localToday, money, newId, shift } from "../lib/shared";
export function PublicBooking({ slug }: { slug: string }) {
  const [from, setFrom] = useState(localToday()),
    [to, setTo] = useState(shift(localToday(), 1)),
    [adults, setAdults] = useState(2),
    [data, setData] = useState<any>(null),
    [room, setRoom] = useState<any>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(newId());
  useEffect(() => {
    if (!from || !to || to <= from) return;
    const c = new AbortController();
    setError("");
    fetch(
      "/api/public/" +
        encodeURIComponent(slug) +
        "?" +
        new URLSearchParams({ from, to, adults: String(adults) }),
      { signal: c.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [slug, from, to, adults]);
  return (
    <div className="public-booking">
      <header>
        <a href="/" className="brand">
          <span>
            <House size={24} />
          </span>
          <strong>
            hotel<span>flow</span>
          </strong>
        </a>
        <span>Rezervo direkt me pronën</span>
      </header>
      <main>
        {success ? (
          <section className="card booking-success">
            <CheckCircle2 size={55} />
            <h1>Rezervimi u konfirmua.</h1>
            <p>
              Kodi yt: <strong>{success.id.slice(0, 8).toUpperCase()}</strong>
            </p>
            <p>Totali: {money(success.total)}</p>
            <p>{success.message}</p>
            <p>
              Konfirmimi me email dërgohet kur prona ka aktivizuar shërbimin e
              email-eve. Për pagesën dhe kushtet kontakto pronën.
            </p>
            <a href={"mailto:" + data?.property.email} className="btn primary">
              Kontakto pronën
            </a>
          </section>
        ) : (
          <>
            <div className="public-hero">
              <span className="eyebrow">QËNDRIMI YT I ARDHSHËM</span>
              <h1>{data?.property.name || "Gjej hapësirën tënde."}</h1>
              <p>
                <MapPin size={19} />
                {data?.property.city || "Zgjidh datat dhe numrin e personave."}
              </p>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {room ? (
              <section className="card public-form">
                <button className="text-btn" onClick={() => setRoom(null)}>
                  <ArrowLeft size={17} />
                  Kthehu te dhomat
                </button>
                <h2>
                  {room.type} · Dhoma {room.name}
                </h2>
                <p>
                  {from} — {to} · {adults} persona
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError("");
                    try {
                      const f = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      const result = await api(
                        "/api/public/" + encodeURIComponent(slug),
                        {
                          ...f,
                          id: key,
                          checkIn: from,
                          checkOut: to,
                          adults,
                          roomId: room.id,
                        },
                      );
                      setSuccess(result);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Rezervimi dështoi.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="field">
                    <span>Emri dhe mbiemri</span>
                    <input name="guest" required maxLength={150} />
                  </label>
                  <div className="form-grid">
                    <label className="field">
                      <span>Email</span>
                      <input name="email" type="email" required />
                    </label>
                    <label className="field">
                      <span>Telefon</span>
                      <input name="phone" required />
                    </label>
                  </div>
                  <label className="field">
                    <span>Kërkesa të veçanta</span>
                    <textarea name="notes" maxLength={2000} />
                  </label>
                  <p className="public-policy">{data?.property.policy}</p>
                  <label className="checkbox-line">
                    <input type="checkbox" required />
                    Pranoj kushtet e rezervimit të pronës.
                  </label>
                  <div className="quote">
                    <span>Totali i qëndrimit</span>
                    <strong>{money(room.price * data.nights)}</strong>
                  </div>
                  <button className="btn primary wide" disabled={busy}>
                    {busy ? (
                      <Loader2 className="spin" />
                    ) : (
                      <CheckCircle2 size={20} />
                    )}
                    Konfirmo rezervimin
                  </button>
                </form>
              </section>
            ) : (
              <>
                <section className="booking-search card">
                  <label className="field">
                    <span>Mbërritja</span>
                    <input
                      type="date"
                      min={localToday()}
                      value={from}
                      onChange={(e) => {
                        if (e.target.value) {
                          setFrom(e.target.value);
                          if (e.target.value >= to)
                            setTo(shift(e.target.value, 1));
                        }
                      }}
                    />
                  </label>
                  <label className="field">
                    <span>Largimi</span>
                    <input
                      type="date"
                      min={shift(from, 1)}
                      value={to}
                      onChange={(e) => {
                        if (e.target.value) setTo(e.target.value);
                      }}
                    />
                  </label>
                  <label className="field">
                    <span>Persona</span>
                    <select
                      value={adults}
                      onChange={(e) => setAdults(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                </section>
                <section className="public-results">
                  {data?.rooms.map((r: any, i: number) => (
                    <article className="card public-room" key={r.id}>
                      <div className={"room-visual room-visual-" + (i % 4)}>
                        <BedDouble size={65} strokeWidth={1} />
                        <span className="room-number">{r.name}</span>
                      </div>
                      <div>
                        <h2>{r.type}</h2>
                        <p>
                          <Users size={18} />
                          Deri në {r.capacity} persona
                        </p>
                        <strong>
                          {money(r.price * data.nights)}{" "}
                          <small>/ {data.nights} net</small>
                        </strong>
                        <span>{money(r.price)} / natë</span>
                        <button
                          className="btn primary wide"
                          onClick={() => {
                            setRoom(r);
                            setKey(newId());
                          }}
                        >
                          Zgjidh dhomën
                          <ArrowRight size={19} />
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
                {data && !data.rooms.length && (
                  <p className="no-results">
                    Nuk ka dhoma për këto data. Provo një periudhë tjetër.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </main>
      <footer>HotelFlow · Rezervime direkte dhe mikpritje më e thjeshtë</footer>
    </div>
  );
}
