// Đăng nhập tài khoản Google/YouTube theo chuẩn OAuth 2.0 cho ứng dụng desktop
// (mở trình duyệt mặc định + PKCE + redirect về 127.0.0.1). Mật khẩu không đi qua app.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { net, shell, safeStorage } = require('electron');

const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

class AuthError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

function bundledClient() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'oauth.json'), 'utf8')); } catch { return {}; }
}

const PAGE = (title, body, ok) => `<!doctype html><meta charset="utf-8"><title>Meow Hearing</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;font-family:'Segoe UI',system-ui,sans-serif;background:#f7f1ef;color:#2b1f1b">
<div style="text-align:center;max-width:420px;padding:32px;background:#fff;border-radius:18px;box-shadow:0 20px 60px -30px rgba(60,40,40,.5)">
<div style="font-size:44px">${ok ? '🐾' : '😿'}</div><h2 style="margin:8px 0">${title}</h2><p style="color:#7a6862">${body}</p>
<p style="font-size:12px;color:#7a6862;margin-top:20px">Meow Hearing · Phát triển bởi CatMeow Team</p></div></body>`;

class Auth {
  constructor(db) { this.db = db; this.pending = null; this.cache = null; }

  client() {
    const s = this.db.getSettings(); const b = bundledClient();
    return { id: (s.oauthClientId || b.clientId || '').trim(), secret: (s.oauthClientSecret || b.clientSecret || '').trim() };
  }
  hasClient() { return !!this.client().id; }

  load() {
    if (this.cache) return this.cache;
    const o = this.db.getSettings().oauth; if (!o) return null;
    try {
      const raw = o.enc ? safeStorage.decryptString(Buffer.from(o.data, 'base64')) : o.data;
      this.cache = JSON.parse(raw); return this.cache;
    } catch { return null; }
  }
  store(tok) {
    this.cache = tok;
    if (!tok) { this.db.setSetting('oauth', null); return; }
    const raw = JSON.stringify(tok);
    if (safeStorage.isEncryptionAvailable()) this.db.setSetting('oauth', { enc: true, data: safeStorage.encryptString(raw).toString('base64') });
    else this.db.setSetting('oauth', { enc: false, data: raw });
  }
  loggedIn() { const t = this.load(); return !!(t && t.refresh_token); }

  async post(url, params) {
    let res;
    try { res = await net.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() }); }
    catch { throw new AuthError('network', 'Không kết nối được tới Google.'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === 'invalid_grant') throw new AuthError('expired', 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.');
      if (data.error === 'invalid_client' || data.error === 'unauthorized_client') throw new AuthError('client', 'OAuth Client ID / Secret không đúng. Kiểm tra lại trong Cài đặt.');
      throw new AuthError('http', data.error_description || data.error || `Lỗi đăng nhập (${res.status})`);
    }
    return data;
  }

  async getToken(force) {
    const t = this.load(); if (!t || !t.refresh_token) return null;
    if (!force && t.access_token && t.expiry > Date.now() + 60000) return t.access_token;
    const c = this.client();
    try {
      const d = await this.post('https://oauth2.googleapis.com/token', { client_id: c.id, client_secret: c.secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' });
      this.store({ ...t, access_token: d.access_token, expiry: Date.now() + (d.expires_in || 3600) * 1000 });
      return d.access_token;
    } catch (e) { if (e.code === 'expired') { this.store(null); this.db.setSetting('profile', null); } throw e; }
  }

  login() {
    if (this.pending) { shell.openExternal(this.pending.url); return this.pending.promise; }
    const c = this.client();
    if (!c.id) return Promise.reject(new AuthError('noclient', 'Chưa cấu hình OAuth Client ID. Xem hướng dẫn trong Cài đặt → Tài khoản YouTube.'));
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(16));
    let server, timer;
    const promise = new Promise((resolve, reject) => {
      const done = (err, val) => { clearTimeout(timer); setTimeout(() => server && server.close(), 500); this.pending = null; err ? reject(err) : resolve(val); };
      server = http.createServer(async (req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname !== '/callback') { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (u.searchParams.get('state') !== state) { res.end(PAGE('Không hợp lệ', 'Yêu cầu đăng nhập không khớp. Hãy thử lại từ Meow Hearing.', false)); return done(new AuthError('state', 'Yêu cầu đăng nhập không khớp, thử lại.')); }
        if (u.searchParams.get('error')) { res.end(PAGE('Đã huỷ đăng nhập', 'Bạn có thể đóng tab này.', false)); return done(new AuthError('cancel', 'Đã huỷ đăng nhập.')); }
        try {
          const d = await this.post('https://oauth2.googleapis.com/token', {
            client_id: c.id, client_secret: c.secret, code: u.searchParams.get('code'), code_verifier: verifier,
            grant_type: 'authorization_code', redirect_uri: redirect,
          });
          this.store({ refresh_token: d.refresh_token, access_token: d.access_token, expiry: Date.now() + (d.expires_in || 3600) * 1000, scope: d.scope });
          res.end(PAGE('Đăng nhập thành công', 'Quay lại Meow Hearing để nghe tiếp nhé. Bạn có thể đóng tab này.', true));
          done(null, true);
        } catch (e) { res.end(PAGE('Đăng nhập lỗi', e.message, false)); done(e); }
      });
      let redirect;
      server.listen(0, '127.0.0.1', () => {
        redirect = `http://127.0.0.1:${server.address().port}/callback`;
        const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
          client_id: c.id, redirect_uri: redirect, response_type: 'code', scope: SCOPE, code_challenge: challenge,
          code_challenge_method: 'S256', state, access_type: 'offline', prompt: 'consent select_account',
        });
        this.pending.url = url;
        shell.openExternal(url);
      });
      timer = setTimeout(() => done(new AuthError('timeout', 'Hết thời gian chờ đăng nhập (5 phút). Thử lại nhé.')), 5 * 60000);
    });
    this.pending = { promise, url: null };
    return promise;
  }

  cancel() { /* đóng theo timeout; giữ đơn giản */ }

  async logout() {
    const t = this.load();
    this.store(null); this.db.setSetting('profile', null);
    if (t && (t.refresh_token || t.access_token)) {
      try { await net.fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'token=' + encodeURIComponent(t.refresh_token || t.access_token) }); } catch {}
    }
  }
}

module.exports = { Auth, AuthError };
