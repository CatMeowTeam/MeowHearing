// Trình phát: mở trực tiếp trang youtube.com/watch trong một khung riêng (WebContentsView),
// chỉ hiện phần video ở ô "Đang phát". Không bị giới hạn "không cho nhúng" như iframe.
const { WebContentsView, BrowserWindow, session, shell } = require('electron');
const path = require('path');
const LOGIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';

const PARTITION = 'persist:youtube';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const CSS = `
html,body{overflow:hidden!important;background:#000!important}
#masthead-container,ytd-masthead,#secondary,#below,#comments,#related,tp-yt-app-drawer,ytd-mini-guide-renderer,
ytd-popup-container,tp-yt-iron-overlay-backdrop,ytd-consent-bump-v2-lightbox,#chat,ytd-engagement-panel-section-list-renderer{display:none!important}
#movie_player{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:2147483646!important;background:#000!important}
#movie_player .html5-video-container,#movie_player video{width:100vw!important;height:100vh!important;left:0!important;top:0!important;object-fit:contain!important}
.ytp-chrome-top,.ytp-gradient-top,.ytp-pause-overlay,.ytp-endscreen-content,.ytp-ce-element,.ytp-paid-content-overlay,
.ytp-cards-teaser,.ytp-autonav-endscreen,.ytp-suggested-action,.iv-branding,.ytp-contextmenu{display:none!important}
.ytp-chrome-bottom{opacity:0!important;pointer-events:none!important}
.ytp-gradient-bottom{display:none!important}
`;

// Chạy trong trang YouTube: cầu nối điều khiển #movie_player
const BRIDGE = `(() => {
  if (window.__meow) return true;
  const P = () => document.getElementById('movie_player');
  const noAutonav = () => { const b = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]'); if (b) b.click(); };
  window.__meow = {
    load(id, start, auto) {
      const p = P(); if (!p || !p.loadVideoById) return false;
      if (auto) p.loadVideoById({ videoId: id, startSeconds: start || 0 }); else p.cueVideoById({ videoId: id, startSeconds: start || 0 });
      setTimeout(noAutonav, 1500); return true;
    },
    state() {
      const p = P(); if (!p || !p.getPlayerState) return null;
      const d = p.getVideoData ? p.getVideoData() : {};
      let ps = null; try { const r = p.getPlayerResponse && p.getPlayerResponse(); ps = r && r.playabilityStatus && r.playabilityStatus.status; } catch (_) {}
      const errEl = document.querySelector('.ytp-error');
      const errShown = !!(errEl && errEl.offsetParent !== null);
      return { id: d.video_id || null, st: p.getPlayerState(), t: p.getCurrentTime() || 0, d: p.getDuration() || 0,
        ps, err: errShown || (ps && ps !== 'OK' && ps !== 'LIVE_STREAM_OFFLINE' ? ps : null), ad: p.classList.contains('ad-showing') };
    },
    async captions(id, allowAuto) {
      const p = P(); if (!p || !p.getPlayerResponse) return null;
      const r = p.getPlayerResponse(); if (!r || !r.videoDetails || r.videoDetails.videoId !== id) return null;
      const list = ((r.captions && r.captions.playerCaptionsTracklistRenderer && r.captions.playerCaptionsTracklistRenderer.captionTracks) || []).filter(t => allowAuto || t.kind !== 'asr');
      if (!list.length) return { none: true };
      const score = t => (t.kind === 'asr' ? 10 : 0) + (/^vi/.test(t.languageCode) ? 0 : /^en/.test(t.languageCode) ? 2 : 4);
      const tr = list.slice().sort((a, b) => score(a) - score(b))[0];
      try {
        const res = await fetch(tr.baseUrl + (tr.baseUrl.includes('fmt=') ? '' : '&fmt=json3'), { credentials: 'include' });
        const txt = await res.text(); if (!txt) return null;
        const j = JSON.parse(txt);
        const lines = (j.events || []).filter(e => e.segs && !e.aAppend).map(e => ({ t: (e.tStartMs || 0) / 1000, text: e.segs.map(x => x.utf8 || '').join('').replace(/\\n/g, ' ').trim() })).filter(l => l.text);
        return lines.length ? { lines, lang: tr.languageCode, auto: tr.kind === 'asr' } : null;
      } catch (_) { return null; }
    },
    // ---- âm thanh & chất lượng video ----
    cfg: { q: 'auto', normOff: true, vol: 80, muted: false, eq: null },
    setCfg(c) { Object.assign(this.cfg, c || {}); this.apply(); return true; },
    wire(v) {
      try {
        const ctx = this.ctx || (this.ctx = new AudioContext());
        const src = ctx.createMediaElementSource(v);
        const pre = ctx.createGain();
        const freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        const bands = freqs.map((f, i) => { const b = ctx.createBiquadFilter(); b.type = i === 0 ? 'lowshelf' : i === freqs.length - 1 ? 'highshelf' : 'peaking'; b.frequency.value = f; b.Q.value = 1.1; b.gain.value = 0; return b; });
        const lim = ctx.createDynamicsCompressor();
        lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.25;
        let n = src.connect(pre); for (const b of bands) n = n.connect(b); n.connect(lim).connect(ctx.destination);
        v.__meowAudio = { pre, bands };
      } catch (e) { v.__meowAudio = { failed: true }; }
    },
    apply() {
      const p = P(); if (!p) return;
      const v = p.querySelector('video');
      const c = this.cfg;
      try { // chất lượng video (tiếng tải riêng nên không bị ảnh hưởng)
        if (c.q && c.q !== 'auto') { if (p.getPlaybackQuality && p.getPlaybackQuality() !== c.q) { p.setPlaybackQualityRange && p.setPlaybackQualityRange(c.q, c.q); p.setPlaybackQuality && p.setPlaybackQuality(c.q); } }
        else if (this._q && this._q !== 'auto') { p.setPlaybackQualityRange && p.setPlaybackQualityRange('auto', 'auto'); }
        this._q = c.q;
      } catch (_) {}
      if (!v) return;
      if (c.eq && c.eq.on && !v.__meowAudio) this.wire(v);
      const a = v.__meowAudio;
      if (a && !a.failed) {
        const on = c.eq && c.eq.on; const g = (on && c.eq.gains) || [];
        a.bands.forEach((b, i) => { b.gain.value = on ? (+g[i] || 0) : 0; });
        a.pre.gain.value = on ? Math.pow(10, (+c.eq.pre || 0) / 20) : 1;
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      }
      if (!v.__meowVol) { v.__meowVol = true; v.addEventListener('volumechange', () => this.fixVol(v)); }
      this.fixVol(v);
    },
    fixVol(v) { // âm lượng gốc: bỏ phần YouTube tự giảm âm lượng bài to
      const c = this.cfg; if (!c.normOff || c.muted) return;
      const want = Math.max(0, Math.min(1, c.vol / 100));
      if (Math.abs(v.volume - want) > 0.01) v.volume = want;
    },
    stats() {
      const p = P(); if (!p) return null;
      let s = {}; try { s = (p.getStatsForNerds && p.getStatsForNerds()) || {}; } catch (_) {}
      let fmt = null; try { const r = p.getPlayerResponse(); const f = (r.streamingData && r.streamingData.adaptiveFormats) || []; const aud = f.filter(x => /^audio/.test(x.mimeType)).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]; if (aud) fmt = { mime: aud.mimeType, kbps: Math.round((aud.averageBitrate || aud.bitrate || 0) / 1000), rate: aud.audioSampleRate, itag: aud.itag }; } catch (_) {}
      return { codecs: s.codecs || null, res: s.resolution || (p.getPlaybackQuality && p.getPlaybackQuality()) || null, best: fmt, loud: (() => { try { return p.getPlayerResponse().playerConfig.audioConfig.loudnessDb; } catch (_) { return null; } })() };
    },
    play() { const p = P(); p && p.playVideo(); }, pause() { const p = P(); p && p.pauseVideo(); },
    seek(s) { const p = P(); p && p.seekTo(s, true); },
    volume(v) { const p = P(); if (p) { p.unMute(); p.setVolume(v); } },
    mute(m) { const p = P(); if (p) m ? p.mute() : p.unMute(); },
  };
  noAutonav();
  setInterval(() => { try { window.__meow.apply(); } catch (_) {} }, 1500);
  return true;
})()`;

class YtView {
  constructor(getWin, send, adblock) {
    this.getWin = getWin; this.send = send; this.adblock = adblock;
    this.view = null; this.bounds = { x: 0, y: 0, width: 0, height: 0 }; this.visible = false;
    this.want = null; this.loadingPage = false; this.timer = null; this.volume = 80; this.muted = false;
    this.cfg = {}; this.hidden = true;
    this.sess = session.fromPartition(PARTITION);
    this.sess.setUserAgent(UA);
    this.loginWc = null;
    // Cửa sổ đăng nhập: gửi header như trình duyệt Firefox thường để Google không chặn
    this.sess.webRequest.onBeforeSendHeaders((d, cb) => {
      if (this.loginWc && d.webContentsId === this.loginWc) {
        const h = d.requestHeaders; h['User-Agent'] = LOGIN_UA;
        for (const k of Object.keys(h)) if (/^sec-ch-ua/i.test(k)) delete h[k];
        return cb({ requestHeaders: h });
      }
      cb({ requestHeaders: d.requestHeaders });
    });
  }

  ensure() {
    const win = this.getWin(); if (!win) return null;
    if (this.view && !this.view.webContents.isDestroyed()) {
      if (this.host !== win) { try { win.contentView.addChildView(this.view); } catch (_) {} this.host = win; }
      return this.view;
    }
    this.view = new WebContentsView({ webPreferences: { partition: PARTITION, backgroundThrottling: false, contextIsolation: true, sandbox: true, autoplayPolicy: 'no-user-gesture-required' } });
    this.view.setBackgroundColor('#000000');
    const wc = this.view.webContents;
    wc.setUserAgent(UA);
    wc.setAudioMuted(false);
    wc.setWindowOpenHandler(({ url }) => { if (/^https:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
    wc.on('will-navigate', (e, url) => { if (!/^https:\/\/(www\.|m\.)?youtube\.com\//.test(url)) { e.preventDefault(); } });
    wc.on('dom-ready', () => { wc.insertCSS(CSS).catch(() => {}); wc.executeJavaScript(BRIDGE).catch(() => {}); if (this.adblock) this.adblock.injectPage(wc); });
    wc.on('did-finish-load', () => { this.loadingPage = false; this.afterLoad(); });
    wc.on('did-fail-load', (_e, code, _d, _u, isMain) => {
      if (!isMain || code === -3) return; // -3: bị huỷ do chuyển trang
      this.loadingPage = false; this.send('yt:state', { id: this.want, want: this.want, err: 'NETWORK' });
    });
    wc.on('render-process-gone', () => { try { this.host && this.host.contentView.removeChildView(this.view); } catch (_) {} this.view = null; this.loadingPage = false; });
    win.contentView.addChildView(this.view); this.host = win;
    this.applyBounds();
    if (!this.timer) this.timer = setInterval(() => this.poll(), 300);
    return this.view;
  }

  async afterLoad() {
    const wc = this.view && this.view.webContents; if (!wc) return;
    for (let i = 0; i < 20; i++) { // chờ #movie_player sẵn sàng
      const ok = await wc.executeJavaScript(BRIDGE + ' && !!document.getElementById("movie_player") && !!document.getElementById("movie_player").getPlayerState').catch(() => false);
      if (ok) break; await new Promise(r => setTimeout(r, 300));
    }
    await this.exec(`__meow.volume(${this.volume})`); if (this.muted) await this.exec('__meow.mute(true)');
    await this.exec(`__meow.setCfg(${JSON.stringify(this.cfg)})`);
    if (!this.autoplay) await this.exec('__meow.pause()');
    wc.setAudioMuted(false);
  }

  exec(js) { const wc = this.view && this.view.webContents; if (!wc || wc.isDestroyed()) return Promise.resolve(null); return wc.executeJavaScript(`(window.__meow ? (${js}) : null)`).catch(() => null); }

  async load(id, start, autoplay) {
    this.want = id; this.autoplay = autoplay; this.wd = null;
    const v = this.ensure(); if (!v) return;
    const wc = v.webContents;
    const ok = !this.loadingPage && wc.getURL().includes('youtube.com/watch') ? await this.exec(`__meow.load(${JSON.stringify(id)}, ${+start || 0}, ${!!autoplay})`) : null;
    if (!ok) {
      this.loadingPage = true;
      wc.setAudioMuted(!autoplay);
      wc.loadURL(`https://www.youtube.com/watch?v=${encodeURIComponent(id)}${start ? '&t=' + Math.floor(start) + 's' : ''}`).catch(() => {});
    }
    this.setVisible(this.visibleWanted !== false);
  }

  async poll() {
    if (!this.view || this.loadingPage) return;
    const s = await this.exec('__meow.state()'); if (!s) return;
    this.send('yt:state', { ...s, want: this.want });
    this.watchdog(s);
  }

  // Chống đứng nhạc (nhẹ nhàng): chỉ gỡ khi thật sự kẹt, không tải lại dồn dập, không tự nhảy bài
  watchdog(s) {
    const now = Date.now();
    let w = this.wd;
    if (!w || w.id !== this.want) w = this.wd = { id: this.want, t: s.t, since: now, step: 0, started: false };
    if (s.id !== this.want) { w.since = now; return; }                 // trang chưa chuyển sang bài mới
    if (s.st === 1 && s.t > w.t + 0.05) { w.started = true; w.t = s.t; w.since = now; w.step = 0; return; } // đang chạy bình thường
    if (!this.autoplay || s.st === 2 || s.st === 0 || s.err) { w.t = s.t; w.since = now; w.step = 0; return; }
    if (s.t > w.t + 0.05) { w.t = s.t; w.since = now; return; }
    const idle = now - w.since;
    if (s.st === 3 && !s.ad && !w.started && idle < 10000) return;      // đang tải lần đầu: để YouTube tải, không phá
    if (w.step === 0 && idle > 2000) { w.step = 1; this.exec('__meow.play()'); }
    else if (w.step === 1 && idle > 4500) { w.step = 2; this.exec(`__meow.load(${JSON.stringify(this.want)}, ${Math.max(0, s.t - 0.3)}, true)`); }
    // sau 2 lần thử thì để yên; người dùng vẫn bấm được bài sau. Không tự nhảy bài.
  }

  cmd(c, ...a) {
    if (c === 'load') return this.load(a[0], a[1], a[2]);
    if (c === 'play') { this.autoplay = true; if (this.view) this.view.webContents.setAudioMuted(false); return this.exec('__meow.play()'); }
    if (c === 'pause') { this.autoplay = false; return this.exec('__meow.pause()'); }
    if (c === 'seek') return this.exec(`__meow.seek(${+a[0] || 0})`);
    if (c === 'volume') { this.volume = Math.round(+a[0]); this.muted = false; return this.exec(`__meow.volume(${this.volume})`); }
    if (c === 'mute') { this.muted = !!a[0]; return this.exec(`__meow.mute(${this.muted})`); }
    if (c === 'cfg') { this.cfg = { ...this.cfg, ...(a[0] || {}) }; return this.exec(`__meow.setCfg(${JSON.stringify(this.cfg)})`); }
    if (c === 'hidden') { this.hidden = !!a[0]; this.applyBounds(); return; }
  }

  async captions(id, allowAuto) { if (!this.view || this.want !== id || this.loadingPage) return null; return this.exec(`__meow.captions(${JSON.stringify(id)}, ${!!allowAuto})`); }
  async stats() { if (!this.view || this.loadingPage) return null; return this.exec('__meow.stats()'); }

  setBounds(b) { this.bounds = b; this.applyBounds(); }
  setVisible(v) { this.visibleWanted = v; this.applyBounds(); }
  applyBounds() {
    if (!this.view) return;
    const show = !this.hidden && this.visibleWanted !== false && this.want && this.bounds.width > 10 && this.bounds.height > 10;
    const w = Math.max(16, Math.round(this.bounds.width)), h = Math.max(9, Math.round(this.bounds.height));
    if (show) {
      this.view.setBounds({ x: Math.round(this.bounds.x), y: Math.round(this.bounds.y), width: w, height: h });
      this.view.setVisible(true);
    } else {
      // Windows đôi khi giữ lại khung hình cuối khi chỉ ẩn → đẩy khung video ra ngoài cửa sổ (giữ nguyên kích thước, nhạc vẫn chạy)
      this.view.setBounds({ x: -20000, y: -20000, width: w, height: h });
      this.view.setVisible(false);
    }
  }

  // ---- đăng nhập YouTube cho trình phát (dùng Premium / video giới hạn tuổi) ----
  async status() {
    const c = await this.sess.cookies.get({ domain: '.youtube.com' }).catch(() => []);
    return c.some(x => x.name === 'LOGIN_INFO' || x.name === 'SAPISID' || x.name === '__Secure-3PSID');
  }
  login(parent) {
    return new Promise(resolve => {
      const w = new BrowserWindow({ width: 500, height: 720, parent, title: 'Đăng nhập YouTube · Meow Hearing', autoHideMenuBar: true,
        webPreferences: { partition: PARTITION, contextIsolation: false, sandbox: false, nodeIntegration: false, preload: path.join(__dirname, 'login-preload.js') } });
      this.loginWc = w.webContents.id;
      w.webContents.setUserAgent(LOGIN_UA);
      w.webContents.setWindowOpenHandler(({ url }) => { w.loadURL(url); return { action: 'deny' }; });
      w.loadURL('https://accounts.google.com/ServiceLogin?service=youtube&continue=' + encodeURIComponent('https://www.youtube.com/signin?action_handle_signin=true&next=%2F'));
      const check = async (_e, url) => { if (/^https:\/\/www\.youtube\.com\/?(\?|$|#)/.test(url) || /^https:\/\/www\.youtube\.com\/(feed|$)/.test(url)) { if (await this.status()) { w.close(); } } };
      w.webContents.on('did-navigate', check);
      const iv = setInterval(async () => { if (!w.isDestroyed() && /youtube\.com/.test(w.webContents.getURL()) && await this.status()) w.close(); }, 1500);
      w.on('closed', async () => { clearInterval(iv); this.loginWc = null; resolve(await this.status()); });
    });
  }
  async logout() {
    await this.sess.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'] });
    if (this.view && this.want) this.view.webContents.reload();
    return false;
  }
}

module.exports = { YtView, PARTITION };
