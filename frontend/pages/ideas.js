import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  IpRefresh, IpSparkle, IpFacebook, IpInstagram, IpGoogle, IpLinkedIn,
  IpCheck, IpWarning,
} from '../components/icons';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';
import { ideasAPI, customerAPI } from '../lib/api';
import { setMascotMood } from '../components/PostCoreMascot';

const CATEGORY_CONFIG = {
  educational:  { label: 'Educational',  color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)'  },
  seasonal:     { label: 'Seasonal',     color: '#3B82F6', bg: 'rgba(59,130,246,0.12)'  },
  social_proof: { label: 'Social Proof', color: '#10B981', bg: 'rgba(16,185,129,0.12)'  },
  promotional:  { label: 'Promotional',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
};

const URGENCY_CONFIG = {
  high:   { label: 'Hot right now', emoji: '🔥' },
  medium: { label: 'Good timing',   emoji: '📅' },
  low:    { label: 'Evergreen',     emoji: '💡' },
};

const PLATFORM_ICONS = {
  facebook:  IpFacebook,
  instagram: IpInstagram,
  google:    IpGoogle,
  linkedin:  IpLinkedIn,
  both:      null,
};

// Skeleton card for loading state
function SkeletonCard({ t }) {
  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 14,
    padding: 20,
    boxShadow: `0 1px 3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };
  return (
    <div style={{ ...gc, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[60, 100, 40, 80, 120, 44].map((w, i) => (
        <div key={i} style={{
          height: i === 2 ? 14 : i === 5 ? 36 : 16,
          width: `${w}%`,
          background: t.input,
          borderRadius: 6,
          animation: 'shimmer 1.4s ease-in-out infinite',
        }} />
      ))}
      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function IdeaCard({ idea, onUse, onCopyHook, copied, t }) {
  const cat = CATEGORY_CONFIG[idea.category] || CATEGORY_CONFIG.educational;
  const urg = URGENCY_CONFIG[idea.urgency] || URGENCY_CONFIG.medium;

  const platforms = idea.platform === 'both'
    ? ['facebook', 'instagram']
    : idea.platform === 'google'
    ? ['google']
    : [idea.platform].filter(Boolean);

  return (
    <div style={{
      background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
      backdropFilter: 'blur(16px) saturate(160%)',
      WebkitBackdropFilter: 'blur(16px) saturate(160%)',
      border: `1px solid ${idea.used ? (t.isDark ? 'rgba(255,255,255,0.07)' : t.border) : cat.color + '35'}`,
      borderLeft: idea.used ? undefined : `3px solid ${cat.color}`,
      borderRadius: 14,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      position: 'relative',
      opacity: idea.used ? 0.55 : 1,
      boxShadow: `0 1px 3px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
      transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
    }}
    onMouseEnter={e => { if (!idea.used) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.35), 0 0 16px ${cat.color}22`; }}}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 1px 3px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`; }}
    >
      {/* Used overlay badge */}
      {idea.used && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 20,
          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
          fontSize: 11, fontWeight: 700, color: '#16a34a',
        }}>
          <IpCheck size={11} /> Used
        </div>
      )}

      {/* Category + urgency row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
          background: cat.bg, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {cat.label}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
          background: t.input, color: t.textSecondary,
        }}>
          {urg.emoji} {urg.label}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, lineHeight: 1.3 }}>
        {idea.title}
      </div>

      {/* Why now */}
      <div style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic', lineHeight: 1.5 }}>
        {idea.why_now}
      </div>

      {/* Hook preview */}
      <div style={{
        padding: '10px 12px',
        background: t.input,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        fontSize: 12,
        color: t.textSecondary,
        lineHeight: 1.6,
        fontStyle: 'italic',
      }}>
        "{idea.hook}"
      </div>

      {/* Caption preview */}
      {idea.caption_preview && (
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
          {idea.caption_preview}…
        </div>
      )}

      {/* Hashtags */}
      {idea.hashtags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {idea.hashtags.slice(0, 4).map((tag, i) => (
            <span key={i} style={{
              fontSize: 11, color: t.primary, fontWeight: 500,
              padding: '2px 6px', borderRadius: 4,
              background: `${t.primary}15`, border: `1px solid ${t.primary}25`,
            }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: platforms + copy hook */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {platforms.map(p => {
            const Icon = PLATFORM_ICONS[p];
            if (!Icon) return null;
            const colors = { facebook: '#1877F2', instagram: '#E1306C', google: '#4285F4', linkedin: '#0A66C2' };
            return (
              <div key={p} style={{
                width: 26, height: 26, borderRadius: 6,
                background: `${colors[p]}15`, border: `1px solid ${colors[p]}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={13} style={{ color: colors[p] }} />
              </div>
            );
          })}
        </div>
        <button
          onClick={() => onCopyHook(idea.id, idea.hook)}
          style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 600,
            background: copied === idea.id ? 'rgba(34,197,94,0.1)' : 'transparent',
            border: `1px solid ${copied === idea.id ? 'rgba(34,197,94,0.4)' : t.border}`,
            borderRadius: 6,
            color: copied === idea.id ? '#16a34a' : t.textMuted,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {copied === idea.id ? <><IpCheck size={10} /> Copied</> : 'Copy hook'}
        </button>
      </div>

      {/* Use This Idea CTA */}
      <button
        onClick={() => onUse(idea)}
        disabled={idea.used}
        style={{
          width: '100%', padding: '10px 0',
          background: idea.used ? t.input : cat.color,
          color: idea.used ? t.textMuted : '#fff',
          border: 'none', borderRadius: 9,
          fontSize: 13, fontWeight: 700, cursor: idea.used ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'opacity 150ms',
        }}
      >
        {idea.used ? '✓ Already used' : <><IpSparkle size={14} style={{ color: '#fff' }} /> Use This Idea</>}
      </button>
    </div>
  );
}

export default function PostIdeas() {
  const router = useRouter();
  const { t } = useTheme();

  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(null); // minutes remaining
  const [copiedId, setCopiedId] = useState(null);
  const [industry, setIndustry] = useState('');
  const [toast, setToast] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      const fn = isRefresh ? ideasAPI.refresh : ideasAPI.getToday;
      const res = await fn();
      const fetched = res.data.ideas || [];
      setIdeas(fetched);
      if (fetched.length > 0) setMascotMood('thinking', `${fetched.length} fresh ideas ready — pick one and let's create!`);

      if (res.data.refreshed_at) {
        const diffMin = Math.floor((Date.now() - new Date(res.data.refreshed_at)) / 60000);
        const wait = Math.max(0, 60 - diffMin);
        setRefreshCooldown(wait > 0 ? wait : null);
      } else {
        setRefreshCooldown(null);
      }
    } catch (err) {
      if (err.response?.status === 429) {
        const wait = err.response.data?.nextRefreshIn;
        setRefreshCooldown(wait || 60);
        showToast(err.response.data?.error || 'Try again in an hour', 'error');
      } else if (err.response?.status === 402) {
        showToast('Not enough credits to refresh. Top up your plan to continue.', 'error');
      } else {
        setError('Failed to load ideas. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setGenerating(false);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    customerAPI.getProfile().then(r => setIndustry(r.data.industry || '')).catch(() => {});
    // If no ideas yet, show generating state while first fetch happens
    setGenerating(true);
    load(false);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleRefresh = () => load(true);

  const handleUse = async (idea) => {
    setMascotMood('excited', `Great choice! Opening the wizard for "${idea.title}"…`);
    try {
      await ideasAPI.markUsed(idea.id);
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, used: true } : i));
      router.push(
        `/wizard?theme=${encodeURIComponent(idea.wizardTheme || 'share_tip')}&details=${encodeURIComponent(idea.hook)}&ideaTitle=${encodeURIComponent(idea.title)}`
      );
    } catch {
      // Still navigate even if mark-used fails
      router.push(
        `/wizard?theme=${encodeURIComponent(idea.wizardTheme || 'share_tip')}&details=${encodeURIComponent(idea.hook)}&ideaTitle=${encodeURIComponent(idea.title)}`
      );
    }
  };

  const handleCopyHook = (id, hook) => {
    navigator.clipboard.writeText(hook).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const industryLabel = industry ? industry.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'your industry';

  // Full-page generating state (first ever load)
  const showGenerating = generating && ideas.length === 0;

  return (
    <Layout
      title="Post Ideas"
      subtitle={`PostCore researched what's trending in ${industryLabel} · ${today}`}
      action={
        <button
          onClick={handleRefresh}
          disabled={refreshing || !!refreshCooldown}
          title="Generates a fresh set of ideas using AI — costs 1 credit"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 9,
            background: refreshing || refreshCooldown ? t.input : t.primary,
            color: refreshing || refreshCooldown ? t.textMuted : '#fff',
            border: `1px solid ${refreshing || refreshCooldown ? t.border : t.primary}`,
            fontSize: 13, fontWeight: 600,
            cursor: refreshing || refreshCooldown ? 'not-allowed' : 'pointer',
            transition: 'all 150ms',
          }}
        >
          <IpRefresh size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          {refreshing
            ? 'Refreshing...'
            : refreshCooldown
            ? `Next refresh in ${refreshCooldown}m`
            : <><span>Refresh Ideas</span><span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, background: 'rgba(255,255,255,0.18)', borderRadius: 4, padding: '1px 5px', marginLeft: 2 }}>1 credit</span></>
          }
        </button>
      }
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: toast.type === 'success' ? '#16a34a' : '#dc2626',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Generating first-time state */}
        {showGenerating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `${t.primary}15`, border: `2px solid ${t.primary}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IpSparkle size={24} style={{ color: t.primary, animation: 'spin 2s linear infinite' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                PostCore is researching your industry...
              </div>
              <div style={{ fontSize: 13, color: t.textMuted }}>
                Analysing trends and seasonal opportunities for {industryLabel} businesses
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !showGenerating && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '60px 20px',
          }}>
            <IpWarning size={32} style={{ color: t.error }} />
            <div style={{ fontSize: 15, color: t.text, fontWeight: 600 }}>{error}</div>
            <button onClick={() => load(false)} style={{
              padding: '9px 20px', background: t.primary, color: '#fff', border: 'none',
              borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Try Again
            </button>
          </div>
        )}

        {/* Skeleton loading (cached ideas loading) */}
        {loading && !showGenerating && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} t={t} />)}
          </div>
        )}

        {/* Ideas grid */}
        {!loading && !showGenerating && !error && ideas.length > 0 && (
          <>
            {/* Intro bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16, flexWrap: 'wrap', gap: 8,
            }}>
              <div style={{ fontSize: 13, color: t.textMuted }}>
                <span style={{ fontWeight: 600, color: t.text }}>{ideas.length} ideas</span> ready to use — click any to open it in the Post Wizard
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                  const count = ideas.filter(i => i.category === key).length;
                  if (!count) return null;
                  return (
                    <span key={key} style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                      background: cfg.bg, color: cfg.color,
                    }}>
                      {count} {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 16 }}>
              {ideas.map(idea => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onUse={handleUse}
                  onCopyHook={handleCopyHook}
                  copied={copiedId}
                  t={t}
                />
              ))}
            </div>

            {/* Footer note */}
            <div style={{ marginTop: 24, padding: '14px 18px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 12, fontSize: 12, color: t.textMuted, lineHeight: 1.6, boxShadow: `0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})` }}>
              <strong style={{ color: t.textSecondary }}>How PostCore picks these ideas:</strong> Each morning, PostCore analyses current seasonal trends, industry-specific customer pain points, and what's typically resonating in your niche for this time of year. Ideas refresh daily — you can also manually refresh once per hour.
            </div>
          </>
        )}

      </div>
    </Layout>
  );
}
