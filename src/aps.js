const APS_ISSN = {
  pra: "2469-9926",
  prb: "2469-9950",
  prc: "2469-9985",
  prd: "2470-0010",
  pre: "2470-0045",
  prapplied: "2331-7019",
  prfluids: "2469-990X",
  prmaterials: "2475-9953",
  prl: "0031-9007",
  prx: "2160-3308",
  prxquantum: "2691-3399",
  prxenergy: "2768-5608",
  prxlife: "2835-8279",
  prresearch: "2643-1564",
  rmp: "0034-6861",
  prper: "2469-9896",
};

const CROSSREF_UA = "rss-feed-reader/1.0 (mailto:rss-feed@example.com)";

function journalCodeFromUrl(url) {
  const seg = url.pathname.split("/").filter(Boolean)[0];
  if (!seg || ["rss", "feeds", "content"].includes(seg)) return null;
  return seg.toLowerCase();
}

function jatsToHtml(jats) {
  if (!jats) return "";
  return jats
    .replace(/<\/?[a-zA-Z0-9]+:/g, (m) => (m.startsWith("</") ? "</" : "<"))
    .replace(/<jats:sc>/g, "<span>")
    .replace(/<\/jats:sc>/g, "</span>");
}

async function fetchApsFeed(url) {
  const code = journalCodeFromUrl(url);
  const issn = APS_ISSN[code];
  if (!issn) {
    throw new Error(
      `Unsupported APS journal path "${url.pathname}". Use the journal homepage URL, e.g. https://journals.aps.org/prfluids/`
    );
  }

  const apiUrl = `https://api.crossref.org/journals/${issn}/works?rows=50&sort=published&order=desc&filter=has-abstract:true&select=DOI,title,author,abstract,published,URL,container-title`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": CROSSREF_UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Crossref HTTP ${res.status}`);
  const data = await res.json();
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
    return {
      guid: w.DOI,
      title,
      link: w.URL || `https://doi.org/${w.DOI}`,
      author: authors || null,
      pubDate,
      contentHtml: jatsToHtml(w.abstract),
      summary: null,
      imageUrl: null,
    };
  });

  const feed = {
    title: containerTitle,
    link: url.toString(),
    items,
  };

  if (!feed.title) {
    const jr = await fetch(`https://api.crossref.org/journals/${issn}`, {
      headers: { "User-Agent": CROSSREF_UA },
      signal: AbortSignal.timeout(30000),
    });
    if (jr.ok) {
      const jd = await jr.json();
      if (jd.message && jd.message.title) feed.title = jd.message.title;
    }
  }
  if (!feed.title) feed.title = `APS journal (${code})`;

  return { notModified: false, feed, etag: null, lastModified: null };
}

module.exports = { fetchApsFeed, journalCodeFromUrl };
