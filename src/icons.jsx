import React from 'react';

const S = p => ({ viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...p });

export const PAW = <g><ellipse cx="17" cy="27" rx="5" ry="6.5" transform="rotate(-22 17 27)" /><ellipse cx="26.5" cy="17.5" rx="5" ry="6.8" transform="rotate(-8 26.5 17.5)" /><ellipse cx="37.5" cy="17.5" rx="5" ry="6.8" transform="rotate(8 37.5 17.5)" /><ellipse cx="47" cy="27" rx="5" ry="6.5" transform="rotate(22 47 27)" /><path d="M32 30c-7 0-13.8 7.4-15.4 13.8-1.4 5.7 2.7 9.2 7.4 9.2 3 0 5.2-1.6 8-1.6s5 1.6 8 1.6c4.7 0 8.8-3.5 7.4-9.2C45.8 37.4 39 30 32 30z" /></g>;

export const Paw = p => <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" {...p}>{PAW}</svg>;
export const Note = p => <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" {...p}><path d="M24 14v26.5a7 7 0 1 0 4 6.3V24l16-4v14.5a7 7 0 1 0 4 6.3V8z" /></svg>;

export function Logo(p) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...p}>
      <defs><linearGradient id="mlg" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" style={{ stopColor: 'var(--ico1)' }} /><stop offset="1" style={{ stopColor: 'var(--ico2)' }} /></linearGradient></defs>
      <path d="M9 24L11 5.5Q11.6 3 13.6 4.4L25 13h14l11.4-8.6Q52.4 3 53 5.5L55 24v25q0 11-11 11H20Q9 60 9 49z" fill="url(#mlg)" style={{ stroke: 'var(--ico-stroke)', strokeWidth: 1.2 }} />
      <path d="M14.2 10.5l1 8.6 5.6-4.3z" style={{ fill: 'var(--ico-ear)' }} opacity=".9" /><path d="M49.8 10.5l-1 8.6-5.6-4.3z" style={{ fill: 'var(--ico-ear)' }} opacity=".9" />
      <path d="M16 38v-4a16 16 0 0 1 32 0v4" fill="none" style={{ stroke: 'var(--ico-paw)' }} strokeWidth="3.6" strokeLinecap="round" />
      <rect x="12.5" y="35" width="8" height="13" rx="3.5" style={{ fill: 'var(--ico-paw)' }} /><rect x="43.5" y="35" width="8" height="13" rx="3.5" style={{ fill: 'var(--ico-paw)' }} />
      <g style={{ fill: 'var(--ico-paw)' }} transform="translate(32 43) scale(.36) translate(-32 -36)">{PAW}</g>
    </svg>
  );
}

export const I = {
  home: <svg {...S()}><path d="M2.5 7.2L8 2.8l5.5 4.4V13a.7.7 0 0 1-.7.7H10V10H6v3.7H3.2a.7.7 0 0 1-.7-.7z" /></svg>,
  search: <svg {...S({ strokeWidth: 1.6 })}><circle cx="7" cy="7" r="4.6" /><path d="M10.5 10.5L14 14" /></svg>,
  library: <svg {...S({ strokeWidth: 1.6 })}><path d="M3 2.5v11M6.5 2.5v11M10 3l3 10" /></svg>,
  heart: <svg {...S()}><path d="M8 13.6S2 10 2 6a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 7.6-6 7.6z" /></svg>,
  heartFill: <svg {...S({ fill: 'currentColor' })}><path d="M8 13.6S2 10 2 6a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 7.6-6 7.6z" /></svg>,
  clock: <svg {...S({ strokeWidth: 1.6 })}><circle cx="8" cy="8" r="5.6" /><path d="M8 5v3.2l2 1.4" /></svg>,
  gear: <svg {...S({ strokeWidth: 1.4 })}><circle cx="8" cy="8" r="2.1" /><path d="M6.9 1.8h2.2l.4 1.7c.4.2.8.4 1.1.7l1.7-.5 1.1 1.9-1.3 1.2a5 5 0 0 1 0 1.4l1.3 1.2-1.1 1.9-1.7-.5c-.3.3-.7.5-1.1.7l-.4 1.7H6.9l-.4-1.7a4.5 4.5 0 0 1-1.1-.7l-1.7.5-1.1-1.9L3.9 8.7a5 5 0 0 1 0-1.4L2.6 6.1l1.1-1.9 1.7.5c.3-.3.7-.5 1.1-.7z" /></svg>,
  play: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4c0 .6.7 1 1.2.6l8-5.2a.7.7 0 0 0 0-1.2l-8-5.2c-.5-.4-1.2 0-1.2.6z" fill="currentColor" /></svg>,
  pause: <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3.2" height="11" rx="1" fill="currentColor" /><rect x="9.3" y="2.5" width="3.2" height="11" rx="1" fill="currentColor" /></svg>,
  prev: <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="2.5" y="3" width="1.8" height="10" rx=".8" /><path d="M13.5 3.6v8.8c0 .6-.7 1-1.2.6L6.2 8.6a.7.7 0 0 1 0-1.2l6.1-4.4c.5-.4 1.2 0 1.2.6z" /></svg>,
  next: <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="11.7" y="3" width="1.8" height="10" rx=".8" /><path d="M2.5 3.6v8.8c0 .6.7 1 1.2.6l6.1-4.4a.7.7 0 0 0 0-1.2L3.7 3c-.5-.4-1.2 0-1.2.6z" /></svg>,
  shuffle: <svg {...S()}><path d="M2 4.5h2.5c2.5 0 3.5 7 6 7H14M2 11.5h2.5c1 0 1.8-1 2.4-2.2M9.2 6.6c.6-1.1 1.3-2.1 2.3-2.1H14M12.2 2.8L14 4.5l-1.8 1.7M12.2 9.8l1.8 1.7-1.8 1.7" /></svg>,
  repeat: <svg {...S()}><path d="M3 7V6a2 2 0 0 1 2-2h8M11 2l2 2-2 2M13 9v1a2 2 0 0 1-2 2H3M5 14l-2-2 2-2" /></svg>,
  lyrics: <svg {...S()}><path d="M2.5 4h11M2.5 8h7M2.5 12h9" /></svg>,
  queue: <svg {...S()}><path d="M2.5 4h8M2.5 8h8M2.5 12h5M12.5 9.5v4" /><circle cx="11.5" cy="13" r="1.2" fill="currentColor" /></svg>,
  mini: <svg {...S()}><rect x="2" y="3" width="12" height="10" rx="2" /><rect x="8" y="8" width="4.5" height="3.5" rx="1" fill="currentColor" stroke="none" /></svg>,
  vol: <svg {...S()}><path d="M2.5 6v4h2.5l3.5 3V3L5 6z" /><path d="M11 5.5a3.5 3.5 0 0 1 0 5" /></svg>,
  volOff: <svg {...S()}><path d="M2.5 6v4h2.5l3.5 3V3L5 6z" /><path d="M11 6l3 4M14 6l-3 4" /></svg>,
  plus: <svg {...S({ strokeWidth: 1.7 })}><path d="M8 3v10M3 8h10" /></svg>,
  more: <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="12.5" cy="8" r="1.4" /></svg>,
  queueAdd: <svg {...S()}><path d="M2.5 4h8M2.5 8h6M2.5 12h5M12 9v5M9.5 11.5h5" /></svg>,
  trash: <svg {...S()}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /></svg>,
  edit: <svg {...S()}><path d="M10.5 3l2.5 2.5L6 12.5H3.5V10z" /></svg>,
  expand: <svg {...S()}><path d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9" /></svg>,
  shrink: <svg {...S()}><path d="M13.5 6.5h-4v-4M9.5 6.5L14 2M2.5 9.5h4v4M6.5 9.5L2 14" /></svg>,
  close: <svg {...S({ strokeWidth: 1.6 })}><path d="M4 4l8 8M12 4l-8 8" /></svg>,
  left: <svg {...S({ strokeWidth: 1.7 })}><path d="M10 3L5 8l5 5" /></svg>,
  right: <svg {...S({ strokeWidth: 1.7 })}><path d="M6 3l5 5-5 5" /></svg>,
  link: <svg {...S()}><path d="M6.5 9.5l3-3M7 4.5l1.3-1.3a2.8 2.8 0 0 1 4 4L11 8.5M9 11.5l-1.3 1.3a2.8 2.8 0 0 1-4-4L5 7.5" /></svg>,
  download: <svg {...S()}><path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" /></svg>,
  upload: <svg {...S()}><path d="M8 10.5v-8M4.5 6L8 2.5 11.5 6M3 13.5h10" /></svg>,
  folder: <svg {...S()}><path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" /></svg>,
  check: <svg {...S({ strokeWidth: 2 })}><path d="M3.5 8.3l2.8 2.7L12.5 5" /></svg>,
  eye: <svg {...S()}><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></svg>,
  eyeOff: <svg {...S()}><path d="M6.2 3.8A6 6 0 0 1 8 3.5c4.1 0 6.5 4.5 6.5 4.5a11 11 0 0 1-1.7 2.2M10 11.9a6 6 0 0 1-2 .6C3.9 12.5 1.5 8 1.5 8a11 11 0 0 1 2.6-3M2 2l12 12" /></svg>,
  eq: <svg {...S()}><path d="M4 2.5v11M8 2.5v11M12 2.5v11" /><rect x="2.5" y="8.5" width="3" height="2" rx=".8" fill="currentColor" /><rect x="6.5" y="4.5" width="3" height="2" rx=".8" fill="currentColor" /><rect x="10.5" y="9.5" width="3" height="2" rx=".8" fill="currentColor" /></svg>,
  grip: <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="6" cy="4" r="1.1" /><circle cx="10" cy="4" r="1.1" /><circle cx="6" cy="8" r="1.1" /><circle cx="10" cy="8" r="1.1" /><circle cx="6" cy="12" r="1.1" /><circle cx="10" cy="12" r="1.1" /></svg>,
};
