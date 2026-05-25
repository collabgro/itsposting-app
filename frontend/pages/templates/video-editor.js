import dynamic from 'next/dynamic';

const VideoEditorInner = dynamic(
  () => import('../../components/templates/VideoEditorInner'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#0d0d0d', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid #222', borderTopColor: '#00C4CC',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>Loading video editor…</div>
      </div>
    ),
  }
);

export default function VideoEditorPage() {
  return <VideoEditorInner />;
}
