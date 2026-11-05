import type { Database, Row } from "../db/database.ts";
import type { Identity } from "./auth.ts";
import { AppError, range, today } from "./domain.ts";
export type Report = {
  title: string;
  from: string;
  to: string;
  description: string;
  columns: string[];
  rows: (string | number)[][];
  summary: { label: string; value: string }[];
  series: { date: string; occupancy: number; revenue: number }[];
};
export const reportCatalog = [
  { id: "occupancy", name: "Zënia dhe parashikimi", group: "performance" },
  { id: "revenue", name: "Vlera e netëve dhe ADR", group: "finance" },
  { id: "payments", name: "Arkëtimet sipas mënyrës", group: "finance" },
  { id: "balances", name: "Detyrimet e klientëve", group: "operations" },
  { id: "arrivals", name: "Lista e mbërritjeve", group: "operations" },
  { id: "departures", name: "Lista e largimeve", group: "operations" },
  { id: "housekeeping", name: "Pastrimi dhe detyrat", group: "operations" },
  { id: "sources", name: "Burimet e rezervimeve", group: "performance" },
  { id: "cancellations", name: "Anulime dhe no show", group: "performance" },
  { id: "guests", name: "Historiku i klientëve", group: "operations" },
  { id: "activity", name: "Historiku i veprimeve", group: "management" },
  { id: "staff", name: "Detyrat e stafit", group: "management" },
];
export const money = (v: number) => `${(v / 100).toFixed(2)} EUR`;
export function allowedReports(role: string) {
  if (role === "housekeeper") return ["housekeeping"];
  if (role === "receptionist")
    return ["arrivals", "departures", "balances", "guests", "housekeeping"];
  return reportCatalog.map((r) => r.id);
}
export function makeReport(
  db: Database,
  user: Identity,
  propertyId: string,
  type: string,
  start: string,
  end: string,
): Report {
  if (!allowedReports(user.role).includes(type))
    throw new AppError(403, "Nuk ke leje për këtë raport.");
  const prop = db.one(
    "SELECT * FROM properties WHERE id=? AND owner=?",
    propertyId,
    user.organization_id,
  );
  if (!prop) throw new AppError(404, "Prona nuk u gjet.");
  const { a, b, n } = range(
    start,
    new Date(Date.parse(end) + 86400000).toISOString().slice(0, 10),
  );
  const dates = Array.from({ length: n }, (_, i) =>
    new Date(Date.parse(a) + i * 86400000).toISOString().slice(0, 10),
  );
  const rooms = db.all("SELECT * FROM rooms WHERE property_id=?", propertyId);
  const reservations = db.all(
    "SELECT r.*,rm.name AS room_name,rm.type AS room_type FROM reservations r JOIN rooms rm ON r.room_id=rm.id WHERE r.property_id=?",
    propertyId,
  );
  const payments = db.all(
    "SELECT p.*,r.guest,r.room_id FROM payments p JOIN reservations r ON p.reservation_id=r.id WHERE r.property_id=?",
    propertyId,
  );
  const paid = (id: string) =>
    payments
      .filter((p) => p.reservation_id === id)
      .reduce((sum, p) => sum + p.amount, 0);
  const active = reservations.filter(
    (r) => !["cancelled", "no_show"].includes(r.status),
  );
  const series = dates.map((d) => {
    const sold = active.filter((r) => r.check_in <= d && r.check_out > d);
    return {
      date: d,
      occupancy: rooms.length
        ? Math.round((sold.length / rooms.length) * 100)
        : 0,
      revenue: sold.reduce((s, r) => s + r.nightly, 0),
    };
  });
  const nights = series.reduce(
    (s, p) =>
      s +
      active.filter((r) => r.check_in <= p.date && r.check_out > p.date).length,
    0,
  );
  const revenue = series.reduce((s, p) => s + p.revenue, 0);
  let columns: string[] = [],
    rows: (string | number)[][] = [],
    description = "",
    summary: { label: string; value: string }[] = [];
  const periodReservations = reservations.filter(
    (r) => r.check_in < b && r.check_out > a,
  );
  switch (type) {
    case "occupancy":
      columns = ["Data", "Net të shitura", "Dhomat aktuale", "Zënia"];
      rows = series.map((p) => [
        p.date,
        active.filter((r) => r.check_in <= p.date && r.check_out > p.date)
          .length,
        rooms.length,
        p.occupancy + "%",
      ]);
      description =
        "Zënia llogaritet me inventarin aktual të dhomave. Kapaciteti historik dhe bllokimet e kaluara nuk rindërtohen.";
      summary = [
        { label: "Net të shitura", value: String(nights) },
        {
          label: "Zënia mesatare",
          value:
            (rooms.length ? (nights / (rooms.length * n)) * 100 : 0).toFixed(
              1,
            ) + "%",
        },
      ];
      break;
    case "revenue":
      columns = ["Data", "Vlera e netëve EUR", "ADR EUR", "RevPAR EUR"];
      rows = series.map((p) => {
        const count = active.filter(
          (r) => r.check_in <= p.date && r.check_out > p.date,
        ).length;
        return [
          p.date,
          (p.revenue / 100).toFixed(2),
          count ? (p.revenue / count / 100).toFixed(2) : "0.00",
          rooms.length ? (p.revenue / rooms.length / 100).toFixed(2) : "0.00",
        ];
      });
      description =
        "Vlera e netëve bazohet në çmimin e ruajtur të qëndrimit. Për data të ardhshme është parashikim, jo arkëtim ose e ardhur fiskale.";
      summary = [
        { label: "Vlera e netëve", value: money(revenue) },
        { label: "ADR", value: money(nights ? revenue / nights : 0) },
        {
          label: "RevPAR",
          value: money(rooms.length ? revenue / (rooms.length * n) : 0),
        },
      ];
      break;
    case "payments": {
      columns = ["Klienti", "Data", "Mënyra", "Shuma EUR"];
      const ps = payments.filter((p) => {
        const d = new Intl.DateTimeFormat("en-CA", {
          timeZone: prop.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(p.created));
        return d >= a && d < b;
      });
      rows = ps.map((p) => [
        p.guest,
        p.created.slice(0, 16).replace("T", " "),
        p.method,
        (p.amount / 100).toFixed(2),
      ]);
      description =
        "Arkëtimet regjistrohen sipas kohës lokale të pronës. Përfshin pagesat manuale dhe pagesat online të konfirmuara me webhook.";
      summary = [
        {
          label: "Arkëtuar",
          value: money(ps.reduce((s, p) => s + p.amount, 0)),
        },
        { label: "Transaksione", value: String(ps.length) },
      ];
      break;
    }
    case "balances":
      columns = [
        "Klienti",
        "Dhoma",
        "Dalja",
        "Totali EUR",
        "Paguar EUR",
        "Bilanci EUR",
      ];
      rows = periodReservations
        .filter(
          (r) =>
            !["cancelled", "no_show"].includes(r.status) &&
            r.total > paid(r.id),
        )
        .map((r) => [
          r.guest,
          r.room_name,
          r.check_out,
          (r.total / 100).toFixed(2),
          (paid(r.id) / 100).toFixed(2),
          ((r.total - paid(r.id)) / 100).toFixed(2),
        ]);
      description =
        "Bilancet aktuale të qëndrimeve që prekin periudhën e zgjedhur.";
      summary = [
        {
          label: "Detyrime",
          value: money(rows.reduce((s, r) => s + Number(r[5]) * 100, 0)),
        },
      ];
      break;
    case "arrivals":
    case "departures": {
      columns = ["Klienti", "Dhoma", "Data", "Persona", "Statusi", "Telefon"];
      const field = type === "arrivals" ? "check_in" : "check_out";
      rows = reservations
        .filter(
          (r) =>
            r[field] >= a &&
            r[field] < b &&
            !["cancelled", "no_show"].includes(r.status),
        )
        .map((r) => [
          r.guest,
          r.room_name,
          r[field],
          r.adults,
          r.status,
          r.phone,
        ]);
      description =
        "Lista operative për datat e zgjedhura. Statusi pasqyron gjendjen aktuale të rezervimit.";
      summary = [
        {
          label: type === "arrivals" ? "Mbërritje" : "Largime",
          value: String(rows.length),
        },
      ];
      break;
    }
    case "housekeeping":
    case "staff": {
      columns = ["Dhoma", "Kati", "Gjendja", "Përgjegjësi", "Shënime"];
      rows = db
        .all(
          "SELECT r.*,u.name AS assigned_name,a.note FROM rooms r LEFT JOIN room_assignments a ON a.room_id=r.id LEFT JOIN users u ON a.user_id=u.id WHERE r.property_id=? ORDER BY r.name",
          propertyId,
        )
        .map((r) => [
          r.name,
          r.floor,
          r.housekeeping,
          r.assigned_name || "Pa caktuar",
          r.note || "",
        ]);
      description =
        "Gjendja dhe detyrat aktuale të dhomave, jo fotografi historike e periudhës.";
      summary = [
        {
          label: "Për pastrim",
          value: String(rooms.filter((r) => r.housekeeping === "dirty").length),
        },
        {
          label: "Në proces",
          value: String(
            rooms.filter((r) => r.housekeeping === "cleaning").length,
          ),
        },
      ];
      break;
    }
    case "sources":
      columns = ["Burimi", "Rezervime", "Vlera EUR"];
      rows = [...new Set(periodReservations.map((r) => r.source))].map((s) => {
        const rs = periodReservations.filter(
          (r) => r.source === s && !["cancelled", "no_show"].includes(r.status),
        );
        return [
          s,
          rs.length,
          (rs.reduce((v, r) => v + r.total, 0) / 100).toFixed(2),
        ];
      });
      description =
        "Totali i plotë i rezervimeve që prekin periudhën, grupuar sipas burimit; nuk është vlera e vetëm netëve të periudhës.";
      break;
    case "cancellations":
      columns = ["Klienti", "Datat", "Statusi", "Pagesat e ruajtura EUR"];
      rows = periodReservations
        .filter((r) => ["cancelled", "no_show"].includes(r.status))
        .map((r) => [
          r.guest,
          `${r.check_in} / ${r.check_out}`,
          r.status,
          (paid(r.id) / 100).toFixed(2),
        ]);
      description =
        "Anulimet sipas datave të qëndrimit. Pagesat e ruajtura mund të kërkojnë pajtim ose rimbursim manual.";
      summary = [{ label: "Anulime dhe no show", value: String(rows.length) }];
      break;
    case "guests":
      columns = [
        "Klienti",
        "Email",
        "Telefon",
        "Dhoma",
        "Mbërritja",
        "Largimi",
      ];
      rows = periodReservations.map((r) => [
        r.guest,
        r.email,
        r.phone,
        r.room_name,
        r.check_in,
        r.check_out,
      ]);
      description =
        "Kontaktet e klientëve me qëndrime që prekin periudhën. Përdorini vetëm për qëllimet e autorizuara të pronës.";
      break;
    case "activity":
      columns = ["Koha UTC", "Veprimi", "Detajet", "Punonjësi"];
      rows = db
        .all(
          "SELECT a.*,u.name AS actor_name FROM audit a LEFT JOIN users u ON u.id=a.actor WHERE a.property_id=? AND substr(a.created,1,10)>=? AND substr(a.created,1,10)<=? ORDER BY a.created DESC LIMIT 1000",
          propertyId,
          a,
          end,
        )
        .map((r) => [
          r.created.slice(0, 16).replace("T", " "),
          r.action,
          r.detail,
          r.actor_name || "Sistemi",
        ]);
      description =
        "Deri në 1000 veprimet më të fundit për periudhën, sipas kohës UTC.";
      break;
    default:
      throw new AppError(400, "Raporti nuk ekziston.");
  }
  return {
    title: reportCatalog.find((r) => r.id === type)!.name,
    from: a,
    to: end,
    columns,
    rows,
    description,
    summary,
    series,
  };
}
