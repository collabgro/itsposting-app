import { useState, useEffect, useRef } from 'react';
import {
  IpClose, IpSparkle, IpLoader, IpPhoto as ImageIcon, IpVideo, IpCarousel, IpDrafts,
  IpCredits, IpCheck, IpChevronLeft, IpChevronRight, IpCalendar, IpSchedule,
  IpFacebook, IpInstagram, IpGoogle, IpHash, IpWarning, IpRefresh, IpTip,
} from './icons';
import { contentAPI, postsAPI, analyticsAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../lib/theme';
import { Button } from './ui';

const CONTENT_TYPES = [
  { id: 'static', name: 'Text Card', icon: IpDrafts, credits: 1, desc: 'Styled quote or tip on a branded background', example: 'Share a quick maintenance tip' },
  { id: 'photo', name: 'Photo Post', icon: ImageIcon, credits: 3, desc: 'Generated image with matching caption', example: 'A freshly sealed concrete driveway' },
  { id: 'carousel', name: 'Carousel', icon: IpCarousel, credits: 5, desc: '5-slide educational series with visuals', example: '5 tips for spring garden prep' },
  { id: 'video', name: 'Video Post', icon: IpVideo, credits: 10, desc: '30-second avatar explainer video', example: 'Explain your top service offering' },
];

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', icon: IpFacebook, charLimit: 63206 },
  { id: 'instagram', label: 'Instagram', icon: IpInstagram, charLimit: 2200 },
  { id: 'google_business', label: 'Business Profile', icon: IpGoogle, charLimit: 1500 },
];

const GEN_STEPS = [
  'Creating your draft',
  'Writing copy',
  'Generating visuals',
  'Finalizing your post',
];

const STEP_DELAYS = [800, 2200, 5000, 9000];

export default function ContentCreatorModal({ onClose, onSuccess, defaultDate = '', defaultScheduleMode = 'now', initialPrompt = '', initialContentType = '' }) {
  const { t } = useTheme();
  const [step, setStep] = useState(initialPrompt && initialContentType ? 2 : 1);
  const [contentType, setContentType] = useState(initialContentType || '');
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [credits, setCredits] = useState(null);
  const [providers, setProviders] = useState(null);
  const [doneSteps, setDoneSteps] = useState([]);
  const [platforms, setPlatforms] = useState(['facebook', 'instagram']);
  const [scheduleMode, setScheduleMode] = useState(defaultScheduleMode);
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [saving, setSaving] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [topSlots, setTopSlots] = useState([]);
  const timersRef = useRef([]);

  useEffect(() => {
    contentAPI.getCredits().then(r => setCredits(r.data)).catch(() => {});
    contentAPI.getProviders().then(r => setProviders(r.data)).catch(() => {});
    analyticsAPI.getOptimalTimes().then(r => setTopSlots((r.data?.recommendations || []).slice(0, 3))).catch(() => {});
  }, []);

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  const startGenAnimations = () => { setDoneSteps([]); STEP_DELAYS.forEach((delay, idx) => { const id = setTimeout(() => setDoneSteps(prev => [...prev, idx]), delay); timersRef.current.push(id); }); };

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error('Please enter a prompt'); return; }
    setGenerating(true);
    setDoneSteps([]);
    setStep(3);
    clearTimers();
    startGenAnimations();
    try {
      const res = await contentAPI.generate({ contentType, prompt });
      setGeneratedContent(res.data);
      setCredits(prev => prev ? { ...prev, balance: res.data.creditsRemaining } : null);
      setStep(4);
      toast.success('Draft created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
      setStep(2);
    } finally {
      setGenerating(false);
      clearTimers();
    }
  };

  const togglePlatform = id => setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  const removeHashtag = tag => setGeneratedContent(prev => ({ ...prev, hashtags: prev.hashtags.filter(h => h !== tag) }));

  const handleSave = async () => {
    if (platforms.length === 0) { toast.error('Select at least one platform'); return; }
    if (scheduleMode === 'later' && !scheduledDate) { toast.error('Pick a date and time'); return; }
    setSaving(true);
    try {
      if (generatedContent?.postId) {
        await postsAPI.update(generatedContent.postId, {
          platforms,
          scheduledDate: scheduleMode === 'later' ? scheduledDate : null,
          status: scheduleMode === 'later' ? 'scheduled' : 'draft',
        });
      }
      toast.success(scheduleMode === 'later' ? 'Post scheduled!' : 'Post saved');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const captionLen = generatedContent?.caption?.length || 0;
  const platformLimit = Math.min(...platforms.map(id => PLATFORMS.find(p => p.id === id)?.charLimit || 9999));
  const overLimit = captionLen > platformLimit;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
      <div style={{ background: t.card, borderRadius: 18, border: `1px solid ${t.border}`, width: '100%', maxWidth: 780, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${t.border}`, flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IpSparkle size={16} style={{ color: t.primary }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Content Creator</h2>
              {credits && <p style={{ fontSize: 12, color: t.textMuted }}><span style={{ color: t.primary, fontWeight: 700, fontFamily: 'monospace' }}>{credits.balance}</span> credits available</p>}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary, cursor: 'pointer', flexShrink: 0 }}><IpClose size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {step === 1 && (
            <div>
              <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>What would you like to create today?</p>
              {providers && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, padding: '10px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <IpCredits size={13} style={{ color: t.warning, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: t.textMuted }}>Image sources:</span>
                  <span style={{ fontSize: 12, color: providers.nanobanana?.available ? t.success : t.textMuted, fontWeight: 600 }}>{providers.nanobanana?.available ? '✓' : '○'} Image One</span>
                  <span style={{ fontSize: 12, color: providers.midjourney?.available ? t.success : t.textMuted, fontWeight: 600 }}>{providers.midjourney?.available ? '✓' : '○'} Image Two</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                {CONTENT_TYPES.map(type => {
                  const Icon = type.icon;
                  const canAfford = !credits || credits.balance >= type.credits;
                  return (
                    <button key={type.id} onClick={() => { if (canAfford) { setContentType(type.id); setStep(2); } else toast.error('Insufficient credits'); }} disabled={!canAfford} style={{ padding: 20, border: `2px solid ${t.border}`, background: t.input, borderRadius: 14, textAlign: 'left', cursor: canAfford ? 'pointer' : 'not-allowed', opacity: canAfford ? 1 : 0.45, transition: 'all 150ms' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <Icon size={22} style={{ color: canAfford ? t.primary : t.textMuted }} />
                        <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: t.primaryBg, color: t.primary, border: `1px solid ${t.primaryBorder}`, fontFamily: 'monospace' }}>{type.credits} cr</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>{type.name}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>{type.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              {initialPrompt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, marginBottom: 14, fontSize: 12, color: t.primary }}>
                  <IpSparkle size={13} style={{ flexShrink: 0 }} />
                  <span><strong>PostCore draft loaded</strong> — edit the caption or generate something new</span>
                </div>
              )}
              <button onClick={() => setStep(1)} style={{ fontSize: 12, color: t.primary, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}><IpChevronLeft size={14} /> Back</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                {(() => { const t2 = CONTENT_TYPES.find(tp => tp.id === contentType); return t2 ? <><t2.icon size={16} style={{ color: t.primary, flexShrink: 0 }} /><span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{t2.name}</span><span style={{ fontSize: 12, color: t.textMuted }}>·</span><span style={{ fontSize: 12, color: t.textMuted }}>{t2.credits} credits</span></> : null; })()}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Describe what you want</label>
                <textarea autoFocus placeholder={`Example: "${CONTENT_TYPES.find(tp => tp.id === contentType)?.example}"`} value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }} rows={5} style={{ width: '100%', padding: '12px 14px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 10, color: t.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }} />
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>Tip: be specific. Include your location, service type, or target audience. Press ⌘+Enter to generate.</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: `1px solid ${t.border}`, gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: t.textMuted }}>Cost: <strong style={{ color: t.text, fontFamily: 'monospace' }}>{CONTENT_TYPES.find(tp => tp.id === contentType)?.credits} credits</strong>{credits && <span style={{ color: t.textMuted }}> · {credits.balance} available</span>}</span>
                <button onClick={handleGenerate} disabled={!prompt.trim()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: !prompt.trim() ? t.textDisabled : t.primary, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: prompt.trim() ? 'pointer' : 'not-allowed' }}><IpSparkle size={14} /> Generate</button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <IpLoader size={28} style={{ color: t.primary, animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 8 }}>Creating your draft</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>This usually takes a few seconds</div>
              <div style={{ display: 'grid', gap: 8, maxWidth: 320, margin: '0 auto' }}>
                {GEN_STEPS.map((s, i) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: doneSteps.includes(i) ? 'rgba(34,197,94,0.08)' : t.input, border: `1px solid ${doneSteps.includes(i) ? 'rgba(34,197,94,0.3)' : t.border}` }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: doneSteps.includes(i) ? t.success : t.textMuted, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>{doneSteps.includes(i) ? '✓' : i + 1}</div>
                    <div style={{ fontSize: 13, color: t.text }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 4 && generatedContent && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              <div style={{ padding: 16, background: t.input, border: `1px solid ${t.border}`, borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Preview</div>
                <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.7 }}>{generatedContent.caption}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <button type="button" onClick={() => setScheduleMode('now')} style={{ padding: 12, borderRadius: 10, border: `1px solid ${scheduleMode === 'now' ? t.primary : t.border}`, background: scheduleMode === 'now' ? t.primaryBg : t.input, cursor: 'pointer' }}>Save as draft</button>
                <button type="button" onClick={() => setScheduleMode('later')} style={{ padding: 12, borderRadius: 10, border: `1px solid ${scheduleMode === 'later' ? t.primary : t.border}`, background: scheduleMode === 'later' ? t.primaryBg : t.input, cursor: 'pointer' }}>Schedule</button>
              </div>
              {scheduleMode === 'later' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 10, color: t.text }} />
                  {topSlots.length > 0 && (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {topSlots.map((slot, idx) => (
                        <button key={idx} type="button" onClick={() => setScheduledDate(slot.value)} style={{ padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, textAlign: 'left', cursor: 'pointer' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{slot.label}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{slot.value}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
                <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save post'}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
