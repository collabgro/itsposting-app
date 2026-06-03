import '../styles/globals.css';
import React, { useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ThemeProvider, useTheme } from '../lib/theme';
import { ToastProvider } from '../components/ui';
import AppLoader from '../components/AppLoader';
import { ItsPostingLogo } from '../components/ItsPostingLogo';
import { notificationsAPI } from '../lib/api';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    Sentry.captureException(error, { extra: info });
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#07070E', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: 24,
      }}>
        <div style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <ItsPostingLogo variant="icon" size="xl" theme="dark" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F5F7', letterSpacing: '-0.03em', marginBottom: 10 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 14, color: '#6E6E73', lineHeight: 1.6, marginBottom: 32 }}>
            ItsPosting hit an unexpected error. Your posts and data are safe — this is just a display issue.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{
                padding: '11px 22px', background: 'linear-gradient(135deg,#7C5CFC,#9B7FFF)', border: 'none',
                borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(124,92,252,0.4)',
              }}
            >
              Refresh page
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/dashboard'; }}
              style={{
                padding: '11px 22px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: '#ABABAB', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Go to dashboard
            </button>
          </div>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre style={{ marginTop: 28, padding: 16, background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 10, fontSize: 11, color: '#FF453A', textAlign: 'left', overflowX: 'auto', lineHeight: 1.5 }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

function ThemeBody({ children }) {
  const { theme } = useTheme();
  useEffect(() => { document.body.dataset.theme = theme; }, [theme]);
  return children;
}

function GlobalToast() {
  const { t } = useTheme();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const onExpired = () => {
      setToast({ msg: 'Your session expired. Signing you back in…', type: 'warning' });
    };
    const onError = (e) => {
      setToast({ msg: e.detail?.message || 'Something went wrong. Please try again.', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    };
    window.addEventListener('itsposting:session-expired', onExpired);
    window.addEventListener('itsposting:server-error', onError);
    return () => {
      window.removeEventListener('itsposting:session-expired', onExpired);
      window.removeEventListener('itsposting:server-error', onError);
    };
  }, []);

  if (!toast) return null;

  const colors = {
    warning: { bg: 'rgba(255,159,10,0.12)', border: 'rgba(255,159,10,0.35)', icon: '#FF9F0A', dot: '#FF9F0A' },
    error:   { bg: 'rgba(255,69,58,0.12)',  border: 'rgba(255,69,58,0.35)',  icon: '#FF453A', dot: '#FF453A' },
  };
  const c = colors[toast.type] || colors.error;

  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 99999, maxWidth: 440, width: 'calc(100vw - 32px)',
      background: c.bg, border: `1px solid ${c.border}`,
      backdropFilter: 'blur(20px) saturate(160%)',
      borderRadius: 12, padding: '13px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      animation: 'slideDownIn 250ms cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: c.dot, flexShrink: 0,
        boxShadow: `0 0 8px ${c.dot}`,
      }} />
      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.4 }}>
        {toast.msg}
      </div>
      {toast.type !== 'warning' && (
        <button
          onClick={() => setToast(null)}
          style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
        >×</button>
      )}
    </div>
  );
}

const AUTH_PAGES = ['/login', '/signup', '/forgot-password', '/reset-password', '/accept-invite', '/select-account', '/welcome'];

function InstallBanner() {
  const { t }   = useTheme();
  const router  = useRouter();
  const [prompt,   setPrompt]   = useState(null);
  const [visible,  setVisible]  = useState(false);
  const [isIOS,    setIsIOS]    = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Don't show if already installed as a PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    // Respect 7-day dismiss
    const dismissed = localStorage.getItem('pwa_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Detect iOS Safari (beforeinstallprompt never fires on iOS)
    const ua = navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    if (iosDevice) {
      setIsIOS(true);
      setVisible(true);
    }

    // Android / Chrome / Edge — standard install prompt
    const handler = (e) => { e.preventDefault(); setPrompt(e); setVisible(true); };
    window.addEventListener('beforeinstallprompt', handler);

    // Reactive mobile size for banner positioning
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('resize', checkMobile);
    };
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

  if (!visible || AUTH_PAGES.includes(router.pathname)) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? 76 : 20,
      left: '50%', transform: 'translateX(-50%)',
      background: t.card, border: `1px solid ${t.primaryBorder || t.border}`,
      borderRadius: 14, padding: '12px 16px', zIndex: 9998,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: t.shadowMd || t.shadow, maxWidth: 440, width: 'calc(100vw - 32px)',
      animation: 'slideUpIn 300ms cubic-bezier(0.16,1,0.3,1)',
    }}>
      {isIOS ? (
        /* iOS: no install prompt API — show manual instructions */
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>
            Add ItsPosting to your home screen
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
            Tap <strong style={{ color: t.text }}>Share</strong>{' '}
            <span style={{ fontSize: 13 }}>&#8679;</span>{' '}
            then <strong style={{ color: t.text }}>Add to Home Screen</strong>
          </div>
        </div>
      ) : (
        <>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>Add ItsPosting to your home screen</div>
            <div style={{ fontSize: 11, color: t.textMuted }}>Get PostCore AI suggestions the moment you open your phone</div>
          </div>
          <button
            onClick={install}
            style={{ padding: '7px 14px', background: t.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Add
          </button>
        </>
      )}
      <button
        onClick={dismiss}
        style={{ padding: '6px 8px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 14, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export default function App({ Component, pageProps }) {
  // AppLoader: show on initial app load only (not on client-side navigations)
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {})
        .catch(err => console.warn('[SW] Registration failed:', err));
    }
    // Signal readiness after fonts + critical resources are parsed
    if (document.readyState === 'complete') {
      setAppReady(true);
    } else {
      const onLoad = () => setAppReady(true);
      window.addEventListener('load', onLoad);
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  // Web push subscription — runs once after mount, only if logged in
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!localStorage.getItem('token')) return;

    async function setupPush() {
      try {
        const { data } = await notificationsAPI.getPushPublicKey();
        if (!data.publicKey) return; // VAPID not configured on server

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.publicKey),
          });
        }
        await notificationsAPI.savePushSubscription(sub.toJSON());
      } catch { /* silent — push is optional */ }
    }

    // Delay slightly so page loads don't compete with the permission prompt
    const timer = setTimeout(setupPush, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Inject Inter (UI font) after hydration — avoids render-blocking resource warning
  useEffect(() => {
    if (!document.getElementById('font-inter')) {
      const link = document.createElement('link');
      link.id = 'font-inter';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <ThemeProvider>
      <ThemeBody>
        <AppLoader ready={appReady} />
        <Head>
          <meta name="description" content="AI social media automation for local businesses" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          {/* Theme color: matches dark bg in dark mode, white in light mode */}
          <meta name="theme-color" media="(prefers-color-scheme: dark)"  content="#07070E" />
          <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F0F0F7" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          {/* black-translucent lets the status bar overlay page content (needed for viewport-fit=cover) */}
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="ItsPosting" />
          <meta name="application-name" content="ItsPosting" />
          <meta name="format-detection" content="telephone=no" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
          <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
          <link rel="icon" href="/fav-icon.png" />
          {/* Apple splash screens — portrait, one per device size */}
          <link rel="apple-touch-startup-image" media="screen and (device-width:320px) and (device-height:568px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait)" href="/splash/apple-splash-640-1136.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:375px) and (device-height:667px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait)" href="/splash/apple-splash-750-1334.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:414px) and (device-height:896px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait)" href="/splash/apple-splash-828-1792.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:375px) and (device-height:812px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/apple-splash-1125-2436.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:390px) and (device-height:844px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/apple-splash-1170-2532.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:393px) and (device-height:852px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/apple-splash-1179-2556.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:414px) and (device-height:736px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/apple-splash-1242-2208.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:414px) and (device-height:896px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/apple-splash-1242-2688.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:428px) and (device-height:926px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/apple-splash-1284-2778.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:430px) and (device-height:932px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/apple-splash-1290-2796.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:768px) and (device-height:1024px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait)" href="/splash/apple-splash-1536-2048.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:834px) and (device-height:1112px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait)" href="/splash/apple-splash-1668-2224.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:834px) and (device-height:1194px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait)" href="/splash/apple-splash-1668-2388.png" />
          <link rel="apple-touch-startup-image" media="screen and (device-width:1024px) and (device-height:1366px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait)" href="/splash/apple-splash-2048-2732.png" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://res.cloudinary.com" />
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
          <GlobalToast />
          <ErrorBoundary>
            <Component {...pageProps} />
          </ErrorBoundary>
          <InstallBanner />
        </ToastProvider>
      </ThemeBody>
    </ThemeProvider>
  );
}
