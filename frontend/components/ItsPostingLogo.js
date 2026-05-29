import React from 'react';

const SIZES = {
  sm:    { box: 28,  font: 15, gap: 8  },
  md:    { box: 36,  font: 20, gap: 10 },
  lg:    { box: 52,  font: 28, gap: 13 },
  xl:    { box: 72,  font: 38, gap: 16 },
  '2xl': { box: 92,  font: 48, gap: 20 },
  '3xl': { box: 124, font: 64, gap: 26 },
};

// iOS-style corner radius — ~26% of 100×100 viewBox
const CORNER = 26;

// 4-pointed spark star (✦) centered at (50,50)
// Outer tips at cardinal points (r=43), inner bends at diagonals (r=11)
// Outer: top(50,7) right(93,50) bottom(50,93) left(7,50)
// Inner: TR(58,42) BR(58,58) BL(42,58) TL(42,42)
const SPARK = 'M 50,7 L 58,42 L 93,50 L 58,58 L 50,93 L 42,58 L 7,50 L 42,42 Z';

function IconMark({ size, gradId, noShadow = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        flexShrink: 0,
        display: 'block',
        filter: noShadow
          ? undefined
          : [
              'drop-shadow(0 6px 22px rgba(109,40,217,0.62))',
              'drop-shadow(0 2px 8px rgba(124,92,252,0.42))',
              'drop-shadow(0 1px 2px rgba(0,0,0,0.30))',
            ].join(' '),
      }}
    >
      <defs>
        {/* Main face: deep violet → brand purple → light lavender — 135° diagonal */}
        <linearGradient id={`${gradId}_face`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#3B0D75" />
          <stop offset="28%"  stopColor="#6D28D9" />
          <stop offset="64%"  stopColor="#7C5CFC" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>

        {/* Inner ambient glow — subtle radial highlight from center */}
        <radialGradient id={`${gradId}_glow`} cx="40%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="rgba(196,181,253,0.30)" />
          <stop offset="100%" stopColor="rgba(109,40,217,0)" />
        </radialGradient>

        {/* Top-edge gloss shimmer */}
        <linearGradient id={`${gradId}_shine`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.20)" />
          <stop offset="38%"  stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>

        {/* Spark mark gradient — white centre, slightly warm at tips */}
        <radialGradient id={`${gradId}_spark`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="rgba(233,213,255,0.92)" />
        </radialGradient>

        {/* Clip to rounded-square */}
        <clipPath id={`${gradId}_clip`}>
          <rect x="0" y="0" width="100" height="100" rx={CORNER} ry={CORNER} />
        </clipPath>
      </defs>

      {/* ── Base rounded-square ── */}
      <rect x="0" y="0" width="100" height="100" rx={CORNER} ry={CORNER}
        fill={`url(#${gradId}_face)`} />

      {/* ── Ambient inner glow ── */}
      <rect x="0" y="0" width="100" height="100" rx={CORNER} ry={CORNER}
        fill={`url(#${gradId}_glow)`} />

      {/* ── Top-edge gloss highlight ── */}
      <rect x="0" y="0" width="100" height="100" rx={CORNER} ry={CORNER}
        fill={`url(#${gradId}_shine)`} />

      {/* ── Spark mark (clipped to rounded square) ── */}
      <g clipPath={`url(#${gradId}_clip)`}>
        {/* 4-pointed star */}
        <path d={SPARK} fill={`url(#${gradId}_spark)`} />
        {/* Centre dot — anchors the mark, represents the "post" pulse */}
        <circle cx="50" cy="50" r="6.5"
          fill="white" opacity="0.92" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// variants: 'full' | 'icon' | 'wordmark-only' | 'monochrome'
// ─────────────────────────────────────────────────────────────────────────────
export function ItsPostingLogo({
  size     = 'md',
  variant  = 'full',
  theme    = 'dark',
  noShadow = false,
}) {
  const dims  = SIZES[size] || SIZES.md;
  const { box, font, gap } = dims;
  const gradId = `ipLogo_${size}_${variant}`;

  // Wordmark text style — gradient shimmer on dark, solid on light
  const wordmarkStyle = {
    fontWeight: 800,
    fontSize: font,
    letterSpacing: '-0.032em',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    fontFamily: [
      '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
      '"Segoe UI"', 'system-ui', 'sans-serif',
    ].join(', '),
    // Gradient text on dark theme; solid on light
    ...(theme === 'dark'
      ? {
          background: 'linear-gradient(135deg, #E9D5FF 0%, #FFFFFF 45%, #C4B5FD 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }
      : { color: '#111827' }),
  };

  const iconEl = <IconMark size={box} gradId={gradId} noShadow={noShadow} />;

  // ── icon-only ──
  if (variant === 'icon') return iconEl;

  // ── wordmark-only ──
  if (variant === 'wordmark-only') {
    return <span style={wordmarkStyle}>ItsPosting</span>;
  }

  // ── monochrome ──
  if (variant === 'monochrome') {
    const mc   = theme === 'light' ? '#111827' : '#FFFFFF';
    const bolt = theme === 'light' ? '#FFFFFF'  : '#000000';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap }}>
        <svg
          width={box} height={box}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0, display: 'block' }}
        >
          <rect x="0" y="0" width="100" height="100" rx={CORNER} ry={CORNER} fill={mc} />
          <path d={SPARK} fill={bolt} />
          <circle cx="50" cy="50" r="6.5"
            fill={bolt} opacity="0.8" />
        </svg>
        <span style={{
          ...wordmarkStyle,
          background: undefined,
          WebkitBackgroundClip: undefined,
          WebkitTextFillColor: undefined,
          backgroundClip: undefined,
          color: theme === 'light' ? '#111827' : '#FFFFFF',
        }}>
          ItsPosting
        </span>
      </div>
    );
  }

  // ── full (default) — icon + wordmark ──
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {iconEl}
      <span style={wordmarkStyle}>ItsPosting</span>
    </div>
  );
}

export default ItsPostingLogo;
