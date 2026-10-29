const CROSSREF_UA = "rss-feed-reader/1.0 (mailto:rss-feed@example.com)";
const CROSSREF_BASE = "https://api.crossref.org";

async function fetchJson(url, timeout = 30000) {
  const res = await fetch(url, {
    headers: { "User-Agent": CROSSREF_UA },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`Crossref HTTP ${res.status}`);
  return res.json();
}

function issnFromJournal(item) {
  if (!item || !item["issn-type"]) return null;
  for (const it of item["issn-type"]) {
    if (it.type === "print" && it.value) return it.value;
  }
  for (const it of item["issn-type"]) {
    if (it.type === "electronic" && it.value) return it.value;
  }
  return null;
}

async function resolveJournalByTitle(title) {
  const url = `${CROSSREF_BASE}/journals?query=${encodeURIComponent(title)}&rows=1`;
  const j = await fetchJson(url);
  const items = (j.message && j.message.items) || [];
  if (!items.length) return null;
  const issn = issnFromJournal(items[0]);
  if (!issn) return null;
  const jTitle = (items[0].title || title).replace(/<[^>]+>/g, "");
  return { issn, title: jTitle };
}

async function fetchJournalWorks(issn, options = {}) {
  const rows = options.rows || 50;
  const url = `${CROSSREF_BASE}/journals/${issn}/works?rows=${rows}&sort=published&order=desc&filter=has-abstract:true&select=DOI,title,author,abstract,published,URL,container-title`;
  const data = await fetchJson(url);
  const works = (data.message && data.message.items) || [];

  let containerTitle = null;
  const items = works.map((w) => {
    const title = (w.title && w.title[0]) || "Untitled";
    const authors = (w.author || [])
      .map((a) => `${a.given || ""} ${a.family || ""}`.trim())
      .filter(Boolean)
      .join(", ");
    const dp = (w.published && w.published["date-parts"] && w.published["date-parts"][0]) || [];
    const pubDate = dp.length >= 3 ? new Date(Date.UTC(dp[0], dp[1] - 1, dp[2])).getTime() : null;
    if (!containerTitle && w["container-title"] && w["container-title"][0]) {
      containerTitle = w["container-title"][0];
    }
    const abstractHtml = jatsToHtml(w.abstract);
    return {
      guid: w.DOI,
      title,
      link: w.URL || `https://doi.org/${w.DOI}`,
      author: authors || null,
      pubDate,
      contentHtml: abstractHtml,
      summary: abstractHtml ? plainText(abstractHtml) : null,
      imageUrl: null,
    };
  });

  if (!containerTitle) {
    try {
      const jr = await fetchJson(`${CROSSREF_BASE}/journals/${issn}`);
      if (jr.message && jr.message.title) containerTitle = jr.message.title;
    } catch {
      // keep null
    }
  }

  return {
    notModified: false,
    feed: { title: containerTitle, link: null, items },
    etag: null,
    lastModified: null,
  };
}

function jatsToHtml(jats) {
  if (!jats) return "";
  return jats
    .replace(/<\/?[a-zA-Z0-9]+:/g, (m) => (m.startsWith("</") ? "</" : "<"))
    .replace(/<jats:sc>/g, "<span>")
    .replace(/<\/jats:sc>/g, "</span>");
}

function plainText(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = { fetchJournalWorks, resolveJournalByTitle, jatsToHtml };