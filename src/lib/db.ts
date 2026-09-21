import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Database } from "./types";
import { buildSeed } from "./seed";
import { DATA_DIR, DB_FILE, UPLOADS_DIR } from "./paths";

export { DATA_DIR, UPLOADS_DIR };

/** Cache no escopo do modulo: o dev server recarrega modulos, então o cache
 *  vive no globalThis para não perder escritas entre hot reloads. */
const globalStore = globalThis as unknown as { __lbdb?: Database };

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function getDb(): Database {
  if (globalStore.__lbdb) return globalStore.__lbdb;
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    const seeded = buildSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), "utf8");
    globalStore.__lbdb = seeded;
    return seeded;
  }
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const parsed = JSON.parse(raw) as Database;
  globalStore.__lbdb = parsed;
  return parsed;
}

export function saveDb(db: Database) {
  ensureDirs();
  globalStore.__lbdb = db;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

/** Le, aplica a mutação e persiste. */
export function mutate<T>(fn: (db: Database) => T): T {
  const db = getDb();
  const result = fn(db);
  saveDb(db);
  return result;
}

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(`lb360::${password}`).digest("hex");
}

export function saveUpload(fileName: string, buffer: Buffer) {
  ensureDirs();
  fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buffer);
}

export function readUpload(fileName: string): Buffer | null {
  const safe = path.basename(fileName);
  const target = path.join(UPLOADS_DIR, safe);
  if (!fs.existsSync(target)) return null;
  return fs.readFileSync(target);
}
