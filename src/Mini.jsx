import React, { useEffect, useState } from 'react';
import { I } from './icons';
import { Note, Paw } from './icons';
import { applySkin } from './theme';
import { DICTS } from './i18n';

const M = window.meow;

export default function Mini({ settings }) {
  const [st, setSt] = useState({ playing: false, track: null, time: 0, duration: 0 });
  const [bad, setBad] = useState(false);
  const d = DICTS[settings.lang === 'en' ? 'en' : 'vi'];
  useEffect(() => {
    applySkin(settings.skin, false);
    const a = M.onState(s => setSt(s));
    const b = M.onTheme(t => document.documentElement.setAttribute('data-skin', t.skin));
    return () => { a(); b(); };
  }, []); // eslint-disable-line
  useEffect(() => setBad(false), [st.track && st.track.id]);
  const tr = st.track;
  const pct = st.duration ? Math.min(100, (st.time / st.duration) * 100) : 0;
  return (
    <div className="mini">
      <span className="cv" style={{ '--c': '#e8732c' }}>{tr ? <Note /> : <Paw />}{tr && tr.thumb && !bad && <img src={tr.thumb} alt="" onError={() => setBad(true)} />}</span>
      <div className="mid">
        <div className="ti"><b title={tr ? tr.title : ''}>{tr ? tr.title : d.nothingPlaying}</b><small>{tr ? tr.artist : 'Meow Hearing'}</small></div>
        <div className="mb">
          <button className="ib" title={d.prev} onClick={() => M.sendCmd('prev')}>{I.prev}</button>
          <button className="play" title={st.playing ? d.pause : d.play} onClick={() => M.sendCmd('toggle')}>{st.playing ? I.pause : I.play}</button>
          <button className="ib" title={d.next} onClick={() => M.sendCmd('next')}>{I.next}</button>
          <button className={'ib' + (st.liked ? ' liked' : '')} title={d.like} onClick={() => M.sendCmd('like')}>{st.liked ? I.heartFill : I.heart}</button>
          <span className="sp" />
          <button className="ib" title={d.expand} onClick={() => M.closeMini(true)}>{I.expand}</button>
          <button className="ib" title="✕" onClick={() => M.closeMini(false)}>{I.close}</button>
        </div>
      </div>
      <div className="bar"><s style={{ width: pct + '%' }} /></div>
    </div>
  );
}
