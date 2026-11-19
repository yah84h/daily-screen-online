// Ezaati Player: full-screen kiosk (Windows and Mac) for the school TV page, with media saved to disk.
const {
  app,
  BrowserWindow,
  ipcMain,
  powerSaveBlocker,
  protocol,
  session,
  globalShortcut,
  shell,
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createDownloader } = require('./downloader.cjs');

const DEFAULT_URL = 'https://ezaati.com/tv';
const SCHEME = 'ezaati-media';

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

if (!app.requestSingleInstanceLock()) app.quit();

const configFile = () => path.join(app.getPath('userData'), 'config.json');
function readConfig() {
  try {
    return { url: DEFAULT_URL, kiosk: true, ...JSON.parse(fs.readFileSync(configFile(), 'utf8')) };
  } catch {
    return { url: DEFAULT_URL, kiosk: true };
  }
}
function writeConfig(next) {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(next, null, 1));
}

let win = null;
let config = null;
let downloader = null;
let retryTimer = null;

function allowedOrigin() {
  try {
    return new URL(config.url).origin;
  } catch {
    return new URL(DEFAULT_URL).origin;
  }
}

function showOffline(reason) {
  if (!win || win.isDestroyed()) return;
  void win.loadFile(path.join(__dirname, 'offline.html'), {
    query: { reason: String(reason || ''), url: config.url },
  });
  clearTimeout(retryTimer);
  retryTimer = setTimeout(loadScreen, 15000);
}

function loadScreen() {
  clearTimeout(retryTimer);
  if (!win || win.isDestroyed()) return;
  win.loadURL(config.url).catch((error) => showOffline(error.code || error.message));
}

function createWindow() {
  win = new BrowserWindow({
    fullscreen: config.kiosk,
    kiosk: config.kiosk,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
      additionalArguments: ['--ezaati-origin=' + allowedOrigin(), '--ezaati-version=' + app.getVersion()],
    },
  });
  win.setMenu(null);
  win.once('ready-to-show', () => win.show());
  // Recover by itself: network errors, renderer crashes and hangs all reload the screen.
  win.webContents.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && !url.startsWith('file:')) showOffline(description);
  });
  win.webContents.on('render-process-gone', () => setTimeout(loadScreen, 2000));
  win.on('unresponsive', () => setTimeout(() => win?.webContents.reload(), 10000));
  // Links that open new windows go to the normal browser, never over the TV.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:')) return;
    if (new URL(url).origin !== allowedOrigin()) event.preventDefault();
  });
  loadScreen();
}

/** Serves saved files with byte ranges so videos seek and loop without reading them into memory. */
function serveMedia(request) {
  const url = new URL(request.url);
  const name = url.pathname.replace(/^\//, '');
  const entry = downloader.fileFor(name);
  if (!entry || !fs.existsSync(entry.path)) return new Response('Not found', { status: 404 });
  const size = fs.statSync(entry.path).size;
  const headers = {
    'Content-Type': entry.type,
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end)
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const stream = fs.createReadStream(entry.path, { start, end });
    return new Response(Readable.toWeb(stream), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(entry.path)), {
    status: 200,
    headers: { ...headers, 'Content-Length': String(size) },
  });
}

function senderAllowed(event) {
  try {
    return new URL(event.senderFrame.url).origin === allowedOrigin();
  } catch {
    return false;
  }
}

ipcMain.handle('media:prepare', async (event, { url, base, kind, id }) => {
  if (!senderAllowed(event)) throw Error('NOT_ALLOWED');
  const entry = await downloader.prepare(url, {
    base,
    kind,
    onProgress: (loaded, total) => {
      if (!event.sender.isDestroyed()) event.sender.send('media:progress', { id, loaded, total });
    },
  });
  return { url: `${SCHEME}://media/${entry.file}`, size: entry.size, type: entry.type };
});
ipcMain.handle('media:forget', async (event, { url, base }) => {
  if (!senderAllowed(event)) throw Error('NOT_ALLOWED');
  await downloader.forget(url, base);
});
// Settings page (offline.html) — only from the local file, never from the website.
ipcMain.handle('settings:get', (event) =>
  event.senderFrame.url.startsWith('file:') ? { ...config, mediaDir: downloader.dir } : null,
);
ipcMain.handle('settings:save', (event, next) => {
  if (!event.senderFrame.url.startsWith('file:')) return;
  const url = new URL(String(next.url || DEFAULT_URL));
  if (!/^https?:$/.test(url.protocol)) throw Error('URL must be http(s)');
  config = { ...config, url: url.href, kiosk: !!next.kiosk };
  writeConfig(config);
  app.relaunch();
  app.exit(0);
});
ipcMain.handle('screen:retry', () => loadScreen());

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  config = readConfig();
  downloader = createDownloader({ dir: path.join(app.getPath('userData'), 'media') });
  protocol.handle(SCHEME, serveMedia);
  // Start with Windows and keep the screen awake.
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
  powerSaveBlocker.start('prevent-display-sleep');
  // The TV page only needs full screen; camera, microphone, location etc. are refused.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, done) =>
    done(permission === 'fullscreen'),
  );
  createWindow();
  // Ctrl+Shift+Q quit · Ctrl+Shift+R reload · Ctrl+Shift+S settings · F11 full screen.
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
  globalShortcut.register('CommandOrControl+Shift+R', () => loadScreen());
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    clearTimeout(retryTimer);
    void win?.loadFile(path.join(__dirname, 'offline.html'), { query: { settings: '1' } });
  });
  globalShortcut.register('F11', () => {
    if (!win) return;
    const on = !win.isKiosk();
    win.setKiosk(on);
    win.setFullScreen(on);
  });
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
