import dynamic from 'next/dynamic';

const TemplatesEditorInner = dynamic(
  () => import('../../components/templates/TemplatesEditorInner'),
  {
    ssr: false,
    loading: () => (
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
        <div style={{ fontSize: 14, color: '#888', fontWeight: 500 }}>Loading editor…</div>
      </div>
    ),
  }
);

export default function TemplatesEditorPage() {
  return <TemplatesEditorInner />;
}
