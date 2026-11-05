import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { Database, Row } from "../db/database.ts";
import { AppError, text } from "./domain.ts";
export const roles = [
  "owner",
  "manager",
  "receptionist",
  "housekeeper",
] as const;
export type Role = (typeof roles)[number];
export type Identity = {
  id: string;
  email: string;
  name: string;
  organization_id: string;
  role: Role;
  csrf: string;
  verified: number;
};
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export function email(value: unknown) {
  const e = text(value, "Email", 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    throw new AppError(400, "Email i pavlefshëm.");
  return e;
}
export function passwordHash(value: unknown) {
  const p = text(value, "Fjalëkalimi", 128);
  if (p.length < 12)
    throw new AppError(
      400,
      "Fjalëkalimi duhet të ketë të paktën 12 karaktere.",
    );
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(p, salt, 64).toString("hex")}`;
}
export function passwordMatches(value: unknown, stored: string) {
  if (typeof value !== "string" || value.length > 128) return false;
  const [salt, key] = stored.split(":");
  const actual = scryptSync(value, salt, 64);
  return timingSafeEqual(actual, Buffer.from(key, "hex"));
}
export function issueSession(db: Database, userId: string, org: string) {
  const raw = token(),
    csrf = token();
  db.run(
    "INSERT INTO sessions (token_hash,user_id,organization_id,csrf,expires) VALUES (?,?,?,?,?)",
    hash(raw),
    userId,
    org,
    csrf,
    new Date(Date.now() + 7 * 86400000).toISOString(),
  );
  return { raw, csrf };
}
export function getIdentity(
  db: Database,
  cookie: string | undefined,
): Identity | null {
  const raw = cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("hf_session="))
    ?.slice(11);
  if (!raw) return null;
  const row = db.one(
    "SELECT u.id,u.email,u.name,u.verified,s.organization_id,s.csrf,m.role FROM sessions s JOIN users u ON s.user_id=u.id JOIN memberships m ON m.user_id=u.id AND m.organization_id=s.organization_id WHERE s.token_hash=? AND s.expires>? AND m.active=1",
    hash(raw),
    new Date().toISOString(),
  );
  return (row as Identity) || null;
}
export function requireRole(user: Identity, allowed: Role[]) {
  if (!allowed.includes(user.role))
    throw new AppError(403, "Nuk ke leje për këtë veprim.");
}
export function safeUser(user: Identity) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organization_id,
    csrf: user.csrf,
    verified: !!user.verified,
  };
}
export function createAccount(db: Database, body: Row) {
  const e = email(body.email),
    name = text(body.name, "Emri", 100),
    password = passwordHash(body.password);
  if (db.one("SELECT id FROM users WHERE email=?", e))
    throw new AppError(
      409,
      "Ky email është regjistruar. Provo hyrjen ose rikuperimin.",
    );
  const uid = crypto.randomUUID(),
    org = crypto.randomUUID(),
    now = new Date().toISOString();
  db.transaction(() => {
    db.run(
      "INSERT INTO organizations (id,name,trial_until,created) VALUES (?,?,?,?)",
      org,
      text(body.business || name, "Biznesi"),
      new Date(Date.now() + 14 * 86400000).toISOString(),
      now,
    );
    db.run(
      "INSERT INTO users (id,email,name,password_hash,created) VALUES (?,?,?,?,?)",
      uid,
      e,
      name,
      password,
      now,
    );
    db.run(
      "INSERT INTO memberships (organization_id,user_id,role) VALUES (?,?,'owner')",
      org,
      uid,
    );
  });
  return { uid, org };
}
export function login(db: Database, body: Row) {
  const e = email(body.email),
    u = db.one("SELECT * FROM users WHERE email=?", e);
  const dummy =
    "00000000000000000000000000000000:" + Buffer.alloc(64).toString("hex");
  if (!passwordMatches(body.password, u?.password_hash || dummy) || !u)
    throw new AppError(401, "Email ose fjalëkalim i pasaktë.");
  const m = db.one(
    "SELECT * FROM memberships WHERE user_id=? AND active=1 ORDER BY rowid LIMIT 1",
    u.id,
  );
  if (!m) throw new AppError(403, "Llogaria nuk ka akses aktiv.");
  return { uid: u.id, org: m.organization_id };
}
export function createToken(
  db: Database,
  kind: string,
  e: string,
  org: string,
  uid: string | null,
  role: string | null,
  hours = 24,
) {
  const raw = token();
  db.run(
    "INSERT INTO tokens (token_hash,kind,user_id,organization_id,email,role,expires) VALUES (?,?,?,?,?,?,?)",
    hash(raw),
    kind,
    uid,
    org,
    e,
    role,
    new Date(Date.now() + hours * 3600000).toISOString(),
  );
  return raw;
}
export function consumeToken(db: Database, raw: unknown, kind: string) {
  const row = db.one(
    "SELECT * FROM tokens WHERE token_hash=? AND kind=? AND used=0 AND expires>?",
    hash(text(raw, "Linku", 200)),
    kind,
    new Date().toISOString(),
  );
  if (!row) throw new AppError(400, "Linku ka skaduar ose është përdorur.");
  return row;
}
