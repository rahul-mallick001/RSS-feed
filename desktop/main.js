const { app, BrowserWindow, Menu, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { startServer } = require("../server");

const isDev = !app.isPackaged;
let mainWindow = null;
let serverInfo = null;

app.setName("RSS Reader");

function stateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadBounds() {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    if (raw && Number.isFinite(raw.width) && Number.isFinite(raw.height)) return raw;
  } catch {
    // first run
  }
  return { width: 1320, height: 880 };
}

function saveBounds() {
  if (!mainWindow) return;
  try {
    const b = mainWindow.getNormalBounds();
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(b));
  } catch {
    // non-fatal
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    // Dev reuses the repo's ./data so `npm start` and `npm run desktop` share state.
    const dataDir = isDev
      ? path.join(__dirname, "..", "data")
      : path.join(app.getPath("userData"), "data");

    try {
      serverInfo = await startServer({ port: 0, dataDir });
    } catch (e) {
      console.error("Failed to start server:", e);
      app.quit();
      return;
    }

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

function createWindow() {
  const bounds = loadBounds();
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    title: "RSS Reader",
    backgroundColor: "#f6f7f9",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverInfo.port}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", saveBounds);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.RSS_SHOT) {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        const img = await mainWindow.webContents.capturePage();
        fs.writeFileSync(process.env.RSS_SHOT, img.toPNG());
        app.quit();
      }, 6000);
    });
  }
}
