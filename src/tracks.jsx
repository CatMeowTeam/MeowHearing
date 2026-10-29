import React, { useEffect, useState } from 'react';
import { useUI, usePlayer, Cover, fmt, hueOf, I } from './ctx';
import { Note, Paw } from './icons';

const M = window.meow;

// Menu “thêm vào playlist” dùng chung
export function usePlaylistMenu() {
  const { t, toast, ask, openMenu } = useUI();
  const { bump, libVer } = usePlayer();
  const [pls, setPls] = useState([]);
  useEffect(() => { M.db('listPlaylists').then(setPls); }, [libVer]);
  const items = tracks => {
    const add = async id => { const n = await M.db('addToPlaylist', id, tracks); toast(t('added', n)); bump(); };
    return [
      { header: t('addToPlaylist') },
      { icon: I.plus, label: t('newPlaylist'), onClick: async () => {
        const name = await ask({ title: t('newPlaylist'), input: true, placeholder: t('playlistName'), okLabel: t('create') });
        if (name) { const id = await M.db('createPlaylist', name); await add(id); }
      } },
      ...pls.map(p => ({ icon: I.library, label: p.name, onClick: () => add(p.id) })),
    ];
  };
  const open = (e, tracks) => openMenu(e, items(tracks));
  open.items = items;
  return open;
}

export function TrackList({ tracks, onPlay, playlistId, onRemove, onReorder, showTime }) {
  const { t, openMenu } = useUI();
  const P = usePlayer();
  const plMenu = usePlaylistMenu();
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const cur = P.track && P.track.id;

  const ago = ts => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return t('justNow'); if (m < 60) return t('minAgo', m);
    const h = Math.floor(m / 60); if (h < 24) return t('hourAgo', h); return t('dayAgo', Math.floor(h / 24));
  };

  const more = (e, tr, i) => openMenu(e, [
    { icon: I.play, label: t('play'), onClick: () => onPlay(i) },
    { icon: I.queueAdd, label: t('playNext'), onClick: () => P.addNext(tr) },
    { icon: I.queue, label: t('addQueue'), onClick: () => P.addQueue(tr) },
    '-',
    { icon: P.liked.has(tr.id) ? I.heartFill : I.heart, label: P.liked.has(tr.id) ? t('unlike') : t('like'), onClick: () => P.toggleLike(tr) },
    { icon: I.link, label: 'YouTube', onClick: () => M.openExternal('https://www.youtube.com/watch?v=' + tr.id) },
    ...(onRemove ? [{ icon: I.trash, label: t('removeFromPlaylist'), onClick: () => onRemove(tr) }] : []),
    '-',
    ...plMenu.items([tr]),
  ]);

  const dropOn = i => {
    if (drag === null || drag === i) return;
    const ids = tracks.map(x => x.id); const [m] = ids.splice(drag, 1); ids.splice(i, 0, m);
    onReorder(ids);
  };

  return (
    <div className="tracks" role="list">
      {tracks.map((tr, i) => {
        const on = tr.id === cur;
        return (
          <div key={tr.id + ':' + i} role="listitem"
            className={'tr' + (on ? ' on' : '') + (drag === i ? ' drag' : '') + (over === i && drag !== null && drag !== i ? ' over' : '')}
            onDoubleClick={() => onPlay(i)} onContextMenu={e => more(e, tr, i)}
            draggable={!!onReorder} onDragStart={() => setDrag(i)} onDragEnd={() => { setDrag(null); setOver(null); }}
            onDragOver={e => { if (onReorder) { e.preventDefault(); setOver(i); } }} onDrop={() => dropOn(i)}>
            <span className="i">
              <span className="num">{on && P.playing ? '♪' : i + 1}</span>
              <button className="hov" aria-label={t('play')} onClick={() => on ? P.toggle() : onPlay(i)}>{on && P.playing ? I.pause : I.play}</button>
            </span>
            <Cover src={tr.thumb} c={hueOf(tr.id)} icon={<Note />} />
            <span className="t"><b title={tr.title}>{tr.title}</b><small>{tr.artist}{showTime && tr.played_at ? ' · ' + ago(tr.played_at) : ''}</small></span>
            <span className={'acts' + (P.liked.has(tr.id) ? ' keep' : '')}>
              <button className={'ib sm' + (P.liked.has(tr.id) ? ' liked' : '')} title={P.liked.has(tr.id) ? t('unlike') : t('like')} onClick={() => P.toggleLike(tr)}>{P.liked.has(tr.id) ? I.heartFill : I.heart}</button>
              <button className="ib sm" title={t('addToPlaylist')} onClick={e => plMenu(e, [tr])}>{I.plus}</button>
              <button className="ib sm" title={t('addQueue')} onClick={() => P.addQueue(tr)}>{I.queueAdd}</button>
              {onReorder && <span className="ib sm grip" title="Kéo để sắp xếp">{I.grip}</span>}
              <button className="ib sm" title="…" onClick={e => more(e, tr, i)}>{I.more}</button>
            </span>
            <span className="d">{tr.duration ? fmt(tr.duration) : '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

export function TrackCard({ tr, onPlay, sub, live }) {
  const P = usePlayer();
  const on = P.track && P.track.id === tr.id;
  return (
    <button className={'card wide' + (on || live ? ' live' : '')} onClick={onPlay}>
      <Cover src={tr.thumb} c={hueOf(tr.id)} icon={<Note />} />
      <span className="pp">{on && P.playing ? I.pause : I.play}</span>
      <b title={tr.title}>{tr.title}</b><small>{sub || tr.artist}</small>
    </button>
  );
}

export function PlCover({ p, className, style }) {
  return <Cover src={p.cover} c={p.color} icon={<Note />} className={className} style={style} />;
}
export { Paw };
