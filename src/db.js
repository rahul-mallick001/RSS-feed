const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function getDataDir() {
  return process.env.RSS_DATA_DIR || path.join(__dirname, "..", "data");
}

function getDbPath() {
  return path.join(getDataDir(), "rss.db");
}

let db;

function getDb() {
  if (!db) {
    const dataDir = getDataDir();
    fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(path.join(dataDir, "rss.db"));
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

  backfillSummaries(d);
}

function backfillSummaries(d) {
  const rows = d.prepare(`
    SELECT id, content_html FROM items
    WHERE (summary IS NULL OR summary = '') AND content_html IS NOT NULL AND content_html != ''
  `).all();
  if (!rows.length) return;
  const upd = d.prepare("UPDATE items SET summary = ? WHERE id = ?");
  const tx = d.transaction((list) => {
    for (const r of list) {
      const text = String(r.content_html)
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000);
      if (text) upd.run(text, r.id);
    }
  });
  tx(rows);
}

module.exports = { getDb, getDbPath, getDataDir };
