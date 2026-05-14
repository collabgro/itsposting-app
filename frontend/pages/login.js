import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { IpSparkle } from '../components/icons';
import { useTheme } from '../lib/theme';
import { Button, Input } from '../components/ui';
import { authAPI } from '../lib/api';

export default function Login() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem('token')) router.replace('/dashboard');
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

  if (!mounted) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <IpSparkle size={20} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>Welcome back</h1>
          <p style={{ fontSize: 13, color: t.textMuted, marginTop: 6 }}>Sign in to continue</p>
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 28, width: '100%' }}>
          {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: t.error, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>Email</label><Input type="email" required placeholder="you@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
            <div style={{ marginBottom: 20 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>Password</label><Input type="password" required autoComplete="current-password" placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} /></div>
            <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14 }}>{loading ? 'Signing in...' : 'Sign in'}</Button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: t.textMuted }}>Don&apos;t have an account? <Link href="/signup" style={{ color: t.primary, fontWeight: 600 }}>Start free trial</Link></p>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps() { return { props: {} }; }
