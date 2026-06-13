import { useState } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';
import { Button } from './ui';
import { IpClose, IpSparkle, IpPhoto, IpVideo, IpDrafts } from './icons';

// Credit cost icons per content type
const OPTION_META = {
  static:  { icon: IpDrafts, label: 'Text Card',    credits: 1,  color: '#34AADC', desc: 'Ready to post instantly — no image needed' },
  photo:   { icon: IpPhoto,  label: 'Photo Post',   credits: 3,  color: '#0A84FF', desc: 'AI creates the image for this post' },
  video:   { icon: IpVideo,  label: 'Animated Reel',credits: 10, color: '#7C5CFC', desc: '3 AI images crossfaded with music — ~45s to generate' },
};

const SEVERITY_STYLE = {
  critical: { bg: 'rgba(239,68,68,0.09)',   border: 'rgba(239,68,68,0.28)',   accent: '#ef4444', pill: 'rgba(239,68,68,0.18)' },
  high:     { bg: 'rgba(249,115,22,0.09)',  border: 'rgba(249,115,22,0.28)',  accent: '#f97316', pill: 'rgba(249,115,22,0.18)' },
  medium:   { bg: 'rgba(234,179,8,0.09)',   border: 'rgba(234,179,8,0.28)',   accent: '#eab308', pill: 'rgba(234,179,8,0.18)' },
};

function buildWizardUrl(alert, optionIndex, option) {
  const params = new URLSearchParams({
    source:      'weather_alert',
    alertId:     alert.id,
    optionIndex: optionIndex,
    contentType: option.contentType,
    topic:       option.wizardTopic || alert.headline || '',
    prefill:     encodeURIComponent((option.previewText || '').slice(0, 120)),
  });
  return `/wizard?${params.toString()}`;
}

export default function WeatherAlertBanner({ alert, onDismiss }) {
  const { t }      = useTheme();
  const router     = useRouter();
  const [hovered, setHovered]     = useState(null);
  const [dismissing, setDismissing] = useState(false);

  if (!alert) return null;

  const style    = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.medium;
  const options  = Array.isArray(alert.postOptions) ? alert.postOptions : [];
  if (!options.length) return null;

  const handleDismiss = async () => {
    setDismissing(true);
    onDismiss?.();
  };

  return (
    <div
      style={{
        background:   style.bg,
        border:       `1.5px solid ${style.border}`,
        borderRadius: 18,
        padding:      '18px 20px 16px',
        marginBottom: 24,
        position:     'relative',
        overflow:     'hidden',
      }}
    >
      {/* Corner glow */}
      <div style={{
        position: 'absolute', top: -50, right: -50, width: 180, height: 180,
        borderRadius: '50%', background: `${style.accent}18`, filter: 'blur(50px)', pointerEvents: 'none',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>
            {/* Icon derived from signal type */}
            {alert.signalType === 'freeze'      ? '🧊'
           : alert.signalType === 'cold_snap'   ? '🥶'
           : alert.signalType === 'heat_wave'   ? '🌡️'
           : alert.signalType === 'storm'       ? '⛈️'
           : alert.signalType === 'heavy_rain'  ? '🌧️'
           : alert.signalType === 'high_wind'   ? '💨'
           : alert.signalType === 'snow'        ? '❄️'
           :                                      '⚠️'}
          </span>
          <div>
            <div style={{
              fontSize: 14, fontWeight: 800, color: t.text, letterSpacing: '-0.02em', lineHeight: 1.2,
            }}>
              {alert.headline}
            </div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
              PostCore has 3 ready-to-post responses for {alert.city}
            </div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            background: style.pill, color: style.accent,
            borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
          }}>
            {alert.severity === 'critical' ? 'Post now' : alert.severity === 'high' ? 'Post today' : 'Opportunity'}
          </span>
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: t.textMuted, opacity: dismissing ? 0.4 : 0.7, flexShrink: 0,
            lineHeight: 1, borderRadius: 6, transition: 'opacity 150ms',
          }}
          title="Not relevant for me today"
        >
          <IpClose size={16} />
        </button>
      </div>

      {/* 3 post options */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 10,
      }}>
        {options.map((option, idx) => {
          const meta = OPTION_META[option.contentType] || OPTION_META.static;
          const Icon = meta.icon;
          const isHovered = hovered === idx;

          return (
            <div
              key={idx}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background:   isHovered ? `${meta.color}12` : (t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                border:       `1px solid ${isHovered ? `${meta.color}40` : (t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                borderRadius: 13, padding: '12px 14px 12px',
                display:      'flex', flexDirection: 'column', gap: 8,
                transition:   'all 180ms ease',
                cursor:       'pointer',
              }}
              onClick={() => router.push(buildWizardUrl(alert, idx, option))}
            >
              {/* Content type badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: `${meta.color}18`, borderRadius: 20,
                  padding: '3px 9px 3px 7px',
                }}>
                  <Icon size={12} color={meta.color} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: '0.02em' }}>
                    {meta.label}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
                  {meta.credits} credit{meta.credits !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Caption preview */}
              <div style={{
                fontSize: 12, color: t.text, lineHeight: 1.5,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {option.previewText || (option.caption || '').slice(0, 120)}
              </div>

              {/* Meta line */}
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 'auto', lineHeight: 1.3 }}>
                {meta.desc}
              </div>

              {/* Post Now button */}
              <button
                onClick={e => { e.stopPropagation(); router.push(buildWizardUrl(alert, idx, option)); }}
                style={{
                  background:   isHovered ? meta.color : 'transparent',
                  border:       `1.5px solid ${isHovered ? meta.color : `${meta.color}60`}`,
                  color:        isHovered ? '#fff' : meta.color,
                  borderRadius: 9, padding: '7px 12px', fontSize: 12, fontWeight: 700,
                  cursor:       'pointer', transition: 'all 160ms ease',
                  display:      'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  width:        '100%',
                }}
              >
                <IpSparkle size={11} color={isHovered ? '#fff' : meta.color} />
                Post this now
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 10, fontSize: 11, color: t.textMuted, textAlign: 'center',
      }}>
        Captions pre-written for your business by PostCore — click any option to review before posting
        &nbsp;·&nbsp;
        <span
          onClick={handleDismiss}
          style={{ cursor: 'pointer', textDecoration: 'underline', opacity: 0.7 }}
        >
          Not relevant today
        </span>
      </div>
    </div>
  );
}
