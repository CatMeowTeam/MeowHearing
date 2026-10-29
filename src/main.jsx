import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@fontsource/be-vietnam-pro/latin-700.css';
import '@fontsource/nunito/vietnamese-800.css';
import '@fontsource/nunito/vietnamese-900.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/caveat/latin-ext-700.css';


import '@fontsource/caveat/latin-700.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import './styles.css';
import { UIProvider, PlayerProvider } from './ctx';
import App from './App';
import Mini from './Mini';
import { applySkin } from './theme';
import { PAW } from './icons';

const isMini = location.hash === '#mini';

function Paws() {
  return (
    <svg className="paws" aria-hidden="true"><defs>
      <g id="pawg">{PAW}</g>
      <g id="noteg"><path d="M24 14v26.5a7 7 0 1 0 4 6.3V24l16-4v14.5a7 7 0 1 0 4 6.3V8z" /></g>
      <pattern id="pp" width="180" height="180" patternUnits="userSpaceOnUse"><g opacity=".055" style={{ fill: 'var(--accent)' }}>
        <use href="#pawg" transform="translate(26 30) rotate(-18) scale(.42)" /><use href="#noteg" transform="translate(112 100) rotate(12) scale(.38)" /></g></pattern>
    </defs><rect width="100%" height="100%" fill="url(#pp)" /></svg>
  );
}

function Root() {
  const [settings, setSettings] = useState(null);
  useEffect(() => { window.meow.getSettings().then(setSettings); }, []);
  useEffect(() => {
    if (!settings || isMini) return;
    applySkin(settings.skin);
    document.documentElement.lang = settings.lang === 'en' ? 'en' : 'vi';
    if (settings.skin && settings.skin !== 'auto') return;
    const mq = matchMedia('(prefers-color-scheme: dark)'); const h = () => applySkin('auto');
    mq.addEventListener('change', h); return () => mq.removeEventListener('change', h);
  }, [settings && settings.skin, settings && settings.lang]); // eslint-disable-line
  if (!settings) return null;
  if (isMini) return <Mini settings={settings} />;
  return (
    <UIProvider settings={settings} setSettings={setSettings}>
      <PlayerProvider>
        <Paws />
        <App />
      </PlayerProvider>
    </UIProvider>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
