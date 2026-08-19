const { fetchJournalWorks, resolveJournalByTitle } = require("./crossref");

const CACHE_PREFIX = "crossref:";
const JINA_TIMEOUT = 45000;

async function fetchCambridgeFeed(url, options = {}) {
  const cached = options.etag || null;
  if (cached && cached.startsWith(CACHE_PREFIX)) {
    return fetchJournalWorks(cached.slice(CACHE_PREFIX.length));
  }

  const issn = await resolveCambridgeIssn(url);
  const result = await fetchJournalWorks(issn);
  result.etag = CACHE_PREFIX + issn;
  return result;
}

async function resolveCambridgeIssn(url) {
  const segs = url.pathname.split("/").filter(Boolean);
  let journalName = null;

  const idIdx = segs.indexOf("id");
  if (segs[0] === "journals" && segs[1]) {
    journalName = segs[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } else if (segs.includes("rss") && idIdx !== -1 && segs[idIdx + 1]) {
    journalName = await resolveProductName(segs[idIdx + 1]);
  } else {
    throw new Error(
      `Unsupported Cambridge Core URL "${url.pathname}". Use the journal RSS link, e.g. https://www.cambridge.org/core/rss/product/id/<id>`
    );
  }

  if (!journalName) {
    throw new Error("Could not identify the Cambridge journal. Check the URL and try again.");
  }

  const resolved = await resolveJournalByTitle(journalName);
  if (!resolved) {
    throw new Error(`No Crossref record found for "${journalName}".`);
  }
  return resolved.issn;
}

async function resolveProductName(hex) {
  const target = `https://www.cambridge.org/core/rss/product/id/${hex}`;
  const res = await fetch("https://r.jina.ai/" + target, {
    signal: AbortSignal.timeout(JINA_TIMEOUT),
  });
  if (!res.ok) throw new Error(`Could not resolve journal (HTTP ${res.status}).`);
  const body = await res.text();
  const m = body.match(/CDATA\[([^\]]+)\]/);
  if (!m) throw new Error("Could not identify the journal from the RSS link.");
  return m[1].trim();
}

module.exports = { fetchCambridgeFeed };