// Đăng nhập YouTube bằng trình duyệt THẬT trên máy (Chrome / Edge / Cốc Cốc / Brave) với một hồ sơ riêng tạm thời.
// Google chỉ chặn đăng nhập trong cửa sổ nhúng của app; trình duyệt thật thì đăng nhập bình thường.
// Trong lúc đăng nhập app KHÔNG điều khiển trang, chỉ hỏi danh sách tab qua HTTP. Khi đã về youtube.com,
// app lấy cookie YouTube/Google của hồ sơ tạm đó, đưa vào phiên trình phát, rồi đóng trình duyệt và xoá hồ sơ tạm.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const LOGIN_URL = 'https://accounts.google.com/ServiceLogin?service=youtube&continue=' + encodeURIComponent('https://www.youtube.com/signin?action_handle_signin=true&next=%2F');

function findBrowser() {
  if (process.env.MEOW_BROWSER) return { name: 'Test', exe: process.env.MEOW_BROWSER };
  const env = process.env;
  const roots = { pf: env.ProgramFiles || 'C:\\Program Files', pf86: env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', local: env.LOCALAPPDATA || '' };
  const cands = [
    ['Google Chrome', [roots.pf, 'Google\\Chrome\\Application\\chrome.exe'], [roots.pf86, 'Google\\Chrome\\Application\\chrome.exe'], [roots.local, 'Google\\Chrome\\Application\\chrome.exe']],
    ['Microsoft Edge', [roots.pf86, 'Microsoft\\Edge\\Application\\msedge.exe'], [roots.pf, 'Microsoft\\Edge\\Application\\msedge.exe']],
    ['Cốc Cốc', [roots.local, 'CocCoc\\Browser\\Application\\browser.exe'], [roots.pf, 'CocCoc\\Browser\\Application\\browser.exe'], [roots.pf86, 'CocCoc\\Browser\\Application\\browser.exe']],
    ['Brave', [roots.pf, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'], [roots.local, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe']],
  ];
  for (const [name, ...paths] of cands) for (const [r, p] of paths) { if (!r) continue; const f = path.join(r, p); if (fs.existsSync(f)) return { name, exe: f }; }
  return null;
}

const getJSON = (port, p) => new Promise((res, rej) => {
  const req = http.get({ host: '127.0.0.1', port, path: p, timeout: 3000 }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
  req.on('error', rej); req.on('timeout', () => req.destroy(new Error('timeout')));
});

function cdp(wsUrl, method, params = {}) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
    const t = setTimeout(() => { try { ws.terminate(); } catch (_) {} rej(new Error('cdp timeout')); }, 8000);
    ws.on('open', () => ws.send(JSON.stringify({ id: 1, method, params })));
    ws.on('message', m => { const d = JSON.parse(m.toString()); if (d.id === 1) { clearTimeout(t); ws.close(); d.error ? rej(new Error(d.error.message)) : res(d.result); } });
    ws.on('error', e => { clearTimeout(t); rej(e); });
  });
}

const sameSite = s => ({ Strict: 'strict', Lax: 'lax', None: 'no_restriction' }[s] || 'unspecified');

class BrowserLogin {
  constructor(dataDir, sess) { this.dir = path.join(dataDir, 'login-browser'); this.sess = sess; this.proc = null; this.cancelled = false; }
  available() { return !!findBrowser(); }

  cancel() { this.cancelled = true; this.closeGracefully(); }
  done() { this.closeGracefully(); } // người dùng bấm "Xong" trong app

  // Đóng nhẹ nhàng (như bấm ✕) để trình duyệt kịp lưu cookie đăng nhập
  closeGracefully() {
    const p = this.proc; if (!p || p.exitCode !== null) return;
    if (process.platform === 'win32') { try { spawn('taskkill', ['/PID', String(p.pid)], { stdio: 'ignore', windowsHide: true }); } catch (_) {} }
    else { try { p.kill('SIGTERM'); } catch (_) {} }
    setTimeout(() => { if (p.exitCode === null) { try { p.kill(); } catch (_) {} } }, 8000);
  }

  async run(onStatus) {
    const b = findBrowser(); if (!b) return { ok: false, code: 'nobrowser' };
    this.cancelled = false;
    try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch (_) {}
    fs.mkdirSync(this.dir, { recursive: true });

    // Bước 1: mở trình duyệt hoàn toàn bình thường (không bật cổng điều khiển) để Google không nghi ngờ
    const proc = this.proc = spawn(b.exe, [
      `--user-data-dir=${this.dir}`, '--no-first-run', '--no-default-browser-check', '--disable-sync',
      '--new-window', process.env.MEOW_LOGIN_URL || LOGIN_URL, ...(process.env.MEOW_BROWSER ? ['--headless=new', '--no-sandbox'] : []),
    ], { detached: false, stdio: 'ignore' });
    onStatus && onStatus({ step: 'opened', browser: b.name });
    const exited = new Promise(r => proc.on('exit', r));
    const timeout = new Promise(r => setTimeout(() => r('timeout'), 15 * 60000));
    const why = await Promise.race([exited, timeout]);
    if (why === 'timeout') this.closeGracefully();
    this.proc = null;
    if (this.cancelled) { this.cleanupLater(); return { ok: false, code: 'cancel', browser: b.name }; }
    onStatus && onStatus({ step: 'reading', browser: b.name });
    await new Promise(r => setTimeout(r, 1200));

    // Bước 2: mở lại đúng hồ sơ đó ở chế độ chạy ngầm để đọc cookie đăng nhập YouTube
    let result = { ok: false, code: 'nologin', browser: b.name };
    const bg = spawn(b.exe, [`--user-data-dir=${this.dir}`, '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--disable-gpu',
      ...(process.env.MEOW_BROWSER ? ['--no-sandbox'] : []), 'about:blank'], { stdio: 'ignore', windowsHide: true });
    let bgExited = false; bg.on('exit', () => { bgExited = true; });
    try {
      let port = 0;
      try { fs.unlinkSync(path.join(this.dir, 'DevToolsActivePort')); } catch (_) {}
      for (let i = 0; i < 40 && !port && !bgExited; i++) {
        try { port = +fs.readFileSync(path.join(this.dir, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0]; } catch (_) {}
        if (!port) await new Promise(r => setTimeout(r, 300));
      }
      if (port) {
        const ver = await getJSON(port, '/json/version');
        const { cookies } = await cdp(ver.webSocketDebuggerUrl, 'Storage.getCookies');
        const yt = (cookies || []).filter(c => /(^|\.)youtube\.com$|(^|\.)google\.com(\.vn)?$/.test(c.domain) || process.env.MEOW_BROWSER);
        const logged = yt.some(c => /^(SAPISID|__Secure-3PAPISID|__Secure-3PSID|LOGIN_INFO)$/.test(c.name) && (/youtube\.com$/.test(c.domain) || process.env.MEOW_BROWSER));
        if (logged) {
          let n = 0;
          for (const c of yt) {
            const host = c.domain.replace(/^\./, '');
            try {
              await this.sess.cookies.set({ url: `https://${host}${c.path || '/'}`, name: c.name, value: c.value, domain: c.domain.startsWith('.') ? c.domain : undefined,
                path: c.path || '/', secure: !!c.secure, httpOnly: !!c.httpOnly, sameSite: sameSite(c.sameSite), ...(c.expires && c.expires > 0 ? { expirationDate: c.expires } : {}) });
              n++;
            } catch (_) {}
          }
          await this.sess.cookies.flushStore().catch(() => {});
          result = { ok: n > 0, code: n > 0 ? 'ok' : 'nocookie', browser: b.name };
        }
        try { await cdp(ver.webSocketDebuggerUrl, 'Browser.close'); } catch (_) {}
      } else result = { ok: false, code: 'noport', browser: b.name };
    } catch (_) { result = { ok: false, code: 'read', browser: b.name }; }
    if (!bgExited) setTimeout(() => { try { bg.kill(); } catch (_) {} }, 1500);
    this.cleanupLater();
    return result;
  }

  cleanupLater() { setTimeout(() => { try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch (_) {} }, 3000); }
}

module.exports = { BrowserLogin, findBrowser };
