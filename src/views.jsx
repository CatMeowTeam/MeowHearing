import React, { useEffect, useRef, useState } from 'react';
import { useUI, usePlayer, Cover, fmt, hueOf, parseYouTube, I } from './ctx';
import { TrackList, TrackCard, PlCover, usePlaylistMenu } from './tracks';
import { Note, Paw, Logo, PAW } from './icons';
import { SKINS } from './theme';

const M = window.meow;

/* ---------- Trang chủ ---------- */
export function Home({ go }) {
  const { t, settings, canSearch } = useUI();
  const P = usePlayer();
  const [pls, setPls] = useState([]);
  const [recent, setRecent] = useState([]);
  const [trend, setTrend] = useState(null);
  useEffect(() => { M.db('listPlaylists').then(setPls); M.db('recentUnique', 12).then(setRecent); }, [P.libVer]);
  useEffect(() => { if (canSearch) M.api('trending').then(r => setTrend(r.ok ? r.data : [])); else setTrend(null); }, [canSearch]);

  const h = new Date().getHours();
  const hello = h < 5 ? t('night') : h < 11 ? t('morning') : h < 18 ? t('afternoon') : h < 23 ? t('evening') : t('night');
  const quick = [{ kind: 'liked' }, ...pls.slice(0, 5).map(p => ({ kind: 'pl', p }))];
  const empty = !pls.length && !recent.length;

  return (
    <div className="view">
      <div className="vh"><h1>{hello}</h1><small>{new Date().toLocaleDateString(settings.lang === 'en' ? 'en-US' : 'vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}</small></div>
      {empty ? (
        <section>
          <div className="sec-h"><h2>{t('welcomeTitle')}</h2></div>
          <div className="welcome">
            {[t('welcome1'), t('welcome2'), t('welcome3')].map((x, i) => <div className="wstep" key={i}><span className="g-n">{i + 1}</span><p>{x}</p></div>)}
          </div>
        </section>
      ) : (
        <div className="quick">
          {quick.map((q, i) => q.kind === 'liked'
            ? <button key="liked" className="q" onClick={() => go({ view: 'liked' })}><Cover c="#df568a" icon={I.heartFill} /><span>{t('liked')}</span></button>
            : <button key={q.p.id} className="q" onClick={() => go({ view: 'playlist', id: q.p.id })}><PlCover p={q.p} /><span>{q.p.name}</span></button>)}
        </div>
      )}
      {recent.length > 0 && (
        <section>
          <div className="sec-h"><h2>{t('continue')}</h2><small>{t('basedOnHistory')}</small><button className="lnk" onClick={() => go({ view: 'history' })}>{t('seeAll')}</button></div>
          <div className="cards">{recent.slice(0, 6).map((tr, i) => <TrackCard key={tr.id} tr={tr} onPlay={() => P.playList(recent, i)} />)}</div>
        </section>
      )}
      {trend && trend.length > 0 && (
        <section>
          <div className="sec-h"><h2>{settings.apiKey ? t('trending') : t('forYou')}</h2><small>{settings.apiKey ? t('trendingSub') : 'YouTube'}</small></div>
          <TrackList tracks={trend.slice(0, 15)} onPlay={i => P.playList(trend, i)} />
        </section>
      )}
      {!canSearch && <KeyNote go={go} />}
    </div>
  );
}

function KeyNote({ go }) {
  const { t, login, account } = useUI();
  return (
    <div className="note">
      <span className="ci">{I.search}</span>
      <div><b>{t('needKeyTitle2')}</b><p>{t('needKeyBody2')}</p>
        <div className="row">
          {account.hasClient && <button className="btn pri" disabled={account.busy} onClick={login}>{account.busy ? <span className="spinner" /> : <GIcon />}{t('signIn')}</button>}
          <button className={'btn' + (account.hasClient ? '' : ' pri')} onClick={() => go({ view: 'settings', focus: 'key' })}>{t('openSettings')}</button>
        </div></div>
    </div>
  );
}

export const GIcon = () => <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#fff" d="M8 1.5a6.5 6.5 0 1 0 6.4 7.6H8V6.9h6.3A6.5 6.5 0 0 0 8 1.5z" opacity=".25"/><path fill="currentColor" d="M14.3 6.9H8v2.4h3.6A3.8 3.8 0 1 1 10.6 5l1.7-1.7A6.2 6.2 0 1 0 14.4 8c0-.4 0-.7-.1-1.1z"/></svg>;

/* ---------- Tìm kiếm ---------- */
export function Search({ q, go }) {
  const { t, errText, toast, canSearch } = useUI();
  const P = usePlayer();
  const [state, setState] = useState({ loading: false, res: null, err: null, link: null });
  const plMenu = usePlaylistMenu();

  useEffect(() => {
    let alive = true;
    const query = (q || '').trim();
    if (!query) { setState({ loading: false, res: null, err: null, link: null }); return; }
    const link = parseYouTube(query);
    if (link) {
      setState({ loading: !!link.v, res: null, err: null, link });
      if (link.v) M.api('video', link.v).then(r => { if (!alive) return; if (r.ok) { setState(s => ({ ...s, loading: false, res: [r.data] })); if (!link.list) P.playTrack(r.data); } else setState(s => ({ ...s, loading: false, err: errText(r) })); });
      return () => { alive = false; };
    }
    if (!canSearch) { setState({ loading: false, res: null, err: null, link: null, needKey: true }); return; }
    setState({ loading: true, res: null, err: null, link: null });
    M.api('search', query).then(r => { if (alive) setState({ loading: false, res: r.ok ? r.data : null, err: r.ok ? null : errText(r), link: null }); });
    return () => { alive = false; };
  }, [q, canSearch]); // eslint-disable-line

  const importList = async list => {
    toast(t('importing'));
    const r = await M.api('playlist', list);
    if (!r.ok) return toast(errText(r), true);
    const id = await M.db('createPlaylist', r.data.title, 'youtube');
    const n = await M.db('addToPlaylist', id, r.data.tracks);
    P.bump(); toast(t('imported', n)); go({ view: 'playlist', id });
  };

  const { loading, res, err, link, needKey } = state;
  const top = res && res[0];
  return (
    <div className="view">
      {q ? <div className="vh"><h1 style={{ fontSize: 22 }}>{link ? (link.list ? t('linkPlaylist') : t('linkVideo')) : t('results', q)}</h1></div>
        : <div className="vh"><h1>{t('search')}</h1></div>}
      {!q && <p className="muted" style={{ color: 'var(--muted)', margin: 0 }}>{t('searchPh')}</p>}
      {needKey && <KeyNote go={go} />}
      {loading && <div className="empty"><span className="spinner" /> {t('searching')}</div>}
      {err && <div className="note"><span className="ci" style={{ background: 'var(--danger)' }}>!</span><div><b>{err}</b>{(/key|API|đăng nhập|sign in/i.test(err)) && <button className="btn" onClick={() => go({ view: 'settings', focus: 'key' })}>{t('openSettings')}</button>}</div></div>}
      {link && link.list && (
        <div className="note"><span className="ci">{I.library}</span><div><b>{t('linkPlaylist')}</b><p>{t('importYtPh')}</p>
          <div className="row">
            <button className="btn pri" onClick={() => importList(link.list)}>{I.download}{t('importThis')}</button>
            {link.v && res && res[0] && <button className="btn" onClick={() => P.playTrack(res[0])}>{I.play}{t('playThis')}</button>}
          </div></div></div>
      )}
      {res && res.length === 0 && <div className="empty">{t('noResults')}</div>}
      {top && !link && (
        <section>
          <div className="sec-h"><h2>{t('topResult')}</h2></div>
          <div className="plhead">
            <Cover src={top.thumb} c={hueOf(top.id)} icon={<Note />} style={{ width: 200, height: 125, borderRadius: 18 }} />
            <div className="meta"><h1 style={{ fontSize: 24 }}>{top.title}</h1><p>{top.artist} · {fmt(top.duration)}</p>
              <div className="plbar"><button className="bigplay" aria-label={t('play')} onClick={() => P.playList(res, 0)}>{I.play}</button>
                <button className={'ib' + (P.liked.has(top.id) ? ' liked' : '')} onClick={() => P.toggleLike(top)}>{P.liked.has(top.id) ? I.heartFill : I.heart}</button>
                <button className="ib" onClick={e => plMenu(e, [top])}>{I.plus}</button></div></div>
          </div>
        </section>
      )}
      {res && res.length > 0 && <TrackList tracks={res} onPlay={i => P.playList(res, i)} />}
    </div>
  );
}

/* ---------- Thư viện ---------- */
function YoutubeLibrary({ go }) {
  const { t, toast, errText } = useUI();
  const P = usePlayer();
  const [pls, setPls] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => { M.api('myPlaylists').then(r => { if (r.ok) setPls(r.data); else { setPls([]); toast(errText(r), true); } }); }, []); // eslint-disable-line
  const syncLiked = async () => {
    setBusy('liked'); const r = await M.api('myLiked'); setBusy(null);
    if (!r.ok) return toast(errText(r), true);
    const n = await M.db('addLikes', r.data); P.bump(); toast(t('syncedLiked', n));
  };
  const imp = async p => {
    setBusy(p.id); const r = await M.api('myPlaylist', p.id); setBusy(null);
    if (!r.ok) return toast(errText(r), true);
    const id = await M.db('createPlaylist', r.data.title, 'youtube');
    const n = await M.db('addToPlaylist', id, r.data.tracks); P.bump(); toast(t('imported', n)); go({ view: 'playlist', id });
  };
  return (
    <section>
      <div className="sec-h"><h2>{t('fromYoutube')}</h2></div>
      <div className="tracks">
        <div className="tr" style={{ gridTemplateColumns: '40px minmax(0,1fr) auto' }}>
          <Cover c="#df568a" icon={I.heartFill} /><span className="t"><b>{t('liked')} · YouTube</b><small>{t('syncLiked')}</small></span>
          <button className="btn" disabled={!!busy} onClick={syncLiked}>{busy === 'liked' ? <span className="spinner" /> : I.download}{t('syncLiked')}</button>
        </div>
        {pls === null && <div className="tr" style={{ gridTemplateColumns: '1fr' }}><span className="empty" style={{ padding: 8 }}><span className="spinner" /> {t('loadingYt')}</span></div>}
        {(pls || []).map(p => (
          <div key={p.id} className="tr" style={{ gridTemplateColumns: '40px minmax(0,1fr) auto' }}>
            <Cover src={p.thumb} c={hueOf(p.id)} icon={<Note />} /><span className="t"><b>{p.title}</b><small>{p.count} {t('songs')}</small></span>
            <button className="btn" disabled={!!busy} onClick={() => imp(p)}>{busy === p.id ? <span className="spinner" /> : I.download}{t('importBtn')}</button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Library({ go }) {
  const { t, ask, toast, errText, account } = useUI();
  const P = usePlayer();
  const [pls, setPls] = useState([]);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { M.db('listPlaylists').then(setPls); }, [P.libVer]);
  const create = async () => {
    const name = await ask({ title: t('newPlaylist'), input: true, placeholder: t('playlistName'), okLabel: t('create') });
    if (name) { const id = await M.db('createPlaylist', name); P.bump(); go({ view: 'playlist', id }); }
  };
  const doImport = async e => {
    e.preventDefault();
    const l = parseYouTube(link); if (!l || !l.list) return toast(t('importYtPh'), true);
    setBusy(true); const r = await M.api('playlist', l.list); setBusy(false);
    if (!r.ok) return toast(errText(r), true);
    const id = await M.db('createPlaylist', r.data.title, 'youtube');
    const n = await M.db('addToPlaylist', id, r.data.tracks); P.bump(); setLink(''); toast(t('imported', n)); go({ view: 'playlist', id });
  };
  return (
    <div className="view">
      <div className="vh"><h1>{t('library')}</h1><button className="btn pri" onClick={create}>{I.plus}{t('newPlaylist')}</button></div>
      <form className="note" onSubmit={doImport}>
        <span className="ci">{I.link}</span>
        <div style={{ flex: 1 }}><b>{t('importYt')}</b>
          <div className="row" style={{ marginTop: 8 }}>
            <input id="import-link" className="inp" style={{ flex: 1 }} value={link} onChange={e => setLink(e.target.value)} placeholder={t('importYtPh')} />
            <button className="btn pri" disabled={busy || !link.trim()}>{busy ? <span className="spinner" /> : I.download}{t('importBtn')}</button>
          </div></div>
      </form>
      <div className="cards">
        <button className="card" onClick={() => go({ view: 'liked' })}><Cover c="#df568a" icon={I.heartFill} /><b>{t('liked')}</b><small>{P.liked.size} {t('songs')}</small></button>
        {pls.map(p => (
          <button key={p.id} className="card" onClick={() => go({ view: 'playlist', id: p.id })}>
            <PlCover p={p} /><span className="pp" onClick={async e => { e.stopPropagation(); const tr = await M.db('playlistTracks', p.id); P.playList(tr, 0); }}>{I.play}</span>
            <b>{p.name}</b><small>{p.count} {t('songs')}</small>
          </button>
        ))}
      </div>
      {!pls.length && <div className="empty">{t('libraryEmpty')}</div>}
      {account.loggedIn && <YoutubeLibrary go={go} />}
    </div>
  );
}

/* ---------- Playlist ---------- */
export function Playlist({ id, go }) {
  const { t, ask, toast } = useUI();
  const P = usePlayer();
  const [pl, setPl] = useState(null);
  const [tracks, setTracks] = useState([]);
  useEffect(() => {
    M.db('listPlaylists').then(l => setPl(l.find(x => x.id === id) || null));
    M.db('playlistTracks', id).then(setTracks);
  }, [id, P.libVer]);
  if (!pl) return <div className="view"><div className="empty">…</div></div>;
  const total = tracks.reduce((s, x) => s + (x.duration || 0), 0);
  const rename = async () => { const n = await ask({ title: t('rename'), input: true, value: pl.name, okLabel: t('save') }); if (n) { await M.db('renamePlaylist', id, n); P.bump(); } };
  const del = async () => { if (await ask({ title: t('deletePl'), text: t('confirmDelete'), okLabel: t('remove'), danger: true })) { await M.db('deletePlaylist', id); P.bump(); go({ view: 'library' }); } };
  return (
    <div className="view">
      <div className="plhead">
        <PlCover p={pl} />
        <div className="meta"><span className="cap">Playlist{pl.source === 'youtube' ? ' · YouTube' : ''}</span><h1>{pl.name}</h1>
          <p>{tracks.length} {t('songs')}{total ? ` · ${fmt(total)}` : ''}</p></div>
      </div>
      <div className="plbar">
        <button className="bigplay" aria-label={t('playAll')} disabled={!tracks.length} onClick={() => P.playList(tracks, 0)}>{I.play}</button>
        <button className="btn" disabled={!tracks.length} onClick={() => P.playList(tracks, 0, { shuffle: true, random: true })}>{I.shuffle}{t('shuffle')}</button>
        <button className="btn" onClick={rename}>{I.edit}{t('rename')}</button>
        <button className="btn danger" onClick={del}>{I.trash}{t('deletePl')}</button>
      </div>
      {tracks.length ? (
        <TrackList tracks={tracks} onPlay={i => P.playList(tracks, i)}
          onRemove={async tr => { await M.db('removeFromPlaylist', id, tr.id); P.bump(); toast('✓'); }}
          onReorder={async ids => { setTracks(ids.map(x => tracks.find(y => y.id === x))); await M.db('reorderPlaylist', id, ids); P.bump(); }} />
      ) : <div className="empty">{t('emptyPlaylist')}</div>}
    </div>
  );
}

/* ---------- Bài đã thích / Lịch sử ---------- */
export function Liked() {
  const { t } = useUI();
  const P = usePlayer();
  const [tracks, setTracks] = useState([]);
  useEffect(() => { M.db('likedTracks').then(setTracks); }, [P.libVer]);
  return (
    <div className="view">
      <div className="plhead">
        <Cover c="#df568a" icon={I.heartFill} />
        <div className="meta"><span className="cap">Playlist</span><h1>{t('liked')}</h1><p>{tracks.length} {t('songs')}</p></div>
      </div>
      <div className="plbar">
        <button className="bigplay" disabled={!tracks.length} onClick={() => P.playList(tracks, 0)}>{I.play}</button>
        <button className="btn" disabled={!tracks.length} onClick={() => P.playList(tracks, 0, { shuffle: true, random: true })}>{I.shuffle}{t('shuffle')}</button>
      </div>
      {tracks.length ? <TrackList tracks={tracks} onPlay={i => P.playList(tracks, i)} /> : <div className="empty">{t('likedEmpty')}</div>}
    </div>
  );
}

export function History() {
  const { t, ask, toast } = useUI();
  const P = usePlayer();
  const [tracks, setTracks] = useState([]);
  useEffect(() => { M.db('history', 200).then(setTracks); }, [P.libVer]);
  return (
    <div className="view">
      <div className="vh"><h1>{t('history')}</h1>
        {tracks.length > 0 && <button className="btn" onClick={async () => { if (await ask({ title: t('clearHistory'), okLabel: t('remove'), danger: true })) { await M.db('clearHistory'); P.bump(); toast(t('sHistoryCleared')); } }}>{I.trash}{t('clearHistory')}</button>}</div>
      {tracks.length ? <TrackList tracks={tracks} showTime onPlay={i => P.playList(tracks, i)} /> : <div className="empty">{t('historyEmpty')}</div>}
    </div>
  );
}

/* ---------- Cài đặt ---------- */
function AccountBox() {
  const { t, account, login, logout } = useUI();
  const p = account.profile;
  return (
    <div className="r">
      <div className="row" style={{ gap: 12, minWidth: 0, flex: 1, flexWrap: "nowrap" }}>
        <Avatar p={account.loggedIn ? p : null} size={40} />
        <div className="t">{account.loggedIn ? <><b>{(p && p.name) || t('signedInAs')}</b><span>{t('signedInAs')} · YouTube</span></> : <><b>{t('sAccount')}</b><span>{t('sAccountSub')}</span></>}</div>
      </div>
      {account.loggedIn ? <button className="btn" onClick={logout}>{t('signOut')}</button>
        : account.busy ? <span className="row" style={{ gap: 6 }}><button className="btn pri" onClick={() => M.ytLoginDone()}>{I.check}{t('loginDone')}</button><button className="btn" onClick={() => M.ytLoginCancel()}>{t('cancel')}</button></span>
        : <button className="btn pri" onClick={login}><GIcon />{t('signIn')}</button>}
    </div>
  );
}

export function Avatar({ p, size = 28 }) {
  const [bad, setBad] = useState(false);
  const letter = p && p.name ? p.name.trim()[0].toUpperCase() : null;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {p && p.avatar && !bad ? <img src={p.avatar} alt="" onError={() => setBad(true)} referrerPolicy="no-referrer" /> : letter || <Paw style={{ width: '55%', height: '55%' }} />}
    </span>
  );
}

function PlayerLogin() {
  const { t, toast } = useUI();
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { M.ytStatus().then(setOn); }, []);
  return (
    <div className="r"><div className="t"><b>{on ? t('sPlayerIn') : t('sPlayerLogin')}</b><span>{t('sPlayerLoginSub')}</span></div>
      {on ? <button className="btn" onClick={async () => { await M.ytLogout(); setOn(false); toast(t('signedOut')); }}>{t('sPlayerOut')}</button>
        : <button className="btn pri" disabled={busy} onClick={async () => { setBusy(true); const ok = await M.ytLogin(); setBusy(false); setOn(ok); }}>{busy ? <span className="spinner" /> : <GIcon />}{t('sPlayerBtn')}</button>}
    </div>
  );
}

function AdStats() {
  const { t } = useUI();
  const [s, setS] = useState({ blocked: 0, skipped: 0 });
  useEffect(() => { const f = () => M.adStats().then(setS); f(); const h = setInterval(f, 3000); return () => clearInterval(h); }, []);
  return <span style={{ display: 'block', fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>{t('adStats', s.blocked, s.skipped)}</span>;
}

export function Settings({ focus }) {
  const { t, settings, setSettings, toast, errText, refreshAccount } = useUI();
  const [cid, setCid] = useState(settings.oauthClientId || '');
  const [csec, setCsec] = useState(settings.oauthClientSecret || '');
  const P = usePlayer();
  const [key, setKey] = useState(settings.apiKey || '');
  const [keyState, setKeyState] = useState(null);
  const [rec, setRec] = useState(false);
  const [hkErr, setHkErr] = useState(false);
  const [info, setInfo] = useState({});
  const keyRef = useRef(null);
  useEffect(() => { M.info().then(setInfo); if (focus === 'key' && keyRef.current) keyRef.current.focus(); }, [focus]);

  const set = async (k, v) => { const s = await M.setSetting(k, v); setSettings(s); };
  const saveKey = async () => {
    setKeyState('busy');
    const r = await M.api('testKey', key);
    if (r.ok) { await set('apiKey', key.trim()); setKeyState('ok'); }
    else setKeyState({ err: errText(r) });
  };
  const onKey = async e => {
    if (!rec) return; e.preventDefault();
    if (e.key === 'Escape') { setRec(false); return; }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean);
    if (!mods.length) return;
    let k = e.code.startsWith('Key') ? e.code.slice(3) : e.code.startsWith('Digit') ? e.code.slice(5) : e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    const acc = [...mods, k].join('+');
    const ok = await M.testHotkey(acc);
    setRec(false); setHkErr(!ok); if (ok) set('hotkey', acc);
  };
  const hk = (settings.hotkey || 'Control+Alt+Space').replace('Control', 'Ctrl');
  const skin = settings.skin || 'auto';

  return (
    <div className="view" style={{ maxWidth: 860 }}>
      <div className="vh"><h1>{t('settings')}</h1></div>
      <div className="set">
        <h3>{t('sAppearance')}</h3>
        <div className="r stack"><div className="t"><b>{t('sSkin')}</b><span>{t('sSkinSub')}</span></div>
          <div className="skins" role="radiogroup">{SKINS.map(s => (
            <button key={s.id} className={'sk' + (skin === s.id ? ' on' : '')} role="radio" aria-checked={skin === s.id} onClick={() => set('skin', s.id)}>
              <i className="sw" style={{ '--a': s.a, '--b': s.b }} /><span>{s.name[settings.lang === 'en' ? 1 : 0]}</span></button>))}</div></div>
        <div className="r"><div className="t"><b>{t('sLang')}</b><span>{t('sLangSub')}</span></div>
          <div className="seg"><button className={settings.lang !== 'en' ? 'on' : ''} onClick={() => set('lang', 'vi')}>Tiếng Việt</button><button className={settings.lang === 'en' ? 'on' : ''} onClick={() => set('lang', 'en')}>English</button></div></div>
      </div>

      <div className="set">
        <h3>{t('sAccount')}</h3>
        <AccountBox />
      </div>

      <div className="set">
        <h3>{t('sPlayback')}</h3>
        <div className="r"><div className="t"><b>{t('sAdBlock')}</b><span>{t('sAdBlockSub')}</span>
          {settings.adBlock ? <AdStats /> : <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{t('sAdBlockNote')}</span>}</div>
          <button className={'tg' + (settings.adBlock ? ' on' : '')} role="switch" aria-checked={!!settings.adBlock} aria-label={t('sAdBlock')} onClick={() => set('adBlock', !settings.adBlock)} /></div>
      </div>

      <div className="set">
        <h3>{t('sAdvanced')}</h3>
        <div className="r stack">
          <details open={focus === 'key' || !!settings.apiKey}><summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>{t('sKey')} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {t('optional')}</span></summary>
            <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: '6px 0 10px' }}>{t('sKeySub2')}</p>
            <div className="row">
              <input ref={keyRef} id="api-key" className="inp mono" style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12.5 }} value={key} onChange={e => { setKey(e.target.value); setKeyState(null); }} placeholder="AIza…" spellCheck="false" />
              <button className="btn pri" disabled={!key.trim() || keyState === 'busy'} onClick={saveKey}>{keyState === 'busy' ? <span className="spinner" /> : I.check}{t('sKeyTest')}</button>
              {settings.apiKey && <button className="btn" onClick={async () => { await set('apiKey', ''); setKey(''); setKeyState(null); }}>{I.trash}{t('remove')}</button>}
            </div>
            {keyState === 'ok' && <span className="okmsg">{I.check}{t('sKeyOk')}</span>}
            {keyState && keyState.err && <span className="errmsg">{keyState.err}</span>}
            <ol style={{ color: 'var(--muted)', fontSize: 13, margin: '10px 0 0', paddingLeft: 18 }}>{t('sKeySteps').map((x, i) => <li key={i}>{x}</li>)}</ol>
          </details>
        </div>
      </div>

      <div className="set">
        <h3>{t('sSystem')}</h3>
        <div className="r"><div className="t"><b>{t('sHotkey')}</b><span>{hkErr ? <span className="errmsg">{t('sHotkeyBad')}</span> : t('sHotkeySub')}</span></div>
          <button className={'keybox' + (rec ? ' rec' : '')} onClick={() => { setRec(true); setHkErr(false); }} onKeyDown={onKey} onBlur={() => setRec(false)}>{rec ? '…' : hk}</button></div>
        <div className="r"><div className="t"><b>{t('sTray')}</b><span>{t('sTraySub')}</span></div>
          <button className={'tg' + (settings.closeToTray !== false ? ' on' : '')} role="switch" aria-checked={settings.closeToTray !== false} aria-label={t('sTray')} onClick={() => set('closeToTray', settings.closeToTray === false)} /></div>
        <div className="r"><div className="t"><b>{t('sLogin')}</b><span>{t('sLoginSub')}</span></div>
          <button className={'tg' + (settings.openAtLogin ? ' on' : '')} role="switch" aria-checked={!!settings.openAtLogin} aria-label={t('sLogin')} onClick={() => set('openAtLogin', !settings.openAtLogin)} /></div>
      </div>

      <div className="set">
        <h3>{t('sData')}</h3>
        <div className="r"><div className="row">
          <button className="btn" onClick={async () => { const p = await M.exportLib(); if (p) toast(t('sExported')); }}>{I.upload}{t('sExport')}</button>
          <button className="btn" onClick={async () => { const r = await M.importLib(); if (r) { if (r.ok) { P.bump(); toast(t('sImported', r.count)); } else toast(r.message, true); } }}>{I.download}{t('sImport')}</button>
          <button className="btn" onClick={() => M.openData()}>{I.folder}{t('sOpenData')}</button>
          <button className="btn" onClick={async () => { await M.db('clearCache'); toast(t('sCacheCleared')); }}>{I.trash}{t('sClearCache')}</button>
        </div></div>
      </div>

      <div className="set">
        <h3>{t('sAbout')}</h3>
        <div className="r" style={{ flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 12 }}><Logo style={{ width: 44, height: 44 }} /><div className="t"><b style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 16 }}>Meow Hearing</b><span>{t('sAboutSub')}</span></div></div>
          <Signature version={info.version} />
        </div>
        <div className="r"><span className="t"><span>{info.dataDir}</span></span>
          <button className="btn" onClick={() => M.openExternal('https://github.com/MeoAmyTeam/MeowHearing/releases')}>{I.link}{t('sUpdates')}</button></div>
      </div>
    </div>
  );
}

export function Signature({ version }) {
  const { t } = useUI();
  return (
    <span className="sig" title="Meow Hearing">
      <svg viewBox="0 0 64 64" aria-hidden="true">{PAW}</svg>
      <span className="ver">ver {version || '0.6.7'} Beta</span><span className="dotsep">·</span><span>{t('by')}</span> <b>CatMeow Team</b>
    </span>
  );
}
