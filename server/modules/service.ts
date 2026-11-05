import type { Database } from "../db/database.ts";
import { SimulatorAdapter, type Availability } from "./channels.ts";
import { AppError, text, integer, range, today, nextStatus } from "./domain.ts";
type Row = Record<string, any>;
export async function service(
  db: Database,
  owner: string,
  action: string,
  b: Row = {},
  actor = owner,
) {
  const now = new Date().toISOString(),
    id = () => crypto.randomUUID();
  const q = (sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
  const log = (p: string, a: string, d: string) =>
    q(
      "INSERT INTO audit (id,property_id,actor,action,detail,created) VALUES (?,?,?,?,?,?)",
      id(),
      p,
      actor,
      a,
      d,
      now,
    );
  async function property(pid: unknown) {
    text(pid, "Prona", 80);
    const r = await q(
      "SELECT * FROM properties WHERE id=? AND owner=?",
      pid,
      owner,
    ).first<Row>();
    if (!r) throw new AppError(404, "Prona nuk u gjet.");
    return r;
  }
  async function reservation(rid: unknown) {
    text(rid, "Rezervimi", 80);
    const r = await q(
      "SELECT r.*,p.timezone FROM reservations r JOIN properties p ON r.property_id=p.id WHERE r.id=? AND p.owner=?",
      rid,
      owner,
    ).first<Row>();
    if (!r) throw new AppError(404, "Rezervimi nuk u gjet.");
    return r;
  }
  if (action === "state") {
    const [p, r, v, m, a, j] = await Promise.all([
      q("SELECT * FROM properties WHERE owner=? ORDER BY created", owner).all(),
      q(
        "SELECT r.* FROM rooms r JOIN properties p ON r.property_id=p.id WHERE p.owner=? ORDER BY r.name",
        owner,
      ).all(),
      q(
        "SELECT r.* FROM reservations r JOIN properties p ON r.property_id=p.id WHERE p.owner=? ORDER BY r.created DESC",
        owner,
      ).all(),
      q(
        "SELECT m.* FROM payments m JOIN reservations r ON m.reservation_id=r.id JOIN properties p ON r.property_id=p.id WHERE p.owner=?",
        owner,
      ).all(),
      q(
        "SELECT a.* FROM audit a JOIN properties p ON a.property_id=p.id WHERE p.owner=? ORDER BY a.created DESC LIMIT 100",
        owner,
      ).all(),
      q(
        "SELECT j.* FROM channel_jobs j JOIN properties p ON j.property_id=p.id WHERE p.owner=? ORDER BY j.created DESC LIMIT 20",
        owner,
      ).all(),
    ]);
    return {
      properties: p.results,
      rooms: r.results,
      reservations: v.results,
      payments: m.results,
      audit: a.results,
      channelJobs: j.results,
    };
  }
  if (action === "createProperty" || action === "demo") {
    const pid = id(),
      demo = action === "demo";
    if (demo) {
      const existing = await q(
        "SELECT id FROM properties WHERE owner=? AND demo=1",
        owner,
      ).first<Row>();
      if (existing) return { id: existing.id };
    }
    const name = demo ? "Villa Lumière" : text(b.name, "Emri"),
      city = demo ? "Tiranë, Shqipëri" : text(b.city, "Qyteti");
    const email = demo
        ? "hello@villalumiere.example"
        : text(b.email || "", "Email", 150, false),
      phone = demo
        ? "+355 00 000 0000"
        : text(b.phone || "", "Telefoni", 50, false);
    const stmts = [
      q(
        "INSERT INTO properties (id,owner,name,city,email,phone,timezone,currency,demo,created) VALUES (?,?,?,?,?,?,?,?,?,?)",
        pid,
        owner,
        name,
        city,
        email,
        phone,
        "Europe/Tirane",
        "EUR",
        demo ? 1 : 0,
        now,
      ),
    ];
    const defs = demo
      ? [
          ["101", "Standard", 2, 6500],
          ["102", "Standard", 2, 6500],
          ["103", "Deluxe", 2, 9000],
          ["104", "Deluxe", 2, 9000],
          ["201", "Suite", 3, 12500],
          ["202", "Suite", 3, 12500],
          ["203", "Family", 4, 14500],
          ["204", "Family", 4, 14500],
        ]
      : Array.from(
          { length: integer(b.count, 1, 50, "Numri i dhomave") },
          (_, i) => [
            String(101 + i),
            text(b.type || "Standard", "Tipi"),
            integer(b.capacity || 2, 1, 20, "Kapaciteti"),
            integer(b.price, 100, 10000000, "Çmimi"),
          ],
        );
    const roomIds = defs.map(() => id());
    defs.forEach((d, i) =>
      stmts.push(
        q(
          "INSERT INTO rooms (id,property_id,name,type,capacity,price,floor,housekeeping,blocked) VALUES (?,?,?,?,?,?,?,?,0)",
          roomIds[i],
          pid,
          ...d,
          String(i < 4 ? 1 : 2),
          demo && i === 3 ? "dirty" : "clean",
        ),
      ),
    );
    if (demo) {
      const base = today(),
        shift = (n: number) =>
          new Date(Date.parse(base) + n * 86400000).toISOString().slice(0, 10);
      const guests = [
        ["Elena Rossi", 0, 3, 0, "confirmed", "Booking.com · shembull"],
        ["James Wilson", -2, 0, 1, "in_house", "Direkt"],
        ["Anna Müller", -1, 2, 2, "in_house", "Direkt"],
        ["Arben Hoxha", 0, 2, 4, "confirmed", "Front Desk"],
        ["Sofia Laurent", 2, 5, 5, "confirmed", "Booking Engine"],
        ["Luca Bianchi", -3, 1, 6, "in_house", "Expedia · shembull"],
        ["Emma Taylor", 4, 7, 0, "confirmed", "Direkt"],
      ];
      guests.forEach((g, i) => {
        const rid = id(),
          ri = Number(g[3]),
          total = (Number(g[2]) - Number(g[1])) * Number(defs[ri][3]);
        stmts.push(
          q(
            "INSERT INTO reservations (id,property_id,room_id,guest,email,phone,check_in,check_out,adults,total,nightly,status,source,notes,version,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)",
            rid,
            pid,
            roomIds[ri],
            g[0],
            `guest${i}@example.com`,
            "",
            shift(Number(g[1])),
            shift(Number(g[2])),
            2,
            total,
            defs[ri][3],
            g[4],
            g[5],
            "Të dhëna shembull, jo rezervim real.",
            now,
          ),
        );
        if (i < 4)
          stmts.push(
            q(
              "INSERT INTO payments (id,reservation_id,amount,method,created) VALUES (?,?,?,?,?)",
              id(),
              rid,
              Math.floor(total / 2),
              "cash",
              now,
            ),
          );
      });
    }
    stmts.push(
      log(pid, "Prona u krijua", demo ? "Hapësirë me të dhëna shembull" : name),
    );
    await db.batch(stmts);
    return { id: pid };
  }

  if (action === "simulateChannel") {
    const p = await property(b.propertyId),
      key = text(b.id, "Identifikuesi", 80);
    if (
      await q(
        "SELECT id FROM channel_jobs WHERE id=? AND property_id=?",
        key,
        p.id,
      ).first()
    )
      return { ok: true };
    const rs = (
      await q("SELECT * FROM rooms WHERE property_id=?", p.id).all<Row>()
    ).results;
    const bookings = (
      await q(
        "SELECT * FROM reservations WHERE property_id=? AND status NOT IN ('cancelled','no_show')",
        p.id,
      ).all<Row>()
    ).results;
    const dates = Array.from({ length: 14 }, (_, i) =>
      new Date(Date.parse(today(p.timezone)) + i * 86400000)
        .toISOString()
        .slice(0, 10),
    );
    const rows: Availability[] = rs.flatMap((r) =>
      dates.map((d) => ({
        roomId: r.id,
        date: d,
        available:
          r.blocked ||
          bookings.some(
            (v) => v.room_id === r.id && v.check_in <= d && v.check_out > d,
          )
            ? 0
            : 1,
        price: r.price,
        currency: p.currency,
      })),
    );
    const adapter = new SimulatorAdapter(),
      result = await adapter.pushAvailability(rows, key);
    await db.batch([
      q(
        "INSERT INTO channel_jobs (id,property_id,channel,status,attempts,payload,result,created) VALUES (?,?,?, ?,1,?,?,?)",
        key,
        p.id,
        "simulator",
        "simulated",
        JSON.stringify(rows),
        JSON.stringify(result),
        now,
      ),
      log(
        p.id,
        "Test i Channel Manager",
        `${result.accepted} vlera inventari u validuan lokalisht; pa dërgim të jashtëm.`,
      ),
    ]);
    return result;
  }
  if (action === "saveProperty") {
    await property(b.propertyId);
    await db.batch([
      q(
        "UPDATE properties SET name=?,city=?,email=?,phone=? WHERE id=?",
        text(b.name, "Emri"),
        text(b.city, "Qyteti"),
        text(b.email || "", "Email", 150, false),
        text(b.phone || "", "Telefoni", 50, false),
        b.propertyId,
      ),
      log(b.propertyId, "Cilësimet u ndryshuan", b.name),
    ]);
    return { ok: true };
  }
  if (action === "createRoom") {
    await property(b.propertyId);
    const rid = id();
    await db.batch([
      q(
        "INSERT INTO rooms (id,property_id,name,type,capacity,price,floor,housekeeping,blocked) VALUES (?,?,?,?,?,?,?,'clean',0)",
        rid,
        b.propertyId,
        text(b.name, "Dhoma", 30),
        text(b.type, "Tipi", 60),
        integer(b.capacity, 1, 20, "Kapaciteti"),
        integer(b.price, 100, 10000000, "Çmimi"),
        text(b.floor || "1", "Kati", 20),
      ),
      log(b.propertyId, "Dhoma u shtua", b.name),
    ]);
    return { id: rid };
  }
  if (action === "saveRoom") {
    await property(b.propertyId);
    const room = await q(
      "SELECT * FROM rooms WHERE id=? AND property_id=?",
      b.roomId,
      b.propertyId,
    ).first<Row>();
    if (!room) throw new AppError(404, "Dhoma nuk u gjet.");
    if (!["clean", "dirty", "cleaning"].includes(b.housekeeping))
      throw new AppError(400, "Gjendja nuk është e vlefshme.");
    const blocked = b.blocked ? 1 : 0;
    if (blocked) {
      const active = await q(
        "SELECT id FROM reservations WHERE room_id=? AND status NOT IN ('cancelled','no_show','checked_out') AND check_out>? LIMIT 1",
        room.id,
        today(),
      ).first();
      if (active)
        throw new AppError(
          409,
          "Zhvendos ose anulo rezervimet aktive para bllokimit.",
        );
    }
    await db.batch([
      q(
        "UPDATE rooms SET housekeeping=?,blocked=?,price=? WHERE id=?",
        b.housekeeping,
        blocked,
        integer(b.price, 100, 10000000, "Çmimi"),
        room.id,
      ),
      log(
        b.propertyId,
        "Dhoma u përditësua",
        `${room.name} · ${b.housekeeping}`,
      ),
    ]);
    return { ok: true };
  }
  if (action === "createReservation") {
    const prop = await property(b.propertyId);
    const dates = range(b.checkIn, b.checkOut);
    if (dates.a < today(prop.timezone))
      throw new AppError(
        400,
        "Rezervimi i ri nuk mund të fillojë në të kaluarën.",
      );
    const room = await q(
      "SELECT * FROM rooms WHERE id=? AND property_id=?",
      b.roomId,
      b.propertyId,
    ).first<Row>();
    if (!room || room.blocked)
      throw new AppError(409, "Dhoma nuk është në shitje.");
    const adults = integer(b.adults, 1, room.capacity, "Numri i personave"),
      rid = text(b.id, "Identifikuesi", 80),
      guest = text(b.guest, "Emri i klientit");
    const existing = await q(
      "SELECT id FROM reservations WHERE id=? AND property_id=?",
      rid,
      b.propertyId,
    ).first();
    if (existing) return { id: rid };
    await db.batch([
      q(
        "INSERT INTO reservations (id,property_id,room_id,guest,email,phone,check_in,check_out,adults,total,nightly,status,source,notes,version,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,'confirmed',?,?,1,?)",
        rid,
        b.propertyId,
        room.id,
        guest,
        text(b.email || "", "Email", 150, false),
        text(b.phone || "", "Telefoni", 50, false),
        dates.a,
        dates.b,
        adults,
        room.price * dates.n,
        room.price,
        b.source === "Booking Engine" ? "Booking Engine" : "Front Desk",
        text(b.notes || "", "Shënimet", 2000, false),
        now,
      ),
      log(b.propertyId, "Rezervim i ri", `${guest} · ${room.name}`),
    ]);
    return { id: rid };
  }
  if (action === "status") {
    const r = await reservation(b.id),
      room = await q("SELECT * FROM rooms WHERE id=?", r.room_id).first<Row>();
    if (r.version !== b.version)
      throw new AppError(409, "Rezervimi ka ndryshuar. Rifresko të dhënat.");
    nextStatus(
      r.status,
      b.status,
      r.check_in,
      r.check_out,
      today(r.timezone),
      room!.housekeeping,
    );
    const stmts = [
      q(
        "UPDATE reservations SET status=?,version=? WHERE id=?",
        b.status,
        b.version + 1,
        r.id,
      ),
      log(r.property_id, "Statusi i rezervimit", `${r.guest} · ${b.status}`),
    ];
    if (b.status === "checked_out")
      stmts.push(
        q("UPDATE rooms SET housekeeping='dirty' WHERE id=?", r.room_id),
      );
    await db.batch(stmts);
    return { ok: true };
  }
  if (action === "changeDates") {
    const r = await reservation(b.id);
    if (r.status !== "confirmed")
      throw new AppError(
        409,
        "Vetëm rezervimet e konfirmuara mund të zhvendosen.",
      );
    if (r.version !== b.version)
      throw new AppError(409, "Rezervimi ka ndryshuar. Rifresko.");
    const { a, b: end, n } = range(b.checkIn, b.checkOut);
    if (a < today(r.timezone))
      throw new AppError(400, "Zgjidh datë nga sot e tutje.");
    const room = await q(
      "SELECT * FROM rooms WHERE id=? AND property_id=?",
      b.roomId,
      r.property_id,
    ).first<Row>();
    if (!room || room.blocked || room.capacity < r.adults)
      throw new AppError(409, "Dhoma nuk është e përshtatshme.");
    const paid = await q(
      "SELECT COALESCE(SUM(amount),0) AS value FROM payments WHERE reservation_id=?",
      r.id,
    ).first<Row>();
    const nightly = r.room_id === room.id ? r.nightly : room.price;
    if (paid!.value > n * nightly)
      throw new AppError(
        409,
        "Pagesat tejkalojnë totalin e ri; kërkohet pajtim financiar para ndryshimit.",
      );
    await db.batch([
      q(
        "UPDATE reservations SET room_id=?,check_in=?,check_out=?,nightly=?,total=?,version=? WHERE id=?",
        room.id,
        a,
        end,
        nightly,
        n * nightly,
        b.version + 1,
        r.id,
      ),
      log(r.property_id, "Rezervimi u ndryshua", r.guest),
    ]);
    return { ok: true };
  }
  if (action === "payment") {
    const r = await reservation(b.reservationId);
    if (["cancelled", "no_show"].includes(r.status))
      throw new AppError(409, "Nuk mund të shtosh pagesë në këtë status.");
    if (!["cash", "card", "bank"].includes(b.method))
      throw new AppError(400, "Mënyra e pagesës nuk është e vlefshme.");
    const amount = integer(b.amount, 1, 100000000, "Shuma"),
      pid = text(b.id, "Identifikuesi", 80);
    if (
      await q(
        "SELECT id FROM payments WHERE id=? AND reservation_id=?",
        pid,
        r.id,
      ).first()
    )
      return { ok: true };
    await db.batch([
      q(
        "INSERT INTO payments (id,reservation_id,amount,method,created) VALUES (?,?,?,?,?)",
        pid,
        r.id,
        amount,
        b.method,
        now,
      ),
      log(
        r.property_id,
        "Pagesë e regjistruar",
        `${r.guest} · ${(amount / 100).toFixed(2)} EUR`,
      ),
    ]);
    return { ok: true };
  }
  throw new AppError(400, "Veprim i panjohur.");
}
