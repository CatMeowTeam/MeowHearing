import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUI, usePlayer, Cover, fmt, hueOf, I } from './ctx';
import { Logo, Note, Paw } from './icons';
import { Home, Search, Library, Playlist, Liked, History, Settings, Signature, Avatar, GIcon } from './views';
import { Help } from './help';
import { Sound } from './sound';
import { PlCover } from './tracks';

const M = window.meow;

export default function App() {
  const { t, settings, setSettings } = useUI();
  const P = usePlayer();
  const [nav, setNav] = useState({ stack: [{ view: 'home' }], pos: 0 });
  const route = nav.stack[nav.pos];
  const go = useCallback(r => setNav(n => {
    const cur = n.stack[n.pos];
    if (JSON.stringify(cur) === JSON.stringify(r)) return n;
    const stack = [...n.stack.slice(0, n.pos + 1), r].slice(-50);
    return { stack, pos: stack.length - 1 };
  }), []);
  const back = () => setNav(n => ({ ...n, pos: Math.max(0, n.pos - 1) }));
  const fwd = () => setNav(n => ({ ...n, pos: Math.min(n.stack.length - 1, n.pos + 1) }));
  const [full, setFull] = useState(false);
  const [q, setQ] = useState('');
  const searchRef = useRef(null);
  const mainRef = useRef(null);
  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [nav.pos, route]);
  useEffect(() => { if (route.view !== 'search') return; setQ(route.q || ''); }, [route]);

  // phím tắt trong app
  useEffect(() => {
    const h = e => {
      const typing = /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current && searchRef.current.focus(); searchRef.current && searchRef.current.select(); return; }
      if (typing) return;
      if (e.code === 'Space') { e.preventDefault(); P.toggle(); }
      else if (e.altKey && e.key === 'ArrowLeft') back();
      else if (e.altKey && e.key === 'ArrowRight') fwd();
      else if (e.ctrlKey && e.key === 'ArrowRight') P.next();
      else if (e.ctrlKey && e.key === 'ArrowLeft') P.prev();
      else if (e.key === 'ArrowRight') P.seek(Math.min(P.duration, P.time + 5));
      else if (e.key === 'ArrowLeft') P.seek(Math.max(0, P.time - 5));
      else if (e.key === 'ArrowUp') { e.preventDefault(); P.setVolume(P.volume + 5); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); P.setVolume(P.volume - 5); }
      else if (e.key.toLowerCase() === 'l' && P.track) P.toggleLike(P.track);
      else if (e.key === 'Escape' && full) setFull(false);
    };
    addEventListener('keydown', h); return () => removeEventListener('keydown', h);
  }, [P, full]);
  useEffect(() => { const h = e => { if (e.button === 3) back(); if (e.button === 4) fwd(); }; addEventListener('mouseup', h); return () => removeEventListener('mouseup', h); }, []);

  const submit = e => { e.preventDefault(); if (q.trim()) { setFull(false); go({ view: 'search', q: q.trim() }); } };

  let view;
  switch (route.view) {
    case 'search': view = <Search q={route.q} go={go} />; break;
    case 'library': view = <Library go={go} />; break;
    case 'playlist': view = <Playlist id={route.id} go={go} />; break;
    case 'liked': view = <Liked />; break;
    case 'history': view = <History />; break;
    case 'settings': view = <Settings focus={route.focus} />; break;
    case 'help': view = <Help go={go} />; break;
    case 'sound': view = <Sound />; break;
    default: view = <Home go={go} />;
  }
  const nav2 = r => { setFull(false); go(r); };

  return (
    <div className="app">
      <header className="titlebar">
        <span className="brand"><Logo /><strong className="brandname">Meow Hearing</strong></span>
        <form className="tb-mid" onSubmit={submit}>
          <button type="button" className="navbtn" disabled={nav.pos === 0} onClick={back} title={t('back')}>{I.left}</button>
          <button type="button" className="navbtn" disabled={nav.pos >= nav.stack.length - 1} onClick={fwd} title={t('forward')}>{I.right}</button>
          <label className="search">{I.search}
            <input ref={searchRef} id="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPh')} spellCheck="false" onFocus={e => e.target.select()} />
            <kbd>Ctrl K</kbd></label>
        </form>
        <TitleTools route={route} go={nav2} />
      </header>

      <div className={'body' + (full ? ' full' : '')}>
        <Sidebar route={route} go={nav2} />
        <main className="main" ref={mainRef}>{view}</main>
        <NowPlaying full={full} setFull={setFull} />
      </div>

      <PlayerBar full={full} setFull={setFull} route={route} onSound={() => nav2({ view: 'sound' })} />
      <StatusBar />
      {!settings.lang && <FirstRun setSettings={setSettings} />}
    </div>
  );
}

const POWER = <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M8 2v6" /><path d="M4.6 4.2a5 5 0 1 0 6.8 0" /></svg>;
const HELP = <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.4" /><circle cx="8" cy="12.3" r=".6" fill="currentColor" /></svg>;

function TitleTools({ route, go }) {
  const { t, openMenu, toast } = useUI();
  const P = usePlayer();
  const [timer, setTimer] = useState(null); // thời điểm tắt nhạc
  const [, tick] = useState(0);
  useEffect(() => {
    if (!timer) return;
    const h = setInterval(() => {
      tick(x => x + 1);
      if (Date.now() >= timer) { setTimer(null); if (P.playing) P.toggle(); toast(t('sleepDone')); }
    }, 1000);
    return () => clearInterval(h);
  }, [timer, P.playing]); // eslint-disable-line
  const left = timer ? Math.max(0, Math.round((timer - Date.now()) / 1000)) : 0;
  const set = m => { setTimer(Date.now() + m * 60000); toast(t('sleepSet', m)); };
  const power = e => openMenu(e, [
    { header: t('sleepTimer') },
    ...[15, 30, 45, 60, 90].map(m => ({ icon: I.clock, label: t('sleepIn', m), onClick: () => set(m) })),
    ...(timer ? [{ icon: I.close, label: t('sleepCancel'), onClick: () => { setTimer(null); toast(t('sleepCancelled')); } }] : []),
    '-',
    { icon: I.mini, label: t('miniPlayer'), onClick: () => M.openMini() },
    { icon: I.shrink, label: t('toTray'), onClick: () => M.hideWin() },
    { icon: POWER, label: t('quitApp'), onClick: () => M.quit() },
  ]);
  return (
    <div className="tools">
      {timer ? <span className="timer" title={t('sleepTimer')}>{I.clock}{fmt(left)}<button onClick={() => setTimer(null)} title={t('sleepCancel')}>✕</button></span> : null}
      <button className={'tool' + (route.view === 'help' ? ' on' : '')} title={t('help')} onClick={() => go({ view: 'help' })}>{HELP}</button>
      <button className={'tool' + (route.view === 'settings' ? ' on' : '')} title={t('settings')} onClick={() => go({ view: 'settings' })}>{I.gear}</button>
      <button className={'tool' + (timer ? ' on' : '')} title={t('power')} onClick={power}>{POWER}</button>
    </div>
  );
}

function Sidebar({ route, go }) {
  const { t, ask, account, login, logout, openMenu } = useUI();
  const P = usePlayer();
  const [pls, setPls] = useState([]);
  useEffect(() => { M.db('listPlaylists').then(setPls); }, [P.libVer]);
  const items = [
    ['home', t('home'), I.home, '#e8732c'], ['search', t('search'), I.search, '#4f86d9'], ['library', t('library'), I.library, '#2f9467'],
    ['liked', t('liked'), I.heartFill, '#df568a', P.liked.size], ['history', t('history'), I.clock, '#8a6ad1'],
  ];
  const create = async () => {
    const name = await ask({ title: t('newPlaylist'), input: true, placeholder: t('playlistName'), okLabel: t('create') });
    if (name) { const id = await M.db('createPlaylist', name); P.bump(); go({ view: 'playlist', id }); }
  };
  return (
    <aside className="side">
      <h3>{t('explore')}</h3>
      {items.map(([v, label, icon, c, n]) => (
        <button key={v} className={'cat' + (route.view === v ? ' on' : '')} style={{ '--c': c }} onClick={() => go({ view: v })}>
          <span className="ci">{icon}</span><span className="lb">{label}</span>{n ? <span className="n">{n}</span> : null}</button>
      ))}
      <h3>{t('yourPlaylists')}</h3>
      <div className="pls">
        {pls.map(p => (
          <button key={p.id} className={'cat' + (route.view === 'playlist' && route.id === p.id ? ' on' : '')} onClick={() => go({ view: 'playlist', id: p.id })}>
            <PlCover p={p} /><span className="lb">{p.name}</span><span className="n">{p.count}</span></button>
        ))}
      </div>
      {account.loggedIn ? (
        <button className="acct" onClick={e => openMenu(e, [
          { header: (account.profile && account.profile.name) || t('signedInAs') },
          { icon: I.library, label: t('fromYoutube'), onClick: () => go({ view: 'library' }) },
          { icon: I.gear, label: t('settings'), onClick: () => go({ view: 'settings' }) },
          '-', { icon: I.close, label: t('signOut'), onClick: logout },
        ])}>
          <Avatar p={account.profile} /><span className="lb"><b>{(account.profile && account.profile.name) || t('signedInAs')}</b><small>YouTube</small></span>
        </button>
      ) : account.hasClient ? (
        account.busy ? (
          <div className="acct wait">
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap', minWidth: 0 }}><span className="spinner" />
              <span className="lb"><b>{account.step === 'reading' ? t('loginReading') : t('loginWaiting')}</b><small>{account.browser || '…'}</small></span></div>
            {account.step !== 'reading' && <div className="row" style={{ gap: 6 }}>
              <button className="btn pri" style={{ flex: 1, justifyContent: 'center', padding: '5px 10px' }} onClick={() => M.ytLoginDone()}>{I.check}{t('loginDone')}</button>
              <button className="btn" style={{ padding: '5px 10px' }} onClick={() => M.ytLoginCancel()}>{t('cancel')}</button></div>}
          </div>
        ) : <button className="acct in" onClick={login}><GIcon /><span className="lb"><b>{t('signIn')}</b></span></button>
      ) : null}
      <div className="side-foot">
        <button className="add" onClick={create}>{t('newOrImport')}</button>
      </div>
    </aside>
  );
}

function NowPlaying({ full, setFull }) {
  const { t } = useUI();
  const P = usePlayer();
  const [tab, setTab] = useState('lyrics');
  const holder = useRef(null);
  useEffect(() => { P.mountPlayer(holder.current); }, []); // eslint-disable-line
  const tr = P.track;
  return (
    <aside className="np">
      <div className="np-top">
        <div className="cap"><span>{t('nowPlaying')}</span>
          <span style={{ display: 'flex', gap: 2 }}>
            {tr && <button className="vid-tg" onClick={() => P.setVideoHidden(!P.videoHidden)}>{P.videoHidden ? I.eye : I.eyeOff}{P.videoHidden ? t('showVideo') : t('hideVideo')}</button>}
            <button className="ib" title={full ? t('collapse') : t('expand')} onClick={() => setFull(!full)}>{full ? I.shrink : I.expand}</button>
          </span></div>
        <div className={'video' + (P.videoHidden && tr ? ' art' : '')}>
          <div id="yt-player" ref={holder} />
          {tr && P.videoHidden ? (
            <div className={'cover-art' + (P.playing ? ' on' : '')}>
              <img src={`https://i.ytimg.com/vi/${tr.id}/mqdefault.jpg`} alt="" className="bg" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
              <div className="disc">
                <img src={`https://i.ytimg.com/vi/${tr.id}/mqdefault.jpg`} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
              </div>
              <div className="audio-tag"><span className="bars"><i /><i /><i /><i /></span>{t('audioOnly')}</div>
              <button className="watch" onClick={() => P.setVideoHidden(false)}>{I.eye}{t('showVideo')}</button>
            </div>
          ) : <div className="ph"><div><Paw />{!tr ? t('pickSomething') : t('playerLoading')}</div></div>}
        </div>
        {tr ? <div className="ti"><b>{tr.title}</b><span>{tr.artist}</span></div> : <div className="ti"><b>{t('nothingPlaying')}</b></div>}
      </div>
      <div className="np-side">
        <div className="tabs" role="tablist">
          <button role="tab" className={tab === 'lyrics' ? 'on' : ''} onClick={() => setTab('lyrics')}>{t('lyrics')}</button>
          <button role="tab" className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>{t('queue')}{P.queue.length ? ` · ${P.queue.length}` : ''}</button>
        </div>
        <div className="np-scroll">{tab === 'lyrics' ? <Lyrics /> : <Queue />}</div>
      </div>
    </aside>
  );
}

function parseLRC(s) {
  if (!s) return [];
  const out = [];
  for (const line of String(s).split(/\r?\n/)) {
    const tags = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]; if (!tags.length) continue;
    const text = line.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of tags) out.push({ t: +m[1] * 60 + +m[2], text });
  }
  return out.sort((a, b) => a.t - b.t).filter((x, i, a) => x.text || (a[i + 1] && a[i + 1].t - x.t > 4));
}

function Lyrics() {
  const { t, settings, setSettings } = useUI();
  const P = usePlayer();
  const tr = P.track;
  const [st, setSt] = useState({ id: null, loading: false, data: null });
  const box = useRef(null);
  useEffect(() => {
    if (!tr) return; let alive = true; const id = tr.id;
    setSt({ id, loading: true, data: null });
    const caps = async allowAuto => { // phụ đề của chính video: khớp sẵn với video, kể cả MV có nhạc dạo
      for (let i = 0; i < 6 && alive; i++) {
        const c = await M.ytCaptions(id, allowAuto).catch(() => null);
        if (c && c.none) return null;
        if (c && c.lines && c.lines.length) return { lines: c.lines, source: 'youtube', auto: c.auto };
        await new Promise(r => setTimeout(r, 1500));
      }
      return null;
    };
    const h = setTimeout(async () => {
      const [r, man] = await Promise.all([M.api('lyrics', { title: tr.title, artist: tr.artist, duration: tr.duration || P.duration }), caps(false)]);
      if (!alive) return;
      if (man) return setSt({ id, loading: false, data: man });
      const lrc = r.ok ? r.data : null;
      if (lrc && lrc.synced) {
        const vd = tr.duration || P.duration || 0, ld = lrc.lrcDuration || 0;
        const diff = vd && ld ? vd - ld : 0;
        const autoOff = diff >= 2 && diff <= 75 ? Math.round(diff * 10) / 10 : 0; // MV dài hơn bản audio: phần dư thường là nhạc dạo đầu
        return setSt({ id, loading: false, data: { lines: parseLRC(lrc.synced), source: 'lrclib', autoOff } });
      }
      const auto = await caps(true);
      if (!alive) return;
      if (auto) return setSt({ id, loading: false, data: auto });
      setSt({ id, loading: false, data: lrc && lrc.plain ? { plain: lrc.plain, source: 'lrclib' } : null });
    }, 300);
    return () => { alive = false; clearTimeout(h); };
  }, [tr && tr.id]); // eslint-disable-line
  const saved = tr ? (settings.lrcOff || {})[tr.id] : undefined;
  const off = saved !== undefined ? saved : (st.data && st.data.autoOff) || 0;
  const saveOff = async v => {
    v = Math.round(v * 10) / 10;
    const map = { ...(settings.lrcOff || {}) }; map[tr.id] = v;
    setSettings(await M.setSetting('lrcOff', map));
  };
  const resetOff = async () => { const map = { ...(settings.lrcOff || {}) }; delete map[tr.id]; setSettings(await M.setSetting('lrcOff', map)); };
  const lines = st.data && st.data.lines;
  const shift = st.data && st.data.source === 'lrclib' ? off : 0;
  let cur = -1; if (lines) for (let i = 0; i < lines.length; i++) { if (lines[i].t + shift <= P.time + 0.3) cur = i; else break; }
  useEffect(() => {
    if (!box.current) return;
    const sc = box.current.parentElement;
    if (cur < 0) { sc && sc.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const el = box.current.querySelector(`[data-i="${cur}"]`);
    if (el && sc) sc.scrollTo({ top: el.offsetTop - sc.clientHeight / 3, behavior: 'smooth' });
  }, [cur]);
  if (!tr) return <p className="empty">{t('pickSomething')}</p>;
  if (st.loading) return <p className="empty"><span className="spinner" /> {t('loadingLyrics')}</p>;
  if (!st.data) return <p className="empty">{t('noLyrics')}</p>;
  if (lines && lines.length) {
    const intro = cur < 0 && lines[0] && P.time < lines[0].t + shift;
    return (
      <div className="lyr" ref={box} style={{ position: 'relative' }}>
        {intro && <span className="ln intro">♪ {t('intro')} · {fmt(Math.max(0, lines[0].t + shift - P.time))}</span>}
        {lines.map((l, i) => <span key={i} data-i={i} className={'ln' + (i === cur ? ' cur' : i < cur ? ' past' : '')} onClick={() => P.seek(Math.max(0, l.t + shift))}>{l.text || '♪'}</span>)}
        <small>{st.data.source === 'youtube' ? (st.data.auto ? t('lyricsYtAuto') : t('lyricsYt')) : t('lyricsSource')}</small>
        {st.data.source === 'lrclib' && (
          <div className="lrc-off">
            <span>{saved === undefined && st.data.autoOff ? t('lrcAuto') : t('lrcSync')}</span>
            <button onClick={() => saveOff(off - 0.5)} title={t('lrcEarlier')}>−0.5s</button>
            <b>{off > 0 ? '+' : ''}{off.toFixed(1)}s</b>
            <button onClick={() => saveOff(off + 0.5)} title={t('lrcLater')}>+0.5s</button>
            {saved !== undefined && <button onClick={resetOff} title="Tự động">↺</button>}
          </div>
        )}
      </div>
    );
  }
  return <div className="lyr plain">{st.data.plain}<small>{t('lyricsSource')} · {t('plain')}</small></div>;
}

function Queue() {
  const { t } = useUI();
  const P = usePlayer();
  if (!P.queue.length) return <p className="empty">{t('emptyQueue')}</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {P.queue.map((x, k) => (
        <div key={x.id + k} className={'qi' + (k === P.idx ? ' on' : '')}>
          <Cover src={x.thumb} c={hueOf(x.id)} icon={<Note />} />
          <div className="t" onDoubleClick={() => P.jump(k)} onClick={() => k !== P.idx && P.jump(k)}><b>{x.title}</b><small>{x.artist}{x.duration ? ' · ' + fmt(x.duration) : ''}</small></div>
          {k !== P.idx && <button className="ib sm" title={t('remove')} onClick={() => P.removeAt(k)}>{I.close}</button>}
        </div>
      ))}
      {P.queue.length > 1 && <button className="btn" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={P.clearQueue}>{I.trash}{t('clearQueue')}</button>}
    </div>
  );
}

function Rail({ value, max, onSeek, className = '', label }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(null);
  const pct = max > 0 ? Math.min(100, ((drag ?? value) / max) * 100) : 0;
  const at = e => { const r = ref.current.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * max; };
  const down = e => {
    if (!max) return; e.preventDefault(); setDrag(at(e));
    const mv = ev => setDrag(at(ev));
    const up = ev => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); onSeek(at(ev)); setDrag(null); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  return <div ref={ref} className={'rail ' + className} onMouseDown={down} role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(value)} tabIndex={-1}><s style={{ width: pct + '%' }} /></div>;
}

function PlayerBar({ full, setFull, onSound, route }) {
  const { t } = useUI();
  const P = usePlayer();
  const tr = P.track;
  const liked = tr && P.liked.has(tr.id);
  return (
    <footer className="player">
      <div className="now">
        {tr ? <>
          <Cover src={tr.thumb} c={hueOf(tr.id)} icon={<Note />} />
          <div className="t" onClick={() => setFull(!full)} style={{ cursor: 'pointer' }}><b title={tr.title}>{tr.title}</b><small>{tr.artist}</small></div>
          <button className={'ib' + (liked ? ' liked' : '')} title={liked ? t('unlike') : t('like')} onClick={() => P.toggleLike(tr)}>{liked ? I.heartFill : I.heart}</button>
        </> : <><Cover c="#e8732c" icon={<Paw />} /><div className="t"><b>{t('nothingPlaying')}</b><small>Meow Hearing</small></div></>}
      </div>
      <div className="ctrl">
        <div className="btns">
          <button className={'ib' + (P.shuffle ? ' on' : '')} title={t('shuffle')} onClick={P.toggleShuffle}>{I.shuffle}</button>
          <button className="ib" title={t('prev')} onClick={P.prev} disabled={!tr}>{I.prev}</button>
          <button className="play" title={P.playing ? t('pause') : t('play')} onClick={P.toggle} disabled={!tr}>{P.playing ? I.pause : I.play}</button>
          <button className="ib" title={t('next')} onClick={() => P.next()} disabled={!tr}>{I.next}</button>
          <button className={'ib rep' + (P.repeat !== 'off' ? ' on' : '')} title={P.repeat === 'one' ? t('repeatOne') : t('repeat')} onClick={P.cycleRepeat}>{I.repeat}{P.repeat === 'one' && <span className="one">1</span>}</button>
        </div>
        <div className="prog"><span>{fmt(P.time)}</span><Rail value={P.time} max={P.duration} onSeek={P.seek} label="Tiến độ" /><span>{fmt(P.duration)}</span></div>
      </div>
      <div className="right">
        <button className={'ib' + (route && route.view === 'sound' ? ' on' : '')} title={t('sound')} onClick={onSound}>{I.eq}</button>
        <button className={'ib' + (full ? ' on' : '')} title={t('lyrics')} onClick={() => setFull(!full)}>{I.lyrics}</button>
        <button className="ib" title={t('miniPlayer')} onClick={() => M.openMini()}>{I.mini}</button>
        <button className="ib" title={P.muted ? t('volume') : t('mute')} onClick={P.toggleMute}>{P.muted || P.volume === 0 ? I.volOff : I.vol}</button>
        <Rail className="vol" value={P.muted ? 0 : P.volume} max={100} onSeek={P.setVolume} label={t('volume')} />
      </div>
    </footer>
  );
}

function StatusBar() {
  const { t, settings } = useUI();
  const P = usePlayer();
  const [online, setOnline] = useState(navigator.onLine);
  const [ram, setRam] = useState(null);
  const [stats, setStats] = useState({ tracks: 0 });
  const [ver, setVer] = useState('0.6.7');
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    M.info().then(i => setVer(i.version));
    const tick = () => M.metrics().then(setRam); tick(); const h = setInterval(tick, 5000);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); clearInterval(h); };
  }, []);
  useEffect(() => { M.db('stats').then(setStats); }, [P.libVer]);
  return (
    <div className="status">
      <span><i className={'dotg' + (online && !P.ytFail ? '' : ' off')} />{!online ? t('offline') : P.ytFail ? t('playerFail') : t('connected')}</span>
      <span>{t('inLibrary', stats.tracks)}</span>
      {ram ? <span>RAM {ram} MB</span> : null}
      {settings.adBlock ? <span style={{ color: 'var(--accent)' }}>● {t('adOn')}</span> : null}
      <Signature version={ver} />
    </div>
  );
}

function FirstRun({ setSettings }) {
  const pick = async l => setSettings(await M.setSetting('lang', l));
  return (
    <div className="scrim">
      <div className="dialog" role="dialog" aria-modal="true">
        <Logo style={{ width: 56, height: 56 }} />
        <h2>Chọn ngôn ngữ · Choose language</h2>
        <p>Bạn có thể đổi lại trong Cài đặt. · You can change it later in Settings.</p>
        <div className="langpick">
          <button onClick={() => pick('vi')}><b>Tiếng Việt</b><span>Mặc định</span></button>
          <button onClick={() => pick('en')}><b>English</b><span>International</span></button>
        </div>
      </div>
    </div>
  );
}
