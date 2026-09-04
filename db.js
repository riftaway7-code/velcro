import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.VERCEL ? "/tmp" : join(__dirname, "data");
if (!process.env.VERCEL) mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, "velcro.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    favorites TEXT NOT NULL DEFAULT '[]',
    recents TEXT NOT NULL DEFAULT '[]',
    settings TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS plays (
    id TEXT NOT NULL,
    time INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_plays_time ON plays(time);
`);

export default db;
