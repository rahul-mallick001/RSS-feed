const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("rssDesktop", {
  platform: process.platform,
  isDesktop: true,
});
