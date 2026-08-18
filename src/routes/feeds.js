const express = require("express");
const { getDb } = require("../db");
const { validateFeedUrl } = require("../rss");
const { syncFeed } = require("../sync");

const router = express.Router();

router.get("/", (req, res) => {
  const feeds = getDb().prepare(`
    SELECT f.*,
      (SELECT COUNT(*) FROM items i WHERE i.feed_id = f.id AND i.is_read = 0) AS unread
    FROM feeds f ORDER BY COALESCE(f.title, f.url) COLLATE NOCASE
  `).all();
  res.json(feeds);
});

router.post("/", async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url required" });
  }

  let validated;
  try {
    validated = await validateFeedUrl(url.trim());
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM feeds WHERE url = ?").get(validated);
  if (existing) {
    await syncFeed(db.prepare("SELECT * FROM feeds WHERE id = ?").get(existing.id));
    return res.json(db.prepare("SELECT * FROM feeds WHERE id = ?").get(existing.id));
  }

  const info = db.prepare("INSERT INTO feeds (url, added_at) VALUES (?, ?)").run(validated, Date.now());
  const row = db.prepare("SELECT * FROM feeds WHERE id = ?").get(info.lastInsertRowid);
  const result = await syncFeed(row);
  if (!result.ok) {
    db.prepare("DELETE FROM feeds WHERE id = ?").run(row.id);
    return res.status(400).json({ error: `Could not fetch feed: ${result.error}` });
  }
  res.status(201).json(db.prepare("SELECT * FROM feeds WHERE id = ?").get(row.id));
});

router.post("/:id/refresh", async (req, res) => {
  const feed = getDb().prepare("SELECT * FROM feeds WHERE id = ?").get(req.params.id);
  if (!feed) return res.status(404).json({ error: "feed not found" });
  const result = await syncFeed(feed);
  res.json(result);
});

router.delete("/:id", (req, res) => {
  getDb().prepare("DELETE FROM feeds WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
