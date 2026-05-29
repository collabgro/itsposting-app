import React from 'react';

const SIZES = {
  sm:    { box: 28,  font: 16, gap: 8  },
  md:    { box: 38,  font: 21, gap: 10 },
  lg:    { box: 54,  font: 29, gap: 13 },
  xl:    { box: 76,  font: 40, gap: 16 },
  '2xl': { box: 96,  font: 50, gap: 20 },
  '3xl': { box: 128, font: 66, gap: 26 },
};

// iOS-style corner radius — very rounded, ~28% of 100×100 viewBox
const CORNER = 28;

// 6-point lightning bolt, centered at (50,50) in 100×100 viewBox
// Traces: top-tip → left-inner → right-ear → bottom-tip → right-inner → left-ear → close
const BOLT = 'M 63,8 L 45,50 L 70,50 L 37,92 L 55,50 L 30,50 Z';

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
        filter: noShadow ? undefined
          : 'drop-shadow(0 6px 20px rgba(147,51,234,0.55)) drop-shadow(0 2px 6px rgba(236,72,153,0.35))',
      }}
    >
      <defs>

        {/* Main face gradient — vivid violet → hot pink, diagonal */}
        <linearGradient
          id={`${gradId}_face`}
          x1="0%" y1="0%" x2="100%" y2="100%"
        >
          <stop offset="0%"   stopColor="#9333EA" />
          <stop offset="55%"  stopColor="#A855F7" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>

        {/* Clip to rounded-square face */}
        <clipPath id={`${gradId}_clip`}>
          <rect x="0" y="0" width="100" height="100" rx={CORNER} ry={CORNER} />
        </clipPath>

      </defs>

      {/* Rounded square container */}
      <rect
        x="0" y="0" width="100" height="100"
        rx={CORNER} ry={CORNER}
        fill={`url(#${gradId}_face)`}
      />

      {/* Lightning bolt — white, clipped to container */}
      <g clipPath={`url(#${gradId}_clip)`}>
        <path d={BOLT} fill="white" />
      </g>

    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component — variants: full (icon + wordmark), icon, wordmark-only, monochrome
// ─────────────────────────────────────────────────────────────────────────────
export function ItsPostingLogo({ size = 'md', variant = 'full', theme = 'dark', noShadow = false }) {
  const dims = SIZES[size] || SIZES.md;
  const { box, font, gap } = dims;
  const textColor = theme === 'light' ? '#111827' : '#FFFFFF';
  const gradId = `ipLogo_${size}_${variant}`;

  const iconEl = <IconMark size={box} gradId={gradId} noShadow={noShadow} />;

  if (variant === 'icon') return iconEl;

  if (variant === 'wordmark-only') {
    return (
      <span style={{
        fontWeight: 800,
        fontSize: font,
        letterSpacing: '-0.03em',
        color: textColor,
        lineHeight: 1,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
      }}>
        ItsPosting
      </span>
    );
  }

  if (variant === 'monochrome') {
    const mc = theme === 'light' ? '#111827' : '#FFFFFF';
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
          <path d={BOLT} fill={theme === 'light' ? '#FFFFFF' : '#000000'} />
        </svg>
        <span style={{
          fontWeight: 800, fontSize: font, letterSpacing: '-0.03em',
          color: textColor, lineHeight: 1, whiteSpace: 'nowrap',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
        }}>
          ItsPosting
        </span>
      </div>
    );
  }

  // default: full — icon + "ItsPosting" wordmark
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {iconEl}
      <span style={{
        fontWeight: 800,
        fontSize: font,
        letterSpacing: '-0.03em',
        color: textColor,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
      }}>
        ItsPosting
      </span>
    </div>
  );
}

export default ItsPostingLogo;
