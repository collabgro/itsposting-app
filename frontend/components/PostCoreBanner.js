import { useState, useEffect } from 'react';
import { useTheme } from '../lib/theme';
import { useBranding } from '../lib/branding';
import { suggestionsAPI } from '../lib/api';
import SuggestionCard from './SuggestionCard';
import { IpSparkle, IpRefresh, IpChevronDown, IpChevronUp } from './icons';

// onUsePost(caption)      — open ContentCreatorModal with caption pre-filled
// onCustomizePost(caption) — open ContentCreatorModal with caption, let user pick type
export default function PostCoreBanner({ onUsePost, onCustomizePost }) {
  const { t } = useTheme();
  const { aiName } = useBranding();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => { loadSuggestions(); }, []);

  const loadSuggestions = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await suggestionsAPI.getAll();
      const data = res.data?.suggestions || [];
      if (data.length === 0) {
        await generateFresh();
      } else {
        setSuggestions(data);
      }
    } catch (err) {
      console.error('[PostCoreBanner] load error:', err.message);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const generateFresh = async () => {
    setGenerating(true);
    setLoadFailed(false);
    try {
      const res = await suggestionsAPI.generate();
      setSuggestions(res.data?.suggestions || []);
    } catch (err) {
      console.error('[PostCoreBanner] generate error:', err.message);
      setLoadFailed(true);
    } finally {
      setGenerating(false);
    }
  };

  const handleUse = async (id) => {
    const suggestion = suggestions.find(s => s.id === id);
    try { await suggestionsAPI.use(id); } catch { /* non-critical */ }
    setSuggestions(prev => prev.filter(s => s.id !== id));
    if (suggestion && onUsePost) {
      // preGeneratedCaption is { caption, hashtags, imagePrompt }
      onUsePost(suggestion.preGeneratedCaption?.caption || '');
    }
  };

  const handleCustomize = (id, caption) => {
    if (onCustomizePost) onCustomizePost(caption);
  };

  const handleDismiss = async (id) => {
    try { await suggestionsAPI.dismiss(id); } catch { /* non-critical */ }
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  if (!loading && !generating && !loadFailed && suggestions.length === 0) {
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
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: collapsed ? 'none' : `1px solid ${t.border}`,
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IpSparkle size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Today from {aiName}</div>
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
              width: 32, height: 32, borderRadius: 8,
              background: t.input, border: `1px solid ${t.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: t.textMuted, cursor: generating ? 'not-allowed' : 'pointer',
            }}
            title="Refresh suggestions"
          >
            <IpRefresh size={14} style={{ animation: generating ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          <button
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: t.textMuted, cursor: 'pointer',
            }}
          >
            {collapsed ? <IpChevronDown size={16} /> : <IpChevronUp size={16} />}
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
                  style={{ height: 120, borderRadius: 12, background: t.input, animation: 'pulse 1.5s ease-in-out infinite' }}
                />
              ))}
            </div>
          ) : loadFailed && suggestions.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
              <span style={{ fontSize: 13, color: t.textMuted }}>Couldn't load suggestions.</span>
              <button
                onClick={loadSuggestions}
                style={{
                  fontSize: 13, fontWeight: 600, color: t.primary,
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                }}
              >
                Retry
              </button>
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
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
