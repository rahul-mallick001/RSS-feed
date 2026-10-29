/*
 * Background worker that slowly resolves graphical abstracts for items that
 * don't have one yet. The resolver hits third-party services, so it runs a
 * couple of lanes with a small pause between items instead of a burst.
 */
const { getDb } = require("./db");
const { resolveGraphicalImage } = require("./sync");

const IDLE_MS = 60_000;
const GAP_MS = 1200;
const LANES = 2;

let started = false;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* Claim one item atomically so parallel lanes never resolve the same one. */
function claimNext() {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, link FROM items
    WHERE image_url IS NULL AND image_attempted = 0 AND link LIKE 'https://doi.org/%'
    ORDER BY COALESCE(pub_date, created_at) DESC
    LIMIT 1
  `).get();
  if (!row) return null;

  const claimed = db
    .prepare("UPDATE items SET image_attempted = 1 WHERE id = ? AND image_attempted = 0")
    .run(row.id);
  return claimed.changes === 1 ? row : null;
}

async function lane() {
  for (;;) {
    let row = null;
    try {
      row = claimNext();
    } catch {
      await sleep(IDLE_MS);
      continue;
    }

    if (!row) {
      await sleep(IDLE_MS);
      continue;
    }

    try {
      const imageUrl = await resolveGraphicalImage(row.link);
      if (imageUrl) {
        getDb().prepare("UPDATE items SET image_url = ? WHERE id = ?").run(imageUrl, row.id);
      }
    } catch {
      // item stays attempted; failed resolutions are not retried forever
    }

    await sleep(GAP_MS);
  }
}

function startImageWorker() {
  if (started) return;
  started = true;
  for (let i = 0; i < LANES; i++) lane();
}

module.exports = { startImageWorker };
