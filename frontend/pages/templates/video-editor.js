import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function VideoEditorPage() {
  const router = useRouter();
  useEffect(() => {
    // Redirect to unified editor with video mode pre-enabled
    const { id, ...rest } = router.query;
    const params = new URLSearchParams({ mode: 'video', ...(id ? { id } : {}), ...rest });
    router.replace(`/templates/editor?${params.toString()}`);
  }, [router.isReady]);
  return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Redirecting to editor…</div>;
}
