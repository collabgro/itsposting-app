import '../styles/globals.css';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { ThemeProvider, useTheme } from '../lib/theme';
import { ToastProvider } from '../components/ui';

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

  const isSmall = typeof window !== 'undefined' && window.innerWidth < 768;
  return (
    <div style={{
      position: 'fixed',
      bottom: isSmall ? 76 : 20,
      left: '50%', transform: 'translateX(-50%)',
      background: t.card, border: `1px solid ${t.primaryBorder}`,
      borderRadius: 14, padding: '12px 16px', zIndex: 9998,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: t.shadowMd || t.shadow, maxWidth: 420, width: 'calc(100vw - 32px)',
      animation: 'slideUpIn 300ms cubic-bezier(0.16,1,0.3,1)',
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
        .then(() => {})
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
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=EB+Garamond:wght@400;700&family=Inter:wght@400;600;700&family=Lato:wght@400;700&family=Lora:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;600;700&family=Nunito:wght@400;600;700&family=Open+Sans:wght@400;600;700&family=Oswald:wght@400;600;700&family=Pacifico&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;600;700&family=Raleway:wght@400;600;700&family=Roboto:wght@400;700&family=Source+Sans+3:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        </Head>
        <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }} aria-hidden="true">
          <defs>
            {/* brand-gradient — teal → purple → lavender (nav active icons, logo) */}
            <linearGradient id="brand-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#00C4CC" />
              <stop offset="50%"  stopColor="#7C5CFC" />
              <stop offset="100%" stopColor="#9B7FFF" />
            </linearGradient>
            {/* ip-grad-primary — indigo → violet (most UI actions) */}
            <linearGradient id="ip-grad-primary" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#9450E6" />
              <stop offset="60%"  stopColor="#7C5CFC" />
              <stop offset="100%" stopColor="#CD4B91" />
            </linearGradient>
            {/* ip-grad-success — mint → green */}
            <linearGradient id="ip-grad-success" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#34C759" />
              <stop offset="100%" stopColor="#30D158" />
            </linearGradient>
            {/* ip-grad-warning — amber → orange */}
            <linearGradient id="ip-grad-warning" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#FFD60A" />
              <stop offset="100%" stopColor="#FF9F0A" />
            </linearGradient>
            {/* ip-grad-error — coral → red */}
            <linearGradient id="ip-grad-error" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#FF6B62" />
              <stop offset="100%" stopColor="#FF453A" />
            </linearGradient>
            {/* ip-grad-info — sky → blue */}
            <linearGradient id="ip-grad-info" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#34AADC" />
              <stop offset="100%" stopColor="#0A84FF" />
            </linearGradient>
            {/* ip-grad-teal — cyan → cobalt */}
            <linearGradient id="ip-grad-teal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#00C4CC" />
              <stop offset="100%" stopColor="#0A84FF" />
            </linearGradient>
            {/* ip-grad-orange — gold → tangerine */}
            <linearGradient id="ip-grad-orange" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#FFAC30" />
              <stop offset="100%" stopColor="#FF6B00" />
            </linearGradient>
            {/* ip-grad-pink — rose → magenta */}
            <linearGradient id="ip-grad-pink" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#FF6CAB" />
              <stop offset="100%" stopColor="#CD4B91" />
            </linearGradient>
            {/* 3D depth filter for filled icons */}
            <filter id="ip-depth-fill" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="rgba(0,0,0,0.5)" floodOpacity="1" />
              <feDropShadow dx="0" dy="0.5" stdDeviation="0.4" floodColor="rgba(0,0,0,0.3)" floodOpacity="1" />
            </filter>
            {/* Glow filter for active/hover states */}
            <filter id="ip-glow-primary" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(124,92,252,0.7)" floodOpacity="1" />
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="rgba(124,92,252,0.4)" floodOpacity="1" />
            </filter>
          </defs>
        </svg>
        <ToastProvider>
          <Component {...pageProps} />
          <InstallBanner />
        </ToastProvider>
      </ThemeBody>
    </ThemeProvider>
  );
}
