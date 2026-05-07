/**
 * TodaySuggestionBanner
 * Shows at the top of the dashboard when there is an active PostCore suggestion.
 * Dismissible. PostCore voice: WHY comes first.
 *
 * Props:
 *   suggestion  — row from GET /api/suggestions/today (or null)
 *   onDismiss() — called when × is clicked
 *   onView()    — called when "View Post" is clicked
 */

import { useState } from 'react';
import { useTheme } from '../lib/theme';
import { IpSparkle, IpClose, IpArrowRight } from './icons';

const TYPE_ACCENT = {
  seasonal:   '#3B82F6',
  streak:     '#22C55E',
  gap:        '#EAB308',
  content_gap:'#EAB308',
  milestone:  '#7C5CFC',
};

export default function TodaySuggestionBanner({ suggestion, onDismiss, onView }) {
  const { t } = useTheme();
  const [visible, setVisible] = useState(true);

  if (!suggestion || !visible) return null;

  const accent  = TYPE_ACCENT[suggestion.suggestion_type] || t.primary;
  const preview = suggestion.pre_generated_caption
    ? suggestion.pre_generated_caption.substring(0, 110) +
      (suggestion.pre_generated_caption.length > 110 ? '…' : '')
    : null;

  const handleDismiss = () => { setVisible(false); onDismiss?.(); };

  return (
    <div style={{
      background: t.card,
      border: `1px solid ${t.border}`,
      borderLeft: `4px solid ${accent}`,
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0, marginTop: 1,
        background: `${accent}18`, border: `1px solid ${accent}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IpSparkle size={15} color={accent} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
          PostCore · Today&apos;s suggestion
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4, lineHeight: 1.3 }}>
          {suggestion.title}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, marginBottom: preview ? 8 : 10 }}>
          <span style={{ color: accent, fontWeight: 600 }}>Suggested because: </span>
          {suggestion.reason}
        </div>
        {preview && (
          <div style={{
            fontSize: 12, color: t.textSecondary, fontStyle: 'italic', lineHeight: 1.55,
            padding: '8px 10px', background: t.input, border: `1px solid ${t.border}`,
            borderRadius: 8, marginBottom: 10,
          }}>
            {preview}
          </div>
        )}
        <button
          onClick={onView}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', background: accent, color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', transition: 'opacity 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          View Post <IpArrowRight size={12} color="#fff" />
        </button>
      </div>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        title="Dismiss suggestion"
        style={{
          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', color: t.textMuted,
          cursor: 'pointer', transition: 'background 150ms',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = t.cardHover)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <IpClose size={13} color={t.textMuted} />
      </button>
    </div>
  );
}
