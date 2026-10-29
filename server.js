const path = require("path");
const express = require("express");
const { startPoller } = require("./src/poller");
const { startImageWorker } = require("./src/imageWorker");
const feedsRouter = require("./src/routes/feeds");
const itemsRouter = require("./src/routes/items");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  app.use("/api/feeds", feedsRouter);
  app.use("/api/items", itemsRouter);

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  return app;
}

function startServer(options = {}) {
  const port = options.port !== undefined ? options.port : Number(process.env.PORT) || 3000;
  if (options.dataDir) process.env.RSS_DATA_DIR = options.dataDir;

  const app = createApp();
  startPoller();
  startImageWorker();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, "127.0.0.1", () => {
      resolve({ app, server, port: server.address().port });
    });
    server.on("error", reject);
  });
}

module.exports = { createApp, startServer };

if (require.main === module) {
  startServer()
    .then(({ port }) => console.log(`rss-feed running at http://localhost:${port}`))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}