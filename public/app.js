const state = {
  feeds: [],
  items: [],
  filter: "all", // "all" | "starred" | feedId
  activeItemId: null,
  loading: false,
};

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], sameYear
    ? { month: "short", day: "numeric" }
    : { year: "numeric", month: "short", day: "numeric" });
}

/* ---------- API ---------- */

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ---------- Feeds ---------- */

async function loadFeeds() {
  state.feeds = await api("/api/feeds");
  renderFeeds();
}

function renderFeeds() {
  const list = $("#feed-list");
  list.innerHTML = "";
  const tpl = $("#feed-tpl");

  for (const feed of state.feeds) {
    const node = tpl.content.cloneNode(true);
    const link = node.querySelector(".feed-link");
    link.dataset.filter = feed.id;
    link.querySelector(".feed-name").textContent = feed.title || feed.url;
    link.querySelector(".feed-name").title = feed.url;
    const badge = link.querySelector(".unread-badge");
    badge.textContent = feed.unread || 0;
    if (!feed.unread) badge.classList.add("zero");
    link.querySelector(".feed-delete").addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm(`Remove feed "${feed.title || feed.url}" and all its items?`)) return;
      await api(`/api/feeds/${feed.id}`, { method: "DELETE" });
      if (state.filter == feed.id) state.filter = "all";
      await refreshAll();
    });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      setFilter(feed.id);
    });
    list.appendChild(node);
  }
}

function setFilter(filter) {
  state.filter = filter;
  state.activeItemId = null;
  document.querySelectorAll(".feed-link").forEach((l) => {
    l.classList.toggle("active", String(l.dataset.filter) === String(filter));
  });
  const feed = state.feeds.find((f) => f.id == filter);
  $("#items-title").textContent =
    filter === "all" ? "All items" :
    filter === "starred" ? "Starred" :
    (feed ? feed.title : "Items");
  loadItems();
}

/* ---------- Items ---------- */

async function loadItems() {
  let url = "/api/items?limit=200";
  if (state.filter === "starred") url += "&unread=0";
  if (state.filter !== "all" && state.filter !== "starred") url += `&feed=${state.filter}`;
  state.items = await api(url);
  if (state.filter === "starred") state.items = state.items.filter((i) => i.isStarred);
  renderItems();
}

function renderItems() {
  const list = $("#items-list");
  list.innerHTML = "";
  const empty = $("#empty-state");
  if (!state.items.length) {
    empty.hidden = false;
    empty.textContent = state.filter === "starred" ? "No starred items yet." : "No items yet. Add a feed URL on the left.";
    return;
  }
  empty.hidden = true;

  const tpl = $("#item-tpl");
  for (const item of state.items) {
    const node = tpl.content.cloneNode(true);
    const li = node.querySelector(".item");
    li.dataset.id = item.id;
    li.classList.toggle("read", item.isRead);
    li.classList.toggle("unread", !item.isRead);
    li.classList.toggle("active", item.id === state.activeItemId);

    const thumb = node.querySelector(".item-thumb");
    if (item.imageUrl) {
      thumb.src = item.imageUrl;
      thumb.hidden = false;
    }

    const titleEl = node.querySelector(".item-title");
    titleEl.textContent = item.title;
    if (item.isStarred) {
      const star = document.createElement("span");
      star.className = "star-flag";
      star.textContent = "★";
      titleEl.appendChild(star);
    }

    const meta = node.querySelector(".item-meta");
    const feedTitle = state.filter === "all" ? `${esc(item.feedTitle)} · ` : "";
    meta.textContent = `${feedTitle}${fmtDate(item.pubDate || item.createdAt)}${item.author ? ` · ${item.author}` : ""}`;

    li.addEventListener("click", () => openItem(item));
    list.appendChild(node);
  }
}

async function openItem(item) {
  state.activeItemId = item.id;
  renderItems();

  if (!item.isRead) {
    item.isRead = true;
    api(`/api/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ isRead: true }) }).catch(() => {});
    const feed = state.feeds.find((f) => f.id == item.feedId);
    if (feed && feed.unread > 0) {
      feed.unread--;
      renderFeeds();
    }
    updateAllBadge();
  }

  const article = $("#article-body");
  $("#article-empty").hidden = true;
  article.hidden = false;

  $("#article-title").textContent = item.title;

  const meta = $("#article-meta");
  meta.innerHTML = "";
  const metaParts = [];
  if (item.feedTitle) metaParts.push(`<strong>${esc(item.feedTitle)}</strong>`);
  if (item.author) metaParts.push(esc(item.author));
  metaParts.push(fmtDate(item.pubDate || item.createdAt));
  meta.textContent = metaParts.join(" · ");

  const actions = $("#article-actions");
  const starBtn = actions.querySelector(".star-btn");
  starBtn.textContent = item.isStarred ? "★ Unstar" : "☆ Star";
  starBtn.classList.toggle("starred", item.isStarred);
  starBtn.onclick = async () => {
    item.isStarred = !item.isStarred;
    await api(`/api/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ isStarred: item.isStarred }) });
    starBtn.textContent = item.isStarred ? "★ Unstar" : "☆ Star";
    starBtn.classList.toggle("starred", item.isStarred);
  };
  const openLink = actions.querySelector(".open-link");
  if (item.link) {
    openLink.href = item.link;
    openLink.hidden = false;
  } else {
    openLink.hidden = true;
  }
  $("#article-back").onclick = () => $("#app").classList.remove("show-article");

  const content = $("#article-content");
  content.innerHTML = item.contentHtml || `<p>${esc(item.summary || "No content available.")}</p>`;
  renderMath(content);

  showGraphicalAbstract(item);

  $("#article-pane").scrollTop = 0;
  if (window.innerWidth <= 900) $("#app").classList.add("show-article");
}

async function showGraphicalAbstract(item) {
  const fig = $("#graphical-abstract");
  fig.innerHTML = "";
  fig.hidden = true;

  let url = item.imageUrl;
  if (!url && !item.imageAttempted) {
    try {
      const r = await api(`/api/items/${item.id}/graphical`, { method: "POST" });
      url = r.imageUrl || null;
      item.imageUrl = url;
    } catch {
      url = null;
    }
  }
  if (!url) return;

  const img = document.createElement("img");
  img.alt = "Graphical abstract";
  img.loading = "lazy";
  img.onerror = () => {
    fig.hidden = true;
    fig.innerHTML = "";
  };
  img.src = url;
  const cap = document.createElement("figcaption");
  cap.textContent = "Graphical abstract";
  fig.appendChild(img);
  fig.appendChild(cap);
  fig.hidden = false;
}

function renderMath(el) {
  try {
    if (window.renderMathInElement) {
      renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    }
  } catch (e) {
    console.warn("math render failed", e);
  }
}

/* ---------- Unread badges ---------- */

function updateAllBadge() {
  const total = state.feeds.reduce((s, f) => s + (f.unread || 0), 0);
  const badge = $("#badge-all");
  badge.textContent = total;
  badge.classList.toggle("zero", total === 0);
}

/* ---------- Events ---------- */

$("#add-feed-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("#feed-url");
  const url = input.value.trim();
  if (!url) return;
  input.disabled = true;
  try {
    await api("/api/feeds", { method: "POST", body: JSON.stringify({ url }) });
    input.value = "";
    await refreshAll();
  } catch (err) {
    alert(`Could not add feed: ${err.message}`);
  } finally {
    input.disabled = false;
  }
});

$("#refresh-all").addEventListener("click", refreshAll);

async function refreshAll() {
  if (state.loading) return;
  state.loading = true;
  $("#refresh-all").textContent = "Syncing...";
  try {
    await Promise.all(state.feeds.map((f) => api(`/api/feeds/${f.id}/refresh`, { method: "POST" })));
  } catch (e) {
    console.error(e);
  } finally {
    state.loading = false;
    $("#refresh-all").textContent = "Refresh all";
    await loadFeeds();
    updateAllBadge();
    await loadItems();
  }
}

$("#mark-all-read").addEventListener("click", async () => {
  const feedId = state.filter !== "all" && state.filter !== "starred" ? state.filter : null;
  await api("/api/items/mark-all-read", { method: "POST", body: JSON.stringify({ feedId }) });
  await refreshAll();
});

document.querySelectorAll("#feed-nav .feed-link").forEach((l) => {
  l.addEventListener("click", (e) => {
    e.preventDefault();
    setFilter(l.dataset.filter);
  });
});

/* ---------- Boot ---------- */

async function boot() {
  await loadFeeds();
  updateAllBadge();
  await loadItems();
}

boot();
