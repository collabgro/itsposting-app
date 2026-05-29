import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';
import { wizardAPI, socialAPI, customerAPI } from '../lib/api';
import { IpVideo, IpSparkle, IpPublish, IpArrowLeft, IpUser } from '../components/icons';

// ─── Loading messages ─────────────────────────────────────────────────────────

const CINEMATIC_MSGS = [
  'PostCore is writing your video scene...',
  'Generating key frame with AI...',
  'Sending to video AI — this takes 1–3 minutes...',
  'Animating your scene...',
  'Rendering final video...',
  'Almost there — polishing the output...',
];

const AVATAR_MSGS = [
  'PostCore is writing a 30-second script...',
  'Scripting the perfect talking points...',
  'Sending to avatar AI — this takes 1–2 minutes...',
  'Generating your AI presenter...',
  'Rendering final video...',
  'Almost there — applying final touches...',
];

// ─── VideoWizard page ─────────────────────────────────────────────────────────

export default function VideoWizardPage() {
  const { t } = useTheme();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [videoType, setVideoType] = useState('services'); // 'services' | 'avatar'
  const [details, setDetails] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [phase, setPhase] = useState('setup'); // 'setup' | 'generating' | 'results'
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [msgIdx, setMsgIdx] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [postError, setPostError] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const msgIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const esRef = useRef(null);

  useEffect(() => {
    customerAPI.getProfile().then(r => {
      setProfile(r.data);
    }).catch(() => {});
    socialAPI.getAccounts().then(r => {
      const enabled = (r.data || []).filter(a => a.enabled);
      setConnectedAccounts(enabled);
      setSelectedAccounts(enabled.map(a => a.id));
    }).catch(() => {});
  }, []);

  // Rotate loading messages
  useEffect(() => {
    if (phase !== 'generating') {
      clearInterval(msgIntervalRef.current);
      return;
    }
    const msgs = videoType === 'avatar' ? AVATAR_MSGS : CINEMATIC_MSGS;
    setMsgIdx(0);
    msgIntervalRef.current = setInterval(() => {
      setMsgIdx(i => Math.min(i + 1, msgs.length - 1));
    }, 9000);
    return () => clearInterval(msgIntervalRef.current);
  }, [phase, videoType]);

  // Video polling after generation
  const startPolling = useCallback((postId) => {
    let pollCount = 0;
    const MAX_POLLS = 80;
    pollIntervalRef.current = setInterval(async () => {
      pollCount++;
      setVideoProgress(Math.min(90, pollCount * 3));
      if (pollCount > MAX_POLLS) {
        clearInterval(pollIntervalRef.current);
        setResults(r => ({ ...r, videoRendering: 'failed' }));
        return;
      }
      try {
        const res = await wizardAPI.pollVideo(postId);
        const { status, videoUrl } = res.data || {};
        if (status === 'completed' && videoUrl) {
          setVideoProgress(100);
          setResults(r => ({ ...r, mediaUrl: videoUrl, videoRendering: 'completed' }));
          clearInterval(pollIntervalRef.current);
        } else if (status === 'failed') {
          setResults(r => ({ ...r, videoRendering: 'failed' }));
          clearInterval(pollIntervalRef.current);
        }
      } catch { /* silent retry */ }
    }, 7000);
  }, []);

  useEffect(() => {
    if (!results?.videoRendering || results.videoRendering === 'completed' || results.videoRendering === 'failed') return;
    if (!results?.postId) return;
    startPolling(results.postId);
    const es = esRef.current;
    return () => {
      clearInterval(pollIntervalRef.current);
      if (es) { es.close(); }
    };
  }, [results?.videoRendering, results?.postId, startPolling]);

  async function handleGenerate() {
    if (!details.trim()) return;
    setPhase('generating');
    setError('');
    setVideoProgress(0);
    setResults(null);

    try {
      // Start wizard session
      const startRes = await wizardAPI.start({
        industry: profile?.industry || 'general_contractor',
        contentType: 'video',
      });
      const wizardId = startRes.data?.wizardId;

      // Submit video_type answer
      await wizardAPI.step({ wizardId, stepId: 'video_type', answers: { value: videoType } });

      // Generate
      const genRes = await wizardAPI.generate({
        wizardId,
        contentTypeSelection: 'video',
        videoType,
        details: details.trim(),
        platforms: selectedPlatforms.length ? selectedPlatforms : ['instagram', 'facebook'],
        industry: profile?.industry || 'general_contractor',
        location: profile?.location || '',
        businessName: profile?.business_name || '',
        timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        tone: profile?.tone || 'friendly',
      });

      const data = genRes.data;
      setResults({
        ...data,
        variation: data.variation_a || data.variations?.[0] || {},
      });
      setPhase('results');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Generation failed. Please try again.');
      setPhase('setup');
    }
  }

  async function handlePost() {
    if (!results?.postId) return;
    setPosting(true);
    setPostError('');
    try {
      const accountIds = selectedAccounts.length ? selectedAccounts : connectedAccounts.map(a => a.id);
      await socialAPI.publish(results.postId, accountIds, selectedPlatforms);
      setPostSuccess(true);
    } catch (err) {
      setPostError(err.response?.data?.error || err.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  const msgs = videoType === 'avatar' ? AVATAR_MSGS : CINEMATIC_MSGS;
  const caption = results?.variation?.caption || results?.variation_a?.caption || '';
  const hashtags = (results?.variation?.hashtags || results?.variation_a?.hashtags || []).map(h => `#${h}`).join(' ');
  const videoRendering = results?.videoRendering;

  const PLATFORM_LABELS = [
    { id: 'instagram', label: 'Instagram', color: '#E1306C' },
    { id: 'facebook',  label: 'Facebook',  color: '#1877F2' },
    { id: 'tiktok',    label: 'TikTok',    color: '#010101' },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          {phase === 'results' && (
            <button onClick={() => { setPhase('setup'); setResults(null); setPostSuccess(false); setPostError(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 13, marginBottom: 20, padding: 0 }}>
              <IpArrowLeft size={16} color={t.textMuted} />
              Back
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${t.primary}, #00C4CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IpVideo size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: t.text, margin: 0, lineHeight: 1.1 }}>Video Wizard</h1>
              <p style={{ fontSize: 13, color: t.textMuted, margin: '4px 0 0' }}>PostCore creates your video from scratch — no editing needed</p>
            </div>
          </div>
        </div>

        {/* ── SETUP PHASE ── */}
        {phase === 'setup' && (
          <>
            {/* Credits note */}
            <div style={{ padding: '10px 14px', borderRadius: 10, background: `rgba(124,92,252,0.08)`, border: `1px solid rgba(124,92,252,0.2)`, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IpSparkle size={14} color={t.primary} />
              <span style={{ fontSize: 12, color: t.primary, fontWeight: 600 }}>10 credits · ~2–5 min generation time</span>
              {profile && (
                <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 'auto' }}>
                  {profile.credits_balance ?? 0} credits remaining
                </span>
              )}
            </div>

            {/* Video type */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                Choose video style
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  {
                    id: 'services',
                    label: 'Cinematic',
                    sublabel: 'Job Footage',
                    desc: 'AI-generated scene showing your work — roofing, plumbing, landscaping in action.',
                    tag: 'Recommended',
                    icon: IpVideo,
                    credit: 'Veo AI',
                  },
                  {
                    id: 'avatar',
                    label: 'Talking-Head',
                    sublabel: 'AI Presenter',
                    desc: 'An AI spokesperson talks to camera about your business — great for testimonials.',
                    tag: null,
                    icon: IpUser,
                    credit: 'HeyGen AI',
                  },
                ].map(vt => {
                  const selected = videoType === vt.id;
                  return (
                    <button key={vt.id} onClick={() => setVideoType(vt.id)}
                      style={{
                        padding: '18px 16px', border: `2px solid ${selected ? t.primary : t.border}`,
                        borderRadius: 14, background: selected ? `${t.primary}10` : t.card,
                        cursor: 'pointer', textAlign: 'left', position: 'relative',
                        transition: 'all 150ms ease',
                        boxShadow: selected ? `0 0 0 3px ${t.focusRing}` : 'none',
                      }}
                      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = `${t.primary}60`; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = 'translateY(0)'; } }}
                    >
                      {vt.tag && (
                        <div style={{ position: 'absolute', top: -1, right: 12, background: t.primary, color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: '0 0 6px 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {vt.tag}
                        </div>
                      )}
                      <div style={{ marginBottom: 10 }}>
                        <vt.icon size={24} color={selected ? t.primary : t.textMuted} />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: selected ? t.primary : t.text, marginBottom: 2 }}>{vt.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{vt.sublabel}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.55, marginBottom: 10 }}>{vt.desc}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: selected ? t.primary : t.textMuted, background: selected ? `${t.primary}14` : `rgba(150,150,180,0.1)`, padding: '3px 8px', borderRadius: 20, display: 'inline-block' }}>
                        Powered by {vt.credit}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What's happening */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>
                What&apos;s this video about?
              </label>
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder={videoType === 'avatar'
                  ? 'e.g. "We just finished a big roof replacement in Denver. Show before and after. Mention our spring discount."'
                  : 'e.g. "Showing a complex pipe repair we did last week. Customer was amazed. Location: Austin TX."'
                }
                rows={4}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: `1px solid ${t.border}`, background: t.input, color: t.text,
                  fontSize: 14, lineHeight: 1.6, resize: 'vertical', outline: 'none',
                  boxSizing: 'border-box', fontFamily: 'inherit',
                  transition: 'border-color 150ms',
                }}
                onFocus={e => { e.target.style.borderColor = t.primary; }}
                onBlur={e => { e.target.style.borderColor = t.border; }}
              />
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
                PostCore handles the script and scene — just give it the context.
              </div>
            </div>

            {/* Platform quick-select */}
            {connectedAccounts.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Post to
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {connectedAccounts.map(acc => {
                    const pConf = PLATFORM_LABELS.find(p => acc.platform?.startsWith(p.id));
                    const isOn = selectedAccounts.includes(acc.id);
                    return (
                      <button key={acc.id} onClick={() => setSelectedAccounts(prev => isOn ? prev.filter(x => x !== acc.id) : [...prev, acc.id])}
                        style={{
                          padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: `1.5px solid ${isOn ? pConf?.color || t.primary : t.border}`,
                          background: isOn ? `${pConf?.color || t.primary}14` : t.input,
                          color: isOn ? pConf?.color || t.primary : t.textMuted,
                          transition: 'all 120ms',
                        }}>
                        {acc.account_name || acc.account_username || acc.platform}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13, marginBottom: 20 }}>
                {error}
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!details.trim()}
              style={{
                width: '100%', padding: '16px 24px', borderRadius: 12,
                background: details.trim() ? `linear-gradient(135deg, ${t.primary}, #00C4CC)` : t.border,
                color: '#fff', border: 'none', fontSize: 16, fontWeight: 800,
                cursor: details.trim() ? 'pointer' : 'not-allowed',
                opacity: details.trim() ? 1 : 0.5,
                boxShadow: details.trim() ? `0 4px 24px rgba(124,92,252,0.35)` : 'none',
                transition: 'all 150ms',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
              onMouseEnter={e => { if (details.trim()) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(124,92,252,0.45)`; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = details.trim() ? `0 4px 24px rgba(124,92,252,0.35)` : 'none'; }}
            >
              <IpVideo size={20} color="#fff" />
              Generate Video — 10 credits
            </button>
          </>
        )}

        {/* ── GENERATING PHASE ── */}
        {phase === 'generating' && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            {/* Animated ring */}
            <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="88" height="88" viewBox="0 0 88 88" style={{ position: 'absolute', top: 0, left: 0 }}>
                <circle cx="44" cy="44" r="38" fill="none" stroke={`${t.primary}20`} strokeWidth="5" />
                <circle cx="44" cy="44" r="38" fill="none" stroke={t.primary} strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 38 * 0.25} ${2 * Math.PI * 38 * 0.75}`}
                  style={{ transformOrigin: '44px 44px', animation: 'spin 1.4s linear infinite' }} />
              </svg>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg, ${t.primary}, #00C4CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IpVideo size={24} color="#fff" />
              </div>
            </div>

            <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 10 }}>
              {videoType === 'avatar' ? 'Creating your avatar video...' : 'Creating your cinematic video...'}
            </div>
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 32, minHeight: 22, transition: 'opacity 400ms' }}>
              {msgs[Math.min(msgIdx, msgs.length - 1)]}
            </div>

            {/* Steps */}
            <div style={{ maxWidth: 340, margin: '0 auto', textAlign: 'left' }}>
              {msgs.slice(0, 4).map((msg, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, opacity: i <= msgIdx ? 1 : 0.3, transition: 'opacity 500ms' }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: i < msgIdx ? t.primary : i === msgIdx ? `${t.primary}30` : t.border,
                    border: i === msgIdx ? `2px solid ${t.primary}` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700,
                  }}>
                    {i < msgIdx ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 12, color: i <= msgIdx ? t.text : t.textMuted }}>{msg}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, fontSize: 12, color: t.textMuted }}>
              Captions appear instantly. Video takes 1–3 minutes.
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── RESULTS PHASE ── */}
        {phase === 'results' && results && (
          <div>
            {/* Video rendering banner */}
            {videoRendering && videoRendering !== 'completed' && videoRendering !== 'failed' && (
              <div style={{
                padding: '14px 18px', borderRadius: 12, marginBottom: 20,
                background: 'rgba(124,92,252,0.08)', border: `1px solid rgba(124,92,252,0.22)`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${t.primary}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.primary }}>Video is rendering...</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Your captions are ready now. The video will appear here automatically.</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 12, color: t.textMuted, flexShrink: 0 }}>{videoProgress}%</div>
              </div>
            )}

            {videoRendering === 'failed' && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#D97706', fontSize: 13, marginBottom: 20 }}>
                The video could not be generated this time. Your captions are ready — you can post without a video.
              </div>
            )}

            {/* Video preview */}
            {results.mediaUrl && videoRendering === 'completed' && (
              <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 20, background: '#000', position: 'relative', aspectRatio: '9/16', maxHeight: 480 }}>
                <video
                  src={results.mediaUrl}
                  controls
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            )}

            {/* Script preview (avatar only) */}
            {videoType === 'avatar' && results.variation?.videoScript && (
              <div style={{ padding: '14px 16px', borderRadius: 10, background: t.card, border: `1px solid ${t.border}`, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>30-Second Script</div>
                <div style={{ fontSize: 13, color: t.text, lineHeight: 1.7 }}>{results.variation.videoScript}</div>
              </div>
            )}

            {/* Caption */}
            <div style={{ padding: '18px', borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Caption</div>
                <button onClick={() => { navigator.clipboard.writeText(caption + '\n\n' + hashtags); setCopiedCaption(true); setTimeout(() => setCopiedCaption(false), 2000); }}
                  style={{ fontSize: 11, color: copiedCaption ? '#22c55e' : t.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {copiedCaption ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div style={{ fontSize: 14, color: t.text, lineHeight: 1.75, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{caption}</div>
              {hashtags && <div style={{ fontSize: 12, color: t.primary, lineHeight: 1.6 }}>{hashtags}</div>}
            </div>

            {/* Actions */}
            {!postSuccess ? (
              <>
                {connectedAccounts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {postError && (
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>
                        {postError}
                      </div>
                    )}
                    <button onClick={handlePost} disabled={posting || !results.postId}
                      style={{
                        padding: '14px 20px', borderRadius: 12,
                        background: (posting || !results.postId) ? t.border : `linear-gradient(135deg, ${t.primary}, #00C4CC)`,
                        color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: (posting || !results.postId) ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: posting ? 'none' : `0 4px 20px rgba(124,92,252,0.3)`,
                        opacity: (!results.postId && videoRendering && videoRendering !== 'failed') ? 0.7 : 1,
                      }}>
                      <IpPublish size={18} color="#fff" />
                      {posting ? 'Posting...' : results.postId ? 'Post Now' : 'Preparing...'}
                    </button>
                    <button onClick={() => router.push(`/history`)}
                      style={{ padding: '12px 20px', borderRadius: 12, background: t.input, color: t.text, border: `1px solid ${t.border}`, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      Save as Draft
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px', borderRadius: 10, background: t.card, border: `1px solid ${t.border}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 8 }}>Connect a social account to post directly</div>
                    <button onClick={() => router.push('/settings')}
                      style={{ padding: '8px 16px', borderRadius: 8, background: t.primary, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Connect Accounts
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '20px', borderRadius: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>Posted successfully!</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>Your video is live on the selected platforms.</div>
                <button onClick={() => { setPhase('setup'); setResults(null); setDetails(''); setPostSuccess(false); setPostError(''); }}
                  style={{ padding: '10px 20px', borderRadius: 10, background: t.input, color: t.text, border: `1px solid ${t.border}`, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Create another video
                </button>
              </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    </Layout>
  );
}
