import { createContext, useContext, useState, useEffect, useCallback, useRef, forwardRef } from 'react';
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
      minWidth: 'min(270px, calc(100vw - 24px))', maxWidth: 390,
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
        aria-label="Dismiss notification"
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
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed', top: 20, right: 12, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
        maxWidth: 'calc(100vw - 24px)',
      }}
    >
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
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        animation: 'ip-modal-backdrop 150ms ease',
      }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
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
        <h3 id="confirm-modal-title" style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 8, letterSpacing: '-0.02em' }}>{title}</h3>
        <p id="confirm-modal-desc" style={{ fontSize: 13, color: t.textMuted, marginBottom: 28, lineHeight: 1.65 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>Cancel</Button>
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

export const Button = forwardRef(function Button({
  variant = 'primary', size = 'md', children, style = {}, disabled, loading, shimmer, ...rest
}, ref) {
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
      ref={ref}
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
});

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

export function Spinner({ size = 40, label = 'Loading' }) {
  return (
    <span role="status" aria-label={label}>
      <img
        src="/icon-192.png" alt=""  aria-hidden="true"
        style={{ width: size, height: size, borderRadius: size * 0.22, animation: 'logo-pulse 1.2s ease-in-out infinite', display: 'block' }}
      />
    </span>
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

// ─── Select ───────────────────────────────────────────────────────────────────
// Premium custom dropdown — replaces native <select> throughout the app.
// options: Array of { value, label, tag?: { label, bg?, color? }, icon?, disabled? } or plain strings.
// onChange receives a synthetic event: { target: { value } }
export function Select({
  value, onChange, options = [], placeholder = 'Select…',
  style, disabled, error, maxWidth,
}) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Normalise string[] to {value,label}[]
  const normalised = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  const selected = normalised.find(o => o.value === value);
  const borderColor = error ? t.error : open ? t.primary : t.border;

  return (
    <div ref={containerRef} style={{ position: 'relative', maxWidth, ...style }}>
      {/* ── Trigger ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '11px 14px',
          background: t.input,
          border: `1.5px solid ${borderColor}`,
          borderRadius: open ? '12px 12px 0 0' : 12,
          color: selected ? t.text : t.textMuted,
          fontSize: 14, fontWeight: selected ? 600 : 400,
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none', textAlign: 'left',
          boxShadow: open ? `0 0 0 3px ${error ? 'rgba(255,59,48,0.12)' : t.focusRing}` : 'none',
          transition: 'border-color 140ms, box-shadow 140ms',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        {selected?.tag && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, flexShrink: 0,
            background: selected.tag.bg || `${t.primary}20`,
            color: selected.tag.color || t.primary,
          }}>
            {selected.tag.label}
          </span>
        )}
        <svg
          style={{ flexShrink: 0, color: t.textMuted, transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: t.isDark ? 'rgba(10,10,18,0.98)' : 'rgba(255,255,255,0.99)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          border: `1.5px solid ${t.primary}`,
          borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
          borderRadius: '0 0 12px 12px',
          boxShadow: t.isDark
            ? '0 20px 50px rgba(0,0,0,0.65), 0 6px 16px rgba(0,0,0,0.4)'
            : '0 16px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.07)',
          maxHeight: 300, overflowY: 'auto',
        }}>
          {normalised.map((opt, idx) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value ?? idx}
                type="button"
                disabled={opt.disabled}
                onClick={() => { if (!opt.disabled) { onChange({ target: { value: opt.value } }); setOpen(false); } }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '11px 16px',
                  background: isSelected ? (t.isDark ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.06)') : 'transparent',
                  border: 'none',
                  borderBottom: idx < normalised.length - 1 ? `1px solid ${t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
                  opacity: opt.disabled ? 0.4 : 1,
                  transition: 'background 80ms',
                }}
                onMouseEnter={e => { if (!isSelected && !opt.disabled) e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? (t.isDark ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.06)') : 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  {opt.icon && <span style={{ flexShrink: 0, display: 'flex' }}>{opt.icon}</span>}
                  <span style={{ fontSize: 13, color: t.text, fontWeight: isSelected ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  {opt.tag && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                      background: opt.tag.bg || `${t.primary}18`, color: opt.tag.color || t.primary,
                    }}>
                      {opt.tag.label}
                    </span>
                  )}
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={t.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
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

// ─── AnimatedNumber ───────────────────────────────────────────────────────────
// Counts up from 0 to `value` on mount. Feels like Apple's Activity rings.
// value: number | string (e.g. "1,234" — extracts leading number)
// duration: ms for full animation (default 900)
// decimals: decimal places for float display
export function AnimatedNumber({ value, duration = 900, decimals = 0, prefix = '', suffix = '', style = {} }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);
  const startRef = useRef(null);

  const numericValue = typeof value === 'string'
    ? parseFloat(value.replace(/[^0-9.-]/g, '')) || 0
    : (value || 0);

  useEffect(() => {
    if (numericValue === 0) { setDisplay(0); return; }
    const start = performance.now();
    startRef.current = start;

    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = ease(progress);
      setDisplay(eased * numericValue);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [numericValue, duration]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString();

  return (
    <span style={style} className="value-flash">
      {prefix}{formatted}{suffix}
    </span>
  );
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────
// Circular SVG progress indicator — perfect for GEO scores, completion %.
// Animates from 0 to `value` on mount.
export function ProgressRing({
  value = 0, max = 100, size = 80, strokeWidth = 7,
  color, trackColor, label, sublabel, animate = true,
}) {
  const { t } = useTheme();
  const [animatedValue, setAnimatedValue] = useState(animate ? 0 : value);
  const frameRef = useRef(null);

  const c = color || t.primary;
  const tc = trackColor || (t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)');

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (!animate) { setAnimatedValue(value); return; }
    const target = value;
    const start = performance.now();
    const dur = 1000;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const progress = Math.min((now - start) / dur, 1);
      setAnimatedValue(ease(progress) * target);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value, animate]);

  const pct = Math.min(animatedValue / max, 1);
  const offset = circumference * (1 - pct);

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={tc} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={c} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'none', filter: `drop-shadow(0 0 6px ${c}60)` }}
        />
      </svg>
      {(label !== undefined) && (
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{ fontSize: size * 0.24, fontWeight: 800, color: c, lineHeight: 1, letterSpacing: '-0.03em' }}>
            {Math.round(animatedValue)}
          </div>
          {sublabel && <div style={{ fontSize: size * 0.13, color: t.textMuted, marginTop: 1, lineHeight: 1 }}>{sublabel}</div>}
        </div>
      )}
    </div>
  );
}

// ─── PulseIndicator ───────────────────────────────────────────────────────────
// Animated live dot — use for "connected", "live", "active" states.
export function PulseIndicator({ color = '#30D158', size = 8, style = {} }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, ...style }}>
      <span style={{
        position: 'absolute', width: size, height: size, borderRadius: '50%',
        background: color, opacity: 0.4,
        animation: 'pulse-ring 1.8s ease-out infinite',
      }} />
      <span style={{ width: size * 0.7, height: size * 0.7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <style>{`@keyframes pulse-ring{0%{transform:scale(1);opacity:0.4}100%{transform:scale(2.4);opacity:0}}`}</style>
    </span>
  );
}

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────
// Clean iOS-style toggle. onChange(newBooleanValue)
export function ToggleSwitch({ checked, onChange, disabled, size = 'md', label, color }) {
  const { t } = useTheme();
  const sizes = { sm: { w: 32, h: 18, dot: 12, offset: 2 }, md: { w: 44, h: 24, dot: 18, offset: 3 } };
  const s = sizes[size] || sizes.md;
  const activeColor = color || t.primary;
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', userSelect: 'none', opacity: disabled ? 0.5 : 1 }}>
      <span
        style={{
          position: 'relative', display: 'inline-block', width: s.w, height: s.h,
          borderRadius: s.h, flexShrink: 0,
          background: checked ? activeColor : (t.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'),
          transition: 'background 200ms cubic-bezier(0.16,1,0.3,1)',
          boxShadow: checked ? `0 0 12px ${activeColor}40` : 'none',
        }}
        onClick={() => !disabled && onChange(!checked)}
      >
        <span style={{
          position: 'absolute', top: s.offset, left: s.offset,
          width: s.dot, height: s.dot, borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
          transform: checked ? `translateX(${s.w - s.dot - s.offset * 2}px)` : 'translateX(0)',
        }} />
      </span>
      {label && <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{label}</span>}
    </label>
  );
}

// ─── StepProgress ─────────────────────────────────────────────────────────────
// Linear step progress bar for multi-step flows (wizard, onboarding).
export function StepProgress({ steps, current, style = {} }) {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, ...style }}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              background: done
                ? 'linear-gradient(135deg, #7C5CFC, #6D3FF2)'
                : active
                  ? 'linear-gradient(135deg, rgba(124,92,252,0.2), rgba(124,92,252,0.1))'
                  : (t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
              border: done ? 'none' : `1.5px solid ${active ? t.primary : t.border}`,
              color: done ? '#fff' : active ? t.primary : t.textMuted,
              transition: 'all 250ms cubic-bezier(0.16,1,0.3,1)',
              boxShadow: active ? `0 0 16px rgba(124,92,252,0.35)` : 'none',
            }}>
              {done ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 4px',
                background: done ? t.primary : (t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'),
                borderRadius: 2,
                transition: 'background 350ms ease',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
