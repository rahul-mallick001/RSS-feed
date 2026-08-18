const cron = require("node-cron");
const { syncAllFeeds } = require("./sync");

const INTERVAL_MINUTES = Math.max(1, Number(process.env.POLL_INTERVAL_MINUTES) || 15);
let running = false;

async function runSync() {
  if (running) return;
  running = true;
  try {
    await syncAllFeeds();
  } catch (e) {
    console.error("[poller] sync failed:", e.message);
  } finally {
    running = false;
  }
}

function startPoller() {
  runSync();
  const task = cron.schedule(`*/${INTERVAL_MINUTES} * * * *`, runSync);
  console.log(`[poller] syncing every ${INTERVAL_MINUTES} min`);
  return task;
}

module.exports = { startPoller, runSync };
