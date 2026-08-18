const { getDb } = require("./db");
const { fetchFeed } = require("./rss");
const { extractFullText } = require("./extractor");
const { sanitize } = require("./sanitize");

const SUMMARY_TRIGGER_LEN = 300;

async function syncFeed(feedRow) {
  const db = getDb();
  const { url, etag, lastModified } = feedRow;
  const startedAt = Date.now();

  let result;
  try {
    result = await fetchFeed(url, { etag, lastModified });
  } catch (e) {
    db.prepare("UPDATE feeds SET fetch_error = ?, last_fetched_at = ? WHERE id = ?")
      .run(String(e.message || e).slice(0, 500), startedAt, feedRow.id);
    return { feedId: feedRow.id, ok: false, error: String(e.message || e) };
  }

  if (result.notModified) {
    db.prepare("UPDATE feeds SET fetch_error = NULL, last_fetched_at = ? WHERE id = ?")
      .run(startedAt, feedRow.id);
    return { feedId: feedRow.id, ok: true, newItems: 0 };
  }

  const feed = result.feed;
  const meta = {
    title: feed.title || null,
    siteUrl: feed.link || null,
    description: feed.description || null,
  };
  const items = (feed.items || []).map(normalizeItem);
  items.reverse(); // feeds usually newest-first; insert oldest-first for stable ordering

  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO items
      (feed_id, guid, title, link, author, pub_date, content_html, summary, image_url, created_at)
    VALUES (@feedId, @guid, @title, @link, @author, @pubDate, @contentHtml, @summary, @imageUrl, @createdAt)
  `);
  const selectByGuid = db.prepare("SELECT id FROM items WHERE feed_id = ? AND guid = ?");
  const updateContent = db.prepare("UPDATE items SET content_html = ?, summary = ?, image_url = ? WHERE id = ?");

  let newCount = 0;
  for (const item of items) {
    const res = insertItem.run({
      feedId: feedRow.id,
      guid: item.guid,
      title: item.title,
      link: item.link,
      author: item.author,
      pubDate: item.pubDate,
      contentHtml: sanitize(item.contentHtml),
      summary: item.summary ? sanitize(item.summary) : null,
      imageUrl: item.imageUrl,
      createdAt: Date.now(),
    });
    if (res.changes === 0) continue;
    newCount++;

    if (item.needsFullText) {
      const row = selectByGuid.get(feedRow.id, item.guid);
      if (row) {
        await enrichItem(row.id, item);
      }
    }
  }

  db.prepare(`
    UPDATE feeds
    SET title = COALESCE(?, title), site_url = COALESCE(?, site_url),
        description = COALESCE(?, description), fetch_error = NULL,
        last_fetched_at = ?, etag = COALESCE(?, etag), last_modified = COALESCE(?, last_modified)
    WHERE id = ?
  `).run(meta.title, meta.siteUrl, meta.description, startedAt,
    result.etag, result.lastModified, feedRow.id);

  return { feedId: feedRow.id, ok: true, newItems: newCount };
}

function normalizeItem(raw) {
  const contentHtml =
    raw["content:encoded"] ||
    raw["content:encodedSnippet"] ||
    raw.content ||
    raw.description ||
    raw.summary ||
    raw["rss:description"] ||
    "";
  const summary = contentHtml ? null : (raw.summary || raw.contentSnippet || "");

  const plainLen = stripTags(contentHtml).trim().length;

  return {
    guid: String(raw.guid || raw.id || raw.link || `${raw.title}-${raw.isoDate || raw.pubDate || Date.now()}`).slice(0, 500),
    title: (raw.title || "Untitled").slice(0, 500),
    link: raw.link || null,
    author: (raw.creator || raw.author || raw["dc:creator"] || null),
    pubDate: parseDate(raw.isoDate || raw.pubDate),
    contentHtml,
    summary,
    imageUrl: pickImageUrl(raw),
    needsFullText: !contentHtml || plainLen < SUMMARY_TRIGGER_LEN,
  };
}

async function enrichItem(itemId, item) {
  const db = getDb();
  let content = null;
  try {
    if (item.link) {
      const extracted = await extractFullText(item.link);
      if (extracted && extracted.content) content = extracted;
    }
  } catch {
    // fall through to feed content
  }

  const current = db.prepare("SELECT content_html, summary, image_url FROM items WHERE id = ?").get(itemId);
  const contentHtml = content ? sanitize(content.content) : current.content_html;
  const summary = content && content.excerpt ? sanitize(content.excerpt) : current.summary;
  const imageUrl = (content && content.image) || current.image_url;
  updateEnriched(itemId, contentHtml, summary, imageUrl);
}

function updateEnriched(id, contentHtml, summary, imageUrl) {
  getDb().prepare("UPDATE items SET content_html = ?, summary = ?, image_url = ? WHERE id = ?")
    .run(contentHtml, summary, imageUrl, id);
}

function pickImageUrl(raw) {
  const enc = raw.enclosure;
  if (enc && /^image\//i.test(enc.type || "")) return enc.url || null;
  if (enc && !enc.type) return enc.url || null;
  return null;
}

function stripTags(html) {
  return String(html || "").replace(/<[^>]*>/g, " ");
}

function parseDate(val) {
  if (!val) return null;
  const t = Date.parse(val);
  return Number.isNaN(t) ? null : t;
}

async function syncAllFeeds() {
  const feeds = getDb().prepare("SELECT * FROM feeds").all();
  const results = [];
  for (const f of feeds) {
    results.push(await syncFeed(f));
  }
  return results;
}

module.exports = { syncFeed, syncAllFeeds };
