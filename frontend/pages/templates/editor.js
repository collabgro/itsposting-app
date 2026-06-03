import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

function LoadingScreen() {
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      setElapsed(s);
      if (s >= 60) { setFailed(true); clearInterval(iv); }
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  if (failed) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#f5f5f5', gap: 16, padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 16, color: '#333', fontWeight: 700 }}>Studio failed to load</div>
        <div style={{ fontSize: 13, color: '#666', maxWidth: 360 }}>
          Open DevTools → Console tab and check for red errors, then reload.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 8, padding: '10px 24px', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Reload page
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f5f5f5', gap: 16,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid #e0e0e0', borderTopColor: '#7C5CFC',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: 14, color: '#888', fontWeight: 500 }}>Loading Studio editor…</div>
      <div style={{ fontSize: 12, color: '#aaa' }}>
        {elapsed < 5 ? 'Compiling editor…' : `${elapsed}s — compiling large bundle…`}
      </div>
    </div>
  );
}

const TemplatesEditorInner = dynamic(
  () => import('../../components/templates/TemplatesEditorInner').catch(err => {
    console.error('[Studio] Failed to load editor:', err);
    // Return a fallback component so the loading state resolves
    return { default: () => (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', gap: 12, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 16, color: '#333', fontWeight: 700 }}>Studio failed to load</div>
        <div style={{ fontSize: 13, color: '#666' }}>Error: {err?.message || 'Unknown error'}</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '10px 24px', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Reload</button>
      </div>
    )};
  }),
  { ssr: false, loading: LoadingScreen }
);

export default function TemplatesEditorPage() {
  return <TemplatesEditorInner />;
}
