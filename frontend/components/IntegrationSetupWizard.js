import { useState, useEffect } from 'react';
import { useTheme } from '../lib/theme';
import { IpClose, IpCheck, IpWarning, IpSparkle } from './icons';

// ─── Platform Callout Mockup ─────────────────────────────────────────────────
// Renders a styled "platform dashboard" mockup to visually show where to click.
function PlatformCallout({ platformName, highlight, color, note }) {
  const { t, theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${color}30`,
      background: dark ? `${color}08` : `${color}06`,
      overflow: 'hidden',
      marginTop: 8,
    }}>
      {/* Brand bar */}
      <div style={{
        background: color,
        padding: '7px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginLeft: 6, letterSpacing: '0.03em' }}>
          {platformName}
        </span>
      </div>
      {/* Content area */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Highlighted target element */}
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          border: `2px solid ${color}`,
          background: dark ? `${color}15` : `${color}10`,
          animation: 'pulseGlow 2s ease-in-out infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: dark ? '#fff' : '#111' }}>{highlight}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}20`, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
            ← Find this
          </span>
        </div>
        {/* Decorative dimmed items */}
        <div style={{ display: 'flex', gap: 8 }}>
          {['···', '···'].map((d, i) => (
            <div key={i} style={{ flex: 1, height: 28, borderRadius: 6, background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}>{d}</span>
            </div>
          ))}
        </div>
        {note && (
          <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 2 }}>↑ {note}</div>
        )}
      </div>
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 ${color}40; }
          50% { box-shadow: 0 0 0 6px ${color}00; }
        }
      `}</style>
    </div>
  );
}

// ─── Warning Badge ────────────────────────────────────────────────────────────
function WarningBadge({ text }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: 20,
      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)',
      fontSize: 12, fontWeight: 600, color: '#d97706',
      marginBottom: 12,
    }}>
      <IpWarning size={13} style={{ color: '#d97706' }} />
      {text}
    </div>
  );
}

// ─── IntegrationSetupWizard ──────────────────────────────────────────────────
export default function IntegrationSetupWizard({
  wizardConfig,    // { title, slides: [{ heading, subtext, callout, linkButton, badge, note, isCredentialSlide }] }
  formFields,      // [{ key, label, type, placeholder, hint, required, readOnly, value }]
  initialValues,   // object — pre-fill existing credentials
  onSave,          // async (formData) => void
  onTestConnection, // async (formData) => { success, detail/error } — null if no test
  onClose,
  isUpdate,        // bool — already configured, show "Update" header
  accentColor,
  logo,
}) {
  const { t, theme } = useTheme();
  const dark = theme === 'dark';

  const slides = wizardConfig?.slides || [];
  const totalSteps = slides.length;

  const [step, setStep] = useState(0);
  const [formValues, setFormValues] = useState(() => {
    const init = {};
    (formFields || []).forEach(f => { init[f.key] = initialValues?.[f.key] || ''; });
    return init;
  });
  const [testStatus, setTestStatus] = useState('idle'); // idle | testing | success | error
  const [testDetail, setTestDetail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [copied, setCopied] = useState(false);

  const currentSlide = slides[step] || {};
  const isCredSlide = currentSlide.isCredentialSlide;
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;

  const handleNext = () => { if (step < totalSteps - 1) setStep(s => s + 1); };
  const handleBack = () => { if (step > 0) setStep(s => s - 1); };

  const handleTest = async () => {
    if (!onTestConnection) return;
    setTestStatus('testing');
    setTestDetail('');
    try {
      const result = await onTestConnection(formValues);
      if (result?.data?.success) {
        setTestStatus('success');
        setTestDetail(result.data.detail || 'Connection verified!');
      } else {
        setTestStatus('error');
        setTestDetail(result?.data?.error || 'Connection failed');
      }
    } catch (err) {
      setTestStatus('error');
      setTestDetail(err.response?.data?.error || err.message || 'Connection failed');
    }
  };

  const handleSave = async (skipTest = false) => {
    if (onTestConnection && testStatus !== 'success' && !skipTest) {
      setSaveError('Please test the connection first, or click "Save anyway" to skip.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await onSave(formValues);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, padding: 0, maxWidth: 540, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}
      >
        {/* ── Colored header band ── */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${t.border}`, background: `${accentColor}0C` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: `${accentColor}18`, border: `1.5px solid ${accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {logo}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
                  {isUpdate ? `Update ${wizardConfig?.title}` : `Connect ${wizardConfig?.title}`}
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 1 }}>
                  {isUpdate ? 'Update your credentials' : 'Follow the steps — takes about 3 minutes'}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4, display: 'flex' }}>
              <IpClose size={18} />
            </button>
          </div>

          {/* Progress dots */}
          {totalSteps > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
              {slides.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === step ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: i === step ? accentColor : i < step ? `${accentColor}60` : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
                    transition: 'all 200ms ease',
                  }}
                />
              ))}
              <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 4 }}>
                Step {step + 1} of {totalSteps}
              </span>
            </div>
          )}
        </div>

        {/* ── Slide content ── */}
        <div style={{ padding: '22px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Warning badge (for approval-required platforms) */}
          {currentSlide.badge && <WarningBadge text={currentSlide.badge} />}

          {/* Heading + subtext */}
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: '0 0 8px' }}>
              {currentSlide.heading}
            </h3>
            {currentSlide.subtext && (
              <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.65, whiteSpace: 'pre-line' }}>
                {currentSlide.subtext}
              </div>
            )}
          </div>

          {/* Visual platform callout */}
          {currentSlide.callout && (
            <PlatformCallout
              platformName={currentSlide.callout.platformName}
              highlight={currentSlide.callout.highlight}
              color={currentSlide.callout.color || accentColor}
              note={currentSlide.callout.note}
            />
          )}

          {/* External link button */}
          {currentSlide.linkButton && (
            <a
              href={currentSlide.linkButton.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 10,
                background: `${accentColor}15`, border: `1px solid ${accentColor}40`,
                color: accentColor, fontSize: 13, fontWeight: 700,
                textDecoration: 'none', transition: 'all 150ms',
                alignSelf: 'flex-start',
              }}
            >
              {currentSlide.linkButton.label}
            </a>
          )}

          {/* Inline note (e.g. webhook URL to copy) */}
          {currentSlide.webhookUrl && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6 }}>
                Inbound Webhook URL — paste this into Mailgun Receiving → Routes
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  readOnly
                  value={currentSlide.webhookUrl}
                  style={{ flex: 1, padding: '9px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 12, fontFamily: 'monospace', outline: 'none' }}
                />
                <button
                  onClick={() => copyToClipboard(currentSlide.webhookUrl)}
                  style={{ padding: '9px 14px', background: accentColor, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'opacity 150ms', opacity: 1 }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* ── Credential form (last slide) ── */}
          {isCredSlide && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: `1px solid ${t.border}`, paddingTop: 16, marginTop: 4 }}>
              {(formFields || []).map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 5 }}>
                    {field.label}
                    {field.hint && <span style={{ fontWeight: 400, color: t.textMuted, marginLeft: 6 }}>({field.hint})</span>}
                    {field.required && <span style={{ color: t.error, marginLeft: 3 }}>*</span>}
                  </label>
                  {field.readOnly ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        readOnly
                        value={field.value || ''}
                        style={{ flex: 1, padding: '9px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 12, fontFamily: 'monospace', outline: 'none' }}
                      />
                      <button
                        onClick={() => copyToClipboard(field.value)}
                        style={{ padding: '9px 14px', background: accentColor, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={formValues[field.key] || ''}
                      onChange={e => { setFormValues(v => ({ ...v, [field.key]: e.target.value })); setTestStatus('idle'); }}
                      placeholder={field.placeholder || ''}
                      style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: field.type === 'password' ? 'inherit' : 'inherit' }}
                    />
                  )}
                  {field.helpText && (
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{field.helpText}</div>
                  )}
                </div>
              ))}

              {/* Warning note on credential slide */}
              {currentSlide.warningNote && (
                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 12, color: '#d97706', lineHeight: 1.55 }}>
                  <IpWarning size={13} style={{ color: '#d97706', marginRight: 6, verticalAlign: 'middle' }} />
                  {currentSlide.warningNote}
                </div>
              )}

              {/* Test connection button + result */}
              {onTestConnection && (
                <div>
                  <button
                    onClick={handleTest}
                    disabled={testStatus === 'testing'}
                    style={{
                      padding: '9px 18px', borderRadius: 8,
                      border: `1px solid ${testStatus === 'success' ? 'rgba(34,197,94,0.5)' : testStatus === 'error' ? `${t.error}50` : t.border}`,
                      background: testStatus === 'success' ? 'rgba(34,197,94,0.08)' : 'transparent',
                      color: testStatus === 'success' ? t.success : testStatus === 'error' ? t.error : t.textSecondary,
                      fontSize: 13, fontWeight: 600, cursor: testStatus === 'testing' ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      transition: 'all 200ms',
                    }}
                  >
                    {testStatus === 'testing' ? (
                      <><span style={{ display: 'inline-block', width: 13, height: 13, borderRadius: '50%', border: `2px solid ${t.textMuted}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />Testing...</>
                    ) : testStatus === 'success' ? (
                      <><IpCheck size={14} />Connection verified</>
                    ) : (
                      '🔍 Test connection'
                    )}
                  </button>
                  {testDetail && (
                    <div style={{ marginTop: 8, padding: '9px 13px', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 8, background: testStatus === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${testStatus === 'success' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, color: testStatus === 'success' ? t.success : t.error, lineHeight: 1.5 }}>
                      {testStatus === 'success' ? <IpCheck size={13} style={{ flexShrink: 0, marginTop: 1 }} /> : <IpWarning size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
                      {testDetail}
                    </div>
                  )}
                </div>
              )}

              {/* Save error */}
              {saveError && (
                <div style={{ padding: '10px 13px', background: 'rgba(239,68,68,0.08)', border: `1px solid ${t.error}40`, borderRadius: 8, color: t.error, fontSize: 12 }}>
                  {saveError}
                  {saveError.includes('skip') && (
                    <button
                      onClick={() => handleSave(true)}
                      style={{ marginLeft: 10, fontWeight: 700, color: t.error, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}
                    >
                      Save anyway
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Navigation footer ── */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <button
            onClick={isFirst ? onClose : handleBack}
            style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {isFirst ? 'Cancel' : '← Back'}
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {isCredSlide ? (
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                style={{ padding: '9px 22px', background: accentColor, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'opacity 150ms' }}
              >
                {saving ? 'Saving...' : (isUpdate ? 'Update credentials' : 'Save & Connect')}
              </button>
            ) : (
              <button
                onClick={handleNext}
                style={{ padding: '9px 22px', background: accentColor, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Next →
              </button>
            )}
          </div>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
