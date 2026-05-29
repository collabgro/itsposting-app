import { useEffect, useState, useRef } from 'react';
import { ItsPostingLogo } from './ItsPostingLogo';

/**
 * AppLoader — Cinematic full-screen loading splash
 *
 * Design brief: what Apple, Google, and Canva would build together.
 * Shows for a minimum of 1.2s (brand impression), then fades out.
 *
 * Layers (back → front):
 *   1. Deep space background (#05050A) — matches app bg
 *   2. Radial ambient purple fog behind logo
 *   3. Two expanding rounded-square rings (pulsing outward)
 *   4. Logo icon — scale + fade entrance with spring overshoot
 *   5. Wordmark — slides up from below, 300ms after logo
 *   6. "Powered by PostCore AI" — appears 500ms after logo
 *   7. Loading dots (3× bouncing) at bottom
 *   8. Holographic scan line across logo (optional premium touch)
 *
 * Exit: entire screen fades out in 380ms once `ready` is signalled.
 */

export default function AppLoader({ ready }) {
  const [phase, setPhase] = useState('enter'); // 'enter' | 'idle' | 'exit' | 'gone'
  const minTimeRef = useRef(false);
  const readyRef = useRef(false);

  // Minimum display time: 1200ms so branding registers
  useEffect(() => {
    const t = setTimeout(() => {
      minTimeRef.current = true;
      if (readyRef.current) setPhase('exit');
    }, 1200);
    // Absolute maximum: never block the user beyond 3.5s
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
    const t = setTimeout(() => setPhase('gone'), 420);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'gone') return null;

  const exiting = phase === 'exit';

  return (
    <div
      aria-label="Loading ItsPosting"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#05050A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        // Exit: scale very slightly up + fade (like a portal opening)
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'scale(1.04)' : 'scale(1)',
        transition: exiting ? 'opacity 380ms ease-in, transform 380ms ease-in' : 'none',
        pointerEvents: 'all',
        overflow: 'hidden',
      }}
    >
      {/* ── Deep space background noise texture (CSS, no image) ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          radial-gradient(ellipse at 50% 45%, rgba(124,92,252,0.13) 0%, transparent 62%),
          radial-gradient(ellipse at 20% 80%, rgba(0,132,255,0.05) 0%, transparent 45%),
          radial-gradient(ellipse at 80% 15%, rgba(192,132,252,0.06) 0%, transparent 38%)
        `,
        backgroundAttachment: 'fixed',
      }} />

      {/* ── Radial ambient glow behind the icon ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 560,
          height: 560,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,92,252,0.18) 0%, rgba(76,29,149,0.08) 40%, transparent 72%)',
          filter: 'blur(40px)',
          animation: 'loaderAmbientPulse 3.2s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* ── Ring 1: expands from icon, then fades ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 148,
          height: 148,
          borderRadius: '28%',
          border: '1.5px solid rgba(124,92,252,0.30)',
          animation: 'loaderRingExpand 2.6s cubic-bezier(0.16,1,0.3,1) infinite',
          pointerEvents: 'none',
        }}
      />
      {/* ── Ring 2: delayed by 0.65s ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 148,
          height: 148,
          borderRadius: '28%',
          border: '1px solid rgba(124,92,252,0.18)',
          animation: 'loaderRingExpand 2.6s cubic-bezier(0.16,1,0.3,1) 0.65s infinite',
          pointerEvents: 'none',
        }}
      />
      {/* ── Ring 3: faint outer ring, delayed 1.3s ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 148,
          height: 148,
          borderRadius: '28%',
          border: '1px solid rgba(124,92,252,0.10)',
          animation: 'loaderRingExpand 2.6s cubic-bezier(0.16,1,0.3,1) 1.3s infinite',
          pointerEvents: 'none',
        }}
      />

      {/* ── Logo icon ── */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        animation: 'loaderIconEnter 520ms cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        <ItsPostingLogo variant="icon" size="xl" />

        {/* ── Holographic scan line across the icon ── */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '100%',
            borderRadius: 18,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 40%, rgba(192,132,252,0.80) 50%, rgba(255,255,255,0.55) 60%, transparent 100%)',
            borderRadius: 2,
            animation: 'loaderScanLine 2.8s ease-in-out 0.6s infinite',
          }} />
        </div>
      </div>

      {/* ── Wordmark ── */}
      <div style={{
        marginTop: 22,
        position: 'relative',
        zIndex: 2,
        animation: 'loaderWordmarkEnter 420ms cubic-bezier(0.16,1,0.3,1) 320ms both',
      }}>
        <span style={{
          fontWeight: 800,
          fontSize: 28,
          letterSpacing: '-0.04em',
          color: '#F5F5F7',
          lineHeight: 1,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
        }}>
          ItsPosting
        </span>
      </div>

      {/* ── PostCore tagline ── */}
      <div style={{
        marginTop: 9,
        position: 'relative',
        zIndex: 2,
        animation: 'loaderTaglineEnter 380ms cubic-bezier(0.16,1,0.3,1) 520ms both',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
      }}>
        {/* Tiny sparkle / AI dot */}
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C5CFC, #A855F7)',
          boxShadow: '0 0 8px rgba(124,92,252,0.8)',
          animation: 'loaderAmbientPulse 1.8s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.38)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          fontWeight: 500,
        }}>
          Powered by PostCore AI
        </span>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #A855F7, #7C5CFC)',
          boxShadow: '0 0 8px rgba(124,92,252,0.8)',
          animation: 'loaderAmbientPulse 1.8s ease-in-out 0.9s infinite',
        }} />
      </div>

      {/* ── Loading indicator (3 bouncing dots) ── */}
      <div style={{
        position: 'absolute',
        bottom: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        animation: 'loaderTaglineEnter 380ms cubic-bezier(0.16,1,0.3,1) 700ms both',
      }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'rgba(124,92,252,0.75)',
              animation: `loaderDotBounce 1.4s ease-in-out ${i * 0.18}s infinite`,
              boxShadow: '0 0 8px rgba(124,92,252,0.5)',
            }}
          />
        ))}
      </div>

      {/* ── Subtle bottom gradient fade (helps blend loading dots) ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 160,
          background: 'linear-gradient(to top, rgba(5,5,10,0.6) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
