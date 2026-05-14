import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { IpInbox } from './icons';
import { useTheme } from '../lib/theme';

// ─── Toast System ─────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

function ToastItem({ id, message, variant, onDismiss }) {
  const { t } = useTheme();
  const borderColors = { success: t.success, error: t.error, warning: t.warning, info: t.info };
  const border = borderColors[variant] || t.info;
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderLeft: `3px solid ${border}`,
      borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)', minWidth: 260, maxWidth: 380,
      animation: 'toast-slide-in 200ms ease', pointerEvents: 'all',
    }}>
      <span style={{ flex: 1, fontSize: 13, color: t.text, fontWeight: 500, lineHeight: 1.4 }}>{message}</span>
      <button onClick={() => onDismiss(id)}
        style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0 2px', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
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
      @keyframes toast-slide-in { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
      @keyframes skeleton-pulse { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
      @keyframes logo-pulse { 0%,100% { opacity:1; } 50% { opacity:0.55; } }
    `;
    document.head.appendChild(style);
  }, []);

  const showToast = useCallback((message, variant = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-3), { id, message, variant }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
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
  if (!ctx) {
    // Graceful fallback when used outside ToastProvider
    return { showToast: (msg) => console.warn('[Toast]', msg) };
  }
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
      zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
        padding: 28, maxWidth: 400, width: 'calc(100vw - 40px)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 28, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant={confirmVariant} onClick={() => { onConfirm(); onCancel(); }}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style = {} }) {
  const { t } = useTheme();
  return (
    <div style={{
      width, height, borderRadius,
      background: t.border, animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      ...style,
    }} />
  );
}

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
              justifyContent: 'center', flexShrink: 0,
            }}
          >
            <Icon size={18} strokeWidth={2} color="url(#brand-gradient)" />
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

export function Spinner({ size = 40 }) {
  return (
    <img src="/icon-192.png" alt="" aria-hidden="true"
      style={{ width: size, height: size, borderRadius: size * 0.22, animation: 'logo-pulse 1.2s ease-in-out infinite' }} />
  );
}
