import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { IpInbox } from './icons';
import { useTheme } from '../lib/theme';

// ─── Toast System ─────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

const TOAST_ICONS = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};
const TOAST_BG = {
  success: 'rgba(34,197,94,0.12)',
  error: 'rgba(239,68,68,0.12)',
  warning: 'rgba(234,179,8,0.12)',
  info: 'rgba(59,130,246,0.12)',
};

function ToastItem({ id, message, variant, onDismiss }) {
  const { t } = useTheme();
  const borderColors = { success: t.success, error: t.error, warning: t.warning, info: t.info };
  const border = borderColors[variant] || t.info;
  const icon = TOAST_ICONS[variant] || 'i';
  const iconBg = TOAST_BG[variant] || TOAST_BG.info;
  return (
    <div style={{
      background: t.isDark ? 'rgba(15,15,24,0.92)' : 'rgba(255,255,255,0.94)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderLeft: `3px solid ${border}`,
      borderRadius: 14, padding: '13px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
      boxShadow: t.isDark
        ? `0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)`
        : `0 8px 28px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)`,
      minWidth: 270, maxWidth: 390,
      animation: 'toast-slide-in 220ms cubic-bezier(0.16,1,0.3,1)', pointerEvents: 'all',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color: border, flexShrink: 0, marginTop: 1,
      }}>
        {icon}
      </div>
      <span style={{ flex: 1, fontSize: 13, color: t.text, fontWeight: 500, lineHeight: 1.5 }}>{message}</span>
      <button
        onClick={() => onDismiss(id)}
        style={{
          background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer',
          padding: '0 2px', fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1,
          opacity: 0.7, transition: 'opacity 120ms',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
      >
        ×
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
    }}>
      {toasts.map(toast => <ToastItem key={toast.id} {...toast} onDismiss={onDismiss} />)}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (document.getElementById('ip-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'ip-ui-styles';
    style.textContent = `
      @keyframes toast-slide-in {
        from { opacity:0; transform:translateX(20px) scale(0.96); }
        to   { opacity:1; transform:translateX(0) scale(1); }
      }
      @keyframes skeleton-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      @keyframes logo-pulse     { 0%,100% { opacity:1; } 50% { opacity:0.55; } }
      @keyframes ip-spin        { to { transform:rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }, []);

  const showToast = useCallback((message, variant = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-3), { id, message, variant }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { showToast: (msg) => console.warn('[Toast]', msg) };
  return ctx;
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', confirmVariant = 'danger', onConfirm, onCancel }) {
  const { t } = useTheme();
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter') onConfirm(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onConfirm, onCancel]);
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        animation: 'ip-modal-backdrop 150ms ease',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: t.isDark ? 'rgba(12,12,20,0.95)' : 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 20,
          padding: 30, maxWidth: 400, width: 'calc(100vw - 40px)',
          boxShadow: t.isDark
            ? '0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)'
            : '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
          animation: 'ip-modal-content 200ms cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 8, letterSpacing: '-0.02em' }}>{title}</h3>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 28, lineHeight: 1.65 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant={confirmVariant} onClick={() => { onConfirm(); onCancel(); }}>{confirmLabel}</Button>
        </div>
      </div>
      <style>{`
        @keyframes ip-modal-backdrop { from{opacity:0} to{opacity:1} }
        @keyframes ip-modal-content  { from{opacity:0;transform:scale(0.95) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style = {} }) {
  const { t } = useTheme();
  return (
    <div
      className="shimmer"
      style={{
        width, height, borderRadius,
        background: t.border,
        ...style,
      }}
    />
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, padding = 24, style = {}, hoverable = false, onClick, glass = false, ...rest }) {
  const { t } = useTheme();
  const isClickable = hoverable || !!onClick;
  const baseBoxShadow = glass
    ? (t.isDark
        ? '0 8px 36px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)'
        : '0 4px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95)')
    : t.isDark
        ? `0 2px 8px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`
        : `0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)`;
  const hoverBoxShadow = t.isDark
    ? `0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(124,92,252,0.15)`
    : `0 8px 28px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1px rgba(124,92,252,0.12)`;
  return (
    <div
      onClick={onClick}
      style={{
        background: glass
          ? (t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.82)')
          : t.card,
        border: glass
          ? `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)'}`
          : `1px solid ${t.border}`,
        backdropFilter: glass ? 'blur(28px) saturate(200%)' : undefined,
        WebkitBackdropFilter: glass ? 'blur(28px) saturate(200%)' : undefined,
        borderRadius: 18, padding,
        transition: 'border-color 160ms ease, box-shadow 240ms cubic-bezier(0.34,1.56,0.64,1), transform 240ms cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: baseBoxShadow,
        cursor: isClickable ? 'pointer' : undefined,
        ...style,
      }}
      onMouseEnter={isClickable ? (e) => {
        e.currentTarget.style.borderColor = t.primaryBorder;
        e.currentTarget.style.boxShadow = hoverBoxShadow;
        e.currentTarget.style.transform = 'translateY(-4px)';
      } : undefined}
      onMouseLeave={isClickable ? (e) => {
        e.currentTarget.style.borderColor = glass ? (t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)') : t.border;
        e.currentTarget.style.boxShadow = baseBoxShadow;
        e.currentTarget.style.transform = 'translateY(0)';
      } : undefined}
      onMouseDown={isClickable ? (e) => { e.currentTarget.style.transform = 'translateY(-1px) scale(0.99)'; } : undefined}
      onMouseUp={isClickable ? (e) => { e.currentTarget.style.transform = 'translateY(-4px) scale(1)'; } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

export function Button({
  variant = 'primary', size = 'md', children, style = {}, disabled, loading, shimmer, ...rest
}) {
  const { t } = useTheme();
  const sizes = {
    sm: { padding: '6px 14px', fontSize: 12, gap: 5 },
    md: { padding: '9px 18px', fontSize: 13, gap: 6 },
    lg: { padding: '13px 24px', fontSize: 14, gap: 7 },
  };
  const isDisabled = disabled || loading;

  const primaryBg = isDisabled
    ? t.textDisabled
    : 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 50%, #6D3FF2 100%)';
  const primaryShadow = isDisabled
    ? 'none'
    : `0 4px 15px rgba(124,92,252,0.4), inset 0 1px 0 rgba(255,255,255,0.15)`;

  const variantStyles = {
    primary: {
      background: primaryBg,
      color: '#fff',
      border: '1px solid transparent',
      boxShadow: primaryShadow,
    },
    secondary: {
      background: t.card,
      color: t.text,
      border: `1px solid ${t.border}`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)`,
    },
    ghost: {
      background: 'transparent',
      color: t.textSecondary,
      border: '1px solid transparent',
      boxShadow: 'none',
    },
    danger: {
      background: t.error,
      color: '#fff',
      border: '1px solid transparent',
      boxShadow: `0 4px 12px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`,
    },
  };

  const vs = variantStyles[variant] || variantStyles.primary;
  const s = sizes[size] || sizes.md;

  return (
    <button
      disabled={isDisabled}
      className={shimmer && variant === 'primary' && !isDisabled ? 'btn-shimmer' : undefined}
      style={{
        padding: s.padding, fontSize: s.fontSize,
        background: vs.background, color: vs.color,
        border: vs.border, boxShadow: vs.boxShadow,
        borderRadius: 11, fontWeight: 600, letterSpacing: '-0.02em',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: s.gap,
        transition: 'box-shadow 160ms ease, transform 160ms cubic-bezier(0.34,1.56,0.64,1), border-color 120ms ease',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        position: 'relative', userSelect: 'none', overflow: 'hidden',
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (isDisabled) return;
        if (variant === 'primary') {
          e.currentTarget.style.boxShadow = `0 6px 22px rgba(124,92,252,0.55), inset 0 1px 0 rgba(255,255,255,0.2)`;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
        if (variant === 'secondary') {
          e.currentTarget.style.background = t.cardHover;
          e.currentTarget.style.borderColor = t.borderStrong;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
        if (variant === 'ghost') {
          e.currentTarget.style.background = t.cardHover;
          e.currentTarget.style.color = t.text;
        }
        if (variant === 'danger') {
          e.currentTarget.style.boxShadow = `0 6px 18px rgba(239,68,68,0.45), inset 0 1px 0 rgba(255,255,255,0.15)`;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return;
        e.currentTarget.style.boxShadow = vs.boxShadow;
        e.currentTarget.style.transform = 'translateY(0)';
        if (variant === 'secondary') { e.currentTarget.style.background = t.card; e.currentTarget.style.borderColor = t.border; }
        if (variant === 'ghost') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textSecondary; }
      }}
      onMouseDown={(e) => { if (!isDisabled) e.currentTarget.style.transform = 'scale(0.96)'; }}
      onMouseUp={(e) => { if (!isDisabled) e.currentTarget.style.transform = 'translateY(-2px) scale(1)'; }}
      {...rest}
    >
      {loading && (
        <span style={{
          width: 13, height: 13, borderRadius: '50%',
          border: `2px solid ${variant === 'primary' || variant === 'danger' ? 'rgba(255,255,255,0.3)' : t.border}`,
          borderTopColor: variant === 'primary' || variant === 'danger' ? '#fff' : t.primary,
          animation: 'ip-spin 600ms linear infinite', flexShrink: 0,
        }} />
      )}
      {children}
    </button>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

export function Input({ style = {}, error, ...rest }) {
  const { t } = useTheme();
  return (
    <input
      style={{
        width: '100%', padding: '10px 14px', background: t.input,
        border: `1.5px solid ${error ? t.error : t.border}`, borderRadius: 10, color: t.text,
        fontSize: 13, transition: 'border-color 120ms ease, box-shadow 120ms ease',
        lineHeight: 1.5,
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error ? t.error : t.primary;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? 'rgba(255,59,48,0.15)' : t.focusRing}`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? t.error : t.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
      {...rest}
    />
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────

export function Textarea({ style = {}, error, ...rest }) {
  const { t } = useTheme();
  return (
    <textarea
      style={{
        width: '100%', padding: '10px 14px', background: t.input,
        border: `1.5px solid ${error ? t.error : t.border}`, borderRadius: 10, color: t.text,
        fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 80,
        transition: 'border-color 120ms ease, box-shadow 120ms ease', lineHeight: 1.6,
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error ? t.error : t.primary;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? 'rgba(255,59,48,0.15)' : t.focusRing}`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? t.error : t.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
      {...rest}
    />
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function Badge({ variant = 'default', children, style = {} }) {
  const { t } = useTheme();
  const variants = {
    default: { bg: t.card, color: t.textSecondary, border: t.border },
    primary: { bg: t.primaryBg, color: t.primary, border: t.primaryBorder },
    success: { bg: t.successBg, color: t.success, border: t.successBorder },
    warning: { bg: t.warningBg, color: t.warning, border: t.warningBorder },
    error:   { bg: t.errorBg,   color: t.error,   border: t.errorBorder },
    info:    { bg: t.infoBg,    color: t.info,     border: t.infoBorder },
    glass:   { bg: 'rgba(255,255,255,0.08)', color: '#fff', border: 'rgba(255,255,255,0.15)' },
  };
  const v = variants[variant] || variants.default;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
        background: v.bg, color: v.color, border: `1px solid ${v.border}`,
        borderRadius: 9999, fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em',
        backdropFilter: variant === 'glass' ? 'blur(8px)' : undefined,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({ label, value, hint, accent = 'primary', icon: Icon, trend, onClick }) {
  const { t } = useTheme();
  const accentColors = {
    primary: t.primary,
    success: t.success,
    warning: t.warning,
    info: t.info,
    error: t.error,
  };
  const accentBgs = {
    primary: t.primaryBg,
    success: t.successBg,
    warning: t.warningBg,
    info: t.infoBg,
    error: t.errorBg,
  };
  const accentBorders = {
    primary: t.primaryBorder,
    success: t.successBorder,
    warning: t.warningBorder,
    info: t.infoBorder,
    error: t.errorBorder,
  };
  const col = accentColors[accent] || t.primary;
  const trendPositive = trend && (typeof trend === 'string' ? trend.startsWith('+') : trend > 0);
  const trendColor = trendPositive ? t.success : t.error;

  const baseShadow = t.isDark
    ? `0 2px 8px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`
    : `0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)`;
  const hoverShadow = t.isDark
    ? `0 8px 30px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(124,92,252,0.12)`
    : `0 6px 24px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)`;

  return (
    <div
      onClick={onClick}
      style={{
        background: t.card,
        border: `1px solid ${t.border}`,
        borderLeft: `3px solid ${col}`,
        borderRadius: 18,
        padding: 22,
        boxShadow: baseShadow,
        transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 220ms ease, border-color 150ms ease',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={onClick ? (e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = hoverShadow;
        e.currentTarget.style.borderLeftColor = col;
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = baseShadow;
      } : undefined}
      onMouseDown={onClick ? (e) => { e.currentTarget.style.transform = 'scale(0.99)'; } : undefined}
      onMouseUp={onClick ? (e) => { e.currentTarget.style.transform = 'translateY(-3px)'; } : undefined}
    >
      {/* Ambient accent glow — larger, softer, more premium */}
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 110, height: 110,
        borderRadius: '50%', background: col, opacity: t.isDark ? 0.07 : 0.05, pointerEvents: 'none',
        filter: 'blur(20px)',
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, letterSpacing: '-0.01em', lineHeight: 1.4 }}>{label}</div>
        {Icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: accentBgs[accent] || t.primaryBg,
            border: `1px solid ${accentBorders[accent] || t.primaryBorder}`,
            boxShadow: `0 4px 14px ${col}28, inset 0 1px 0 rgba(255,255,255,0.1)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={16} color={col} strokeWidth={2} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, color: t.text, marginTop: 10, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
        {hint && <div style={{ fontSize: 12, color: col, fontWeight: 500 }}>{hint}</div>}
        {trend && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 600, color: trendColor,
            background: trendPositive ? t.successBg : t.errorBg,
            border: `1px solid ${trendPositive ? t.successBorder : t.errorBorder}`,
            borderRadius: 6, padding: '2px 7px',
          }}>
            {trendPositive ? '▲' : '▼'} {trend}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({ title, subtitle, icon: Icon, action }) {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {Icon && (
          <div style={{
            width: 42, height: 42, borderRadius: 13,
            background: t.isDark
              ? 'linear-gradient(135deg, rgba(124,92,252,0.22) 0%, rgba(124,92,252,0.09) 100%)'
              : 'linear-gradient(135deg, rgba(124,92,252,0.13) 0%, rgba(124,92,252,0.05) 100%)',
            border: `1px solid ${t.primaryBorder}`,
            boxShadow: t.isDark
              ? '0 6px 18px rgba(124,92,252,0.25), inset 0 1px 0 rgba(255,255,255,0.07)'
              : '0 4px 14px rgba(124,92,252,0.16), inset 0 1px 0 rgba(255,255,255,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={19} strokeWidth={2} color={t.primary} />
          </div>
        )}
        <div style={{ paddingTop: Icon ? 2 : 0 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: t.text, letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4, lineHeight: 1.55, margin: '4px 0 0' }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon = IpInbox, title, subtitle, action }) {
  const { t } = useTheme();
  return (
    <div style={{ padding: '72px 24px', textAlign: 'center' }}>
      <div className="float" style={{
        width: 72, height: 72, borderRadius: 22,
        background: t.isDark
          ? 'linear-gradient(135deg, rgba(124,92,252,0.2) 0%, rgba(124,92,252,0.09) 100%)'
          : 'linear-gradient(135deg, rgba(124,92,252,0.12) 0%, rgba(124,92,252,0.05) 100%)',
        border: `1px solid ${t.primaryBorder}`,
        boxShadow: t.isDark
          ? '0 10px 30px rgba(124,92,252,0.22), 0 0 0 8px rgba(124,92,252,0.06), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 8px 24px rgba(124,92,252,0.15), 0 0 0 8px rgba(124,92,252,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
      }}>
        <Icon size={30} color={t.primary} />
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 8, letterSpacing: '-0.028em' }}>{title}</h3>
      {subtitle && (
        <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.7, maxWidth: 340, margin: '0 auto 28px' }}>
          {subtitle}
        </p>
      )}
      {action}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 40 }) {
  return (
    <img
      src="/icon-192.png" alt="" aria-hidden="true"
      style={{ width: size, height: size, borderRadius: size * 0.22, animation: 'logo-pulse 1.2s ease-in-out infinite' }}
    />
  );
}

// ─── SkeletonPage ──────────────────────────────────────────────────────────────
// Drop in anywhere while data loads — renders a shimmer layout matching most pages.
export function SkeletonPage({ rows = 3, cards = 3 }) {
  const { t } = useTheme();
  const shimmer = { background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)', animation: 'skeleton-pulse 1.8s ease-in-out infinite' };
  return (
    <div style={{ padding: '24px 0' }}>
      {/* header area */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ ...shimmer, width: 200, height: 26, borderRadius: 8, marginBottom: 10 }} />
          <div style={{ ...shimmer, width: 140, height: 16, borderRadius: 6 }} />
        </div>
        <div style={{ ...shimmer, width: 120, height: 38, borderRadius: 10 }} />
      </div>
      {/* stat cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cards}, 1fr)`, gap: 16, marginBottom: 32 }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} style={{ ...shimmer, height: 90, borderRadius: 16 }} />
        ))}
      </div>
      {/* content rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ ...shimmer, height: 68, borderRadius: 14, marginBottom: 12 }} />
      ))}
    </div>
  );
}

// ─── ErrorCard ─────────────────────────────────────────────────────────────────
// Standardised error state for any section or page-level failure.
export function ErrorCard({ title = 'Could not load data', message, onRetry, style = {} }) {
  const { t } = useTheme();
  return (
    <div style={{
      background: t.isDark ? 'rgba(255,69,58,0.07)' : 'rgba(255,69,58,0.05)',
      border: `1px solid ${t.isDark ? 'rgba(255,69,58,0.25)' : 'rgba(255,69,58,0.2)'}`,
      borderRadius: 16, padding: '28px 24px', textAlign: 'center',
      ...style,
    }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>{title}</div>
      {message && <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 18 }}>{message}</div>}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '9px 20px', background: 'rgba(255,69,58,0.12)',
            border: '1px solid rgba(255,69,58,0.3)', borderRadius: 8,
            color: '#FF453A', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
