import React from 'react';

const SIZES = {
  xs:    { box: 26,  font: 13, gap: 7  },
  sm:    { box: 38,  font: 17, gap: 10 },
  md:    { box: 36,  font: 20, gap: 10 },
  lg:    { box: 52,  font: 28, gap: 13 },
  xl:    { box: 72,  font: 38, gap: 16 },
  '2xl': { box: 92,  font: 48, gap: 20 },
  '3xl': { box: 124, font: 64, gap: 26 },
};

function IconMark({ size, noShadow = false, theme = 'dark' }) {
  const glowFilter = theme === 'light'
    ? 'drop-shadow(0 2px 8px rgba(168,85,247,0.2)) drop-shadow(0 1px 3px rgba(0,0,0,0.1))'
    : 'drop-shadow(0 6px 22px rgba(168,85,247,0.55)) drop-shadow(0 2px 8px rgba(236,72,153,0.32)) drop-shadow(0 1px 2px rgba(0,0,0,0.28))';
  return (
    <img
      src="/fav-icon.png"
      alt="ItsPosting"
      width={size}
      height={size}
      style={{
        flexShrink: 0,
        display: 'block',
        borderRadius: Math.round(size * 0.26),
        filter: noShadow ? undefined : glowFilter,
      }}
    />
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

  const iconEl = <IconMark size={box} noShadow={noShadow} theme={theme} />;

  if (variant === 'icon') return iconEl;

  if (variant === 'wordmark-only') {
    return <span style={wordmarkStyle}>ItsPosting</span>;
  }

  // monochrome falls through to full — PNG already looks correct on all backgrounds
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {iconEl}
      <span style={wordmarkStyle}>ItsPosting</span>
    </div>
  );
}

export default ItsPostingLogo;
