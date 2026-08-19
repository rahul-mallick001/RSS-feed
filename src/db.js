const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "rss.db");

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      url             TEXT NOT NULL UNIQUE,
      title           TEXT,
      site_url        TEXT,
      description     TEXT,
      added_at        INTEGER NOT NULL,
      last_fetched_at INTEGER,
      fetch_error     TEXT,
      etag            TEXT,
      last_modified   TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_id      INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      guid         TEXT NOT NULL,
      title        TEXT,
      link         TEXT,
      author       TEXT,
      pub_date     INTEGER,
      content_html TEXT,
      summary      TEXT,
      image_url    TEXT,
      created_at   INTEGER NOT NULL,
      is_read      INTEGER NOT NULL DEFAULT 0,
      is_starred   INTEGER NOT NULL DEFAULT 0,
      UNIQUE (feed_id, guid)
    );

    CREATE INDEX IF NOT EXISTS idx_items_feed_pub ON items(feed_id, pub_date DESC);
    CREATE INDEX IF NOT EXISTS idx_items_pub ON items(pub_date DESC);
  `);

  const cols = d.prepare("PRAGMA table_info(items)").all().map((c) => c.name);
  if (!cols.includes("image_attempted")) {
    d.exec("ALTER TABLE items ADD COLUMN image_attempted INTEGER NOT NULL DEFAULT 0");
  }
}

module.exports = { getDb, DB_PATH };
