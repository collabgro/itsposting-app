import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { IpSparkle } from '../components/icons';
import { useTheme } from '../lib/theme';
import { Button, Input } from '../components/ui';
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
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ businessName: '', industry: '', location: '', email: '', password: '' });

  useEffect(() => { setMounted(true); }, []);

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
      const { data } = await authAPI.register({ email: formData.email, password: formData.password, businessName: formData.businessName, industry: industryValue, location: formData.location });
      localStorage.setItem('token', data.token);
      router.push('/wizard?onboarding=true');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, padding: 20 }}><div style={{ width: '100%', maxWidth: 480 }}><div style={{ textAlign: 'center', marginBottom: 28 }}><div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><IpSparkle size={20} color="#fff" strokeWidth={2.5} /></div><h1 style={{ fontSize: 24, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>Its Posting</h1><div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>{[1, 2].map((s) => <div key={s} style={{ height: 3, width: 48, borderRadius: 2, background: step >= s ? t.primary : t.border, transition: 'background 300ms' }} />)}</div></div><div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 28, width: '100%' }}>{error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: t.error, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}<form onSubmit={handleSubmit}>{step === 1 && <><h2 style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Your Business</h2><p style={{ color: t.textMuted, fontSize: 13, marginBottom: 20 }}>We&apos;ll customize content for your industry</p><div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>Business Name</label><Input type="text" required value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} placeholder="ABC Plumbing" /></div><div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>Industry</label><select required value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} style={{ width: '100%', padding: '10px 14px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 13 }}><option value="">Select industry</option>{INDUSTRIES.map((ind) => <option key={ind.value + ind.label} value={ind.label}>{ind.label}</option>)}</select></div><div style={{ marginBottom: 20 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>Location</label><Input type="text" required value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="Austin, TX" /></div><Button type="submit" variant="primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14 }}>Continue →</Button></>}{step === 2 && <><h2 style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Create Account</h2><p style={{ color: t.textMuted, fontSize: 13, marginBottom: 20 }}>Start your 7-day free trial</p><div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>Email</label><Input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="you@company.com" /></div><div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>Password</label><Input type="password" required minLength={8} autoComplete="new-password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="At least 8 characters" /></div><div style={{ padding: '12px 14px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, marginBottom: 20, fontSize: 13, color: t.primary }}><IpSparkle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} /><strong>10 free credits</strong> — generate posts immediately</div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Button type="button" variant="secondary" onClick={() => setStep(1)} style={{ padding: '12px 20px' }}>Back</Button><Button type="submit" variant="primary" disabled={loading} style={{ flex: 1, justifyContent: 'center', padding: '12px', fontSize: 14 }}>{loading ? 'Creating...' : 'Create Account'}</Button></div></>}{step === 1 && <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: t.textMuted }}>Have an account? <Link href="/login" style={{ color: t.primary, fontWeight: 600 }}>Sign in</Link></p>}</form></div></div></div>;
}

export async function getServerSideProps() { return { props: {} }; }
