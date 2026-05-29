import { useEffect, useState } from 'react';
import Head from 'next/head';
import { publicAPI } from '../lib/api';

const INDUSTRY_LABELS = {
  plumbing: 'Plumbing', hvac: 'HVAC', roofing: 'Roofing',
  concrete: 'Concrete', landscaping: 'Landscaping', electrical: 'Electrical',
  painting: 'Painting', pest_control: 'Pest Control',
  general_contractor: 'General Contractor', cleaning: 'Cleaning',
};

const INDUSTRY_COLORS = {
  plumbing: '#3b82f6', hvac: '#06b6d4', roofing: '#f59e0b', concrete: '#6b7280',
  landscaping: '#22c55e', electrical: '#eab308', painting: '#a855f7',
  pest_control: '#ef4444', general_contractor: '#f97316', cleaning: '#14b8a6',
};

const INDUSTRY_EMOJIS = {
  plumbing: '🔧', hvac: '❄️', roofing: '🏠', concrete: '🏗️',
  landscaping: '🌿', electrical: '⚡', painting: '🎨',
  pest_control: '🦟', general_contractor: '🔨', cleaning: '🧹',
};

const INDUSTRIES = Object.entries(INDUSTRY_LABELS).map(([k, v]) => ({ id: k, label: v }));

function BusinessCard({ biz }) {
  const color = INDUSTRY_COLORS[biz.industry] || '#7C5CFC';
  const emoji = INDUSTRY_EMOJIS[biz.industry] || '🏢';
  const label = INDUSTRY_LABELS[biz.industry] || biz.industry || 'Business';

  return (
    <a
      href={`/p/${biz.public_handle}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div style={{
        background: '#16161D', border: '1px solid #26262F', borderRadius: 16,
        overflow: 'hidden', transition: 'transform 150ms, border-color 150ms',
        cursor: 'pointer',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = '#3D3D52'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#26262F'; }}
      >
        {/* Header gradient with emoji */}
        <div style={{
          height: 80, background: `linear-gradient(135deg, ${color}22, ${color}44)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderBottom: '1px solid #26262F', fontSize: 36,
        }}>
          {biz.avatar_url ? (
            <img src={biz.avatar_url} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${color}66` }} />
          ) : (
            <span>{emoji}</span>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#E2E2E8', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {biz.business_name || biz.public_handle}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 11, background: `${color}22`, color: color, padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>
              {label}
            </span>
            {biz.location && (
              <span style={{ fontSize: 11, color: '#6E6E73', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {biz.location}
              </span>
            )}
          </div>

          {biz.tagline && (
            <p style={{ fontSize: 12, color: '#A0A0B0', margin: '0 0 10px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {biz.tagline}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#6E6E73' }}>
              {biz.post_count} post{biz.post_count !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 11, color: color, fontWeight: 600 }}>View profile →</span>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function Showcase() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [industry, setIndustry] = useState('');
  const LIMIT = 12;

  const load = (p = 0, ind = industry) => {
    setLoading(true);
    const params = { page: p, limit: LIMIT };
    if (ind) params.industry = ind;
    publicAPI.getShowcase(params)
      .then(res => {
        if (p === 0) setBusinesses(res.data.businesses);
        else setBusinesses(prev => [...prev, ...res.data.businesses]);
        setTotal(res.data.total);
        setPage(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(0, industry); }, [industry]);

  const hasMore = businesses.length < total;

  return (
    <>
      <Head>
        <title>Business Showcase — ItsPosting</title>
        <meta name="description" content="Local service businesses growing with AI-powered social media. Discover plumbers, HVAC, roofers, and more on ItsPosting." />
        <meta property="og:title" content="Business Showcase — ItsPosting" />
        <meta property="og:description" content="Local businesses growing with AI social media automation." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#0A0A0F', fontFamily: 'Inter, -apple-system, sans-serif', color: '#E2E2E8' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(180deg, #16161D 0%, #0A0A0F 100%)', borderBottom: '1px solid #26262F', padding: '48px 24px 40px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.3)', borderRadius: 20, padding: '4px 14px', marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: '#9D7FFF', fontWeight: 600 }}>✦ Powered by ItsPosting AI</span>
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: 36, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              Local Business Showcase
            </h1>
            <p style={{ margin: '0 0 32px', fontSize: 16, color: '#A0A0B0', maxWidth: 540, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              Discover local service businesses growing their social presence with AI-powered content.
            </p>

            {/* Industry filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => setIndustry('')}
                style={{
                  padding: '6px 16px', borderRadius: 20, border: `1px solid ${!industry ? '#7C5CFC' : '#26262F'}`,
                  background: !industry ? 'rgba(124,92,252,0.2)' : 'transparent',
                  color: !industry ? '#9D7FFF' : '#A0A0B0', fontSize: 13, fontWeight: !industry ? 600 : 400,
                  cursor: 'pointer', transition: 'all 150ms',
                }}>
                All industries
              </button>
              {INDUSTRIES.map(ind => (
                <button
                  key={ind.id}
                  onClick={() => setIndustry(ind.id)}
                  style={{
                    padding: '6px 16px', borderRadius: 20, border: `1px solid ${industry === ind.id ? (INDUSTRY_COLORS[ind.id] || '#7C5CFC') : '#26262F'}`,
                    background: industry === ind.id ? `${(INDUSTRY_COLORS[ind.id] || '#7C5CFC')}22` : 'transparent',
                    color: industry === ind.id ? (INDUSTRY_COLORS[ind.id] || '#9D7FFF') : '#A0A0B0',
                    fontSize: 13, fontWeight: industry === ind.id ? 600 : 400, cursor: 'pointer', transition: 'all 150ms',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                  <span>{INDUSTRY_EMOJIS[ind.id]}</span>
                  {ind.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
          {loading && businesses.length === 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ background: '#16161D', border: '1px solid #26262F', borderRadius: 16, height: 200, animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.5 }} />
              ))}
            </div>
          ) : businesses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#6E6E73' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#A0A0B0', marginBottom: 8 }}>No businesses yet</div>
              <div style={{ fontSize: 14 }}>Be the first to create your public profile!</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#6E6E73' }}>
                  {total} business{total !== 1 ? 'es' : ''}{industry ? ` in ${INDUSTRY_LABELS[industry]}` : ''}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
                {businesses.map(biz => (
                  <BusinessCard key={biz.public_handle} biz={biz} />
                ))}
              </div>
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 40 }}>
                  <button
                    onClick={() => load(page + 1)}
                    disabled={loading}
                    style={{
                      padding: '12px 32px', background: '#16161D', border: '1px solid #3D3D52',
                      borderRadius: 10, color: '#E2E2E8', fontSize: 14, fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                    }}>
                    {loading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #1C1C24', padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#6E6E73' }}>
            Want to be featured?{' '}
            <a href="https://app.itsposting.com/signup" style={{ color: '#7C5CFC', textDecoration: 'none', fontWeight: 600 }}>
              Start your free trial →
            </a>
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#444' }}>
            <a href="https://app.itsposting.com" style={{ color: '#555', textDecoration: 'none', fontWeight: 700 }}>ItsPosting</a>
            {' '} · AI Social Media Automation for Local Businesses
          </p>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 0.8; }
          }
        `}</style>
      </div>
    </>
  );
}
