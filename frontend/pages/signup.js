import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { IpSparkle } from '../components/icons';
import { useTheme } from '../lib/theme';
import { authAPI } from '../lib/api';

const INDUSTRIES = [
  { label: 'Plumbing',            value: 'plumbing' },
  { label: 'HVAC',                value: 'hvac' },
  { label: 'Roofing',             value: 'roofing' },
  { label: 'Concrete & Masonry',  value: 'concrete' },
  { label: 'Landscaping',         value: 'landscaping' },
  { label: 'Electrical',          value: 'electrical' },
  { label: 'Painting',            value: 'painting' },
  { label: 'Pest Control',        value: 'pest_control' },
  { label: 'Cleaning',            value: 'cleaning' },
  { label: 'General Contracting', value: 'general_contractor' },
  { label: 'Carpentry',           value: 'general_contractor' },
  { label: 'Other',               value: 'general_contractor' },
];

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
      background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : t.input,
      border: `1px solid ${focusedField === field ? 'rgba(124,92,252,0.6)' : t.borderStrong}`,
      borderRadius: 10, color: t.text, fontSize: 14, outline: 'none',
      boxShadow: focusedField === field ? '0 0 0 3px rgba(124,92,252,0.12)' : 'none',
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
            <div style={{ fontSize: 14, color: t.textMuted, marginTop: 6, letterSpacing: '-0.01em', transition: 'all 300ms ease' }}>
              {tagline}
            </div>

            {/* Step indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              {[1, 2].map(s => (
                <div key={s} style={{
                  height: 4, borderRadius: 4,
                  width: step >= s ? 48 : 24,
                  background: step >= s
                    ? 'linear-gradient(90deg, #9B4FD4, #C44BB8)'
                    : theme === 'dark' ? 'rgba(255,255,255,0.1)' : t.border,
                  transition: 'all 400ms cubic-bezier(0.16,1,0.3,1)',
                }} />
              ))}
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

                  {/* Industry */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Industry
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {INDUSTRIES.map(ind => {
                        const sel = formData.industry === ind.label;
                        return (
                          <button
                            key={ind.label} type="button"
                            onClick={() => setFormData({ ...formData, industry: ind.label })}
                            style={{
                              padding: '11px 6px',
                              background: sel
                                ? 'rgba(124,92,252,0.15)'
                                : theme === 'dark' ? 'rgba(255,255,255,0.03)' : t.input,
                              border: `1px solid ${sel ? 'rgba(124,92,252,0.55)' : theme === 'dark' ? 'rgba(255,255,255,0.07)' : t.border}`,
                              borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                              color: sel ? '#C084FC' : t.textMuted,
                              fontSize: 11, fontWeight: 700, lineHeight: 1.35,
                              transition: 'all 150ms ease',
                              boxShadow: sel ? '0 0 0 1px rgba(124,92,252,0.2)' : 'none',
                            }}
                          >
                            {ind.label}
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
                      width: '100%', padding: '14px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: 6,
                      fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
                      background: 'linear-gradient(135deg, #9B4FD4 0%, #C44BB8 100%)',
                      border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer',
                      boxShadow: '0 4px 24px rgba(155,79,212,0.4)',
                      transition: 'opacity 150ms, box-shadow 150ms',
                    }}
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

                  {/* Password */}
                  <div style={{ marginBottom: 18 }}>
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
                  </div>

                  {/* Free credits callout */}
                  <div style={{
                    padding: '12px 14px', background: t.primaryBg,
                    borderLeft: '3px solid #9B4FD4',
                    borderRadius: '0 8px 8px 0',
                    marginBottom: 24, fontSize: 13, color: t.primary,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <IpSparkle size={14} style={{ flexShrink: 0 }} />
                    <span><strong>10 free credits</strong> — generate posts immediately</span>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button" onClick={() => { setStep(1); setError(''); }}
                      style={{
                        padding: '14px 20px', background: 'transparent',
                        border: `1px solid ${t.border}`, borderRadius: 10,
                        color: t.textSecondary, fontSize: 14, fontWeight: 600,
                        cursor: 'pointer', transition: 'border-color 150ms',
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      type="submit" disabled={loading}
                      style={{
                        flex: 1, padding: '14px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
                        background: loading ? t.textDisabled : 'linear-gradient(135deg, #9B4FD4 0%, #C44BB8 100%)',
                        border: 'none', borderRadius: 10, color: '#fff',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        boxShadow: loading ? 'none' : '0 4px 24px rgba(155,79,212,0.4)',
                        transition: 'opacity 150ms, box-shadow 150ms',
                      }}
                    >
                      {loading ? 'Creating…' : 'Create Account'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>

          {step === 1 && (
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: t.textMuted }}>
              Have an account?{' '}
              <Link href="/login" style={{ color: t.primary, fontWeight: 600 }}>Sign in →</Link>
            </p>
          )}

        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps() { return { props: {} }; }
