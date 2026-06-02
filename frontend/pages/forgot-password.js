import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '../lib/theme';
import { authAPI } from '../lib/api';
import { ItsPostingLogo } from '../components/ItsPostingLogo';

export default function ForgotPassword() {
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => setEntered(true), 60);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '13px 16px',
    boxSizing: 'border-box',
    background: t.isDark ? 'rgba(255,255,255,0.05)' : '#fff',
    border: `1.5px solid ${focused === 'email' ? 'rgba(124,92,252,0.70)' : t.isDark ? 'rgba(255,255,255,0.09)' : t.border}`,
    borderRadius: 11,
    color: t.text,
    fontSize: 14,
    outline: 'none',
    letterSpacing: '-0.01em',
    boxShadow: focused === 'email' ? '0 0 0 4px rgba(124,92,252,0.11)' : 'none',
    transition: 'border-color 180ms ease, box-shadow 180ms ease',
  };

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      background: t.isDark ? '#040409' : '#F4F3FF',
      padding: '40px 24px',
      overflow: 'hidden',
    }}>
      {/* Ambient */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: t.isDark
          ? 'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(124,92,252,0.22) 0%, transparent 58%)'
          : 'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(124,92,252,0.12) 0%, transparent 58%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 380,
        opacity: entered ? 1 : 0,
        transform: entered ? 'none' : 'translateY(14px)',
        transition: 'opacity 650ms cubic-bezier(0.16,1,0.3,1), transform 650ms cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <ItsPostingLogo size="xl" variant="icon" theme={t.isDark ? 'dark' : 'light'} />
          <h1 style={{ margin: '14px 0 6px', fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: '-0.04em' }}>
            {sent ? 'Email sent' : 'Reset password'}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: t.textMuted, letterSpacing: '-0.01em' }}>
            {sent ? 'Check your inbox' : "We'll email you a secure reset link"}
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '8px 0 32px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(124,92,252,0.13)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9472FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.65, maxWidth: 300, margin: '0 auto 28px' }}>
              If <strong style={{ color: t.text }}>{email}</strong> is registered, a reset link is on its way. Check your inbox and spam folder.
            </div>
            <div style={{
              padding: '12px 16px',
              background: t.isDark ? 'rgba(255,255,255,0.04)' : t.card,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              fontSize: 12.5,
              color: t.textMuted,
              lineHeight: 1.6,
              textAlign: 'left',
            }}>
              <strong style={{ color: t.text, display: 'block', marginBottom: 4 }}>Didn't receive it?</strong>
              Check your spam folder · The link expires in 1 hour · <button
                onClick={() => { setSent(false); setEmail(''); }}
                style={{ background: 'none', border: 'none', color: t.primary, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
              >
                Try a different email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '11px 14px', marginBottom: 22,
                background: t.errorBg, border: `1px solid ${t.errorBorder}`,
                borderRadius: 10, fontSize: 13, color: t.error,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: t.text, letterSpacing: '-0.01em', marginBottom: 7 }}>
                Email address
              </label>
              <input
                type="email"
                required
                placeholder="you@company.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
                background: loading
                  ? (t.isDark ? 'rgba(255,255,255,0.07)' : '#E5E5EF')
                  : 'linear-gradient(135deg, #7C5CFC 0%, #9472FF 100%)',
                border: 'none', borderRadius: 11,
                color: loading ? t.textDisabled : '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 30px rgba(124,92,252,0.38)',
                transition: 'transform 180ms ease, box-shadow 180ms ease',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(124,92,252,0.50)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 30px rgba(124,92,252,0.38)'; }}
            >
              {loading ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
                  </svg>
                  Sending…
                </>
              ) : 'Send reset link'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 30, fontSize: 13.5, color: t.textMuted, letterSpacing: '-0.01em' }}>
          <Link href="/login" style={{ color: t.primary, fontWeight: 600, textDecoration: 'none' }}>
            ← Back to sign in
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 100px ${t.isDark ? '#0A0A16' : '#ffffff'} inset !important;
          -webkit-text-fill-color: ${t.text} !important;
          caret-color: ${t.text};
        }
      `}</style>
    </div>
  );
}
