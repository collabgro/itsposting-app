import { IpInbox } from './icons';
import { useTheme } from '../lib/theme';

export function Card({ children, padding = 24, style = {}, hoverable = false, ...rest }) {
  const { t } = useTheme();
  return (
    <div
      style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 12, padding, transition: 'all 150ms ease', ...style,
      }}
      onMouseEnter={hoverable ? (e) => (e.currentTarget.style.borderColor = t.primaryBorder) : undefined}
      onMouseLeave={hoverable ? (e) => (e.currentTarget.style.borderColor = t.border) : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Button({ variant = 'primary', size = 'md', children, style = {}, disabled, ...rest }) {
  const { t } = useTheme();
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12 },
    md: { padding: '8px 16px', fontSize: 13 },
    lg: { padding: '12px 20px', fontSize: 14 },
  };
  const variants = {
    primary: { background: disabled ? t.textDisabled : t.primary, color: '#fff', border: '1px solid transparent' },
    secondary: { background: t.card, color: t.text, border: `1px solid ${t.border}` },
    ghost: { background: 'transparent', color: t.textSecondary, border: '1px solid transparent' },
    danger: { background: t.error, color: '#fff', border: '1px solid transparent' },
  };
  return (
    <button
      disabled={disabled}
      style={{
        ...sizes[size], ...variants[variant],
        borderRadius: 8, fontWeight: 600, letterSpacing: '-0.01em',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        transition: 'all 150ms ease', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (variant === 'primary') e.currentTarget.style.background = t.primaryHover;
        if (variant === 'secondary' || variant === 'ghost') e.currentTarget.style.background = t.cardHover;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        if (variant === 'primary') e.currentTarget.style.background = t.primary;
        if (variant === 'secondary') e.currentTarget.style.background = t.card;
        if (variant === 'ghost') e.currentTarget.style.background = 'transparent';
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Input({ style = {}, ...rest }) {
  const { t } = useTheme();
  return (
    <input
      style={{
        width: '100%', padding: '10px 14px', background: t.input,
        border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text,
        fontSize: 13, transition: 'border-color 150ms ease', ...style,
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = t.primary)}
      onBlur={(e) => (e.currentTarget.style.borderColor = t.borderStrong)}
      {...rest}
    />
  );
}

export function Textarea({ style = {}, ...rest }) {
  const { t } = useTheme();
  return (
    <textarea
      style={{
        width: '100%', padding: '10px 14px', background: t.input,
        border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text,
        fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 80,
        transition: 'border-color 150ms ease', ...style,
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = t.primary)}
      onBlur={(e) => (e.currentTarget.style.borderColor = t.borderStrong)}
      {...rest}
    />
  );
}

export function Badge({ variant = 'default', children }) {
  const { t } = useTheme();
  const variants = {
    default: { bg: t.card, color: t.textSecondary, border: t.border },
    primary: { bg: t.primaryBg, color: t.primary, border: t.primaryBorder },
    success: { bg: 'rgba(34, 197, 94, 0.1)', color: t.success, border: 'rgba(34, 197, 94, 0.3)' },
    warning: { bg: 'rgba(234, 179, 8, 0.1)', color: t.warning, border: 'rgba(234, 179, 8, 0.3)' },
    error: { bg: 'rgba(239, 68, 68, 0.1)', color: t.error, border: 'rgba(239, 68, 68, 0.3)' },
  };
  const v = variants[variant] || variants.default;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
        background: v.bg, color: v.color, border: `1px solid ${v.border}`,
        borderRadius: 9999, fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em',
      }}
    >
      {children}
    </span>
  );
}

export function StatCard({ label, value, hint, accent = 'primary' }) {
  const { t } = useTheme();
  const accents = { primary: t.primary, success: t.success, warning: t.warning, info: t.info };
  return (
    <Card>
      <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, letterSpacing: '-0.01em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: t.text, marginTop: 8, letterSpacing: '-0.03em' }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: accents[accent] || t.primary, marginTop: 4, fontWeight: 500 }}>{hint}</div>}
    </Card>
  );
}

export function SectionHeader({ title, subtitle, icon: Icon, action }) {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {Icon && (
          <div
            style={{
              width: 36, height: 36, borderRadius: 8, background: t.primaryBg,
              border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: t.primary, flexShrink: 0,
            }}
          >
            <Icon size={18} strokeWidth={2} />
          </div>
        )}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon = IpInbox, title, subtitle, action }) {
  const { t } = useTheme();
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div
        style={{
          width: 56, height: 56, borderRadius: 14, background: t.card,
          border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 16px', color: t.textMuted,
        }}
      >
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>{subtitle}</p>}
      {action}
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ width: 40, height: 40, border: '3px solid rgba(124,92,252,0.2)', borderTopColor: '#7C5CFC', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  );
}
