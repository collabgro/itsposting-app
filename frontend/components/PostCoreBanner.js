/**
 * ItsPosting — PostCore Dashboard Banner
 * frontend/components/PostCoreBanner.js
 *
 * The "Today from PostCore" section shown at the top of the dashboard.
 * Shows active suggestions. Generates them if none exist.
 *
 * Usage in dashboard.js:
 *   import PostCoreBanner from '../components/PostCoreBanner';
 *   <PostCoreBanner onUseCaption={(caption) => openWizardWithCaption(caption)} />
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';
import { suggestionsAPI } from '../lib/api';
import SuggestionCard from './SuggestionCard';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

export default function PostCoreBanner({ onUseCaption }) {
  const { t } = useTheme();
  const router = useRouter();

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const res = await suggestionsAPI.getAll();
      const data = res.data;

      if (data.length === 0) {
        await generateFresh();
      } else {
        setSuggestions(data);
      }
    } catch (err) {
      console.error('[PostCoreBanner] load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateFresh = async () => {
    setGenerating(true);
    try {
      const res = await suggestionsAPI.generate();
      setSuggestions(res.data.suggestions || []);
    } catch (err) {
      console.error('[PostCoreBanner] generate error:', err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleUse = async (id) => {
    try {
      await suggestionsAPI.use(id);
      const suggestion = suggestions.find(s => s.id === id);
      if (suggestion && onUseCaption) {
        sessionStorage.setItem('postcore_caption', suggestion.pre_generated_caption);
        sessionStorage.setItem('postcore_hashtags', JSON.stringify(suggestion.pre_generated_hashtags || []));
        router.push('/upload?source=postcore');
      }
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('[PostCoreBanner] use error:', err.message);
    }
  };

  const handleCustomize = (id, caption) => {
    sessionStorage.setItem('postcore_caption', caption);
    router.push('/upload?source=postcore&mode=customize');
  };

  const handleDismiss = async (id) => {
    try {
      await suggestionsAPI.dismiss(id);
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('[PostCoreBanner] dismiss error:', err.message);
    }
  };

  if (!loading && !generating && suggestions.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        marginBottom: 24,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: collapsed ? 'none' : `1px solid ${t.border}`,
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Today from PostCore</div>
            <div style={{ fontSize: 12, color: t.textMuted }}>
              {loading || generating
                ? 'Analysing your account...'
                : `${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''} ready`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); generateFresh(); }}
            disabled={generating}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: t.input,
              border: `1px solid ${t.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.textMuted,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
            title="Refresh suggestions"
          >
            <RefreshCw size={14} style={{ animation: generating ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          <button
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.textMuted,
              cursor: 'pointer',
            }}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Suggestions list */}
      {!collapsed && (
        <div style={{ padding: '16px 20px' }}>
          {(loading || generating) && suggestions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2].map(i => (
                <div
                  key={i}
                  style={{
                    height: 120,
                    borderRadius: 12,
                    background: t.input,
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          ) : (
            suggestions.map(suggestion => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onUse={handleUse}
                onCustomize={handleCustomize}
                onDismiss={handleDismiss}
              />
            ))
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
