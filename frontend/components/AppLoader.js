import { useEffect, useState, useRef } from 'react';
import { ItsPostingLogo } from './ItsPostingLogo';

/**
 * AppLoader — Google/Gmail-style loading splash
 *
 * White background, centered logo icon, thin indeterminate brand-color progress bar,
 * wordmark underneath. Minimum 1.2s display, max 3.5s, then fades out.
 */

// Read persisted Zustand store — available on returning visits before auth hook fires
function getCachedBrand() {
  if (typeof window === 'undefined') return { appName: 'ItsPosting', logo: null };
  try {
    const stored = JSON.parse(localStorage.getItem('postflow-auth') || '{}');
    const wl = stored?.state?.user?.white_label_config || {};
    return { appName: wl.agencyName || 'ItsPosting', logo: wl.logo || null };
  } catch { return { appName: 'ItsPosting', logo: null }; }
}

export default function AppLoader({ ready }) {
  const [phase, setPhase] = useState('enter'); // 'enter' | 'idle' | 'exit' | 'gone'
  const minTimeRef = useRef(false);
  const readyRef = useRef(false);
  const { appName, logo } = getCachedBrand();

  useEffect(() => {
    const t = setTimeout(() => {
      minTimeRef.current = true;
      if (readyRef.current) setPhase('exit');
    }, 1200);
    const max = setTimeout(() => setPhase('exit'), 3500);
    return () => { clearTimeout(t); clearTimeout(max); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    readyRef.current = true;
    if (minTimeRef.current) setPhase('exit');
  }, [ready]);

  useEffect(() => {
    if (phase !== 'exit') return;
    const t = setTimeout(() => setPhase('gone'), 320);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'gone') return null;

  const exiting = phase === 'exit';

  return (
    <div
      aria-label={`Loading ${appName}`}
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: exiting ? 0 : 1,
        transition: exiting ? 'opacity 300ms ease-in' : 'none',
        pointerEvents: 'all',
      }}
    >
      {/* ── Logo icon — entrance: scale from 0.88 → 1 + fade in ── */}
      <div style={{
        animation: 'ipLoaderIconEnter 440ms cubic-bezier(0.34,1.4,0.64,1) both',
      }}>
        {logo
          ? <img src={logo} alt={appName} style={{ height: 72, maxWidth: 220, objectFit: 'contain' }} />
          : <ItsPostingLogo variant="icon" size="3xl" theme="light" noShadow />
        }
      </div>

      {/* ── Thin indeterminate progress bar ── */}
      <div style={{
        width: 128,
        height: 3,
        borderRadius: 2,
        background: 'rgba(124,92,252,0.12)',
        overflow: 'hidden',
        marginTop: 32,
        position: 'relative',
        animation: 'ipLoaderBarEnter 300ms ease 360ms both',
      }}>
        {/* sliding filled segment */}
        <div style={{
          position: 'absolute',
          top: 0,
          height: '100%',
          width: '45%',
          background: 'linear-gradient(90deg, #7C5CFC 0%, #A78BFA 100%)',
          borderRadius: 2,
          animation: 'ipLoaderBarSlide 1.5s cubic-bezier(0.4,0,0.6,1) 360ms infinite',
        }} />
      </div>

      {/* ── Wordmark ── */}
      <div style={{
        marginTop: 20,
        animation: 'ipLoaderWordmarkEnter 380ms cubic-bezier(0.16,1,0.3,1) 260ms both',
      }}>
        <span style={{
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: '-0.02em',
          color: '#1a1a2e',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
        }}>
          {appName}
        </span>
      </div>

      <style>{`
        @keyframes ipLoaderIconEnter {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes ipLoaderWordmarkEnter {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ipLoaderBarEnter {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ipLoaderBarSlide {
          0%   { left: -50%; }
          100% { left: 110%; }
        }
      `}</style>
    </div>
  );
}
