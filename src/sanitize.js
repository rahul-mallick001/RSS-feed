const sanitizeHtml = require("sanitize-html");

const ALLOWED_TAGS = [
  "a", "b", "strong", "i", "em", "u", "s", "strike", "del", "ins",
  "p", "br", "hr", "blockquote", "pre", "code", "samp", "kbd",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "figure", "figcaption", "img", "picture", "source",
  "div", "span", "section", "article", "details", "summary",
  "sub", "sup", "mark", "abbr", "cite", "q", "small", "time", "wbr",
];

const ALLOWED_ATTRS = {
  a: ["href", "title", "rel", "target"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  source: ["srcset", "sizes", "type"],
  code: ["class"],
  span: ["class"],
  div: ["class"],
  th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"],
  time: ["datetime"],
  abbr: ["title"],
  table: ["class"],
  pre: ["class"],
};

const ALLOWED_SCHEMES = ["http", "https", "mailto", "ftp", "data"];

function sanitize(html) {
  return sanitizeHtml(html || "", {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
      img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
    },
  });
}

module.exports = { sanitize };
