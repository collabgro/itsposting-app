import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { IpSparkle } from '../components/icons';
import { useTheme } from '../lib/theme';
import { authAPI } from '../lib/api';

const INDUSTRIES = [
  { label: 'Plumbing',            value: 'plumbing',            emoji: '🔧' },
  { label: 'HVAC',                value: 'hvac',                emoji: '❄️' },
  { label: 'Roofing',             value: 'roofing',             emoji: '🏠' },
  { label: 'Concrete',            value: 'concrete',            emoji: '🧱' },
  { label: 'Landscaping',         value: 'landscaping',         emoji: '🌿' },
  { label: 'Electrical',          value: 'electrical',          emoji: '⚡' },
  { label: 'Painting',            value: 'painting',            emoji: '🎨' },
  { label: 'Pest Control',        value: 'pest_control',        emoji: '🐛' },
  { label: 'Cleaning',            value: 'cleaning',            emoji: '✨' },
  { label: 'General Contracting', value: 'general_contractor',  emoji: '🏗️' },
  { label: 'Carpentry',           value: 'general_contractor',  emoji: '🪵' },
  { label: 'Other',               value: 'general_contractor',  emoji: '🔨' },
];

const TRUST_BADGES = [
  { icon: '🎁', text: '10 free credits' },
  { icon: '🚫', text: 'No credit card' },
  { icon: '🔓', text: 'Cancel anytime' },
];

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 1, label: 'Weak',   color: '#EF4444' };
  if (score === 2) return { score: 2, label: 'Fair',   color: '#F59E0B' };
  if (score === 3) return { score: 3, label: 'Good',   color: '#3B82F6' };
  return             { score: 4, label: 'Strong', color: '#22C55E' };
}

export default function Signup() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [formData, setFormData] = useState({ businessName: '', industry: '', location: '', email: '', password: '' });
  const [parentRef, setParentRef] = useState('');

  const pwStrength = getPasswordStrength(formData.password);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => setVisible(true), 80);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.ref) setParentRef(router.query.ref);
    if (router.query.email) setFormData(prev => ({ ...prev, email: router.query.email }));
  }, [router.isReady, router.query.ref, router.query.email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) {
      if (!formData.businessName || !formData.industry || !formData.location) { setError('Please fill in all fields'); return; }
      setError('');
      setStep(2);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const industryValue = INDUSTRIES.find(i => i.label === formData.industry)?.value || 'general_contractor';
      const payload = { email: formData.email, password: formData.password, businessName: formData.businessName, industry: industryValue, location: formData.location };
      if (parentRef) payload.parentRef = parentRef;
      const { data } = await authAPI.register(payload);
      localStorage.setItem('token', data.token);
      localStorage.setItem('ip_onboard_name', formData.businessName);
      router.push('/welcome');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
      setLoading(false);
    }
  };

  function iStyle(field) {
    return {
      width: '100%', padding: '12px 14px', boxSizing: 'border-box',
      background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : t.input,
      border: `1px solid ${focusedField === field ? 'rgba(124,92,252,0.6)' : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : t.borderStrong)}`,
      borderRadius: 10, color: t.text, fontSize: 14, outline: 'none',
      boxShadow: focusedField === field ? '0 0 0 3px rgba(124,92,252,0.15)' : 'none',
      transition: 'border-color 150ms, box-shadow 150ms',
    };
  }

  if (!mounted) return null;

  const tagline = step === 1 ? 'Built for local trades. Ready in 60 seconds.' : 'Start your 7-day free trial.';

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
          width: '100%', maxWidth: 500,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(28px)',
          transition: 'opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1)',
        }}>

          {/* Logo block */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-flex', position: 'relative', marginBottom: 18 }}>
              <div style={{
                position: 'absolute', inset: -16, borderRadius: 28,
                background: 'radial-gradient(circle, rgba(124,92,252,0.5) 0%, transparent 70%)',
                filter: 'blur(20px)',
              }} />
              <img
                src="/itsposting-logo.png" alt="ItsPosting" width={72} height={72}
                style={{ borderRadius: 20, display: 'block', position: 'relative', zIndex: 1, boxShadow: '0 8px 32px rgba(124,92,252,0.5), 0 3px 10px rgba(0,0,0,0.4)' }}
              />
            </div>
            <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.04em', color: t.text }}>ItsPosting</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 5, letterSpacing: '-0.01em', transition: 'all 300ms ease' }}>
              {tagline}
            </div>

            {/* Step indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              {[1, 2].map(s => (
                <div key={s} style={{
                  height: 4, borderRadius: 4,
                  width: step >= s ? 48 : 24,
                  background: step >= s
                    ? 'linear-gradient(90deg, #00C4CC, #7C5CFC)'
                    : theme === 'dark' ? 'rgba(255,255,255,0.1)' : t.border,
                  transition: 'all 400ms cubic-bezier(0.16,1,0.3,1)',
                }} />
              ))}
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: theme === 'dark' ? 'rgba(15,15,24,0.88)' : 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(32px) saturate(200%)',
            WebkitBackdropFilter: 'blur(32px) saturate(200%)',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
            borderRadius: 20, padding: '32px 28px',
            boxShadow: theme === 'dark'
              ? '0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.65), 0 8px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 0 0 1px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,1)',
          }}>
            {error && (
              <div style={{
                padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)', color: t.error,
                borderRadius: 8, marginBottom: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <>
                  {/* Business Name */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Business Name
                    </label>
                    <input
                      type="text" required placeholder="ABC Plumbing"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      onFocus={() => setFocusedField('businessName')}
                      onBlur={() => setFocusedField(null)}
                      style={iStyle('businessName')}
                    />
                  </div>

                  {/* Industry — icon grid */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      What's your trade?
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {INDUSTRIES.map(ind => {
                        const sel = formData.industry === ind.label;
                        return (
                          <button
                            key={ind.label} type="button"
                            onClick={() => setFormData({ ...formData, industry: ind.label })}
                            style={{
                              padding: '12px 6px 10px',
                              background: sel
                                ? 'rgba(124,92,252,0.18)'
                                : theme === 'dark' ? 'rgba(255,255,255,0.03)' : t.input,
                              border: `1px solid ${sel ? 'rgba(124,92,252,0.60)' : theme === 'dark' ? 'rgba(255,255,255,0.07)' : t.border}`,
                              borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                              transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)',
                              transform: sel ? 'scale(1.04)' : 'scale(1)',
                              boxShadow: sel ? '0 0 0 3px rgba(124,92,252,0.18), 0 4px 12px rgba(124,92,252,0.2)' : 'none',
                              position: 'relative',
                            }}
                          >
                            {sel && (
                              <div style={{
                                position: 'absolute', top: 4, right: 4, width: 14, height: 14,
                                borderRadius: '50%', background: '#7C5CFC',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              </div>
                            )}
                            <span style={{ fontSize: 18, lineHeight: 1 }}>{ind.emoji}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, lineHeight: 1.25,
                              color: sel ? '#C084FC' : t.textMuted,
                              letterSpacing: '-0.01em',
                            }}>
                              {ind.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Location */}
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      City / Location
                    </label>
                    <input
                      type="text" required placeholder="Austin, TX"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      onFocus={() => setFocusedField('location')}
                      onBlur={() => setFocusedField(null)}
                      style={iStyle('location')}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      width: '100%', padding: '13px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: 6,
                      fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
                      background: 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)',
                      border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer',
                      boxShadow: '0 4px 24px rgba(124,92,252,0.4)',
                      transition: 'all 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,92,252,0.55)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(124,92,252,0.4)'; }}
                  >
                    Continue →
                  </button>
                </>
              )}

              {step === 2 && (
                <>
                  {/* Email */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Email address
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

                  {/* Password + strength meter */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Password
                    </label>
                    <input
                      type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      style={iStyle('password')}
                    />
                    {/* Strength meter */}
                    {formData.password && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                          {[1, 2, 3, 4].map(level => (
                            <div key={level} style={{
                              flex: 1, height: 3, borderRadius: 2,
                              background: level <= pwStrength.score ? pwStrength.color : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#E5E5EF'),
                              transition: 'background 200ms ease',
                            }} />
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: pwStrength.color, fontWeight: 600 }}>
                          {pwStrength.label} password
                          {pwStrength.score < 3 && <span style={{ color: t.textMuted, fontWeight: 400 }}> — add uppercase letters, numbers, or symbols</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Trust badges */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
                    {TRUST_BADGES.map(b => (
                      <div key={b.text} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 20,
                        background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : t.input,
                        border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : t.border}`,
                        fontSize: 11, fontWeight: 600, color: t.textSecondary,
                      }}>
                        <span>{b.icon}</span>
                        <span>{b.text}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button" onClick={() => { setStep(1); setError(''); }}
                      style={{
                        padding: '13px 18px', background: 'transparent',
                        border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : t.border}`, borderRadius: 10,
                        color: t.textSecondary, fontSize: 14, fontWeight: 600,
                        cursor: 'pointer', transition: 'border-color 150ms',
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      type="submit" disabled={loading}
                      style={{
                        flex: 1, padding: '13px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
                        background: loading ? t.textDisabled : 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)',
                        border: 'none', borderRadius: 10, color: '#fff',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        boxShadow: loading ? 'none' : '0 4px 24px rgba(124,92,252,0.4)',
                        transition: 'all 150ms',
                      }}
                      onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,92,252,0.55)'; }}}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 24px rgba(124,92,252,0.4)'; }}
                    >
                      {loading
                        ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Creating…</>
                        : <><IpSparkle size={14} color="#fff" /> Create Account</>}
                    </button>
                  </div>

                  <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
                    By creating an account you agree to our{' '}
                    <span style={{ color: t.primary, cursor: 'pointer' }}>Terms</span> and{' '}
                    <span style={{ color: t.primary, cursor: 'pointer' }}>Privacy Policy</span>.
                  </div>
                </>
              )}
            </form>
          </div>

          {step === 1 && (
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: t.textMuted }}>
              Have an account?{' '}
              <Link href="/login" style={{ color: t.primary, fontWeight: 700 }}>Sign in →</Link>
            </p>
          )}

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
