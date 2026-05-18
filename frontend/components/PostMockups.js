import { useTheme } from '../lib/theme';
import {
  IpFacebook, IpInstagram, IpLinkedIn, IpTikTok, IpGoogle,
} from './icons';

// ── Utils ────────────────────────────────────────────────────────────────────

export function parseHashtags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

export function parseMediaUrls(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

// ── Constants ────────────────────────────────────────────────────────────────

export const CHAR_LIMITS = {
  facebook:        63206,
  instagram:       2200,
  tiktok:          150,
  linkedin:        3000,
  google_business: 1500,
};

export const PLATFORM_META = {
  facebook:        { label: 'Facebook',        color: '#1877F2', Icon: IpFacebook },
  instagram:       { label: 'Instagram',       color: '#E1306C', Icon: IpInstagram },
  linkedin:        { label: 'LinkedIn',        color: '#0A66C2', Icon: IpLinkedIn },
  tiktok:          { label: 'TikTok',          color: '#010101', Icon: IpTikTok },
  google_business: { label: 'Google Business', color: '#4285F4', Icon: IpGoogle },
};

export const PLATFORM_ORDER = ['facebook', 'instagram', 'linkedin', 'tiktok', 'google_business'];

// ── PostImage ────────────────────────────────────────────────────────────────

export function PostImage({ post, style = {} }) {
  const mediaUrls = parseMediaUrls(post.media_urls);
  const src = mediaUrls[0] || post.media_url;
  const isCarousel = post.content_type === 'carousel' && mediaUrls.length > 1;

  if (post.content_type === 'static' || !src) return null;

  if (post.content_type === 'video') {
    return (
      <video
        src={src}
        controls
        style={{ width: '100%', display: 'block', maxHeight: 380, objectFit: 'cover', ...style }}
      />
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <img
        src={src}
        alt=""
        style={{ width: '100%', display: 'block', objectFit: 'cover', ...style }}
        onError={e => { e.target.style.display = 'none'; }}
      />
      {isCarousel && (
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
          {mediaUrls.slice(0, 5).map((_, i) => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === 0 ? '#1877F2' : 'rgba(0,0,0,0.25)' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Platform mockups ─────────────────────────────────────────────────────────

function FbActionBtn({ label }) {
  return (
    <button style={{ flex: 1, padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#65676B', fontWeight: 600, borderRadius: 6, fontFamily: 'inherit' }}>
      {label}
    </button>
  );
}

export function FacebookMockup({ post, caption }) {
  const hashtags = parseHashtags(post.hashtags);
  const fullText = caption + (hashtags.length ? '\n' + hashtags.map(h => `#${h}`).join(' ') : '');
  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.14)', overflow: 'hidden', maxWidth: 500, margin: '0 auto', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>E</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#050505' }}>Your Business</div>
          <div style={{ fontSize: 12, color: '#65676B', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IpFacebook size={11} style={{ color: '#1877F2' }} /> JUST NOW · 🌐
          </div>
        </div>
        <span style={{ color: '#65676B', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>···</span>
      </div>
      <div style={{ padding: '0 16px 12px', fontSize: 15, color: '#050505', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {fullText}
      </div>
      <PostImage post={post} style={{ maxHeight: 400 }} />
      <div style={{ height: 1, background: '#E4E6EB', margin: '0 16px' }} />
      <div style={{ display: 'flex', padding: '2px 8px' }}>
        <FbActionBtn label="👍 Like" />
        <FbActionBtn label="💬 Comment" />
        <FbActionBtn label="↗ Share" />
      </div>
    </div>
  );
}

export function InstagramMockup({ post, caption }) {
  const hashtags = parseHashtags(post.hashtags);
  const mediaUrls = parseMediaUrls(post.media_urls);
  const src = mediaUrls[0] || post.media_url;
  const isCarousel = post.content_type === 'carousel' && mediaUrls.length > 1;
  const hasMedia = post.content_type !== 'static' && src;

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.14)', overflow: 'hidden', maxWidth: 470, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>E</div>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: '#000' }}>yourbusiness</div>
        <span style={{ color: '#000', fontSize: 20, fontWeight: 700, cursor: 'pointer' }}>···</span>
      </div>
      {hasMedia && (
        <div style={{ position: 'relative', width: '100%', paddingTop: isCarousel ? '100%' : '125%', overflow: 'hidden', background: '#f0f0f0' }}>
          <img
            src={src}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          {post.content_type === 'video' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>▶</div>
            </div>
          )}
          {isCarousel && mediaUrls.length > 1 && (
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
              {mediaUrls.slice(0, 5).map((_, i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)' }} />
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ padding: '10px 14px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 24 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <span style={{ cursor: 'pointer' }}>♡</span>
          <span style={{ cursor: 'pointer' }}>💬</span>
          <span style={{ cursor: 'pointer' }}>✈️</span>
        </div>
        <span style={{ cursor: 'pointer' }}>🔖</span>
      </div>
      <div style={{ padding: '4px 14px 12px', fontSize: 14, color: '#000', lineHeight: 1.4 }}>
        <span style={{ fontWeight: 700 }}>yourbusiness</span>{' '}
        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{caption}</span>
        {hashtags.length > 0 && (
          <div style={{ color: '#4B91F7', marginTop: 4, fontSize: 13 }}>{hashtags.map(h => `#${h}`).join(' ')}</div>
        )}
        <div style={{ fontSize: 12, color: '#8E8E8E', marginTop: 5 }}>JUST NOW</div>
      </div>
    </div>
  );
}

export function LinkedInMockup({ post, caption }) {
  const hasMedia = post.content_type !== 'static';
  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.14)', overflow: 'hidden', maxWidth: 500, margin: '0 auto', fontFamily: '-apple-system, "Segoe UI", sans-serif' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#0A66C2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>E</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#000' }}>Your Business</div>
          <div style={{ fontSize: 12, color: '#666' }}>Local Business · Just now 🌐</div>
        </div>
        <button style={{ padding: '5px 14px', background: 'none', border: '1px solid #0A66C2', color: '#0A66C2', borderRadius: 16, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Follow</button>
      </div>
      <div style={{ padding: '0 16px 12px', fontSize: 14, color: '#000', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{caption}</div>
      {hasMedia && <PostImage post={post} style={{ maxHeight: 380 }} />}
      <div style={{ display: 'flex', padding: '2px 8px', borderTop: '1px solid #E9E5DF' }}>
        {['👍 Like', '💬 Comment', '↻ Repost', '✈ Send'].map(a => (
          <button key={a} style={{ flex: 1, padding: '10px 2px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#666', fontWeight: 600, fontFamily: 'inherit' }}>{a}</button>
        ))}
      </div>
    </div>
  );
}

export function TikTokMockup({ post, caption }) {
  const mediaUrls = parseMediaUrls(post.media_urls);
  const src = mediaUrls[0] || post.media_url;
  const truncated = caption.length > 90 ? caption.slice(0, 90) + '…' : caption;

  return (
    <div style={{ margin: '0 auto', width: 260, position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#111', aspectRatio: '9/16', fontFamily: 'system-ui, sans-serif' }}>
      {src ? (
        <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={() => {}} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 45%, transparent 70%)' }} />
      {post.content_type === 'video' && src && (
        <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>▶</div>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 16, left: 12, right: 52, color: '#fff' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5 }}>@yourbusiness</div>
        <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.9 }}>{truncated}</div>
        <div style={{ fontSize: 11, marginTop: 7, opacity: 0.75 }}>🎵 Original audio · yourbusiness</div>
      </div>
      <div style={{ position: 'absolute', right: 8, bottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, color: '#fff' }}>
        {[['❤️', '25K'], ['💬', '560'], ['↪', '80']].map(([icon, count]) => (
          <div key={icon} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 24 }}>{icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700 }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GoogleBusinessMockup({ post, caption }) {
  const hasMedia = post.content_type !== 'static';
  const short = caption.length > 130 ? caption.slice(0, 130) + '…' : caption;

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.14)', overflow: 'hidden', maxWidth: 460, margin: '0 auto', fontFamily: '"Google Sans", Roboto, sans-serif' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, background: '#fff' }}>
          <span style={{ fontWeight: 800, fontSize: 20, background: 'linear-gradient(135deg,#4285F4 30%,#EA4335 30%,#EA4335 55%,#FBBC05 55%,#FBBC05 75%,#34A853 75%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>G</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#202124' }}>Your Business</div>
      </div>
      {hasMedia && <PostImage post={post} style={{ maxHeight: 280 }} />}
      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{ fontSize: 14, color: '#3c4043', lineHeight: 1.6 }}>{short}</div>
        <button style={{ marginTop: 12, padding: '8px 22px', background: 'none', border: '1px solid #4285F4', color: '#4285F4', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Learn more
        </button>
      </div>
    </div>
  );
}

export const MOCKUP_MAP = {
  facebook:        FacebookMockup,
  instagram:       InstagramMockup,
  linkedin:        LinkedInMockup,
  tiktok:          TikTokMockup,
  google_business: GoogleBusinessMockup,
};

// ── Platform tab pill ────────────────────────────────────────────────────────

// darkBg: true when rendered on a dark background (modal overlay); false when on a card
export function PlatformTab({ pid, isActive, onClick, darkBg = false, t }) {
  const meta = PLATFORM_META[pid];
  if (!meta) return null;
  const PI = meta.Icon;
  const inactiveBorder = darkBg ? 'rgba(255,255,255,0.1)' : (t?.border || 'rgba(0,0,0,0.12)');
  const inactiveColor  = darkBg ? 'rgba(255,255,255,0.55)' : (t?.textMuted || '#888');
  return (
    <button
      onClick={() => onClick(pid)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8,
        border: `1px solid ${isActive ? meta.color : inactiveBorder}`,
        background: isActive ? `${meta.color}22` : 'transparent',
        color: isActive ? meta.color : inactiveColor,
        fontSize: 12, fontWeight: isActive ? 700 : 500,
        cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap',
      }}
    >
      <PI size={13} /> {meta.label}
    </button>
  );
}
