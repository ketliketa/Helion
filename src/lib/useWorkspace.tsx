import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  Building2,
  Check,
  Globe,
  Info,
  Loader2,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Empty, Field, Modal } from "../components/ui";
import {
  CurrentUser,
  Reservation,
  Room,
  State,
  active,
  days,
  empty,
  fmt,
  initials,
  localToday,
  money,
  nav,
  newId,
  secondary,
  shift,
  statusNames,
} from "./shared";
export function useWorkspace(user: CurrentUser, previewState?: State) {
  const [data, setData] = useState<State>(previewState || empty),
    [loading, setLoading] = useState(!previewState),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [pid, setPid] = useState(""),
    [page, setPage] = useState(
      user.role === "housekeeper" ? "housekeeping" : "today",
    ),
    [query, setQuery] = useState(""),
    [modal, setModal] = useState<string | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [sidebar, setSidebar] = useState(false),
    [tab, setTab] = useState("arrivals"),
    [filter, setFilter] = useState("all");
  const [calendarSpan, setCalendarSpan] = useState(7);
  const [calendarDate, setCalendarDate] = useState(localToday()),
    [bookingIn, setBookingIn] = useState(localToday()),
    [bookingOut, setBookingOut] = useState(shift(localToday(), 2)),
    [persons, setPersons] = useState(2),
    [bookingRoom, setBookingRoom] = useState("");
  const [setupStep, setSetupStep] = useState(1),
    [setup, setSetup] = useState({
      name: "",
      city: "",
      email: "",
      phone: "",
      count: 6,
      type: "Standard",
      capacity: 2,
      price: 65,
    });
  const [resForm, setResForm] = useState({
    guest: "",
    email: "",
    phone: "",
    checkIn: localToday(),
    checkOut: shift(localToday(), 1),
    adults: 2,
    roomId: "",
    notes: "",
    source: "Front Desk",
  });
  const [roomForm, setRoomForm] = useState({
      name: "",
      type: "Standard",
      capacity: 2,
      price: 65,
      floor: "1",
    }),
    [payAmount, setPayAmount] = useState(""),
    [payMethod, setPayMethod] = useState("cash");
  const [editing, setEditing] = useState(false),
    [editDates, setEditDates] = useState({
      checkIn: "",
      checkOut: "",
      roomId: "",
    }),
    [confirmAction, setConfirmAction] = useState("");
  const inFlight = useRef(false),
    paymentKey = useRef("");
  const submitKey = useRef(""),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = localToday();
  const property =
    data.properties.find((p) => p.id === pid) || data.properties[0];
  const rooms = data.rooms.filter((r) => r.property_id === property?.id),
    reservations = data.reservations.filter(
      (r) => r.property_id === property?.id,
    ),
    audit = data.audit.filter((a) => a.property_id === property?.id);
  const paid = (r: Reservation) =>
    data.payments
      .filter((p) => p.reservation_id === r.id)
      .reduce((a, p) => a + p.amount, 0);
  const roomOf = (r: Reservation) => rooms.find((x) => x.id === r.room_id);
  const occupied = reservations.filter(
    (r) =>
      active(r) &&
      r.check_in <= today &&
      r.check_out > today &&
      r.status !== "checked_out",
  );
  const arrivals = reservations.filter(
      (r) => active(r) && r.check_in === today && r.status === "confirmed",
    ),
    departures = reservations.filter(
      (r) => r.status === "in_house" && r.check_out <= today,
    ),
    dirty = rooms.filter((r) => r.housekeeping !== "clean");
  const sellable = rooms.filter((r) => !r.blocked).length;
  const rate = sellable ? Math.round((occupied.length / sellable) * 100) : 0;
  const chosen = reservations.find((r) => r.id === selected);
  const available = (room: Room, start: string, end: string, exclude = "") =>
    !room.blocked &&
    days(start, end) > 0 &&
    days(start, end) <= 365 &&
    !reservations.some(
      (r) =>
        r.id !== exclude &&
        active(r) &&
        r.room_id === room.id &&
        r.check_in < end &&
        r.check_out > start,
    );
  function notify(s: string) {
    setToast(s);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }
  async function load() {
    const res = await fetch("/api/pms", { cache: "no-store" });
    const d: any = await res.json();
    if (!res.ok) throw new Error(d.error);
    setData(d);
    return d as State;
  }
  useEffect(() => {
    if (previewState) return;
    if (!user) {
      setLoading(false);
      return;
    }
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setModal(null);
        setSelected(null);
        setSidebar(false);
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  async function mutate(
    action: string,
    body: Record<string, unknown>,
    success: string,
  ) {
    if (previewState) {
      setError(
        "Demo vetëm për shikim. Hyr në hapësirën tënde për të ruajtur ndryshime.",
      );
      return null;
    }
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/pms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": user.csrf,
        },
        body: JSON.stringify({ action, ...body }),
      });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      await load();
      if (success) notify(success);
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veprimi dështoi.");
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function navigate(p: string) {
    setPage(p);
    setQuery("");
    setSidebar(false);
    setFilter("all");
    setError("");
  }
  function openReservation(roomId = "", date = today, source = "Front Desk") {
    submitKey.current = newId();
    setResForm({
      guest: "",
      email: "",
      phone: "",
      checkIn: date,
      checkOut: shift(date, 1),
      adults: 2,
      roomId,
      notes: "",
      source,
    });
    setModal("reservation");
    setError("");
  }
  function openDetails(r: Reservation) {
    paymentKey.current = newId();
    setSelected(r.id);
    setPayAmount(String(Math.max(0, r.total - paid(r)) / 100));
    setPayMethod("cash");
    setEditing(false);
    setConfirmAction("");
    setError("");
  }
  async function changeStatus(r: Reservation, status: string) {
    const result = await mutate(
      "status",
      { id: r.id, version: r.version, status },
      "Statusi u përditësua.",
    );
    if (result) setConfirmAction("");
  }
  const title =
    nav.concat(secondary).find((n) => n.id === page)?.label ||
    (page === "settings" ? "Cilësimet" : "Sot");
  const found = reservations.filter((r) =>
    (r.guest + " " + roomOf(r)?.name + " " + r.email + " " + r.id)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const filtered = found.filter((r) => filter === "all" || r.status === filter);
  function exportCSV() {
    const rows = [
      [
        "Kodi",
        "Klienti",
        "Dhoma",
        "Hyrja",
        "Dalja",
        "Statusi",
        "Totali EUR",
        "Paguar EUR",
      ],
      ...filtered.map((r) => [
        r.id,
        r.guest,
        roomOf(r)?.name || "",
        r.check_in,
        r.check_out,
        statusNames[r.status],
        (r.total / 100).toFixed(2),
        (paid(r) / 100).toFixed(2),
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(
              (x) =>
                '"' +
                String(x)
                  .replace(/^[=+@\-]/, "'$&")
                  .replaceAll('"', '""') +
                '"',
            )
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "hotelflow-rezervimet.csv";
    a.click();
    URL.revokeObjectURL(url);
    notify("Eksporti CSV u përgatit.");
  }
  function ReservationTable({
    items,
    compact = false,
  }: {
    items: Reservation[];
    compact?: boolean;
  }) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Klienti</th>
              <th>Dhoma</th>
              <th>{compact ? "Qëndrimi" : "Datat e qëndrimit"}</th>
              <th>Statusi</th>
              <th>Pagesa</th>
              <th aria-label="Veprim" />
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={r.id} onClick={() => openDetails(r)}>
                <td>
                  <div className="guest-cell">
                    <span className={"avatar color-" + (i % 4)}>
                      {initials(r.guest)}
                    </span>
                    <div>
                      <strong>{r.guest}</strong>
                      <small>{r.source}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="room-chip">{roomOf(r)?.name}</span>
                  <small>{roomOf(r)?.type}</small>
                </td>
                <td>
                  <strong className="regular">
                    {fmt(r.check_in)} <span className="muted">→</span>{" "}
                    {fmt(r.check_out)}
                  </strong>
                  <small>
                    {days(r.check_in, r.check_out)} net · {r.adults} persona
                  </small>
                </td>
                <td>
                  <span className={"badge " + r.status}>
                    <i />
                    {statusNames[r.status]}
                  </span>
                </td>
                <td>
                  <strong className="regular">{money(r.total)}</strong>
                  <small className={paid(r) >= r.total ? "teal" : "muted"}>
                    {paid(r) >= r.total
                      ? "Paguar plotësisht"
                      : `${money(r.total - paid(r))} të mbetura`}
                  </small>
                </td>
                <td>
                  <button
                    className="icon-btn"
                    aria-label={"Hap " + r.guest}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetails(r);
                    }}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <Empty
            icon={BedDouble}
            title="Nuk ka rezervime këtu"
            detail="Rezervimet e kësaj liste do të shfaqen këtu."
            action={() => openReservation()}
            label="Krijo rezervim"
          />
        )}
      </div>
    );
  }
  function PageIntro({
    eyebrow,
    heading,
    description,
    children,
  }: {
    eyebrow: string;
    heading: string;
    description: string;
    children?: React.ReactNode;
  }) {
    return (
      <div className="page-intro">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{heading}</h1>
          <p>{description}</p>
        </div>
        {children}
      </div>
    );
  }
  function closeModal() {
    setModal(null);
    setError("");
    setBookingRoom("");
  }
  const formRooms = rooms.filter(
    (r) =>
      r.capacity >= resForm.adults &&
      available(r, resForm.checkIn, resForm.checkOut),
  );
  const formRoom = rooms.find((r) => r.id === resForm.roomId),
    formNights = days(resForm.checkIn, resForm.checkOut);
  function setupModal() {
    return (
      <Modal
        title="Le të njohim pronën tënde"
        subtitle={`Hapi ${setupStep} nga 3 · Mund të ndryshosh gjithçka më vonë`}
        onClose={closeModal}
      >
        <div className="steps">
          {["Prona", "Dhomat", "Përmbledhja"].map((s, i) => (
            <span className={setupStep > i ? "on" : ""} key={s}>
              <b>{i + 1}</b>
              {s}
            </span>
          ))}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (setupStep < 3) {
              setSetupStep(setupStep + 1);
              return;
            }
            const d = await mutate(
              "createProperty",
              { ...setup, price: Math.round(setup.price * 100) },
              "Prona u krijua. Mirë se erdhe!",
            );
            if (d) {
              setPid(d.id);
              closeModal();
              navigate("today");
            }
          }}
        >
          {setupStep === 1 ? (
            <>
              <Field label="Emri i pronës">
                <input
                  required
                  value={setup.name}
                  onChange={(e) => setSetup({ ...setup, name: e.target.value })}
                  placeholder="P.sh. Vila e Liqenit"
                  maxLength={150}
                />
              </Field>
              <Field label="Qyteti dhe shteti">
                <input
                  required
                  value={setup.city}
                  onChange={(e) => setSetup({ ...setup, city: e.target.value })}
                  placeholder="Tiranë, Shqipëri"
                  maxLength={150}
                />
              </Field>
              <div className="form-grid">
                <Field label="Email kontakti">
                  <input
                    type="email"
                    value={setup.email}
                    onChange={(e) =>
                      setSetup({ ...setup, email: e.target.value })
                    }
                  />
                </Field>
                <Field label="Telefoni">
                  <input
                    value={setup.phone}
                    onChange={(e) =>
                      setSetup({ ...setup, phone: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="note">
                <Globe size={17} /> Monedha EUR · Zona kohore Europe/Tirane
              </div>
            </>
          ) : setupStep === 2 ? (
            <>
              <div className="form-grid">
                <Field label="Numri fillestar i dhomave">
                  <input
                    type="number"
                    required
                    min="1"
                    max="50"
                    value={setup.count}
                    onChange={(e) =>
                      setSetup({ ...setup, count: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Tipi fillestar">
                  <select
                    value={setup.type}
                    onChange={(e) =>
                      setSetup({ ...setup, type: e.target.value })
                    }
                  >
                    {[
                      "Standard",
                      "Deluxe",
                      "Suite",
                      "Family",
                      "Apartament",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Persona për dhomë">
                  <input
                    required
                    type="number"
                    min="1"
                    max="20"
                    value={setup.capacity}
                    onChange={(e) =>
                      setSetup({ ...setup, capacity: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Çmimi për natë · EUR">
                  <input
                    required
                    type="number"
                    min="1"
                    max="100000"
                    step="0.01"
                    value={setup.price}
                    onChange={(e) =>
                      setSetup({ ...setup, price: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <div className="note">
                <Info size={17} /> Dhomat fillojnë nga 101. Më pas shton tipe
                dhe çmime të ndryshme.
              </div>
            </>
          ) : (
            <div className="setup-summary">
              <Building2 size={30} />
              <h2>{setup.name}</h2>
              <p>{setup.city}</p>
              <dl>
                <dt>Dhoma</dt>
                <dd>
                  {setup.count} × {setup.type}
                </dd>
                <dt>Kapaciteti</dt>
                <dd>{setup.capacity} persona / dhomë</dd>
                <dt>Çmimi fillestar</dt>
                <dd>{money(setup.price * 100)} / natë</dd>
                <dt>Rezervimet</dt>
                <dd>Të dhënat e tua, pa shembuj</dd>
              </dl>
            </div>
          )}
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            {setupStep > 1 && (
              <button
                type="button"
                className="btn"
                onClick={() => setSetupStep(setupStep - 1)}
              >
                <ArrowLeft size={16} />
                Pas
              </button>
            )}
            <button className="btn primary" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={17} />
              ) : setupStep === 3 ? (
                <Check size={17} />
              ) : (
                <ArrowRight size={17} />
              )}{" "}
              {setupStep === 3 ? "Krijo pronën" : "Vazhdo"}
            </button>
          </div>
        </form>
      </Modal>
    );
  }
  return {
    calendarSpan,
    setCalendarSpan,
    data,
    setData,
    loading,
    setLoading,
    busy,
    setBusy,
    error,
    setError,
    toast,
    setToast,
    pid,
    setPid,
    page,
    setPage,
    query,
    setQuery,
    modal,
    setModal,
    selected,
    setSelected,
    sidebar,
    setSidebar,
    tab,
    setTab,
    filter,
    setFilter,
    calendarDate,
    setCalendarDate,
    bookingIn,
    setBookingIn,
    bookingOut,
    setBookingOut,
    persons,
    setPersons,
    bookingRoom,
    setBookingRoom,
    setupStep,
    setSetupStep,
    setup,
    setSetup,
    resForm,
    setResForm,
    roomForm,
    setRoomForm,
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
    inFlight,
    paymentKey,
    submitKey,
    toastTimer,
    today,
    property,
    rooms,
    reservations,
    audit,
    paid,
    roomOf,
    occupied,
    arrivals,
    departures,
    dirty,
    sellable,
    rate,
    chosen,
    available,
    notify,
    load,
    mutate,
    navigate,
    openReservation,
    openDetails,
    changeStatus,
    title,
    found,
    filtered,
    exportCSV,
    ReservationTable,
    PageIntro,
    closeModal,
    formRooms,
    formRoom,
    formNights,
    setupModal,
    user,
    previewState,
  };
}
export type WorkspaceContext = ReturnType<typeof useWorkspace>;
export type PageProps = { context: WorkspaceContext };
