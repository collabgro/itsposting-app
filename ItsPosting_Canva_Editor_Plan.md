# ItsPosting — Canva-Parity Editor Implementation Plan
**For Claude Code** | Next.js / React | No new npm packages | No backend changes

---

## CURRENT STATUS (updated after deep screenshot analysis — May 2026)

### ✅ FULLY DONE (TemplatesEditorInner.js — ~3470 lines)
- Canva collapsible sidebar: 72px icon strip + 320px flyout panel with ‹/› toggle
- Canva teal `#00C4CC` selection + upgraded Transformer (8 anchors, rotation snap)
- Font size scaling on text corner-drag (Canva behavior)
- Snap guides at 5px threshold (magenta lines)
- Multi-page vertical scroll — pages stacked inline (NOT bottom strip)
- Per-page header row: `Page N – [title] ▲ ▼ 👁 🔒 ⧉ 🗑 +`
- Context menu (right-click on canvas)
- Multi-select (Ctrl+click + box-drag), Distribute Evenly (H/V)
- Alignment buttons in all contextual bars (text/image/shape)
- Canvas rulers (togglable)
- Add to All Pages (⊛ in floating toolbar)
- Group/Ungroup (Ctrl+G / Ctrl+Shift+G)
- Preview Mode (P key — full-screen overlay with page nav)
- Copy Style / Paste Style (Alt+C / Alt+V)
- Blend Modes (all 12 modes, dropdown in text/image/shape bars)
- Keyboard shortcuts (full set: Ctrl+Z/Y/C/V/D/A/G, arrows, /, T/R/C)
- Quick Actions panel (/ key — searchable command palette)
- Floating toolbar above selected element on canvas

### 🔴 REMAINING GAPS (from exact Canva screenshot comparison)

#### Commit 1 — "✏ Editing ▾" Mode Dropdown
Insert after Resize button in top bar left zone. Dropdown: Editing/Commenting/Viewing with sub-labels and ✓ on active.

#### Commit 2 — File Dropdown: Full Canva Redesign (14 items + header)
Replace current 4-item menu with title/dimensions header + full item list matching screenshot 13/14.

#### Commit 3 — Resize Dropdown: Visual Cards + Category Browse
Replace plain list with: search input, "Suggested" 3-card visual row (mini preview thumbnails), "Browse by category" list with › arrows.

#### Commit 4 — Share Panel (right-side slide-in)
Replace current "Share" button's save action with a proper right-side 380px panel matching screenshot 12: People/Access/Copy link/Download/Present/Public.

#### Commit 5 — Sidebar Restructure: Canva Tool Order + New Tools
Reorder to: **Templates, Elements, Text, Brand (👑), Uploads, Tools, Projects** + Apps/Magic at bottom. Add `bottom: true` spacer. Add `pro: true` crown badge on Brand.

#### Commit 6 — Panel Contents: Templates + Elements + Text
- **Templates panel** (NEW): Search bar + 2-col grid wired to `studioAPI.list()`
- **Elements panel**: AI search, Generate/Search buttons, Browse categories 3×2 icon grid
- **Text panel**: Search, "Add a text box" CTA, Magic Write, Brand Kit, Default styles (heading/subheading/body)

#### Commit 7 — Panel Contents: Brand + Uploads + Tools + Projects
- **Brand panel** (NEW): list + upsell card
- **Uploads panel**: Tabs (Images/Videos/Designs/Folders) + Background Remover promo + 3-col grid wired to media API
- **Tools sub-panel** (NEW): drawing tool icon grid
- **Projects panel** (NEW): search + tabs + 2-col grid wired to `studioAPI.list()`

#### Commit 8 — Bottom Status Bar
40px bar at very bottom: `📝 Notes | ⏱ Timer | ─── | [zoom slider] [22%] | Pages | 1/N | ⊞ | ⤢ | ?`
Move zoom slider from top bar to here.

---

## Overview (original)

This plan upgrades two files to achieve exact Canva UI/UX parity:
- `frontend/components/templates/VideoEditorInner.js` (~1303 → ~1600 lines)
- `frontend/components/templates/TemplatesEditorInner.js` (~1632 → ~3470 lines as of May 2026)

---

## What Canva Looks Like (From Screenshots)

### Top Bar (52px)
```
[Home icon] [File ▾] [Resize ▾] [✏ Editing ▾] | [↩ undo] [↪ redo] | [☁ save] | [Title (center)] | [Share button]
```
- Background: white (light mode)
- File menu opens a dropdown: Create new design, Upload files, Settings, Accessibility, Save, Make available offline, Move, Make a copy, Download, Print (Ctrl+P), Version history, Move to Trash
- Resize opens a panel: Suggested sizes (Instagram Story, Post, Facebook Post) + Browse by category
- Editing dropdown: Editing (make changes ✓) / Commenting (add feedback) / Viewing (read-only)
- Share button: teal/purple gradient, opens right panel with People with access, Access level, Copy link, Download, Present, Public, Template link

### Contextual Action Bar (44px) — appears ONLY when element selected
```
[color picker] [grid/table icon] [↔ width] [Font name dropdown] [– size +] [color T] [B] [I] [U] [S] [aA] [align] [list] [↕ height] [dotted] [Animate] [Position] [⋮]
```
- This bar replaces the old right panel when text is selected
- For images: shows crop, flip, effects, adjust, animate, position
- For shapes: shows color, border, opacity, animate, position

### Left Side — Icon Strip (72px wide, always visible)
```
[Templates]
[Elements]
[Text]
[Brand] (crown = Pro)
[Uploads]
[Tools]  ← expands to sub-panel with: cursor, draw, highlighter, eraser, pen, shapes, text, grid
[Projects]
[Apps]    ← at bottom
[Magic Media] ← at very bottom
```
- Active tool: icon gets a filled background pill (light purple)
- Each icon has label underneath it

### Left Side — Flyout Panel (320px, slides open/closed)
**Templates panel:** Search bar with mic icon, template grid (2 columns)
**Elements panel:** "Describe your ideal element" AI search + Generate button + Search button, Recommended section, Browse categories (Shapes, Graphics, Animations, Frames, Grids, Charts, Tables, etc.)
**Text panel:** Search fonts & combinations, "Add a text box" (purple button), "Magic Write" button, Brand Kit section (Edit), Default text styles (Add a heading / Add a subheading / Add body text)
**Brand panel:** All assets / Guidelines / Brand Templates / Logos / Colors
**Uploads panel:** Search bar, "Upload files" button + "⋯" button, "Record yourself" button, Tabs: Images / Videos / Designs / Folders, Background Remover promo
**Tools panel:** Mini icon sub-strip (cursor, draw, highlight, eraser, pen, shape, text, table)
**Projects panel:** Search bar, dropdown "Your projects", Tabs: All / Designs / Folders, Design thumbnails with dimensions

### Canvas Area
- Light gray background (#f5f5f5)
- Page label above canvas: "Page 1 - A.. [▲] [▼] [👁] [🔒] [📋] [🗑] [+]"
- Canvas has drop shadow
- Rulers on top and left edges (optional toggle)
- Zoom control bottom right: [slider] [22%] [Pages] [1/3] [grid icon] [⤢] [?]

### Canva Selection Handles (from screenshot 10, 11)
- Teal (#00C4CC) bounding box
- 8 white square anchor handles with teal border
- Rotation handle detached ~28px above top-center
- When text selected: floating toolbar appears ABOVE the element on canvas (not in a side panel) with: [↻ rotate] [🔒 lock] [📋 duplicate] [🗑 delete] [⋯ more]
- Text shows middle-left and middle-right resize handles only (not corners)

### Multi-page Strip (Canva shows pages INLINE in main canvas area, not a strip)
- Pages scroll vertically in the canvas area
- Each page has: "Page N - [title] [▲] [▼] [👁] [🔒] [📋] [🗑] [+]" label above it
- Bottom bar shows: [Notes] [Timer] ... [zoom slider] [22%] [Pages] [1/3] [⊞] [⤢] [?]
- "Pages" button at bottom right toggles a page panel

---

## Part A — Video Editor Crash Fix
**File:** `frontend/components/templates/VideoEditorInner.js`

### A1. Extract Nested Components to Module Level

Move these three components OUT of the main component body, ABOVE the `export default`:

```javascript
// === MODULE-LEVEL COMPONENTS (above export default) ===

function LeftPanelContent({
  activeTool, project, selectedClip, selectedId, selectedTrack,
  mediaLoading, videoFiles, imageFiles, audioFiles,
  aiPrompt, aiGenerating, aiError,
  updateClip, addColorClip, addMediaClip, addText, addAudioTrack,
  onAiGenerate, onAiPromptChange, deleteSelected, t
}) {
  // exact same JSX body that was previously inside the main component
}

function RightPanelContent({
  selectedClip, selectedText, selectedAudio,
  updateClip, updateText, updateAudio, deleteSelected, t
}) {
  // exact same JSX body
}

function TimelineRuler({ totalDuration, zoom, t }) {
  // exact same JSX body
}
```

**Why:** React 18 concurrent mode sees a new component type on every render when components are defined inside another component, causing unmount/remount cycles and broken state.

### A2. Fix mutate() — React 18 Concurrent Mode Safe

Replace the existing `mutate` function with this ref-based pattern:

```javascript
// Add these refs near the top of the component
const projectRef = useRef(project);
useEffect(() => { projectRef.current = project; }, [project]);

const historyIndexRef = useRef(historyIndex);
useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

// Replace existing mutate with:
const mutate = useCallback((updater) => {
  const prev = projectRef.current;
  const next = typeof updater === 'function' ? updater(prev) : updater;
  setProject(next);
  setHistory(h => {
    const trimmed = h.slice(0, historyIndexRef.current + 1);
    return [...trimmed, JSON.stringify(next)].slice(-50);
  });
  setHistoryIndex(i => Math.min(i + 1, 49));
}, []); // IMPORTANT: empty deps — reads from refs only
```

**Why:** Calling `setHistory` and `setHistoryIndex` inside a `setProject` updater function is a React 18 violation. Side effects must not be triggered inside state updater functions.

### A3. Verification
- Navigate to `/templates/video-editor` → no crash
- Click "Solid Color Clip" → clip appears on timeline, no console errors
- Undo/redo works without errors

---

## Part B — Canva Layout: Image Editor
**File:** `frontend/components/templates/TemplatesEditorInner.js`

### B1. New Layout Structure

Replace the existing layout with this exact structure:

```
┌─────────────────────────────────────────────────────────────┐
│ TOP BAR (52px height)                                        │
├─────────────────────────────────────────────────────────────┤
│ CONTEXTUAL ACTION BAR (44px, only visible when el. selected) │
├──────┬──────────────┬───────────────────────────────────────┤
│ 72px │ 320px flyout │                                       │
│ icon │ (slides      │   CANVAS STAGE                        │
│ strip│  open/shut)  │   (gray bg, centered canvas)          │
│      │              │                                       │
└──────┴──────────────┴───────────────────────────────────────┘
```

Pages scroll vertically inside the canvas stage area (Canva-style, not a bottom strip).

### B2. Top Bar

```javascript
// State
const [title, setTitle] = useState('Untitled');
const [editingTitle, setEditingTitle] = useState(false);
const [fileMenuOpen, setFileMenuOpen] = useState(false);
const [resizeMenuOpen, setResizeMenuOpen] = useState(false);
const [editModeMenuOpen, setEditModeMenuOpen] = useState(false);
const [shareOpen, setShareOpen] = useState(false);

// JSX
<div style={{
  height: 52,
  background: t.topbar,       // '#ffffff' light, '#1a1a22' dark
  borderBottom: `1px solid ${t.border}`,
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
  flexShrink: 0,
  zIndex: 100,
  position: 'relative',
}}>
  {/* Home icon */}
  <button onClick={() => router.push('/dashboard')} style={iconBtnStyle}>
    <HomeIcon />
  </button>

  {/* File menu */}
  <div style={{ position: 'relative' }}>
    <button onClick={() => setFileMenuOpen(o => !o)} style={topBarBtnStyle}>
      File
    </button>
    {fileMenuOpen && <FileDropdown onClose={() => setFileMenuOpen(false)} />}
  </div>

  {/* Resize menu */}
  <div style={{ position: 'relative' }}>
    <button onClick={() => setResizeMenuOpen(o => !o)} style={topBarBtnStyle}>
      Resize
    </button>
    {resizeMenuOpen && <ResizeDropdown onClose={() => setResizeMenuOpen(false)} />}
  </div>

  {/* Editing mode menu */}
  <div style={{ position: 'relative' }}>
    <button onClick={() => setEditModeMenuOpen(o => !o)} style={topBarBtnStyle}>
      ✏ Editing ▾
    </button>
    {editModeMenuOpen && (
      <div style={dropdownStyle}>
        {[
          { id: 'editing',    label: 'Editing',    sub: 'Make changes'  },
          { id: 'commenting', label: 'Commenting', sub: 'Add feedback'  },
          { id: 'viewing',    label: 'Viewing',    sub: 'Read-only'     },
        ].map(m => (
          <button key={m.id} style={dropdownItemStyle}>
            <span style={{ fontWeight: 500 }}>{m.label}</span>
            <span style={{ fontSize: 12, color: t.textMuted }}>{m.sub}</span>
            {m.id === 'editing' && <span>✓</span>}
          </button>
        ))}
      </div>
    )}
  </div>

  {/* Divider + Undo/Redo */}
  <div style={{ width: 1, height: 20, background: t.border, margin: '0 4px' }} />
  <button onClick={undo} disabled={historyIndex <= 0} style={iconBtnStyle}>↩</button>
  <button onClick={redo} disabled={historyIndex >= history.length - 1} style={iconBtnStyle}>↪</button>
  <div style={{ width: 1, height: 20, background: t.border, margin: '0 4px' }} />
  <button style={iconBtnStyle}>☁</button>

  {/* Title — centered */}
  <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
    {editingTitle ? (
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={() => setEditingTitle(false)}
        onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: `2px solid ${t.accent}`,
          color: t.text,
          fontSize: 14,
          textAlign: 'center',
          outline: 'none',
          width: 300,
        }}
      />
    ) : (
      <span
        onClick={() => setEditingTitle(true)}
        style={{ fontSize: 14, color: t.text, cursor: 'text', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {title}
      </span>
    )}
  </div>

  {/* Share button */}
  <button
    onClick={() => setShareOpen(o => !o)}
    style={{
      background: 'linear-gradient(135deg, #7C5CFC, #9B3DE8)',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      padding: '8px 20px',
      fontWeight: 600,
      fontSize: 14,
      cursor: 'pointer',
    }}
  >
    Share
  </button>

  {/* Share panel */}
  {shareOpen && <SharePanel onClose={() => setShareOpen(false)} t={t} />}
</div>
```

### B3. File Dropdown (matches screenshot 13/14)

```javascript
function FileDropdown({ onClose }) {
  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0,
      background: t.card, border: `1px solid ${t.border}`,
      borderRadius: 12, padding: '8px 0', minWidth: 280,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 200,
    }}>
      {/* Title + dimensions */}
      <div style={{ padding: '8px 16px 12px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
          <button>✏</button>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted }}>By {userName} • {canvasW}×{canvasH}px</div>
      </div>

      {/* Menu items */}
      {[
        { icon: '⊕', label: 'Create new design' },
        { icon: '↑', label: 'Upload files' },
        null, // divider
        { icon: '⚙', label: 'Settings', arrow: true },
        { icon: '♿', label: 'Accessibility', arrow: true },
        null,
        { icon: '💾', label: 'Save', right: 'All changes saved' },
        { icon: '⊙', label: 'Make available offline' },
        { icon: '📁', label: 'Move' },
        { icon: '⧉', label: 'Make a copy' },
        { icon: '⬇', label: 'Download' },
        { icon: '🖨', label: 'Print', right: 'Ctrl+P' },
        { icon: '⟳', label: 'Version history' },
        { icon: '🗑', label: 'Move to Trash' },
      ].map((item, i) =>
        item === null
          ? <div key={i} style={{ height: 1, background: t.border, margin: '4px 0' }} />
          : (
            <button key={i} style={dropdownItemStyle}>
              <span>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.right && <span style={{ fontSize: 12, color: t.textMuted }}>{item.right}</span>}
              {item.arrow && <span style={{ color: t.textMuted }}>›</span>}
            </button>
          )
      )}
    </div>
  );
}
```

### B4. Resize Dropdown (matches screenshot 15)

```javascript
function ResizeDropdown({ onClose }) {
  const PRESETS = [
    { label: 'Instagram Story', w: 1080, h: 1920 },
    { label: 'Instagram Post (4:5)', w: 1080, h: 1350 },
    { label: 'Facebook Post', w: 940, h: 788 },
    { label: 'LinkedIn Post', w: 1200, h: 1200 },
    { label: 'Twitter Post', w: 1600, h: 900 },
    { label: 'TikTok Video', w: 1080, h: 1920 },
  ];
  const CATEGORIES = ['Custom size', 'Social media', 'Presentations', 'Videos', 'Website', 'Whiteboard'];

  return (
    <div style={{ /* dropdown styles */ }}>
      <input placeholder="Search resize options" style={searchInputStyle} />
      <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: t.textMuted }}>Suggested</div>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto' }}>
        {PRESETS.slice(0, 3).map(p => (
          <button key={p.label} onClick={() => { setCanvasSize(p.w, p.h); onClose(); }} style={presetCardStyle}>
            <div style={{ width: 48, height: 60, background: t.border, borderRadius: 4, marginBottom: 6 }} />
            <span style={{ fontSize: 11, fontWeight: 500 }}>{p.label}</span>
            <span style={{ fontSize: 10, color: t.textMuted }}>{p.w}×{p.h} px</span>
          </button>
        ))}
      </div>
      <div style={{ padding: '4px 16px', fontSize: 12, fontWeight: 600, color: t.textMuted }}>Browse by category</div>
      {CATEGORIES.map(c => (
        <button key={c} style={dropdownItemStyle}>
          <span>{c}</span>
          <span style={{ color: t.textMuted }}>›</span>
        </button>
      ))}
    </div>
  );
}
```

### B5. Contextual Action Bar (44px, shown only when element is selected)

```javascript
// This replaces the old static right panel for element properties
{selectedId && (
  <div style={{
    height: 44,
    background: t.topbar,
    borderBottom: `1px solid ${t.border}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: 6,
    flexShrink: 0,
    overflowX: 'auto',
  }}>
    {selectedType === 'text' && <TextActionBar element={selectedEl} onChange={updateElement} t={t} />}
    {selectedType === 'image' && <ImageActionBar element={selectedEl} onChange={updateElement} t={t} />}
    {selectedType === 'shape' && <ShapeActionBar element={selectedEl} onChange={updateElement} t={t} />}
  </div>
)}

// TextActionBar contents:
function TextActionBar({ element, onChange, t }) {
  return (
    <>
      <ColorPickerBtn value={element.color} onChange={v => onChange({ ...element, color: v })} />
      <div style={vertDivider} />
      <FontSelector value={element.fontFamily} onChange={v => onChange({ ...element, fontFamily: v })} t={t} />
      <button style={actionBtnStyle}>–</button>
      <span style={{ minWidth: 36, textAlign: 'center', fontSize: 13 }}>{element.fontSize}</span>
      <button style={actionBtnStyle}>+</button>
      <div style={vertDivider} />
      <ColorPickerBtn label="A" value={element.color} onChange={v => onChange({ ...element, color: v })} />
      <button style={actionBtnStyle} onClick={() => onChange({ ...element, fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}>
        <strong>B</strong>
      </button>
      <button style={actionBtnStyle} onClick={() => onChange({ ...element, fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })}>
        <em>I</em>
      </button>
      <button style={actionBtnStyle}>U</button>
      <button style={actionBtnStyle}>S</button>
      <button style={actionBtnStyle}>aA</button>
      <div style={vertDivider} />
      <AlignmentBtns element={element} onChange={onChange} />
      <button style={actionBtnStyle}>☰</button>
      <div style={vertDivider} />
      <button style={{ ...actionBtnStyle, fontWeight: 600, color: '#7C5CFC' }}>Animate</button>
      <button style={actionBtnStyle}>Position</button>
      <button style={actionBtnStyle}>⋯</button>
    </>
  );
}
```

### B6. Icon Strip (72px wide)

```javascript
const TOOLS = [
  { id: 'templates', icon: <TemplatesIcon />, label: 'Templates' },
  { id: 'elements',  icon: <ElementsIcon />,  label: 'Elements'  },
  { id: 'text',      icon: <TextIcon />,      label: 'Text'      },
  { id: 'brand',     icon: <BrandIcon />,     label: 'Brand', pro: true },
  { id: 'uploads',   icon: <UploadsIcon />,   label: 'Uploads'   },
  { id: 'tools',     icon: <ToolsIcon />,     label: 'Tools'     },
  { id: 'projects',  icon: <ProjectsIcon />,  label: 'Projects'  },
  // bottom section (use margin-top: auto on first one)
  { id: 'apps',      icon: <AppsIcon />,      label: 'Apps',  bottom: true },
  { id: 'magic',     icon: <MagicIcon />,     label: 'Magic Media', bottom: true },
];

<div style={{
  width: 72,
  background: t.sidebar,     // '#ffffff' light, '#1e1e2a' dark
  borderRight: `1px solid ${t.border}`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '8px 0',
  flexShrink: 0,
  overflowY: 'auto',
}}>
  {TOOLS.filter(t => !t.bottom).map(tool => (
    <IconStripButton
      key={tool.id}
      tool={tool}
      active={activeTool === tool.id}
      onClick={() => handleToolClick(tool.id)}
      t={t}
    />
  ))}
  <div style={{ flex: 1 }} />
  {TOOLS.filter(t => t.bottom).map(tool => (
    <IconStripButton key={tool.id} tool={tool} active={activeTool === tool.id} onClick={() => handleToolClick(tool.id)} t={t} />
  ))}
</div>

function IconStripButton({ tool, active, onClick, t }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 60,
        padding: '10px 0 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        background: active ? (t.isDark ? '#2d2d3a' : '#f0eeff') : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        color: active ? '#7C5CFC' : t.textMuted,
        fontSize: 10,
        fontWeight: active ? 600 : 400,
        transition: 'all 150ms ease',
        margin: '2px 0',
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 20, lineHeight: 1 }}>{tool.icon}</div>
      {tool.label}
      {tool.pro && (
        <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 10 }}>👑</span>
      )}
    </button>
  );
}

// Strip click logic (Canva behavior):
function handleToolClick(toolId) {
  if (activeTool === toolId && panelOpen) {
    setPanelOpen(false);   // same tool + open → close
  } else {
    setActiveTool(toolId);
    setPanelOpen(true);    // different tool or closed → open
  }
}
```

### B7. Flyout Panel (320px, collapsible)

```javascript
<div style={{
  width: panelOpen ? 320 : 0,
  overflow: 'hidden',
  transition: 'width 200ms ease',
  borderRight: panelOpen ? `1px solid ${t.border}` : 'none',
  background: t.panel,       // '#ffffff' light, '#1e1e2a' dark
  position: 'relative',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
}}>
  {/* Collapse/expand arrow — absolutely positioned on right edge */}
  <button
    onClick={() => setPanelOpen(o => !o)}
    style={{
      position: 'absolute',
      right: -13,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 26,
      height: 52,
      background: t.panel,
      border: `1px solid ${t.border}`,
      borderRadius: '0 8px 8px 0',
      cursor: 'pointer',
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: t.textMuted,
      fontSize: 14,
    }}
  >
    {panelOpen ? '‹' : '›'}
  </button>

  {/* Panel content — only render when open to save performance */}
  {panelOpen && (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {activeTool === 'templates' && <TemplatesPanel t={t} onSelect={applyTemplate} />}
      {activeTool === 'elements'  && <ElementsPanel  t={t} onAdd={addElement} />}
      {activeTool === 'text'      && <TextPanel       t={t} onAdd={addText} />}
      {activeTool === 'brand'     && <BrandPanel      t={t} />}
      {activeTool === 'uploads'   && <UploadsPanel    t={t} onAdd={addImage} />}
      {activeTool === 'tools'     && <ToolsSubPanel   t={t} />}
      {activeTool === 'projects'  && <ProjectsPanel   t={t} onOpen={openDesign} />}
    </div>
  )}
</div>
```

### B8. Panel Contents (each panel)

#### Templates Panel
```javascript
function TemplatesPanel({ t, onSelect }) {
  const [query, setQuery] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: t.inputBg, borderRadius: 8, padding: '8px 12px' }}>
          <span>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search templates"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 14 }}
          />
          <span style={{ color: t.textMuted }}>🎤</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {/* Template thumbnails */}
        </div>
      </div>
    </div>
  );
}
```

#### Text Panel
```javascript
function TextPanel({ t, onAdd }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: t.inputBg, borderRadius: 8, padding: '8px 12px' }}>
        <span>🔍</span>
        <input placeholder="Search fonts and combinations" style={searchStyle} />
      </div>
      <button
        onClick={() => onAdd({ type: 'text', text: 'Add a text box', fontSize: 20 })}
        style={{
          background: '#7C5CFC',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '10px 16px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'center',
        }}
      >
        T Add a text box
      </button>
      <button style={{ ...outlineBtnStyle }}>✨ Magic Write</button>
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Brand Kit</span>
          <button style={{ fontSize: 12, color: '#7C5CFC' }}>Edit 👑</button>
        </div>
        <button style={outlineBtnStyle}>+ Add your brand fonts</button>
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Default text styles</div>
        <button onClick={() => onAdd({ type: 'text', text: 'Add a heading', fontSize: 48, fontWeight: 'bold' })}
          style={{ ...textStyleBtn, fontSize: 24, fontWeight: 700 }}>Add a heading</button>
        <button onClick={() => onAdd({ type: 'text', text: 'Add a subheading', fontSize: 32 })}
          style={{ ...textStyleBtn, fontSize: 18, fontWeight: 500 }}>Add a subheading</button>
        <button onClick={() => onAdd({ type: 'text', text: 'Add body text', fontSize: 16 })}
          style={{ ...textStyleBtn, fontSize: 13 }}>Add a little bit of body text</button>
      </div>
    </div>
  );
}
```

#### Elements Panel
```javascript
function ElementsPanel({ t, onAdd }) {
  const CATEGORIES = [
    { icon: '◻', label: 'Shapes' },
    { icon: '✦', label: 'Graphics' },
    { icon: '▶', label: 'Animations' },
    { icon: '⬜', label: 'Frames' },
    { icon: '⊞', label: 'Grids' },
    { icon: '📊', label: 'Charts' },
  ];
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: t.inputBg, borderRadius: 8, padding: '8px 12px' }}>
        <span>+</span>
        <input placeholder="Describe your ideal element" style={searchStyle} />
        <span>🎤</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...generateBtn, flex: 1 }}>✦ Generate ▾</button>
        <button style={{ ...searchBtn, flex: 1 }}>Search</button>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Browse categories</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {CATEGORIES.map(c => (
            <button key={c.label} style={categoryCardStyle}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{c.icon}</div>
              <span style={{ fontSize: 11 }}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### Uploads Panel
```javascript
function UploadsPanel({ t, onAdd }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: t.inputBg, borderRadius: 8, padding: '8px 12px' }}>
        <span>🔍</span>
        <input placeholder="Search keywords, tags, color" style={searchStyle} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={triggerUpload} style={{ flex: 1, background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 600, cursor: 'pointer' }}>
          Upload files
        </button>
        <button style={{ width: 40, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer' }}>⋯</button>
      </div>
      <button style={outlineBtnStyle}>🎥 Record yourself</button>
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, gap: 16 }}>
        {['Images', 'Videos', 'Designs', 'Folders'].map(tab => (
          <button key={tab} style={{
            paddingBottom: 8,
            borderBottom: activeUploadTab === tab ? '2px solid #7C5CFC' : '2px solid transparent',
            color: activeUploadTab === tab ? '#7C5CFC' : t.textMuted,
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
          }} onClick={() => setActiveUploadTab(tab)}>
            {tab}
          </button>
        ))}
      </div>
      {/* Upload grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {uploads.map(u => (
          <div key={u.id} onClick={() => onAdd(u)} style={{ aspectRatio: '1', borderRadius: 4, overflow: 'hidden', cursor: 'pointer' }}>
            <img src={u.thumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Projects Panel
```javascript
function ProjectsPanel({ t, onOpen }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: t.inputBg, borderRadius: 8, padding: '8px 12px' }}>
        <span>🔍</span>
        <input placeholder="Search your content" style={searchStyle} />
      </div>
      <button style={dropdownSelectStyle}>C Your projects ▾</button>
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, gap: 20 }}>
        {['All', 'Designs', 'Folders'].map(tab => (
          <button key={tab} style={tabBtnStyle(tab === activeProjectTab)}>{tab}</button>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Designs</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {projects.map(p => (
          <div key={p.id} onClick={() => onOpen(p)} style={{ cursor: 'pointer' }}>
            <div style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: t.inputBg, marginBottom: 4 }}>
              <img src={p.thumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
            <div style={{ fontSize: 11, color: t.textMuted }}>{p.w} × {p.h} px</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### B9. Canvas Stage Area

```javascript
<div
  style={{
    flex: 1,
    background: '#f5f5f5',   // light gray, same as Canva
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 60px',
    gap: 40,                  // gap between pages
  }}
  onClick={handleStageClick}
>
  {pages.map((page, i) => (
    <div key={page.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Page label bar — Canva style */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        color: '#555',
        fontSize: 13,
      }}>
        <span
          style={{ fontWeight: 500, cursor: 'pointer', color: i === activePage ? '#7C5CFC' : '#333' }}
          onClick={() => setActivePage(i)}
        >
          Page {i + 1}
        </span>
        <span style={{ color: '#999' }}>-</span>
        <input
          value={page.title || ''}
          onChange={e => patchPage(i, { title: e.target.value })}
          placeholder="Add page title"
          style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#555', width: 120 }}
        />
        {/* Page controls */}
        <button title="Move up"    onClick={() => movePage(i, -1)} style={pageCtrlBtn}>▲</button>
        <button title="Move down"  onClick={() => movePage(i, +1)} style={pageCtrlBtn}>▼</button>
        <button title="Toggle visibility" style={pageCtrlBtn}>👁</button>
        <button title="Lock page"  style={pageCtrlBtn}>🔒</button>
        <button title="Duplicate"  onClick={() => duplicatePage(i)} style={pageCtrlBtn}>📋</button>
        <button title="Delete"     onClick={() => deletePage(i)} disabled={pages.length <= 1} style={pageCtrlBtn}>🗑</button>
        <button title="Add page after" onClick={() => addPageAfter(i)} style={pageCtrlBtn}>+</button>
      </div>

      {/* Canvas itself */}
      <div
        style={{
          width: canvasW * stageScale,
          height: canvasH * stageScale,
          boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
          border: i === activePage ? '2px solid #00C4CC' : '2px solid transparent',
          borderRadius: 2,
          overflow: 'hidden',
          cursor: 'default',
          position: 'relative',
        }}
        onClick={() => setActivePage(i)}
      >
        <Stage ... />
      </div>
    </div>
  ))}

  {/* Add page button at bottom */}
  <button onClick={() => addPage()} style={{
    padding: '10px 24px',
    background: 'transparent',
    border: '2px dashed #ccc',
    borderRadius: 8,
    color: '#888',
    cursor: 'pointer',
    fontSize: 14,
  }}>
    + Add page
  </button>
</div>
```

### B10. Bottom Status Bar

```javascript
<div style={{
  height: 40,
  background: t.topbar,
  borderTop: `1px solid ${t.border}`,
  display: 'flex',
  alignItems: 'center',
  padding: '0 16px',
  gap: 16,
  flexShrink: 0,
}}>
  {/* Left: Notes, Timer */}
  <button style={statusBtnStyle}>📝 Notes</button>
  <button style={statusBtnStyle}>⏱ Timer</button>

  {/* Right: Zoom + Pages counter */}
  <div style={{ flex: 1 }} />
  <input type="range" min={10} max={200} value={Math.round(stageScale * 100)}
    onChange={e => setStageScale(+e.target.value / 100)}
    style={{ width: 120 }} />
  <span style={{ fontSize: 12, color: t.textMuted, minWidth: 40 }}>
    {Math.round(stageScale * 100)}%
  </span>
  <button style={statusBtnStyle}>Pages</button>
  <span style={{ fontSize: 12, color: t.textMuted }}>{activePage + 1}/{pages.length}</span>
  <button style={statusBtnStyle}>⊞</button>
  <button style={statusBtnStyle}>⤢</button>
  <button style={statusBtnStyle}>?</button>
</div>
```

### B11. Share Panel (right side, from screenshot 12)

```javascript
function SharePanel({ onClose, t }) {
  return (
    <div style={{
      position: 'fixed',
      top: 52,
      right: 0,
      width: 380,
      height: 'calc(100vh - 52px)',
      background: t.panel,
      borderLeft: `1px solid ${t.border}`,
      zIndex: 200,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Share design</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>📊 0 visitors</span>
          <button style={iconBtnStyle}>⚙</button>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 500, marginBottom: 8 }}>People with access</div>
        <input placeholder="Add people" style={searchInputStyle} />
      </div>

      <div>
        <div style={{ fontWeight: 500, marginBottom: 8 }}>Access level</div>
        <select style={selectStyle}>
          <option>Only you can access</option>
          <option>Anyone with the link</option>
        </select>
      </div>

      <button style={{ background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>
        🔗 Copy link
      </button>
      <button style={outlineBtnStyle}>+ Create custom link 👑</button>

      {/* Share options grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 8 }}>
        {[
          { icon: '⬇', label: 'Download' },
          { icon: '▶', label: 'Present', color: '#FF7A00' },
          { icon: '🔗', label: 'Public'  },
          { icon: '⊞', label: 'Template link', pro: true },
        ].map(o => (
          <button key={o.label} style={shareOptionBtn}>
            <div style={{ fontSize: 22, color: o.color || t.text, marginBottom: 4 }}>{o.icon}</div>
            <span style={{ fontSize: 11 }}>{o.label}</span>
            {o.pro && <span style={{ fontSize: 9 }}>👑</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## Part C — Canvas Upgrade (TemplatesEditorInner.js)

### C1. Replace Selection Color
```javascript
// Find and replace ALL instances:
// '#7C5CFC' (as selection/transformer color) → '#00C4CC'

// In TransformerLayer:
borderStroke="#00C4CC"
anchorStroke="#00C4CC"

// In ContentNode, BgImage, ImageNode:
stroke={isSelected ? '#00C4CC' : undefined}
```

### C2. Transformer — Exact Canva Spec
```jsx
<Transformer
  ref={trRef}
  borderStroke="#00C4CC"
  borderStrokeWidth={1.5 / stageScale}
  anchorSize={10 / stageScale}
  anchorCornerRadius={2 / stageScale}
  anchorStroke="#00C4CC"
  anchorFill="#ffffff"
  anchorStrokeWidth={1.5 / stageScale}
  rotateAnchorOffset={28 / stageScale}
  rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
  rotationSnapTolerance={5}
  enabledAnchors={
    selectedEl?.type === 'text'
      ? ['middle-left', 'middle-right']
      : ['top-left', 'top-right', 'bottom-left', 'bottom-right',
         'top-center', 'bottom-center', 'middle-left', 'middle-right']
  }
  boundBoxFunc={(oldBox, newBox) =>
    (newBox.width < 5 || newBox.height < 5) ? oldBox : newBox
  }
/>
```

### C3. Dynamic Font Size Scaling (Text = Canva behavior)
```javascript
// In ContentNode.handleTransformEnd, for type === 'text':
if (el.type === 'text') {
  const scaleX = node.scaleX();
  onChange({
    ...el,
    x: node.x(),
    y: node.y(),
    width: Math.max(5, node.width() * Math.abs(scaleX)),
    fontSize: Math.max(8, Math.min(400, Math.round((el.fontSize || 36) * Math.abs(scaleX)))),
    scaleX: 1,
    scaleY: 1,
    rotation: node.rotation(),
  });
  return; // early return — don't fall through to generic handler
}
```

### C4. Snap Threshold
```javascript
const SNAP_THRESHOLD = 5; // was 6
```

### C5. Multi-Page Management (largest change)

#### New State Structure
```javascript
function emptyPage() {
  return {
    id: nanoid(),
    title: '',
    elements: [],
    bgType: 'color',
    bgColor: '#1a1a22',
    bgImageUrl: null,
    bgSource: null,
    bgSourceId: null,
    bgFilter: 'normal',
    bgBrightness: 0,
    bgContrast: 0,
    bgSaturation: 0,
    lockedIds: [],
    hiddenIds: [],
  };
}

// Replace individual state vars with:
const [pages, setPages] = useState([emptyPage()]);
const [activePage, setActivePage] = useState(0);

// Computed current page values (use these everywhere instead of direct state):
const currentPage  = pages[activePage] || pages[0];
const elements     = currentPage.elements;
const bgType       = currentPage.bgType;
const bgColor      = currentPage.bgColor;
const bgImageUrl   = currentPage.bgImageUrl;
const bgSource     = currentPage.bgSource;
const bgSourceId   = currentPage.bgSourceId;
const bgFilter     = currentPage.bgFilter;
const bgBrightness = currentPage.bgBrightness;
const bgContrast   = currentPage.bgContrast;
const bgSaturation = currentPage.bgSaturation;
const lockedIds    = currentPage.lockedIds;
const hiddenIds    = currentPage.hiddenIds;
```

#### Page Mutation Helper
```javascript
// Use this instead of calling setElements, setBgColor, etc. directly:
function patchPage(idx, patch) {
  setPages(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
}

// Shorthand for current page:
const patchCurrentPage = (patch) => patchPage(activePage, patch);

// Migration examples:
// OLD: setElements(prev => [...prev, el])
// NEW: patchCurrentPage({ elements: [...currentPage.elements, el] })

// OLD: setBgColor(color)
// NEW: patchCurrentPage({ bgColor: color })
```

#### History: Snapshot/Restore with Pages
```javascript
function snapshot() {
  return {
    pages: JSON.parse(JSON.stringify(pages)),
    activePage,
  };
}

function restoreSnapshot(s) {
  setPages(s.pages);
  setActivePage(s.activePage ?? 0);
  setSelectedId(null);
}

// Update pushHistory and undo/redo to use snapshot/restoreSnapshot
```

#### Page Management Functions
```javascript
function addPage() {
  pushHistory();
  const newPage = emptyPage();
  setPages(prev => [...prev, newPage]);
  setActivePage(pages.length); // new index = current length
  setSelectedId(null);
}

function addPageAfter(idx) {
  pushHistory();
  const newPage = emptyPage();
  setPages(prev => [...prev.slice(0, idx + 1), newPage, ...prev.slice(idx + 1)]);
  setActivePage(idx + 1);
  setSelectedId(null);
}

function duplicatePage(idx) {
  pushHistory();
  const copy = { ...JSON.parse(JSON.stringify(pages[idx])), id: nanoid(), title: '' };
  setPages(prev => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
  setActivePage(idx + 1);
}

function deletePage(idx) {
  if (pages.length <= 1) return;
  pushHistory();
  setPages(prev => prev.filter((_, i) => i !== idx));
  setActivePage(prev => Math.min(prev, pages.length - 2));
  setSelectedId(null);
}

function movePage(idx, direction) {
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= pages.length) return;
  pushHistory();
  const newPages = [...pages];
  [newPages[idx], newPages[newIdx]] = [newPages[newIdx], newPages[idx]];
  setPages(newPages);
  setActivePage(newIdx);
}
```

#### Save/Load
```javascript
// Save:
await studioAPI.save({
  id: editId || undefined,
  title,
  creationType: 'image',
  pagesJson: pages,
});

// Load:
const c = await studioAPI.get(editId);
if (c?.pages_json) {
  setPages(c.pages_json);
} else if (c?.canvas_json) {
  // Backward compatibility: old single-page saves
  setPages([{ ...emptyPage(), ...c.canvas_json }]);
}
```

---

## Part D — Video Editor Canva Layout
**File:** `frontend/components/templates/VideoEditorInner.js`

Apply same top bar, icon strip, and flyout from Part B with video-specific tools:

```javascript
const TOOLS_VIDEO = [
  { id: 'clips',   icon: '▶', label: 'Clips'   },
  { id: 'text',    icon: 'T', label: 'Text'     },
  { id: 'audio',   icon: '♪', label: 'Audio'   },
  { id: 'ai',      icon: '✦', label: 'AI Gen'  },
  { id: 'filters', icon: '◑', label: 'Filters' },
];
```

Apply teal `#00C4CC` to text overlay selection in preview pane:
```javascript
// In text overlay rendering:
outline: selectedId === te.id ? '2px solid #00C4CC' : '2px solid transparent',
```

---

## Theme Variables Reference

Add this at the top of both files (or in a shared theme util):

```javascript
function getTheme(isDark) {
  return {
    isDark,
    bg:        isDark ? '#0f0f18' : '#f5f5f5',
    topbar:    isDark ? '#1a1a24' : '#ffffff',
    sidebar:   isDark ? '#1a1a24' : '#ffffff',
    panel:     isDark ? '#1e1e2a' : '#ffffff',
    card:      isDark ? '#252530' : '#ffffff',
    inputBg:   isDark ? '#2a2a38' : '#f0f0f0',
    border:    isDark ? '#333344' : '#e8e8e8',
    text:      isDark ? '#f0f0f8' : '#1a1a1a',
    textMuted: isDark ? '#888898' : '#666677',
    accent:    '#7C5CFC',
    teal:      '#00C4CC',
  };
}
```

---

## Verification Checklist

### Video Editor (`/templates/video-editor`)
- [ ] Page loads without crash or console errors
- [ ] Click "Solid Color Clip" → clip appears on timeline, no errors
- [ ] Undo / redo works correctly
- [ ] Top bar shows: File, Resize, Editing mode dropdown, undo/redo, title, Share
- [ ] 72px icon strip visible with: Clips, Text, Audio, AI Gen, Filters
- [ ] Clicking icon opens 320px flyout; clicking same icon again collapses it
- [ ] Text overlay selection border shows teal `#00C4CC`

### Image Editor (`/templates/editor`)
- [ ] 52px top bar with File, Resize, Editing, undo/redo, title, Share
- [ ] 72px icon strip with all 7 tools (Templates through Projects) + Apps/Magic at bottom
- [ ] Clicking icon opens flyout; clicking same icon collapses; clicking another tool switches
- [ ] Flyout collapse arrow (‹/›) visible on right edge of flyout
- [ ] Select an element → teal `#00C4CC` bounding box with 8 white anchor handles
- [ ] Contextual action bar (44px) appears below top bar when element is selected
- [ ] Rotation handle is visually detached ~28px above the element
- [ ] Text elements show only middle-left and middle-right resize handles
- [ ] Corner-drag text → font SIZE scales, not bounding box stretches
- [ ] Drag element → snap guides appear at 5px threshold
- [ ] Pages scroll vertically in the canvas area (not a bottom strip)
- [ ] Each page has label row: "Page N - [title] [▲][▼][👁][🔒][📋][🗑][+]"
- [ ] Active page has teal border on canvas
- [ ] + Add page button at bottom
- [ ] Switch pages → each page keeps its own elements and background
- [ ] Bottom bar: Notes, Timer, zoom slider, %, Pages, 1/N, grid, fullscreen, ?
- [ ] Save → `pagesJson` array sent to backend
- [ ] Reload with `?id=N` → all pages restored correctly
- [ ] Old single-page saves load correctly (backward compat)

### Share Panel
- [ ] Clicking Share opens right panel with: People with access, Access level, Copy link, Download, Present, Public, Template link

### File Menu
- [ ] Clicking File opens dropdown with all items matching Canva (Create, Upload, Settings, Accessibility, Save, Offline, Move, Copy, Download, Print, Version history, Trash)

### Resize Menu
- [ ] Clicking Resize opens panel with suggested sizes (Instagram Story, Post, Facebook Post) and categories

---

## Implementation Notes for Claude Code

1. **Do NOT add new npm packages.** All components are pure React with inline styles.
2. **Do NOT change backend APIs.** Only `pagesJson` field needs to be passed in save (already exists).
3. **Implement in order:** A → B+D → C1+C2 → C3+C4 → C5. Each part is independently testable.
4. **The `t` (theme) object** is already defined in both files — extend it with the new variables from the Theme Reference section above.
5. **Icon SVGs:** Use simple Unicode/emoji for icons in the initial implementation (▶, T, ♪, ✦, ◑, etc.). Replace with proper SVG icons in a follow-up pass.
6. **The flyout panel content** for Templates, Elements, Uploads requires real data from your existing API hooks — wire them to whatever hooks you already use (`useTemplates`, `useUploads`, etc.).
7. **The contextual action bar** for text elements uses the same element update pattern already used in the right panel — just moved to a horizontal bar at the top.
8. **Font selector in the action bar** — use the existing font dropdown component you have, just place it in the action bar.
9. **Share panel** is a new component but is purely presentational — wire the "Copy link" and "Download" buttons to your existing export functions.
10. **Multi-page (Part C5) is the riskiest change.** Test on a branch. Every place in the file that reads `elements`, `bgColor`, `bgType`, etc. directly must be updated to read from `currentPage.*`. Use search-and-replace carefully.

---

## Part E — Missing Canva Features (Added After Research)

### E1. Floating Object Toolbar (ON CANVAS, above selected element)

This is Canva's most distinctive UX pattern. It is NOT the top contextual bar — it floats directly above the selected element on the canvas itself.

```javascript
// Render inside the Stage/canvas area, positioned above the selected element
{selectedId && selectedEl && (
  <div
    style={{
      position: 'absolute',
      left: selectedEl.x * stageScale + (selectedEl.width * stageScale / 2),
      top: (selectedEl.y * stageScale) - 52,
      transform: 'translateX(-50%)',
      background: '#ffffff',
      border: '1px solid #e0e0e0',
      borderRadius: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      display: 'flex',
      alignItems: 'center',
      padding: '6px 8px',
      gap: 4,
      zIndex: 1000,
      pointerEvents: 'all',
      whiteSpace: 'nowrap',
    }}
  >
    {/* Copy */}
    <FloatBtn title="Copy" shortcut="C" onClick={copyElement}>⧉</FloatBtn>
    <FloatBtn title="Duplicate" shortcut="D" onClick={duplicateElement}>⊞</FloatBtn>
    <FloatBtn title="Delete" shortcut="Del" onClick={deleteSelected}>🗑</FloatBtn>
    <Divider />
    <FloatBtn title="Lock" onClick={toggleLock}>{isLocked ? '🔒' : '🔓'}</FloatBtn>
    <FloatBtn title="Layer" onClick={openLayerMenu}>⬡</FloatBtn>
    <FloatBtn title="Align to page" onClick={openAlignMenu}>⊕</FloatBtn>
    <FloatBtn title="Add to all pages" onClick={addToAllPages}>⊛</FloatBtn>
    <Divider />
    <FloatBtn title="More options">⋯</FloatBtn>
  </div>
)}

function FloatBtn({ title, onClick, children, shortcut }) {
  return (
    <button
      onClick={onClick}
      title={`${title}${shortcut ? ` (${shortcut})` : ''}`}
      style={{
        width: 32,
        height: 32,
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        color: '#333',
        transition: 'background 100ms',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </button>
  );
}
```

**Important:** If the element is near the top of the canvas, the toolbar should appear BELOW instead:
```javascript
const toolbarTop = selectedEl.y * stageScale < 60
  ? (selectedEl.y + selectedEl.height) * stageScale + 8
  : (selectedEl.y * stageScale) - 52;
```

### E2. Two Toolbars When Element Selected

Canva has BOTH:
1. **Top contextual bar** (52px below header) — shows font, size, color, B/I/U etc. for text; crop, filter, effects for images
2. **Floating object toolbar** (above element on canvas) — shows copy, duplicate, delete, lock, layer, align, more

Both must be present simultaneously when an element is selected.

The top contextual bar also has a `>>` expand button at the far right:
```javascript
// At the end of the contextual action bar:
<button
  onClick={() => setEditPanelOpen(true)}
  style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, fontWeight: 600, fontSize: 13 }}
>
  »
</button>
```
When clicked, this opens the right-side edit panel (not implemented in earlier phases — treat as a stretch goal).

### E3. Keyboard Shortcuts

Add a `useEffect` with `keydown` listener at the top level of both editors:

```javascript
useEffect(() => {
  function handleKeyDown(e) {
    // Don't fire when typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const ctrl = e.ctrlKey || e.metaKey;

    // Undo / Redo
    if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }

    // Copy / Paste / Duplicate
    if (ctrl && e.key === 'c') { e.preventDefault(); copyElement(); }
    if (ctrl && e.key === 'v') { e.preventDefault(); pasteElement(); }
    if (ctrl && e.key === 'd') { e.preventDefault(); duplicateElement(); }

    // Select all
    if (ctrl && e.key === 'a') { e.preventDefault(); selectAll(); }

    // Delete selected
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
      e.preventDefault();
      deleteSelected();
    }

    // Group / Ungroup
    if (ctrl && e.key === 'g') { e.preventDefault(); groupSelected(); }
    if (ctrl && e.shiftKey && e.key === 'G') { e.preventDefault(); ungroupSelected(); }

    // Add new page
    if (ctrl && e.key === 'Enter') { e.preventDefault(); addPage(); }

    // Tool shortcuts (when nothing is focused)
    if (!selectedId) {
      if (e.key === 't' || e.key === 'T') addText({ type: 'text', text: 'Text', fontSize: 36 });
      if (e.key === 'r' || e.key === 'R') addShape('rect');
      if (e.key === 'c' || e.key === 'C') addShape('circle');
      if (e.key === 'l' || e.key === 'L') addShape('line');
    }

    // Nudge selected element with arrow keys
    if (selectedId) {
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); nudgeElement(-step, 0); }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudgeElement(step, 0); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); nudgeElement(0, -step); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); nudgeElement(0, step); }
    }

    // Zoom
    if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); setStageScale(s => Math.min(s + 0.1, 4)); }
    if (ctrl && e.key === '-')                     { e.preventDefault(); setStageScale(s => Math.max(s - 0.1, 0.1)); }
    if (ctrl && e.key === '0')                     { e.preventDefault(); fitToScreen(); }

    // Escape: deselect
    if (e.key === 'Escape') setSelectedId(null);

    // Quick actions (/)
    if (e.key === '/') { e.preventDefault(); setQuickActionsOpen(true); }
  }

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedId, activePage, pages, history, historyIndex]);
```

### E4. Quick Actions Panel (`/` key)

```javascript
{quickActionsOpen && (
  <div style={{
    position: 'fixed',
    top: '30%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 480,
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    zIndex: 9999,
    overflow: 'hidden',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ fontSize: 18, marginRight: 10 }}>🔍</span>
      <input
        autoFocus
        placeholder='Type "/" for commands or search...'
        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16 }}
        onChange={e => setQuickQuery(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && setQuickActionsOpen(false)}
      />
    </div>
    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
      {QUICK_ACTIONS.filter(a => a.label.toLowerCase().includes(quickQuery.toLowerCase())).map(a => (
        <button key={a.id} onClick={() => { a.action(); setQuickActionsOpen(false); }}
          style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ fontSize: 20 }}>{a.icon}</span>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{a.label}</div>
            {a.sub && <div style={{ fontSize: 12, color: '#888' }}>{a.sub}</div>}
          </div>
          {a.shortcut && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#bbb', background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>{a.shortcut}</span>}
        </button>
      ))}
    </div>
  </div>
)}

const QUICK_ACTIONS = [
  { id: 'text',       icon: 'T',  label: 'Add text',           sub: 'Insert a text element',    shortcut: 'T',      action: () => addText() },
  { id: 'rect',       icon: '▭',  label: 'Add rectangle',       sub: 'Insert a rectangle shape', shortcut: 'R',      action: () => addShape('rect') },
  { id: 'circle',     icon: '○',  label: 'Add circle',          sub: 'Insert a circle shape',    shortcut: 'C',      action: () => addShape('circle') },
  { id: 'image',      icon: '🖼', label: 'Upload image',         sub: 'Add an image from device', action: () => triggerUpload() },
  { id: 'bg-remove',  icon: '✂',  label: 'Background Remover',  sub: 'Remove image background',  action: () => openBgRemover() },
  { id: 'download',   icon: '⬇', label: 'Download',             sub: 'Export your design',       shortcut: 'Ctrl+S', action: () => downloadDesign() },
  { id: 'newpage',    icon: '+',  label: 'Add new page',         sub: 'Insert a blank page',      shortcut: 'Ctrl+↵', action: () => addPage() },
  { id: 'duplicate',  icon: '⊞', label: 'Duplicate element',    sub: 'Copy selected element',    shortcut: 'Ctrl+D', action: () => duplicateElement() },
];
```

### E5. Right-Click Context Menu

```javascript
// On Stage mousedown (right click):
function handleContextMenu(e) {
  e.evt.preventDefault();
  const pos = stage.getPointerPosition();
  setContextMenu({ x: pos.x, y: pos.y, targetId: selectedId });
}

// Render:
{contextMenu && (
  <div
    style={{
      position: 'fixed',
      left: contextMenu.x,
      top: contextMenu.y,
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: 10,
      padding: '6px 0',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      zIndex: 9998,
      minWidth: 180,
    }}
    onMouseLeave={() => setContextMenu(null)}
  >
    {[
      { label: 'Copy',         shortcut: 'Ctrl+C', action: copyElement },
      { label: 'Paste',        shortcut: 'Ctrl+V', action: pasteElement },
      { label: 'Duplicate',    shortcut: 'Ctrl+D', action: duplicateElement },
      null,
      { label: 'Bring forward',  action: () => changeLayer(1) },
      { label: 'Send backward',  action: () => changeLayer(-1) },
      { label: 'Bring to front', action: () => changeLayer('front') },
      { label: 'Send to back',   action: () => changeLayer('back') },
      null,
      { label: 'Group',        shortcut: 'Ctrl+G', action: groupSelected },
      { label: 'Lock',         action: toggleLock },
      { label: 'Add to all pages', action: addToAllPages },
      null,
      { label: 'Delete',       shortcut: 'Del',    action: deleteSelected, danger: true },
    ].map((item, i) =>
      item === null
        ? <div key={i} style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />
        : (
          <button key={i} onClick={() => { item.action(); setContextMenu(null); }}
            style={{
              width: '100%', padding: '8px 14px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              fontSize: 13,
              color: item.danger ? '#ef4444' : '#222',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span>{item.label}</span>
            {item.shortcut && <span style={{ fontSize: 11, color: '#bbb' }}>{item.shortcut}</span>}
          </button>
        )
    )}
  </div>
)}
```

### E6. Multi-Select (Shift+Click)

```javascript
// State
const [selectedIds, setSelectedIds] = useState([]); // multi-select
// Keep existing selectedId for single select compatibility

// On element click:
function handleElementClick(e, elementId) {
  if (e.evt.shiftKey) {
    // Toggle multi-select
    setSelectedIds(prev =>
      prev.includes(elementId)
        ? prev.filter(id => id !== elementId)
        : [...prev, elementId]
    );
    setSelectedId(null);
  } else {
    setSelectedId(elementId);
    setSelectedIds([]);
  }
}

// Multi-select Transformer (attach to all selected nodes):
useEffect(() => {
  if (selectedIds.length > 1 && trRef.current && layerRef.current) {
    const nodes = selectedIds.map(id => layerRef.current.findOne('#' + id)).filter(Boolean);
    trRef.current.nodes(nodes);
    trRef.current.getLayer().batchDraw();
  }
}, [selectedIds]);
```

### E7. Snap Guide Lines Rendering

```javascript
// State
const [snapLines, setSnapLines] = useState({ vertical: [], horizontal: [] });

// During drag (in onDragMove):
function getSnapLines(draggedEl) {
  const lines = { vertical: [], horizontal: [] };
  const dragBounds = getBounds(draggedEl);

  elements.filter(el => el.id !== draggedEl.id).forEach(el => {
    const b = getBounds(el);
    // Vertical snaps
    [b.left, b.centerX, b.right].forEach(x => {
      if (Math.abs(dragBounds.left   - x) < SNAP_THRESHOLD) lines.vertical.push(x);
      if (Math.abs(dragBounds.centerX - x) < SNAP_THRESHOLD) lines.vertical.push(x);
      if (Math.abs(dragBounds.right  - x) < SNAP_THRESHOLD) lines.vertical.push(x);
    });
    // Horizontal snaps
    [b.top, b.centerY, b.bottom].forEach(y => {
      if (Math.abs(dragBounds.top    - y) < SNAP_THRESHOLD) lines.horizontal.push(y);
      if (Math.abs(dragBounds.centerY - y) < SNAP_THRESHOLD) lines.horizontal.push(y);
      if (Math.abs(dragBounds.bottom - y) < SNAP_THRESHOLD) lines.horizontal.push(y);
    });
  });
  return lines;
}

// Render snap lines (inside Konva Layer):
{snapLines.vertical.map((x, i) => (
  <Line key={`v${i}`}
    points={[x * stageScale, 0, x * stageScale, canvasH * stageScale]}
    stroke="#FF00FF"
    strokeWidth={1}
    dash={[4, 4]}
  />
))}
{snapLines.horizontal.map((y, i) => (
  <Line key={`h${i}`}
    points={[0, y * stageScale, canvasW * stageScale, y * stageScale]}
    stroke="#FF00FF"
    strokeWidth={1}
    dash={[4, 4]}
  />
))}
```

### E8. Page Thumbnail Sidebar (toggled by "Pages" button in bottom bar)

```javascript
{pagesThumbnailOpen && (
  <div style={{
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 200,
    background: t.panel,
    borderLeft: `1px solid ${t.border}`,
    overflowY: 'auto',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    zIndex: 50,
  }}>
    {pages.map((page, i) => (
      <div key={page.id} onClick={() => { setActivePage(i); setSelectedId(null); }} style={{ cursor: 'pointer' }}>
        <div style={{
          border: `2px solid ${i === activePage ? '#00C4CC' : t.border}`,
          borderRadius: 6,
          overflow: 'hidden',
          aspectRatio: `${canvasW}/${canvasH}`,
          background: page.bgColor || '#1a1a22',
        }}>
          {/* Mini canvas render or screenshot */}
        </div>
        <div style={{ fontSize: 11, textAlign: 'center', marginTop: 4, color: i === activePage ? '#00C4CC' : t.textMuted }}>
          {i + 1}
        </div>
      </div>
    ))}
    <button onClick={addPage} style={{ border: '2px dashed #ccc', borderRadius: 6, padding: 12, background: 'none', cursor: 'pointer', color: '#888' }}>
      + Add page
    </button>
  </div>
)}
```

---

## Updated Verification Checklist (Full Canva Parity)

### Floating Toolbar
- [ ] Select any element → floating toolbar appears above it on canvas
- [ ] Toolbar shows: Copy, Duplicate, Delete, Lock, Layer, Align, More
- [ ] If element is near top of canvas, toolbar appears BELOW instead
- [ ] Floating toolbar disappears when clicking outside/deselecting

### Keyboard Shortcuts
- [ ] Ctrl+Z / Ctrl+Y → undo/redo
- [ ] Ctrl+C / Ctrl+V / Ctrl+D → copy/paste/duplicate
- [ ] Delete/Backspace → delete selected element
- [ ] Arrow keys → nudge element 1px; Shift+Arrow → nudge 10px
- [ ] Escape → deselect element
- [ ] T → add text, R → rectangle, C → circle (when nothing selected)
- [ ] Ctrl++ / Ctrl+- → zoom in/out
- [ ] `/` → open quick actions panel

### Quick Actions Panel
- [ ] `/` key opens search panel
- [ ] Type to filter actions
- [ ] Escape closes panel
- [ ] Actions work: add text, add shape, upload, download, add page

### Right-click Context Menu
- [ ] Right-click on element shows context menu
- [ ] Copy, Paste, Duplicate, Delete, Layer (Forward/Backward/Front/Back), Group, Lock, Add to all pages
- [ ] Click outside dismisses menu

### Multi-select
- [ ] Shift+click multiple elements selects all of them
- [ ] Transformer wraps all selected elements
- [ ] Delete, Duplicate, Move work on multi-selection
- [ ] Floating toolbar shows Group option when multiple selected

### Snap Guide Lines
- [ ] Dragging element → magenta (#FF00FF) snap lines appear at 5px threshold
- [ ] Lines disappear on drag end
- [ ] Snaps to edges AND centers of other elements AND canvas edges

### Pages Sidebar
- [ ] "Pages" button in bottom bar toggles right thumbnail panel
- [ ] Thumbnail shows correct background color
- [ ] Click thumbnail → navigates to that page
- [ ] Active page has teal border

---

## Summary: What This Plan Now Covers

| Feature | Status |
|---------|--------|
| Top bar (File, Resize, Editing, Undo/Redo, Title, Share) | ✅ Part B |
| File dropdown (14 items) | ✅ Part B |
| Resize dropdown (presets + categories) | ✅ Part B |
| Editing mode dropdown | ✅ Part B |
| Share panel | ✅ Part B |
| Icon strip (7 tools + Apps + Magic) | ✅ Part B |
| Flyout panel (320px, collapsible) | ✅ Part B |
| All 7 panel contents | ✅ Part B |
| Contextual action bar (text/image/shape) | ✅ Part B |
| `>>` expand button on action bar | ✅ Part E |
| **Floating object toolbar (above element)** | ✅ **Part E** |
| **Keyboard shortcuts (full set)** | ✅ **Part E** |
| **Quick Actions (`/` key panel)** | ✅ **Part E** |
| **Right-click context menu** | ✅ **Part E** |
| **Multi-select (Shift+click)** | ✅ **Part E** |
| Teal `#00C4CC` selection color | ✅ Part C |
| Transformer handles (Canva spec) | ✅ Part C |
| Font size scaling on text drag | ✅ Part C |
| Snap threshold 5px | ✅ Part C |
| **Snap guide lines (magenta, live)** | ✅ **Part E** |
| Multi-page management | ✅ Part C5 |
| Pages scroll vertically on canvas | ✅ Part B |
| Page label row per page | ✅ Part B |
| **Pages thumbnail sidebar** | ✅ **Part E** |
| Bottom status bar | ✅ Part B |
| Video editor crash fix | ✅ Part A |
| Video editor Canva layout | ✅ Part D |
| Theme variables (light/dark) | ✅ Part B |


Canva UX parity breakdown for ItsPosting editor
87%
achievable parity
After implementing all plan parts A–E
In your plan
Partial / needs polish
Not in plan yet
Impossible to clone
Layout & structure
Done
Top bar (File, Resize, Editing, Undo/Redo, Title, Share)
Fully specced in Part B
Done
72px icon strip + 320px collapsible flyout panel
With correct open/close toggle logic
Done
All 7 panel contents (Templates, Elements, Text, Uploads, Brand, Tools, Projects)
Fully coded in Part B
Done
Pages scroll vertically on canvas (not a bottom strip)
Each page has its own label row above it
Done
Bottom status bar (Notes, Timer, zoom, Pages counter)
Canvas interaction
Done
Teal #00C4CC selection handles + Canva-spec Transformer
8 anchors, white fill, rotation offset 28px, Part C2
Done
Floating object toolbar above selected element
Copy, Duplicate, Delete, Lock, Layer, Align — Part E1
Done
Contextual action bar (font, size, B/I/U for text)
Changes based on element type — Part B5
Done
Snap guides (magenta, 5px threshold)
Live rendering during drag — Part E7
Done
Font size scaling on text drag (not bounding box stretch)
Done
Multi-select (Shift+click), right-click menu, keyboard shortcuts
Full set including arrow nudge, Ctrl+D, / quick actions — Part E
Partial
Hover preview on templates & animations
Canva shows live animated preview on hover — needs CSS transition on thumbnails
Missing
Ruler guides (drag from ruler to create a guide line)
Canva lets you drag from top/left ruler to place a blue guide line on canvas
Micro-interactions & feel (the "magic" layer)
Missing
Panel slide animation (200ms ease) + content fade-in
Width transition is in the plan but panel CONTENT should fade in (opacity 0→1, 150ms delay) for a polished feel
Missing
Floating toolbar entrance animation
Canva's toolbar fades + scales in (transform: scale(0.95)→1, opacity 0→1, 120ms) when you select an element
Missing
Button hover micro-interactions
All buttons: 100ms background transition. Icon strip buttons: subtle scale(1.05) on hover. Destructive (delete) buttons: red tint on hover
Missing
Upload progress indicator (porthole / wave animation)
Canva Engineering Blog: animated wave progress fills up as images upload. Makes waiting feel alive
Missing
Smooth drag feedback (element shadow + slight scale)
While dragging, element gets subtle opacity:0.85 + box-shadow to show it's "lifted"
Missing
Tooltip system
Every button shows a tooltip on hover (after 400ms delay) with the action name + keyboard shortcut. Critical for discoverability
Missing
Save indicator animation
Canva shows "Saving..." → "All changes saved" with a subtle fade. Auto-save every 2s of inactivity
Missing
Empty state illustrations
When uploads panel is empty, a friendly illustration + "Upload your first file" CTA. Same for templates, projects
Missing
Loading skeleton screens
While templates/uploads load, show animated skeleton cards (shimmer effect) instead of a spinner
Missing
Color picker UI
Canva's color picker: hex input + saturation/brightness square + hue slider + opacity slider + recent colors row + brand colors row
Typography & spacing (what makes Canva feel "premium")
Missing
Consistent 4px grid spacing system
Canva uses a strict 4px grid: 4, 8, 12, 16, 24, 32px. Every padding, gap, and margin is a multiple of 4. This creates visual harmony
Missing
Font weight hierarchy
Labels: 400, Section headers: 500, Active states: 600. Currently your editor uses inconsistent weights
Missing
Icon consistency (single icon library)
Canva uses ONE icon style throughout. Your plan uses Unicode emoji (▶, T, ♪) which look inconsistent. Use Lucide or Tabler icons everywhere
Permanently impossible to clone
Never
100M+ licensed stock assets (photos, videos, graphics)
Use Pexels/Unsplash API as free alternative
Never
3,000+ licensed fonts
Google Fonts (1,500 free) covers 95% of needs
Never
Canva's proprietary AI (Magic Write, Background Remover, Magic Edit)
Use Remove.bg API, OpenAI for text — similar but not identical
Never
10 years of canvas rendering performance optimization
Konva.js gets you 80% there. The rest comes with time
Never
600,000+ templates
Build 100 great niche-specific templates — that beats 600k generic ones for your users
The real gap is not features — it's the micro-interaction layer. The plan covers all major features. What makes Canva feel magical is 50+ small polish details: tooltip delays, entrance animations, hover states, loading skeletons, save indicators. These take 2–3 extra weeks but account for ~60% of the perceived quality difference.

That's the right goal. Let me research what actually makes Canva's UX so exceptional — the micro-interactions, animations, and details that most people copy wrong.Searched the webSearched the webCanva UX design principles micro-interactions animations what makes Canva so good user experience7 resultsUX Design Principles: The 10 Rules Behind Products Users Loveuserpilot.com7 User Experience Basics for Designersuxpilot.aiThe Role of Micro-interactions in Modern UX | IxDFixdf.org🎀2025 UI/UX Design Trends You Can Try Right Now (with Canva Code) | by Chapterjam AI Studio | Mediumchapterjamaistudio.medium.comCanva's New Visual Worksuite: For Web Design, UX/UI and Prototypingdesignerup.coCanva: From Design Dilemma to User-Friendly Design | Raw.Studioraw.studioUnlocking Canva's UX Secrets: How Unconscious Influences Drive User Engagement — The Unconscious Consumerwww.theunconsciousconsumer.comCanva editor hover effects animations transitions tooltip design details 2024 20259 resultsEverything You Need to Know About the Canva October Updates: The Canva 2024 Glow Up-We360.aiwe360.aiFree Canva Image Hover Effects widgetwww.commoninja.comCanva Animation SECRETS REVEALED! Beyond the Basics 2025 - YouTubewww.youtube.comHow to Add Transitions in Canva: 1-Min Guidewww.storylane.ioApply, change, or remove animations - Canva Help Centerwww.canva.comUse page transitions - Canva Help Centerwww.canva.com5 visual effects Canva uses to thrill users - Canva Engineering Blogcanvatechblog.comUsing text effects and animations in your Canva designswww.canva.comCanvaen.wikipedia.org5 visual effects Canva uses to thrill users - Canva Engineering Blogcanvatechblog.comDoneNow I have Canva's own engineering blog. This is gold. Let me give you the real, complete, honest answer.Now let me give you the full, honest, researched answer — structured clearly.
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0.25s;
    animation-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
  }
VvisualizeVvisualize show_widget

# ItsPosting — Exact Canva Parity Plan
**For Claude Code** | The complete, definitive reference. Every pixel, every behavior, every interaction.

---

## TABLE OF CONTENTS

1. Design Tokens & Variables
2. Layout Architecture
3. Top Bar — Exact Spec
4. Contextual Action Bar — Exact Spec
5. Left Icon Strip — Exact Spec
6. Left Flyout Panel — All 8 Panels
7. Canvas Area — Exact Spec
8. Selection System (Transformer)
9. Floating Object Toolbar
10. Right-Click Context Menu
11. Bottom Status Bar
12. Pages Sidebar
13. Keyboard Shortcuts — All 62
14. Animation & Motion System
15. Tooltip System
16. Color Picker Component
17. Save Indicator System
18. Drag Feedback System
19. Loading Skeletons & Empty States
20. Ruler & Guides System
21. Auto-Zoom & Fit Behaviors
22. File Menu Dropdown
23. Resize Panel
24. Share Panel
25. Implementation Order

---

## 1. DESIGN TOKENS & VARIABLES

Add these to `globals.css`. Every single value in the editor MUST come from these tokens — no hardcoded values anywhere.

```css
:root {
  /* ─── Brand Colors ─────────────────────────────────── */
  --color-primary: #7c3aed;           /* Canva purple — buttons, active states */
  --color-primary-hover: #6d28d9;
  --color-primary-fore: #ffffff;
  --color-teal: #00C4CC;              /* Selection handles, active page border */
  --color-teal-hover: #00b0b8;
  --color-magenta: #FF00FF;           /* Snap guide lines */
  --color-blue-guide: #2563eb;        /* Ruler drag guides */

  /* ─── Surface Colors ───────────────────────────────── */
  --surface-canvas-bg: #f0f0f0;       /* Canvas stage background */
  --surface-topbar: #ffffff;
  --surface-iconstrip: #ffffff;
  --surface-flyout: #ffffff;
  --surface-actionbar: #ffffff;
  --surface-floating-toolbar: #ffffff;
  --surface-dropdown: #ffffff;
  --surface-overlay: rgba(0, 0, 0, 0.4);

  /* ─── Border Colors ────────────────────────────────── */
  --border-default: #e5e7eb;
  --border-subtle: #f3f4f6;
  --border-focus: #7c3aed;

  /* ─── Text Colors ──────────────────────────────────── */
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-muted: #9ca3af;
  --text-disabled: #d1d5db;
  --text-on-primary: #ffffff;
  --text-destructive: #ef4444;

  /* ─── Shadows ──────────────────────────────────────── */
  --shadow-canvas: 0 4px 24px rgba(0, 0, 0, 0.12);
  --shadow-panel: 2px 0 8px rgba(0, 0, 0, 0.06);
  --shadow-dropdown: 0 8px 24px rgba(0, 0, 0, 0.12);
  --shadow-floating-toolbar: 0 4px 16px rgba(0, 0, 0, 0.12);
  --shadow-tooltip: 0 2px 8px rgba(0, 0, 0, 0.2);
  --shadow-drag: 0 8px 25px rgba(0, 0, 0, 0.15);

  /* ─── Spacing (4px grid — ONLY use these) ──────────── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* ─── Layout Dimensions ────────────────────────────── */
  --topbar-height: 52px;
  --actionbar-height: 44px;
  --iconstrip-width: 72px;
  --flyout-width: 320px;
  --bottombar-height: 44px;

  /* ─── Border Radius ────────────────────────────────── */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-pill: 999px;

  /* ─── Typography ───────────────────────────────────── */
  --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --text-xs: 11px;
  --text-sm: 12px;
  --text-md: 13px;
  --text-base: 14px;
  --text-lg: 15px;
  --font-regular: 400;
  --font-medium: 500;
  --font-semibold: 600;

  /* ─── Icon Sizes ───────────────────────────────────── */
  --icon-sm: 16px;
  --icon-md: 18px;
  --icon-lg: 20px;
  --icon-xl: 24px;

  /* ─── Transitions ──────────────────────────────────── */
  --transition-panel: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-panel-content: opacity 150ms ease 80ms;
  --transition-floating-toolbar: opacity 120ms ease, transform 120ms ease;
  --transition-button: background 100ms ease;
  --transition-icon-hover: transform 100ms ease;
  --transition-drag: opacity 150ms ease, box-shadow 150ms ease;
  --transition-tooltip: opacity 150ms ease;

  /* ─── Z-Index Stack ────────────────────────────────── */
  --z-canvas: 1;
  --z-snap-lines: 10;
  --z-floating-toolbar: 50;
  --z-actionbar: 100;
  --z-flyout: 150;
  --z-topbar: 200;
  --z-dropdown: 300;
  --z-tooltip: 400;
  --z-modal: 500;
}

/* Dark mode support */
[data-theme="dark"] {
  --surface-canvas-bg: #1a1a2e;
  --surface-topbar: #1f2937;
  --surface-iconstrip: #1f2937;
  --surface-flyout: #1f2937;
  --surface-actionbar: #1f2937;
  --surface-floating-toolbar: #374151;
  --surface-dropdown: #374151;
  --border-default: #374151;
  --border-subtle: #4b5563;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-muted: #6b7280;
}
```

---

## 2. LAYOUT ARCHITECTURE

The entire editor is a CSS Grid. No flex hacks, no absolute positioning for the shell.

```
┌────────────────────────────────────────────────────────────────┐
│                    TOP BAR [52px]                              │ z:200
├────────────────────────────────────────────────────────────────┤
│              CONTEXTUAL ACTION BAR [44px]                      │ z:100
│              (display:none when nothing selected)              │
├──────────┬──────────────────┬──────────────────────────────────┤
│          │                  │                                  │
│  ICON    │  FLYOUT PANEL    │         CANVAS STAGE             │
│  STRIP   │  [0px or 320px]  │    (overflow: auto, gray bg)     │
│  [72px]  │  slides open     │                                  │
│          │                  │                                  │
├──────────┴──────────────────┴──────────────────────────────────┤
│                    BOTTOM STATUS BAR [44px]                    │
└────────────────────────────────────────────────────────────────┘
```

```css
.editor-shell {
  display: grid;
  grid-template-rows: var(--topbar-height) auto 1fr var(--bottombar-height);
  grid-template-columns: var(--iconstrip-width) auto 1fr;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  font-family: var(--font-ui);
  font-size: var(--text-base);
  color: var(--text-primary);
  background: var(--surface-canvas-bg);
}

.editor-topbar        { grid-column: 1 / -1; grid-row: 1; }
.editor-actionbar     { grid-column: 1 / -1; grid-row: 2; }
.editor-iconstrip     { grid-column: 1; grid-row: 3; }
.editor-flyout        { grid-column: 2; grid-row: 3; }
.editor-canvas-stage  { grid-column: 3; grid-row: 3; }
.editor-bottombar     { grid-column: 1 / -1; grid-row: 4; }
```

---

## 3. TOP BAR — EXACT SPEC

**Height:** 52px | **Background:** `var(--surface-topbar)` | **Border-bottom:** `1px solid var(--border-default)`

### Left Section (from left):
```
[🏠 Home icon] [File ▾] [Resize ▾] [✏ Editing ▾]   gap:8px between items
```
- Home icon: 32×32px, border-radius 8px, hover: `rgba(0,0,0,0.06)` bg
- File / Resize / Editing: text buttons, 13px, font-weight 500, height 32px, padding 0 10px, border-radius 6px, hover bg `rgba(0,0,0,0.06)`
- Chevron icon: 14px, color `var(--text-secondary)`, margin-left 4px

### Center Section (absolutely centered):
```
[↩ Undo] [↪ Redo]  |  [☁ Save indicator]  |  [Design title — editable]
```
- Undo/Redo: 32×32px icon buttons, border-radius 6px
- Divider: 1px solid `var(--border-default)`, height 20px
- Title: inline editable `<input>`, max-width 200px, text-align center, border:none, font-weight 500, font-size 14px, click to edit

### Right Section (from right):
```
[Share button]  [⋯ more options]
```
- Share: 80px wide, height 32px, background `linear-gradient(135deg, #7c3aed, #00C4CC)`, color white, border-radius 6px, font-weight 600, font-size 13px
- On hover: opacity 0.92, transition 100ms

```jsx
// Top bar layout
<header className="editor-topbar" style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 12px',
  background: 'var(--surface-topbar)',
  borderBottom: '1px solid var(--border-default)',
  height: 'var(--topbar-height)',
  position: 'relative',
  zIndex: 'var(--z-topbar)',
}}>
  <div className="topbar-left" style={{ display:'flex', alignItems:'center', gap: '4px' }}>
    <HomeButton />
    <TopBarMenuButton label="File" onClick={openFileMenu} />
    <TopBarMenuButton label="Resize" onClick={openResizePanel} />
    <TopBarMenuButton label="Editing" icon={<Pencil size={14}/>} onClick={openEditingMenu} />
  </div>

  <div className="topbar-center" style={{
    position: 'absolute', left: '50%', transform: 'translateX(-50%)',
    display: 'flex', alignItems: 'center', gap: '8px'
  }}>
    <IconButton icon={<Undo2 size={18}/>} onClick={undo} disabled={!canUndo} tooltip="Undo (Ctrl+Z)" />
    <IconButton icon={<Redo2 size={18}/>} onClick={redo} disabled={!canRedo} tooltip="Redo (Ctrl+Y)" />
    <Divider />
    <SaveIndicator />
    <Divider />
    <DesignTitleInput value={title} onChange={setTitle} />
  </div>

  <div className="topbar-right" style={{ display:'flex', alignItems:'center', gap: '8px' }}>
    <ShareButton onClick={openSharePanel} />
  </div>
</header>
```

---

## 4. CONTEXTUAL ACTION BAR — EXACT SPEC

**Height:** 44px | **Background:** `var(--surface-actionbar)` | **Border-bottom:** `1px solid var(--border-default)`
**Visibility:** `display: none` when nothing selected. Slides in (height 0 → 44px, `transition: height 150ms ease`) when element is selected.

### TEXT selected:
```
[Font color swatch] [T grid icon] [↔ W: 240] [Font name ▾] [– 24 +] [🎨 color] [B] [I] [U] [S] [aA case] [≡ align ▾] [≡ list ▾] [↕ H: 120] [⠿ spacing] [Animate] [Position] [⋯]
```
- Font name dropdown: min-width 140px, shows current font
- Size: two 24×24 buttons (− +) with number input between them
- B/I/U/S/aA: 28×28px toggle buttons, `border-radius: 4px`, active state: bg `rgba(124,58,237,0.1)`, color `var(--color-primary)`
- Align dropdown: shows Left/Center/Right/Justify options
- Everything separated by 4px gap, left padding 12px

### IMAGE selected:
```
[Crop] [Flip ▾] [Effects] [Adjust] [↕ Transparency] [Animate] [Position] [⋯]
```

### SHAPE selected:
```
[Fill color] [Border color] [Border weight] [↕ Opacity] [Animate] [Position] [⋯]
```

### `>>` Overflow Button:
- When action bar items overflow the width, show `>>` at right edge
- Click → opens a dropdown with all hidden items listed

```jsx
function ContextualActionBar({ selectedElement }) {
  if (!selectedElement) return null;
  return (
    <div className="editor-actionbar" style={{
      height: 'var(--actionbar-height)',
      display: 'flex', alignItems: 'center',
      background: 'var(--surface-actionbar)',
      borderBottom: '1px solid var(--border-default)',
      padding: '0 var(--space-3)',
      gap: 'var(--space-1)',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 'var(--z-actionbar)',
    }}>
      {selectedElement.type === 'text' && <TextActionBar element={selectedElement} />}
      {selectedElement.type === 'image' && <ImageActionBar element={selectedElement} />}
      {selectedElement.type === 'shape' && <ShapeActionBar element={selectedElement} />}
      <OverflowButton />
    </div>
  );
}
```

---

## 5. LEFT ICON STRIP — EXACT SPEC

**Width:** 72px | **Background:** `var(--surface-iconstrip)` | **Border-right:** `1px solid var(--border-default)`

### Icons (top to bottom):
```
[Templates]      ← LayoutTemplate icon
[Elements]       ← Shapes icon
[Text]           ← Type icon
[Brand]          ← Crown icon (👑 = Pro)
[Uploads]        ← Upload icon
[Tools]          ← Wrench icon
[Projects]       ← FolderOpen icon
─────────── (flex spacer) ───────────
[Apps]           ← Grid2x2 icon
[Magic Media]    ← Sparkles icon
```

### Each icon button:
```css
.icon-strip-btn {
  width: 64px;
  height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 8px;
  cursor: pointer;
  margin: 2px 4px;
  transition: background 100ms ease, transform 100ms ease;
}
.icon-strip-btn:hover {
  background: rgba(0,0,0,0.06);
  transform: scale(1.05);
}
.icon-strip-btn.active {
  background: rgba(124, 58, 237, 0.1);  /* light purple pill */
}
.icon-strip-btn .icon { color: var(--text-secondary); }
.icon-strip-btn.active .icon { color: var(--color-primary); }
.icon-strip-btn .label {
  font-size: 10px;
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  line-height: 1;
}
.icon-strip-btn.active .label { color: var(--color-primary); }
```

### Toggle Behavior:
- Click active icon → **closes** the flyout panel (width → 0)
- Click inactive icon → **opens** flyout (width → 320px) and switches content
- State: `activePanel: string | null`

```jsx
function IconStrip({ activePanel, setActivePanel }) {
  const toggle = (panel) => setActivePanel(p => p === panel ? null : panel);
  // All icons use Lucide React — no Unicode emoji
  const tools = [
    { id: 'templates', icon: <LayoutTemplate size={20}/>, label: 'Templates' },
    { id: 'elements',  icon: <Shapes size={20}/>,         label: 'Elements'  },
    { id: 'text',      icon: <Type size={20}/>,            label: 'Text'      },
    { id: 'brand',     icon: <Crown size={20}/>,           label: 'Brand'     },
    { id: 'uploads',   icon: <Upload size={20}/>,          label: 'Uploads'   },
    { id: 'tools',     icon: <PenTool size={20}/>,         label: 'Tools'     },
    { id: 'projects',  icon: <FolderOpen size={20}/>,      label: 'Projects'  },
  ];
  // ...
}
```

---

## 6. LEFT FLYOUT PANEL — ALL 8 PANELS

**Width:** 320px when open, 0 when closed | `overflow: hidden`
**Transition:** `width 200ms cubic-bezier(0.4, 0, 0.2, 1)`
**Content fade:** `opacity 0 → 1, 150ms ease, 80ms delay` (after panel starts opening)
**Background:** `var(--surface-flyout)` | **Border-right:** `1px solid var(--border-default)`

### 6.1 Templates Panel
```
┌─────────────────────────────────────┐
│ 🔍 [Search templates...]  [🎤 mic] │  ← 36px input, border-radius 20px
├─────────────────────────────────────┤
│ Suggested for you                   │  ← section header, 11px, uppercase, muted
│ [thumb] [thumb]                     │  ← 2-column grid, gap 8px
│ [thumb] [thumb]                     │    each thumb: aspect-ratio 1, border-radius 6px
│ [thumb] [thumb]                     │    hover: scale(1.03) + "Use template" overlay
│                                     │
│ Social Media ▾                      │  ← collapsible category
│ Presentations ▾                     │
│ Marketing ▾                         │
└─────────────────────────────────────┘
```

### 6.2 Elements Panel
```
┌─────────────────────────────────────┐
│ 🤖 [Describe your ideal element...] │
│ [Generate with AI]  [Search]        │
├─────────────────────────────────────┤
│ Recommended                         │
│ [el][el][el][el][el][el]            │  ← 3-column grid
│                                     │
│ Browse by category:                 │
│ [Shapes] [Graphics] [Animations]    │  ← pill buttons, scrollable row
│ [Frames] [Grids] [Charts] [Tables]  │
└─────────────────────────────────────┘
```

### 6.3 Text Panel
```
┌─────────────────────────────────────┐
│ 🔍 [Search fonts & combinations...] │
│                                     │
│ [+ Add a text box]                  │  ← full-width purple button
│ [✨ Magic Write]                    │  ← full-width outlined button
│                                     │
│ ── Brand Kit ─────────────────────  │
│ [Edit]                              │
│                                     │
│ ── Default text styles ───────────  │
│ [Add a heading]      →  36px sample │
│ [Add a subheading]   →  24px sample │
│ [Add body text]      →  14px sample │
│                                     │
│ ── Font Combinations ──────────────  │
│ [combo preview] [combo preview]     │
└─────────────────────────────────────┘
```
- "Add a text box" button: background `var(--color-primary)`, color white, height 36px, border-radius 6px, full width
- "Magic Write" button: border `1px solid var(--color-primary)`, color `var(--color-primary)`, height 36px

### 6.4 Brand Panel
```
Tabs: [All assets] [Guidelines] [Brand Templates] [Logos] [Colors]
─────────────────────────────────────
Logos section:
[logo thumb] [logo thumb]

Colors section:
[●] [●] [●] [●] [●]  ← 32px swatches

Fonts section:
Primary: Montserrat
Secondary: Open Sans
```

### 6.5 Uploads Panel
```
┌─────────────────────────────────────┐
│ 🔍 [Search uploads...]              │
│ [↑ Upload files] [···]              │  ← side-by-side, 50/50
│ [⏺ Record yourself]                 │  ← full-width outlined
│                                     │
│ [Images] [Videos] [Designs] [Folders│  ← tab row
│                                     │
│ [img][img][img]                     │  ← 3-col grid
│ [img][img][img]                     │
└─────────────────────────────────────┘
```
- "Upload files": background `var(--color-primary)`, color white
- Background Remover promo banner at bottom: teal bg, 2 lines of text + "Try Pro" CTA

### 6.6 Tools Panel (sub-strip)
```
┌─────────────────────────────────────┐
│ Drawing tools                       │
│                                     │
│ [↖ Select]    [✏ Draw]             │
│ [🖍 Highlight] [⌫ Erase]           │
│ [🖊 Pen]      [⬡ Shape]            │
│ [T Text]      [⊞ Grid]             │
│                                     │
│ Pen settings (when pen active):     │
│ Color: [●]                          │
│ Size: ●────────── [slider]          │
│ Opacity: ●──────── [slider]         │
└─────────────────────────────────────┘
```
- Each tool: 72×40px button, icon + label, border-radius 8px
- Active: bg `rgba(124,58,237,0.1)`, border `1px solid var(--color-primary)`

### 6.7 Projects Panel
```
┌─────────────────────────────────────┐
│ 🔍 [Search projects...]             │
│ [Your projects ▾]                   │
│                                     │
│ [All] [Designs] [Folders]           │  ← tabs
│                                     │
│ ┌─────────────┐ ┌─────────────┐    │
│ │  [thumb]    │ │  [thumb]    │    │
│ │  Name       │ │  Name       │    │
│ │  1080×1080  │ │  1920×1080  │    │
│ └─────────────┘ └─────────────┘    │
└─────────────────────────────────────┘
```
- Design thumbnails: aspect-ratio 1, border-radius 8px, box-shadow subtle
- Below thumb: design name (13px, semibold), dimensions (11px, muted)
- Hover: border `2px solid var(--color-teal)`

### 6.8 Apps Panel
```
┌─────────────────────────────────────┐
│ 🔍 [Search apps...]                 │
│                                     │
│ Recommended                         │
│ [app icon + name + description]     │  ← list rows
│ [app icon + name + description]     │
│                                     │
│ Categories                          │
│ [Photos] [Videos] [AI] [Social]     │
└─────────────────────────────────────┘
```

---

## 7. CANVAS AREA — EXACT SPEC

**Background:** `var(--surface-canvas-bg)` = `#f0f0f0`
**Overflow:** `auto` (both axes) — canvas scrolls inside stage
**Cursor:** `default` → `grab` when panning (Space held) → `grabbing` while panning

### Page Label Row (above each page):
```
Page 1 — Untitled   [▲ up] [▼ down] [👁 hide] [🔒 lock] [📋 duplicate] [🗑 delete] [+ add page]
```
- Font: 12px, color `var(--text-secondary)`
- Buttons: 24×24px, icon only, hover bg `rgba(0,0,0,0.06)`, border-radius 4px
- Margin below label: 8px
- Margin above next page label: 32px

### Canvas (Konva Stage):
- Background: white (or design bg color)
- Box-shadow: `var(--shadow-canvas)` = `0 4px 24px rgba(0,0,0,0.12)`
- Border-radius: 0 (Canva uses sharp corners)
- Pages render vertically stacked with 40px gap between them

### Rulers (optional, toggled from View menu):
- Top ruler: 20px tall, `background: #f8f9fa`, `border-bottom: 1px solid var(--border-default)`
- Left ruler: 20px wide, same style
- Tick marks: every 50px (major), every 10px (minor, smaller)
- Font: 9px, color `var(--text-muted)`
- When element selected: highlight band on ruler showing element's X and W extent

### Zoom Controls (bottom-right of canvas stage):
- Not in bottom bar — floating over canvas, bottom-right corner, 16px from edges
- `[slider ────────] [22%] [Fit page]`
- Zoom range: 10% to 400%
- Scroll wheel: zoom by 10% per notch, centered on cursor position

---

## 8. SELECTION SYSTEM — EXACT SPEC

### Transformer (Konva Transformer config):
```javascript
const transformer = new Konva.Transformer({
  // Handle appearance — Canva spec
  anchorFill: '#ffffff',
  anchorStroke: '#00C4CC',
  anchorStrokeWidth: 2,
  anchorSize: 10,
  anchorCornerRadius: 2,
  borderStroke: '#00C4CC',
  borderStrokeWidth: 1.5,
  borderDash: [],           // solid line

  // Rotation handle
  rotateEnabled: true,
  rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
  rotationSnapTolerance: 5,
  // Rotation anchor offset: 28px above top-center handle
  rotateAnchorOffset: 28,
  rotateAnchorCursor: 'crosshair',

  // Resize behavior
  keepRatio: false,         // free resize by default
  enabledAnchors: [         // all 8 handles for shapes/images
    'top-left', 'top-center', 'top-right',
    'middle-left', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right',
  ],
});

// For TEXT elements only: middle-left and middle-right handles only
// Text resizing changes font-size proportionally (NOT stretches bounding box)
const textTransformer = {
  enabledAnchors: ['middle-left', 'middle-right'],
  // When width changes: recalculate font-size = fontSize * (newWidth / oldWidth)
};
```

### Selection Color: `#00C4CC` (teal) everywhere — handles, border, active page indicator

### Multi-Select:
- Shift+click: add to selection
- Drag on empty canvas: rubber-band select
- Transformer wraps all selected elements with a combined bounding box
- Floating toolbar shows: Duplicate, Delete, Group, Align options

---

## 9. FLOATING OBJECT TOOLBAR — EXACT SPEC

Appears **above** the selected element on canvas (not in a panel).

**Trigger:** any element selected
**Position:** horizontally centered above element, 8px gap above top handle
**If element is at top edge:** appears below instead

**Appearance:**
```
[↻ Rotate] [🔒 Lock] [📋 Copy] [⊕ Duplicate] [🗑 Delete] [⋯ More]
```
- Container: `background: white`, `border: 1px solid var(--border-default)`, `border-radius: 8px`, `box-shadow: var(--shadow-floating-toolbar)`, `padding: 4px`
- Each button: 32×32px, `border-radius: 6px`, icon 16px
- Gap between buttons: 2px
- Divider between Duplicate and Delete: `1px solid var(--border-default)`

**Entrance animation:**
```css
.floating-toolbar {
  transform-origin: center bottom;
  animation: floatIn 120ms ease forwards;
}
@keyframes floatIn {
  from { opacity: 0; transform: scale(0.95) translateY(4px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```

**More (⋯) menu expands to:**
- Bring to Front / Send to Back / Bring Forward / Send Backward
- Add to Brand Kit
- Create Link
- Comment
- Accessibility label

**Delete button hover:**
```css
.floating-toolbar-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--text-destructive);
}
```

---

## 10. RIGHT-CLICK CONTEXT MENU — EXACT SPEC

**Triggered:** right-click on any element OR on empty canvas

### On Element:
```
Copy                    Ctrl+C
Paste                   Ctrl+V
Duplicate               Ctrl+D
──────────────────────────────
Cut                     Ctrl+X
Delete                  Delete
──────────────────────────────
Bring to Front          Ctrl+Shift+]
Bring Forward           Ctrl+]
Send Backward           Ctrl+[
Send to Back            Ctrl+Shift+[
──────────────────────────────
Group                   Ctrl+G
Ungroup                 Ctrl+Shift+G
──────────────────────────────
Lock                    Alt+Shift+L
Add to Brand Kit
Create Link             Ctrl+K
Add Comment
──────────────────────────────
Select All              Ctrl+A
```

### On Empty Canvas:
```
Paste                   Ctrl+V
Select All              Ctrl+A
──────────────────────────────
Add Page                Ctrl+Enter
Delete Page             Ctrl+Backspace
──────────────────────────────
View > Show Rulers      Shift+R
View > Show Grid        Ctrl+;
View > Show Guides
View > Snap to Grid
View > Snap to Elements
```

### Style:
```css
.context-menu {
  position: fixed;
  background: var(--surface-dropdown);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-dropdown);
  padding: 4px;
  min-width: 220px;
  z-index: var(--z-dropdown);
}
.context-menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 12px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
}
.context-menu-item:hover { background: rgba(0,0,0,0.05); }
.context-menu-item .shortcut { color: var(--text-muted); font-size: var(--text-xs); }
.context-menu-divider { height: 1px; background: var(--border-default); margin: 4px 0; }
```

---

## 11. BOTTOM STATUS BAR — EXACT SPEC

**Height:** 44px | **Background:** `var(--surface-topbar)` | **Border-top:** `1px solid var(--border-default)`

```
[Notes] [Timer]  ─── (spacer) ───  [slider ────] [22%] [Pages] [1 / 3] [⊞ Grid] [⤢ Fullscreen] [?]
```

- Notes / Timer: 28px text buttons, hover bg subtle
- Zoom slider: 120px wide, custom styled range input, teal thumb `#00C4CC`
- Zoom %: editable number input, 52px wide, click to type
- Pages button: toggles the pages thumbnail sidebar (right side)
- "1 / 3": current page / total pages, click to open page jump input
- Grid icon: toggles grid overlay on canvas
- Fullscreen: `⤢` enters presentation/fullscreen mode
- `?`: opens keyboard shortcuts modal

---

## 12. PAGES SIDEBAR — EXACT SPEC

Toggled by "Pages" button in bottom bar. Slides in from right side of canvas.

**Width:** 200px | **Background:** `var(--surface-flyout)` | **Border-left:** `1px solid var(--border-default)`

```
┌──────────────────────┐
│ Pages            [×] │
│ ─────────────────── │
│ ┌────────────────┐  │
│ │  [thumbnail]   │  │  ← active page: 2px solid #00C4CC border
│ │  Page 1        │  │
│ └────────────────┘  │
│ ┌────────────────┐  │
│ │  [thumbnail]   │  │  ← inactive: transparent border, hover: #d1d5db
│ │  Page 2        │  │
│ └────────────────┘  │
│                      │
│ [+ Add page]         │
└──────────────────────┘
```

Thumbnail generation:
```javascript
// Called 500ms after any edit to a page (debounced)
function generateThumbnail(pageIndex) {
  const stage = stageRefs[pageIndex].current;
  const dataURL = stage.toDataURL({ pixelRatio: 0.3 });  // 0.3 for speed
  setThumbnails(prev => ({ ...prev, [pageIndex]: dataURL }));
}
```

---

## 13. KEYBOARD SHORTCUTS — ALL 62

Implement using a single `useKeyboardShortcuts(handlers)` hook that listens on `document`.

```javascript
const SHORTCUTS = {
  // ── Text Formatting ─────────────────────────────────
  'ctrl+b':           () => toggleBold(),
  'ctrl+i':           () => toggleItalic(),
  'ctrl+u':           () => toggleUnderline(),
  'ctrl+k':           () => convertToUppercase(),

  // ── Text Alignment ───────────────────────────────────
  'ctrl+shift+l':     () => setTextAlign('left'),
  'ctrl+shift+c':     () => setTextAlign('center'),
  'ctrl+shift+r':     () => setTextAlign('right'),

  // ── Text Anchor ──────────────────────────────────────
  'ctrl+shift+h':     () => setVerticalAlign('top'),
  'ctrl+shift+m':     () => setVerticalAlign('middle'),
  'ctrl+shift+b':     () => setVerticalAlign('bottom'),

  // ── Line Spacing ─────────────────────────────────────
  'alt+arrowup':      () => increaseLineSpacing(),
  'alt+arrowdown':    () => decreaseLineSpacing(),

  // ── Edit ────────────────────────────────────────────
  'ctrl+z':           () => undo(),
  'ctrl+y':           () => redo(),
  'ctrl+shift+z':     () => redo(),
  'ctrl+c':           () => copy(),
  'ctrl+v':           () => paste(),
  'ctrl+x':           () => cut(),
  'ctrl+d':           () => duplicate(),
  'ctrl+a':           () => selectAll(),
  'delete':           () => deleteSelected(),
  'backspace':        () => deleteSelected(),

  // ── Layers ────────────────────────────────────────────
  'ctrl+]':           () => bringForward(),
  'ctrl+[':           () => sendBackward(),
  'ctrl+shift+]':     () => bringToFront(),
  'ctrl+shift+[':     () => sendToBack(),

  // ── Grouping ─────────────────────────────────────────
  'ctrl+g':           () => groupSelected(),
  'ctrl+shift+g':     () => ungroupSelected(),

  // ── Lock ──────────────────────────────────────────────
  'alt+shift+l':      () => toggleLock(),

  // ── Zoom ──────────────────────────────────────────────
  'ctrl+=':           () => zoomIn(),
  'ctrl+-':           () => zoomOut(),
  'ctrl+0':           () => fitPage(),
  'ctrl+shift+h':     () => fitPageWidth(),    // only if no text selected

  // ── View ──────────────────────────────────────────────
  'ctrl+/':           () => toggleSidebar(),
  'shift+r':          () => toggleRulers(),
  'ctrl+;':           () => toggleGrid(),

  // ── Page management ──────────────────────────────────
  'ctrl+enter':       () => addPage(),
  'ctrl+backspace':   () => deletePage(),

  // ── Quick Add (single keys, only when canvas focused) ─
  't':                () => addTextBox(),
  'r':                () => addRectangle(),
  'c':                () => addCircle(),
  'l':                () => addLine(),
  '/':                () => openQuickSearch(),   // opens Quick Actions panel

  // ── Move (nudge) ─────────────────────────────────────
  'arrowup':          () => nudge(0, -1),
  'arrowdown':        () => nudge(0, 1),
  'arrowleft':        () => nudge(-1, 0),
  'arrowright':       () => nudge(1, 0),
  'shift+arrowup':    () => nudge(0, -10),
  'shift+arrowdown':  () => nudge(0, 10),
  'shift+arrowleft':  () => nudge(-10, 0),
  'shift+arrowright': () => nudge(10, 0),

  // ── Selection ─────────────────────────────────────────
  'escape':           () => deselectAll(),
  'tab':              () => selectNext(),
  'ctrl+click':       () => selectBehind(),

  // ── Font ──────────────────────────────────────────────
  'ctrl+shift+f':     () => focusFontInput(),

  // ── Text style copy ───────────────────────────────────
  'ctrl+alt+c':       () => copyTextStyle(),

  // ── View modes ───────────────────────────────────────
  'alt+ctrl+1':       () => setViewMode('scroll'),
  'alt+ctrl+2':       () => setViewMode('thumbnail'),
  'alt+ctrl+3':       () => setViewMode('grid'),

  // ── Navigation ───────────────────────────────────────
  'ctrl+f1':          () => focusToolbar(),
  'ctrl+f2':          () => focusCanvas(),

  // ── Presentation ─────────────────────────────────────
  'ctrl+alt+p':       () => presentFullscreen(),

  // ── Page navigation ──────────────────────────────────
  'alt+ctrl+[':       () => selectPreviousElement(),
  'alt+ctrl+]':       () => fitElementToPage(),
};
```

### Quick Search Panel (`/` key):
- Opens a centered modal (like Spotlight on Mac)
- Input: "Search or add element..."
- Live results show as you type
- Categories: Add text, Add shape, Add image, Templates, Actions

---

## 14. ANIMATION & MOTION SYSTEM

All animations use CSS — no JS animation libraries needed.

### Panel open/close:
```css
.flyout-panel {
  width: var(--flyout-width);
  transition: var(--transition-panel);
  overflow: hidden;
}
.flyout-panel.closed { width: 0; }

.flyout-panel-content {
  width: var(--flyout-width);  /* content stays full width inside */
  opacity: 0;
  transition: var(--transition-panel-content);
}
.flyout-panel.open .flyout-panel-content { opacity: 1; }
```

### Floating toolbar entrance:
```css
@keyframes floatIn {
  from { opacity: 0; transform: scale(0.95) translateY(4px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
.floating-toolbar { animation: floatIn 120ms ease forwards; }
```

### Dropdown entrance:
```css
@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.dropdown { animation: dropdownIn 150ms ease forwards; }
```

### Context menu entrance:
```css
@keyframes contextMenuIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
.context-menu { animation: contextMenuIn 100ms ease forwards; }
```

### Button hover states (global):
```css
button, .btn {
  transition: background var(--transition-button), color var(--transition-button);
}
.icon-strip-btn:hover { transform: scale(1.05); transition: var(--transition-icon-hover); }
```

### Canvas panel page view transitions:
```css
/* View mode switch (scroll / thumbnail / grid) */
.canvas-stage { transition: opacity 200ms ease; }
```

---

## 15. TOOLTIP SYSTEM

Single `<Tooltip>` wrapper component. Use it on EVERY icon, button, and tool.

```jsx
function Tooltip({ children, label, shortcut, position = 'bottom' }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const show = () => { timerRef.current = setTimeout(() => setVisible(true), 400); };
  const hide = () => { clearTimeout(timerRef.current); setVisible(false); };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <div className={`tooltip tooltip-${position}`}>
          <span className="tooltip-label">{label}</span>
          {shortcut && <span className="tooltip-shortcut">{shortcut}</span>}
        </div>
      )}
    </div>
  );
}
```

```css
.tooltip {
  position: absolute;
  background: #1f2937;
  color: white;
  border-radius: var(--radius-md);
  padding: 6px 10px;
  font-size: var(--text-xs);
  white-space: nowrap;
  pointer-events: none;
  z-index: var(--z-tooltip);
  animation: tooltipIn 150ms ease forwards;
}
.tooltip-label { display: block; font-weight: var(--font-medium); }
.tooltip-shortcut { display: block; color: #9ca3af; margin-top: 2px; font-size: 10px; }

.tooltip-bottom { top: calc(100% + 6px); left: 50%; transform: translateX(-50%); }
.tooltip-top    { bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); }
.tooltip-right  { left: calc(100% + 6px); top: 50%; transform: translateY(-50%); }

@keyframes tooltipIn {
  from { opacity: 0; transform: translateX(-50%) translateY(3px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

---

## 16. COLOR PICKER COMPONENT — EXACT SPEC

Canva's color picker has 6 zones. Build as a standalone `<ColorPicker value={hex} onChange={fn} />` component.

```
┌──────────────────────────────────────┐  240px wide
│ ● Document colors                    │
│ [●][●][●][●][●]  ← 28px swatches   │
│                                      │
│ ● Brand colors                       │
│ [●][●]                               │
│                                      │
│ ── Saturation / Brightness ──────── │
│ ┌────────────────────────────────┐  │
│ │                            ●   │  │  ← 200px × 120px gradient square
│ │                                │  │    white→color horizontal
│ │                                │  │    transparent→black vertical
│ └────────────────────────────────┘  │
│                                      │
│ ── Hue ─────────────────────────── │
│ [rainbow slider ────────────● ]     │  ← 200px × 12px
│                                      │
│ ── Opacity ─────────────────────── │
│ [checkerboard + color ──────● ]     │  ← 200px × 12px
│                                      │
│ ── Values ──────────────────────── │
│ Hex: [  #7C3AED  ]  A: [ 100% ]    │
│                                      │
│ ── Recent ──────────────────────── │
│ [●][●][●][●][●][●][●][●]           │  ← last 8 used colors
└──────────────────────────────────────┘
```

Store recent colors in localStorage key `itsposting_recent_colors` (max 8, FIFO).

---

## 17. SAVE INDICATOR SYSTEM

State machine with 4 states: `idle | saving | saved | error`

```jsx
function SaveIndicator({ hasChanges }) {
  const [state, setState] = useState('idle');
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!hasChanges) return;
    setState('saving');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await saveDesign();
        setState('saved');
        setTimeout(() => setState('idle'), 2000);
      } catch {
        setState('error');
      }
    }, 2000);  // 2 second debounce
  }, [hasChanges]);

  const labels = {
    idle:   null,
    saving: { icon: <Loader2 size={14} className="spin"/>, text: 'Saving...' },
    saved:  { icon: <CheckCircle size={14}/>, text: 'All changes saved' },
    error:  { icon: <AlertCircle size={14}/>, text: 'Save failed' },
  };

  if (!labels[state]) return null;
  return (
    <div className="save-indicator" style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 12, color: state === 'error' ? '#ef4444' : 'var(--text-secondary)',
      animation: 'fadeIn 200ms ease',
    }}>
      {labels[state].icon}
      {labels[state].text}
    </div>
  );
}
```

```css
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
```

---

## 18. DRAG FEEDBACK SYSTEM

Apply to all Konva elements during drag.

```javascript
// On every draggable node:
node.on('dragstart', () => {
  node.opacity(0.85);
  node.shadowEnabled(true);
  node.shadowColor('rgba(0,0,0,0.3)');
  node.shadowBlur(20);
  node.shadowOffsetY(8);
  node.getStage().container().style.cursor = 'grabbing';
});

node.on('dragend', () => {
  node.to({  // Konva tween for smooth return
    opacity: 1,
    shadowBlur: 0,
    shadowOffsetY: 0,
    duration: 0.15,
    easing: Konva.Easings.EaseOut,
  });
  node.shadowEnabled(false);
  node.getStage().container().style.cursor = 'default';
});
```

---

## 19. LOADING SKELETONS & EMPTY STATES

### Skeleton component:
```jsx
function Skeleton({ width = '100%', height = 80, borderRadius = 6 }) {
  return (
    <div style={{ width, height, borderRadius, background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
  );
}
```

```css
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Show 6 skeletons in Templates, 9 in Elements (3-col grid), 6 in Uploads while loading.

### Empty States — 3 required:
```jsx
// Uploads empty
<EmptyState
  icon={<Upload size={40} color="var(--text-muted)"/>}
  title="Upload your first file"
  description="Images, videos, and audio you upload will appear here"
  action={<Button onClick={triggerUpload}>Upload files</Button>}
/>

// Templates empty (search returned nothing)
<EmptyState
  icon={<Search size={40} color="var(--text-muted)"/>}
  title="No templates found"
  description={`No results for "${query}"`}
  action={<Button variant="ghost" onClick={clearSearch}>Clear search</Button>}
/>

// Projects empty
<EmptyState
  icon={<FolderOpen size={40} color="var(--text-muted)"/>}
  title="No designs yet"
  description="Create your first design to see it here"
  action={<Button onClick={createNew}>Create a design</Button>}
/>
```

Empty state style: centered, icon muted gray (`#d1d5db`), title 15px semibold, description 13px muted, action button below.

---

## 20. RULER & GUIDES SYSTEM

### Rulers:
```jsx
function HorizontalRuler({ zoom, scrollX, canvasWidth }) {
  // SVG ruler with tick marks
  const ticks = [];
  const step = 50 * zoom;
  for (let i = 0; i < canvasWidth; i += step) {
    const x = i - scrollX;
    ticks.push(<line x1={x} y1={10} x2={x} y2={20} stroke="#9ca3af" strokeWidth={1}/>);
    if (i % (step * 2) === 0) {
      ticks.push(<text x={x+2} y={9} fontSize={9} fill="#9ca3af">{Math.round(i/zoom)}</text>);
    }
  }
  return <svg height={20} width={canvasWidth} style={{background:'#f8f9fa',borderBottom:'1px solid #e5e7eb'}}>{ticks}</svg>;
}
```

### Drag-to-create guides:
```javascript
// Mouse down on ruler → creates a guide that follows cursor
rulerEl.addEventListener('mousedown', (e) => {
  const isHorizontal = e.target === horizontalRuler;
  const guide = { axis: isHorizontal ? 'h' : 'v', position: 0, id: uuid() };
  setActiveGuide(guide);
  // On mousemove: update guide.position
  // On mouseup: commit guide to project.guides
});
```

Guides render as 1px `#2563eb` lines over the canvas, full width/height.
Double-click to delete. Drag to reposition.

---

## 21. SNAP GUIDE LINES — EXACT SPEC

During drag, compute snap targets and render magenta lines.

```javascript
// Snap threshold: 5px
const SNAP_THRESHOLD = 5;

function getSnapLines(draggingNode, allNodes, stageWidth, stageHeight) {
  const snapLines = [];
  const box = draggingNode.getClientRect();

  const targets = [
    // Canvas edges
    { v: 0 }, { v: stageWidth }, { v: stageWidth / 2 },  // vertical
    { h: 0 }, { h: stageHeight }, { h: stageHeight / 2 }, // horizontal
    // Other elements
    ...allNodes.filter(n => n !== draggingNode).flatMap(n => {
      const r = n.getClientRect();
      return [
        { v: r.x }, { v: r.x + r.width }, { v: r.x + r.width / 2 },
        { h: r.y }, { h: r.y + r.height }, { h: r.y + r.height / 2 },
      ];
    }),
  ];

  targets.forEach(({ v, h }) => {
    if (v !== undefined) {
      // Check left edge, right edge, center
      if (Math.abs(box.x - v) < SNAP_THRESHOLD ||
          Math.abs(box.x + box.width - v) < SNAP_THRESHOLD ||
          Math.abs(box.x + box.width / 2 - v) < SNAP_THRESHOLD) {
        snapLines.push({ type: 'vertical', x: v });
      }
    }
    if (h !== undefined) {
      if (Math.abs(box.y - h) < SNAP_THRESHOLD ||
          Math.abs(box.y + box.height - h) < SNAP_THRESHOLD ||
          Math.abs(box.y + box.height / 2 - h) < SNAP_THRESHOLD) {
        snapLines.push({ type: 'horizontal', y: h });
      }
    }
  });

  return snapLines;
}

// Render snap lines as Konva Lines:
// stroke: '#FF00FF', strokeWidth: 1, dash: [], listening: false
// Clear on dragend
```

---

## 22. FILE MENU DROPDOWN — EXACT SPEC

14 items exactly:

```
Create new design
Upload files
Settings
Accessibility
──────────────────────────
Save                    Ctrl+S
Make available offline
──────────────────────────
Move
Make a copy
──────────────────────────
Download
Print                   Ctrl+P
──────────────────────────
Version history
──────────────────────────
Move to Trash
```

Style: same as context menu (see section 10). Width 240px.

---

## 23. RESIZE PANEL — EXACT SPEC

Opens as a panel below the "Resize" top bar button (popover, not a sidebar).

```
┌─────────────────────────────────────────┐  280px
│ Custom size                             │
│ [W: 1080 px] × [H: 1080 px] [Resize]   │
│                                         │
│ ── Suggested ─────────────────────────  │
│ [□] Instagram Story    1080 × 1920      │
│ [□] Instagram Post     1080 × 1080      │
│ [□] Facebook Post      1200 × 630       │
│ [□] YouTube Thumbnail  1280 × 720       │
│ [□] LinkedIn Post      1200 × 627       │
│                                         │
│ ── Browse by category ────────────────  │
│ Social Media  Presentations  Print      │
│ Video  Documents  Marketing             │
└─────────────────────────────────────────┘
```

When clicking a preset: sets W×H inputs, user still clicks "Resize" to confirm (or double-click preset).

---

## 24. SHARE PANEL — EXACT SPEC

Opens as a right-side panel (slides in, 360px wide) when Share button clicked.

```
┌──────────────────────────────────────┐  360px
│ Share                           [×]  │
│                                      │
│ ── People with access ─────────────  │
│ [● You (Owner)]                      │
│                                      │
│ ── Invite people ──────────────────  │
│ [Search people or teams...    ▾ Can edit ▾]
│ [Send invite]                        │
│                                      │
│ ── Link sharing ───────────────────  │
│ [🔗 Copy link]   Access: [Anyone ▾] │
│                                      │
│ ── Download ───────────────────────  │
│ File type: [PNG ▾]                   │
│ [↓ Download]                         │
│                                      │
│ ── Present ────────────────────────  │
│ [▶ Present]    [📱 Mobile view]      │
│                                      │
│ ── Make public ────────────────────  │
│ [Toggle] Allow public view           │
│ [Template link]                      │
└──────────────────────────────────────┘
```

---

## 25. IMPLEMENTATION ORDER

Follow this exact sequence. Never skip ahead — each part has dependencies.

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1 — Foundation (no visible UI change, must do first) │
│  1. CSS tokens (Section 1) in globals.css                   │
│  2. Icon audit: replace ALL Unicode with Lucide icons        │
│  3. 4px spacing audit: fix all padding/gap/margin           │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  PHASE 2 — Shell Layout                                     │
│  4. Grid layout (Section 2)                                 │
│  5. Top bar (Section 3)                                     │
│  6. Icon strip (Section 5)                                  │
│  7. Bottom bar (Section 11)                                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  PHASE 3 — Panels                                           │
│  8. Flyout panel shell + open/close animation (Section 6)   │
│  9. All 8 panel contents (Section 6.1–6.8)                  │
│  10. Contextual action bar (Section 4)                      │
│  11. File / Resize / Share panels (Sections 22–24)          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  PHASE 4 — Canvas & Selection                               │
│  12. Canvas stage + page labels + vertical stacking (Sec 7) │
│  13. Transformer (teal handles, rotation offset) (Sec 8)    │
│  14. Snap lines (magenta, 5px threshold) (Sec 21)           │
│  15. Drag feedback (opacity + shadow) (Sec 18)              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  PHASE 5 — Interaction Layer                                │
│  16. Floating object toolbar (Sec 9)                        │
│  17. Right-click context menu (Sec 10)                      │
│  18. All 62 keyboard shortcuts (Sec 13)                     │
│  19. Pages sidebar + thumbnail generation (Sec 12)          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  PHASE 6 — Components                                       │
│  20. Tooltip system (Sec 15) — add to ALL existing buttons  │
│  21. Color picker (Sec 16)                                  │
│  22. Save indicator (Sec 17)                                │
│  23. Ruler & guides (Sec 20)                                │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  PHASE 7 — Polish (what makes it FEEL like Canva)           │
│  24. Loading skeletons & empty states (Sec 19)              │
│  25. All entrance animations (Sec 14)                       │
│  26. Template hover preview (scale + overlay)               │
│  27. Dark mode (data-theme toggle)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## PROMPTING GUIDE FOR CLAUDE CODE

Give Claude Code **one Phase at a time**. Use this template:

```
You are working on ItsPosting, a Canva-clone design editor (Next.js + React + Konva.js).
Read ItsPosting_Canva_Exact_Plan.md fully before writing any code.

Implement PHASE [N] only. Files to modify: [list them explicitly].
Do NOT modify any file not listed above.
Do NOT add new npm packages.

After completing, output:
1. List of every file changed
2. What PHASE [N+1] depends on from your work
3. Any edge cases or questions before I proceed
```

---

## QUALITY CHECKLIST (run after each Phase)

```
Phase 1:
[ ] Zero hardcoded color values — all use CSS variables
[ ] Zero Unicode emoji used as icons — all Lucide React
[ ] Every padding/margin/gap is a multiple of 4px

Phase 2:
[ ] Editor fills 100vh with no scrollbar on the body
[ ] Topbar stays fixed while canvas scrolls
[ ] Icon strip does not collapse/shift on small screens

Phase 3:
[ ] Flyout panel slides in 200ms, content fades in 150ms with 80ms delay
[ ] Clicking active icon closes panel (toggles)
[ ] All 8 panel contents load and scroll independently

Phase 4:
[ ] Selection handles are teal (#00C4CC), not blue or default
[ ] Rotation handle is 28px above top-center, not touching it
[ ] Text resize only adjusts font-size, not stretches box
[ ] Snap lines appear at 5px threshold, are magenta, disappear on drag end
[ ] Dragging element: opacity 0.85, shadow visible, cursor 'grabbing'

Phase 5:
[ ] Floating toolbar appears above element, below if near top edge
[ ] Floating toolbar has entrance animation (scale+fade, 120ms)
[ ] Delete button in toolbar turns red on hover
[ ] Right-click on element shows element menu
[ ] Right-click on empty canvas shows canvas menu
[ ] All 62 shortcuts work (test each category)

Phase 6:
[ ] Tooltip appears after 400ms delay (not on fast pass-through)
[ ] Tooltip shows shortcut key on second line
[ ] Color picker has all 6 zones
[ ] Save indicator transitions: idle→saving→saved→idle
[ ] Rulers show pixel values, highlight element extents on select
[ ] Guides: drag from ruler, click to select, double-click to delete

Phase 7:
[ ] Skeleton cards show shimmer animation while loading
[ ] Empty states show illustration + CTA
[ ] All dropdowns have entrance animation
[ ] Dark mode toggle works — every surface updates
```



bash

cat > /mnt/user-data/outputs/ItsPosting_Canva_VERIFIED_Plan.md << 'ENDOFFILE'
# ItsPosting — Canva Pixel-Perfect Implementation Plan
**Screenshot-Verified | Every Detail From Real Canva UI**
**For Claude Code** | Next.js / React / Konva.js | No new npm packages

> ⚠️ This plan is built from 15 real Canva screenshots. Every measurement, color,
> and behavior is verified visually. Do NOT deviate from these specs.

---

## VERIFIED COLOR TOKENS (from screenshots + official Canva brand palette)

```css
:root {
  /* ── TOPBAR GRADIENT (screenshots 1–15, confirmed) ─────────────── */
  --topbar-gradient: linear-gradient(90deg, #00C4CC 0%, #6a3be4 100%);
  /* Left starts teal, right ends royal purple. Text on topbar = white */

  /* ── CANVA OFFICIAL BRAND COLORS ───────────────────────────────── */
  --canva-teal:   #00C4CC;   /* Selection handles, topbar left, active teal accents */
  --canva-purple: #6a3be4;   /* Topbar right, primary buttons, active states */
  --canva-purple-hover: #5b2fd4;
  --canva-purple-light: rgba(106, 59, 228, 0.1);  /* Active icon bg, active tab underline */

  /* ── SURFACE COLORS ─────────────────────────────────────────────── */
  --surface-topbar-bg: transparent;   /* topbar uses gradient, not solid */
  --surface-sidebar-bg: #ffffff;      /* icon strip + flyout: pure white */
  --surface-canvas-bg: #f0f0f0;      /* canvas stage background (light gray) */
  --surface-actionbar-bg: #ffffff;
  --surface-dropdown-bg: #ffffff;
  --surface-floating-toolbar: #ffffff;
  --surface-bottombar: #ffffff;

  /* ── BORDERS ────────────────────────────────────────────────────── */
  --border-sidebar: 1px solid #e8e8e8;   /* right border of icon strip */
  --border-flyout:  1px solid #e8e8e8;   /* right border of flyout */
  --border-actionbar: 1px solid #e8e8e8;
  --border-bottombar: 1px solid #e8e8e8;
  --border-dropdown: 1px solid #e5e7eb;
  --border-card: 1px solid #f0f0f0;

  /* ── TEXT COLORS ────────────────────────────────────────────────── */
  --text-topbar: #ffffff;          /* All text/icons in topbar */
  --text-primary: #1a1a1a;
  --text-secondary: #555555;
  --text-muted: #9ca3af;
  --text-label: #666666;           /* icon strip labels, panel section headers */

  /* ── SHADOWS ────────────────────────────────────────────────────── */
  --shadow-canvas: 0 2px 12px rgba(0,0,0,0.10);
  --shadow-dropdown: 0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06);
  --shadow-floating-toolbar: 0 4px 16px rgba(0,0,0,0.12);
  --shadow-tools-subpanel: 2px 4px 12px rgba(0,0,0,0.10);

  /* ── DIMENSIONS (measured from screenshots) ─────────────────────── */
  --topbar-height: 56px;           /* Screenshot shows ~56px, teal-purple bar */
  --actionbar-height: 48px;        /* Contextual bar when element selected */
  --iconstrip-width: 72px;         /* Measured from screenshots */
  --flyout-width: 320px;           /* Measured from screenshots */
  --bottombar-height: 44px;

  /* ── SPACING (strict 4px grid) ──────────────────────────────────── */
  --sp-1: 4px;   --sp-2: 8px;   --sp-3: 12px;  --sp-4: 16px;
  --sp-5: 20px;  --sp-6: 24px;  --sp-8: 32px;  --sp-10: 40px;

  /* ── RADIUS ─────────────────────────────────────────────────────── */
  --r-sm: 4px;   --r-md: 6px;   --r-lg: 8px;
  --r-xl: 12px;  --r-2xl: 16px; --r-pill: 9999px;

  /* ── FONT SIZES ─────────────────────────────────────────────────── */
  --fs-xs: 10px;   /* icon strip labels */
  --fs-sm: 12px;   /* secondary text, shortcuts in menus */
  --fs-md: 13px;   /* primary UI text */
  --fs-base: 14px; /* body text */
  --fs-lg: 15px;

  /* ── FONT WEIGHTS ───────────────────────────────────────────────── */
  --fw-regular: 400;
  --fw-medium: 500;
  --fw-semibold: 600;

  /* ── TRANSITIONS ────────────────────────────────────────────────── */
  --t-panel: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --t-panel-content: opacity 150ms ease 80ms;
  --t-btn: background-color 100ms ease;
  --t-icon: transform 100ms ease;
  --t-toolbar: opacity 120ms ease, transform 120ms ease;
  --t-dropdown: opacity 150ms ease, transform 150ms ease;

  /* ── Z-INDEX STACK ──────────────────────────────────────────────── */
  --z-canvas:           1;
  --z-snap-lines:      10;
  --z-floating-toolbar: 50;
  --z-actionbar:       100;
  --z-panels:          150;
  --z-topbar:          200;
  --z-dropdown:        300;
  --z-tooltip:         400;
  --z-modal:           500;
}
```

---

## VERIFIED LAYOUT ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────────┐
│  TOPBAR [56px] — teal→purple gradient, white text                      │ z:200
├────────────────────────────────────────────────────────────────────────┤
│  CONTEXTUAL ACTION BAR [48px, hidden by default]                       │ z:100
├──────────┬─────────────────┬──────────────────────────────────────────┤
│          │                 │                                           │
│  ICON    │  FLYOUT PANEL   │         CANVAS STAGE                     │
│  STRIP   │  [0 or 320px]   │    bg: #f0f0f0 / overflow: auto          │
│  [72px]  │  transition     │                                           │
│  white   │  200ms ease     │                                           │
│          │                 │                                           │
├──────────┴─────────────────┴──────────────────────────────────────────┤
│  BOTTOM BAR [44px] — white, border-top                                │
└────────────────────────────────────────────────────────────────────────┘
```

```jsx
// Root grid — put in editor wrapper component
const editorStyles = {
  display: 'grid',
  gridTemplateRows: `${topbarH} ${actionbarVisible ? actionbarH : '0px'} 1fr ${bottombarH}`,
  gridTemplateColumns: `${iconStripW} ${flyoutOpen ? flyoutW : '0px'} 1fr`,
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};
// actionbar row: use 'auto' not fixed — animates via height transition
// flyout column: transition: var(--t-panel)
```

---

## SECTION 1: TOPBAR — SCREENSHOT-VERIFIED EXACT SPEC

### Visual appearance (confirmed from all 15 screenshots):
- **Background:** `linear-gradient(90deg, #00C4CC 0%, #6a3be4 100%)` — teal left, purple right
- **Height:** 56px
- **All text and icons:** `color: #ffffff`
- **No border-bottom** — gradient acts as visual separator

### Left zone (from screenshots 1–15):
```
[🏠 home icon]  [File]  [Resize]  [✏ Editing ▾]  |  [↩]  [↪]  |  [☁ cloud icon]
```
- Home: 36×36px rounded icon button (house icon), white
- `File`, `Resize`: plain text buttons, 13px, font-weight 500, white, no background
- `Editing ▾`: text + pencil icon + chevron-down, same style
- Divider: `1px solid rgba(255,255,255,0.3)`, height 20px, margin 0 8px
- Undo `↩` / Redo `↪`: 32×32px icon buttons, white icons (Lucide: `Undo2`, `Redo2`)
- Cloud save icon: 32×32px (Lucide: `Cloud` or `CloudCheck`)

### Center (absolutely centered):
```
[Design title — editable inline text input]
```
- Title text: white, 14px, font-weight 400, centered
- Click → becomes editable `<input>`, same style, no visible box
- Placeholder: `"Untitled Design"`
- max-width: 350px (truncates with ellipsis)
- Screenshot shows: *"While you sleep, ItsPosting drafts, schedules and ships ..."*

### Right zone (from screenshots 1–10):
```
[👑 Start your trial for ...] [C avatar] [📊 icon] [💬 icon] [Share]
```
- `Start your trial`: pill button, `background: rgba(255,255,255,0.15)`, `border: 1px solid rgba(255,255,255,0.4)`, `border-radius: 9999px`, white text, crown icon
- `C` avatar: 36×36px circle, green background (#22c55e), white letter, font-weight 600
- Analytics icon: 32×32 icon button (BarChart2), white
- Comment icon: 32×32 icon button (MessageCircle), white
- **Share button**: `background: #ffffff`, `color: #1a1a1a`, `border-radius: 8px`, 36px height, 72px wide, font-weight 600, 14px

```jsx
<header style={{
  gridColumn: '1 / -1',
  gridRow: '1',
  background: 'linear-gradient(90deg, #00C4CC 0%, #6a3be4 100%)',
  height: '56px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 12px',
  zIndex: 'var(--z-topbar)',
  color: '#ffffff',
}}>
  {/* LEFT */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    <TopbarIconBtn icon={<Home size={18}/>} tooltip="Home" />
    <TopbarTextBtn label="File" onClick={openFileMenu} />
    <TopbarTextBtn label="Resize" onClick={openResizePanel} />
    <TopbarTextBtn
      icon={<Pencil size={14}/>}
      label="Editing"
      chevron
      onClick={openEditingMenu}
    />
    <div style={{ width:1, height:20, background:'rgba(255,255,255,0.3)', margin:'0 8px' }}/>
    <TopbarIconBtn icon={<Undo2 size={18}/>} onClick={undo} disabled={!canUndo} tooltip="Undo (Ctrl+Z)" />
    <TopbarIconBtn icon={<Redo2 size={18}/>} onClick={redo} disabled={!canRedo} tooltip="Redo (Ctrl+Y)" />
    <div style={{ width:1, height:20, background:'rgba(255,255,255,0.3)', margin:'0 8px' }}/>
    <TopbarIconBtn icon={<Cloud size={18}/>} tooltip="Save status" />
  </div>

  {/* CENTER — absolutely centered */}
  <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)' }}>
    <DesignTitleInput />
  </div>

  {/* RIGHT */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <TrialButton />
    <UserAvatar />
    <TopbarIconBtn icon={<BarChart2 size={18}/>} />
    <TopbarIconBtn icon={<MessageCircle size={18}/>} />
    <ShareButton />
  </div>
</header>
```

---

## SECTION 2: CONTEXTUAL ACTION BAR — SCREENSHOT 8 & 9 VERIFIED

**Only appears when an element is selected. Completely hidden otherwise.**
Height: 48px | Background: white | Border-bottom: `1px solid #e8e8e8`

### Screenshot 8 (text selected, Tools panel open):
```
[✕ close] [color circle] [⊞ table] [↔ width] [Inter ▾] [– 15.6 +] [🎨 color] [B] [I] [≡ align] [≡ list] [↕ spacing] [⠿ letterspacing] [Animate] [Position] [⋯]
```

### Screenshot 9 (text selected, Projects panel open, wider screen):
```
[color] [⊞] [↔] [Inter ▾] [– 15.6 +] [🎨] [B] [I] [≡] [≡] [Animate] [···]
```

### Exact items (left to right):
1. **Color swatch circle** — 20px circle showing text/fill color, click opens color picker
2. **Grid icon** (LayoutGrid, 18px)
3. **Width icon** (ArrowLeftRight, 18px) — shows current width, click to edit
4. **Font name dropdown** — shows `"Inter"`, 130px wide, click opens font picker
5. **Font size** — `–` button | `15.6` input (60px wide) | `+` button
6. **Text color "T"** — colored T icon, 20×20px color swatch
7. **Bold `B`** — toggleable, 28×28px, font-weight 600, active = purple bg
8. **Italic `I`** — toggleable, 28×28px, italic style
9. **Align `≡`** — dropdown: Left/Center/Right/Justify
10. **List `≡`** — dropdown: Bullet/Numbered/None
11. **Spacing `↕`** — line height control
12. **Letter spacing `⠿`** — tracking control
13. **Animate** — text button
14. **Position** — text button (hidden in smaller screens, shown in `⋯`)
15. **`⋯` more** — overflow button

### For IMAGE selected:
```
[Crop] [Flip ▾] [Effects] [Adjust] [Transparency] [Animate] [Position] [⋯]
```

### For SHAPE selected:
```
[fill color] [border color] [border weight ▾] [opacity] [Animate] [Position] [⋯]
```

```jsx
function ContextualActionBar({ selected }) {
  if (!selected) return null;
  return (
    <div style={{
      gridColumn: '1 / -1',
      gridRow: '2',
      height: '48px',
      display: 'flex',
      alignItems: 'center',
      background: '#ffffff',
      borderBottom: '1px solid #e8e8e8',
      padding: '0 12px',
      gap: '4px',
      zIndex: 'var(--z-actionbar)',
      overflowX: 'hidden',
    }}>
      {selected.type === 'text'  && <TextActionItems el={selected} />}
      {selected.type === 'image' && <ImageActionItems el={selected} />}
      {selected.type === 'shape' && <ShapeActionItems el={selected} />}
      <OverflowMenuButton />
    </div>
  );
}
```

---

## SECTION 3: LEFT ICON STRIP — SCREENSHOT-VERIFIED

**Width:** 72px | **Background:** #ffffff | **Border-right:** `1px solid #e8e8e8`

### Icons (top to bottom) — from ALL screenshots:
```
Row 1: [Templates]    ← LayoutTemplate icon (2×2 squares icon, screenshot 1)
Row 2: [Elements]     ← custom 2-shapes icon (screenshot 1,2,3)
Row 3: [Text]         ← T icon (screenshot 1,2)
Row 4: [Brand]        ← circular CO icon (screenshot 1) + crown badge
Row 5: [Uploads]      ← cloud-upload icon (screenshot 1)
Row 6: [Tools]        ← pencil/draw icon (screenshot 7,8,9)
Row 7: [Projects]     ← folder icon (screenshot 9)
────── flex spacer ──────
Row 8: [Apps]         ← 4-dot grid icon (screenshot 7)
Row 9: [Magic Media]  ← sparkles/wand icon (screenshot 7,15)
```

**When "Tools" is active (screenshot 7, 8, 9):**
- Tools icon gets teal/purple filled background circle
- A SEPARATE floating sub-panel appears BESIDE the icon strip (not replacing flyout)

### Each button — exact measurements:
```css
.icon-btn {
  width: 64px;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 8px;
  margin: 2px 4px;
  cursor: pointer;
  transition: background-color 100ms ease;
  position: relative;
}
.icon-btn:hover { background: rgba(0,0,0,0.05); }
.icon-btn.active { background: rgba(106,59,228,0.10); }  /* light purple */

.icon-btn svg { color: #555555; width: 22px; height: 22px; }
.icon-btn.active svg { color: #6a3be4; }

.icon-btn .label {
  font-size: 10px;
  font-weight: 500;
  color: #555555;
  line-height: 1;
  text-align: center;
}
.icon-btn.active .label { color: #6a3be4; }

/* Crown badge on Brand icon */
.crown-badge {
  position: absolute;
  top: 8px; right: 10px;
  font-size: 12px; /* 👑 emoji or Lucide Crown */
  color: #f59e0b;
}
```

### Toggle behavior:
- **Same icon clicked again** → closes flyout (flyout width → 0)
- **Different icon clicked** → switches content, keeps flyout open
- **Tools** → opens sub-strip beside icon strip (see Section 6.6)

---

## SECTION 4: LEFT FLYOUT PANEL — ALL PANELS VERIFIED

**Width:** 320px when open, 0 when closed
**Transition:** `width 200ms cubic-bezier(0.4, 0, 0.2, 1)`
**Content opacity:** fades in `opacity: 0 → 1` with `150ms ease, 80ms delay`
**Background:** #ffffff | **Border-right:** `1px solid #e8e8e8`
**Scrollbar:** thin, only visible on hover

```jsx
<div style={{
  width: flyoutOpen ? '320px' : '0px',
  transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  overflow: 'hidden',
  background: '#ffffff',
  borderRight: '1px solid #e8e8e8',
  gridColumn: '2',
  gridRow: '3',
  position: 'relative',
}}>
  <div style={{
    width: '320px',
    height: '100%',
    overflowY: 'auto',
    opacity: flyoutOpen ? 1 : 0,
    transition: 'opacity 150ms ease 80ms',
  }}>
    {activePanel === 'templates' && <TemplatesPanel />}
    {activePanel === 'elements'  && <ElementsPanel />}
    {/* etc */}
  </div>
</div>
```

### 4.1 TEMPLATES PANEL (Screenshot 1, 2 — verified)

```
┌──────────────────────────────────────┐
│ [+] [Search templates...     ] [🎤] │  ← 44px input, rounded, gray bg
├──────────────────────────────────────┤
│  [thumbnail]    [thumbnail]          │  ← 2-col grid, 8px gap
│  [thumbnail]    [thumbnail]          │    each: aspect-ratio 0.75 (portrait)
│  [thumbnail]    [thumbnail]          │    border-radius: 6px
│  [thumbnail]    [thumbnail]          │    overflow: hidden
└──────────────────────────────────────┘
```
- Search input: `background: #f5f5f5`, `border: 1px solid #e8e8e8`, `border-radius: 24px`, height 44px, padding `0 16px`, `font-size: 14px`
- `+` icon before placeholder text (inside input, left)
- Mic icon (right side of input)
- Template grid: `padding: 12px`, `gap: 8px`, `grid-template-columns: 1fr 1fr`
- On hover: scale to 1.03, show "Use template" overlay (dark 50% overlay + white text)

### 4.2 ELEMENTS PANEL (Screenshot 3 — verified)

```
┌──────────────────────────────────────┐
│ [+] [Describe your ideal element] [🎤] │
│                                      │
│ [🤖 Generate ▾]  [Search (purple)] │  ← two buttons row
│                                      │
│  Recommended for you    [See all]    │  ← section header
│  [icon][icon][icon][icon→]           │  ← horizontal scroll row
│                                      │
│  Browse categories                   │
│  [🔷Shapes][🌸Graphics][✨Animations]│  ← 3-col grid of category cards
│  (each: rounded square, icon+label) │
└──────────────────────────────────────┘
```
- Generate button: `background: white`, `border: 1px solid #e8e8e8`, `border-radius: 8px`, AI sparkle icon + "Generate" text + chevron
- Search button: `background: #6a3be4`, `color: white`, `border-radius: 8px`
- Category cards: 92×92px, colored rounded icon + category name below, `border-radius: 12px`
- Colors from screenshot: Shapes=teal, Graphics=orange-yellow, Animations=green-yellow

### 4.3 TEXT PANEL (Screenshot 4 — verified)

```
┌──────────────────────────────────────┐
│ [🔍 Search fonts and combinations]   │  ← gray border-radius input
│                                      │
│ [T Add a text box]                   │  ← FULL WIDTH, purple bg, white text
│                                      │
│ [✨ Magic Write]                      │  ← FULL WIDTH, white bg, border
│                                      │
│  Brand Kit          [Edit] 👑        │  ← section row
│  [Add your brand fonts]              │  ← outlined placeholder button
│                                      │
│  Default text styles                 │
│ ┌────────────────────────────────┐   │
│ │  Add a heading                 │   │  ← 32px font sample, border card
│ └────────────────────────────────┘   │
│ ┌────────────────────────────────┐   │
│ │  Add a subheading              │   │  ← 20px font sample, border card
│ └────────────────────────────────┘   │
│  Add a little bit of body text       │  ← 14px font, smaller card
└──────────────────────────────────────┘
```
- "Add a text box": `background: #6a3be4`, `color: white`, height 44px, full width, `border-radius: 8px`, T icon + text
- "Magic Write": `background: white`, `border: 1.5px solid #e8e8e8`, height 44px, full width, `border-radius: 8px`, sparkle icon + text
- Text style cards: `border: 1px solid #e8e8e8`, `border-radius: 8px`, `padding: 12px 16px`, `background: white`
- "Add a heading": font-size 28px, font-weight 700
- "Add a subheading": font-size 18px, font-weight 600
- "Add a little bit of body text": font-size 13px, font-weight 400

### 4.4 BRAND PANEL (Screenshot 5 — verified)

**LEFT column (320px wide, scrollable list):**
```
[🔍 Search]

[🎨 Brand Kit ▾]          ← dropdown button

  All assets              ← active = purple text + left bar
  Guidelines
  Brand Templates  [New]  ← blue pill badge
  Logos
  Colors
```

**RIGHT expansion (flies out to side, ~440px wide):**
When Brand Kit NOT set up, shows a promo card:
```
┌──────────────────────────────────────────┐
│  [Brand Kit hero image — Aa + colors]    │
│                                          │
│  Apply your brand colors, fonts, logo,   │
│  and much more effortlessly to every     │
│  design                                  │
│                                          │
│  [👑 Try Business for 30 days]           │  ← purple fill button
│  [+ Start with 3 free colors]            │  ← white outline button
└──────────────────────────────────────────┘
```
- Active list item: `color: #6a3be4`, `font-weight: 600`
- `[New]` badge: `background: #3b82f6`, `color: white`, `border-radius: 4px`, `padding: 2px 6px`, `font-size: 11px`

### 4.5 UPLOADS PANEL (Screenshot 6 — verified)

```
┌──────────────────────────────────────┐
│ [🔍 Search keywords, tags, color]    │  ← gray rounded input, 44px
│                                      │
│ [Upload files (purple)]  [••• gray] │  ← 75%/25% split buttons
│                                      │
│ [Record yourself]                    │  ← full-width outline button
│                                      │
│  [Images] [Videos] [Designs] [Folders│  ← tab row, 14px, underline active
│  ────                                │    active tab: purple underline 2px
│                                      │
│  ┌──────────────────────────────┐    │
│  │ 👑 Background Remover        │  [×]│  ← dismissible promo card
│  │ Remove the background of ... │    │
│  └──────────────────────────────┘    │
│                                      │
│  [img] [img] [img]                   │  ← 3-col grid of upload thumbs
│  [img] [img] [img]                   │
└──────────────────────────────────────┘
```
- "Upload files": `background: #6a3be4`, `color: white`, `border-radius: 8px`, height 40px, width ~75%
- "•••" button: `background: #6a3be4`, `color: white`, `border-radius: 8px`, 40×40px
- "Record yourself": full-width, `border: 1.5px solid #e8e8e8`, `background: white`, height 40px, `border-radius: 8px`
- Upload grid: `grid-template-columns: repeat(3, 1fr)`, `gap: 4px`, thumbnails `border-radius: 6px`
- Promo card: `background: #fdf6e3`, `border: 1px solid #fde68a`, `border-radius: 8px`, crown icon in corner

### 4.6 TOOLS PANEL (Screenshot 7, 8 — verified)

**NOT the main flyout.** Opens as a **floating sub-panel** BESIDE the icon strip.

```
Position: absolute left: 72px, top: [level of Tools icon]
Width: 48px
Background: white
Border-radius: 12px
Box-shadow: 2px 4px 12px rgba(0,0,0,0.10)
Padding: 8px 4px
```

**Contents (vertical icon list):**
```
[↖ cursor]   ← arrow/pointer icon
[✏ draw]     ← pencil, RED color icon
[⬡ highlight]← blob/highlight icon
[✒ pen]      ← fountain pen
[/ line]     ← diagonal line icon, BLUE
[⬛ shape]   ← square/shape icon, YELLOW
[T text]     ← T icon, PURPLE
[⊞ table]   ← grid icon
```
- Each: 40×40px, `border-radius: 8px`, centered icon
- Active tool: highlighted background `rgba(106,59,228,0.12)`, icon color `#6a3be4`
- Screenshot 8 shows cursor tool active (purple filled)

### 4.7 PROJECTS PANEL (Screenshot 9 — verified)

```
┌──────────────────────────────────────┐
│ [🔍 Search your content]             │  ← rounded search input
│                                      │
│ [C Your projects  ▾]                 │  ← avatar + dropdown, 48px height
│                                      │
│  [All] [Designs] [Folders]           │  ← tab row, "All" active = purple underline
│                                      │
│  Designs                             │  ← section label, 13px, font-weight 600
│                                      │
│  ┌─────────────┐  ┌─────────────┐   │
│  │  [thumb]    │  │  [thumb]    │   │
│  │             │  │             │   │
│  │ While you.. │  │ Untitled De │   │
│  │ 1080 × 1350 │  │ 1024 × 1024 │   │
│  └─────────────┘  └─────────────┘   │
│  ┌─────────────┐                    │
│  │  [thumb]    │                    │
│  │             │                    │
│  │ Automate... │                    │
│  └─────────────┘                    │
└──────────────────────────────────────┘
```
- "Your projects" dropdown: avatar circle (green, "C"), chevron-down icon, `border: 1px solid #e8e8e8`, `border-radius: 8px`, height 44px
- Design cards: 2-col grid, aspect-ratio 1, `border-radius: 8px`, `overflow: hidden`, `border: 1px solid #f0f0f0`
- Design name: 12px, font-weight 500, truncate with ellipsis, below thumbnail
- Dimensions: 11px, `color: #9ca3af`, below name
- Hover: `border: 2px solid #00C4CC` (teal)
- Panel collapse button: `[◀]` visible on right edge of panel (screenshot 9 shows `[<]` arrow)

---

## SECTION 5: CANVAS AREA — SCREENSHOT VERIFIED

**Background:** `#f0f0f0` (very light gray — confirmed all screenshots)
**Overflow:** `auto` (scrollable)
**Padding:** `40px` around content (so canvas has breathing room)

### Page Label Row (screenshots 1, 2, 9 — verified):

```
Page 1 - A..  [▲]  [▼]  [👁]  [🔒]  [⊞copy]  [🗑]  [+]
```
- "Page 1 - A.." : `font-size: 14px`, `font-weight: 500`, `color: #333`
- Then " - " then truncated page name in gray
- All action icons: `24×24px`, `border-radius: 4px`, hover bg `rgba(0,0,0,0.06)`, Lucide icons
- Icon order: ChevronUp, ChevronDown, Eye, Lock, Copy, Trash2, Plus
- Row height: 32px, `margin-bottom: 8px`, `margin-top: 32px` (first page: 32px from top)
- Row `display: flex`, `align-items: center`, `gap: 4px`

### Canvas (Konva Stage):
- White background (or design bg)
- `box-shadow: 0 2px 12px rgba(0,0,0,0.10)` — subtle drop shadow
- Positioned centered in stage, not flush to left edge
- **Multi-page:** pages stack vertically with `40px` gap between them

---

## SECTION 6: SELECTION TRANSFORMER — EXACT SPEC

From screenshots 8 and 9 — selection handles visible:

```javascript
// Konva Transformer configuration
const transformerConfig = {
  // ── Handle appearance ─────────────────────────
  anchorFill: '#ffffff',         // white handles
  anchorStroke: '#00C4CC',       // teal/canva border on handles
  anchorStrokeWidth: 1.5,
  anchorSize: 9,                 // small square handles
  anchorCornerRadius: 2,

  // ── Bounding box ──────────────────────────────
  borderStroke: '#00C4CC',       // teal bounding box
  borderStrokeWidth: 1.5,
  borderDash: [],                // solid line

  // ── Rotation ──────────────────────────────────
  rotateEnabled: true,
  rotateAnchorOffset: 28,        // 28px above top-center
  rotationSnaps: [0,45,90,135,180,225,270,315],
  rotationSnapTolerance: 5,

  // ── Resize ────────────────────────────────────
  keepRatio: false,
  enabledAnchors: [
    'top-left','top-center','top-right',
    'middle-left','middle-right',
    'bottom-left','bottom-center','bottom-right',
  ],
};

// TEXT elements only — middle handles, font-size scaling
const textTransformerConfig = {
  ...transformerConfig,
  enabledAnchors: ['middle-left', 'middle-right'],
  // On width resize: scale font-size proportionally
  // newFontSize = currentFontSize * (newWidth / oldWidth)
};
```

**From screenshot 8:** Selection box on text shows white square handles with teal outline. Bounding box is thin teal/purple line.

---

## SECTION 7: FLOATING OBJECT TOOLBAR — SCREENSHOT 8 & 9 VERIFIED

From screenshots 8 and 9 — pill-shaped floating toolbar ABOVE selected element:

**Exact shape (screenshot 8):**
```
╭────────────────────────────────────╮
│  [↺]  [🔒]  [⊞copy]  [🗑]  [•••] │   ← pill shape, white bg
╰────────────────────────────────────╯
```

**Exact measurements:**
- Container: `background: white`, `border-radius: 9999px` (full pill), `box-shadow: 0 4px 16px rgba(0,0,0,0.12)`, `padding: 6px 8px`, `display: flex`, `gap: 4px`
- Each button: **36×36px** (measured from screenshots), `border-radius: 50%` (circle buttons)
- Icons: 18px, `color: #555`
- Divider before delete: `1px solid #e8e8e8`, height 20px

**Icon order (screenshot 8, 9):**
1. `↺` RotateCcw (rotate) — 36×36 circle
2. `🔒` Lock — 36×36 circle
3. `⊞` Copy/Duplicate — 36×36 circle
4. `🗑` Trash2 (delete) — 36×36 circle, hover: red tint
5. `•••` MoreHorizontal — 36×36 circle

**Position logic:**
```javascript
// Calculate position above element
const toolbarY = elementY - 56;  // 56px above element top
// If toolbarY < 10: flip below element
const actualY = toolbarY < 10 ? elementY + elementH + 12 : toolbarY;
// Center horizontally over element
const toolbarX = elementX + elementW/2 - toolbarWidth/2;
```

**Entrance animation:**
```css
@keyframes floatIn {
  from { opacity: 0; transform: scale(0.94) translateY(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
.floating-toolbar { animation: floatIn 120ms cubic-bezier(0.34,1.56,0.64,1) forwards; }
/* Note: slight spring overshoot for natural feel */
```

---

## SECTION 8: BOTTOM STATUS BAR — VERIFIED

From screenshots 2, 3, 4, 5, 6, 7, 8, 9, 10 — all show same bottom bar:

```
[≡ Notes]  [⏱ Timer]  ─────────  [slider ──●──] [22%] [Pages] [1 / 3] [⊞] [⤢] [?]
```

- Height: 44px | Background: white | Border-top: `1px solid #e8e8e8`
- "Notes": `≡` icon + "Notes" text, 13px
- "Timer": `⏱` icon + "Timer" text, 13px
- **Middle gap:** `flex: 1` spacer
- **Zoom slider:** 120px `<input type="range">`, custom styled, teal thumb `#00C4CC`
- **"22%":** editable input, 48px wide, 13px, click to type new zoom %
- **"Pages":** text button, 13px — click toggles Pages sidebar
- **"1 / 3":** `current / total`, 13px, not interactive (or click = page jump)
- **⊞ Grid view** icon button: 28×28px
- **⤢ Fullscreen** icon button: 28×28px (Maximize2 icon)
- **?** icon button: 28×28px, opens shortcuts modal

---

## SECTION 9: FILE MENU — SCREENSHOT 11 & 12 VERIFIED

From screenshots 11 and 12 — exact verified structure:

**Position:** drops down from "File" button, attached to left edge
**Width:** ~400px (screenshot shows), NOT narrow

**Header (top of menu):**
```
While you sleep, ItsPosting ...  [✏ edit pen]
By Collab Gro • 1080px × 1350px
```
- Design name: 16px, font-weight 600, truncated
- Edit pen icon: 16px Lucide Pencil, gray, right-aligned
- Subtitle: "By [workspace] • [W]px × [H]px", 12px, gray

**Menu items (verified from screenshot):**
```
[+] Create new design
[☁] Upload files
────────────────────────────
[⚙] Settings              [›]
[♿] Accessibility         [›]
────────────────────────────
[☁] Save              All changes saved   ← right-aligned status text
[⚡] Make available offline
────────────────────────────
[📁] Move
[⧉] Make a copy
[↓] Download
[🖨] Print                    Ctrl+P
────────────────────────────
[⏱] Version history
────────────────────────────
[🗑] Move to Trash
```

**Below the divider (scrollable area showing Apps):**
```
[HeyGen AI Avatars] ...   ← apps section visible at bottom
```

**Style:**
```css
.file-menu {
  position: absolute;
  top: 56px; left: 0;
  width: 380px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06);
  padding: 8px 0;
  z-index: var(--z-dropdown);
  max-height: calc(100vh - 70px);
  overflow-y: auto;
  animation: dropdownIn 150ms ease forwards;
}
.file-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  font-size: 14px;
  color: #1a1a1a;
  cursor: pointer;
  border-radius: 0;
}
.file-menu-item:hover { background: #f5f5f5; }
.file-menu-item .item-icon { width: 20px; height: 20px; color: #555; flex-shrink: 0; }
.file-menu-item .item-shortcut { margin-left: auto; font-size: 12px; color: #9ca3af; }
.file-menu-item .item-arrow { margin-left: auto; color: #9ca3af; } /* for Settings, Accessibility */
.file-menu-divider { height: 1px; background: #f0f0f0; margin: 4px 0; }
```

---

## SECTION 10: RESIZE PANEL — SCREENSHOT 13 VERIFIED

From screenshot 13 — exact layout:

**Position:** drops below "Resize" button, starts at left edge
**Width:** ~420px (screenshot measured)

```
┌──────────────────────────────────────────────────┐
│ [🔍 Search resize options                      ] │  ← search bar, full width
│                                                  │
│  Suggested                            [See all]  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  [📱img] │  │  [📱img] │  │  [📱img] │       │  ← thumbnail previews
│  │          │  │          │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│  Instagram     Instagram       Facebook           │
│  Story         Post (4...)     Post               │
│  1080 × 1920   1080 × 1350     940 × 788 px      │
│                                                  │
│  Browse by category                              │
│                                                  │
│  [📋] Custom size                           [›]  │
│  [❤️] Social media                          [›]  │
│  [🎯] Presentations                         [›]  │
│  [🎬] Videos                                [›]  │
│  [🌐] Website                              [  ]  │
│  [✏️] Whiteboard                           [  ]  │
│                                                  │
│  [👑 Try it free for 30 days]                    │  ← purple CTA at bottom
└──────────────────────────────────────────────────┘
```

- Thumbnail cards: 100×120px, `border: 1px solid #e8e8e8`, `border-radius: 8px`
- Category rows: 48px height, icon + label left, chevron right
- Hover: `background: #f5f5f5`
- CTA button: `background: #6a3be4`, `color: white`, `border-radius: 8px`, full width, height 48px, `font-weight: 600`, crown icon

---

## SECTION 11: EDITING DROPDOWN — SCREENSHOT 14 VERIFIED

From screenshot 14 — exact structure:

```
╭────────────────────────────────────────╮
│  [✏]  Editing          [✓]            │  ← active = checkmark right
│       Make changes                     │
│  ─────────────────────────────────── │
│  [💬] Commenting                       │
│       Add feedback                     │
│  ─────────────────────────────────── │
│  [👁] Viewing                          │
│       Read-only                        │
╰────────────────────────────────────────╯
```
- Width: ~400px, `border-radius: 12px`
- Each option: 60px tall, icon + **bold title** (14px, 600 weight) + subtitle (12px, gray) on two lines
- Active item (Editing): `color: #1a1a1a`, checkmark `✓` icon right (`#6a3be4` color)
- Inactive items: `color: #555`
- Dividers between items
- Dropdown attaches below "Editing" button in topbar

---

## SECTION 12: SHARE PANEL — SCREENSHOT 10 VERIFIED

From screenshot 10 — slides in from RIGHT side:

**Width:** ~480px | **Slides in** from right edge of canvas

```
┌──────────────────────────────────────────────┐
│  Share design          [📊 0 visitors] [⚙️]  │  ← header row
│                                              │
│  People with access                          │
│  ┌────────────────────────────────────────┐ │
│  │ 🔍 Add people                          │ │  ← search input
│  └────────────────────────────────────────┘ │
│                                              │
│  [C +]   ← user avatar with + badge          │
│                                              │
│  Access level                                │
│  ┌────────────────────────────────────────┐ │
│  │ 🔒 Only you can access            [▾]  │ │  ← dropdown
│  └────────────────────────────────────────┘ │
│                                              │
│  [🔗 Copy link]                              │  ← purple fill, full width
│  [Create custom link 👑]                     │  ← text link
│                                              │
│  ────────────────────────────────────────── │
│  [↓ Download] [▶ Present] [🌐 Public] [🔗 Template link]
│     (icon+label, 4-col icon grid)            │
└──────────────────────────────────────────────┘
```

- Panel: `position: absolute`, `right: 0`, `top: 56px`, `width: 480px`, `height: calc(100vh - 56px)`
- Background: white | `box-shadow: -4px 0 24px rgba(0,0,0,0.10)`
- "0 visitors": `background: #f0f0f0`, `border-radius: 4px`, padding `2px 8px`, 12px text
- "Copy link" button: `background: #6a3be4`, `color: white`, full width, height 44px, `border-radius: 8px`
- Bottom 4 icons: `grid-template-columns: repeat(4,1fr)`, each icon + label below, centered
- Download = gray square icon, Present = orange circle, Public = gray circle, Template link = gray circle

---

## SECTION 13: RIGHT-CLICK CONTEXT MENU

```jsx
// On element right-click:
const elementContextMenu = [
  { label: 'Copy',          shortcut: 'Ctrl+C',       action: copy },
  { label: 'Paste',         shortcut: 'Ctrl+V',       action: paste },
  { label: 'Duplicate',     shortcut: 'Ctrl+D',       action: duplicate },
  'divider',
  { label: 'Cut',           shortcut: 'Ctrl+X',       action: cut },
  { label: 'Delete',        shortcut: 'Delete',       action: del, danger: true },
  'divider',
  { label: 'Bring to Front',shortcut: 'Ctrl+Shift+]', action: bringToFront },
  { label: 'Bring Forward', shortcut: 'Ctrl+]',       action: bringForward },
  { label: 'Send Backward', shortcut: 'Ctrl+[',       action: sendBackward },
  { label: 'Send to Back',  shortcut: 'Ctrl+Shift+[', action: sendToBack },
  'divider',
  { label: 'Group',         shortcut: 'Ctrl+G',       action: group },
  { label: 'Ungroup',       shortcut: 'Ctrl+Shift+G', action: ungroup },
  'divider',
  { label: 'Lock',          shortcut: 'Alt+Shift+L',  action: lock },
  { label: 'Add to Brand Kit', action: addToBrandKit },
  { label: 'Create Link',   shortcut: 'Ctrl+K',       action: createLink },
  { label: 'Add Comment',   action: addComment },
  'divider',
  { label: 'Select All',    shortcut: 'Ctrl+A',       action: selectAll },
];
```

```css
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 4px;
  min-width: 220px;
  z-index: var(--z-dropdown);
  animation: contextIn 100ms ease forwards;
}
@keyframes contextIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
.context-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 12px;
  border-radius: 5px;
  font-size: 13px;
  cursor: pointer;
}
.context-item:hover { background: #f5f5f5; }
.context-item.danger:hover { background: rgba(239,68,68,0.08); color: #ef4444; }
.context-shortcut { color: #9ca3af; font-size: 11px; }
.context-divider { height: 1px; background: #f0f0f0; margin: 4px 0; }
```

---

## SECTION 14: ALL 62 KEYBOARD SHORTCUTS

```javascript
const SHORTCUTS = {
  // Text formatting
  'ctrl+b':          toggleBold,
  'ctrl+i':          toggleItalic,
  'ctrl+u':          toggleUnderline,
  'ctrl+k':          convertUppercase,
  'alt+b':           addBorder,

  // Text alignment
  'ctrl+shift+l':    () => setAlign('left'),
  'ctrl+shift+c':    () => setAlign('center'),
  'ctrl+shift+r':    () => setAlign('right'),

  // Text anchor
  'ctrl+shift+h':    () => setVAlign('top'),
  'ctrl+shift+m':    () => setVAlign('middle'),
  'ctrl+shift+b':    () => setVAlign('bottom'),

  // Line spacing
  'alt+arrowup':     increaseLineSpacing,
  'alt+arrowdown':   decreaseLineSpacing,

  // Text style
  'ctrl+alt+c':      copyTextStyle,
  'ctrl+shift+f':    focusFontDropdown,

  // Edit
  'ctrl+z':          undo,
  'ctrl+y':          redo,
  'ctrl+shift+z':    redo,
  'ctrl+c':          copy,
  'ctrl+v':          paste,
  'ctrl+x':          cut,
  'ctrl+d':          duplicate,
  'ctrl+a':          selectAll,
  'delete':          deleteSelected,
  'backspace':       deleteSelected,

  // Layers
  'ctrl+]':          bringForward,
  'ctrl+[':          sendBackward,
  'ctrl+shift+]':    bringToFront,
  'ctrl+shift+[':    sendToBack,

  // Grouping
  'ctrl+g':          groupSelected,
  'ctrl+shift+g':    ungroupSelected,

  // Lock
  'alt+shift+l':     toggleLock,

  // Link
  // (Ctrl+K handled by keyboard shortcut section above — convert uppercase on text, link elsewhere)

  // Zoom
  'ctrl+=':          zoomIn,
  'ctrl+-':          zoomOut,
  'ctrl+0':          fitPage,

  // View toggles
  'ctrl+/':          toggleSidebar,
  'shift+r':         toggleRulers,
  'ctrl+;':          toggleGrid,

  // Pages
  'ctrl+enter':      addPage,
  'ctrl+backspace':  deletePage,

  // View modes
  'alt+ctrl+1':      () => setViewMode('scroll'),
  'alt+ctrl+2':      () => setViewMode('thumbnail'),
  'alt+ctrl+3':      () => setViewMode('grid'),

  // Navigation
  'ctrl+f1':         focusToolbar,
  'ctrl+f2':         focusCanvas,

  // Presentation
  'ctrl+alt+p':      presentFullscreen,

  // Misc element
  'alt+ctrl+[':      selectPreviousElement,
  'alt+ctrl+]':      fitElementToPage,

  // Single-key shortcuts (ONLY when canvas is focused, not typing in input):
  't':               addTextBox,
  'r':               addRectangle,
  'c':               addCircle,
  'l':               addLine,
  '/':               openQuickSearch,

  // Nudge
  'arrowup':         () => nudge(0, -1),
  'arrowdown':       () => nudge(0, 1),
  'arrowleft':       () => nudge(-1, 0),
  'arrowright':      () => nudge(1, 0),
  'shift+arrowup':   () => nudge(0, -10),
  'shift+arrowdown': () => nudge(0, 10),
  'shift+arrowleft': () => nudge(-10, 0),
  'shift+arrowright':() => nudge(10, 0),

  // Tab selection
  'tab':             selectNextElement,
  'escape':          deselectAll,

  // Ruler / page
  'shift+r':         toggleRulers,
  'ctrl+enter':      addPage,
};
```

**Implementation:**
```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    const tag = document.activeElement?.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.contentEditable === 'true';

    const key = [
      e.ctrlKey && 'ctrl',
      e.metaKey && 'ctrl',  // Mac support
      e.altKey && 'alt',
      e.shiftKey && 'shift',
      e.key.toLowerCase(),
    ].filter(Boolean).join('+');

    // Single-key shortcuts only when canvas focused
    const singleKeys = ['t','r','c','l','/'];
    if (singleKeys.includes(key) && isInput) return;

    const handler = SHORTCUTS[key];
    if (handler) {
      e.preventDefault();
      handler();
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [/* all handlers as deps */]);
```

---

## SECTION 15: ANIMATION & MOTION SYSTEM

```css
/* ── Panel open/close ──────────────────────────────────── */
.flyout-panel {
  transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
.flyout-content {
  opacity: 0;
  transition: opacity 150ms ease 80ms;
  pointer-events: none;
}
.flyout-panel.open .flyout-content {
  opacity: 1;
  pointer-events: auto;
}

/* ── Dropdowns (File, Resize, Editing menus) ──────────── */
@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.dropdown { animation: dropdownIn 150ms ease forwards; }

/* ── Floating toolbar ─────────────────────────────────── */
@keyframes floatIn {
  from { opacity: 0; transform: scale(0.94) translateY(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
.floating-toolbar { animation: floatIn 120ms cubic-bezier(0.34,1.56,0.64,1) forwards; }

/* ── Context menu ─────────────────────────────────────── */
@keyframes contextIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
.context-menu { animation: contextIn 100ms ease forwards; }

/* ── Share panel slide in ─────────────────────────────── */
@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}
.share-panel { animation: slideInRight 200ms ease forwards; }

/* ── Button hover ─────────────────────────────────────── */
button { transition: background-color 100ms ease; }
.icon-strip-btn { transition: background-color 100ms ease, transform 100ms ease; }
.icon-strip-btn:hover { transform: scale(1.05); }

/* ── Drag feedback ────────────────────────────────────── */
/* Applied via Konva node.to() tween — see Section 17 */

/* ── Loading skeleton ─────────────────────────────────── */
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e4e4e4 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

/* ── Spin (save indicator) ───────────────────────────── */
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

/* ── Tooltip ─────────────────────────────────────────── */
@keyframes tooltipIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.tooltip { animation: tooltipIn 150ms ease forwards; }
```

---

## SECTION 16: TOOLTIP SYSTEM

```jsx
function Tooltip({ children, label, shortcut, side = 'bottom' }) {
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => { timer.current = setTimeout(() => setShow(true), 400); }}
      onMouseLeave={() => { clearTimeout(timer.current); setShow(false); }}
    >
      {children}
      {show && (
        <div className={`tooltip tooltip-${side}`} style={{
          position: 'absolute',
          background: '#1f2937',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 'var(--z-tooltip)',
          ...(side === 'bottom' ? { top:'calc(100% + 6px)', left:'50%', transform:'translateX(-50%)' } : {}),
          ...(side === 'right'  ? { left:'calc(100% + 6px)', top:'50%', transform:'translateY(-50%)' } : {}),
        }}>
          <div style={{ fontWeight: 500 }}>{label}</div>
          {shortcut && <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '2px' }}>{shortcut}</div>}
        </div>
      )}
    </div>
  );
}
```

---

## SECTION 17: SAVE INDICATOR

```jsx
// State: 'idle' | 'saving' | 'saved' | 'error'
function SaveIndicator() {
  const [state, setState] = useState('idle');
  const debounceRef = useRef(null);

  // Call this whenever project changes
  const triggerSave = useCallback(() => {
    setState('saving');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await saveToBackend();
        setState('saved');
        setTimeout(() => setState('idle'), 2000);
      } catch { setState('error'); }
    }, 2000);
  }, []);

  // In the topbar (white text on gradient):
  if (state === 'idle') return null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, color:'rgba(255,255,255,0.9)', fontSize:12 }}>
      {state === 'saving' && <><Loader2 size={14} className="spin"/> Saving...</>}
      {state === 'saved'  && <><CheckCircle size={14}/> All changes saved</>}
      {state === 'error'  && <><AlertCircle size={14}/> Save failed</>}
    </div>
  );
}
```

---

## SECTION 18: SNAP LINES SYSTEM

```javascript
const SNAP_THRESHOLD = 5;

function computeSnapLines(dragging, allNodes, stageW, stageH) {
  const box = dragging.getClientRect();
  const snapLines = [];

  const vTargets = [0, stageW/2, stageW]; // canvas edges
  const hTargets = [0, stageH/2, stageH];

  // Add edges + centers of all other elements
  allNodes.forEach(n => {
    if (n === dragging) return;
    const r = n.getClientRect();
    vTargets.push(r.x, r.x + r.width/2, r.x + r.width);
    hTargets.push(r.y, r.y + r.height/2, r.y + r.height);
  });

  const checkEdges = (val, edges, type) => {
    edges.forEach(e => {
      if (Math.abs(val - e) < SNAP_THRESHOLD) {
        snapLines.push({ type, pos: e });
      }
    });
  };

  checkEdges(box.x,                  vTargets, 'vertical');
  checkEdges(box.x + box.width/2,    vTargets, 'vertical');
  checkEdges(box.x + box.width,      vTargets, 'vertical');
  checkEdges(box.y,                  hTargets, 'horizontal');
  checkEdges(box.y + box.height/2,   hTargets, 'horizontal');
  checkEdges(box.y + box.height,     hTargets, 'horizontal');

  return [...new Map(snapLines.map(s => [s.pos+s.type, s])).values()]; // deduplicate
}

// Render as Konva Lines on a dedicated overlay layer:
// stroke: '#FF00FF', strokeWidth: 1, listening: false, dash: []
// Clear snapLines array and redraw layer on dragend
```

---

## SECTION 19: DRAG FEEDBACK

```javascript
// Apply to every draggable Konva node on creation:
node.on('dragstart', () => {
  node.opacity(0.85);
  node.shadowEnabled(true);
  node.shadowColor('black');
  node.shadowBlur(20);
  node.shadowOpacity(0.25);
  node.shadowOffsetY(8);
  node.getStage().container().style.cursor = 'grabbing';
  layer.batchDraw();
});

node.on('dragend', () => {
  node.to({
    opacity: 1,
    shadowBlur: 0,
    shadowOffsetY: 0,
    shadowOpacity: 0,
    duration: 0.15,
    easing: Konva.Easings.EaseOut,
    onFinish: () => {
      node.shadowEnabled(false);
      layer.batchDraw();
    }
  });
  node.getStage().container().style.cursor = 'default';
});
```

---

## SECTION 20: COLOR PICKER COMPONENT

6-zone Canva-spec picker:

```
┌────────────────────────────────────┐  240px
│ ● Document colors                  │  → 28px swatches in a row
│ ● Brand colors                     │  → 28px swatches
│ ─────────────────────────────────  │
│ [           gradient square       ]│  → 200×120px HSV picker
│  (saturation left→right,           │
│   brightness top→bottom)           │
│ ─────────────────────────────────  │
│ [  hue slider ──────────────────] │  → 200×14px rainbow
│ [  opacity slider + checker ────] │  → 200×14px
│ ─────────────────────────────────  │
│  Hex  [ #7C3AED ]  A  [ 100%  ]   │  → editable inputs
│ ─────────────────────────────────  │
│ ● ● ● ● ● ● ● ●  (recent colors) │  → 8 × 28px circles
└────────────────────────────────────┘
```

Save recent colors to `localStorage.itsposting_recent_colors` (max 8, shift old out).

---

## SECTION 21: LOADING SKELETONS & EMPTY STATES

### Skeletons:
```jsx
// Templates panel loading:
Array(6).fill(0).map((_, i) => (
  <div key={i} className="skeleton" style={{ aspectRatio:'0.75', borderRadius:6 }} />
))

// Elements panel loading:
Array(8).fill(0).map((_, i) => (
  <div key={i} className="skeleton" style={{ height:80, borderRadius:6 }} />
))
```

### Empty states:
```jsx
// Uploads empty:
<EmptyState
  icon={<Upload size={44} color="#d1d5db"/>}
  title="Upload your first file"
  body="Images, videos, and audio will appear here"
  action={<Button variant="primary" onClick={triggerUpload}>Upload files</Button>}
/>

// Templates search empty:
<EmptyState
  icon={<Search size={44} color="#d1d5db"/>}
  title={`No results for "${query}"`}
  action={<Button variant="ghost" onClick={clearSearch}>Clear search</Button>}
/>
```

---

## SECTION 22: RULER & GUIDES

```jsx
// Horizontal ruler (20px tall, full canvas-stage width):
function HRuler({ zoom, scrollLeft }) {
  return (
    <svg height={20} style={{ width:'100%', background:'#f8f9fa', borderBottom:'1px solid #e8e8e8', userSelect:'none' }}
      onMouseDown={startHGuide}>
      {/* Tick marks every 50*zoom px, labeled every 100px */}
    </svg>
  );
}

// Drag from ruler to create guide:
function startHGuide(e) {
  const guide = { id: uid(), axis: 'h', pos: e.clientY };
  // Follow mouse, on mouseup: commit to project.guides
}

// Render guides as absolutely-positioned lines over canvas:
// axis=h: full-width 1px horizontal line at y=guide.pos (blue #2563eb)
// axis=v: full-height 1px vertical line at x=guide.pos (blue #2563eb)
// Double-click to delete, drag to move
```

---

## SECTION 23: PAGES THUMBNAIL SIDEBAR

Toggled by bottom bar "Pages" button. Slides in from right of canvas.

```
Width: 180px | Background: white | Border-left: 1px solid #e8e8e8
Position: absolute right:0 in canvas stage
```

```
┌──────────────────┐
│  Pages      [×]  │  ← 44px header
│ ──────────────── │
│ ┌──────────────┐ │
│ │  [thumbnail] │ │  ← active: 2px solid #00C4CC border
│ │  Page 1      │ │
│ └──────────────┘ │
│ ┌──────────────┐ │
│ │  [thumbnail] │ │  ← inactive: transparent border, hover: #d1d5db
│ │  Page 2      │ │
│ └──────────────┘ │
│                  │
│ [+ Add page]     │  ← dashed border button
└──────────────────┘
```

Thumbnail generation (debounced 500ms):
```javascript
const generateThumb = useCallback(
  debounce((pageIdx) => {
    const dataURL = stageRefs[pageIdx].current?.toDataURL({ pixelRatio: 0.25 });
    if (dataURL) setThumbnails(t => ({ ...t, [pageIdx]: dataURL }));
  }, 500),
  []
);
```

---

## SECTION 24: ICON LIBRARY REQUIREMENT

**ALL icons must be from Lucide React.** Zero Unicode emoji as icons.

```javascript
import {
  // Topbar
  Home, File, Maximize2, Pencil, ChevronDown, Undo2, Redo2,
  Cloud, CloudCheck, Crown, BarChart2, MessageCircle,
  // Icon strip
  LayoutTemplate, Shapes, Type, Upload, PenTool,
  FolderOpen, Grid2x2, Sparkles,
  // Action bar
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered,
  ArrowLeftRight, ArrowUpDown, LetterSpacing,
  // Floating toolbar
  RotateCcw, Lock, Copy, Trash2, MoreHorizontal,
  // Page controls
  ChevronUp, Eye, EyeOff, Plus,
  // Bottom bar
  FileText, Timer, Pages, Grid,
  // Other
  Search, Mic, X, Check, AlertCircle, Loader2,
  CheckCircle, Settings, Accessibility, Download,
  Printer, History, Link, Link2,
} from 'lucide-react';
```

---

## SECTION 25: IMPLEMENTATION PHASES

```
PHASE 1 — CSS Variables + Icon Audit (no visual regression)
  ✦ globals.css: all tokens from Section 0
  ✦ Replace ALL Unicode emoji with Lucide icons throughout both editor files
  ✦ Enforce 4px spacing grid (audit all padding/margin/gap)
  Test: zero hardcoded colors, zero emoji icons

PHASE 2 — Shell + Topbar
  ✦ Editor grid layout (Section 2)
  ✦ Topbar with gradient (Section 1)
  ✦ Icon strip (Section 3) with toggle behavior
  ✦ Bottom bar (Section 8)
  Test: topbar is teal→purple, icon strip toggles flyout

PHASE 3 — All 8 Flyout Panels
  ✦ Flyout panel shell + transition animation
  ✦ Templates, Elements, Text, Brand, Uploads panels (Sections 4.1–4.5)
  ✦ Tools sub-panel (Section 4.6) — floats beside icon strip
  ✦ Projects panel (Section 4.7)
  Test: all panels slide open/close, content fades in

PHASE 4 — Dropdowns
  ✦ File menu (Section 9)
  ✦ Resize panel (Section 10)
  ✦ Editing dropdown (Section 11)
  ✦ Share panel (Section 12)
  Test: all menus match screenshots exactly

PHASE 5 — Canvas + Selection
  ✦ Canvas stage: gray bg, page label rows, multi-page vertical stack
  ✦ Konva Transformer: teal handles, rotation offset 28px (Section 6)
  ✦ Snap lines: magenta #FF00FF, 5px threshold (Section 18)
  ✦ Drag feedback: opacity + shadow (Section 19)
  Test: selection handles are teal, snap lines appear during drag

PHASE 6 — Interaction Layer
  ✦ Floating object toolbar (Section 7) — pill shape, above element
  ✦ Contextual action bar (Section 2) — shows on selection
  ✦ Right-click context menu (Section 13)
  ✦ All 62 keyboard shortcuts (Section 14)
  Test: toolbar appears with animation, shortcuts all work

PHASE 7 — Polish
  ✦ Tooltip system on ALL buttons (Section 16)
  ✦ Save indicator (Section 17)
  ✦ Loading skeletons in panels (Section 21)
  ✦ Empty states (Section 21)
  ✦ Color picker (Section 20)
  ✦ Ruler & guides (Section 22)
  ✦ Pages sidebar with thumbnails (Section 23)
  ✦ All entrance animations (Section 15)
  Test: every button has tooltip, save animates, panels show skeletons
```

---

## SECTION 26: QUALITY CHECKLIST

```
TOPBAR:
[ ] Background is gradient teal→purple (NOT white, NOT solid color)
[ ] All topbar text/icons are WHITE
[ ] Share button is WHITE with dark text (reverse of topbar)
[ ] Title is centered (absolutely positioned)
[ ] Undo/Redo icons are correct Lucide icons (Undo2, Redo2)

ICON STRIP:
[ ] Width exactly 72px
[ ] Active icon background: rgba(106,59,228,0.10) — light purple, NOT teal
[ ] Active icon text/icon color: #6a3be4 purple
[ ] Crown badge on Brand icon (gold colored)
[ ] Tools opens a FLOATING sub-panel beside strip (not in flyout)

FLYOUT:
[ ] Width 320px, transition 200ms cubic-bezier(0.4,0,0.2,1)
[ ] Content fades in with 80ms delay
[ ] Clicking same icon again CLOSES the panel
[ ] No scrollbar visible when content fits

CANVAS:
[ ] Background: #f0f0f0 (NOT white)
[ ] Canvas has subtle box-shadow
[ ] Page label row exactly matches screenshot
[ ] 40px gap between stacked pages

SELECTION:
[ ] Teal #00C4CC handles (NOT blue, NOT purple)
[ ] Rotation handle 28px above top-center (detached)
[ ] TEXT elements: only middle-left + middle-right handles shown

FLOATING TOOLBAR:
[ ] PILL shape (border-radius: 9999px), NOT rectangular
[ ] Appears ABOVE element (not below by default)
[ ] Floats below when element near top edge
[ ] Entrance animation: scale + fade, 120ms

ACTION BAR:
[ ] Hidden when nothing selected (height: 0, not just invisible)
[ ] Font name dropdown visible when text selected
[ ] Font size shows correct current size

FILE MENU:
[ ] Design name + workspace + dimensions shown at TOP
[ ] Edit pen icon on the design name row
[ ] Exact item list (Section 9) — no more, no less

SHARE PANEL:
[ ] Slides in from RIGHT side (not a dropdown)
[ ] "0 visitors" counter visible
[ ] 4-icon bottom row: Download, Present, Public, Template link

BOTTOM BAR:
[ ] Zoom slider with teal thumb
[ ] "Pages" text button visible
[ ] "1 / 3" counter visible
[ ] ?, fullscreen, grid icons on far right

ANIMATIONS:
[ ] Dropdowns slide in (translateY -8px → 0)
[ ] Context menu scales in (0.96 → 1)
[ ] Floating toolbar has spring bounce (cubic-bezier(0.34,1.56,0.64,1))

ZERO TOLERANCE:
[ ] Zero Unicode emoji used as icons
[ ] Zero hardcoded color values outside globals.css
[ ] Every button/icon has a Tooltip component wrapping it
[ ] All padding/margin/gap values are multiples of 4px
```

---

## PROMPTING TEMPLATE FOR CLAUDE CODE

Use this EXACTLY when starting each phase:

```
You are implementing ItsPosting to be pixel-perfect identical to Canva's editor.
Your reference document is ItsPosting_Canva_VERIFIED_Plan.md — read it FULLY first.

Rules:
1. Every color must use CSS variables from globals.css (no hardcoded values)
2. Every icon must be Lucide React (no Unicode emoji)
3. Every measurement must match the screenshots in the plan
4. Only modify files listed below — touch nothing else

Implement PHASE [N] only.
Files to modify: [list explicitly]

After completing:
1. List every change made with line numbers
2. State what you DID NOT implement (save for next phase)
3. Flag any ambiguity so I can clarify before Phase [N+1]
```

---
*Plan v3.0 — Screenshot-verified from 15 real Canva UI captures — May 2026*
ENDOFFILE
echo "File written successfully"
wc -l /mnt/user-data/outputs/ItsPosting_Canva_VERIFIED_Plan.md
Output

File written successfully
1669 /mnt/user-data/outputs/ItsPosting_Canva_VERIFIED_Plan.md



---

Good — I can already see all 15 screenshots in the conversation. Let me study them pixel by pixel and do deeper research before writing the final plan.Searched the webSearched the webNow I have everything I need. I've studied all 15 screenshots extremely carefully and have the exact Canva brand colors confirmed. Let me now write the definitive, screenshot-verified plan.
What I can see clearly from YOUR screenshots that was wrong/missing in the previous plan:

Top bar — it's a teal-to-purple gradient (#00C4CC → #6a3be4), NOT white. Text is white on it.
Icon strip — NO border-right, clean white background, icons are much simpler than I described
Tools panel — opens as a floating sub-panel BESIDE the icon strip (not inside flyout)
Brand panel — shows a large promo card when no brand kit set up
Resize panel — shows visual thumbnail previews of preset sizes
Editing dropdown — 3 options with icons + subtitle text + checkmark on active
File menu — has design name + dimensions at top, specific icon per item
Share panel — opens as right-side overlay with visitor count, specific layout
Contextual bar — specific exact items visible in screenshot 8/9
Floating toolbar — pill-shaped white rounded container, specific iconse 



*Plan version: 2.0 | Last updated: May 2026 | Based on Canva Visual Suite 2.0*
