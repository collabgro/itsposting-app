// BrandedIcon — wraps any Ip* icon with a color/glow variant.
// PlatformBadge — app-icon style container for platform icons.

import { IpFacebook, IpInstagram, IpGoogle, IpAllPlatforms } from './index';

const VARIANTS = {
  default:  { color: 'currentColor', filter: 'none' },
  primary:  { color: '#7C5CFC',      filter: 'none' },
  muted:    { color: '#71717A',      filter: 'none' },
  success:  { color: '#22C55E',      filter: 'none' },
  warning:  { color: '#EAB308',      filter: 'none' },
  error:    { color: '#EF4444',      filter: 'none' },
  white:    { color: '#FFFFFF',      filter: 'none' },
  glow:     { color: '#7C5CFC',      filter: 'drop-shadow(0 0 6px rgba(124,92,252,0.6))' },
};

export function BrandedIcon({ icon: Icon, size = 20, variant = 'default', strokeWidth = 1.75, style, className }) {
  const v = VARIANTS[variant] || VARIANTS.default;
  return (
    <Icon
      size={size}
      color={v.color}
      strokeWidth={strokeWidth}
      style={{ filter: v.filter, ...style }}
      className={className}
    />
  );
}

const PLATFORM_CONFIG = {
  facebook:  { icon: IpFacebook,    bg: 'rgba(24,119,242,0.12)',  color: '#1877F2' },
  instagram: { icon: IpInstagram,   bg: 'rgba(225,48,108,0.12)',  color: '#E1306C' },
  google:    { icon: IpGoogle,      bg: 'rgba(66,133,244,0.12)',  color: '#4285F4' },
  all:       { icon: IpAllPlatforms, bg: 'rgba(124,92,252,0.12)', color: '#7C5CFC' },
};

export function PlatformBadge({ platform, size = 36 }) {
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.all;
  const Icon = cfg.icon;
  const iconSize = Math.round(size * 0.55);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: cfg.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={iconSize} color={cfg.color} strokeWidth={1.75} />
    </div>
  );
}
