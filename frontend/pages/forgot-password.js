import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '../lib/theme';
import { authAPI } from '../lib/api';

export default function ForgotPassword() {
  const { t, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => setVisible(true), 80);
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

  function iStyle(field) {
    return {
      width: '100%', padding: '12px 14px', boxSizing: 'border-box',
      background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : t.input,
      border: `1px solid ${focusedField === field ? 'rgba(124,92,252,0.6)' : t.borderStrong}`,
      borderRadius: 10, color: t.text, fontSize: 14, outline: 'none',
      boxShadow: focusedField === field ? '0 0 0 3px rgba(124,92,252,0.12)' : 'none',
      transition: 'border-color 150ms, box-shadow 150ms',
    };
  }

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: '100vh', position: 'relative',
      background: theme === 'dark' ? '#07070E' : t.bg,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 80% 50% at 50% -5%, rgba(124,92,252,${theme === 'dark' ? '0.28' : '0.12'}) 0%, transparent 65%)`,
      }} />

      <div style={{
        position: 'relative', zIndex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: 20,
      }}>
        <div style={{
          width: '100%', maxWidth: 400,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(28px)',
          transition: 'opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1)',
        }}>

          {/* Logo block */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ display: 'inline-flex', position: 'relative', marginBottom: 20 }}>
              <div style={{
                position: 'absolute', inset: -10, borderRadius: 24,
                background: 'radial-gradient(circle, rgba(124,92,252,0.4) 0%, transparent 70%)',
                filter: 'blur(14px)',
              }} />
              <img
                src="/itsposting-logo.png" alt="ItsPosting" width={64} height={64}
                style={{ borderRadius: 18, display: 'block', position: 'relative', zIndex: 1 }}
              />
            </div>
            <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.04em', color: t.text }}>ItsPosting</div>
            <div style={{ fontSize: 14, color: t.textMuted, marginTop: 6, letterSpacing: '-0.01em' }}>
              Reset your password
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 16, padding: '32px 28px',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.4)',
          }}>
            {sent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(124,92,252,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontSize: 26,
                }}>
                  ✉️
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: t.text, marginBottom: 10 }}>
                  Check your inbox
                </div>
                <div style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.6 }}>
                  If <strong style={{ color: t.text }}>{email}</strong> is registered, a password reset link has been sent. Check your inbox (and spam folder).
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{
                    padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)', color: t.error,
                    borderRadius: 8, marginBottom: 20, fontSize: 13,
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
                  Enter your email address and we&apos;ll send you a link to reset your password.
                </div>

                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Email
                    </label>
                    <input
                      type="email" required placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      style={iStyle('email')}
                    />
                  </div>

                  <button
                    type="submit" disabled={loading}
                    style={{
                      width: '100%', padding: '14px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: 6,
                      fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
                      background: loading ? t.textDisabled : 'linear-gradient(135deg, #9B4FD4 0%, #C44BB8 100%)',
                      border: 'none', borderRadius: 10, color: '#fff',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 4px 24px rgba(155,79,212,0.4)',
                      transition: 'opacity 150ms, box-shadow 150ms',
                    }}
                  >
                    {loading ? 'Sending…' : 'Send reset link →'}
                  </button>
                </form>
              </>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: t.textMuted }}>
            <Link href="/login" style={{ color: t.primary, fontWeight: 600 }}>← Back to login</Link>
          </p>

        </div>
      </div>
    </div>
  );
}

