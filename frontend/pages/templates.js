import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';
import { studioAPI, customerAPI } from '../lib/api';
import { IpPhotoStudio, IpClose, IpVideo, IpSparkle } from '../components/icons';
import { EmptyState } from '../components/ui';

const INDUSTRIES = ['all','plumbing','hvac','roofing','concrete','landscaping','electrical','painting','pest_control','cleaning','general_contractor'];
const INDUSTRY_LABELS = {
  all:'All', plumbing:'Plumbing', hvac:'HVAC', roofing:'Roofing', concrete:'Concrete',
  landscaping:'Landscaping', electrical:'Electrical', painting:'Painting',
  pest_control:'Pest Control', cleaning:'Cleaning', general_contractor:'General',
};
const CANVAS_SIZES = [
  { id:'ig_portrait', label:'Instagram Portrait', desc:'1080 × 1350 px — best for feed posts', icon:'📷' },
  { id:'ig_square',   label:'Instagram Square',   desc:'1080 × 1080 px — grid-friendly',      icon:'⬛' },
  { id:'ig_story',    label:'Instagram Story',    desc:'1080 × 1920 px — full screen',         icon:'📱' },
  { id:'fb_post',     label:'Facebook Post',      desc:'1200 × 630 px — landscape',            icon:'🖼️' },
  { id:'google_biz',  label:'Google Business',    desc:'720 × 720 px — square',                icon:'🔍' },
];

const CAT_ICONS = {
  'before-after':'◑', 'social-proof':'⭐', 'seasonal':'❄', 'educational':'💡',
  'promotional':'📣', 'team':'👥',
};

export default function TemplatesPage() {
  const router = useRouter();
  const { t } = useTheme();

  const [curatedTemplates,     setCuratedTemplates]     = useState([]);
  const [curatedLoading,       setCuratedLoading]       = useState(false);
  const [selectedIndustry,     setSelectedIndustry]     = useState('all');
  const [creations,            setCreations]            = useState([]);
  const [creationsLoading,     setCreationsLoading]     = useState(false);
  const [templateThumbs,       setTemplateThumbs]       = useState({});
  const [templatePexelsThumbs, setTemplatePexelsThumbs] = useState({});
  const [showSizePicker,       setShowSizePicker]       = useState(false);
  const [pickerSizeId,         setPickerSizeId]         = useState('ig_portrait');
  const [isAdmin,              setIsAdmin]              = useState(false);
  const [activeSection,        setActiveSection]        = useState('templates'); // 'templates' | 'mydesigns'

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    customerAPI.getProfile().then(r => setIsAdmin(!!r.data?.is_admin)).catch(() => {});
    loadCurated();
    loadCreations();
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadCurated = async (industry = 'all') => {
    setCuratedLoading(true);
    try {
      const { data } = await studioAPI.getTemplates(industry !== 'all' ? { industry, limit: 30 } : { limit: 30 });
      setCuratedTemplates(data?.templates || []);
    } catch { setCuratedTemplates([]); }
    finally { setCuratedLoading(false); }
  };

  const loadCreations = async () => {
    setCreationsLoading(true);
    try {
      const { data } = await studioAPI.getCreations({ limit: 50 });
      setCreations(Array.isArray(data) ? data : []);
    } catch { setCreations([]); }
    finally { setCreationsLoading(false); }
  };

  // Canvas-side thumbnail generation (skeletons while loading)
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!curatedTemplates.length) return;
    const needsThumbs = curatedTemplates.filter(tmpl => !tmpl.thumbnail_url && !templateThumbs[tmpl.id]);
    if (!needsThumbs.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 200; canvas.height = 250;
    const newThumbs = {};
    needsThumbs.forEach(tmpl => {
      const bg = tmpl.canvas_json?.pages?.[0]?.bgColor || '#1a1a2e';
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 200, 250);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(CAT_ICONS[tmpl.category] || '✦', 100, 100);
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      const words = (tmpl.name || '').split(' ');
      let line = ''; let y = 130;
      words.forEach(w => {
        const test = line + w + ' ';
        if (ctx.measureText(test).width > 170 && line) { ctx.fillText(line, 100, y); line = w + ' '; y += 16; }
        else { line = test; }
      });
      ctx.fillText(line, 100, y);
      newThumbs[tmpl.id] = canvas.toDataURL('image/png');
    });
    setTemplateThumbs(prev => ({ ...prev, ...newThumbs }));
  }, [curatedTemplates]);

  const handleIndustryFilter = (ind) => {
    setSelectedIndustry(ind);
    setCuratedTemplates([]);
    loadCurated(ind);
  };

  const inpStyle = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    background: t.input, border: `1px solid ${t.border}`,
    borderRadius: 10, color: t.text, fontSize: 13, outline: 'none',
    transition: 'border-color 140ms',
  };

  return (
    <Layout title="Templates" subtitle="Ready-made designs for every industry">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── Section tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: t.input, padding: 4, borderRadius: 12, width: isMobile ? '100%' : 'fit-content', border: `1px solid ${t.border}` }}>
        {[
          { id: 'templates',  label: 'ItsPosting Templates', icon: IpSparkle },
          { id: 'mydesigns',  label: 'My Designs',           icon: IpPhotoStudio },
        ].map(s => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center',
              padding: '8px 18px', borderRadius: 9, border: 'none',
              flex: isMobile ? 1 : undefined,
              background: active ? t.primary : 'transparent',
              color: active ? '#fff' : t.textMuted,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 150ms ease',
              boxShadow: active ? '0 2px 8px rgba(124,92,252,0.35)' : 'none',
            }}>
              <Icon size={14} /> {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Action bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        {activeSection === 'templates' ? (
          <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>
            Click any template to customise it with your branding
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>
            {creations.length > 0 ? `${creations.length} design${creations.length !== 1 ? 's' : ''} saved` : 'No designs yet'}
          </p>
        )}
        <button
          onClick={() => setShowSizePicker(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', background: t.primary, color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.35)',
            transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,92,252,0.45)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none';             e.currentTarget.style.boxShadow = '0 4px 14px rgba(124,92,252,0.35)'; }}
        >
          <IpPhotoStudio size={14} /> New Design
        </button>
      </div>

      {/* ── Templates section ── */}
      {activeSection === 'templates' && (
        <div>
          {/* Industry filter chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
            {INDUSTRIES.map(ind => (
              <button key={ind} onClick={() => handleIndustryFilter(ind)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: selectedIndustry === ind ? t.primary : t.input,
                color:      selectedIndustry === ind ? '#fff'     : t.textMuted,
                border:     `1px solid ${selectedIndustry === ind ? t.primary : t.border}`,
                cursor: 'pointer', transition: 'all 120ms ease',
              }}
              onMouseEnter={e => { if (selectedIndustry !== ind) { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.text; } }}
              onMouseLeave={e => { if (selectedIndustry !== ind) { e.currentTarget.style.borderColor = t.border;        e.currentTarget.style.color = t.textMuted; } }}
              >
                {INDUSTRY_LABELS[ind]}
              </button>
            ))}
          </div>

          {curatedLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: t.input, aspectRatio: '4/5', animation: `shimmer 1.4s ${i * 0.07}s ease-in-out infinite` }} />
              ))}
            </div>
          ) : curatedTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 16 }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🎨</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 8 }}>Templates coming soon</div>
              <div style={{ fontSize: 13, maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>ItsPosting is building industry-specific templates for your business. Check back soon!</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, paddingBottom: 60 }}>
              {curatedTemplates.map(tmpl => {
                const thumbSrc = tmpl.thumbnail_url || templatePexelsThumbs[tmpl.id] || templateThumbs[tmpl.id];
                const bgColor = tmpl.canvas_json?.pages?.[0]?.bgColor || '#1a1a2e';
                return (
                  <div
                    key={tmpl.id}
                    style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.card, cursor: 'pointer', position: 'relative', transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)'; e.currentTarget.style.boxShadow = t.shadowLg; e.currentTarget.querySelector('.tmpl-hover').style.opacity = '1'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.border;        e.currentTarget.style.transform = 'none';                            e.currentTarget.style.boxShadow = 'none';       e.currentTarget.querySelector('.tmpl-hover').style.opacity = '0'; }}
                  >
                    <div style={{ aspectRatio: '4/5', background: t.input, position: 'relative', overflow: 'hidden' }}>
                      {thumbSrc
                        ? <img src={thumbSrc} alt={tmpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', background: bgColor, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
                            <span style={{ fontSize: 28 }}>{CAT_ICONS[tmpl.category] || '✦'}</span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontWeight: 700, lineHeight: 1.4 }}>{tmpl.name}</span>
                          </div>
                      }
                      <div className="tmpl-hover" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms', gap: 10, flexDirection: 'column', backdropFilter: 'blur(2px)' }}>
                        <button
                          onClick={() => router.push(`/templates/editor?template=${tmpl.id}`)}
                          style={{ padding: '9px 22px', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 22, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.5)' }}
                        >
                          Use Template
                        </button>
                        {isAdmin && (
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/templates/editor?template=${tmpl.id}`); }}
                            style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 22, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                          >
                            ✏ Edit Template
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tmpl.name}</div>
                      {tmpl.category && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3, textTransform: 'capitalize' }}>{tmpl.category.replace(/-/g, ' ')}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── My Designs section ── */}
      {activeSection === 'mydesigns' && (
        <div>
          {creationsLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: t.input, aspectRatio: '4/5', animation: `shimmer 1.4s ${i * 0.1}s ease-in-out infinite` }} />
              ))}
            </div>
          ) : creations.length === 0 ? (
            <EmptyState
              icon={IpPhotoStudio}
              title="No designs yet"
              subtitle="Click 'New Design' above to create your first branded graphic"
              action={{ label: 'New Design', onClick: () => setShowSizePicker(true) }}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, paddingBottom: 60 }}>
              {creations.map(c => (
                <div
                  key={c.id}
                  style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.card, cursor: 'pointer', position: 'relative', transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = t.shadowLg; e.currentTarget.querySelector('.design-hover').style.opacity = '1'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.border;        e.currentTarget.style.transform = 'none';            e.currentTarget.style.boxShadow = 'none';       e.currentTarget.querySelector('.design-hover').style.opacity = '0'; }}
                >
                  {c.creation_type === 'video' ? (
                    <div style={{ position: 'relative', aspectRatio: '9/16', background: '#000', overflow: 'hidden' }}>
                      {c.output_url
                        ? <video src={c.output_url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 11 }}>{c.render_status === 'rendering' ? 'Rendering…' : 'Processing'}</div>
                      }
                      <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#fff', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <IpVideo size={10} /> Video
                      </div>
                    </div>
                  ) : (
                    <div style={{ aspectRatio: '4/5', overflow: 'hidden', position: 'relative' }}>
                      {c.output_url
                        ? <img src={c.output_url} alt={c.overlay_title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.input, fontSize: 11, color: t.textMuted }}>No preview</div>
                      }
                    </div>
                  )}
                  <div className="design-hover" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms', padding: 12, backdropFilter: 'blur(2px)' }}>
                    <button
                      onClick={() => router.push(c.creation_type === 'video' ? `/templates/editor?id=${c.id}&mode=video` : `/templates/editor?id=${c.id}`)}
                      style={{ width: '100%', padding: '9px 0', background: '#fff', color: '#111', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.overlay_title || 'Untitled'}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>{new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Size Picker Modal ── */}
      {showSizePicker && (
        <div onClick={() => setShowSizePicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'scaleIn 200ms cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>Choose a canvas size</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: t.textMuted }}>Select the platform you're designing for</p>
              </div>
              <button onClick={() => setShowSizePicker(false)} style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}>
                <IpClose size={15} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CANVAS_SIZES.map(size => (
                <label key={size.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, border: `2px solid ${pickerSizeId === size.id ? t.primary : t.border}`, background: pickerSizeId === size.id ? (t.isDark ? 'rgba(124,92,252,0.08)' : 'rgba(124,92,252,0.05)') : 'transparent', cursor: 'pointer', transition: 'all 120ms ease' }}>
                  <input type="radio" name="canvas-size" value={size.id} checked={pickerSizeId === size.id} onChange={() => setPickerSizeId(size.id)} style={{ display: 'none' }} />
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{size.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{size.label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{size.desc}</div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${pickerSizeId === size.id ? t.primary : t.border}`, background: pickerSizeId === size.id ? t.primary : 'transparent', flexShrink: 0, transition: 'all 120ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {pickerSizeId === size.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                </label>
              ))}
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <button
                onClick={() => { setShowSizePicker(false); router.push(`/templates/editor?size=${pickerSizeId}`); }}
                style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg,#7C5CFC,#9B7FFF)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,92,252,0.4)' }}
              >
                Start Designing →
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%,100% { opacity:0.5; } 50% { opacity:1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </Layout>
  );
}
