/* Electron wrapper: loads the same static app. Data lives in the app's own
   IndexedDB profile (%APPDATA%\Lexi on Windows), so it survives restarts. */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 820, minWidth: 380, minHeight: 560,
    title: 'Lexi', backgroundColor: '#0f1120', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.setName('Lexi');
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
