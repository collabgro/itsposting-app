import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  IpCalendar as CalendarIcon, IpSchedule, IpSparkle, IpPlus,
  IpDrafts, IpPhoto as ImageIcon, IpCarousel, IpVideo,
  IpFacebook, IpInstagram, IpGoogle, IpArrowRight, IpFlame,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, StatCard, SectionHeader, EmptyState } from '../components/ui';
import { useTheme } from '../lib/theme';
import ContentCreatorModal from '../components/ContentCreatorModal';
import PostCoreBanner from '../components/PostCoreBanner';
import { format } from 'date-fns';

const TYPE_ICON  = { static: IpDrafts, photo: ImageIcon, carousel: IpCarousel, video: IpVideo };
const TYPE_COLOR = { static: '#60A5FA', photo: '#A78BFA', carousel: '#F472B6', video: '#FB923C' };
const PLATFORM_ICONS = {
  facebook:        { icon: IpFacebook,  color: '#1877F2' },
  instagram:       { icon: IpInstagram, color: '#E1306C' },
  google_business: { icon: IpGoogle,    color: '#4285F4' },
};

function parsePlatforms(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

// Content mix helpers — rough heuristic until wizard stores content themes
const MIX_CONFIG = [
  { key: 'educational', label: 'Educational', target: 70, color: '#3B82F6' },
  { key: 'social_proof', label: 'Social proof', target: 20, color: '#22C55E' },
  { key: 'promotional',  label: 'Promotional',  target: 10, color: '#EAB308' },
];

function classifyPost(post) {
  const type = post.content_type;
  if (type === 'static' || type === 'carousel') return 'educational';
  if (type === 'video') return 'social_proof';
  return 'promotional';
}

function computeMix(posts) {
  if (!posts.length) return { educational: 70, social_proof: 20, promotional: 10 };
  const counts = { educational: 0, social_proof: 0, promotional: 0 };
  posts.forEach(p => { const k = classifyPost(p); counts[k] = (counts[k] || 0) + 1; });
  const total = posts.length;
  return {
    educational:  Math.round((counts.educational  / total) * 100),
    social_proof: Math.round((counts.social_proof / total) * 100),
    promotional:  Math.round((counts.promotional  / total) * 100),
  };
}

export default function Dashboard() {
  const router = useRouter();
  const { t } = useTheme();

  const [mounted, setMounted]               = useState(false);
  const [stats, setStats]                   = useState(null);
  const [allPosts, setAllPosts]             = useState([]);
  const [upcoming, setUpcoming]             = useState([]);
  const [profile, setProfile]               = useState(null);
  const [loading, setLoading]               = useState(true);
  const [showAIModal, setShowAIModal]       = useState(false);
  const [modalInitialPrompt, setModalInitialPrompt] = useState('');
  const [modalInitialType, setModalInitialType]     = useState('');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/posts/analytics/summary', { headers }).then(r => r.json()).catch(() => ({})),
      fetch('/api/posts?limit=100',         { headers }).then(r => r.json()).catch(() => []),
      fetch('/api/posts/upcoming',          { headers }).then(r => r.json()).catch(() => []),
      fetch('/api/customers/profile',       { headers }).then(r => r.json()).catch(() => null),
    ]).then(([s, p, u, prof]) => {
      setStats(s);
      setAllPosts(Array.isArray(p) ? p : []);
      setUpcoming(Array.isArray(u) ? u : []);
      setProfile(prof);
      setLoading(false);
    });
  }, []);

  const openModalWithDraft = (caption) => {
    setModalInitialPrompt(caption);
    setModalInitialType('photo');
    setShowAIModal(true);
  };

  const openModalForCustomize = (caption) => {
    setModalInitialPrompt(caption);
    setModalInitialType('');
    setShowAIModal(true);
  };

  const closeModal = () => {
    setShowAIModal(false);
    setModalInitialPrompt('');
    setModalInitialType('');
  };

  // Calendar helpers
  const today    = new Date();
  const year     = today.getFullYear();
  const month    = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const calDays  = [];
  for (let i = 0; i < firstDay.getDay(); i++) calDays.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) calDays.push(d);

  const postsThisMonth = allPosts.filter(p => {
    const date = p.scheduled_date || p.created_at;
    if (!date) return false;
    const d = new Date(date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const getPostsForDay = d =>
    postsThisMonth.filter(p => new Date(p.scheduled_date || p.created_at).getDate() === d);

  const contentMix = useMemo(() => computeMix(allPosts.slice(0, 20)), [allPosts]);
  const streak = profile?.posting_streak || 0;

  if (!mounted) return null;

  if (loading) {
    return (
      <Layout title="Dashboard" subtitle="Welcome back">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${t.primaryBg}`, borderTopColor: t.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout
        title="Dashboard"
        subtitle={today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setShowAIModal(true)}>
              <IpSparkle size={14} style={{ color: t.primary }} /> Create
            </Button>
            <Button variant="primary" onClick={() => router.push('/upload')}>
              <IpPlus size={14} strokeWidth={2.5} /> Create Post
            </Button>
          </div>
        }
      >
        {/* 1. PostCore banner */}
        <PostCoreBanner
          onUsePost={openModalWithDraft}
          onCustomizePost={openModalForCustomize}
        />

        {/* 2. Quick-create strip */}
        <div
          style={{
            padding: '14px 20px',
            background: 'linear-gradient(135deg, rgba(124,92,252,0.15) 0%, rgba(91,63,240,0.07) 100%)',
            border: `1px solid ${t.primaryBorder}`,
            borderRadius: 12, marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IpSparkle size={18} style={{ color: t.primary }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Create content</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>Generate captions, photos, carousels or videos with one click</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" onClick={() => router.push('/upload')}>Manual upload</Button>
            <Button variant="primary" size="sm" onClick={() => setShowAIModal(true)}><IpSparkle size={13} /> Create</Button>
          </div>
        </div>

        {/* 3. Stats row — 5 cards, streak is the 5th */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div onClick={() => router.push('/history')} style={{ cursor: 'pointer' }}>
            <StatCard label="Total posts" value={stats?.total_posts || 0} hint="View all posts" />
          </div>
          <div onClick={() => router.push('/history?filter=scheduled')} style={{ cursor: 'pointer' }}>
            <StatCard label="Scheduled" value={stats?.scheduled_count || 0} hint="View scheduled" accent="warning" />
          </div>
          <div onClick={() => router.push('/history?filter=posted')} style={{ cursor: 'pointer' }}>
            <StatCard label="Published" value={stats?.posted_count || 0} hint="View published" accent="success" />
          </div>
          <StatCard label="Total likes" value={stats?.total_likes || 0} hint="All-time engagement" accent="primary" />

          {/* Streak card */}
          <div
            style={{
              background: streak >= 3 ? 'rgba(234,179,8,0.07)' : t.card,
              border: `1px solid ${streak >= 3 ? 'rgba(234,179,8,0.25)' : t.border}`,
              borderRadius: 12, padding: '16px 18px',
              cursor: streak > 0 ? 'pointer' : 'default',
            }}
            onClick={() => streak > 0 && router.push('/history')}
          >
            <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, marginBottom: 4 }}>Posting streak</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: streak >= 3 ? '#EAB308' : t.text, letterSpacing: '-0.03em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {streak > 0 && <IpFlame size={20} style={{ color: '#EAB308' }} />}
              {streak > 0 ? `${streak} days` : '--'}
            </div>
            <div style={{ fontSize: 11, color: streak >= 3 ? '#EAB308' : t.textMuted }}>
              {streak >= 7 ? 'Amazing! Keep going' : streak > 0 ? 'Keep it going' : 'Post today to start'}
            </div>
          </div>
        </div>

        {/* 4. Content mix bar */}
        <ContentMixBar mix={contentMix} t={t} />

        {/* 5. Calendar + Upcoming grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
          <Card>
            <SectionHeader
              icon={CalendarIcon}
              title={`${today.toLocaleString('default', { month: 'long' })} ${year}`}
              action={<Button variant="secondary" size="sm" onClick={() => router.push('/calendar')}>Full calendar</Button>}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} style={{ fontSize: 10, color: t.textMuted, textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>{d}</div>
              ))}
              {calDays.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const isToday = day === today.getDate();
                const dayPosts = getPostsForDay(day);
                return (
                  <div
                    key={idx}
                    onClick={() => router.push('/calendar')}
                    style={{
                      aspectRatio: '1', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 2,
                      borderRadius: 6, cursor: 'pointer',
                      background: isToday ? t.primaryBg : 'transparent',
                      border: isToday ? `1px solid ${t.primaryBorder}` : '1px solid transparent',
                      transition: 'all 100ms',
                    }}
                  >
                    <span style={{ fontSize: 12, color: isToday ? t.primary : t.textSecondary, fontWeight: isToday ? 700 : 400 }}>{day}</span>
                    {dayPosts.length > 0 && (
                      <div style={{ display: 'flex', gap: 2 }}>
                        {dayPosts.slice(0, 3).map((p, i) => (
                          <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: TYPE_COLOR[p.content_type] || t.primary }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IpSchedule size={15} style={{ color: t.primary }} /></div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Upcoming posts</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>Next 30 days</div>
                </div>
              </div>
              {upcoming.length > 0 && (
                <button onClick={() => router.push('/history?filter=scheduled')} style={{ fontSize: 12, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  View all <IpArrowRight size={12} />
                </button>
              )}
            </div>

            {upcoming.length === 0 ? (
              <EmptyState
                icon={IpSchedule}
                title="No scheduled posts"
                subtitle="Schedule your next post"
                action={<Button variant="secondary" size="sm" onClick={() => setShowAIModal(true)}><IpSparkle size={12} /> Create</Button>}
              />
            ) : (
              <div>
                {upcoming.slice(0, 4).map(post => {
                  const TypeIcon = TYPE_ICON[post.content_type] || IpDrafts;
                  const typeColor = TYPE_COLOR[post.content_type] || t.primary;
                  const postPlatforms = parsePlatforms(post.platforms);
                  return (
                    <div
                      key={post.id}
                      onClick={() => router.push('/history')}
                      style={{ display: 'flex', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${t.border}`, cursor: 'pointer', transition: 'background 150ms', flexWrap: 'wrap', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.cardHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: t.input, border: `1px solid ${t.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {post.media_url
                          ? <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.target.style.display = 'none')} />
                          : <TypeIcon size={18} style={{ color: typeColor, opacity: 0.6 }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, textTransform: 'uppercase' }}>{post.content_type}</span>
                          {postPlatforms.slice(0, 2).map(pid => {
                            const pm = PLATFORM_ICONS[pid];
                            if (!pm) return null;
                            const PI = pm.icon;
                            return <PI key={pid} size={11} style={{ color: pm.color }} />;
                          })}
                        </div>
                        <div style={{ fontSize: 12, color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption || 'No caption'}</div>
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>
                        {format(new Date(post.scheduled_date), 'MMM d, h:mm a')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </Layout>

      {showAIModal && (
        <ContentCreatorModal
          onClose={closeModal}
          onSuccess={() => { closeModal(); router.push('/history'); }}
          initialPrompt={modalInitialPrompt}
          initialContentType={modalInitialType}
        />
      )}
    </>
  );
}

function ContentMixBar({ mix, t }) {
  const total = (mix.educational || 0) + (mix.social_proof || 0) + (mix.promotional || 0);
  if (!total) return null;

  const isImbalanced = mix.promotional > 15 || mix.educational < 55;

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}>Content mix (last 20 posts)</div>
        {isImbalanced && (
          <div style={{ fontSize: 11, color: '#EAB308', fontWeight: 600 }}>Too much promotional content</div>
        )}
      </div>

      <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', gap: 1, marginBottom: 8 }}>
        {MIX_CONFIG.map(cfg => {
          const pct = mix[cfg.key] || 0;
          if (!pct) return null;
          return (
            <div
              key={cfg.key}
              style={{ width: `${pct}%`, background: cfg.color, transition: 'width 400ms ease' }}
              title={`${cfg.label}: ${pct}%`}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {MIX_CONFIG.map(cfg => {
          const pct = mix[cfg.key] || 0;
          const flagged = (cfg.key === 'promotional' && pct > 15) || (cfg.key === 'educational' && pct < 55);
          return (
            <div key={cfg.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: flagged ? '#EAB308' : t.textMuted, fontWeight: flagged ? 600 : 400 }}>
                {cfg.label} {pct}% <span style={{ color: t.textDisabled }}>(target {cfg.target}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export async function getServerSideProps() { return { props: {} }; }
