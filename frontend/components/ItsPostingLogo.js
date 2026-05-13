import React from 'react';

const SIZES = {
  sm: { circle: 28, font: 18, gap: 10 },
  md: { circle: 40, font: 24, gap: 12 },
  lg: { circle: 56, font: 32, gap: 14 },
  xl: { circle: 80, font: 46, gap: 18 },
};

// Lightning bolt polygon points relative to circle center
// Scaled proportionally to circle radius
function boltPoints(r) {
  const s = r / 15;
  const pts = [[5,-15],[-5,-1],[2,-1],[-6,15],[6,1],[-1,1]];
  return pts.map(([x, y]) => `${x * s},${y * s}`).join(' ');
}

export function ItsPostingLogo({ size = 'md', variant = 'full', theme = 'dark' }) {
  const { circle, font, gap } = SIZES[size] || SIZES.md;
  const r = circle / 2;
  const gradId = `logoGrad_${size}`;
  const textColor = theme === 'light' ? '#111' : '#fff';

  const iconSvg = (
    <svg
      width={circle}
      height={circle}
      viewBox={`0 0 ${circle} ${circle}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9450E6" />
          <stop offset="100%" stopColor="#CD4B91" />
        </linearGradient>
      </defs>
      <circle cx={r} cy={r} r={r} fill={`url(#${gradId})`} />
      <polygon
        points={boltPoints(r)}
        transform={`translate(${r}, ${r})`}
        fill="white"
      />
    </svg>
  );

  if (variant === 'icon') return iconSvg;

  if (variant === 'wordmark-only') {
    return (
      <span style={{ fontWeight: 800, fontSize: font, letterSpacing: '-0.03em', color: textColor, lineHeight: 1 }}>
        ItsPosting
      </span>
    );
  }

  // full — icon + wordmark
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {iconSvg}
      <span style={{ fontWeight: 800, fontSize: font, letterSpacing: '-0.03em', color: textColor, lineHeight: 1, whiteSpace: 'nowrap' }}>
        ItsPosting
      </span>
    </div>
  );
}

export default ItsPostingLogo;
