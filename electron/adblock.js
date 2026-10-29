// Chặn quảng cáo trong trình phát YouTube nhúng (bật/tắt trong Cài đặt).
// Hai lớp: (1) chặn request tới máy chủ quảng cáo, (2) script trong khung player tự bỏ qua quảng cáo còn lọt.
const { webFrameMain } = require('electron');

// Không chặn qua mạng nữa: chặn request quảng cáo làm trình phát đứng chờ (gây kẹt / nhảy bài).
// Thay vào đó quảng cáo được tắt tiếng và tua qua ngay khi xuất hiện.
const PATTERNS = [];

// Chạy bên trong iframe youtube.com/embed
const SKIP_SCRIPT = `(() => {
  if (window.__meowAB) { window.__meowAB.on = true; return 'again'; }
  const st = window.__meowAB = { on: true, skipped: 0, muted: false, rate: 1 };
  const tick = () => {
    if (!st.on) return;
    const p = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
    const v = p ? p.querySelector('video') : document.querySelector('video');
    document.querySelectorAll('.ytp-ad-overlay-container,.ytp-ad-overlay-slot,.ytp-ad-image-overlay,.ytp-ad-message-container').forEach(e => e.style.display = 'none');
    const skip = document.querySelector('.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,button[class*="skip-ad"],button[id^="skip-button"]');
    if (skip) { skip.click(); }
    let main = 0; try { main = p && p.getDuration ? p.getDuration() : 0; } catch (_) {}
    const isAd = p && v && (p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting'))
      && !(main && isFinite(v.duration) && Math.abs(v.duration - main) < 1.5); // trùng độ dài bài chính thì không phải quảng cáo
    if (isAd) {
      if (!st.muted) { st.muted = true; st.wasMuted = v.muted; st.rate = v.playbackRate || 1; }
      v.muted = true;
      try { v.playbackRate = 16; } catch (_) {}
      if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.2) { v.currentTime = v.duration - 0.1; if (!st.lastAd || Date.now() - st.lastAd > 3000) st.skipped++; st.lastAd = Date.now(); }
    } else if (st.muted && v) {
      st.muted = false; v.muted = !!st.wasMuted; try { v.playbackRate = st.rate || 1; } catch (_) {}
    }
  };
  setInterval(tick, 300);
  new MutationObserver(tick).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
  return 'ok';
})()`;
const OFF_SCRIPT = `(() => { if (window.__meowAB) window.__meowAB.on = false; return 'off'; })()`;

class AdBlock {
  constructor(sessions, isOn) {
    this.isOn = isOn; this.blocked = 0; this.wcs = []; this.pages = [];
    for (const ses of PATTERNS.length ? sessions : []) {
      ses.webRequest.onBeforeRequest({ urls: PATTERNS }, (d, cb) => {
        if (this.isOn() && d.resourceType !== 'mainFrame') { this.blocked++; return cb({ cancel: true }); }
        cb({});
      });
    }
  }
  attach(webContents) { // trang chính (iframe nhúng nếu có)
    this.wcs.push(webContents);
    webContents.on('did-frame-finish-load', (_e, isMain, pid, rid) => {
      if (isMain) return;
      const f = webFrameMain.fromId(pid, rid);
      if (f && /youtube(-nocookie)?\.com\/embed/.test(f.url) && this.isOn()) f.executeJavaScript(SKIP_SCRIPT).catch(() => {});
    });
  }
  injectPage(wc) { // trang youtube.com/watch của trình phát
    if (!this.pages.includes(wc)) this.pages.push(wc);
    if (this.isOn()) wc.executeJavaScript(SKIP_SCRIPT).catch(() => {});
  }
  targets() {
    this.pages = this.pages.filter(w => !w.isDestroyed()); this.wcs = this.wcs.filter(w => !w.isDestroyed());
    const frames = this.wcs.flatMap(w => w.mainFrame.framesInSubtree.filter(f => /youtube(-nocookie)?\.com\/embed/.test(f.url)));
    return [...frames, ...this.pages];
  }
  apply() { const on = this.isOn(); for (const t of this.targets()) t.executeJavaScript(on ? SKIP_SCRIPT : OFF_SCRIPT).catch(() => {}); }
  async stats() {
    let skipped = 0;
    for (const t of this.targets()) { try { skipped += (await t.executeJavaScript('(window.__meowAB && window.__meowAB.skipped) || 0')) || 0; } catch (_) {} }
    return { blocked: this.blocked, skipped };
  }
}

module.exports = { AdBlock };
