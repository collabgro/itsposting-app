/**
 * ItsPosting — PostCore Suggestion Card Component
 * frontend/components/SuggestionCard.js
 *
 * Shown on the dashboard as the "Today from PostCore" banner.
 * Follows PostCore voice: WHY is always shown before the post preview.
 *
 * Props:
 *   suggestion  — row from content_suggestions table
 *   onUse       — function(id) called when "✅ Use This" is clicked
 *   onCustomize — function(id, caption) called when "✏️ Customize" is clicked
 *   onDismiss   — function(id) called when "✕ Skip" is clicked
 */

import { useState } from 'react';
import { useTheme } from '../lib/theme';
import {
  Sparkles,
  TrendingUp,
  AlertCircle,
  Flame,
  CheckCircle,
  Edit3,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Colour coding per suggestion type — matches CLAUDE.md spec
const TYPE_CONFIG = {
  seasonal: {
    icon: TrendingUp,
    label: 'Seasonal',
    accentColor: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  streak: {
    icon: Flame,
    label: 'Streak',
    accentColor: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  gap: {
    icon: AlertCircle,
    label: 'Content Balance',
    accentColor: '#EAB308',
    bgColor: 'rgba(234, 179, 8, 0.08)',
    borderColor: 'rgba(234, 179, 8, 0.25)',
  },
  milestone: {
    icon: Sparkles,
    label: 'Milestone',
    accentColor: '#7C5CFC',
    bgColor: 'rgba(124, 92, 252, 0.08)',
    borderColor: 'rgba(124, 92, 252, 0.25)',
  },
  trending: {
    icon: TrendingUp,
    label: 'Trending',
    accentColor: '#7C5CFC',
    bgColor: 'rgba(124, 92, 252, 0.08)',
    borderColor: 'rgba(124, 92, 252, 0.25)',
  },
};

export default function SuggestionCard({ suggestion, onUse, onCustomize, onDismiss }) {
  const { t } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);

  const config = TYPE_CONFIG[suggestion.suggestion_type] || TYPE_CONFIG.seasonal;
  const Icon = config.icon;

  const captionPreview = suggestion.pre_generated_caption
    ? suggestion.pre_generated_caption.substring(0, 140) + (suggestion.pre_generated_caption.length > 140 ? '...' : '')
    : '';

  const handleUse = async () => {
    setActing(true);
    await onUse(suggestion.id);
  };

  const handleCustomize = () => {
    onCustomize(suggestion.id, suggestion.pre_generated_caption);
  };

  const handleDismiss = async () => {
    setActing(true);
    await onDismiss(suggestion.id);
  };

  return (
    <div
      style={{
        background: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        borderLeft: `4px solid ${config.accentColor}`,
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 12,
        opacity: acting ? 0.5 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: config.accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={16} color="#fff" strokeWidth={2} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>
              {suggestion.title}
            </div>
            <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
              <span style={{ color: config.accentColor, fontWeight: 600 }}>💡 Suggested because: </span>
              {suggestion.reason}
            </div>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          disabled={acting}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: t.textMuted,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="Skip this suggestion"
        >
          <X size={14} />
        </button>
      </div>

      {/* Caption preview */}
      {suggestion.pre_generated_caption && (
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            fontSize: 13,
            color: t.textSecondary,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ready to post
          </div>

          <p style={{ margin: 0 }}>
            {expanded ? suggestion.pre_generated_caption : captionPreview}
          </p>

          {suggestion.pre_generated_caption.length > 140 && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 8,
                fontSize: 12,
                color: config.accentColor,
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {expanded ? (
                <><ChevronUp size={12} /> Show less</>
              ) : (
                <><ChevronDown size={12} /> Show full post</>
              )}
            </button>
          )}

          {suggestion.pre_generated_hashtags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              {suggestion.pre_generated_hashtags.slice(0, 6).map((tag, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: t.input,
                    color: t.textMuted,
                    border: `1px solid ${t.border}`,
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          onClick={handleUse}
          disabled={acting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: config.accentColor,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: acting ? 'not-allowed' : 'pointer',
            transition: 'opacity 150ms ease',
          }}
        >
          <CheckCircle size={14} strokeWidth={2.5} />
          Use This
        </button>

        <button
          onClick={handleCustomize}
          disabled={acting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: t.card,
            color: t.text,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: acting ? 'not-allowed' : 'pointer',
          }}
        >
          <Edit3 size={14} />
          Customize
        </button>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 10px',
            background: t.input,
            border: `1px solid ${t.border}`,
            borderRadius: 99,
            fontSize: 11,
            color: t.textMuted,
            fontWeight: 500,
          }}
        >
          {suggestion.platform === 'all' ? '📱 All platforms' : `📱 ${suggestion.platform}`}
        </div>
      </div>
    </div>
  );
}
