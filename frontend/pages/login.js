import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useTheme } from '../lib/theme';
import { authAPI } from '../lib/api';

export default function Login() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem('token')) { router.replace('/dashboard'); return; }
    setTimeout(() => setVisible(true), 80);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.login(formData);
      localStorage.setItem('token', data.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
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

      {/* Content */}
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
              Your business, posting on autopilot.
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 16, padding: '32px 28px',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.4)',
          }}>
            {error && (
              <div style={{
                padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)', color: t.error,
                borderRadius: 8, marginBottom: 20, fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Email
                </label>
                <input
                  type="email" required placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  style={iStyle('email')}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Password
                  </label>
                  <Link href="/forgot-password" style={{ fontSize: 12, color: '#9B7FFF', textDecoration: 'none' }}>
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password" required autoComplete="current-password" placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  style={iStyle('password')}
                />
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '14px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
                  background: loading ? t.textDisabled : 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)',
                  border: 'none', borderRadius: 10, color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 24px rgba(124,92,252,0.4)',
                  transition: 'opacity 150ms, box-shadow 150ms',
                }}
              >
                {loading ? 'Signing in…' : 'Sign in →'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: t.textMuted }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: t.primary, fontWeight: 600 }}>Start free trial →</Link>
          </p>

        </div>
      </div>
    </div>
  );
}

