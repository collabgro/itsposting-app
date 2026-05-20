import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const { connected, error } = router.query;
    if (window.opener) {
      window.opener.postMessage(
        { type: 'oauth_callback', connected, error },
        window.location.origin
      );
      window.close();
    } else {
      router.replace('/settings');
    }
  }, [router.isReady, router.query]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#6b7280' }}>
      Connecting... you can close this window.
    </div>
  );
}
