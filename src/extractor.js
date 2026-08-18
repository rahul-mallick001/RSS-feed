const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");

const MAX_PAGE_BYTES = 2_000_000;

async function extractFullText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "rss-feed-reader/1.0 (+personal use)" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("html")) return null;

  const text = await res.text();
  if (text.length > MAX_PAGE_BYTES) return null;

  const dom = new JSDOM(text, { url });
  const reader = new Readability(dom.window.document, { charThreshold: 120 });
  const article = reader.parse();
  if (!article || !article.content) return null;

  return {
    content: article.content,
    excerpt: (article.excerpt || "").slice(0, 1000),
    image: extractLeadImage(article.content, dom.window.document),
  };
}

function extractLeadImage(contentHtml, document) {
  const m = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return absolutize(m[1], document);
  const og = document.querySelector('meta[property="og:image"]');
  if (og && og.getAttribute("content")) return absolutize(og.getAttribute("content"), document);
  return null;
}

function absolutize(src, document) {
  try {
    return new URL(src, document.baseURI || document.location.href).toString();
  } catch {
    return null;
  }
}

module.exports = { extractFullText };
