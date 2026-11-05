import { DatabaseSync, backup } from "node:sqlite";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
const dir = resolve(process.env.DATA_DIR || "data"),
  folder = resolve(dir, "backups");
mkdirSync(folder, { recursive: true });
const db = new DatabaseSync(resolve(dir, "hotelflow.sqlite"));
const path = resolve(
  folder,
  `hotelflow-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
);
await backup(db, path);
db.close();
console.log(`Kopja rezervë u ruajt: ${path}`);
