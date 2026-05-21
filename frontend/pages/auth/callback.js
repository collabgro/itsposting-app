import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const { connected, error } = router.query;

    // window.name is set to 'oauth_popup' by window.open() in settings.js.
    // It persists through cross-origin redirects (unlike window.opener which
    // browsers null-out after cross-origin navigation for security).
    if (window.name === 'oauth_popup') {
      // Write result to localStorage — this fires a 'storage' event in the
      // parent window (settings.js), which picks it up and refreshes accounts.
      localStorage.setItem('oauth_result', JSON.stringify({ connected, error, ts: Date.now() }));
      window.close();
    } else {
      // Popup was blocked — same-window flow. Navigate settings with params
      // so the page can show the right toast and reload accounts.
      router.replace(`/settings?connected=${connected || ''}&error=${error || ''}`);
    }
  }, [router.isReady, router.query]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#6b7280' }}>
      Connecting... you can close this window.
    </div>
  );
}
