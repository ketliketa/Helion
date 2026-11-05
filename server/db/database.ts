import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
export type Row = Record<string, any>;
export class Database {
  sqlite: DatabaseSync;
  constructor(
    filename = resolve(process.env.DATA_DIR || "./data", "hotelflow.sqlite"),
  ) {
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true });
    this.sqlite = new DatabaseSync(filename);
    this.sqlite.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    this.sqlite.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied TEXT NOT NULL)",
    );
    const dir = dirname(fileURLToPath(import.meta.url));
    for (const name of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      if (this.one("SELECT name FROM schema_migrations WHERE name=?", name))
        continue;
      this.transaction(() => {
        this.sqlite.exec(readFileSync(resolve(dir, name), "utf8"));
        this.run(
          "INSERT INTO schema_migrations (name,applied) VALUES (?,?)",
          name,
          new Date().toISOString(),
        );
      });
    }
  }
  one(sql: string, ...params: any[]): Row | undefined {
    return this.sqlite.prepare(sql).get(...params) as Row | undefined;
  }
  all(sql: string, ...params: any[]): Row[] {
    return this.sqlite.prepare(sql).all(...params) as Row[];
  }
  run(sql: string, ...params: any[]) {
    return this.sqlite.prepare(sql).run(...params);
  }
  transaction<T>(fn: () => T): T {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.sqlite.exec("COMMIT");
      return value;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  prepare(sql: string): Statement {
    return new Statement(this, sql, []);
  }
  async batch(statements: Statement[]) {
    return this.transaction(() =>
      statements.map((s) => this.run(s.sql, ...s.params)),
    );
  }
  close() {
    this.sqlite.close();
  }
}
class Statement {
  db: Database;
  sql: string;
  params: any[];
  constructor(db: Database, sql: string, params: any[]) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params: any[]) {
    return new Statement(this.db, this.sql, params);
  }
  async first<T = Row>(): Promise<T | null> {
    return (this.db.one(this.sql, ...this.params) || null) as T | null;
  }
  async all<T = Row>(): Promise<{ results: T[] }> {
    return { results: this.db.all(this.sql, ...this.params) as T[] };
  }
}
