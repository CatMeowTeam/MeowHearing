// Meow Hearing — tiến trình chính (Electron). Phát triển bởi CatMeow Team.
const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage, dialog, shell, session, screen } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { DB } = require('./db');
const { Api } = require('./api');
const { Auth } = require('./auth');
const { AdBlock } = require('./adblock');
const { YtView, PARTITION } = require('./ytview');
const { InnerTube } = require('./innertube');
const { BrowserLogin } = require('./browserlogin');

const IS_WIN = process.platform === 'win32';
const DIST = path.join(__dirname, '..', 'dist');
const ASSETS = path.join(__dirname, 'assets');
const PREF_PORT = 47831;

app.setAppUserModelId('vn.catmeow.meowhearing');
// phím media do app tự xử lý, không để trang YouTube bắt trùng
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');
if (!app.requestSingleInstanceLock()) { app.quit(); return; }

let db, api, auth, adblock, ytview, server, origin, blogin;
let mainWin = null, miniWin = null, tray = null;
let quitting = false;
let lastState = { playing: false, track: null, time: 0, duration: 0 };
let hotkey = null;

// ---------- máy chủ nội bộ: YouTube player cần trang chạy trên http ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json', '.wasm': 'application/wasm' };
function startServer() {
  return new Promise(resolve => {
    const handler = (req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/' || p === '/mini') p = '/index.html';
      const file = path.normalize(path.join(DIST, p));
      if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
    };
    const tryListen = port => {
      const s = http.createServer(handler);
      s.once('error', () => tryListen(0));
      s.listen(port, '127.0.0.1', () => { server = s; origin = `http://127.0.0.1:${s.address().port}`; resolve(); });
    };
    tryListen(PREF_PORT);
  });
}

// ---------- cửa sổ ----------
function icon(name) { return nativeImage.createFromPath(path.join(ASSETS, name)); }

function createMain(showNow) {
  const s = db.getSettings();
  const b = s.bounds || {};
  mainWin = new BrowserWindow({
    width: b.width || 1240, height: b.height || 780, x: b.x, y: b.y,
    minWidth: 980, minHeight: 640, show: false, title: 'Meow Hearing',
    backgroundColor: s.skinDark ? '#121014' : '#f7f1ef',
    icon: icon('icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: s.skinDark ? '#f2ece8' : '#2b1f1b', height: 46 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false },
  });
  if (b.maximized) mainWin.maximize();
  mainWin.loadURL(origin + '/');
  mainWin.once('ready-to-show', () => { if (showNow) mainWin.show(); });
  mainWin.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  mainWin.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(origin)) { e.preventDefault(); shell.openExternal(url); } });
  const saveBounds = () => { if (!mainWin || mainWin.isMinimized()) return; db.setSetting('bounds', { ...mainWin.getNormalBounds(), maximized: mainWin.isMaximized() }); };
  mainWin.on('resized', saveBounds); mainWin.on('moved', saveBounds); mainWin.on('maximize', saveBounds); mainWin.on('unmaximize', saveBounds);
  mainWin.on('close', e => {
    if (!quitting && db.getSettings().closeToTray !== false) {
      e.preventDefault(); mainWin.hide();
      if (!db.getSettings().trayHintShown && tray && IS_WIN) {
        tray.displayBalloon({ title: 'Meow Hearing vẫn đang phát', content: 'App đã thu xuống khay hệ thống. Bấm biểu tượng mèo để mở lại.', iconType: 'info' });
        db.setSetting('trayHintShown', true);
      }
    }
  });
  mainWin.on('closed', () => { mainWin = null; });
  setThumbar();
  if (adblock) adblock.attach(mainWin.webContents);
}

function showMain() {
  if (!mainWin) return createMain(true);
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show(); mainWin.focus();
}
function toggleMain() {
  if (mainWin && mainWin.isVisible() && mainWin.isFocused()) mainWin.hide(); else showMain();
}

function openMini() {
  if (miniWin) { miniWin.show(); return; }
  const s = db.getSettings();
  const wa = screen.getPrimaryDisplay().workArea;
  const pos = s.miniPos || { x: wa.x + wa.width - 360, y: wa.y + wa.height - 140 };
  miniWin = new BrowserWindow({
    width: 340, height: 116, x: pos.x, y: pos.y, frame: false, resizable: false, maximizable: false, minimizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, transparent: false, backgroundColor: s.skinDark ? '#1f1c22' : '#fffbf9',
    icon: icon('icon.png'), title: 'Meow Hearing Mini',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  miniWin.setAlwaysOnTop(true, 'floating');
  miniWin.loadURL(origin + '/#mini');
  miniWin.once('ready-to-show', () => { miniWin.show(); miniWin.webContents.send('player:state', lastState); });
  miniWin.on('moved', () => { const [x, y] = miniWin.getPosition(); db.setSetting('miniPos', { x, y }); });
  miniWin.on('closed', () => { miniWin = null; });
  if (mainWin) mainWin.hide();
}
function closeMini(expand) { if (miniWin) miniWin.close(); if (expand) showMain(); }

// ---------- khay hệ thống + nút trên taskbar ----------
function buildTray() {
  tray = new Tray(icon(IS_WIN ? 'tray.ico' : 'tray.png'));
  tray.setToolTip('Meow Hearing');
  tray.on('click', () => toggleMain());
  updateTrayMenu();
}
function updateTrayMenu() {
  if (!tray) return;
  const t = lastState.track;
  tray.setToolTip(t ? `Meow Hearing\n${t.title}`.slice(0, 127) : 'Meow Hearing');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: t ? `♪ ${t.title}`.slice(0, 60) : 'Chưa phát bài nào', enabled: false },
    { type: 'separator' },
    { label: lastState.playing ? 'Tạm dừng' : 'Phát', click: () => cmd('toggle') },
    { label: 'Bài sau', click: () => cmd('next') },
    { label: 'Bài trước', click: () => cmd('prev') },
    { type: 'separator' },
    { label: 'Mở Meow Hearing', click: () => { closeMini(); showMain(); } },
    { label: 'Mini player', click: () => openMini() },
    { type: 'separator' },
    { label: 'Thoát', click: () => { quitting = true; app.quit(); } },
  ]));
}
function setThumbar() {
  if (!IS_WIN || !mainWin) return;
  try {
    mainWin.setThumbarButtons([
      { tooltip: 'Bài trước', icon: icon('prev.png'), click: () => cmd('prev') },
      { tooltip: lastState.playing ? 'Tạm dừng' : 'Phát', icon: icon(lastState.playing ? 'pause.png' : 'play.png'), click: () => cmd('toggle') },
      { tooltip: 'Bài sau', icon: icon('next.png'), click: () => cmd('next') },
    ]);
  } catch (_) {}
}

function cmd(c, arg) { if (mainWin) mainWin.webContents.send('player:cmd', c, arg); }

// ---------- phím tắt ----------
function registerShortcuts() {
  globalShortcut.unregisterAll();
  const s = db.getSettings();
  hotkey = s.hotkey || 'Control+Alt+Space';
  try { globalShortcut.register(hotkey, toggleMain); } catch (_) {}
  for (const [k, c] of [['MediaPlayPause', 'toggle'], ['MediaNextTrack', 'next'], ['MediaPreviousTrack', 'prev'], ['MediaStop', 'pause']]) {
    try { globalShortcut.register(k, () => cmd(c)); } catch (_) {}
  }
}

// ---------- IPC ----------
const DB_METHODS = ['listPlaylists', 'createPlaylist', 'renamePlaylist', 'deletePlaylist', 'playlistTracks', 'addToPlaylist', 'removeFromPlaylist', 'reorderPlaylist', 'likedIds', 'likedTracks', 'toggleLike', 'addLikes', 'addHistory', 'history', 'recentUnique', 'clearHistory', 'clearCache', 'stats', 'upsertTrack'];
const API_METHODS = ['search', 'trending', 'playlist', 'video', 'lyrics', 'testKey', 'me', 'myPlaylists', 'myPlaylist', 'myLiked'];

function setupIpc() {
  ipcMain.handle('db', (_e, method, ...args) => {
    if (!DB_METHODS.includes(method)) throw new Error('bad method');
    return db[method](...args);
  });
  ipcMain.handle('api', async (_e, method, arg) => {
    if (!API_METHODS.includes(method)) throw new Error('bad method');
    try { return { ok: true, data: await api[method](arg) }; }
    catch (e) { return { ok: false, code: e.code || 'error', message: e.message || String(e) }; }
  });
  ipcMain.handle('settings:get', () => db.getSettings());
  ipcMain.handle('auth:status', () => ({ loggedIn: auth.loggedIn(), hasClient: auth.hasClient(), profile: db.getSettings().profile || null }));
  ipcMain.handle('auth:login', async () => {
    try { await auth.login(); let profile = null; try { profile = await api.me(); } catch (_) {} if (mainWin) { showMain(); } return { ok: true, profile }; }
    catch (e) { return { ok: false, code: e.code || 'error', message: e.message }; }
  });
  ipcMain.handle('auth:logout', async () => { await auth.logout(); return true; });
  ipcMain.handle('adblock:stats', () => adblock.stats());
  ipcMain.on('yt', (_e, c, ...a) => ytview.cmd(c, ...a));
  ipcMain.on('yt:bounds', (_e, b) => ytview.setBounds(b));
  ipcMain.on('yt:visible', (_e, v) => ytview.setVisible(v));
  ipcMain.handle('yt:status', () => ytview.status());
  ipcMain.handle('yt:captions', (_e, id, allowAuto) => ytview.captions(id, allowAuto));
  ipcMain.handle('yt:stats', () => ytview.stats());
  ipcMain.handle('yt:login', async () => {
    if (!blogin) blogin = new BrowserLogin(app.getPath('userData'), session.fromPartition(PARTITION));
    let r;
    if (blogin.available()) {
      r = await blogin.run(st => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('yt:loginStatus', st); });
    } else {
      const ok = await ytview.login(mainWin); // không tìm thấy trình duyệt nào: dùng cửa sổ trong app
      r = { ok, code: ok ? 'ok' : 'closed', browser: null };
    }
    let profile = null; if (r.ok) { try { profile = await api.me(); } catch (_) {} db.clearCache(); }
    if (mainWin) { mainWin.show(); mainWin.focus(); }
    return { ...r, profile };
  });
  ipcMain.on('yt:loginCancel', () => { if (blogin) blogin.cancel(); });
  ipcMain.on('yt:loginDone', () => { if (blogin) blogin.done(); });
  ipcMain.handle('yt:logout', async () => { await ytview.logout(); db.setSetting('profile', null); db.clearCache(); return true; });
  ipcMain.on('win:hide', () => { if (mainWin) mainWin.hide(); });
  ipcMain.handle('settings:set', (_e, key, value) => {
    db.setSetting(key, value);
    if (key === 'hotkey') registerShortcuts();
    if (key === 'openAtLogin') app.setLoginItemSettings({ openAtLogin: !!value, args: ['--hidden'] });
    if (key === 'adBlock') adblock.apply();
    return db.getSettings();
  });
  ipcMain.handle('hotkey:test', (_e, acc) => {
    globalShortcut.unregister(hotkey);
    let ok = false; try { ok = globalShortcut.register(acc, toggleMain); } catch (_) {}
    if (ok) { globalShortcut.unregister(acc); }
    try { globalShortcut.register(hotkey, toggleMain); } catch (_) {}
    return ok;
  });
  ipcMain.on('win:theme', (_e, t) => {
    db.setSetting('skinDark', !!t.dark);
    if (mainWin && IS_WIN) { try { mainWin.setTitleBarOverlay({ color: '#00000000', symbolColor: t.fg, height: 46 }); } catch (_) {} }
    if (mainWin) mainWin.setBackgroundColor(t.bg);
    if (miniWin) miniWin.webContents.send('theme', t);
  });
  ipcMain.on('player:state', (_e, st) => {
    const changed = !lastState.track || !st.track || lastState.track.id !== st.track.id || lastState.playing !== st.playing;
    lastState = st;
    if (miniWin) miniWin.webContents.send('player:state', st);
    if (changed) { updateTrayMenu(); setThumbar(); if (mainWin) mainWin.setTitle(st.track ? `${st.track.title} · Meow Hearing` : 'Meow Hearing'); }
  });
  ipcMain.on('player:cmd', (_e, c, arg) => cmd(c, arg));
  ipcMain.on('mini:open', () => openMini());
  ipcMain.on('mini:close', (_e, expand) => closeMini(expand));
  ipcMain.handle('mini:theme', () => db.getSettings().skinTheme || null);
  ipcMain.on('mini:themeSave', (_e, t) => db.setSetting('skinTheme', t));
  ipcMain.on('open:external', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataDir: app.getPath('userData'), platform: process.platform }));
  ipcMain.handle('app:metrics', () => Math.round(app.getAppMetrics().reduce((s, m) => s + (m.memory ? m.memory.workingSetSize : 0), 0) / 1024));
  ipcMain.handle('app:export', async () => {
    const r = await dialog.showSaveDialog(mainWin, { title: 'Xuất thư viện', defaultPath: `MeowHearing-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, JSON.stringify(db.exportJSON(), null, 2), 'utf8'); return r.filePath;
  });
  ipcMain.handle('app:import', async () => {
    const r = await dialog.showOpenDialog(mainWin, { title: 'Nhập thư viện', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    try { return { ok: true, count: db.importJSON(JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'))) }; }
    catch (e) { return { ok: false, message: e.message }; }
  });
  ipcMain.on('app:openData', () => shell.openPath(app.getPath('userData')));
  ipcMain.on('app:quit', () => { quitting = true; app.quit(); });
}

// ---------- khởi động ----------
app.on('second-instance', () => { closeMini(); showMain(); });
app.on('before-quit', () => { quitting = true; if (db) db.flush(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { if (quitting) app.quit(); });

app.whenReady().then(async () => {
  db = new DB(path.join(app.getPath('userData'), 'meow.db'));
  await db.open();
  auth = new Auth(db);
  api = new Api(db, auth, new InnerTube(session.fromPartition(PARTITION)));
  adblock = new AdBlock([session.defaultSession, session.fromPartition(PARTITION)], () => db.getSettings().adBlock === true);
  ytview = new YtView(() => mainWin, (ch, data) => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(ch, data); }, adblock);
  await startServer();
  // Trình phát YouTube cần biết trang nhúng đến từ đâu
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://www.youtube.com/embed/*', 'https://www.youtube-nocookie.com/embed/*'] }, (d, cb) => {
    if (!d.requestHeaders.Referer) d.requestHeaders.Referer = origin + '/';
    cb({ requestHeaders: d.requestHeaders });
  });
  setupIpc();
  buildTray();
  registerShortcuts();
  createMain(!process.argv.includes('--hidden'));
});
