import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpSave, IpCredits, IpPalette, IpGlobe, IpDelete,
  IpBusiness, IpShare, IpCheck, IpFacebook, IpInstagram,
  IpGoogle, IpSparkle // Added these two
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Input, Badge, SectionHeader } from '../components/ui';
import { useTheme } from '../lib/theme';
import { customerAPI, contentAPI, socialAPI, scraperAPI } from '../lib/api';

const VISUAL_STYLES = [
  { id: 'modern', name: 'Modern', description: 'Clean, contemporary' },
  { id: 'professional', name: 'Professional', description: 'Polished, business' },
  { id: 'bold', name: 'Bold', description: 'Strong, vibrant' },
  { id: 'minimal', name: 'Minimal', description: 'Simple, elegant' },
];

const TONES = [
  { id: 'professional', name: 'Professional' },
  { id: 'friendly', name: 'Friendly' },
  { id: 'expert', name: 'Expert' },
  { id: 'casual', name: 'Casual' },
];

const PLATFORM_CONFIG = {
  facebook: {
    label: 'Facebook',
    Icon: IpFacebook,
    color: '#1877F2',
    description: 'Post to your page',
    tokenHelp: {
      title: 'How to get your Facebook Page Token:',
      steps: [
        { text: 'Go to ', link: { url: 'https://developers.facebook.com/tools/explorer', label: 'Facebook Graph API Explorer' } },
        { text: 'Select your Facebook App from the dropdown' },
        { text: 'Click "Generate Access Token" and select your Page' },
        { text: 'Grant all requested permissions' },
        { text: 'Copy the Page Access Token and paste below' },
      ],
      pageIdLabel: 'Page ID',
      pageIdHelp: 'Found in your Facebook Page settings → About → Page ID',
    },
  },
  instagram: {
    label: 'Instagram',
    Icon: IpInstagram,
    color: '#E1306C',
    description: 'Share to your profile',
    tokenHelp: {
      title: 'How to get your Instagram Token:',
      steps: [
        { text: 'Go to ', link: { url: 'https://developers.facebook.com/tools/explorer', label: 'Facebook Graph API Explorer' } },
        { text: 'Select your App → click "Generate Access Token"' },
        { text: 'Enable instagram_basic and instagram_content_publish permissions' },
        { text: 'Copy the Access Token and paste below' },
      ],
      pageIdLabel: 'Instagram Business Account ID',
      pageIdHelp: 'Found in Instagram Settings → Account → Professional Account',
    },
  },
  google_business: {
    label: 'Business Profile',
    Icon: IpGoogle,
    color: '#4285F4',
    description: 'Post to your business listing',
    tokenHelp: {
      title: 'How to get your Google Business Token:',
      steps: [
        { text: 'Go to ', link: { url: 'https://developers.google.com/oauthplayground', label: 'Google OAuth Playground' } },
        { text: 'Find "Google My Business API v4" in the list' },
        { text: 'Select: https://www.googleapis.com/auth/business.manage' },
        { text: 'Click "Authorize APIs" and sign in with your Google account' },
        { text: 'Click "Exchange authorization code for tokens"' },
        { text: 'Copy the Access Token and paste below' },
      ],
      pageIdLabel: 'Business Account ID',
      pageIdHelp: 'Found in your Google Business Profile dashboard URL',
    },
  },
};

export default function Settings() {
  const router = useRouter();
  const { t } = useTheme();
  const [profile, setProfile] = useState(null);
  const [providers, setProviders] = useState(null);
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [socialStatus, setSocialStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);
  const [scraperUrl, setScraperUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  // Manual token modal state
  const [setupModal, setSetupModal] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [manualPageId, setManualPageId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadData();
  }, []);

  useEffect(() => {
    const { connected, error } = router.query;
    if (connected) {
      const names = { facebook: 'Facebook & Instagram', google: 'Business Profile' };
      showToast(`${names[connected] || connected} connected successfully!`);
      router.replace('/settings', undefined, { shallow: true });
      loadSocialAccounts();
    }
    if (error) {
      const msgs = {
        facebook_denied: 'Connection was cancelled',
        google_denied: 'Connection was cancelled',
        facebook_failed: 'Failed to connect Facebook. Please try again.',
        google_failed: 'Failed to connect Google. Please try again.',
      };
      showToast(msgs[error] || `Connection error: ${error}`, 'error');
      router.replace('/settings', undefined, { shallow: true });
    }
  }, [router.query]);

  const loadData = async () => {
    try {
      const [profileRes, providersRes, scrapedRes] = await Promise.all([
        customerAPI.getProfile(),
        contentAPI.getProviders().catch(() => ({ data: {} })),
        scraperAPI.getData().catch(() => ({ data: { hasData: false } })),
      ]);
      setProfile(profileRes.data);
      setProviders(providersRes.data);
      if (scrapedRes.data.hasData) {
        setScrapedData(scrapedRes.data);
        setScraperUrl(scrapedRes.data.website || '');
      }
    } catch {
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
    loadSocialAccounts();
  };

  const loadSocialAccounts = async () => {
    try {
      const [accountsRes, statusRes] = await Promise.all([
        socialAPI.getAccounts(),
        socialAPI.getStatus(),
      ]);
      setSocialAccounts(accountsRes.data);
      setSocialStatus(statusRes.data);
    } catch {}
  };

  const handleScrape = async () => {
    if (!scraperUrl.trim()) { showToast('Please enter a website URL', 'error'); return; }
    let url = scraperUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    setScraping(true);
    try {
      const res = await scraperAPI.scrape(url);
      setScrapedData({
        hasData: true,
        website: url,
        services: res.data.data.services,
        about: res.data.data.about,
        scrapedAt: new Date().toISOString(),
      });
      showToast(res.data.cached ? 'Loaded saved website data' : `Found ${res.data.data.services.length} services from the site`);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to scrape website', 'error');
    } finally {
      setScraping(false);
    }
  };

  const handleClearScrape = async () => {
    if (!confirm('Clear scraped data?')) return;
    try {
      await scraperAPI.clearData();
      setScrapedData(null);
      setScraperUrl('');
      showToast('Saved website data cleared');
    } catch {
      showToast('Failed to clear data', 'error');
    }
  };

  const handleConnect = (platform) => {
    setManualToken('');
    setManualPageId('');
    setManualName('');
    setSetupModal(platform);
  };

  const handleManualSave = async () => {
    if (!manualToken.trim()) { showToast('Access token is required', 'error'); return; }
    if (manualToken.trim().length < 10) { showToast('Token seems too short — please check it', 'error'); return; }
    setManualSaving(true);
    try {
      const res = await fetch('/api/social/connect/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          platform: setupModal,
          accessToken: manualToken.trim(),
          pageId: manualPageId.trim(),
          accountName: manualName.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save token');
      }
      showToast(`${PLATFORM_CONFIG[setupModal]?.label} connected successfully!`);
      setSetupModal(null);
      loadSocialAccounts();
    } catch (err) {
      showToast(err.message || 'Failed to save token', 'error');
    } finally {
      setManualSaving(false);
    }
  };

  const handleDisconnect = async (platform) => {
    if (!confirm(`Disconnect ${PLATFORM_CONFIG[platform]?.label || platform}?`)) return;
    setDisconnecting(platform);
    try {
      await socialAPI.disconnect(platform);
      showToast('Account disconnected');
      loadSocialAccounts();
    } catch {
      showToast('Failed to disconnect', 'error');
    } finally {
      setDisconnecting(null);
    }
  };

  const handleToggleAutoPost = async (account) => {
    try {
      await socialAPI.updateAccount(account.id, { autoPost: !account.auto_post });
      setSocialAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, auto_post: !a.auto_post } : a))
      );
      showToast('Updated');
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await customerAPI.updateProfile({
        businessName: profile.business_name,
        industry: profile.industry,
        location: profile.location,
        phone: profile.phone,
        website: profile.website,
        brandColors: profile.brand_colors,
        visualStyle: profile.visual_style,
        tone: profile.tone,
        preferredImageProvider: profile.preferred_image_provider,
      });
      showToast('Settings saved!');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <Layout title="Settings">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{
            width: 36, height: 36,
            border: `3px solid ${t.primaryBg}`,
            borderTopColor: t.primary,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      </Layout>
    );
  }

  const urlChanged = scrapedData && scraperUrl.trim() &&
    (scraperUrl.startsWith('http') ? scraperUrl.trim() : 'https://' + scraperUrl.trim()) !== scrapedData.website;

  const platformConfig = setupModal ? PLATFORM_CONFIG[setupModal] : null;

  return (
    <Layout
      title="Settings"
      subtitle="Manage your profile and preferences"
      action={
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          <IpSave size={14} /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      }
    >
      {/* Toast */}
      {toast.show && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: toast.type === 'success' ? t.success : t.error,
          boxShadow: t.shadow,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Business Info */}
        <Card>
          <SectionHeader icon={IpBusiness} title="Business Information" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {[
              { label: 'Business Name', key: 'business_name', type: 'text' },
              { label: 'Industry', key: 'industry', type: 'text' },
              { label: 'Location', key: 'location', type: 'text' },
              { label: 'Phone', key: 'phone', type: 'tel' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>{label}</label>
                <Input type={type} value={profile[key] || ''} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>Website</label>
              <Input type="url" placeholder="https://" value={profile.website || ''} onChange={(e) => setProfile({ ...profile, website: e.target.value })} />
            </div>
          </div>
        </Card>

        {/* Website Intelligence */}
        <Card>
          <SectionHeader icon={IpGlobe} title="Website Intelligence" action={<Badge variant="success">FREE</Badge>} />
          <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, marginTop: -12 }}>
            Scrape your website to extract services and improve content accuracy.
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: urlChanged ? 8 : 16, flexWrap: 'wrap' }}>
            <Input
              type="url"
              placeholder="https://yourbusiness.com"
              value={scraperUrl}
              onChange={(e) => setScraperUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              disabled={scraping}
              style={{ flex: '1 1 280px' }}
            />
            <Button onClick={handleScrape} disabled={scraping || !scraperUrl.trim()} variant="secondary">
              {scraping ? 'Working...' : urlChanged ? 'Update site' : scrapedData ? 'Refresh data' : 'Scan site'}
            </Button>
          </div>
          {urlChanged && (
            <div style={{ padding: '8px 12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 8, fontSize: 12, color: '#EAB308', marginBottom: 12 }}>
              New site detected — scan it to update your saved information.
            </div>
          )}
          {scrapedData && (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.success, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IpCheck size={14} strokeWidth={2.5} /> {scrapedData.services?.length || 0} services extracted
                </span>
                <button onClick={handleClearScrape} style={{ fontSize: 12, color: t.error, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0 }}>
                  <IpDelete size={14} /> Clear
                </button>
              </div>
              {scrapedData.services?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {scrapedData.services.slice(0, 12).map((s, i) => (
                    <span key={i} style={{ padding: '3px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, fontSize: 12, color: t.textSecondary }}>{s}</span>
                  ))}
                </div>
              )}
              {scrapedData.about && (
                <p style={{ fontSize: 12, color: t.textMuted }}>{scrapedData.about.slice(0, 200)}...</p>
              )}
            </div>
          )}
        </Card>

        {/* Image Source */}
        <Card>
          <SectionHeader icon={IpSparkle} title="Image Source" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { id: 'nanobanana', name: 'Image One', desc: 'Fast, affordable image generation', speed: providers?.nanobanana?.speed || '3-8 seconds', cost: '~$0.039/image', note: 'Recommended — cheaper & faster', noteColor: t.success },
              { id: 'midjourney', name: 'Image Two', desc: 'Premium artistic output', speed: providers?.midjourney?.speed || '15-20 seconds', cost: '~$0.08/image', note: providers?.midjourney?.available ? 'Premium artistic quality' : 'Requires setup', noteColor: providers?.midjourney?.available ? t.primary : t.warning },
            ].map((p) => {
              const selected = profile.preferred_image_provider === p.id;
              return (
                <button key={p.id} onClick={() => setProfile({ ...profile, preferred_image_provider: p.id })}
                  style={{ padding: 16, border: `2px solid ${selected ? t.primary : t.border}`, background: selected ? t.primaryBg : t.input, borderRadius: 10, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{p.name}</span>
                    <Badge variant={providers?.[p.id]?.available ? 'success' : 'warning'}>
                      {providers?.[p.id]?.available ? 'Active' : 'Not configured'}
                    </Badge>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{p.desc}</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8 }}>{p.speed}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{p.cost}</div>
                  <div style={{ fontSize: 12, color: p.noteColor, marginTop: 4, fontWeight: 500 }}>{p.note}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Branding */}
        <Card>
          <SectionHeader icon={IpPalette} title="Branding" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {['primary', 'secondary', 'accent'].map((key) => {
                const defaultColors = { primary: '#7C5CFC', secondary: '#22C55E', accent: '#F97316' };
                const val = profile.brand_colors?.[key] || defaultColors[key];
                return (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'capitalize' }}>{key}</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={val}
                        onChange={(e) => setProfile({ ...profile, brand_colors: { ...profile.brand_colors, [key]: e.target.value } })}
                        style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2, background: t.input }} />
                      <Input type="text" value={val}
                        onChange={(e) => setProfile({ ...profile, brand_colors: { ...profile.brand_colors, [key]: e.target.value } })}
                        style={{ fontFamily: 'monospace', fontSize: 12 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 10 }}>Visual Style</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {VISUAL_STYLES.map((style) => (
                  <button key={style.id} onClick={() => setProfile({ ...profile, visual_style: style.id })}
                    style={{ padding: '10px 12px', border: `2px solid ${profile.visual_style === style.id ? t.primary : t.border}`, background: profile.visual_style === style.id ? t.primaryBg : t.input, borderRadius: 8, textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{style.name}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{style.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 10 }}>Tone</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {TONES.map((tone) => (
                  <button key={tone.id} onClick={() => setProfile({ ...profile, tone: tone.id })}
                    style={{ padding: '10px 12px', border: `2px solid ${profile.tone === tone.id ? t.primary : t.border}`, background: profile.tone === tone.id ? t.primaryBg : t.input, borderRadius: 8, textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{tone.name}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Connected Accounts */}
        <Card>
          <SectionHeader icon={IpShare} title="Connected Accounts" subtitle="Connect social media accounts to enable publishing" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
              const connected = socialAccounts.find((a) => a.platform === platform);
              return (
                <div key={platform} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '14px 16px', background: t.input, borderRadius: 10,
                  border: `1px solid ${connected ? config.color + '40' : t.border}`, flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${config.color}15`, border: `1px solid ${config.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <config.Icon size={20} style={{ color: config.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{config.label}</div>
                      <div style={{ fontSize: 12, color: connected ? t.success : t.textMuted }}>
                        {connected ? `✓ ${connected.account_name || 'Connected'}` : config.description}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {connected && (
                      <button type="button" onClick={() => handleToggleAutoPost(connected)}
                        style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: connected.auto_post ? 'rgba(34,197,94,0.1)' : t.card, border: `1px solid ${connected.auto_post ? 'rgba(34,197,94,0.3)' : t.border}`, color: connected.auto_post ? t.success : t.textMuted, cursor: 'pointer' }}>
                        {connected.auto_post ? 'Auto On' : 'Auto Off'}
                      </button>
                    )}
                    {connected
                      ? <Button variant="ghost" size="sm" onClick={() => handleDisconnect(platform)} disabled={disconnecting === platform} style={{ color: t.error, fontSize: 12 }}>
                          {disconnecting === platform ? 'Disconnecting...' : 'Disconnect'}
                        </Button>
                      : <Button variant="secondary" size="sm" onClick={() => handleConnect(platform)}>Connect</Button>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

      </div>

      {/* Manual Token Modal */}
      {setupModal && platformConfig && (
        <div onClick={() => setSetupModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28, maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${platformConfig.color}15`, border: `1px solid ${platformConfig.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <platformConfig.Icon size={18} style={{ color: platformConfig.color }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Connect {platformConfig.label}</h3>
            </div>
            <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Follow the steps below to get your access token.</p>

            {/* Step by step */}
            <div style={{ marginBottom: 20, padding: 16, background: t.input, borderRadius: 12, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>{platformConfig.tokenHelp.title}</div>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                {platformConfig.tokenHelp.steps.map((step, i) => (
                  <li key={i} style={{ fontSize: 12, color: t.textMuted, lineHeight: 2.2 }}>
                    {step.text}
                    {step.link && (
                      <a href={step.link.url} target="_blank" rel="noreferrer" style={{ color: t.primary, fontWeight: 600 }}>
                        {step.link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>
                  Access Token <span style={{ color: t.error }}>*</span>
                </label>
                <textarea
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Paste your access token here..."
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${manualToken && manualToken.length < 10 ? t.error : t.border}`, borderRadius: 8, color: t.text, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
                />
                {manualToken && manualToken.length < 10 && (
                  <div style={{ fontSize: 11, color: t.error, marginTop: 4 }}>Token seems too short — please check it</div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 4 }}>
                  {platformConfig.tokenHelp.pageIdLabel} <span style={{ color: t.textMuted, fontWeight: 400 }}>(optional)</span>
                </label>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>{platformConfig.tokenHelp.pageIdHelp}</div>
                <input type="text" value={manualPageId} onChange={(e) => setManualPageId(e.target.value)} placeholder="e.g. 123456789"
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 4 }}>
                  Account Name <span style={{ color: t.textMuted, fontWeight: 400 }}>(optional)</span>
                </label>
                <input type="text" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g. My Business Page"
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setSetupModal(null)}
                style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleManualSave}
                disabled={manualSaving || !manualToken.trim() || manualToken.trim().length < 10}
                style={{ padding: '9px 20px', background: platformConfig.color, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: manualSaving || !manualToken.trim() || manualToken.trim().length < 10 ? 0.5 : 1 }}>
                {manualSaving ? 'Connecting...' : `Connect ${platformConfig.label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }