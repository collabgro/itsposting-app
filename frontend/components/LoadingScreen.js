import React, { useEffect, useState } from 'react';
import ItsPostingLogo from './ItsPostingLogo';
import { useTheme } from '../lib/theme';

// Full-page branded loading screen — replaces plain spinner on initial page load.
// Usage: <LoadingScreen /> or <LoadingScreen message="Generating your post..." />
export function LoadingScreen({ message = null, overlay = false }) {
  const { t } = useTheme();
  const [dots, setDots] = useState('');
  const [shimmerX, setShimmerX] = useState(-100);

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(dotTimer);
  }, []);

  useEffect(() => {
    let raf;
    let start = null;
    const duration = 1600;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = ((ts - start) % duration) / duration;
      setShimmerX(-100 + progress * 300);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  const containerStyle = overlay ? {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: t.isDark ? 'rgba(6,5,14,0.92)' : 'rgba(248,246,255,0.92)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  } : {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: t.isDark
      ? 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,92,252,0.12) 0%, transparent 70%), #06050E'
      : 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,92,252,0.08) 0%, transparent 70%), #F8F6FF',
  };

  return (
    <div style={containerStyle}>
      {/* Ambient orbs */}
      <div style={{
        position: 'absolute', top: '20%', left: '30%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,92,252,0.12) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '25%', right: '25%',
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)',
        filter: 'blur(30px)', pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, position: 'relative' }}>
        {/* Logo with subtle pulse */}
        <div style={{
          animation: 'ipLogoPulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite',
        }}>
          <ItsPostingLogo size="xl" variant="icon" theme={t.isDark ? 'dark' : 'light'} />
        </div>

        {/* Wordmark */}
        <div style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: t.text,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
        }}>
          ItsPosting
        </div>

        {/* Progress shimmer bar */}
        <div style={{
          width: 200,
          height: 3,
          borderRadius: 4,
          background: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,92,252,0.12)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            background: 'linear-gradient(90deg, transparent 0%, #7C5CFC 40%, #A78BFA 50%, #7C5CFC 60%, transparent 100%)',
            transform: `translateX(${shimmerX}%)`,
            transition: 'none',
          }} />
        </div>

        {/* Message */}
        {message && (
          <div style={{
            fontSize: 13,
            fontWeight: 500,
            color: t.textMuted,
            letterSpacing: '0.01em',
          }}>
            {message}{dots}
          </div>
        )}
      </div>

      <style>{`
        @keyframes ipLogoPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(0.96); }
        }
      `}</style>
    </div>
  );
}

// Inline spinner — use inside buttons or small content areas
// Stays the same size as the text around it, no layout shift
export function InlineSpinner({ size = 16, color = '#7C5CFC' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'ipSpin 0.7s linear infinite', flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <style>{`@keyframes ipSpin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

// Skeleton shimmer block — drop-in replacement for loading content
export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style = {} }) {
  const { t } = useTheme();
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: t.isDark
        ? 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)'
        : 'linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 100%)',
      backgroundSize: '200% 100%',
      animation: 'ipSkeletonSlide 1.6s ease-in-out infinite',
      flexShrink: 0,
      ...style,
    }}>
      <style>{`@keyframes ipSkeletonSlide { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

export default LoadingScreen;
