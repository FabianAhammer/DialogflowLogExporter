"use strict";

import { app, BrowserWindow, session } from "electron";

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== "development") {
  global.__static = require("path")
    .join(__dirname, "/static")
    .replace(/\\/g, "\\\\");
}

let mainWindow;
const winURL =
  process.env.NODE_ENV === "development"
    ? `http://localhost:9080`
    : `file://${__dirname}/index.html`;

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    height: 563,
    useContentSize: true,
    width: 1000,
    frame: true,
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true
    }
  });

  mainWindow.loadURL(winURL);

  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: ["https://api.dialogflow.com/*"]
    },
    (details, callback) => {
      //details.requestHeaders["User-Agent"] = "MyAgent";
      if (details.requestHeaders["X-GOOG-ACCESS-TOKEN"]) {
        mainWindow.webContents.send(
          "headers",
          JSON.stringify({
            "X-GOOG-ACCESS-TOKEN":
              details.requestHeaders["X-GOOG-ACCESS-TOKEN"],
            "X-GOOG-ID-TOKEN": details.requestHeaders["X-GOOG-ID-TOKEN"]
          })
        );
      }
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  // Open dev tools initially when in development mode
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.on("did-frame-finish-load", () => {
      mainWindow.webContents.once("devtools-opened", () => {
        mainWindow.focus();
      });
      mainWindow.webContents.openDevTools();
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
