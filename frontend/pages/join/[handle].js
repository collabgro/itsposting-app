import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import axios from 'axios';

const INDUSTRIES = [
  { value: 'plumbing',          label: 'Plumbing' },
  { value: 'hvac',              label: 'HVAC / Heating & Cooling' },
  { value: 'roofing',           label: 'Roofing' },
  { value: 'electrical',        label: 'Electrical' },
  { value: 'painting',          label: 'Painting' },
  { value: 'landscaping',       label: 'Landscaping' },
  { value: 'concrete',          label: 'Concrete' },
  { value: 'pest_control',      label: 'Pest Control' },
  { value: 'cleaning',          label: 'Cleaning' },
  { value: 'general_contractor', label: 'General Contractor' },
];

export async function getServerSideProps({ params, req }) {
  const { handle } = params;
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  try {
    const { data } = await axios.get(`${backendUrl}/api/public/agency-branding?handle=${encodeURIComponent(handle)}`);
    return { props: { branding: data, handle } };
  } catch {
    return { notFound: true };
  }
}

export default function JoinPage({ branding, handle }) {
  const router = useRouter();
  const [form, setForm] = useState({ businessName: '', industry: '', location: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const brandColor = branding.primaryColor || '#7C5CFC';
  const brandName  = branding.agencyName || 'ItsPosting';
  const aiName     = branding.aiAdvisorName || 'ItsPosting AI';
  const logoUrl    = branding.logo || null;
  const hidePowered = branding.hidePoweredBy || false;

  async function submit(e) {
    e.preventDefault();
    if (!form.businessName.trim() || !form.email.trim() || !form.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post('/api/auth/register', {
        email:        form.email.trim().toLowerCase(),
        password:     form.password,
        businessName: form.businessName.trim(),
        industry:     form.industry || 'general_contractor',
        location:     form.location.trim(),
        agencyHandle: handle,
      });
      if (data.token) {
        localStorage.setItem('token', data.token);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 };

  return (
    <>
      <Head>
        <title>Get Started — {brandName}</title>
        <meta name="description" content={`Sign up for ${brandName} and grow your local business with AI social media.`} />
      </Head>

      <div style={{ minHeight: '100vh', background: '#0d0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>

          {/* Brand header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} style={{ height: 44, maxWidth: 200, objectFit: 'contain', marginBottom: 16 }} />
            ) : (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 18 }}>
                  {brandName.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{brandName}</span>
              </div>
            )}
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
              Get started free
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
              {aiName} will write your social posts — no marketing experience needed.
            </p>
          </div>

          {/* Form card */}
          <form onSubmit={submit} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 28, backdropFilter: 'blur(16px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Business Name *</label>
                <input style={inputStyle} value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="e.g. Mike's Plumbing" autoFocus required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Industry</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
                    <option value="">Select…</option>
                    {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>City / Location</label>
                  <input style={inputStyle} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Austin, TX" />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Email Address *</label>
                <input type="email" style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@business.com" required />
              </div>

              <div>
                <label style={labelStyle}>Password *</label>
                <input type="password" style={inputStyle} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 8 characters" required />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: 8, fontSize: 13, color: '#FF453A' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '13px 0', background: loading ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)`, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 200ms', boxShadow: loading ? 'none' : `0 6px 20px ${brandColor}44` }}
              >
                {loading ? 'Creating your account…' : 'Create Account →'}
              </button>
            </div>
          </form>

          {/* Login link */}
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Already have an account?{' '}
            <a href={`/login?a=${encodeURIComponent(handle)}`} style={{ color: brandColor, fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
          </div>

          {!hidePowered && (
            <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
              Powered by ItsPosting
            </div>
          )}
        </div>
      </div>
    </>
  );
}
