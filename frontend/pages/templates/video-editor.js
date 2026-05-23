import dynamic from 'next/dynamic';
import Layout from '../../components/Layout';

const VideoEditorInner = dynamic(
  () => import('../../components/templates/VideoEditorInner'),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading video editor...</div> }
);

export default function VideoEditorPage() {
  return (
    <Layout title="Video Editor" subtitle="Create your video">
      <VideoEditorInner />
    </Layout>
  );
}
