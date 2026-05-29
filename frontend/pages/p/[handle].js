import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { publicAPI } from '../../lib/api';

const PLATFORM_COLORS = {
  facebook: '#1877F2',
  instagram: '#E1306C',
  google: '#4285F4',
  linkedin: '#0A66C2',
  tiktok: '#010101',
};

const PLATFORM_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google Business',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
};

function PlatformIcon({ platform, size = 20 }) {
  const color = PLATFORM_COLORS[platform] || '#888';
  const icons = {
    facebook: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    instagram: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
    google: (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
    linkedin: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    tiktok: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#010101">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.78a4.84 4.84 0 01-1.02-.09z" />
      </svg>
    ),
  };
  return icons[platform] || null;
}

const INDUSTRY_LABELS = {
  plumbing: 'Plumbing',
  hvac: 'HVAC',
  roofing: 'Roofing',
  concrete: 'Concrete',
  landscaping: 'Landscaping',
  electrical: 'Electrical',
  painting: 'Painting',
  pest_control: 'Pest Control',
  general_contractor: 'General Contractor',
  cleaning: 'Cleaning',
};

export default function PublicProfile() {
  const router = useRouter();
  const { handle } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!handle) return;
    publicAPI.getProfile(handle)
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [handle]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #7C5CFC', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (notFound || !data) return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>404</div>
      <div style={{ fontSize: 20, color: '#A0A0B0', marginBottom: 32 }}>Business profile not found</div>
      <a href="https://app.itsposting.com" style={{ color: '#7C5CFC', textDecoration: 'none', fontSize: 14 }}>Powered by ItsPosting</a>
    </div>
  );

  const { profile, posts, socialAccounts } = data;
  const displayName = profile.business_name || handle;
  const locationStr = profile.location || '';
  const industryLabel = INDUSTRY_LABELS[profile.industry] || profile.industry || '';

  return (
    <>
      <Head>
        <title>{displayName} — ItsPosting</title>
        <meta name="description" content={profile.tagline || `${displayName} — ${industryLabel}${locationStr ? ` in ${locationStr}` : ''}`} />
        <meta property="og:title" content={displayName} />
        <meta property="og:description" content={profile.tagline || `${industryLabel}${locationStr ? ` · ${locationStr}` : ''}`} />
        {profile.avatar_url && <meta property="og:image" content={profile.avatar_url} />}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#0A0A0F', fontFamily: 'Inter, -apple-system, sans-serif', color: '#E2E2E8' }}>
        {/* Hero header */}
        <div style={{ background: 'linear-gradient(180deg, #16161D 0%, #0A0A0F 100%)', borderBottom: '1px solid #26262F', padding: '48px 24px 40px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '3px solid #7C5CFC', marginBottom: 20, display: 'block', margin: '0 auto 20px' }}
              />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: '#fff', margin: '0 auto 20px' }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>{displayName}</h1>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              {industryLabel && (
                <span style={{ background: 'rgba(124, 92, 252, 0.15)', color: '#9D7FFF', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500 }}>
                  {industryLabel}
                </span>
              )}
              {locationStr && (
                <span style={{ color: '#A0A0B0', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  {locationStr}
                </span>
              )}
            </div>

            {profile.tagline && (
              <p style={{ margin: '0 0 20px', fontSize: 15, color: '#B0B0C0', lineHeight: 1.6, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
                {profile.tagline}
              </p>
            )}

            {/* Social links */}
            {socialAccounts && socialAccounts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                {socialAccounts.map((acc) => (
                  <div
                    key={acc.platform}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: '#1C1C24', border: '1px solid #2E2E3A',
                      borderRadius: 8, padding: '7px 14px',
                      color: '#E2E2E8', fontSize: 13, fontWeight: 500,
                    }}
                  >
                    <PlatformIcon platform={acc.platform} size={16} />
                    {acc.profile_name || acc.account_username || PLATFORM_LABELS[acc.platform]}
                  </div>
                ))}
              </div>
            )}

            {profile.website_url && (
              <a
                href={profile.website_url.startsWith('http') ? profile.website_url : `https://${profile.website_url}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#7C5CFC', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                {profile.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
          </div>
        </div>

        {/* Recent posts */}
        {posts && posts.length > 0 && (
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700, color: '#E2E2E8' }}>Recent Posts</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {posts.map((post) => (
                <div key={post.id} style={{ background: '#16161D', border: '1px solid #26262F', borderRadius: 12, overflow: 'hidden' }}>
                  {post.media_url && (
                    <div style={{ aspectRatio: '4/5', overflow: 'hidden', background: '#0A0A0F' }}>
                      <img
                        src={post.media_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div style={{ padding: '12px 14px' }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#A0A0B0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.caption}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer / CTA */}
        <div style={{ borderTop: '1px solid #1C1C24', padding: '32px 24px', textAlign: 'center' }}>
          <a
            href="https://app.itsposting.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#6E6E73', fontSize: 13 }}
          >
            <span>Powered by</span>
            <span style={{ fontWeight: 700, color: '#7C5CFC', letterSpacing: '-0.3px' }}>ItsPosting</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C5CFC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 010 8h-1" /><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          </a>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#444' }}>AI Social Media Automation for Local Businesses</p>
        </div>
      </div>
    </>
  );
}
