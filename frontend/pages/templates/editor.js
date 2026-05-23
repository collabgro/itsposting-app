import dynamic from 'next/dynamic';
import Layout from '../../components/Layout';

const TemplatesEditorInner = dynamic(
  () => import('../../components/templates/TemplatesEditorInner'),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading editor...</div> }
);

export default function TemplatesEditorPage() {
  return (
    <Layout title="Templates Editor" subtitle="Design your graphic">
      <TemplatesEditorInner />
    </Layout>
  );
}
