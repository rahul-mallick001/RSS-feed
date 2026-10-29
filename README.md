# RSS Feed Reader

Personal RSS reader that aggregates feeds from different websites, auto-syncs new posts, and shows full text with images and LaTeX equations.

## Features

- **Multi-feed aggregation** — add any RSS/Atom feed URL
- **Auto-sync** — polls every feed on a schedule (default 15 min, configurable), with HTTP conditional GET (`ETag`/`Last-Modified`) so unchanged feeds cost almost nothing
- **Full-text extraction** — fetches the article page and extracts the main content (Mozilla Readability) when the feed only carries a summary; falls back to feed content on failure
- **Images** — lead image extracted from the article/og:image, shown as list thumbnail and in the article
- **Abstracts** — journal abstracts are stored as plain text and shown as a two-line snippet in the item list plus a highlighted abstract block above the article text
- **Graphical abstracts** — shown above the abstract in article view and as the list thumbnail; resolved via article `og:image` (e.g. Cambridge static CDN), with a fallback to the paper's first figure on arXiv (via Semantic Scholar DOI match) for journals behind bot-walls. A background worker fills in missing images over time
- **Equations** — LaTeX rendered client-side with KaTeX (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`); MathML rendered natively
- **APS journals** — `journals.aps.org` feeds are Cloudflare-protected, so the app pulls them from the Crossref API instead (abstracts + MathML equations); paste the journal homepage URL, e.g. `https://journals.aps.org/prfluids/`
- **Cambridge Core** — same Cloudflare wall; `www.cambridge.org` RSS links are auto-detected and served from Crossref (the product id is resolved once via reader proxy, then cached)
- **Unread counts, starred items, mark-all-read**
- **Safe by default** — all third-party HTML is sanitized; SSRF guard blocks private/localhost feed URLs

## Tech

Node.js (>=18) · Express · SQLite (`better-sqlite3`) · `rss-parser` · `@mozilla/readability` + `jsdom` · `sanitize-html` · `node-cron` · KaTeX · vanilla JS frontend.

## Run

```bash
npm install
npm start
```

Open http://localhost:3000 and paste a feed URL (e.g. `https://feeds.bbci.co.uk/news/rss.xml`, `https://arxiv.org/rss/math.GT`).

Dev mode with auto-restart: `npm run dev`

## Desktop app

```bash
npm run desktop   # run as a desktop window (Electron)
npm run dist      # build Windows installers into release/
```

`npm run dist` produces:

- `release/RSS Reader Setup <version>.exe` — NSIS installer (Start-menu + desktop shortcut)
- `release/RSS Reader <version>.exe` — portable single-file exe, no install

The desktop build stores its database in `%APPDATA%\RSS Reader\data\rss.db`; dev mode (`npm run desktop`) reuses the repo's `./data` folder so it shares state with `npm start`.

`better-sqlite3` is a native module and plain Node and Electron use different ABIs. `npm start` / `npm run desktop` / `npm run dist` automatically swap the right binary via `scripts/use-abi.js`; the two builds are kept in `node_modules/better-sqlite3/build/Release-{node,electron}`.

Unsigned build: Windows SmartScreen will warn on first launch (no code-signing certificate).

## Configuration

| Env var | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port (`0` = pick a free port, used by the desktop app) |
| `POLL_INTERVAL_MINUTES` | `15` | Auto-sync interval |
| `RSS_DATA_DIR` | `./data` | Directory for `rss.db` |

## Data

SQLite database lives in `data/rss.db` (gitignored). Delete the file to reset.

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/feeds` | List feeds with unread counts |
| `POST` | `/api/feeds` | Add feed `{url}` |
| `POST` | `/api/feeds/:id/refresh` | Sync one feed now |
| `DELETE` | `/api/feeds/:id` | Remove feed and its items |
| `GET` | `/api/items?feed=&limit=` | List items (newest first) |
| `PATCH` | `/api/items/:id` | `{isRead}`, `{isStarred}` |
| `POST` | `/api/items/mark-all-read` | `{feedId?}` optional scope |
