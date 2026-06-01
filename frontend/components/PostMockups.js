import { useState } from 'react';
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

// ── SVG icon helpers (inline, no emoji) ──────────────────────────────────────

const ThumbUpSvg = ({ size = 18, color = '#65676B' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
  </svg>
);

const CommentSvg = ({ size = 18, color = '#65676B' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const ShareSvg = ({ size = 18, color = '#65676B' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);

const HeartSvg = ({ size = 22, color = '#262626', filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#ed4956' : 'none'} stroke={filled ? '#ed4956' : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const PaperPlaneSvg = ({ size = 22, color = '#262626' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const BookmarkSvg = ({ size = 22, color = '#262626' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);

const PlaySvg = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white" stroke="none">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const GlobeSvg = ({ size = 12, color = '#65676B' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const ThreeDotsHSvg = ({ size = 20, color = '#65676B' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
  </svg>
);

const MusicNoteSvg = ({ size = 14, color = 'rgba(255,255,255,0.75)' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3" fill={color}/>
    <circle cx="18" cy="16" r="3" fill={color}/>
  </svg>
);

const RepostSvg = ({ size = 18, color = '#65676B' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
);

const SendSvg = ({ size = 18, color = '#65676B' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

// ── ProfileAvatar ─────────────────────────────────────────────────────────────
// Shows real profile picture from connected account, falls back to initial letter

// Actual platform logo SVGs for the avatar badge (not abstract Ip icons)
const PlatformBadgeSvg = ({ platform, size }) => {
  const s = size - 6;
  if (platform === 'facebook') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
  );
  if (platform === 'linkedin') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
  );
  if (platform === 'instagram') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  );
  if (platform === 'tiktok') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
  );
  if (platform === 'google_business') return (
    <svg width={s} height={s} viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
  );
  return null;
};

const PLATFORM_BADGE_CONFIG = {
  facebook:        { bg: '#1877F2', borderColor: '#fff' },
  instagram:       { bg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', borderColor: '#fff' },
  linkedin:        { bg: '#0A66C2', borderColor: '#fff' },
  tiktok:          { bg: '#010101', borderColor: '#fff' },
  google_business: { bg: '#fff',    borderColor: '#ddd' },
};

const ProfileAvatar = ({ picture, name, size = 40, fontSize = 15, igRing = false, platform = null }) => {
  const [imgErr, setImgErr] = useState(false);
  const initial = (name || 'B').charAt(0).toUpperCase();
  const badgeSize = Math.round(size * 0.46);
  const badgeCfg = platform ? PLATFORM_BADGE_CONFIG[platform] : null;
  // Instagram: use gradient ring only (no extra badge) — the ring IS the identifier
  const showBadge = badgeCfg && platform !== 'instagram';

  const avatarInner = (picture && !imgErr) ? (
    <img
      src={picture}
      alt=""
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', ...(igRing ? { border: '2px solid #fff' } : {}) }}
      onError={() => setImgErr(true)}
    />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#7C5CFC,#5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize, ...(igRing ? { border: '2px solid #fff' } : {}) }}>
      {initial}
    </div>
  );

  const wrapped = showBadge ? (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {avatarInner}
      <div style={{ position: 'absolute', bottom: -3, right: -3, width: badgeSize, height: badgeSize, borderRadius: 6, background: badgeCfg.bg, border: `2.5px solid ${badgeCfg.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <PlatformBadgeSvg platform={platform} size={badgeSize} />
      </div>
    </div>
  ) : avatarInner;

  if (!igRing) return <div style={{ flexShrink: 0 }}>{wrapped}</div>;
  // Instagram: gradient ring wraps the avatar, badge sits outside the ring at bottom-right
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ padding: 2, borderRadius: '50%', background: 'linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', display: 'inline-flex' }}>
        {wrapped}
      </div>
      {badgeCfg && (
        <div style={{ position: 'absolute', bottom: -2, right: -2, width: badgeSize, height: badgeSize, borderRadius: 6, background: badgeCfg.bg, border: `2px solid #fff`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <PlatformBadgeSvg platform={platform} size={badgeSize} />
        </div>
      )}
    </div>
  );
};

// ── PostImage ────────────────────────────────────────────────────────────────

export function PostImage({ post, style = {} }) {
  const mediaUrls = parseMediaUrls(post.media_urls);
  const src = mediaUrls[0] || post.media_url;
  const isCarousel = post.content_type === 'carousel' && mediaUrls.length > 1;

  if (post.content_type === 'static' || !src) return null;

  if (post.content_type === 'video') {
    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <video src={src} controls style={{ width: '100%', display: 'block', maxHeight: 380, objectFit: 'cover', ...style }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PlaySvg size={24} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <img src={src} alt="" style={{ width: '100%', display: 'block', objectFit: 'cover', ...style }} onError={e => { e.target.style.display = 'none'; }} />
      {isCarousel && (
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
          {mediaUrls.slice(0, 5).map((_, i) => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === 0 ? '#1877F2' : 'rgba(0,0,0,0.25)' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Facebook Mockup ──────────────────────────────────────────────────────────

export function FacebookMockup({ post, caption, profile }) {
  const hashtags = parseHashtags(post.hashtags);
  const fullText = caption + (hashtags.length ? '\n' + hashtags.map(h => `#${h}`).join(' ') : '');
  const hasMedia = post.content_type !== 'static' && (post.media_url || parseMediaUrls(post.media_urls).length > 0);
  const hasBg = !hasMedia && post.fb_text_background_css && fullText;

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.1)', overflow: 'hidden', maxWidth: 500, margin: '0 auto', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ProfileAvatar picture={profile?.picture} name={profile?.name} size={40} fontSize={15} platform="facebook" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#050505', lineHeight: 1.2 }}>{profile?.name || 'Your Business'}</div>
          <div style={{ fontSize: 12, color: '#65676B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <span>Just now</span>
            <span style={{ fontSize: 10 }}>·</span>
            <GlobeSvg size={11} color="#65676B" />
          </div>
        </div>
        <ThreeDotsHSvg size={20} color="#65676B" />
      </div>

      {/* Caption — plain text when no background */}
      {fullText && !hasBg ? (
        <div style={{ padding: '2px 16px', fontSize: 15, color: '#050505', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: hasMedia ? 10 : 12 }}>
          {fullText}
        </div>
      ) : null}

      {/* Gradient/color background — GHL-style: full-width square with centred text */}
      {hasBg && (
        <div style={{ background: post.fb_text_background_css, width: '100%', aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, boxSizing: 'border-box' }}>
          <div style={{ color: post.fb_text_color || '#fff', fontSize: caption.length < 60 ? 28 : caption.length < 140 ? 22 : 17, fontWeight: 700, textAlign: 'center', lineHeight: 1.45, wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '100%' }}>
            {caption}
          </div>
        </div>
      )}

      {/* Media */}
      {hasMedia && <PostImage post={post} style={{ maxHeight: 420 }} />}

      {/* Reaction counts row */}
      <div style={{ padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff' }}>
              <ThumbUpSvg size={10} color="#fff" />
            </div>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#F02849', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff', marginLeft: -4 }}>
              <HeartSvg size={10} color="#fff" filled />
            </div>
          </div>
          <span style={{ fontSize: 13, color: '#65676B', marginLeft: 2 }}>128</span>
        </div>
        <div style={{ fontSize: 13, color: '#65676B' }}>14 comments · 6 shares</div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#E4E6EB', margin: '0 16px' }} />

      {/* Action buttons */}
      <div style={{ display: 'flex', padding: '2px 4px' }}>
        {[
          { icon: <ThumbUpSvg size={18} />, label: 'Like' },
          { icon: <CommentSvg size={18} />, label: 'Comment' },
          { icon: <ShareSvg size={18} />, label: 'Share' },
        ].map(({ icon, label }) => (
          <button key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#65676B', borderRadius: 6, fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F0F2F5'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Instagram Mockup ─────────────────────────────────────────────────────────

export function InstagramMockup({ post, caption, profile }) {
  const hashtags = parseHashtags(post.hashtags);
  const mediaUrls = parseMediaUrls(post.media_urls);
  const src = mediaUrls[0] || post.media_url;
  const isCarousel = post.content_type === 'carousel' && mediaUrls.length > 1;
  const hasMedia = post.content_type !== 'static' && src;

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.1)', overflow: 'hidden', maxWidth: 470, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <ProfileAvatar picture={profile?.picture} name={profile?.handle || profile?.name} size={38} fontSize={15} igRing platform="instagram" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#262626', lineHeight: 1 }}>{profile?.handle || profile?.name || 'yourbusiness'}</div>
        </div>
        <ThreeDotsHSvg size={20} color="#262626" />
      </div>

      {/* Media */}
      {hasMedia && (
        <div style={{ position: 'relative', width: '100%', paddingTop: isCarousel ? '100%' : '125%', overflow: 'hidden', background: '#f0f0f0' }}>
          <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
          {post.content_type === 'video' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PlaySvg size={22} />
              </div>
            </div>
          )}
          {isCarousel && (
            <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: '4px 9px', fontSize: 12, color: '#fff', fontWeight: 600 }}>1 / {Math.min(mediaUrls.length, 10)}</div>
          )}
        </div>
      )}

      {/* Action row */}
      <div style={{ padding: '10px 14px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <HeartSvg size={24} color="#262626" />
          <CommentSvg size={22} color="#262626" />
          <PaperPlaneSvg size={22} color="#262626" />
        </div>
        <BookmarkSvg size={22} color="#262626" />
      </div>

      {/* Likes count */}
      <div style={{ padding: '2px 14px 6px', fontSize: 13, fontWeight: 700, color: '#262626' }}>128 likes</div>

      {/* Caption */}
      <div style={{ padding: '0 14px 12px', fontSize: 14, color: '#262626', lineHeight: 1.4 }}>
        <span style={{ fontWeight: 700 }}>{profile?.handle || profile?.name || 'yourbusiness'}</span>
        {' '}
        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{caption}</span>
        {hashtags.length > 0 && (
          <div style={{ color: '#00376B', marginTop: 4, fontSize: 13 }}>{hashtags.map(h => `#${h}`).join(' ')}</div>
        )}
        <div style={{ fontSize: 12, color: '#8E8E8E', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Just now</div>
      </div>
    </div>
  );
}

// ── LinkedIn Mockup ──────────────────────────────────────────────────────────

export function LinkedInMockup({ post, caption, profile }) {
  const hasMedia = post.content_type !== 'static';

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.1)', overflow: 'hidden', maxWidth: 500, margin: '0 auto', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <ProfileAvatar picture={profile?.picture} name={profile?.name} size={48} fontSize={18} platform="linkedin" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#000', lineHeight: 1.2 }}>{profile?.name || 'Your Business'}</div>
          <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <span>Just now</span>
            <span>·</span>
            <GlobeSvg size={11} color="#666" />
          </div>
        </div>
        <button style={{ padding: '5px 14px', background: 'none', border: '1.5px solid #0A66C2', color: '#0A66C2', borderRadius: 16, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>+ Follow</button>
      </div>

      {/* Caption */}
      <div style={{ padding: '4px 16px 12px', fontSize: 14, color: '#000', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{caption}</div>

      {/* Media */}
      {hasMedia && <PostImage post={post} style={{ maxHeight: 380 }} />}

      {/* Reaction counts */}
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#0A66C2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff' }}><ThumbUpSvg size={10} color="#fff" /></div>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#F5424B', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff', marginLeft: -5 }}><HeartSvg size={9} color="#fff" filled /></div>
          </div>
          <span style={{ fontSize: 12, color: '#666' }}>48</span>
        </div>
        <span style={{ fontSize: 12, color: '#666' }}>7 comments · 2 reposts</span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#E9E5DF', margin: '0 16px' }} />

      {/* Actions */}
      <div style={{ display: 'flex', padding: '2px 4px' }}>
        {[
          { icon: <ThumbUpSvg size={18} />, label: 'Like' },
          { icon: <CommentSvg size={18} />, label: 'Comment' },
          { icon: <RepostSvg size={18} />, label: 'Repost' },
          { icon: <SendSvg size={18} />, label: 'Send' },
        ].map(({ icon, label }) => (
          <button key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 2px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#666', borderRadius: 6, fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F3F2EF'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {icon}
            <span style={{ display: 'none' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── TikTok Mockup ────────────────────────────────────────────────────────────

export function TikTokMockup({ post, caption, profile }) {
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
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 40%, transparent 70%)' }} />
      {post.content_type === 'video' && src && (
        <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PlaySvg size={22} />
          </div>
        </div>
      )}

      {/* Caption + username */}
      <div style={{ position: 'absolute', bottom: 16, left: 12, right: 52, color: '#fff' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5 }}>@{profile?.handle || profile?.name?.toLowerCase().replace(/\s+/g, '') || 'yourbusiness'}</div>
        <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.9 }}>{truncated}</div>
        <div style={{ fontSize: 11, marginTop: 7, display: 'flex', alignItems: 'center', gap: 5, opacity: 0.75 }}>
          <MusicNoteSvg size={13} />
          <span>Original audio · {profile?.handle || profile?.name?.toLowerCase().replace(/\s+/g, '') || 'yourbusiness'}</span>
        </div>
      </div>

      {/* Side action strip — profile pic + follow + interactions */}
      <div style={{ position: 'absolute', right: 8, bottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, color: '#fff' }}>
        {/* Profile avatar with + follow badge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <ProfileAvatar picture={profile?.picture} name={profile?.handle || profile?.name} size={36} fontSize={14} platform="tiktok" />
          <div style={{ marginTop: -8, width: 16, height: 16, borderRadius: '50%', background: '#FE2C55', border: '1.5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1 }}>+</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <HeartSvg size={26} color="#fff" />
          <span style={{ fontSize: 11, fontWeight: 700 }}>25K</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <CommentSvg size={24} color="#fff" />
          <span style={{ fontSize: 11, fontWeight: 700 }}>560</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <ShareSvg size={24} color="#fff" />
          <span style={{ fontSize: 11, fontWeight: 700 }}>80</span>
        </div>
      </div>
    </div>
  );
}

// ── Google Business Mockup ───────────────────────────────────────────────────

export function GoogleBusinessMockup({ post, caption, profile }) {
  const hasMedia = post.content_type !== 'static';
  const short = caption.length > 130 ? caption.slice(0, 130) + '…' : caption;

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.1)', overflow: 'hidden', maxWidth: 460, margin: '0 auto', fontFamily: '"Google Sans", Roboto, Arial, sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <ProfileAvatar picture={profile?.picture} name={profile?.name} size={40} fontSize={16} platform="google_business" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#202124', lineHeight: 1.2 }}>{profile?.name || 'Your Business'}</div>
          <div style={{ fontSize: 12, color: '#5F6368', marginTop: 2 }}>Google Business Profile · Just now</div>
        </div>
        <ThreeDotsHSvg size={18} color="#5F6368" />
      </div>

      {/* Media */}
      {hasMedia && <PostImage post={post} style={{ maxHeight: 280 }} />}

      {/* Caption */}
      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{ fontSize: 14, color: '#3C4043', lineHeight: 1.6 }}>{short}</div>
        <button style={{ marginTop: 14, padding: '9px 24px', background: '#1A73E8', border: 'none', color: '#fff', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.01em' }}>
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
