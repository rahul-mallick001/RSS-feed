const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  const db = getDb();
  const feedId = req.query.feed ? Number(req.query.feed) : null;
  const onlyUnread = req.query.unread === "1";
  const limit = Math.min(200, Number(req.query.limit) || 100);

  let where = [];
  let params = {};
  if (feedId) {
    where.push("i.feed_id = @feedId");
    params.feedId = feedId;
  }
  if (onlyUnread) where.push("i.is_read = 0");
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const items = db.prepare(`
    SELECT i.*, f.title AS feed_title, f.url AS feed_url
    FROM items i JOIN feeds f ON f.id = i.feed_id
    ${whereSql}
    ORDER BY COALESCE(i.pub_date, i.created_at) DESC
    LIMIT @limit
  `).all({ ...params, limit });

  res.json(items.map((i) => ({
    id: i.id,
    feedId: i.feed_id,
    feedTitle: i.feed_title,
    title: i.title,
    link: i.link,
    author: i.author,
    pubDate: i.pub_date,
    summary: i.summary,
    imageUrl: i.image_url,
    createdAt: i.created_at,
    isRead: !!i.is_read,
    isStarred: !!i.is_starred,
    contentHtml: i.content_html,
  })));
});

router.patch("/:id", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT id FROM items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "item not found" });

  const { isRead, isStarred } = req.body || {};
  if (isRead !== undefined) {
    db.prepare("UPDATE items SET is_read = ? WHERE id = ?").run(isRead ? 1 : 0, req.params.id);
  }
  if (isStarred !== undefined) {
    db.prepare("UPDATE items SET is_starred = ? WHERE id = ?").run(isStarred ? 1 : 0, req.params.id);
  }
  res.json({ ok: true });
});

router.post("/mark-all-read", (req, res) => {
  const db = getDb();
  const feedId = req.body && req.body.feedId ? Number(req.body.feedId) : null;
  if (feedId) {
    db.prepare("UPDATE items SET is_read = 1 WHERE feed_id = ?").run(feedId);
  } else {
    db.prepare("UPDATE items SET is_read = 1").run();
  }
  res.json({ ok: true });
});

module.exports = router;
