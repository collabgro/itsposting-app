import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpSave, IpCredits, IpPalette, IpGlobe, IpDelete, IpClose, IpWarning,
  IpBusiness, IpShare, IpCheck, IpFacebook, IpInstagram,
  IpGoogle, IpSparkle, IpSchedule, IpSend, IpLinkedIn, IpTikTok,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Input, Badge, SectionHeader, Spinner, ConfirmModal } from '../components/ui';
import { useTheme } from '../lib/theme';
import { customerAPI, contentAPI, socialAPI, scraperAPI, receptionistAPI } from '../lib/api';

const TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern Time (ET)',    offset: 'UTC-5/4'   },
  { value: 'America/Chicago',     label: 'Central Time (CT)',    offset: 'UTC-6/5'   },
  { value: 'America/Denver',      label: 'Mountain Time (MT)',   offset: 'UTC-7/6'   },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)',    offset: 'UTC-8/7'   },
  { value: 'America/Phoenix',     label: 'Arizona (no DST)',     offset: 'UTC-7'     },
  { value: 'America/Anchorage',   label: 'Alaska Time (AKT)',    offset: 'UTC-9/8'   },
  { value: 'Pacific/Honolulu',    label: 'Hawaii Time (HT)',     offset: 'UTC-10'    },
  { value: 'Asia/Karachi',        label: 'Pakistan Standard',    offset: 'UTC+5'     },
  { value: 'Europe/London',       label: 'London (GMT/BST)',     offset: 'UTC+0/1'   },
  { value: 'Europe/Paris',        label: 'Central European',     offset: 'UTC+1/2'   },
  { value: 'Europe/Berlin',       label: 'Berlin / Frankfurt',   offset: 'UTC+1/2'   },
  { value: 'Europe/Madrid',       label: 'Madrid / Barcelona',   offset: 'UTC+1/2'   },
  { value: 'Europe/Rome',         label: 'Rome / Milan',         offset: 'UTC+1/2'   },
  { value: 'Europe/Amsterdam',    label: 'Amsterdam',            offset: 'UTC+1/2'   },
  { value: 'Europe/Brussels',     label: 'Brussels',             offset: 'UTC+1/2'   },
  { value: 'Europe/Vienna',       label: 'Vienna',               offset: 'UTC+1/2'   },
  { value: 'Europe/Warsaw',       label: 'Warsaw',               offset: 'UTC+1/2'   },
  { value: 'Europe/Stockholm',    label: 'Stockholm',            offset: 'UTC+1/2'   },
  { value: 'Europe/Oslo',         label: 'Oslo',                 offset: 'UTC+1/2'   },
  { value: 'Europe/Copenhagen',   label: 'Copenhagen',           offset: 'UTC+1/2'   },
  { value: 'Europe/Zurich',       label: 'Zurich',               offset: 'UTC+1/2'   },
  { value: 'Europe/Lisbon',       label: 'Lisbon',               offset: 'UTC+0/1'   },
  { value: 'Europe/Dublin',       label: 'Dublin',               offset: 'UTC+0/1'   },
  { value: 'Europe/Helsinki',     label: 'Helsinki',             offset: 'UTC+2/3'   },
  { value: 'Europe/Athens',       label: 'Athens',               offset: 'UTC+2/3'   },
  { value: 'Europe/Bucharest',    label: 'Bucharest',            offset: 'UTC+2/3'   },
  { value: 'Europe/Istanbul',     label: 'Istanbul',             offset: 'UTC+3'     },
  { value: 'Europe/Moscow',       label: 'Moscow',               offset: 'UTC+3'     },
  { value: 'Asia/Dubai',          label: 'Gulf Standard (GST)',  offset: 'UTC+4'     },
  { value: 'Asia/Baku',           label: 'Azerbaijan',           offset: 'UTC+4'     },
  { value: 'Asia/Tbilisi',        label: 'Georgia',              offset: 'UTC+4'     },
  { value: 'Asia/Yerevan',        label: 'Armenia',              offset: 'UTC+4'     },
  { value: 'Asia/Kabul',          label: 'Afghanistan',          offset: 'UTC+4:30'  },
  { value: 'Asia/Tashkent',       label: 'Uzbekistan',           offset: 'UTC+5'     },
  { value: 'Asia/Yekaterinburg',  label: 'Yekaterinburg',        offset: 'UTC+5'     },
  { value: 'Asia/Kolkata',        label: 'India Standard (IST)', offset: 'UTC+5:30'  },
  { value: 'Asia/Colombo',        label: 'Sri Lanka',            offset: 'UTC+5:30'  },
  { value: 'Asia/Kathmandu',      label: 'Nepal',                offset: 'UTC+5:45'  },
  { value: 'Asia/Dhaka',          label: 'Bangladesh',           offset: 'UTC+6'     },
  { value: 'Asia/Almaty',         label: 'Kazakhstan',           offset: 'UTC+6'     },
  { value: 'Asia/Rangoon',        label: 'Myanmar',              offset: 'UTC+6:30'  },
  { value: 'Asia/Bangkok',        label: 'Bangkok / Hanoi',      offset: 'UTC+7'     },
  { value: 'Asia/Jakarta',        label: 'Jakarta',              offset: 'UTC+7'     },
  { value: 'Asia/Ho_Chi_Minh',    label: 'Ho Chi Minh City',     offset: 'UTC+7'     },
  { value: 'Asia/Singapore',      label: 'Singapore (SGT)',      offset: 'UTC+8'     },
  { value: 'Asia/Kuala_Lumpur',   label: 'Kuala Lumpur',         offset: 'UTC+8'     },
  { value: 'Asia/Manila',         label: 'Manila',               offset: 'UTC+8'     },
  { value: 'Asia/Shanghai',       label: 'China Standard (CST)', offset: 'UTC+8'     },
  { value: 'Asia/Hong_Kong',      label: 'Hong Kong',            offset: 'UTC+8'     },
  { value: 'Asia/Taipei',         label: 'Taipei',               offset: 'UTC+8'     },
  { value: 'Asia/Ulaanbaatar',    label: 'Ulaanbaatar',          offset: 'UTC+8'     },
  { value: 'Asia/Seoul',          label: 'Korea Standard (KST)', offset: 'UTC+9'     },
  { value: 'Asia/Tokyo',          label: 'Japan Standard (JST)', offset: 'UTC+9'     },
  { value: 'Australia/Perth',     label: 'Perth (AWST)',          offset: 'UTC+8'     },
  { value: 'Australia/Adelaide',  label: 'Adelaide (ACST)',       offset: 'UTC+9:30'  },
  { value: 'Australia/Darwin',    label: 'Darwin (ACST)',         offset: 'UTC+9:30'  },
  { value: 'Australia/Brisbane',  label: 'Brisbane (AEST)',       offset: 'UTC+10'    },
  { value: 'Australia/Sydney',    label: 'Sydney (AEST/AEDT)',    offset: 'UTC+10/11' },
  { value: 'Australia/Melbourne', label: 'Melbourne',             offset: 'UTC+10/11' },
  { value: 'Pacific/Auckland',    label: 'New Zealand (NZST)',    offset: 'UTC+12/13' },
  { value: 'Pacific/Fiji',        label: 'Fiji',                  offset: 'UTC+12'    },
  { value: 'Pacific/Guam',        label: 'Guam',                  offset: 'UTC+10'    },
  { value: 'America/Sao_Paulo',   label: 'Brasília (BRT)',        offset: 'UTC-3'     },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', offset: 'UTC-3'  },
  { value: 'America/Santiago',    label: 'Santiago',              offset: 'UTC-4/3'   },
  { value: 'America/Bogota',      label: 'Bogotá',                offset: 'UTC-5'     },
  { value: 'America/Lima',        label: 'Lima',                  offset: 'UTC-5'     },
  { value: 'America/Mexico_City', label: 'Mexico City',           offset: 'UTC-6/5'   },
  { value: 'America/Toronto',     label: 'Toronto (ET)',          offset: 'UTC-5/4'   },
  { value: 'America/Vancouver',   label: 'Vancouver (PT)',        offset: 'UTC-8/7'   },
  { value: 'Africa/Cairo',        label: 'Cairo (EET)',           offset: 'UTC+2'     },
  { value: 'Africa/Lagos',        label: 'Lagos (WAT)',           offset: 'UTC+1'     },
  { value: 'Africa/Nairobi',      label: 'Nairobi (EAT)',         offset: 'UTC+3'     },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)',   offset: 'UTC+2'     },
  { value: 'UTC',                 label: 'UTC',                   offset: 'UTC+0'     },
];

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
  linkedin: {
    label: 'LinkedIn',
    Icon: IpLinkedIn,
    color: '#0A66C2',
    description: 'Post to your company page',
    tokenHelp: {
      title: 'How to get your LinkedIn Access Token:',
      steps: [
        { text: 'Go to LinkedIn Developer Portal and create an app (requires company page)' },
        { text: 'Enable the "Share on LinkedIn" and "Marketing Developer Platform" products' },
        { text: 'Under "Auth" tab, generate an access token with w_member_social permission' },
        { text: 'Paste the access token below' },
      ],
      pageIdLabel: 'Company Page ID (e.g. urn:li:organization:12345678)',
      pageIdHelp: 'Found in your LinkedIn Company Page admin URL after /company/',
    },
  },
  tiktok: {
    label: 'TikTok',
    Icon: IpTikTok,
    color: '#010101',
    description: 'Post to your business account',
    tokenHelp: {
      title: 'How to connect TikTok:',
      steps: [
        { text: 'Go to TikTok for Business developer portal and create an app' },
        { text: 'Enable the Content Posting API product in your app settings' },
        { text: 'Generate a user access token with video.publish scope' },
        { text: 'Paste the access token below' },
      ],
      pageIdLabel: 'TikTok Open ID (your account ID)',
      pageIdHelp: 'Found in TikTok for Business → Account Settings → Open ID',
    },
  },
};

export default function Settings() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const [profile, setProfile] = useState(null);
  const [providers, setProviders] = useState(null);
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [socialStatus, setSocialStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [scraperUrl, setScraperUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [timezone, setTimezone] = useState('UTC');
  const [loadError, setLoadError] = useState(false);
  const [receptionistConfig, setReceptionistConfig] = useState(null);
  const [integrationModal,  setIntegrationModal]  = useState(null); // null | 'twilio' | 'calcom' | 'mailgun' | 'meta_whatsapp'
  const [integrationForm,   setIntegrationForm]   = useState({});
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationError,  setIntegrationError]  = useState('');
  const [editingAutomation, setEditingAutomation] = useState(null);
  const [automationForm,    setAutomationForm]    = useState({});
  const [automationSaving,  setAutomationSaving]  = useState(false);
  const [automationError,   setAutomationError]   = useState('');
  const [creatingAutomation, setCreatingAutomation] = useState(false);
  const [createForm, setCreateForm] = useState({ label: '', trigger_event: 'lead_contacted', delay_hours: 24, channel: 'sms', message_template: '' });
  const [createSaving,  setCreateSaving]  = useState(false);
  const [createError,   setCreateError]   = useState('');
  const [deletingAutomationId, setDeletingAutomationId] = useState(null);

  // Manual token modal state
  const [setupModal, setSetupModal] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [manualPageId, setManualPageId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [tokenVerifying, setTokenVerifying] = useState(false);
  const [tokenVerified, setTokenVerified] = useState(null); // null | { valid, accountName, error }

  const openIntegrationModal = (type) => {
    const cfg = receptionistConfig || {};
    if (type === 'twilio') setIntegrationForm({ twilioAccountSid: cfg.twilio_account_sid || '', twilioAuthToken: '', twilioPhoneNumber: cfg.twilio_phone_number || '', twilioWhatsappNumber: cfg.twilio_whatsapp_number || '' });
    if (type === 'calcom') setIntegrationForm({ calcomApiKey: '', bookingLink: cfg.booking_link || '' });
    if (type === 'mailgun') setIntegrationForm({ mailgunApiKey: '', mailgunDomain: cfg.mailgun_domain || '', mailgunFromEmail: cfg.mailgun_from_email || '' });
    if (type === 'meta_whatsapp') setIntegrationForm({ metaWaPhoneNumberId: cfg.meta_wa_phone_number_id || '', metaWaAccessToken: '', metaWaBusinessId: cfg.meta_wa_business_id || '' });
    setIntegrationError('');
    setIntegrationModal(type);
  };

  const handleSaveIntegration = async () => {
    setIntegrationSaving(true);
    setIntegrationError('');
    try {
      await receptionistAPI.saveConfig(integrationForm);
      const res = await receptionistAPI.getConfig();
      setReceptionistConfig(res.data?.config || null);
      setIntegrationModal(null);
      showToast('Integration saved successfully');
    } catch (err) {
      setIntegrationError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setIntegrationSaving(false);
    }
  };

  const TRIGGER_LABELS = {
    lead_contacted:     'After a lead is contacted',
    job_completed:      'After a job is completed',
    appointment_missed: 'After an appointment is missed',
  };

  const getAutomations = () => receptionistConfig?.automation_config || [
    { type: 'follow_up',      enabled: true,  label: 'Lead follow-up',    description: "Sent to leads who haven't replied after the delay window.", delay_hours: 48, channel: 'sms', message_template: "Hi {name}! Just checking in from {business_name}. Did you get a chance to sort out your inquiry? We have openings this week if you're still looking." },
    { type: 'review_request', enabled: true,  label: 'Review request',    description: 'Sent after you mark a job as completed.',                   delay_hours: 4,  channel: 'sms', message_template: "Hi {name}! Glad we could help today. Would you mind leaving us a quick Google review? It really helps small businesses like ours. {booking_link}" },
    { type: 'noshow',         enabled: true,  label: 'No-show follow-up', description: 'Sent when a customer misses their appointment.',            delay_hours: 2,  channel: 'sms', message_template: "Hi {name}, we missed you today! Would you like to reschedule? Here's our booking link: {booking_link}" },
    { type: 'seasonal',       enabled: false, label: 'Seasonal campaign', description: 'Broadcast to past customers — configure before enabling.',  delay_hours: 0,  channel: 'sms', message_template: "Hi {name}, just a seasonal update from {business_name}. {booking_link}" },
  ];

  const handleAutomationToggle = async (key, enabled) => {
    const updated = getAutomations().map(r => (r.id === key || r.type === key) ? { ...r, enabled } : r);
    try {
      await receptionistAPI.saveConfig({ automationConfig: updated });
      const res = await receptionistAPI.getConfig();
      setReceptionistConfig(res.data?.config || null);
    } catch (err) {
      showToast('Failed to save automation', 'error');
    }
  };

  const handleSaveAutomation = async () => {
    setAutomationSaving(true);
    setAutomationError('');
    try {
      const updated = getAutomations().map(r =>
        (r.id && r.id === editingAutomation.id) || r.type === editingAutomation.type
          ? { ...r, ...automationForm }
          : r
      );
      await receptionistAPI.saveConfig({ automationConfig: updated });
      const res = await receptionistAPI.getConfig();
      setReceptionistConfig(res.data?.config || null);
      setEditingAutomation(null);
    } catch (err) {
      setAutomationError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setAutomationSaving(false);
    }
  };

  const handleCreateAutomation = async () => {
    if (!createForm.label.trim()) { setCreateError('Please enter a name for this automation.'); return; }
    if (!createForm.message_template.trim()) { setCreateError('Please enter a message template.'); return; }
    setCreateSaving(true);
    setCreateError('');
    try {
      const newRule = {
        id: 'custom_' + Date.now(),
        type: 'custom',
        trigger_event: createForm.trigger_event,
        label: createForm.label.trim(),
        description: TRIGGER_LABELS[createForm.trigger_event] || '',
        enabled: true,
        delay_hours: Number(createForm.delay_hours) || 0,
        channel: createForm.channel,
        message_template: createForm.message_template.trim(),
      };
      const updated = [...getAutomations(), newRule];
      await receptionistAPI.saveConfig({ automationConfig: updated });
      const res = await receptionistAPI.getConfig();
      setReceptionistConfig(res.data?.config || null);
      setCreatingAutomation(false);
      setCreateForm({ label: '', trigger_event: 'lead_contacted', delay_hours: 24, channel: 'sms', message_template: '' });
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleDeleteCustomAutomation = async (id) => {
    const updated = getAutomations().filter(r => r.id !== id);
    setDeletingAutomationId(null);
    try {
      await receptionistAPI.saveConfig({ automationConfig: updated });
      const res = await receptionistAPI.getConfig();
      setReceptionistConfig(res.data?.config || null);
    } catch (err) {
      showToast('Failed to delete automation', 'error');
    }
  };

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
      const [profileRes, providersRes, scrapedRes, receptionistRes] = await Promise.all([
        customerAPI.getProfile(),
        contentAPI.getProviders().catch(() => ({ data: {} })),
        scraperAPI.getData().catch(() => ({ data: { hasData: false } })),
        receptionistAPI.getConfig().catch(() => ({ data: { config: null } })),
      ]);
      setProfile(profileRes.data);
      setTimezone(profileRes.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setProviders(providersRes.data);
      setReceptionistConfig(receptionistRes.data?.config || null);
      if (scrapedRes.data.hasData) {
        setScrapedData(scrapedRes.data);
        setScraperUrl(scrapedRes.data.website || '');
      }
    } catch {
      showToast('Failed to load settings', 'error');
      setLoadError(true);
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

  const handleClearScrape = () => {
    setConfirmModal({
      title: 'Clear Website Data',
      message: 'This will remove your saved website scan. You can re-scan anytime.',
      confirmLabel: 'Clear',
      onConfirm: async () => {
        try {
          await scraperAPI.clearData();
          setScrapedData(null);
          setScraperUrl('');
          showToast('Saved website data cleared');
        } catch {
          showToast('Failed to clear data', 'error');
        }
      },
    });
  };

  const handleConnect = (platform) => {
    setManualToken('');
    setManualPageId('');
    setManualName('');
    setTokenVerified(null);
    setSetupModal(platform);
  };

  const handleVerifyToken = async () => {
    if (!manualToken.trim()) return;
    setTokenVerifying(true);
    setTokenVerified(null);
    try {
      const { data } = await socialAPI.verifyToken(setupModal, manualToken.trim(), manualPageId.trim() || undefined);
      setTokenVerified(data);
      if (data.valid && data.accountName && !manualName) setManualName(data.accountName);
      if (data.valid && data.accountId && !manualPageId) setManualPageId(data.accountId);
    } catch {
      setTokenVerified({ valid: false, error: 'Could not reach the platform — check your token.' });
    } finally {
      setTokenVerifying(false);
    }
  };

  const handleManualSave = async () => {
    if (!manualToken.trim()) { showToast('Access token is required', 'error'); return; }
    if (manualToken.trim().length < 10) { showToast('Token seems too short — please check it', 'error'); return; }
    setManualSaving(true);
    try {
      await socialAPI.connectManual(setupModal, {
        accessToken: manualToken.trim(),
        pageId: manualPageId.trim(),
        accountName: manualName.trim(),
      });
      showToast(`${PLATFORM_CONFIG[setupModal]?.label} connected successfully!`);
      setSetupModal(null);
      setTokenVerified(null);
      loadSocialAccounts();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to save token', 'error');
    } finally {
      setManualSaving(false);
    }
  };

  const handleDisconnect = async (platform) => {
    const label = PLATFORM_CONFIG[platform]?.label || platform;
    setConfirmModal({
      title: `Disconnect ${label}`,
      message: `This will disconnect ${label} — you can reconnect anytime.`,
      confirmLabel: 'Disconnect',
      confirmVariant: 'danger',
      onConfirm: async () => {
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
      },
    });
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
        timezone,
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 16 }}>
          {loadError ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>Could not load settings</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>Check your connection and try refreshing the page.</div>
              <button onClick={() => { setLoadError(false); setLoading(true); loadData(); }} style={{ marginTop: 8, padding: '9px 20px', background: t.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Retry
              </button>
            </>
          ) : (
            <Spinner size={36} />
          )}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
            <div style={{ padding: '8px 12px', background: `${t.warning}15`, border: `1px solid ${t.warning}33`, borderRadius: 8, fontSize: 12, color: t.warning, marginBottom: 12 }}>
              New site detected — scan it to update your saved information.
            </div>
          )}
          {scrapedData && (
            <div style={{ background: `${t.success}15`, border: `1px solid ${t.success}33`, borderRadius: 10, padding: 16 }}>
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
                const defaultColors = { primary: t.primary, secondary: '#22C55E', accent: '#F97316' };
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

        {/* Timezone & Scheduling */}
        <Card>
          <SectionHeader icon={IpSchedule} title="Timezone & Scheduling" />
          <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, marginTop: -12 }}>
            Scheduled posts are converted to UTC using your timezone. All times display in local time.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>Your Timezone</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  style={{
                    flex: '1 1 280px', padding: '10px 12px',
                    background: t.input, border: `1px solid ${t.border}`,
                    borderRadius: 8, color: t.text, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    setTimezone(detected || 'UTC');
                  }}
                  style={{
                    padding: '10px 14px', background: t.input,
                    border: `1px solid ${t.border}`, borderRadius: 8,
                    color: t.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Auto-detect
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: t.textMuted, padding: '8px 12px', background: t.input, borderRadius: 8, border: `1px solid ${t.border}` }}>
              Current selection: <strong style={{ color: t.text }}>{timezone}</strong>
              {' — '}local time: <strong style={{ color: t.text }}>
                {new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true, weekday: 'short' }).format(new Date())}
              </strong>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{config.label}</div>
                        {connected && connected.token_expires_at && (() => {
                          const daysLeft = Math.floor((new Date(connected.token_expires_at) - new Date()) / 86400000);
                          return daysLeft >= 0 && daysLeft <= 7
                            ? <Badge variant="warning">Expires in {daysLeft}d</Badge>
                            : null;
                        })()}
                      </div>
                      <div style={{ fontSize: 12, color: connected ? t.success : t.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {connected ? <><IpCheck size={12} style={{ color: t.success }} />{connected.account_name || 'Connected'}</> : config.description}
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

        {/* AI Receptionist Integrations */}
        {(() => {
          const integrations = [
            {
              key: 'twilio',
              label: 'Twilio',
              desc: 'SMS messaging for AI Receptionist',
              connected: receptionistConfig?.has_twilio_configured,
              accentColor: '#F54B24',
              logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#F54B24" /><circle cx="8.5" cy="8.5" r="2" fill="white" /><circle cx="15.5" cy="8.5" r="2" fill="white" /><circle cx="8.5" cy="15.5" r="2" fill="white" /><circle cx="15.5" cy="15.5" r="2" fill="white" /></svg>,
            },
            {
              key: 'meta_whatsapp',
              label: 'WhatsApp Business',
              desc: 'WhatsApp via Meta Business API',
              connected: !!(receptionistConfig?.has_meta_wa_configured),
              accentColor: '#25D366',
              logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#25D366" /><path d="M17.5 14.5c-.3.8-1.5 1.5-2.5 1.7-.7.1-1.5.1-4.5-1.5s-4-4-4.2-4.7c-.2-.7 0-1.7.7-2.3.3-.3.7-.5 1-.5h.5c.4 0 .8.3 1 .7l.8 1.8c.2.4.1.9-.2 1.2l-.3.4c.4.7 1 1.3 1.7 1.7l.4-.3c.3-.3.8-.4 1.2-.2l1.8.8c.4.2.7.6.7 1v.5c-.1.3-.1.6-.1.7z" fill="white" /></svg>,
            },
            {
              key: 'calcom',
              label: 'Cal.com',
              desc: 'Appointment booking integration',
              connected: receptionistConfig?.has_calcom_configured,
              accentColor: '#111827',
              logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" stroke={t.text} strokeWidth="1.8" /><path d="M3 9h18" stroke={t.text} strokeWidth="1.8" /><path d="M8 2v4M16 2v4" stroke={t.text} strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="14" r="1.5" fill={t.primary} /></svg>,
            },
            {
              key: 'mailgun',
              label: 'Mailgun',
              desc: 'Email inbound automation',
              connected: receptionistConfig?.has_mailgun_configured,
              accentColor: '#C23B22',
              logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="3" fill="#C23B22" /><path d="M2 7l10 7 10-7" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>,
            },
          ];
          return (
            <Card>
              <SectionHeader
                icon={IpSparkle}
                title="AI Receptionist Integrations"
                subtitle="Connect third-party tools to power your AI Receptionist"
                action={
                  <a href="/receptionist" style={{ fontSize: 12, color: t.primary, fontWeight: 600, textDecoration: 'none' }}>
                    Full settings →
                  </a>
                }
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {integrations.map((intg, idx) => (
                  <div key={idx} style={{ padding: '14px 16px', background: t.input, borderRadius: 10, border: `1px solid ${intg.connected ? 'rgba(34,197,94,0.35)' : t.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${intg.accentColor}15`, border: `1px solid ${intg.accentColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {intg.logo}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{intg.label}</div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>{intg.desc}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: intg.connected ? 'rgba(34,197,94,0.1)' : t.card, color: intg.connected ? '#16a34a' : t.textMuted, border: `1px solid ${intg.connected ? 'rgba(34,197,94,0.3)' : t.border}`, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                        {intg.connected ? <><IpCheck size={10} style={{ color: '#16a34a' }} />Connected</> : 'Not set up'}
                      </span>
                    </div>
                    <button
                      onClick={() => openIntegrationModal(intg.key)}
                      style={{ width: '100%', padding: '7px 0', borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: t.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {intg.connected ? 'Update credentials' : 'Configure →'}
                    </button>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: t.textMuted, marginTop: 12, marginBottom: 0 }}>
                Business hours, escalation rules, and auto-handle settings are on the{' '}
                <a href="/receptionist" style={{ color: t.primary, fontWeight: 600 }}>AI Receptionist page</a>.
              </p>
            </Card>
          );
        })()}

        {/* AI Receptionist Automations */}
        <Card>
          <SectionHeader
            icon={IpSend}
            title="Automations"
            subtitle="Pre-built sequences that run automatically. Toggle each one or edit to customise."
          />
          {!receptionistConfig?.has_twilio_configured && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, marginBottom: 16 }}>
              <IpWarning size={15} style={{ color: '#d97706', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#d97706' }}>Automations send via SMS. <a href="#integrations" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ color: '#d97706', fontWeight: 600 }}>Connect Twilio</a> to activate them.</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {getAutomations().map((rule, idx) => {
              const ruleKey = rule.id || rule.type;
              const delayLabel = rule.delay_hours === 0 ? 'Immediate' : rule.delay_hours < 24 ? `${rule.delay_hours}h delay` : `${rule.delay_hours / 24}d delay`;
              const channelLabel = { sms: 'SMS', whatsapp: 'WhatsApp', email: 'Email' }[rule.channel] || rule.channel?.toUpperCase() || 'SMS';
              const isCustom = rule.type === 'custom';
              const isConfirmingDelete = deletingAutomationId === ruleKey;
              return (
                <div key={ruleKey} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: t.card, borderBottom: idx < getAutomations().length - 1 ? `1px solid ${t.border}` : 'none', opacity: rule.enabled ? 1 : 0.6, borderLeft: isCustom ? `3px solid ${t.primary}` : 'none' }}>
                  {/* Pill toggle */}
                  <button
                    onClick={() => handleAutomationToggle(ruleKey, !rule.enabled)}
                    style={{ flexShrink: 0, width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: rule.enabled ? t.primary : t.border, position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: 3, left: rule.enabled ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                  </button>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{rule.label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{rule.description}</div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                      <span style={{ fontSize: 11, color: t.textSecondary, background: t.input, padding: '2px 8px', borderRadius: 20, border: `1px solid ${t.border}` }}>{channelLabel}</span>
                      {rule.delay_hours > 0 && <span style={{ fontSize: 11, color: t.textSecondary, background: t.input, padding: '2px 8px', borderRadius: 20, border: `1px solid ${t.border}` }}>{delayLabel}</span>}
                    </div>
                    {/* Inline delete confirmation */}
                    {isConfirmingDelete && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: 11, color: t.error }}>Delete this automation?</span>
                        <button onClick={() => handleDeleteCustomAutomation(rule.id)} style={{ fontSize: 11, fontWeight: 700, color: t.error, background: 'none', border: `1px solid ${t.error}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Yes, delete</button>
                        <button onClick={() => setDeletingAutomationId(null)} style={{ fontSize: 11, color: t.textMuted, background: 'none', border: `1px solid ${t.border}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => { setEditingAutomation(rule); setAutomationForm({ enabled: rule.enabled, delay_hours: rule.delay_hours, channel: rule.channel, message_template: rule.message_template }); setAutomationError(''); }}
                      style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Edit
                    </button>
                    {isCustom && (
                      <button
                        onClick={() => setDeletingAutomationId(isConfirmingDelete ? null : ruleKey)}
                        style={{ padding: '6px 8px', borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: t.error, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <IpDelete size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => { setCreatingAutomation(true); setCreateError(''); setCreateForm({ label: '', trigger_event: 'lead_contacted', delay_hours: 24, channel: 'sms', message_template: '' }); }}
            style={{ marginTop: 12, padding: '9px 16px', borderRadius: 8, border: `1px dashed ${t.border}`, background: 'transparent', color: t.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
            + Add Automation
          </button>
          <p style={{ fontSize: 12, color: t.textMuted, marginTop: 10, marginBottom: 0 }}>
            Variables you can use in message templates: <code style={{ background: t.input, padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>{'{name}'}</code>{' '}
            <code style={{ background: t.input, padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>{'{business_name}'}</code>{' '}
            <code style={{ background: t.input, padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>{'{booking_link}'}</code>
          </p>
        </Card>

      </div>

      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}

      {/* Edit Automation Modal */}
      {editingAutomation && (
        <div onClick={() => setEditingAutomation(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0 }}>Edit: {editingAutomation.label}</h3>
                <p style={{ fontSize: 12, color: t.textMuted, margin: '4px 0 0' }}>{editingAutomation.description}</p>
              </div>
              <button onClick={() => setEditingAutomation(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4, display: 'flex' }}>
                <IpClose size={18} />
              </button>
            </div>

            {automationError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: `1px solid ${t.error}40`, borderRadius: 8, color: t.error, fontSize: 13, marginBottom: 16 }}>
                {automationError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Enabled toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: t.input, borderRadius: 8, border: `1px solid ${t.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Enabled</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>Automation will run when triggered</div>
                </div>
                <button
                  onClick={() => setAutomationForm(f => ({ ...f, enabled: !f.enabled }))}
                  style={{ flexShrink: 0, width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: automationForm.enabled ? t.primary : t.border, position: 'relative', transition: 'background 0.2s' }}>
                  <span style={{ position: 'absolute', top: 4, left: automationForm.enabled ? 22 : 4, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                </button>
              </div>

              {/* Delay */}
              {editingAutomation.type !== 'seasonal' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Delay after trigger</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="number" min="0" max="720"
                      value={automationForm.delay_hours || 0}
                      onChange={(e) => setAutomationForm(f => ({ ...f, delay_hours: parseInt(e.target.value) || 0 }))}
                      style={{ width: 80, padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }}
                    />
                    <select
                      value={automationForm.delay_hours > 0 && automationForm.delay_hours % 24 === 0 ? 'days' : 'hours'}
                      onChange={(e) => {
                        if (e.target.value === 'days') setAutomationForm(f => ({ ...f, delay_hours: Math.max(1, Math.round((f.delay_hours || 24) / 24)) * 24 }));
                        else setAutomationForm(f => ({ ...f, delay_hours: f.delay_hours % 24 || 1 }));
                      }}
                      style={{ flex: 1, padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, cursor: 'pointer', colorScheme: theme }}>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Channel */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Channel</label>
                <select
                  value={automationForm.channel || 'sms'}
                  onChange={(e) => setAutomationForm(f => ({ ...f, channel: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, cursor: 'pointer', colorScheme: theme }}>
                  <option value="sms">SMS</option>
                  <option value="whatsapp" disabled={!receptionistConfig?.twilio_whatsapp_number && !receptionistConfig?.meta_wa_phone_number_id}>
                    {`WhatsApp${!receptionistConfig?.twilio_whatsapp_number && !receptionistConfig?.meta_wa_phone_number_id ? ' (not configured)' : ''}`}
                  </option>
                  <option value="email" disabled={!receptionistConfig?.has_mailgun_configured}>
                    {`Email${!receptionistConfig?.has_mailgun_configured ? ' (not configured)' : ''}`}
                  </option>
                </select>
              </div>

              {/* Message template */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Message template</label>
                <textarea
                  value={automationForm.message_template || ''}
                  onChange={(e) => setAutomationForm(f => ({ ...f, message_template: e.target.value }))}
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 5 }}>
                  Variables: <code style={{ background: t.input, padding: '1px 4px', borderRadius: 3 }}>{'{name}'}</code>{' '}
                  <code style={{ background: t.input, padding: '1px 4px', borderRadius: 3 }}>{'{business_name}'}</code>{' '}
                  <code style={{ background: t.input, padding: '1px 4px', borderRadius: 3 }}>{'{booking_link}'}</code>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setEditingAutomation(null)}
                style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveAutomation} disabled={automationSaving}
                style={{ padding: '9px 20px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: automationSaving ? 0.6 : 1 }}>
                {automationSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Automation Modal */}
      {creatingAutomation && (
        <div onClick={() => setCreatingAutomation(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0 }}>New Automation</h3>
                <p style={{ fontSize: 12, color: t.textMuted, margin: '4px 0 0' }}>Runs automatically when the trigger event occurs.</p>
              </div>
              <button onClick={() => setCreatingAutomation(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4, display: 'flex' }}>
                <IpClose size={18} />
              </button>
            </div>

            {createError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: `1px solid ${t.error}40`, borderRadius: 8, color: t.error, fontSize: 13, marginBottom: 16 }}>
                {createError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Name</label>
                <input
                  type="text"
                  placeholder="e.g. 7-day re-engagement"
                  value={createForm.label}
                  onChange={(e) => setCreateForm(f => ({ ...f, label: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              {/* Trigger */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Trigger — when does this send?</label>
                <select
                  value={createForm.trigger_event}
                  onChange={(e) => setCreateForm(f => ({ ...f, trigger_event: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, cursor: 'pointer', colorScheme: theme }}>
                  {Object.entries(TRIGGER_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>

              {/* Delay */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Delay after trigger</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number" min="0" max="720"
                    value={createForm.delay_hours}
                    onChange={(e) => setCreateForm(f => ({ ...f, delay_hours: parseInt(e.target.value) || 0 }))}
                    style={{ width: 80, padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }}
                  />
                  <select
                    value={createForm.delay_hours > 0 && createForm.delay_hours % 24 === 0 ? 'days' : 'hours'}
                    onChange={(e) => {
                      if (e.target.value === 'days') setCreateForm(f => ({ ...f, delay_hours: Math.max(1, Math.round((f.delay_hours || 24) / 24)) * 24 }));
                      else setCreateForm(f => ({ ...f, delay_hours: f.delay_hours % 24 || 1 }));
                    }}
                    style={{ flex: 1, padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, cursor: 'pointer', colorScheme: theme }}>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
              </div>

              {/* Channel */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Channel</label>
                <select
                  value={createForm.channel}
                  onChange={(e) => setCreateForm(f => ({ ...f, channel: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, cursor: 'pointer', colorScheme: theme }}>
                  <option value="sms">SMS</option>
                  <option value="whatsapp" disabled={!receptionistConfig?.twilio_whatsapp_number && !receptionistConfig?.meta_wa_phone_number_id}>
                    {`WhatsApp${!receptionistConfig?.twilio_whatsapp_number && !receptionistConfig?.meta_wa_phone_number_id ? ' (not configured)' : ''}`}
                  </option>
                  <option value="email" disabled={!receptionistConfig?.has_mailgun_configured}>
                    {`Email${!receptionistConfig?.has_mailgun_configured ? ' (not configured)' : ''}`}
                  </option>
                </select>
              </div>

              {/* Message template */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Message template</label>
                <textarea
                  placeholder="Hi {name}, just following up from {business_name}..."
                  value={createForm.message_template}
                  onChange={(e) => setCreateForm(f => ({ ...f, message_template: e.target.value }))}
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 5 }}>
                  Variables: <code style={{ background: t.input, padding: '1px 4px', borderRadius: 3 }}>{'{name}'}</code>{' '}
                  <code style={{ background: t.input, padding: '1px 4px', borderRadius: 3 }}>{'{business_name}'}</code>{' '}
                  <code style={{ background: t.input, padding: '1px 4px', borderRadius: 3 }}>{'{booking_link}'}</code>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setCreatingAutomation(false)}
                style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleCreateAutomation} disabled={createSaving}
                style={{ padding: '9px 20px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: createSaving ? 0.6 : 1 }}>
                {createSaving ? 'Creating...' : 'Create Automation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Integration Configure Modals */}
      {integrationModal && (
        <div onClick={() => setIntegrationModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28, maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0 }}>
                {integrationModal === 'twilio' && 'Configure Twilio'}
                {integrationModal === 'calcom' && 'Configure Cal.com'}
                {integrationModal === 'mailgun' && 'Configure Mailgun'}
                {integrationModal === 'meta_whatsapp' && 'Configure WhatsApp Business'}
              </h3>
              <button onClick={() => setIntegrationModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4, display: 'flex' }}>
                <IpClose size={18} />
              </button>
            </div>

            {/* Error */}
            {integrationError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: `1px solid ${t.error}40`, borderRadius: 8, color: t.error, fontSize: 13, marginBottom: 16 }}>
                {integrationError}
              </div>
            )}

            {/* Twilio form */}
            {integrationModal === 'twilio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Account SID</label>
                  <input type="text" value={integrationForm.twilioAccountSid || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, twilioAccountSid: e.target.value }))}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Auth Token</label>
                  <input type="password" value={integrationForm.twilioAuthToken || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, twilioAuthToken: e.target.value }))}
                    placeholder="Leave blank to keep existing"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>SMS Phone Number</label>
                  <input type="text" value={integrationForm.twilioPhoneNumber || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, twilioPhoneNumber: e.target.value }))}
                    placeholder="+15551234567"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 4 }}>
                    WhatsApp Number <span style={{ fontSize: 11, fontWeight: 400, color: t.textMuted }}>(optional)</span>
                  </label>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>Include the whatsapp: prefix, e.g. whatsapp:+15551234567</div>
                  <input type="text" value={integrationForm.twilioWhatsappNumber || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, twilioWhatsappNumber: e.target.value }))}
                    placeholder="whatsapp:+15551234567"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Cal.com form */}
            {integrationModal === 'calcom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>API Key</label>
                  <input type="password" value={integrationForm.calcomApiKey || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, calcomApiKey: e.target.value }))}
                    placeholder="Leave blank to keep existing"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Booking Link</label>
                  <input type="url" value={integrationForm.bookingLink || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, bookingLink: e.target.value }))}
                    placeholder="https://cal.com/yourbusiness"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Mailgun form */}
            {integrationModal === 'mailgun' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>API Key</label>
                  <input type="password" value={integrationForm.mailgunApiKey || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, mailgunApiKey: e.target.value }))}
                    placeholder="Leave blank to keep existing"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Domain</label>
                  <input type="text" value={integrationForm.mailgunDomain || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, mailgunDomain: e.target.value }))}
                    placeholder="mail.yourbusiness.com"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>From Email</label>
                  <input type="email" value={integrationForm.mailgunFromEmail || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, mailgunFromEmail: e.target.value }))}
                    placeholder="hello@mail.yourbusiness.com"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Inbound Webhook URL</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="text" readOnly value="https://api.itsposting.com/api/mailgun/inbound"
                      style={{ flex: 1, padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                    <button onClick={() => { navigator.clipboard.writeText('https://api.itsposting.com/api/mailgun/inbound'); }}
                      style={{ padding: '10px 14px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Copy
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
                    Point your Mailgun inbound route to the webhook URL above. In Mailgun → Receiving → Routes, create a rule to forward to this URL.
                  </div>
                </div>
              </div>
            )}

            {/* Meta WhatsApp Business API form */}
            {integrationModal === 'meta_whatsapp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: '10px 14px', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 8, fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
                  Get these credentials from <strong>Meta Business Suite → WhatsApp → API Setup</strong>. Create a System User with a permanent access token for production use.
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Phone Number ID</label>
                  <input type="text" value={integrationForm.metaWaPhoneNumberId || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, metaWaPhoneNumberId: e.target.value }))}
                    placeholder="1234567890123456"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Found in WhatsApp → API Setup → Phone number ID</div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Permanent Access Token</label>
                  <input type="password" value={integrationForm.metaWaAccessToken || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, metaWaAccessToken: e.target.value }))}
                    placeholder="Leave blank to keep existing"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Generate via Meta Business Suite → System Users → Generate Token</div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 4 }}>
                    Business Account ID <span style={{ fontSize: 11, fontWeight: 400, color: t.textMuted }}>(optional)</span>
                  </label>
                  <input type="text" value={integrationForm.metaWaBusinessId || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, metaWaBusinessId: e.target.value }))}
                    placeholder="Your WhatsApp Business Account ID"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setIntegrationModal(null)}
                style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveIntegration} disabled={integrationSaving}
                style={{ padding: '9px 20px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: integrationSaving ? 0.6 : 1 }}>
                {integrationSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Token Modal */}
      {setupModal && platformConfig && (
        <div onClick={() => { setSetupModal(null); setTokenVerified(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, padding: 0, maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

            {/* Colored header band */}
            <div style={{ padding: '22px 28px 18px', borderBottom: `1px solid ${t.border}`, background: `${platformConfig.color}10` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: `${platformConfig.color}20`, border: `1.5px solid ${platformConfig.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <platformConfig.Icon size={20} style={{ color: platformConfig.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Connect {platformConfig.label}</div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 1 }}>Follow the steps below — takes about 2 minutes</div>
                  </div>
                </div>
                <button onClick={() => { setSetupModal(null); setTokenVerified(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4 }}>
                  <IpClose size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Step-by-step instructions */}
              <div style={{ background: t.input, borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, fontSize: 12, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {platformConfig.tokenHelp.title}
                </div>
                <div style={{ padding: '4px 0' }}>
                  {platformConfig.tokenHelp.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: i < platformConfig.tokenHelp.steps.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${platformConfig.color}20`, border: `1px solid ${platformConfig.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color: platformConfig.color }}>
                        {i + 1}
                      </div>
                      <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6, paddingTop: 2 }}>
                        {step.text}
                        {step.link && (
                          <a href={step.link.url} target="_blank" rel="noreferrer" style={{ color: platformConfig.color, fontWeight: 600, textDecoration: 'none', marginLeft: 2 }}>
                            {step.link.label} ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Token input + Test button */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Access Token <span style={{ color: t.error }}>*</span>
                </label>
                <textarea
                  value={manualToken}
                  onChange={(e) => { setManualToken(e.target.value); setTokenVerified(null); }}
                  placeholder="Paste your access token here..."
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${tokenVerified?.valid === false ? t.error : tokenVerified?.valid ? 'rgba(34,197,94,0.5)' : t.border}`, borderRadius: 8, color: t.text, fontSize: 12, fontFamily: 'monospace', resize: 'none', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms' }}
                />
                {/* Verify result banner */}
                {tokenVerified && (
                  <div style={{ marginTop: 8, padding: '9px 12px', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, background: tokenVerified.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${tokenVerified.valid ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, color: tokenVerified.valid ? t.success : t.error }}>
                    {tokenVerified.valid ? <IpCheck size={13} /> : <IpWarning size={13} />}
                    {tokenVerified.valid
                      ? `Token valid — connected as "${tokenVerified.accountName}"`
                      : `Token failed: ${tokenVerified.error}`}
                  </div>
                )}
                <button
                  onClick={handleVerifyToken}
                  disabled={tokenVerifying || manualToken.trim().length < 10}
                  style={{ marginTop: 8, padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: manualToken.trim().length < 10 ? 'not-allowed' : 'pointer', opacity: manualToken.trim().length < 10 ? 0.4 : 1 }}>
                  {tokenVerifying ? 'Testing...' : '🔍 Test connection'}
                </button>
              </div>

              {/* Page ID */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {platformConfig.tokenHelp.pageIdLabel}
                  {' '}<span style={{ color: t.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>(optional — auto-filled on test)</span>
                </label>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>{platformConfig.tokenHelp.pageIdHelp}</div>
                <input type="text" value={manualPageId} onChange={(e) => setManualPageId(e.target.value)} placeholder="e.g. 123456789"
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Account Name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Display Name <span style={{ color: t.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>(auto-filled on test)</span>
                </label>
                <input type="text" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g. Mike's Plumbing"
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

            </div>

            {/* Footer actions */}
            <div style={{ padding: '16px 28px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end', background: t.input }}>
              <button onClick={() => { setSetupModal(null); setTokenVerified(null); }}
                style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleManualSave}
                disabled={manualSaving || !manualToken.trim() || manualToken.trim().length < 10}
                style={{ padding: '10px 22px', background: platformConfig.color, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: manualSaving || manualToken.trim().length < 10 ? 'not-allowed' : 'pointer', opacity: manualSaving || manualToken.trim().length < 10 ? 0.5 : 1 }}>
                {manualSaving ? 'Connecting...' : `Save & Connect ${platformConfig.label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }