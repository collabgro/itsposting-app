import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  IpEdit, IpSave, IpClose, IpBusiness, IpGlobe, IpTeam,
  IpFacebook, IpInstagram, IpGoogle, IpLinkedIn, IpTikTok,
  IpCredits, IpCalendar, IpTrendingUp, IpWarning, IpCheck,
  IpSettings, IpUser, IpDelete,
} from '../components/icons';
import Layout from '../components/Layout';
import { Button, Input, Badge, SectionHeader, Spinner, SkeletonPage, ErrorCard } from '../components/ui';
import { useTheme } from '../lib/theme';
import { customerAPI, socialAPI, postsAPI } from '../lib/api';
import ItsPostingLogo from '../components/ItsPostingLogo';

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

const PLAN_CONFIG = {
  trial:        { label: 'Trial',        color: '#8E8E93', bg: 'rgba(142,142,147,0.12)' },
  starter:      { label: 'Starter',      color: '#30D158', bg: 'rgba(48,209,88,0.12)'   },
  professional: { label: 'Professional', color: '#7C5CFC', bg: 'rgba(124,92,252,0.12)'  },
  premium:      { label: 'Premium',      color: '#FF9F0A', bg: 'rgba(255,159,10,0.12)'  },
};

const TONES = ['professional', 'friendly', 'expert', 'casual'];
const VISUAL_STYLES = ['modern', 'professional', 'bold', 'minimal'];

const PLATFORM_META = {
  facebook:        { label: 'Facebook',         Icon: IpFacebook,  color: '#1877F2' },
  instagram:       { label: 'Instagram',        Icon: IpInstagram, color: '#E1306C' },
  google_business: { label: 'Google Business',  Icon: IpGoogle,    color: '#4285F4' },
  linkedin:        { label: 'LinkedIn',         Icon: IpLinkedIn,  color: '#0A66C2' },
  tiktok:          { label: 'TikTok',           Icon: IpTikTok,    color: '#010101' },
};

function AvatarUploader({ profile, t, onUpload }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const initials = (profile.business_name || '??')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('asset', file);
      const res = await customerAPI.uploadAvatar(fd);
      await customerAPI.updateProfile({ avatarUrl: res.data.url });
      onUpload(res.data.url);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          width: 96, height: 96, borderRadius: '50%',
          background: profile.avatar_url
            ? 'transparent'
            : 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 50%, #EC4899 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 700, color: '#fff',
          cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
          border: `3px solid ${t.borderStrong}`,
          boxShadow: '0 4px 20px rgba(124,92,252,0.35)',
          transition: 'opacity 0.2s',
        }}
        title="Click to upload photo"
      >
        {uploading ? (
          <Spinner size={28} color="#fff" />
        ) : profile.avatar_url ? (
          <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials
        )}
      </div>
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 26, height: 26, borderRadius: '50%',
          background: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', border: `2px solid ${t.bg}`,
          boxShadow: '0 2px 8px rgba(124,92,252,0.5)',
        }}
      >
        <IpEdit size={12} color="#fff" />
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

function EditableSection({ title, children, onSave, saving, initialEditing = false }) {
  const { t } = useTheme();
  const [editing, setEditing] = useState(initialEditing);

  async function handleSave() {
    await onSave();
    setEditing(false);
  }

  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
      overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 24px', borderBottom: editing ? `1px solid ${t.border}` : 'none',
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{title}</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
              Save changes
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <IpEdit size={14} style={{ marginRight: 4 }} /> Edit
          </Button>
        )}
      </div>
      <div style={{ padding: '20px 24px' }}>
        {children(editing)}
      </div>
    </div>
  );
}

function InfoRow({ label, value, editing, field, fields, setFields, type = 'text', placeholder }) {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: editing ? 'flex-start' : 'center' }}>
      <span style={{ minWidth: 140, fontSize: 13, color: t.textMuted, paddingTop: editing ? 10 : 0 }}>{label}</span>
      {editing ? (
        <Input
          value={fields[field] || ''}
          onChange={e => setFields(f => ({ ...f, [field]: e.target.value }))}
          placeholder={placeholder || label}
          type={type}
          style={{ flex: 1, fontSize: 14 }}
        />
      ) : (
        <span style={{ fontSize: 14, color: value ? t.text : t.textDisabled }}>
          {value || '—'}
        </span>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useTheme();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [postStats, setPostStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // Edit fields
  const [bizFields,     setBizFields]     = useState({ business_name: '', tagline: '', location: '', phone: '', website: '' });
  const [voiceFields,   setVoiceFields]   = useState({ tone: 'professional', visual_style: 'modern', timezone: 'UTC' });
  const [ownerFields,   setOwnerFields]   = useState({ owner_name: '', owner_phone: '', owner_email: '', marketing_opt_in: true });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    Promise.allSettled([
      customerAPI.getProfile(),
      socialAPI.getAccounts(),
      postsAPI.getAnalytics(),
    ]).then(([pRes, sRes, aRes]) => {
      if (pRes.status !== 'fulfilled') return;
      const p = pRes.value.data;
      setProfile(p);
      setBizFields({
        business_name: p.business_name || '',
        tagline: p.tagline || '',
        location: p.location || '',
        phone: p.phone || '',
        website: p.website || '',
      });
      setOwnerFields({
        owner_name:     p.owner_name     || '',
        owner_phone:    p.owner_phone    || '',
        owner_email:    p.owner_email    || '',
        marketing_opt_in: p.marketing_opt_in !== false,
      });
      setVoiceFields({
        tone: p.tone || 'professional',
        visual_style: p.visual_style || 'modern',
        timezone: p.timezone || 'UTC',
      });
      if (sRes.status === 'fulfilled') {
        setSocialAccounts(Array.isArray(sRes.value.data) ? sRes.value.data : []);
      }
      if (aRes.status === 'fulfilled') setPostStats(aRes.value.data);
    }).finally(() => setLoading(false));
  }, []);

  async function saveBizInfo() {
    setSaving('biz');
    try {
      await customerAPI.updateProfile({
        businessName: bizFields.business_name,
        tagline: bizFields.tagline,
        location: bizFields.location,
        phone: bizFields.phone,
        website: bizFields.website,
      });
      setProfile(p => ({ ...p, ...bizFields }));
    } finally {
      setSaving('');
    }
  }

  async function saveOwnerInfo() {
    setSaving('owner');
    try {
      await customerAPI.updateProfile({
        ownerName:      ownerFields.owner_name,
        ownerPhone:     ownerFields.owner_phone,
        ownerEmail:     ownerFields.owner_email,
        marketingOptIn: ownerFields.marketing_opt_in,
      });
      setProfile(p => ({ ...p, ...ownerFields }));
    } finally {
      setSaving('');
    }
  }

  async function saveVoice() {
    setSaving('voice');
    try {
      await customerAPI.updateProfile({
        tone: voiceFields.tone,
        visualStyle: voiceFields.visual_style,
        timezone: voiceFields.timezone,
      });
      setProfile(p => ({ ...p, tone: voiceFields.tone, visual_style: voiceFields.visual_style, timezone: voiceFields.timezone }));
    } finally {
      setSaving('');
    }
  }

  if (loading) return (
    <Layout title="My Profile">
      <SkeletonPage rows={5} cards={4} />
    </Layout>
  );

  if (!profile) return (
    <Layout title="My Profile">
      <ErrorCard title="Could not load profile" message="Check your connection and try again." onRetry={() => { setLoading(true); window.location.reload(); }} />
    </Layout>
  );

  const plan = PLAN_CONFIG[profile.plan] || PLAN_CONFIG.trial;
  const industryLabel = INDUSTRY_LABELS[profile.industry] || profile.industry;
  const connectedPlatforms = socialAccounts; // all rows in social_accounts are connected
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const stats = [
    {
      label: 'Posts This Month',
      value: profile.total_posts_this_month ?? 0,
      icon: IpTrendingUp,
      color: t.primary,
    },
    {
      label: 'Posting Streak',
      value: profile.posting_streak ? `${profile.posting_streak}d` : '—',
      icon: IpCalendar,
      color: '#30D158',
    },
    {
      label: 'Credits Left',
      value: profile.credits_balance ?? 0,
      icon: IpCredits,
      color: '#FF9F0A',
    },
    {
      label: 'Platforms Connected',
      value: `${connectedPlatforms.length} / ${Object.keys(PLATFORM_META).length}`,
      icon: IpGlobe,
      color: '#0A84FF',
    },
  ];

  return (
    <Layout>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 0 60px' }}>

        {/* ── Hero banner ── */}
        <div style={{
          borderRadius: 20, overflow: 'hidden', marginBottom: 24,
          background: t.isDark
            ? 'linear-gradient(135deg, #0F0820 0%, #130D2A 50%, #0A0F22 100%)'
            : 'linear-gradient(135deg, #EDE8FF 0%, #F5F0FF 50%, #E8EDFF 100%)',
          border: `1px solid ${t.border}`,
          position: 'relative',
        }}>
          {/* Ambient glow */}
          <div style={{
            position: 'absolute', top: -40, left: -40, width: 200, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,92,252,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -40, right: 60, width: 160, height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ padding: isMobile ? '24px 20px 20px' : '32px 32px 28px', position: 'relative', display: 'flex', gap: isMobile ? 16 : 24, alignItems: isMobile ? 'flex-start' : 'flex-end', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <AvatarUploader
              profile={profile}
              t={t}
              onUpload={url => setProfile(p => ({ ...p, avatar_url: url }))}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: t.text, lineHeight: 1.2 }}>
                  {profile.business_name}
                </h1>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                  padding: '3px 10px', borderRadius: 20,
                  color: plan.color, background: plan.bg,
                }}>
                  {plan.label}
                </span>
              </div>
              {profile.tagline && (
                <p style={{ margin: '0 0 6px', fontSize: 14, color: t.textSecondary, fontStyle: 'italic' }}>
                  "{profile.tagline}"
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                {industryLabel && (
                  <span style={{ fontSize: 13, color: t.primary, fontWeight: 600 }}>{industryLabel}</span>
                )}
                {profile.location && (
                  <span style={{ fontSize: 13, color: t.textMuted }}>📍 {profile.location}</span>
                )}
                {memberSince && (
                  <span style={{ fontSize: 13, color: t.textMuted }}>Member since {memberSince}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24,
        }}>
          {stats.map(s => (
            <div key={s.label} style={{
              background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
              padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: s.color + '18',
                }}>
                  <s.icon size={16} color={s.color} />
                </div>
                <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: t.text, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Business Info ── */}
        <EditableSection title="Business Info" onSave={saveBizInfo} saving={saving === 'biz'}>
          {(editing) => (
            <>
              <InfoRow label="Business Name" value={profile.business_name} editing={editing} field="business_name" fields={bizFields} setFields={setBizFields} placeholder="Your business name" />
              <InfoRow label="Tagline" value={profile.tagline} editing={editing} field="tagline" fields={bizFields} setFields={setBizFields} placeholder="One-line description of your business" />
              <InfoRow label="Location" value={profile.location} editing={editing} field="location" fields={bizFields} setFields={setBizFields} placeholder="City, State" />
              <InfoRow label="Phone" value={profile.phone} editing={editing} field="phone" fields={bizFields} setFields={setBizFields} type="tel" placeholder="+1 (555) 000-0000" />
              <InfoRow label="Website" value={profile.website} editing={editing} field="website" fields={bizFields} setFields={setBizFields} type="url" placeholder="https://yourbusiness.com" />
              {!editing && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: -4, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
                  <span style={{ minWidth: 140, fontSize: 13, color: t.textMuted }}>Industry</span>
                  <span style={{ fontSize: 14, color: t.text }}>{industryLabel}</span>
                  <Link href="/settings">
                    <span style={{ fontSize: 12, color: t.primary, cursor: 'pointer', marginLeft: 6 }}>Change in Settings →</span>
                  </Link>
                </div>
              )}
            </>
          )}
        </EditableSection>

        {/* ── Personal / Owner Information ── */}
        <EditableSection title="Account Owner" onSave={saveOwnerInfo} saving={saving === 'owner'}>
          {(editing) => (
            <>
              <InfoRow label="Your Name"      value={profile.owner_name}     editing={editing} field="owner_name"  fields={ownerFields} setFields={setOwnerFields} placeholder="e.g. Mike Johnson" />
              <InfoRow label="Personal Phone" value={profile.owner_phone}    editing={editing} field="owner_phone" fields={ownerFields} setFields={setOwnerFields} type="tel" placeholder="e.g. (555) 123-4567" />
              <InfoRow label="Personal Email" value={profile.owner_email}    editing={editing} field="owner_email" fields={ownerFields} setFields={setOwnerFields} type="email" placeholder="e.g. mike@yourbusiness.com" />
              {editing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    id="mkt-opt"
                    checked={ownerFields.marketing_opt_in}
                    onChange={e => setOwnerFields(f => ({ ...f, marketing_opt_in: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: t.primary }}
                  />
                  <label htmlFor="mkt-opt" style={{ fontSize: 13, color: t.textMuted, cursor: 'pointer' }}>
                    I agree to receive product updates and tips from ItsPosting
                  </label>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: t.textMuted, minWidth: 140 }}>Marketing emails</span>
                  <span style={{ fontSize: 13, color: profile.marketing_opt_in !== false ? t.success : t.textMuted }}>
                    {profile.marketing_opt_in !== false ? 'Subscribed' : 'Unsubscribed'}
                  </span>
                </div>
              )}
              {!editing && (
                <p style={{ fontSize: 12, color: t.textMuted, marginTop: 12, borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
                  This information is private and used only to personalise your experience and send product updates.
                </p>
              )}
            </>
          )}
        </EditableSection>

        {/* ── Brand Voice ── */}
        <EditableSection title="Brand Voice & Style" onSave={saveVoice} saving={saving === 'voice'}>
          {(editing) => (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 10 }}>Content Tone</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TONES.map(tone => (
                    <button
                      key={tone}
                      onClick={() => editing && setVoiceFields(f => ({ ...f, tone }))}
                      style={{
                        padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                        cursor: editing ? 'pointer' : 'default',
                        background: voiceFields.tone === tone ? t.primary + '20' : t.input,
                        color: voiceFields.tone === tone ? t.primary : t.textSecondary,
                        border: `1.5px solid ${voiceFields.tone === tone ? t.primary : t.border}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 10 }}>Visual Style</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {VISUAL_STYLES.map(vs => (
                    <button
                      key={vs}
                      onClick={() => editing && setVoiceFields(f => ({ ...f, visual_style: vs }))}
                      style={{
                        padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                        cursor: editing ? 'pointer' : 'default',
                        background: voiceFields.visual_style === vs ? t.primary + '20' : t.input,
                        color: voiceFields.visual_style === vs ? t.primary : t.textSecondary,
                        border: `1.5px solid ${voiceFields.visual_style === vs ? t.primary : t.border}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      {vs.charAt(0).toUpperCase() + vs.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 8 }}>Timezone</div>
                {editing ? (
                  <select
                    value={voiceFields.timezone}
                    onChange={e => setVoiceFields(f => ({ ...f, timezone: e.target.value }))}
                    style={{
                      background: t.input, color: t.text, border: `1px solid ${t.border}`,
                      borderRadius: 10, padding: '9px 14px', fontSize: 14, width: '100%',
                      outline: 'none',
                    }}
                  >
                    {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
                      'America/Phoenix','Pacific/Honolulu','Asia/Karachi','Asia/Kolkata','Asia/Dubai',
                      'Europe/London','Europe/Paris','Asia/Tokyo','Asia/Singapore','Australia/Sydney','UTC',
                    ].map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: 14, color: t.text }}>{voiceFields.timezone}</span>
                )}
              </div>
            </>
          )}
        </EditableSection>

        {/* ── Connected Platforms ── */}
        <div style={{
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
          overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 24px', borderBottom: `1px solid ${t.border}`,
          }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: t.text }}>Connected Platforms</span>
            <Link href="/settings#social">
              <span style={{ fontSize: 13, color: t.primary, cursor: 'pointer', fontWeight: 600 }}>
                Manage connections →
              </span>
            </Link>
          </div>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(PLATFORM_META).map(([key, meta]) => {
              const acct = socialAccounts.find(a => a.platform === key);
              const connected = !!acct;
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', borderRadius: 12,
                  background: connected ? meta.color + '0A' : t.input,
                  border: `1px solid ${connected ? meta.color + '28' : t.border}`,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: connected ? meta.color + '18' : t.border + '40',
                  }}>
                    <meta.Icon size={18} color={connected ? meta.color : t.textDisabled} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: connected ? t.text : t.textMuted }}>
                      {meta.label}
                    </div>
                    {connected && (acct.account_name || acct.account_username) && (
                      <div style={{ fontSize: 12, color: t.textMuted }}>
                        {acct.account_name || acct.account_username}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    padding: '3px 10px', borderRadius: 20,
                    color: connected ? '#30D158' : t.textDisabled,
                    background: connected ? 'rgba(48,209,88,0.12)' : t.border + '60',
                  }}>
                    {connected ? '● Connected' : 'Not connected'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Account Info ── */}
        <div style={{
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
          overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${t.border}` }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: t.text }}>Account</span>
          </div>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ minWidth: 140, fontSize: 13, color: t.textMuted }}>Email</span>
              <span style={{ fontSize: 14, color: t.text }}>{profile.email}</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ minWidth: 140, fontSize: 13, color: t.textMuted }}>Plan</span>
              <span style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                padding: '3px 10px', borderRadius: 20,
                color: plan.color, background: plan.bg,
              }}>
                {plan.label}
              </span>
            </div>
            {memberSince && (
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ minWidth: 140, fontSize: 13, color: t.textMuted }}>Member since</span>
                <span style={{ fontSize: 14, color: t.text }}>{memberSince}</span>
              </div>
            )}
            <div style={{ paddingTop: 8, borderTop: `1px solid ${t.border}`, display: 'flex', gap: 10 }}>
              <Link href="/billing">
                <Button variant="outline" size="sm">Manage Plan &amp; Billing</Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm">
                  <IpSettings size={14} style={{ marginRight: 4 }} /> Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <div style={{
          background: t.card, border: `1px solid ${t.errorBorder}`, borderRadius: 16,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 24px', borderBottom: `1px solid ${t.errorBorder}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <IpWarning size={18} color={t.error} />
            <span style={{ fontWeight: 700, fontSize: 15, color: t.error }}>Danger Zone</span>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>Delete Account</div>
                <div style={{ fontSize: 13, color: t.textMuted }}>
                  Permanently delete your account and all data. This cannot be undone.
                </div>
              </div>
              <a
                href="mailto:support@itsposting.com?subject=Account%20Deletion%20Request"
                style={{
                  flexShrink: 0, fontSize: 13, fontWeight: 600, color: t.error,
                  padding: '8px 16px', borderRadius: 10,
                  border: `1.5px solid ${t.errorBorder}`,
                  background: t.errorBg, textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                Contact Support →
              </a>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
