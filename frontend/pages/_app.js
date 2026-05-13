import '../styles/globals.css';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { ThemeProvider, useTheme } from '../lib/theme';

function ThemeBody({ children }) {
  const { theme } = useTheme();
  useEffect(() => { document.body.dataset.theme = theme; }, [theme]);
  return children;
}

function InstallBanner() {
  const { t }  = useTheme();
  const [prompt,  setPrompt]  = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const handler = (e) => { e.preventDefault(); setPrompt(e); setVisible(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setVisible(false);
    setPrompt(null);
  };

  const dismiss = () => {
    localStorage.setItem('pwa_dismissed', Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: t.card, border: `1px solid ${t.primaryBorder}`,
      borderRadius: 12, padding: '12px 16px', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: t.shadow, maxWidth: 420, width: 'calc(100vw - 32px)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Add ItsPosting to your home screen</div>
        <div style={{ fontSize: 11, color: t.textMuted }}>Get daily PostCore suggestions as soon as you open your phone</div>
      </div>
      <button onClick={install} style={{ padding: '7px 14px', background: t.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        Add
      </button>
      <button onClick={dismiss} style={{ padding: '7px 8px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 12, cursor: 'pointer' }}>
        ×
      </button>
    </div>
  );
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('[SW] Registered'))
        .catch(err => console.warn('[SW] Registration failed:', err));
    }
  }, []);

  return (
    <ThemeProvider>
      <ThemeBody>
        <Head>
          <meta name="description" content="AI social media automation for local businesses" />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
          <meta name="theme-color" content="#7C5CFC" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="ItsPosting" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/icon-192.png" />
          <link rel="icon" href="/fav-icon.png" />
        </Head>
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <defs>
            <linearGradient id="brand-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#9B4FD4" />
              <stop offset="50%"  stopColor="#C44BB8" />
              <stop offset="100%" stopColor="#E040A0" />
            </linearGradient>
          </defs>
        </svg>
        <Component {...pageProps} />
        <InstallBanner />
      </ThemeBody>
    </ThemeProvider>
  );
}
