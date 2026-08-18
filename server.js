const path = require("path");
const express = require("express");
const { startPoller } = require("./src/poller");
const feedsRouter = require("./src/routes/feeds");
const itemsRouter = require("./src/routes/items");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/feeds", feedsRouter);
app.use("/api/items", itemsRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

startPoller();

app.listen(PORT, () => {
  console.log(`rss-feed running at http://localhost:${PORT}`);
});
