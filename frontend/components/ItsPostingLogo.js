import React from 'react';

const SIZES = {
  sm:    { box: 28,  font: 15, gap: 8  },
  md:    { box: 36,  font: 20, gap: 10 },
  lg:    { box: 52,  font: 28, gap: 13 },
  xl:    { box: 72,  font: 38, gap: 16 },
  '2xl': { box: 92,  font: 48, gap: 20 },
  '3xl': { box: 124, font: 64, gap: 26 },
};

const CORNER = 26;

// Lightning bolt centered in 100×100 viewBox
const BOLT = 'M 60,8 L 34,54 L 53,54 L 40,92 L 66,46 L 48,46 Z';

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
              'drop-shadow(0 6px 22px rgba(168,85,247,0.62))',
              'drop-shadow(0 2px 8px rgba(236,72,153,0.38))',
              'drop-shadow(0 1px 2px rgba(0,0,0,0.30))',
            ].join(' '),
      }}
    >
      <defs>
        {/* Purple → pink gradient, 135° diagonal */}
        <linearGradient id={`${gradId}_face`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#A855F7" />
          <stop offset="50%"  stopColor="#C026D3" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>

        {/* Inner ambient highlight */}
        <radialGradient id={`${gradId}_glow`} cx="35%" cy="28%" r="60%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(168,85,247,0)" />
        </radialGradient>

        {/* Top-edge gloss */}
        <linearGradient id={`${gradId}_shine`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.18)" />
          <stop offset="40%"  stopColor="rgba(255,255,255,0.03)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>

        <clipPath id={`${gradId}_clip`}>
          <rect x="0" y="0" width="100" height="100" rx={CORNER} ry={CORNER} />
        </clipPath>
      </defs>

      {/* Base */}
      <rect x="0" y="0" width="100" height="100" rx={CORNER} ry={CORNER}
        fill={`url(#${gradId}_face)`} />

      {/* Ambient glow */}
      <rect x="0" y="0" width="100" height="100" rx={CORNER} ry={CORNER}
        fill={`url(#${gradId}_glow)`} />

      {/* Gloss highlight */}
      <rect x="0" y="0" width="100" height="100" rx={CORNER} ry={CORNER}
        fill={`url(#${gradId}_shine)`} />

      {/* Lightning bolt */}
      <g clipPath={`url(#${gradId}_clip)`}>
        <path d={BOLT} fill="white" opacity="0.95" />
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

  if (variant === 'icon') return iconEl;

  if (variant === 'wordmark-only') {
    return <span style={wordmarkStyle}>ItsPosting</span>;
  }

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
          <path d={BOLT} fill={bolt} opacity="0.95" />
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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {iconEl}
      <span style={wordmarkStyle}>ItsPosting</span>
    </div>
  );
}

export default ItsPostingLogo;
