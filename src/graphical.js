const { JSDOM } = require("jsdom");

const JINA_BASE = "https://r.jina.ai/";
const JINA_TIMEOUT = 45000;
const S2_TIMEOUT = 30000;
const JUNK_IMG = /(\.svg|logo|icon|crossmark|creativecommons|arxiv-logo|placeholder|smileybones)/i;
const JUNK_HOST = ["crossmark-cdn.crossref.org", "doi.org"];

async function fetchGraphicalAbstract(link) {
  if (!link || !/^https:\/\//.test(link)) return null;

  const html = await jinaFetch(link, { format: "html" });
  if (html) {
    const url = ogImageFromHtml(html, link);
    if (url && (await validateImage(url))) return url;
  }

  const md = await jinaFetch(link, { format: "markdown" });
  if (md) {
    const url = imageFromMarkdown(md, link);
    if (url && (await validateImage(url))) return url;
  }

  if (/^https:\/\/doi\.org\//.test(link)) {
    const url = await arxivFigureFallback(link);
    if (url && (await validateImage(url))) return url;
  }
  return null;
}

async function validateImage(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") || "";
    return type.startsWith("image/");
  } catch {
    return false;
  }
}

async function arxivFigureFallback(doiLink) {
  try {
    const doi = doiLink.replace("https://doi.org/", "");
    const arxivId = await s2ArxivId(doi);
    if (!arxivId) return null;

    const hr = await fetch(`https://arxiv.org/html/${arxivId}v1`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(30000),
    });
    if (!hr.ok) return null;
    const body = await hr.text();
    const re = /<img[^>]+src=["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(body))) {
      const src = m[1];
      if (JUNK_IMG.test(src)) continue;
      if (src.startsWith("http")) return src;
      return `https://arxiv.org/html/${src}`;
    }
  } catch {
    return null;
  }
  return null;
}

async function s2ArxivId(doi) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=externalIds`, {
        headers: { "User-Agent": "rss-feed-reader/1.0" },
        signal: AbortSignal.timeout(S2_TIMEOUT),
      });
      if (r.ok) {
        const p = await r.json();
        return (p.externalIds && p.externalIds.ArXiv) || null;
      }
      if (r.status === 429) {
        await new Promise((res) => setTimeout(res, 2500 * attempt));
        continue;
      }
      return null;
    } catch {
      return null;
    }
  }
  return null;
}

async function jinaFetch(link, { format }) {
  try {
    const headers = { "X-No-Cache": "true" };
    if (format === "html") headers["X-Return-Format"] = "html";
    const res = await fetch(JINA_BASE + link, {
      headers,
      signal: AbortSignal.timeout(JINA_TIMEOUT),
    });
    if (!res.ok) return null;
    const body = await res.text();
    if (body.length < 5000) return null; // challenge or error page
    return body;
  } catch {
    return null;
  }
}

function ogImageFromHtml(html, base) {
  const dom = new JSDOM(html, { url: base });
  const doc = dom.window.document;
  let url = null;
  const og = doc.querySelector('meta[property="og:image"]');
  if (og && og.getAttribute("content")) url = og.getAttribute("content");
  if (!url) {
    const rel = doc.querySelector('link[rel="image_src"]');
    if (rel && rel.getAttribute("href")) url = rel.getAttribute("href");
  }
  if (url && !isJunk(url)) return absolutize(url, base);
  return null;
}

function imageFromMarkdown(md, base) {
  const re = /!\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(md))) {
    const url = m[1].trim();
    if (!url || !/^https?:\/\//.test(url) || isJunk(url)) continue;
    const abs = absolutize(url, base);
    if (!abs || abs === base) continue;
    return abs;
  }
  return null;
}

function isJunk(url) {
  if (JUNK_IMG.test(url)) return true;
  try {
    const host = new URL(url).hostname;
    if (JUNK_HOST.includes(host)) return true;
  } catch {
    return true;
  }
  return false;
}

function absolutize(url, base) {
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

module.exports = { fetchGraphicalAbstract };