export const SKINS = [
  { id: 'auto', name: ['Theo Windows', 'Follow Windows'], a: '#f7f1ef', b: '#2a2530' },
  { id: 'cam', name: ['Mướp', 'Tabby'], a: '#f7ece6', b: '#e8732c' },
  { id: 'trang', name: ['Trắng', 'White'], a: '#ffffff', b: '#4f86d9' },
  { id: 'hong', name: ['Hồng', 'Pink'], a: '#fbe6ee', b: '#df568a' },
  { id: 'xam', name: ['Xám', 'Grey'], a: '#e3e8ee', b: '#2f9467' },
  { id: 'mun', name: ['Mun', 'Midnight'], a: '#19161c', b: '#ffb547' },
];
const FG = { cam: ['#2b1f1b', '#f7f1ef'], trang: ['#1d2433', '#f8f9fb'], hong: ['#34202a', '#fcf0f4'], xam: ['#1c2630', '#edf0f3'], mun: ['#f2ece8', '#121014'] };

export function resolveSkin(pick) {
  if (!pick || pick === 'auto') return matchMedia('(prefers-color-scheme: dark)').matches ? 'mun' : 'cam';
  return FG[pick] ? pick : 'cam';
}

export function applySkin(pick, notify = true) {
  const s = resolveSkin(pick);
  document.documentElement.setAttribute('data-skin', s);
  if (notify && window.meow) window.meow.theme({ skin: s, dark: s === 'mun', fg: FG[s][0], bg: FG[s][1] });
  return s;
}
