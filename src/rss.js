const net = require("net");
const dns = require("dns/promises");
const Parser = require("rss-parser");

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "rss-feed-reader/1.0 (+personal use)" },
});

async function validateFeedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs allowed");
  }
  await assertPublicHost(parsed.hostname);
  return parsed.toString();
}

async function assertPublicHost(hostname) {
  if (hostname === "localhost") throw new Error("Private hosts not allowed");
  const isIp = net.isIP(hostname);
  if (isIp) {
    const first = hostname.split(".")[0];
    if (hostname.startsWith("0.") || hostname.startsWith("10.") ||
        hostname.startsWith("127.") || hostname.startsWith("169.254.") ||
        hostname.startsWith("192.168.") || hostname.startsWith("172.") ||
        hostname.startsWith("fd") || hostname.startsWith("fc") ||
        hostname === "::1" || hostname === "::") {
      throw new Error("Private hosts not allowed");
    }
    return;
  }
  try {
    const addrs = await dns.lookup(hostname, { all: true, verbatim: true });
    for (const a of addrs) {
      if (isPrivateAddr(a.address)) throw new Error("Private hosts not allowed");
    }
  } catch (e) {
    if (e.message === "Private hosts not allowed") throw e;
    // DNS failure: allow through; fetch will surface its own error.
  }
}

function isPrivateAddr(addr) {
  const v = addr.includes(":") ? 6 : 4;
  if (v === 6) {
    const lower = addr.toLowerCase();
    return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") ||
      lower.startsWith("fe80") || lower.startsWith("::ffff:127.");
  }
  const parts = addr.split(".").map(Number);
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
}

async function fetchFeed(url, options = {}) {
  const headers = {
    "User-Agent": "rss-feed-reader/1.0 (+personal use)",
    ...(options.etag ? { "If-None-Match": options.etag } : {}),
    ...(options.lastModified ? { "If-Modified-Since": options.lastModified } : {}),
  };
  const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(25000) });
  if (res.status === 304) return { notModified: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  const feed = await parser.parseString(body);
  return {
    notModified: false,
    feed,
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
  };
}

module.exports = { validateFeedUrl, fetchFeed, assertPublicHost };
