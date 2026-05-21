import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const { connected, error } = router.query;
    if (!connected && !error) return;

    // Write result to localStorage so the parent settings.js window picks it
    // up via the 'storage' event (fires in every other same-origin window).
    // This works even when window.opener / window.name are cleared by the
    // browser after cross-origin navigation (Chrome 88+ behaviour).
    localStorage.setItem('oauth_result', JSON.stringify({ connected, error, ts: Date.now() }));

    // Close the popup. Works when this window was opened via window.open().
    // For full-page flow (popup blocked by browser), window.close() is a no-op.
    window.close();

    // If the window is still open 500ms later, we're in the full-page flow.
    // Navigate to settings so the URL-param handler there can show the toast.
    const timer = setTimeout(() => {
      router.replace(`/settings?connected=${connected || ''}&error=${error || ''}`);
    }, 500);

    return () => clearTimeout(timer);
  }, [router.isReady, router.query]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#6b7280' }}>
      Connecting... you can close this window.
    </div>
  );
}
