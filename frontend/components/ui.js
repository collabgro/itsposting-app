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
      background: t.card, border: `1px solid ${t.border}`, borderLeft: `3px solid ${border}`,
      borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
      boxShadow: t.shadowMd, minWidth: 260, maxWidth: 380,
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
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
          padding: 28, maxWidth: 400, width: 'calc(100vw - 40px)', boxShadow: t.shadowLg,
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

export function Card({ children, padding = 24, style = {}, hoverable = false, onClick, ...rest }) {
  const { t } = useTheme();
  const isClickable = hoverable || !!onClick;
  return (
    <div
      onClick={onClick}
      style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 14, padding,
        transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
        boxShadow: t.shadowSm,
        cursor: isClickable ? 'pointer' : undefined,
        ...style,
      }}
      onMouseEnter={isClickable ? (e) => {
        e.currentTarget.style.borderColor = t.primaryBorder;
        e.currentTarget.style.boxShadow = `${t.shadowMd}, 0 0 0 1px ${t.primaryBorder}`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      } : undefined}
      onMouseLeave={isClickable ? (e) => {
        e.currentTarget.style.borderColor = t.border;
        e.currentTarget.style.boxShadow = t.shadowSm;
        e.currentTarget.style.transform = 'translateY(0)';
      } : undefined}
      onMouseDown={isClickable ? (e) => { e.currentTarget.style.transform = 'translateY(-1px)'; } : undefined}
      onMouseUp={isClickable ? (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

export function Button({
  variant = 'primary', size = 'md', children, style = {}, disabled, loading, ...rest
}) {
  const { t } = useTheme();
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12 },
    md: { padding: '8px 16px', fontSize: 13 },
    lg: { padding: '12px 22px', fontSize: 14 },
  };
  const bg = {
    primary:   disabled || loading ? t.textDisabled : t.primary,
    secondary: t.card,
    ghost:     'transparent',
    danger:    t.error,
  };
  const color = {
    primary:   '#fff',
    secondary: t.text,
    ghost:     t.textSecondary,
    danger:    '#fff',
  };
  const border = {
    primary:   '1px solid transparent',
    secondary: `1px solid ${t.border}`,
    ghost:     '1px solid transparent',
    danger:    '1px solid transparent',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      style={{
        ...sizes[size], background: bg[variant], color: color[variant], border: border[variant],
        borderRadius: 8, fontWeight: 600, letterSpacing: '-0.01em',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 120ms ease',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        position: 'relative', userSelect: 'none',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (isDisabled) return;
        if (variant === 'primary') { e.currentTarget.style.background = t.primaryHover; e.currentTarget.style.boxShadow = `0 4px 14px ${t.focusRing}`; }
        if (variant === 'secondary') { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.borderColor = t.borderStrong; }
        if (variant === 'ghost') { e.currentTarget.style.background = t.cardHover; }
        if (variant === 'danger') { e.currentTarget.style.opacity = '0.88'; }
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return;
        if (variant === 'primary') { e.currentTarget.style.background = t.primary; e.currentTarget.style.boxShadow = 'none'; }
        if (variant === 'secondary') { e.currentTarget.style.background = t.card; e.currentTarget.style.borderColor = t.border; }
        if (variant === 'ghost') { e.currentTarget.style.background = 'transparent'; }
        if (variant === 'danger') { e.currentTarget.style.opacity = '1'; }
      }}
      onMouseDown={(e) => { if (!isDisabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >
      {loading && (
        <span style={{
          width: 12, height: 12, borderRadius: '50%',
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
        border: `1.5px solid ${error ? t.error : t.borderStrong}`, borderRadius: 8, color: t.text,
        fontSize: 13, transition: 'border-color 150ms ease, box-shadow 150ms ease',
        lineHeight: 1.5,
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error ? t.error : t.primary;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? 'rgba(239,68,68,0.15)' : t.focusRing}`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? t.error : t.borderStrong;
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
        border: `1.5px solid ${error ? t.error : t.borderStrong}`, borderRadius: 8, color: t.text,
        fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 80,
        transition: 'border-color 150ms ease, box-shadow 150ms ease', lineHeight: 1.6,
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error ? t.error : t.primary;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? 'rgba(239,68,68,0.15)' : t.focusRing}`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? t.error : t.borderStrong;
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
  };
  const v = variants[variant] || variants.default;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
        background: v.bg, color: v.color, border: `1px solid ${v.border}`,
        borderRadius: 9999, fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({ label, value, hint, accent = 'primary', onClick }) {
  const { t } = useTheme();
  const accents = { primary: t.primary, success: t.success, warning: t.warning, info: t.info };
  return (
    <Card onClick={onClick} hoverable={!!onClick}>
      <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, letterSpacing: '-0.01em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: t.text, marginTop: 8, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: accents[accent] || t.primary, marginTop: 6, fontWeight: 500 }}>{hint}</div>}
    </Card>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({ title, subtitle, icon: Icon, action }) {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {Icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 9, background: t.primaryBg,
            border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={18} strokeWidth={2} color="url(#brand-gradient)" />
          </div>
        )}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text, letterSpacing: '-0.025em', lineHeight: 1.2 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 13, color: t.textMuted, marginTop: 3, lineHeight: 1.5 }}>{subtitle}</p>}
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
    <div style={{ padding: '56px 24px', textAlign: 'center' }}>
      <div style={{
        width: 60, height: 60, borderRadius: 16, background: t.primaryBg,
        border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', margin: '0 auto 18px',
      }}>
        <Icon size={24} color="url(#brand-gradient)" />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6, letterSpacing: '-0.02em' }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 24, lineHeight: 1.6, maxWidth: 320, margin: '0 auto 24px' }}>{subtitle}</p>}
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
