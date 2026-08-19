const { fetchJournalWorks } = require("./crossref");

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

function journalCodeFromUrl(url) {
  const seg = url.pathname.split("/").filter(Boolean)[0];
  if (!seg || ["rss", "feeds", "content"].includes(seg)) return null;
  return seg.toLowerCase();
}

async function fetchApsFeed(url, options = {}) {
  const code = journalCodeFromUrl(url);
  const issn = APS_ISSN[code];
  if (!issn) {
    throw new Error(
      `Unsupported APS journal path "${url.pathname}". Use the journal homepage URL, e.g. https://journals.aps.org/prfluids/`
    );
  }
  return fetchJournalWorks(issn);
}

module.exports = { fetchApsFeed, journalCodeFromUrl };