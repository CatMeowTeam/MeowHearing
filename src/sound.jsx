import React, { useEffect, useState } from 'react';
import { useUI, usePlayer, I } from './ctx';

const M = window.meow;
const FREQS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
export const PRESETS = [
  ['flat', 'Phẳng', 'Flat', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  ['bass', 'Bass mạnh', 'Bass boost', [6, 5, 4, 2, 0, 0, 0, 0, 0, 0]],
  ['bassLight', 'Bass nhẹ', 'Light bass', [3, 3, 2, 1, 0, 0, 0, 0, 0, 0]],
  ['vocal', 'Giọng hát', 'Vocal', [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1]],
  ['pop', 'Nhạc trẻ', 'Pop', [-1, 1, 3, 3, 1, -1, -1, 0, 1, 2]],
  ['edm', 'EDM / Remix', 'EDM', [5, 4, 1, 0, -1, 1, 0, 2, 4, 4]],
  ['acoustic', 'Acoustic', 'Acoustic', [2, 2, 1, 1, 2, 2, 2, 3, 2, 1]],
  ['rock', 'Rock', 'Rock', [4, 3, 1, -1, -2, -1, 1, 3, 4, 4]],
  ['bolero', 'Trữ tình / Bolero', 'Ballad', [1, 2, 2, 1, 1, 2, 2, 1, 0, -1]],
  ['laptop', 'Loa laptop', 'Laptop speakers', [4, 3, 2, 1, 0, 0, 1, 2, 3, 2]],
];
const autoPre = g => -Math.round(Math.max(0, ...g) * 0.6 * 10) / 10;

const QUALITIES = [['auto', 'Tự động', 'Auto'], ['tiny', '144p', '144p'], ['medium', '360p', '360p'], ['large', '480p', '480p'], ['hd720', '720p', '720p'], ['hd1080', '1080p', '1080p']];

export function Sound() {
  const { t, settings, setSettings, lang } = useUI();
  const P = usePlayer();
  const en = lang === 'en';
  const eq = settings.eq || { on: false, preset: 'flat', gains: PRESETS[0][3], pre: 0 };
  const set = async (k, v) => setSettings(await M.setSetting(k, v));
  const setEq = patch => set('eq', { ...eq, ...patch });
  const [stats, setStats] = useState(null);
  useEffect(() => { const f = () => M.ytStats().then(setStats).catch(() => {}); f(); const h = setInterval(f, 3000); return () => clearInterval(h); }, []);
  const pick = p => setEq({ on: true, preset: p[0], gains: p[3].slice(), pre: autoPre(p[3]) });
  const band = (i, v) => { const g = eq.gains.slice(); g[i] = v; setEq({ gains: g, preset: 'custom', pre: autoPre(g) }); };
  const L = (vi, e) => (en ? e : vi);

  return (
    <div className="view" style={{ maxWidth: 900 }}>
      <div className="vh"><div><h1>{t('sound')}</h1><small>{L('Chỉnh tiếng hay hơn và chọn cách hiển thị video.', 'Make it sound better and choose how video is shown.')}</small></div></div>

      <div className="set">
        <h3>{L('Chất lượng âm thanh', 'Audio quality')}</h3>
        <div className="r"><div className="t"><b>{L('Âm lượng gốc', 'Original loudness')}</b>
          <span>{L('Tắt chế độ YouTube tự giảm âm lượng các bài thu to, giữ tiếng đầy và sống như bản gốc.', 'Turns off YouTube lowering loud tracks, keeping the original punch.')}</span>
          {stats && stats.loud != null && <span className="statline" style={{ display: 'block' }}>{L('Bài này YouTube giảm', 'YouTube lowers this track by')} {Math.max(0, stats.loud).toFixed(1)} dB</span>}</div>
          <button className={'tg' + (settings.normOff !== false ? ' on' : '')} role="switch" aria-checked={settings.normOff !== false} aria-label={L('Âm lượng gốc', 'Original loudness')} onClick={() => set('normOff', settings.normOff === false)} /></div>
        <div className="r"><div className="t"><b>{L('Định dạng đang phát', 'Now streaming')}</b>
          <span>{L('YouTube luôn gửi bản âm thanh tốt nhất có sẵn (thường Opus ~160 kbps). Tiếng tải riêng với hình nên ẩn video không làm giảm chất lượng tiếng.', 'YouTube streams its best available audio (usually Opus ~160 kbps). Audio is separate from video, so hiding video never lowers sound quality.')}</span>
          <span className="statline" style={{ display: 'block' }}>{stats && stats.best ? `${(stats.best.mime || '').split(';')[0].replace('audio/', '')} · ${stats.best.kbps} kbps · ${stats.best.rate || '?'} Hz` : L('Phát một bài để xem', 'Play a song to see')}</span></div></div>
      </div>

      <div className="set">
        <h3>{L('Bộ chỉnh âm (EQ)', 'Equalizer')}</h3>
        <div className="r"><div className="t"><b>{L('Bật bộ chỉnh âm', 'Enable equalizer')}</b><span>{L('Chọn kiểu có sẵn hoặc tự kéo từng dải tần. Có bộ chống vỡ tiếng khi tăng mạnh.', 'Pick a preset or drag each band. A limiter prevents distortion.')}</span></div>
          <button className={'tg' + (eq.on ? ' on' : '')} role="switch" aria-checked={!!eq.on} aria-label="EQ" onClick={() => setEq({ on: !eq.on })} /></div>
        <div className="r stack">
          <div className="presets">{PRESETS.map(p => <button key={p[0]} className={'chipb' + (eq.on && eq.preset === p[0] ? ' on' : '')} onClick={() => pick(p)}>{en ? p[2] : p[1]}</button>)}
            {eq.preset === 'custom' && <span className="chipb on">{L('Tự chỉnh', 'Custom')}</span>}</div>
          <div className={'eq' + (eq.on ? '' : ' off')}>
            <div className="eqb pre"><span className="v">{(eq.pre > 0 ? '+' : '') + (+eq.pre || 0).toFixed(1)}</span>
              <input type="range" min="-12" max="6" step="0.5" value={eq.pre || 0} aria-label="Preamp" onChange={e => setEq({ pre: +e.target.value })} /><span className="f">PRE</span></div>
            {FREQS.map((f, i) => (
              <div className="eqb" key={f}><span className="v">{(eq.gains[i] > 0 ? '+' : '') + (eq.gains[i] || 0)}</span>
                <input type="range" min="-12" max="12" step="1" value={eq.gains[i] || 0} aria-label={f + 'Hz'} onChange={e => band(i, +e.target.value)} /><span className="f">{f}</span></div>
            ))}
          </div>
          <div className="row"><button className="btn" onClick={() => pick(PRESETS[0])}>{I.repeat}{L('Đặt lại về phẳng', 'Reset to flat')}</button></div>
        </div>
      </div>

      <div className="set">
        <h3>Video</h3>
        <div className="r"><div className="t"><b>{L('Ẩn video, chỉ nghe', 'Hide video, audio only')}</b><span>{L('Ô Đang phát hiện ảnh bìa; bấm “Xem video” khi cần.', 'Shows cover art; press “Show video” when you want it.')}</span></div>
          <button className={'tg' + (P.videoHidden ? ' on' : '')} role="switch" aria-checked={P.videoHidden} aria-label="Hide video" onClick={() => P.setVideoHidden(!P.videoHidden)} /></div>
        <div className="r"><div className="t"><b>{L('Tiết kiệm khi ẩn video', 'Save data while hidden')}</b><span>{L('Video tải ở 144p khi đang ẩn: đỡ mạng, đỡ máy. Tiếng giữ nguyên chất lượng.', 'Loads video at 144p while hidden. Audio quality unchanged.')}</span></div>
          <button className={'tg' + (settings.lowWhenHidden !== false ? ' on' : '')} role="switch" aria-checked={settings.lowWhenHidden !== false} aria-label="Low quality when hidden" onClick={() => set('lowWhenHidden', settings.lowWhenHidden === false)} /></div>
        <div className="r stack"><div className="t"><b>{L('Chất lượng khi xem video', 'Quality when watching')}</b>
          <span>{stats && stats.res ? `${L('Đang tải', 'Currently')}: ${stats.res}` : ''}</span></div>
          <div className="qgrid">{QUALITIES.map(q => <button key={q[0]} className={'chipb' + ((settings.videoQ || 'auto') === q[0] ? ' on' : '')} onClick={() => set('videoQ', q[0])}>{en ? q[2] : q[1]}</button>)}</div></div>
      </div>
    </div>
  );
}
