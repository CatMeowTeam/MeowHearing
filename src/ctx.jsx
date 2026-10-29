import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DICTS } from './i18n';
import { I } from './icons';

const M = window.meow;
export const fmt = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };

/* ================= UI: ngôn ngữ, thông báo, menu, hộp thoại ================= */
const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function UIProvider({ children, settings, setSettings }) {
  const lang = settings.lang === 'en' ? 'en' : 'vi';
  const d = DICTS[lang];
  const t = useCallback((k, ...a) => { const v = d[k] ?? DICTS.vi[k] ?? k; return typeof v === 'function' ? v(...a) : v; }, [d]);
  const errText = useCallback(r => (r && d.errors[r.code]) || (r && r.message) || d.errors.http, [d]);

  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, err) => {
    const id = Math.random();
    setToasts(x => x.some(y => y.msg === msg) ? x : [...x.slice(-2), { id, msg, err }]);
    setTimeout(() => setToasts(x => x.filter(y => y.id !== id)), err ? 4200 : 2400);
  }, []);

  const [menu, setMenu] = useState(null);
  const openMenu = useCallback((e, items) => {
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect ? e.currentTarget.getBoundingClientRect() : { left: e.clientX, bottom: e.clientY, top: e.clientY };
    const x = e.type === 'contextmenu' ? e.clientX : r.left, y = e.type === 'contextmenu' ? e.clientY : r.bottom + 4;
    setMenu({ x, y, items });
  }, []);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const el = menuRef.current; if (el) {
      const b = el.getBoundingClientRect();
      if (b.right > innerWidth - 8) el.style.left = Math.max(8, innerWidth - b.width - 8) + 'px';
      if (b.bottom > innerHeight - 8) el.style.top = Math.max(8, menu.y - b.height - 40) + 'px';
      const m = el.getBoundingClientRect(); const v = document.querySelector('.video');
      const r = v && v.getBoundingClientRect();
      setMenuOver(!!(r && m.left < r.right && m.right > r.left && m.top < r.bottom && m.bottom > r.top));
    }
    const close = ev => { if (!el || !el.contains(ev.target)) setMenu(null); };
    const esc = ev => { if (ev.key === 'Escape') setMenu(null); };
    setTimeout(() => { addEventListener('mousedown', close); addEventListener('keydown', esc); addEventListener('blur', close); });
    return () => { removeEventListener('mousedown', close); removeEventListener('keydown', esc); removeEventListener('blur', close); setMenuOver(false); };
  }, [menu]);

  const [dlg, setDlg] = useState(null);
  const ask = useCallback(opts => new Promise(res => setDlg({ ...opts, res })), []);
  const closeDlg = v => { dlg && dlg.res(v); setDlg(null); };
  // Khung video là lớp riêng nằm trên giao diện → ẩn tạm khi menu/hộp thoại đè lên nó
  const [menuOver, setMenuOver] = useState(false);
  useEffect(() => { M.ytVisible(!dlg && !menuOver); }, [dlg, menuOver]);

  // ---------- tài khoản YouTube (đăng nhập ngay trong app) ----------
  const [account, setAccount] = useState({ loggedIn: false, hasClient: true, profile: settings.profile || null, busy: false });
  const refreshAccount = useCallback(async () => {
    const on = await M.ytStatus();
    let profile = (await M.getSettings()).profile || null;
    if (on && !profile) { const r = await M.api('me'); if (r.ok) profile = r.data; }
    setAccount(x => ({ ...x, loggedIn: on, profile: on ? profile : null }));
  }, []);
  useEffect(() => { refreshAccount(); }, [refreshAccount]);
  useEffect(() => M.onLoginStatus(st => {
    if (st.step === 'opened') { setAccount(x => ({ ...x, browser: st.browser, step: 'opened' })); toast(t('loginOpened', st.browser)); }
    if (st.step === 'reading') setAccount(x => ({ ...x, step: 'reading' }));
  }), [t, toast]);
  const login = useCallback(async () => {
    setAccount(x => ({ ...x, busy: true, browser: null }));
    const r = await M.ytLogin();
    setAccount(x => ({ ...x, busy: false, browser: null }));
    await refreshAccount();
    if (r.ok) { toast(t('signInOk', (r.profile && r.profile.name) || 'bạn')); setSettings(await M.getSettings()); }
    else if (r.code === 'cancel') toast(t('loginCancelled'));
    else if (r.code === 'closed' || r.code === 'nologin') toast(t('loginClosed'), true);
    else toast(t('loginNotDone'), true);
  }, [t, toast, refreshAccount, setSettings]);
  const logout = useCallback(async () => { await M.ytLogout(); await refreshAccount(); toast(t('signedOut')); setSettings(await M.getSettings()); }, [t, toast, refreshAccount, setSettings]);
  const canSearch = true;

  const value = useMemo(() => ({ t, lang, errText, toast, openMenu, ask, settings, setSettings, account, refreshAccount, login, logout, canSearch }), [t, lang, errText, toast, openMenu, ask, settings, setSettings, account, refreshAccount, login, logout, canSearch]);
  return (
    <UICtx.Provider value={value}>
      {children}
      {menu && (
        <div className="menu" ref={menuRef} style={{ left: menu.x, top: menu.y }} role="menu">
          {menu.items.map((it, i) => it === '-' ? <hr key={i} /> : it.header ? <div className="mh" key={i}>{it.header}</div> :
            <button key={i} role="menuitem" onClick={() => { setMenu(null); it.onClick(); }}>{it.icon}<span>{it.label}</span></button>)}
        </div>
      )}
      {dlg && <Dialog dlg={dlg} t={t} onClose={closeDlg} />}
      <div className="toasts" aria-live="polite">{toasts.map(x => <div key={x.id} className={'toast' + (x.err ? ' err' : '')}>{x.msg}</div>)}</div>
    </UICtx.Provider>
  );
}

function Dialog({ dlg, t, onClose }) {
  const [v, setV] = useState(dlg.value || '');
  const inp = useRef(null);
  useEffect(() => { if (inp.current) { inp.current.focus(); inp.current.select(); } }, []);
  const submit = e => { e.preventDefault(); if (dlg.input && !v.trim()) return; onClose(dlg.input ? v.trim() : true); };
  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(null); }} onKeyDown={e => e.key === 'Escape' && onClose(null)}>
      <form className="dialog" onSubmit={submit} role="dialog" aria-modal="true">
        <h2>{dlg.title}</h2>
        {dlg.text && <p>{dlg.text}</p>}
        {dlg.input && <input ref={inp} id="dlg-input" className="inp" value={v} placeholder={dlg.placeholder || ''} onChange={e => setV(e.target.value)} maxLength={100} />}
        <div className="acts">
          <button type="button" className="btn" onClick={() => onClose(null)}>{t('cancel')}</button>
          <button type="submit" className={'btn pri' + (dlg.danger ? ' danger' : '')} autoFocus={!dlg.input}>{dlg.okLabel || t('ok')}</button>
        </div>
      </form>
    </div>
  );
}

/* ================= Thư viện + trình phát ================= */
const PCtx = createContext(null);
export const usePlayer = () => useContext(PCtx);

const shuffleArr = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const slim = t => ({ id: t.id, title: t.title, artist: t.artist || '', duration: t.duration || 0, thumb: t.thumb || null });

export function PlayerProvider({ children }) {
  const { t, toast, settings, setSettings } = useUI();
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeS] = useState(typeof settings.volume === 'number' ? settings.volume : 80);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(!!settings.shuffle);
  const [repeat, setRepeat] = useState(settings.repeat || 'off');
  const [ready, setReady] = useState(false);
  const [ytFail, setYtFail] = useState(false);
  const [liked, setLiked] = useState(new Set());
  const [libVer, setLibVer] = useState(0);
  const bump = useCallback(() => setLibVer(v => v + 1), []);

  const yt = useRef(null);
  const S = useRef({}); // ảnh chụp trạng thái cho callback
  S.current = { queue, idx, playing, time, duration, repeat, shuffle, volume, muted, ready };
  const origQueue = useRef(null);
  const pending = useRef(null);
  const track = idx >= 0 ? queue[idx] || null : null;

  useEffect(() => { M.db('likedIds').then(ids => setLiked(new Set(ids))); }, [libVer]);

  // ---------- trình phát: trang YouTube chạy trong khung riêng (tiến trình chính điều khiển) ----------
  const mountPlayer = useCallback(el => {
    if (!el || yt.current) return;
    let prevB = '';
    const send = () => { const r = el.getBoundingClientRect(); const k = [r.left, r.top, r.width, r.height].map(Math.round).join(','); if (k !== prevB) { prevB = k; M.ytBounds({ x: r.left, y: r.top, width: r.width, height: r.height }); } };
    new ResizeObserver(send).observe(el); addEventListener('resize', send); setInterval(send, 800); send();
    const want = { id: null }; let last = {};
    const reset = id => { want.id = id; last = { st: null, err: null, t: 0, d: 0 }; };
    yt.current = {
      loadVideoById: o => { reset(o.videoId); M.yt('load', o.videoId, o.startSeconds || 0, true); },
      cueVideoById: o => { reset(o.videoId); M.yt('load', o.videoId, o.startSeconds || 0, false); },
      playVideo: () => M.yt('play'), pauseVideo: () => M.yt('pause'),
      seekTo: s => M.yt('seek', s), setVolume: v => M.yt('volume', v), mute: () => M.yt('mute', true), unMute: () => M.yt('mute', false),
      // nội suy giữa các lần cập nhật để lời bài hát chạy mượt, không trễ
      getCurrentTime: () => { const base = last.t || 0; if (last.st !== 1 || !last.at) return base; const t = base + (performance.now() - last.at) / 1000; return last.d ? Math.min(t, last.d) : t; },
      getDuration: () => last.d || 0,
    };
    M.onYt(s => {
      if (!s || !want.id) return;
      // chỉ coi là lỗi khi lỗi lặp lại liên tục ~1 giây và bài không hề chạy (tránh báo nhầm lúc đang chuyển bài)
      if (s.err && s.err !== 'NETWORK' && (s.id === want.id || !s.id) && s.st !== 1) last.errN = (last.errN || 0) + 1; else if (s.err !== 'NETWORK') last.errN = 0;
      if (s.err && !last.err && (s.err === 'NETWORK' || last.errN >= 3)) { last.err = s.err; H.current.onErr(s.err); return; }
      if (s.id !== want.id) return; // trạng thái của bài trước, bỏ qua
      last.t = s.t; last.d = s.d; last.at = performance.now();
      if (s.st !== last.st) { last.st = s.st; H.current.onState(s.st); }
    });
    setReady(true);
    yt.current.setVolume(S.current.volume);
    if (pending.current) { const p = pending.current; pending.current = null; setTimeout(() => p(), 0); }
  }, []); // eslint-disable-line

  const H = useRef({});
  const withPlayer = fn => { if (yt.current) fn(yt.current); else pending.current = () => fn(yt.current); };

  // ---------- nạp bài ----------
  const loadAt = useCallback((q, i, opts = {}) => {
    const tr = q[i]; if (!tr) return;
    setQueue(q); setIdx(i); setTime(opts.start || 0); setDuration(tr.duration || 0);
    withPlayer(p => {
      if (opts.cue) p.cueVideoById({ videoId: tr.id, startSeconds: opts.start || 0 });
      else p.loadVideoById({ videoId: tr.id, startSeconds: opts.start || 0 });
    });
    if (!opts.cue) M.db('addHistory', slim(tr)).then(() => setLibVer(v => v + 1));
  }, []);

  const playList = useCallback((tracks, i = 0, opts = {}) => {
    let q = tracks.map(slim); if (!q.length) return;
    origQueue.current = null;
    if (opts.shuffle || S.current.shuffle) {
      origQueue.current = q;
      const first = opts.shuffle && i === 0 && opts.random ? q[Math.floor(Math.random() * q.length)] : q[i];
      q = [first, ...shuffleArr(q.filter(x => x !== first))]; i = 0;
      if (opts.shuffle && !S.current.shuffle) { setShuffle(true); M.setSetting('shuffle', true); }
    }
    loadAt(q, i);
  }, [loadAt]);

  const playTrack = useCallback(tr => {
    const { queue: q, idx: i } = S.current;
    const at = q.findIndex(x => x.id === tr.id);
    if (at >= 0) return loadAt(q, at);
    const nq = q.slice(); nq.splice(i + 1, 0, slim(tr)); loadAt(nq, i + 1);
  }, [loadAt]);

  const next = useCallback((auto) => {
    const { queue: q, idx: i, repeat: r } = S.current;
    if (!q.length) return;
    let n = i + 1;
    if (n >= q.length) { if (r === 'all' || !auto) n = 0; else { setPlaying(false); return; } }
    loadAt(q, n);
  }, [loadAt]);

  const prev = useCallback(() => {
    const { queue: q, idx: i, time: tm } = S.current;
    if (tm > 3 || i <= 0) { withPlayer(p => p.seekTo(0, true)); setTime(0); return; }
    loadAt(q, i - 1);
  }, [loadAt]);

  const onState = useCallback(st => {
    const p = yt.current;
    if (st === 1) {
      errHist.current = [];
      setPlaying(true);
      const d = p.getDuration ? p.getDuration() : 0;
      if (d) { setDuration(d);
        const { queue: q, idx: i } = S.current; const tr = q[i];
        if (tr && !tr.duration) { const nt = { ...tr, duration: Math.round(d) }; const nq = q.slice(); nq[i] = nt; setQueue(nq); M.db('upsertTrack', nt); }
      }
    } else if (st === 2 || st === 5 || st === -1) setPlaying(false);
    else if (st === 0) {
      if (S.current.repeat === 'one') { p.seekTo(0, true); p.playVideo(); }
      else next(true);
    }
  }, [next]);

  const errHist = useRef([]);
  const onErr = useCallback(code => {
    if (code === 'NETWORK') { toast(t('playerFail'), true); setPlaying(false); return; }
    setPlaying(false);
    const now = Date.now(); errHist.current = errHist.current.filter(x => now - x < 30000).concat(now);
    if (errHist.current.length >= 3) { errHist.current = []; toast(t('errMany'), true); return; } // 3 bài lỗi liên tiếp: dừng lại, không nhảy tiếp
    toast(code === 'LOGIN_REQUIRED' ? t('errLogin') : t('errVideo'), true);
    setTimeout(() => next(true), 1500);
  }, [next, toast, t]);

  H.current = { onState, onErr };

  // ---------- điều khiển ----------
  const toggle = useCallback(() => {
    const { idx: i, playing: pl } = S.current;
    if (i < 0) return;
    withPlayer(p => { if (pl) p.pauseVideo(); else p.playVideo(); });
  }, []);
  const pause = useCallback(() => withPlayer(p => p.pauseVideo()), []);
  const seek = useCallback(s => { withPlayer(p => p.seekTo(s, true)); setTime(s); }, []);
  const saveVol = useRef(null);
  const setVolume = useCallback(v => {
    v = Math.max(0, Math.min(100, Math.round(v))); setVolumeS(v); setMuted(false);
    withPlayer(p => { p.unMute(); p.setVolume(v); });
    clearTimeout(saveVol.current); saveVol.current = setTimeout(() => M.setSetting('volume', v), 500);
  }, []);
  const toggleMute = useCallback(() => { const m = !S.current.muted; setMuted(m); withPlayer(p => m ? p.mute() : p.unMute()); }, []);
  const toggleShuffle = useCallback(() => {
    const { queue: q, idx: i, shuffle: sh } = S.current; const cur = q[i];
    if (!sh) {
      origQueue.current = q;
      if (cur) { setQueue([cur, ...shuffleArr(q.filter((_, k) => k !== i))]); setIdx(0); }
    } else if (origQueue.current) {
      const ids = new Set(origQueue.current.map(x => x.id));
      const nq = [...origQueue.current, ...q.filter(x => !ids.has(x.id))];
      setQueue(nq); setIdx(cur ? Math.max(0, nq.findIndex(x => x.id === cur.id)) : -1); origQueue.current = null;
    }
    setShuffle(!sh); M.setSetting('shuffle', !sh);
  }, []);
  const cycleRepeat = useCallback(() => { const n = { off: 'all', all: 'one', one: 'off' }[S.current.repeat]; setRepeat(n); M.setSetting('repeat', n); }, []);

  // ---------- hàng chờ ----------
  const addNext = useCallback(tr => {
    const { queue: q, idx: i } = S.current;
    if (i < 0) return playList([tr]);
    const nq = q.filter((x, k) => x.id !== tr.id || k === i); const ci = nq.findIndex(x => x.id === q[i].id);
    nq.splice(ci + 1, 0, slim(tr)); setQueue(nq); setIdx(ci); toast(t('addedNext'));
  }, [playList, toast, t]);
  const addQueue = useCallback(tr => {
    const { queue: q, idx: i } = S.current;
    if (i < 0) return playList([tr]);
    if (q.some(x => x.id === tr.id)) { toast(t('addedQueue')); return; }
    setQueue([...q, slim(tr)]); toast(t('addedQueue'));
  }, [playList, toast, t]);
  const removeAt = useCallback(k => {
    const { queue: q, idx: i } = S.current; if (k === i) return;
    const nq = q.filter((_, j) => j !== k); setQueue(nq); setIdx(k < i ? i - 1 : i);
  }, []);
  const clearQueue = useCallback(() => { const { queue: q, idx: i } = S.current; if (i >= 0) { setQueue([q[i]]); setIdx(0); } }, []);
  const jump = useCallback(k => loadAt(S.current.queue, k), [loadAt]);

  // ---------- thả tim ----------
  const toggleLike = useCallback(async tr => {
    if (!tr) return;
    const on = await M.db('toggleLike', slim(tr));
    setLiked(s => { const n = new Set(s); on ? n.add(tr.id) : n.delete(tr.id); return n; });
    setLibVer(v => v + 1);
  }, []);

  // ---------- đồng hồ ----------
  useEffect(() => {
    if (!playing) return;
    const h = setInterval(() => { const p = yt.current; if (p && p.getCurrentTime) setTime(p.getCurrentTime() || 0); }, 150);
    return () => clearInterval(h);
  }, [playing]);

  // ---------- gửi trạng thái cho mini player / khay ----------
  const lastSent = useRef(0);
  useEffect(() => {
    const now = Date.now();
    M.sendState({ playing, track: track ? slim(track) : null, time, duration, liked: track ? liked.has(track.id) : false });
    lastSent.current = now;
  }, [playing, track && track.id, Math.floor(time), duration, liked]); // eslint-disable-line

  useEffect(() => M.onCmd((c, a) => {
    if (c === 'toggle') toggle(); else if (c === 'next') next(false); else if (c === 'prev') prev();
    else if (c === 'pause') pause(); else if (c === 'seek') seek(a);
    else if (c === 'like') { const { queue: q, idx: i } = S.current; if (q[i]) toggleLike(q[i]); }
  }), [toggle, next, prev, pause, seek, toggleLike]);

  // ---------- lưu / khôi phục phiên nghe ----------
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return; restored.current = true;
    const s = settings.session;
    if (s && Array.isArray(s.queue) && s.queue.length && s.idx >= 0 && s.idx < s.queue.length) {
      loadAt(s.queue, s.idx, { cue: true, start: Math.max(0, (s.time || 0) - 2) });
      setTime(s.time || 0);
    }
  }, []); // eslint-disable-line
  useEffect(() => {
    if (!restored.current) return;
    const h = setTimeout(() => M.setSetting('session', { queue: queue.slice(0, 300), idx: Math.min(idx, 299), time: Math.floor(time) }), 2000);
    return () => clearTimeout(h);
  }, [queue, idx, Math.floor(time / 10)]); // eslint-disable-line

  // ---------- video ẩn/hiện + chất lượng + âm thanh ----------
  const videoHidden = settings.videoHidden !== false; // mặc định ẩn video, chỉ nghe
  const userQ = settings.videoQ || 'auto';
  const lowHidden = settings.lowWhenHidden !== false;
  useEffect(() => { M.yt('hidden', videoHidden); }, [videoHidden]);
  useEffect(() => {
    M.yt('cfg', { q: videoHidden && lowHidden ? 'tiny' : userQ, normOff: settings.normOff !== false, vol: volume, muted, eq: settings.eq || null });
  }, [videoHidden, lowHidden, userQ, settings.normOff, volume, muted, JSON.stringify(settings.eq || null)]); // eslint-disable-line
  const setVideoHidden = useCallback(async h => setSettings(await M.setSetting('videoHidden', h)), [setSettings]);

  const value = {
    videoHidden, setVideoHidden,
    queue, idx, track, playing, time, duration, volume, muted, shuffle, repeat, ready, ytFail, liked, libVer, bump,
    mountPlayer, playList, playTrack, next, prev, toggle, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat,
    addNext, addQueue, removeAt, clearQueue, jump, toggleLike,
  };
  return <PCtx.Provider value={value}>{children}</PCtx.Provider>;
}

/* ================= tiện ích dùng chung ================= */
export function Cover({ src, c, icon, className = '', style }) {
  const [bad, setBad] = useState(false);
  return (
    <span className={'cv ' + className} style={{ '--c': c || '#e8732c', ...style }}>
      {icon}
      {src && !bad && <img src={src} alt="" loading="lazy" draggable="false" onError={() => setBad(true)} />}
    </span>
  );
}

export const hueOf = id => { const C = ['#8a6ad1', '#e8732c', '#1f9e8f', '#c9862a', '#4f86d9', '#df568a', '#2f9467', '#d1495b']; let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return C[h % C.length]; };

export function parseYouTube(s) {
  s = String(s || '').trim();
  if (!/youtu\.?be|youtube\.com|^[\w-]{11}$/.test(s)) return null;
  try {
    if (/^[\w-]{11}$/.test(s)) return null;
    const u = new URL(/^https?:/.test(s) ? s : 'https://' + s);
    let v = null, list = u.searchParams.get('list');
    if (/youtu\.be$/.test(u.hostname)) v = u.pathname.slice(1).split('/')[0];
    else if (u.searchParams.get('v')) v = u.searchParams.get('v');
    else { const m = /\/(shorts|embed|live|v)\/([\w-]{11})/.exec(u.pathname); if (m) v = m[2]; }
    if (v && !/^[\w-]{11}$/.test(v)) v = null;
    if (list && !/^[\w-]{10,}$/.test(list)) list = null;
    if (list && /^RD/.test(list)) list = null; // mix tự động của YouTube không đọc được qua API
    return v || list ? { v, list } : null;
  } catch { return null; }
}

export { I };
