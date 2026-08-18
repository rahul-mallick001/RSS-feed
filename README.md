# RSS Feed Reader

Personal RSS reader that aggregates feeds from different websites, auto-syncs new posts, and shows full text with images and LaTeX equations.

## Features

- **Multi-feed aggregation** — add any RSS/Atom feed URL
- **Auto-sync** — polls every feed on a schedule (default 15 min, configurable), with HTTP conditional GET (`ETag`/`Last-Modified`) so unchanged feeds cost almost nothing
- **Full-text extraction** — fetches the article page and extracts the main content (Mozilla Readability) when the feed only carries a summary; falls back to feed content on failure
- **Images** — lead image extracted from the article/og:image, shown as list thumbnail and in the article
- **Equations** — LaTeX rendered client-side with KaTeX (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`)
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

## Configuration

| Env var | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `POLL_INTERVAL_MINUTES` | `15` | Auto-sync interval |

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
