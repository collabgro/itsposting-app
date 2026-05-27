import { useState, useEffect, useRef, useLayoutEffect, createContext, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { Stage, Layer, Rect, Image as KonvaImage, Text, Circle, Line, Transformer, RegularPolygon, Star, Arrow, Shape } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { useTheme } from '../../lib/theme';
import { studioAPI, customerAPI, mediaAPI } from '../../lib/api';
import { useToast } from '../../components/ui';
import {
  IpArrowLeft, IpDownload, IpEye,
  IpCopy, IpDelete, IpLock, IpUnlock,
  IpSparkle, IpPalette, IpEdit, IpFolderOpen,
  IpTextCard, IpPublish, IpPhoto, IpVideo,
  IpPlus, IpChevronDown, IpSearch, IpTeam,
} from '../../components/icons';

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_SIZES = [
  { id: 'ig_portrait', label: 'Instagram Portrait', w: 1080, h: 1350 },
  { id: 'ig_square',   label: 'Instagram Square',   w: 1080, h: 1080 },
  { id: 'ig_story',    label: 'Instagram Story',    w: 1080, h: 1920 },
  { id: 'fb_post',     label: 'Facebook Post',       w: 1200, h: 630  },
  { id: 'google_biz',  label: 'Google Business',     w: 720,  h: 720  },
];

const TEAL = '#00C4CC';

const BLEND_MODES = ['source-over','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion'];
const BLEND_LABELS = { 'source-over':'Normal', multiply:'Multiply', screen:'Screen', overlay:'Overlay', darken:'Darken', lighten:'Lighten', 'color-dodge':'Dodge', 'color-burn':'Burn', 'hard-light':'Hard Light', 'soft-light':'Soft Light', difference:'Difference', exclusion:'Exclusion' };

// ─── Editor-specific inline SVG icons (not in main icon library) ──────────────
const _Ico = ({ size, sw = 1.75, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const IcoUndo      = ({ size = 16 }) => <_Ico size={size}><path d="M3 7v6h6"/><path d="M3 13A9 9 0 1 0 5.5 6"/></_Ico>;
const IcoRedo      = ({ size = 16 }) => <_Ico size={size}><path d="M21 7v6h-6"/><path d="M21 13A9 9 0 1 1 18.5 6"/></_Ico>;
const IcoTemplates = ({ size = 20 }) => <_Ico size={size}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></_Ico>;
const IcoLayers    = ({ size = 20 }) => <_Ico size={size}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></_Ico>;
const IcoBringFwd  = ({ size = 15 }) => <_Ico size={size}><rect x="3" y="8" width="13" height="13" rx="2"/><path d="M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3"/></_Ico>;
const IcoSendBack  = ({ size = 15 }) => <_Ico size={size}><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M5 15H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/></_Ico>;
const IcoDuplicate = ({ size = 15 }) => <_Ico size={size}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1"/></_Ico>;
const IcoFit       = ({ size = 13 }) => <_Ico size={size}><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></_Ico>;
const IcoRuler     = ({ size = 13 }) => <_Ico size={size}><rect x="2" y="7" width="20" height="10" rx="1"/><line x1="7" y1="12" x2="7" y2="7"/><line x1="11" y1="10" x2="11" y2="7"/><line x1="15" y1="12" x2="15" y2="7"/><line x1="19" y1="10" x2="19" y2="7"/></_Ico>;
const IcoGrid      = ({ size = 13 }) => <_Ico size={size}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></_Ico>;
const IcoAddPage   = ({ size = 13 }) => <_Ico size={size}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></_Ico>;
const IcoAlignLeft  = ({size=14}) => <_Ico size={size} sw={1.5}><line x1="3" y1="4" x2="3" y2="20"/><rect x="5" y="7" width="8" height="4" rx="1"/><rect x="5" y="13" width="13" height="4" rx="1"/></_Ico>;
const IcoAlignRight = ({size=14}) => <_Ico size={size} sw={1.5}><line x1="21" y1="4" x2="21" y2="20"/><rect x="11" y="7" width="8" height="4" rx="1"/><rect x="6" y="13" width="13" height="4" rx="1"/></_Ico>;
const IcoAlignTop   = ({size=14}) => <_Ico size={size} sw={1.5}><line x1="4" y1="3" x2="20" y2="3"/><rect x="7" y="5" width="4" height="8" rx="1"/><rect x="13" y="5" width="4" height="13" rx="1"/></_Ico>;
const IcoAlignBot   = ({size=14}) => <_Ico size={size} sw={1.5}><line x1="4" y1="21" x2="20" y2="21"/><rect x="7" y="11" width="4" height="8" rx="1"/><rect x="13" y="6" width="4" height="13" rx="1"/></_Ico>;
const IcoAlignCH    = ({size=14}) => <_Ico size={size} sw={1.5}><line x1="12" y1="3" x2="12" y2="21"/><rect x="4" y="7" width="8" height="4" rx="1"/><rect x="8" y="13" width="8" height="4" rx="1"/></_Ico>;
const IcoAlignCV    = ({size=14}) => <_Ico size={size} sw={1.5}><line x1="3" y1="12" x2="21" y2="12"/><rect x="7" y="4" width="4" height="8" rx="1"/><rect x="13" y="8" width="4" height="8" rx="1"/></_Ico>;
const IcoDistH      = ({size=14}) => <_Ico size={size} sw={1.5}><line x1="3" y1="4" x2="3" y2="20"/><line x1="21" y1="4" x2="21" y2="20"/><rect x="9" y="8" width="6" height="8" rx="1"/></_Ico>;
const IcoDistV      = ({size=14}) => <_Ico size={size} sw={1.5}><line x1="4" y1="3" x2="20" y2="3"/><line x1="4" y1="21" x2="20" y2="21"/><rect x="8" y="9" width="8" height="6" rx="1"/></_Ico>;
const IcoFlipH      = ({size=14}) => <_Ico size={size} sw={1.5}><line x1="12" y1="4" x2="12" y2="20"/><polyline points="4 9 8 12 4 15"/><polyline points="20 9 16 12 20 15"/></_Ico>;
const IcoFlipV      = ({size=14}) => <_Ico size={size} sw={1.5}><line x1="4" y1="12" x2="20" y2="12"/><polyline points="9 4 12 8 15 4"/><polyline points="9 20 12 16 15 20"/></_Ico>;
const IcoReplace    = ({size=14}) => <_Ico size={size} sw={1.5}><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></_Ico>;
const IcoEye        = ({size=12}) => <_Ico size={size} sw={1.5}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></_Ico>;
const IcoEyeOff     = ({size=12}) => <_Ico size={size} sw={1.5}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></_Ico>;
const IcoChevUpSm   = ({size=12}) => <_Ico size={size} sw={1.75}><polyline points="18 15 12 9 6 15"/></_Ico>;
const IcoChevDownSm = ({size=12}) => <_Ico size={size} sw={1.75}><polyline points="6 9 12 15 18 9"/></_Ico>;
const IcoEmoji      = ({size=14}) => <_Ico size={size} sw={1.5}><circle cx="12" cy="12" r="9"/><path d="M8 13.5c.5 1.5 2 2.5 4 2.5s3.5-1 4-2.5" strokeLinecap="round"/><circle cx="9.5" cy="9.5" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="9.5" r="1" fill="currentColor" stroke="none"/></_Ico>;
const IcoTxtTop     = ({size=13}) => <_Ico size={size} sw={1.5}><line x1="4" y1="4" x2="20" y2="4"/><line x1="8"  y1="4" x2="8"  y2="13"/><line x1="16" y1="4" x2="16" y2="9"/></_Ico>;
const IcoTxtMid     = ({size=13}) => <_Ico size={size} sw={1.5}><line x1="4" y1="12" x2="20" y2="12"/><line x1="8" y1="5" x2="8" y2="19"/><line x1="16" y1="8" x2="16" y2="16"/></_Ico>;
const IcoTxtBot     = ({size=13}) => <_Ico size={size} sw={1.5}><line x1="4" y1="20" x2="20" y2="20"/><line x1="8" y1="11" x2="8" y2="20"/><line x1="16" y1="15" x2="16" y2="20"/></_Ico>;
const IcoCurve      = ({size=14}) => <_Ico size={size} sw={1.5}><path d="M4 17a8 8 0 0 1 16 0"/><line x1="8" y1="7" x2="8" y2="12"/><line x1="12" y1="5" x2="12" y2="10"/><line x1="16" y1="7" x2="16" y2="12"/></_Ico>;
const IcoChain      = ({size=14}) => <_Ico size={size} sw={1.5}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></_Ico>;

const FONTS = [
  // Sans-serif
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito', 'Poppins', 'Source Sans 3',
  // Serif
  'Playfair Display', 'Merriweather', 'EB Garamond', 'Lora',
  // Display
  'Oswald', 'Raleway', 'Bebas Neue', 'Anton',
  // Script / handwriting
  'Dancing Script', 'Pacifico', 'Caveat',
  // Monospace
  'Space Mono', 'Courier New',
];

const FONT_GROUPS = [
  { label: 'Sans-serif', fonts: ['Inter','Roboto','Open Sans','Lato','Montserrat','Nunito','Poppins','Source Sans 3'] },
  { label: 'Serif',      fonts: ['Playfair Display','Merriweather','EB Garamond','Lora'] },
  { label: 'Display',    fonts: ['Oswald','Raleway','Bebas Neue','Anton'] },
  { label: 'Script',     fonts: ['Dancing Script','Pacifico','Caveat'] },
  { label: 'Monospace',  fonts: ['Space Mono','Courier New'] },
];

const TEXT_COMBOS = [
  { id:'bold-announce', label:'Bebas Neue + Open Sans',
    preview:[
      { text:'CALL TODAY', fontFamily:'Bebas Neue', previewSize:22, uppercase:true, letterSpacing:2 },
      { text:'Professional service you can trust', fontFamily:'Open Sans', previewSize:10 },
    ],
    lines:[
      { text:'CALL TODAY', fontSize:96, fontFamily:'Bebas Neue', fontStyle:'normal', letterSpacing:4, yOff:-80, width:600 },
      { text:'Professional service you can trust', fontSize:26, fontFamily:'Open Sans', fontStyle:'normal', yOff:40, width:540 },
    ],
  },
  { id:'elegant-pro', label:'Playfair Display + Lato',
    preview:[
      { text:'Premium Service', fontFamily:'Playfair Display', previewSize:18, bold:true },
      { text:'Trusted by local homeowners', fontFamily:'Lato', previewSize:10 },
    ],
    lines:[
      { text:'Premium Service', fontSize:64, fontFamily:'Playfair Display', fontStyle:'bold', yOff:-70, width:560 },
      { text:'Trusted by local homeowners since 2010', fontSize:22, fontFamily:'Lato', fontStyle:'normal', yOff:20, width:520 },
    ],
  },
  { id:'modern-clean', label:'Montserrat + Inter',
    preview:[
      { text:'Your Local Expert', fontFamily:'Montserrat', previewSize:17, bold:true },
      { text:'Quality work, honest pricing', fontFamily:'Inter', previewSize:10 },
    ],
    lines:[
      { text:'Your Local Expert', fontSize:60, fontFamily:'Montserrat', fontStyle:'bold', yOff:-70, width:560 },
      { text:'Quality work, honest pricing', fontSize:22, fontFamily:'Inter', fontStyle:'normal', yOff:20, width:520 },
    ],
  },
  { id:'serif-quote', label:'EB Garamond + Raleway',
    preview:[
      { text:'"5 stars — amazing work!"', fontFamily:'EB Garamond', previewSize:14, italic:true },
      { text:'— Sarah M., Happy Customer', fontFamily:'Raleway', previewSize:9 },
    ],
    lines:[
      { text:'"The best service I\'ve ever had."', fontSize:44, fontFamily:'EB Garamond', fontStyle:'italic', yOff:-70, width:580 },
      { text:'— Sarah M., Verified Customer', fontSize:22, fontFamily:'Raleway', fontStyle:'normal', yOff:20, width:520 },
    ],
  },
  { id:'urgent-cta', label:'Anton + Source Sans 3',
    preview:[
      { text:'CALL NOW', fontFamily:'Anton', previewSize:24, uppercase:true, letterSpacing:1 },
      { text:'24/7 Emergency Service', fontFamily:'Source Sans 3', previewSize:10 },
    ],
    lines:[
      { text:'CALL NOW', fontSize:108, fontFamily:'Anton', fontStyle:'normal', letterSpacing:3, yOff:-90, width:600 },
      { text:'24/7 Emergency Service Available', fontSize:28, fontFamily:'Source Sans 3', fontStyle:'normal', yOff:50, width:540 },
    ],
  },
  { id:'friendly-local', label:'Nunito + Poppins',
    preview:[
      { text:'Hi, Neighbour!', fontFamily:'Nunito', previewSize:18, bold:true },
      { text:"We're just around the corner", fontFamily:'Poppins', previewSize:10 },
    ],
    lines:[
      { text:'Hi, Neighbour!', fontSize:68, fontFamily:'Nunito', fontStyle:'bold', yOff:-70, width:560 },
      { text:"We're just around the corner", fontSize:24, fontFamily:'Poppins', fontStyle:'normal', yOff:20, width:520 },
    ],
  },
  { id:'promo-offer', label:'Oswald + Roboto',
    preview:[
      { text:'20% OFF', fontFamily:'Oswald', previewSize:22, bold:true, uppercase:true },
      { text:'This week only — limited spots', fontFamily:'Roboto', previewSize:10 },
    ],
    lines:[
      { text:'20% OFF', fontSize:96, fontFamily:'Oswald', fontStyle:'bold', letterSpacing:2, yOff:-80, width:600 },
      { text:'This week only — limited spots available', fontSize:26, fontFamily:'Roboto', fontStyle:'normal', yOff:40, width:540 },
    ],
  },
  { id:'script-season', label:'Dancing Script + Open Sans',
    preview:[
      { text:'This Winter...', fontFamily:'Dancing Script', previewSize:20 },
      { text:"Don't get caught without heat", fontFamily:'Open Sans', previewSize:10 },
    ],
    lines:[
      { text:'This Winter...', fontSize:80, fontFamily:'Dancing Script', fontStyle:'normal', yOff:-80, width:580 },
      { text:"Don't get caught without heat. Call today.", fontSize:24, fontFamily:'Open Sans', fontStyle:'normal', yOff:30, width:540 },
    ],
  },
  { id:'retro-heritage', label:'Bebas Neue + Merriweather',
    preview:[
      { text:'EST. 2010', fontFamily:'Bebas Neue', previewSize:20, letterSpacing:4, uppercase:true },
      { text:'Family owned & operated', fontFamily:'Merriweather', previewSize:9, italic:true },
    ],
    lines:[
      { text:'EST. 2010', fontSize:80, fontFamily:'Bebas Neue', fontStyle:'normal', letterSpacing:8, yOff:-70, width:540 },
      { text:'Family owned & operated', fontSize:24, fontFamily:'Merriweather', fontStyle:'italic', yOff:20, width:520 },
    ],
  },
  { id:'minimal-modern', label:'Raleway + Inter',
    preview:[
      { text:'Licensed & Insured', fontFamily:'Raleway', previewSize:15, uppercase:true, letterSpacing:3 },
      { text:'Serving your community since 2015', fontFamily:'Inter', previewSize:10 },
    ],
    lines:[
      { text:'Licensed & Insured', fontSize:56, fontFamily:'Raleway', fontStyle:'normal', letterSpacing:6, yOff:-70, width:580 },
      { text:'Serving your community since 2015', fontSize:22, fontFamily:'Inter', fontStyle:'normal', yOff:20, width:540 },
    ],
  },
  { id:'playful-fun', label:'Pacifico + Lato',
    preview:[
      { text:'Done Right.', fontFamily:'Pacifico', previewSize:19 },
      { text:'Or we come back for free', fontFamily:'Lato', previewSize:10 },
    ],
    lines:[
      { text:'Done Right.', fontSize:72, fontFamily:'Pacifico', fontStyle:'normal', yOff:-70, width:560 },
      { text:'Or we come back for free', fontSize:26, fontFamily:'Lato', fontStyle:'normal', yOff:20, width:520 },
    ],
  },
  { id:'five-star', label:'Dancing Script + Inter',
    preview:[
      { text:'★★★★★', fontFamily:'Inter', previewSize:16 },
      { text:'"Outstanding craftsmanship"', fontFamily:'Dancing Script', previewSize:14 },
    ],
    lines:[
      { text:'★★★★★', fontSize:52, fontFamily:'Inter', fontStyle:'normal', yOff:-80, width:400 },
      { text:'"Outstanding craftsmanship"', fontSize:52, fontFamily:'Dancing Script', fontStyle:'normal', yOff:-10, width:560 },
      { text:'— Mike R., Verified Customer', fontSize:20, fontFamily:'Inter', fontStyle:'normal', yOff:60, width:500 },
    ],
  },
];

const FILTER_PRESETS = {
  normal: { brightness: 0,    contrast: 0,   saturation: 0    },
  warm:   { brightness: 0.05, contrast: 10,  saturation: 0.3  },
  cool:   { brightness: 0,    contrast: 5,   saturation: -0.2 },
  faded:  { brightness: 0.15, contrast: -20, saturation: -0.3 },
  vivid:  { brightness: 0.05, contrast: 25,  saturation: 0.5  },
  bw:     { brightness: 0,    contrast: 15,  saturation: -1   },
  moody:  { brightness: -0.1, contrast: 20,  saturation: -0.2 },
};

const COLOR_PALETTE = [
  '#1a1a22', '#ffffff', '#7C5CFC', '#f59e0b', '#10b981',
  '#ef4444', '#3b82f6', '#ec4899', '#0ea5e9', '#84cc16',
];

const EXTENDED_PALETTE = [
  '#000000','#434343','#666666','#999999','#CCCCCC','#D9D9D9','#EFEFEF','#F3F3F3','#FFFFFF',
  '#FF0000','#FF4500','#FF9900','#FFFF00','#00FF00','#00FFFF','#4A86E8','#0000FF','#9900FF','#FF00FF',
  '#EA9999','#F9CB9C','#FFE599','#B6D7A8','#A2C4C9','#9FC5E8','#B4A7D6','#D5A6BD',
  '#CC4125','#E06666','#F6B26B','#FFD966','#93C47D','#76A5AF','#6FA8DC','#8E7CC3','#C27BA0',
  '#1a1a22','#7C5CFC',TEAL,'#10b981',
];

const STICKER_SETS = [
  { id:'popular',     label:'Popular',          stickers:['🔥','⭐','❤️','💯','🎉','💪','🙌','👍','💰','🏆','⚡','💎','🎯','🌟','✨','🚀','💫','🔑','💡','🏅'] },
  { id:'business',    label:'Business & Trades', stickers:['🏠','🔧','💧','❄️','⚡','🌿','🔑','🛠️','📋','💼','🤝','📊','📞','📍','⚙️','🔩','🪛','🪚','🔨','🏗️'] },
  { id:'celebration', label:'Celebration',       stickers:['🎉','🎊','🥳','🎈','🎁','🎀','🏆','🥂','🍾','🎵','🎶','🎤','✨','🌠','🎆','🎇','🎂','🎗️','🥇','🎖️'] },
  { id:'nature',      label:'Nature & Weather',  stickers:['🌸','🌹','🌺','🌻','🍀','🌿','🌱','🌲','🌴','🌊','⛅','🌈','☀️','🌙','❄️','🌷','🌼','🌾','🍃','🌦️'] },
  { id:'faces',       label:'Faces & Gestures',  stickers:['😊','😄','😎','🤔','😍','🥰','😂','🤩','💪','🙌','👍','🤟','✌️','🤞','🙏','👋','🫶','❤️','💙','💜'] },
  { id:'objects',     label:'Fun & Objects',     stickers:['☕','🍕','🍔','🥗','🎯','📱','💻','⌚','🎸','📚','🔭','🏖️','🌍','🚗','✈️','🎓','🎮','🎲','🛎️','🎪'] },
];

const GRID_LAYOUTS = [
  { id:'2col',        label:'2 Columns',   cols:2, rows:1 },
  { id:'3col',        label:'3 Columns',   cols:3, rows:1 },
  { id:'4col',        label:'4 Columns',   cols:4, rows:1 },
  { id:'2row',        label:'2 Rows',      cols:1, rows:2 },
  { id:'4sq',         label:'4 Square',    cols:2, rows:2 },
  { id:'9sq',         label:'9 Square',    cols:3, rows:3 },
  { id:'3strip',      label:'3-Strip',     cols:3, rows:1 },
  { id:'2row_tall',   label:'2 Tall Rows', cols:1, rows:2, tallRatio:true },
];

// ─── ColorPickerButton ────────────────────────────────────────────────────────
function ColorPickerButton({ value = '#ffffff', onChange, onCommit, recentColors = [], size = 22 }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const docColors = useContext(DocColorsCtx);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => { setHex(value); }, [value]);

  const openPicker = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const panelW = 228;
    const left = Math.min(r.left, window.innerWidth - panelW - 8);
    const top  = r.bottom + 6;
    setPos({ x: Math.max(8, left), y: top });
    setOpen(true);
  };

  const apply = (color) => { setHex(color); onChange?.(color); };

  const handleHex = (v) => {
    setHex(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange?.(v);
  };

  const close = () => { setOpen(false); onCommit?.(); };

  return (
    <>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onMouseDown={close} />}
      <div ref={btnRef} style={{ display: 'inline-flex' }}>
        <button onMouseDown={e => { e.preventDefault(); e.stopPropagation(); openPicker(); }}
          style={{ width: size + 6, height: size + 6, padding: 2, border: '1.5px solid rgba(128,128,128,0.4)', borderRadius: 4, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 2, background: value }} />
        </button>
      </div>
      {open && (
        <div onMouseDown={e => e.stopPropagation()}
          style={{ position: 'fixed', left: pos.x, top: pos.y, width: 228, background: '#1e1e28', border: '1px solid #2a2a35', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 9991, padding: 12 }}>
          {/* Preview + hex input + wheel picker + eyedropper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: hex, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
            <input value={hex} onChange={e => handleHex(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #2a2a35', background: '#13131a', color: '#f4f4f5', fontSize: 12, fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
            {typeof EyeDropper !== 'undefined' && (
              <button title="Pick color from screen" onMouseDown={async e => {
                e.preventDefault();
                setOpen(false);
                try {
                  const result = await new EyeDropper().open();
                  apply(result.sRGBHex);
                  onCommit?.();
                } catch (_) {}
              }} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid #2a2a35', background: '#13131a', color: '#a0a0b0', fontSize: 14, cursor: 'crosshair', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                ⊕
              </button>
            )}
            <div style={{ position: 'relative', width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ position: 'absolute', inset: 0, background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
              <input type="color" value={hex} onChange={e => apply(e.target.value)} onBlur={close}
                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'crosshair' }} />
            </div>
          </div>
          {/* Full palette grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 3, marginBottom: 8 }}>
            {EXTENDED_PALETTE.map(c => (
              <button key={c} onMouseDown={() => { apply(c); close(); }}
                style={{ aspectRatio: '1', background: c, border: hex === c ? '2px solid #7C5CFC' : '1px solid rgba(255,255,255,0.08)', borderRadius: 3, cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          {/* Document colors */}
          {docColors.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#71717a', marginBottom: 5, marginTop: 4 }}>Document</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                {docColors.map(c => (
                  <button key={c} onMouseDown={() => { apply(c); close(); }}
                    style={{ width: 20, height: 20, background: c, border: hex === c ? '2px solid #7C5CFC' : '1px solid rgba(255,255,255,0.08)', borderRadius: 3, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                ))}
              </div>
            </>
          )}
          {/* Recent colors */}
          {recentColors.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#71717a', marginBottom: 5 }}>Recent</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {recentColors.map(c => (
                  <button key={c} onMouseDown={() => { apply(c); close(); }}
                    style={{ width: 20, height: 20, background: c, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

const SNAP_THRESHOLD = 5;

const COLOR_SCHEMES = [
  { name: 'Ocean',      colors: ['#0A1628','#1E3A5F','#2D6A9F','#56CFE1'] },
  { name: 'Sunset',     colors: ['#1A0533','#7B2D8B','#E94560','#FF8C42'] },
  { name: 'Forest',     colors: ['#0D2B1F','#1B5E38','#3D9970','#A8E6CF'] },
  { name: 'Fire',       colors: ['#1A0A00','#8B1A0A','#D4380D','#FFB347'] },
  { name: 'Night',      colors: ['#0A0A1A','#1A1A3E','#3D3D7A','#8888CC'] },
  { name: 'Rose',       colors: ['#1A0010','#6B0F3A','#C0356F','#FF8FAB'] },
  { name: 'Sand',       colors: ['#1C1208','#5C3D11','#B8860B','#F4D03F'] },
  { name: 'Arctic',     colors: ['#FFFFFF','#E0F4FF','#9EDBF9','#3BAFDA'] },
  { name: 'Slate',      colors: ['#1E293B','#334155','#64748B','#CBD5E1'] },
  { name: 'ItsPosting', colors: [TEAL,'#7C5CFC','#FF7A00','#FFCE00'] },
  { name: 'Minimal',    colors: ['#111111','#333333','#777777','#EEEEEE'] },
  { name: 'Coral',      colors: ['#1A0A08','#8B2500','#E85D04','#FFBA08'] },
];

const EMOJI_SETS = [
  { label: 'Smileys',  list: ['😀','😂','😍','🥳','😎','🤔','😮','🥰','😁','🤣','😊','😜','🫡','😇','🤩','🥹'] },
  { label: 'Business', list: ['💼','📊','📈','✅','🏆','⭐','🔥','💡','🎯','📱','💰','🛠','📣','🔑','🤝','🆕'] },
  { label: 'Hands',    list: ['👍','👎','👋','🙌','👏','💪','✌️','🤜','✋','👊','🤞','🫶','🫰','🤙','🖐️','☝️'] },
  { label: 'Nature',   list: ['🌟','⭐','🌈','☀️','🌙','❄️','🌊','🌸','🍀','🌿','🦋','🐝','🌻','🍂','🌺','⚡'] },
  { label: 'Objects',  list: ['📸','🎨','📝','📌','❤️','💯','🔔','🚀','🎁','🎉','🏠','🔧','🎵','📺','💻','🖥️'] },
];

const DocColorsCtx = createContext([]);

function applyListStyle(text, listStyle) {
  if (!text || !listStyle || listStyle === 'none') return text;
  if (listStyle === 'bullet') return text.split('\n').map(l => l.trim() ? '• ' + l : l).join('\n');
  return text;
}

function applyTextTransform(text, transform) {
  if (!text || !transform || transform === 'none') return text;
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize') return text.replace(/\b\w/g, c => c.toUpperCase());
  return text;
}

function _hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
Konva.Filters.Duotone = function(imageData) {
  const d = imageData.data;
  const c1 = _hexToRgb(this.duotoneColor1 || '#1a1a22');
  const c2 = _hexToRgb(this.duotoneColor2 || TEAL);
  for (let i = 0; i < d.length; i += 4) {
    const luma = (0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]) / 255;
    d[i]   = Math.round(c1[0] + (c2[0] - c1[0]) * luma);
    d[i+1] = Math.round(c1[1] + (c2[1] - c1[1]) * luma);
    d[i+2] = Math.round(c1[2] + (c2[2] - c1[2]) * luma);
  }
};


const QUICK_ACTIONS = [
  { id: 'text',     icon: 'T',  label: 'Add text',        sub: 'Insert a text element',    shortcut: 'T'       },
  { id: 'rect',     icon: '▭',  label: 'Add rectangle',   sub: 'Insert a rectangle shape', shortcut: 'R'       },
  { id: 'circle',   icon: '○',  label: 'Add circle',      sub: 'Insert a circle shape',    shortcut: 'C'       },
  { id: 'line',     icon: '╱',  label: 'Add line',        sub: 'Insert a line shape'                          },
  { id: 'undo',     icon: '⟲',  label: 'Undo',            sub: 'Undo last action',          shortcut: 'Ctrl+Z'  },
  { id: 'redo',     icon: '⟳',  label: 'Redo',            sub: 'Redo last undone action',   shortcut: 'Ctrl+Y'  },
  { id: 'duplicate',    icon: '⊞',  label: 'Duplicate',        sub: 'Duplicate selected element',   shortcut: 'Ctrl+D'      },
  { id: 'pasteinplace', icon: '⧉',  label: 'Paste in place',  sub: 'Paste at original position',   shortcut: 'Ctrl+⇧V'    },
  { id: 'delete',       icon: '🗑', label: 'Delete',           sub: 'Delete selected element',      shortcut: 'Del'         },
  { id: 'newpage',  icon: '+',  label: 'Add new page',    sub: 'Insert a blank page after this one'            },
  { id: 'download', icon: '⬇', label: 'Download PNG',    sub: 'Export canvas as PNG'                         },
  { id: 'zoomin',   icon: '🔍', label: 'Zoom in',         sub: 'Increase canvas zoom',      shortcut: 'Ctrl++'  },
  { id: 'zoomout',  icon: '🔎', label: 'Zoom out',        sub: 'Decrease canvas zoom',      shortcut: 'Ctrl+–'  },
  { id: 'zoomfit',  icon: '⤢',  label: 'Fit to screen',  sub: 'Reset zoom to fit canvas',  shortcut: 'Ctrl+0'  },
  { id: 'selectall',icon: '⊡',  label: 'Select all',     sub: 'Select all unlocked elements', shortcut: 'Ctrl+A' },
  { id: 'showgrid', icon: '⊞',  label: 'Toggle grid',    sub: 'Show/hide dot grid overlay',   shortcut: 'G'      },
  { id: 'nextel',   icon: '⭢',  label: 'Next element',   sub: 'Select next element on page',  shortcut: 'Tab'    },
  { id: 'prevel',   icon: '⭠',  label: 'Prev element',   sub: 'Select previous element',      shortcut: 'Shift+Tab' },
];

const ANIMATE_PRESETS = [
  { id: 'none',       label: 'None',       icon: '○',  desc: 'No animation'      },
  { id: 'fade',       label: 'Fade',       icon: '◌',  desc: 'Fade in smoothly'   },
  { id: 'rise',       label: 'Rise',       icon: '↑',  desc: 'Slide up + fade'    },
  { id: 'sink',       label: 'Sink',       icon: '↓',  desc: 'Slide down + fade'  },
  { id: 'slide-left', label: 'From left',  icon: '←',  desc: 'Slide in from left' },
  { id: 'slide-right',label: 'From right', icon: '→',  desc: 'Slide in from right'},
  { id: 'pop',        label: 'Pop',        icon: '◉',  desc: 'Scale up + fade'    },
  { id: 'spin',       label: 'Spin',       icon: '↻',  desc: 'Rotate in'          },
];

const GRADIENT_PRESETS = [
  { label: 'Midnight', c1: '#7C5CFC', c2: TEAL, angle: 135 },
  { label: 'Sunset',   c1: '#f97316', c2: '#ec4899', angle: 135 },
  { label: 'Ocean',    c1: '#0ea5e9', c2: '#10b981', angle: 135 },
  { label: 'Fire',     c1: '#ef4444', c2: '#f97316', angle: 90  },
  { label: 'Forest',   c1: '#22c55e', c2: '#0ea5e9', angle: 135 },
  { label: 'Dusk',     c1: '#8b5cf6', c2: '#ec4899', angle: 135 },
  { label: 'Gold',     c1: '#fbbf24', c2: '#ef4444', angle: 90  },
  { label: 'Night',    c1: '#1e1b4b', c2: '#374151', angle: 180 },
];

function gradientPoints(angle, w, h) {
  const rad = (angle - 90) * Math.PI / 180;
  return {
    startPoint: { x: w / 2 - Math.cos(rad) * w / 2, y: h / 2 - Math.sin(rad) * h / 2 },
    endPoint:   { x: w / 2 + Math.cos(rad) * w / 2, y: h / 2 + Math.sin(rad) * h / 2 },
  };
}

function emptyPage() {
  return {
    id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    elements: [],
    bgType: 'color', bgColor: '#1a1a22',
    bgGradient: null,
    bgPattern: null, bgPatternColor: 'rgba(255,255,255,0.18)',
    bgImageUrl: null, bgSource: null, bgSourceId: null,
    bgFilter: 'normal', bgBrightness: 0, bgContrast: 0, bgSaturation: 0,
    lockedIds: [], hiddenIds: [],
    duration: 5, // seconds (used in video mode)
  };
}

// ─── BgImage ─────────────────────────────────────────────────────────────────

function BgImage({ url, filter, brightness, contrast, saturation, stageW, stageH, onClick, isSelected }) {
  const [image] = useImage(url, 'anonymous');
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !image) return;
    ref.current.cache();
    ref.current.filters([Konva.Filters.Brighten, Konva.Filters.Contrast, Konva.Filters.HSL]);
    ref.current.brightness(brightness);
    ref.current.contrast(contrast);
    ref.current.saturation(saturation);
    ref.current.getLayer()?.batchDraw();
  }, [image, brightness, contrast, saturation, filter]);

  if (!image) return null;

  const scale = Math.max(stageW / image.width, stageH / image.height);
  const scaledW = image.width * scale;
  const scaledH = image.height * scale;

  return (
    <KonvaImage
      ref={ref}
      name="canvas-bg"
      image={image}
      x={(stageW - scaledW) / 2}
      y={(stageH - scaledH) / 2}
      width={scaledW}
      height={scaledH}
      onClick={onClick}
      onTap={onClick}
      stroke={isSelected ? '#7C5CFC' : undefined}
      strokeWidth={isSelected ? 3 : 0}
    />
  );
}

// ─── ImageNode ───────────────────────────────────────────────────────────────

function ImageNode({ el, isSelected, onSelect, onChange, onDragMove, onSnapClear, locked, hidden }) {
  const shapeRef = useRef(null);
  const [img] = useImage(el.src, 'anonymous');
  const [isDragging, setIsDragging] = useState(false);

  // Apply Konva image filters when brightness/contrast/saturation/blur/duotone are set
  useEffect(() => {
    if (!shapeRef.current || !img) return;
    const node = shapeRef.current;
    const hasDuotone = el.duotone?.enabled;
    const hasFx = (el.brightness ?? 0) !== 0 || (el.contrast ?? 0) !== 0 || (el.saturation ?? 0) !== 0 || (el.blur ?? 0) > 0 || hasDuotone;
    if (hasFx) {
      const filters = [Konva.Filters.Brighten, Konva.Filters.Contrast, Konva.Filters.HSL];
      if ((el.blur ?? 0) > 0) filters.push(Konva.Filters.Blur);
      if (hasDuotone) filters.push(Konva.Filters.Duotone);
      node.filters(filters);
      node.brightness(el.brightness ?? 0);
      node.contrast(el.contrast ?? 0);
      node.saturation(el.saturation ?? 0);
      node.blurRadius(el.blur ?? 0);
      if (hasDuotone) {
        node.duotoneColor1 = el.duotone.c1 || '#1a1a22';
        node.duotoneColor2 = el.duotone.c2 || TEAL;
      }
      node.cache();
    } else {
      node.filters([]);
      node.clearCache();
    }
    node.getLayer()?.batchDraw();
  }, [img, el.brightness, el.contrast, el.saturation, el.blur, el.duotone?.enabled, el.duotone?.c1, el.duotone?.c2]);
  const w = el.width || 200;
  const h = el.height || 200;
  const flipSX = el.flipH ? -1 : 1;
  const flipSY = el.flipV ? -1 : 1;

  // Compute Konva crop prop from cropTop/Bottom/Left/Right (0-49 integer percentages)
  const imgNatW = img?.naturalWidth || img?.width || w;
  const imgNatH = img?.naturalHeight || img?.height || h;
  const cTop    = (el.cropTop    || 0) / 100;
  const cBottom = (el.cropBottom || 0) / 100;
  const cLeft   = (el.cropLeft   || 0) / 100;
  const cRight  = (el.cropRight  || 0) / 100;
  const hasCrop = cTop > 0 || cBottom > 0 || cLeft > 0 || cRight > 0;
  const cropProp = hasCrop ? {
    x: imgNatW * cLeft,
    y: imgNatH * cTop,
    width:  Math.max(1, imgNatW * (1 - cLeft - cRight)),
    height: Math.max(1, imgNatH * (1 - cTop - cBottom)),
  } : undefined;

  const handleDragMove = (e) => {
    if (!onDragMove) return;
    const tlX = e.target.x() - w / 2;
    const tlY = e.target.y() - h / 2;
    const { x: nx, y: ny } = onDragMove(el.id, tlX, tlY, w, h);
    e.target.position({ x: nx + w / 2, y: ny + h / 2 });
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    const s = e.target.getStage(); if (s) s.container().style.cursor = '';
    if (onSnapClear) onSnapClear();
    onChange({ ...el, x: e.target.x() - w / 2, y: e.target.y() - h / 2 });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    const rawSX = node.scaleX();
    const rawSY = node.scaleY();
    const newW = Math.max(5, Math.abs(node.width() * rawSX));
    const newH = Math.max(5, Math.abs(node.height() * rawSY));
    const newFlipH = rawSX < 0 ? !el.flipH : el.flipH;
    const newFlipV = rawSY < 0 ? !el.flipV : el.flipV;
    const resetSX = newFlipH ? -1 : 1;
    const resetSY = newFlipV ? -1 : 1;
    onChange({
      ...el,
      x: node.x() - newW / 2,
      y: node.y() - newH / 2,
      width: newW,
      height: newH,
      flipH: newFlipH,
      flipV: newFlipV,
      rotation: node.rotation(),
    });
    node.scaleX(resetSX);
    node.scaleY(resetSY);
    node.width(newW);
    node.height(newH);
    node.offsetX(newW / 2);
    node.offsetY(newH / 2);
  };

  // ── Photo-zone placeholder (empty src) ─────────────────────────────────────
  if (!el.src) {
    const cr = el.frameType === 'circle'  ? Math.round(Math.min(w, h) * 0.5)
             : el.frameType === 'rounded' ? Math.round(Math.min(w, h) * 0.2)
             : (el.cornerRadius || 0);
    const iconSz  = Math.round(Math.min(w, h) * 0.20);
    const labelSz = Math.max(10, Math.round(Math.min(w * 0.07, 16)));
    const phLabel = el.placeholder || 'Drop photo here';
    const phFill  = el.placeholderFill || 'rgba(30,35,50,0.72)';

    return (
      <Shape
        ref={shapeRef}
        id={el.id}
        x={el.x + w / 2}
        y={el.y + h / 2}
        offsetX={w / 2}
        offsetY={h / 2}
        width={w}
        height={h}
        rotation={el.rotation || 0}
        opacity={el.opacity ?? 1}
        draggable={!locked}
        visible={!hidden}
        onClick={e => !locked && onSelect(el.id, e)}
        onTap={e => !locked && onSelect(el.id, e)}
        onMouseEnter={e => { if (!locked) { const s = e.target.getStage(); if (s) s.container().style.cursor = 'pointer'; } }}
        onMouseLeave={e => { const s = e.target.getStage(); if (s) s.container().style.cursor = ''; }}
        onDragStart={e => { setIsDragging(true); const s = e.target.getStage(); if (s) s.container().style.cursor = 'grabbing'; }}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        hitFunc={(ctx, shape) => { ctx.beginPath(); ctx.rect(0, 0, shape.width(), shape.height()); ctx.closePath(); ctx.fillStrokeShape(shape); }}
        sceneFunc={(ctx, shape) => {
          const W = shape.width(), H = shape.height();
          ctx.save();
          // Clip to frame shape
          ctx.beginPath();
          if (el.frameType === 'circle') {
            ctx.arc(W / 2, H / 2, Math.min(W / 2, H / 2), 0, Math.PI * 2);
          } else if (cr > 0) {
            ctx.roundRect(0, 0, W, H, cr);
          } else {
            ctx.rect(0, 0, W, H);
          }
          ctx.clip();
          // Fill
          ctx.fillStyle = phFill;
          ctx.fillRect(0, 0, W, H);
          // Dashed border
          const inset = 3;
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([9, 6]);
          ctx.beginPath();
          if (el.frameType === 'circle') {
            ctx.arc(W / 2, H / 2, Math.min(W / 2, H / 2) - inset, 0, Math.PI * 2);
          } else if (cr > 0) {
            ctx.roundRect(inset, inset, W - inset * 2, H - inset * 2, Math.max(0, cr - inset));
          } else {
            ctx.rect(inset, inset, W - inset * 2, H - inset * 2);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          // Camera icon
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.font = `${iconSz}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('📷', W / 2, H * 0.40);
          // Label
          ctx.fillStyle = 'rgba(255,255,255,0.38)';
          ctx.font = `${labelSz}px Inter, sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillText(phLabel, W / 2, H * 0.63);
          ctx.restore();
          // Selection ring (drawn outside clip region)
          if (isSelected) {
            ctx.save();
            ctx.strokeStyle = '#7C5CFC';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.beginPath();
            if (el.frameType === 'circle') {
              ctx.arc(W / 2, H / 2, Math.min(W / 2, H / 2) - 1, 0, Math.PI * 2);
            } else if (cr > 0) {
              ctx.roundRect(1, 1, W - 2, H - 2, cr);
            } else {
              ctx.rect(1, 1, W - 2, H - 2);
            }
            ctx.stroke();
            ctx.restore();
          }
          ctx.fillStrokeShape(shape);
        }}
      />
    );
  }

  return (
    <KonvaImage
      ref={shapeRef}
      id={el.id}
      image={img}
      x={el.x + w / 2}
      y={el.y + h / 2}
      width={w}
      height={h}
      offsetX={w / 2}
      offsetY={h / 2}
      scaleX={flipSX}
      scaleY={flipSY}
      rotation={el.rotation || 0}
      opacity={isDragging ? Math.min(el.opacity ?? 1, 0.65) : (el.opacity ?? 1)}
      cornerRadius={(!el.frameType || el.frameType === 'none' || el.frameType === 'rounded') ? (el.frameType === 'rounded' ? Math.round(Math.min(w, h) * 0.2) : (el.cornerRadius || 0)) : 0}
      clipFunc={el.frameType && el.frameType !== 'none' && el.frameType !== 'rounded' ? (ctx => {
        const hw = w / 2, hh = h / 2;
        if (el.frameType === 'circle') {
          ctx.arc(0, 0, Math.min(hw, hh), 0, Math.PI * 2);
        } else if (el.frameType === 'hexagon') {
          const r = Math.min(hw, hh);
          for (let i = 0; i < 6; i++) { const a = (Math.PI/3)*i - Math.PI/6; i===0 ? ctx.moveTo(r*Math.cos(a),r*Math.sin(a)) : ctx.lineTo(r*Math.cos(a),r*Math.sin(a)); }
          ctx.closePath();
        } else if (el.frameType === 'diamond') {
          ctx.moveTo(0,-hh); ctx.lineTo(hw,0); ctx.lineTo(0,hh); ctx.lineTo(-hw,0); ctx.closePath();
        } else if (el.frameType === 'triangle') {
          ctx.moveTo(0,-hh); ctx.lineTo(hw,hh); ctx.lineTo(-hw,hh); ctx.closePath();
        } else if (el.frameType === 'star') {
          const ro = Math.min(hw, hh), ri = ro * 0.42;
          for (let i = 0; i < 10; i++) { const a = (Math.PI/5)*i - Math.PI/2; const r = i%2===0?ro:ri; i===0?ctx.moveTo(r*Math.cos(a),r*Math.sin(a)):ctx.lineTo(r*Math.cos(a),r*Math.sin(a)); }
          ctx.closePath();
        }
      }) : undefined}
      draggable={!locked}
      visible={!hidden}
      onClick={(e) => !locked && onSelect(el.id, e)}
      onTap={(e) => !locked && onSelect(el.id, e)}
      onDragStart={e => { setIsDragging(true); const s = e.target.getStage(); if (s) s.container().style.cursor = 'grabbing'; }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      stroke={isSelected ? '#7C5CFC' : (el.borderEnabled && el.borderColor ? el.borderColor : undefined)}
      strokeWidth={isSelected ? 1.5 : (el.borderEnabled && el.borderWidth ? el.borderWidth : 0)}
      dash={isSelected ? undefined : (() => { if (!el.borderEnabled) return undefined; const s=el.borderStyle||'solid'; const w=el.borderWidth||2; if(s==='dashed') return [w*4,w*3]; if(s==='dotted') return [w,w*2.5]; return undefined; })()}
      globalCompositeOperation={el.blendMode || 'source-over'}
      shadowEnabled={el.shadow?.enabled || false}
      shadowColor={el.shadow?.color || '#000000'}
      shadowBlur={el.shadow?.blur ?? 8}
      shadowOffsetX={el.shadow?.offsetX ?? 4}
      shadowOffsetY={el.shadow?.offsetY ?? 4}
      shadowOpacity={el.shadow?.opacity ?? 0.5}
      {...(cropProp ? { crop: cropProp } : {})}
    />
  );
}

// ─── ContentNode ──────────────────────────────────────────────────────────────

function ContentNode({ el, isSelected, isHovered, onSelect, onChange, stageW, stageH, onDblClick, onDragMove, onSnapClear, locked, hidden, onHoverIn, onHoverOut }) {
  const shapeRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [measuredH, setMeasuredH] = useState(() => (el.fontSize || 36) * 1.5);

  useEffect(() => {
    if (el.type !== 'text' || !shapeRef.current) return;
    const h = shapeRef.current.height();
    if (h > 0 && Math.abs(h - measuredH) > 1) setMeasuredH(h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el.text, el.fontSize, el.fontFamily, el.fontStyle, el.lineHeight, el.letterSpacing, el.width]);

  const isCenterOrigin = ['circle', 'triangle', 'star'].includes(el.type);

  const handleDragMove = (e) => {
    if (!onDragMove) return;
    let rawX = e.target.x();
    let rawY = e.target.y();
    let elW, elH;
    if (isCenterOrigin) {
      const r = el.radius || el.outerRadius || 60;
      rawX -= r; rawY -= r;
      elW = elH = r * 2;
    } else {
      elW = el.width || (el.points ? el.width || 200 : 200);
      elH = el.height || 100;
    }
    const { x: nx, y: ny } = onDragMove(el.id, rawX, rawY, elW, elH);
    if (isCenterOrigin) {
      const r = el.radius || el.outerRadius || 60;
      e.target.position({ x: nx + r, y: ny + r });
    } else {
      e.target.position({ x: nx, y: ny });
    }
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    const s = e.target.getStage(); if (s) s.container().style.cursor = '';
    if (onSnapClear) onSnapClear();
    onChange({ ...el, x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    if (el.type === 'text') {
      const scaleX = node.scaleX();
      onChange({
        ...el,
        x: node.x(), y: node.y(),
        width: Math.max(5, node.width() * Math.abs(scaleX)),
        fontSize: Math.max(8, Math.min(400, Math.round((el.fontSize || 36) * Math.abs(scaleX)))),
        scaleX: 1, scaleY: 1,
        rotation: node.rotation(),
      });
    } else {
      const rawSX = node.scaleX();
      const rawSY = node.scaleY();
      const newFlipH = rawSX < 0 ? !el.flipH : (el.flipH || false);
      const newFlipV = rawSY < 0 ? !el.flipV : (el.flipV || false);
      onChange({
        ...el, x: node.x(), y: node.y(),
        width:  Math.max(5, Math.abs(node.width()  * rawSX)),
        height: Math.max(5, Math.abs(node.height() * rawSY)),
        flipH: newFlipH, flipV: newFlipV,
        scaleX: 1, scaleY: 1, rotation: node.rotation(),
      });
      node.scaleX(newFlipH ? -1 : 1);
      node.scaleY(newFlipV ? -1 : 1);
    }
  };

  const common = {
    ref: shapeRef,
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation || 0,
    opacity: isDragging ? Math.min(el.opacity ?? 1, 0.65) : (el.opacity ?? 1),
    draggable: !locked,
    visible: !hidden && el.visible !== false,
    onClick: (e) => !locked && onSelect(el.id, e),
    onTap: (e) => !locked && onSelect(el.id, e),
    onMouseEnter: e => { if (!locked && onHoverIn) { onHoverIn(el.id); const s = e.target.getStage(); if (s) s.container().style.cursor = locked ? 'not-allowed' : 'pointer'; } },
    onMouseLeave: e => { if (onHoverOut) { onHoverOut(); const s = e.target.getStage(); if (s) s.container().style.cursor = ''; } },
    onDragStart: e => { setIsDragging(true); const s = e.target.getStage(); if (s) s.container().style.cursor = 'grabbing'; if (onHoverOut) onHoverOut(); },
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    stroke: isSelected ? '#7C5CFC' : (isHovered && !locked ? 'rgba(124,92,252,0.5)' : (el.borderEnabled && el.borderColor ? el.borderColor : undefined)),
    strokeWidth: isSelected ? 1.5 : (isHovered && !locked && !el.borderEnabled ? 1 : (el.borderEnabled && el.borderWidth ? el.borderWidth : 0)),
    dash: isSelected ? undefined : (() => {
      if (!el.borderEnabled) return undefined;
      const s = el.borderStyle || 'solid';
      const w = el.borderWidth || 2;
      if (s === 'dashed') return [w * 4, w * 3];
      if (s === 'dotted') return [w, w * 2.5];
      return undefined;
    })(),
    scaleX: el.flipH ? -1 : 1,
    scaleY: el.flipV ? -1 : 1,
    globalCompositeOperation: el.blendMode || 'source-over',
    shadowEnabled: el.shadow?.enabled || false,
    shadowColor: el.shadow?.color || '#000000',
    shadowBlur: el.shadow?.blur ?? 4,
    shadowOffsetX: el.shadow?.offsetX ?? 2,
    shadowOffsetY: el.shadow?.offsetY ?? 2,
    shadowOpacity: el.shadow?.opacity ?? 0.5,
  };

  if (el.type === 'text') {
    const tbPad = el.textBg?.padding ?? 6;
    const isGradText = el.fillType === 'gradient' && el.fillGradient;
    let gradTextProps = {};
    if (isGradText) {
      const g = el.fillGradient;
      const { startPoint, endPoint } = gradientPoints(g.angle ?? 135, el.width || 400, (el.fontSize || 36) * 2);
      gradTextProps = {
        fill: undefined,
        fillLinearGradientStartPoint: startPoint,
        fillLinearGradientEndPoint: endPoint,
        fillLinearGradientColorStops: g.midColor
          ? [0, g.c1||'#ffffff', g.midStop??0.5, g.midColor, 1, g.c2||'#000000']
          : [0, g.c1||'#ffffff', 1, g.c2||'#000000'],
      };
    }
    // Curved / arch text rendering
    if (el.textCurve) {
      const rawText = applyTextTransform(applyListStyle(el.text || '', el.listStyle), el.textTransform) || '';
      const fontSize = el.fontSize || 36;
      const curveR = el.textCurve;
      const absR = Math.abs(curveR);
      const w = el.width || 400;
      const boxH = absR * 0.55 + fontSize * 2;
      const fontParts = [];
      const fs = el.fontStyle || 'normal';
      if (fs === 'bold' || fs === 'bold italic') fontParts.push('bold');
      if (fs === 'italic' || fs === 'bold italic') fontParts.push('italic');
      fontParts.push(`${fontSize}px`, el.fontFamily || 'Inter');
      const fontStr = fontParts.join(' ');

      return (
        <Shape
          {...common}
          width={w}
          height={boxH}
          opacity={el.opacity ?? 1}
          globalCompositeOperation={el.blendMode || 'source-over'}
          shadowEnabled={el.shadow?.enabled || false}
          shadowColor={el.shadow?.color || '#000000'}
          shadowBlur={el.shadow?.blur ?? 4}
          shadowOffsetX={el.shadow?.offsetX ?? 2}
          shadowOffsetY={el.shadow?.offsetY ?? 2}
          shadowOpacity={el.shadow?.opacity ?? 0.5}
          stroke=''
          strokeWidth={0}
          sceneFunc={(ctx) => {
            ctx.font = fontStr;
            ctx.fillStyle = el.fill || '#ffffff';
            ctx.textBaseline = 'middle';
            const chars = Array.from(rawText);
            const charWidths = chars.map(c => ctx.measureText(c).width);
            const totalW = charWidths.reduce((a, b) => a + b, 0);
            const totalAngle = totalW / absR;
            const cx = w / 2;

            if (curveR > 0) {
              // Arch up: circle center at (cx, absR), text along top
              let angle = -Math.PI / 2 - totalAngle / 2;
              chars.forEach((char, i) => {
                const a = angle + charWidths[i] / (2 * absR);
                const x = cx + absR * Math.cos(a);
                const y = absR + absR * Math.sin(a);
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(a + Math.PI / 2);
                ctx.fillText(char, -charWidths[i] / 2, 0);
                ctx.restore();
                angle += charWidths[i] / absR;
              });
            } else {
              // Arch down: circle center at (cx, boxH - absR), text along bottom
              const cy = boxH - absR;
              let angle = Math.PI / 2 - totalAngle / 2;
              chars.forEach((char, i) => {
                const a = angle + charWidths[i] / (2 * absR);
                const x = cx + absR * Math.cos(a);
                const y = cy + absR * Math.sin(a);
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(a - Math.PI / 2);
                ctx.fillText(char, -charWidths[i] / 2, 0);
                ctx.restore();
                angle += charWidths[i] / absR;
              });
            }
          }}
        />
      );
    }

    const textNode = (
      <Text
        {...common}
        text={applyTextTransform(applyListStyle(el.text, el.listStyle), el.textTransform)}
        fontSize={el.fontSize || 36}
        fontFamily={el.fontFamily || 'Inter'}
        fontStyle={el.fontStyle || 'normal'}
        textDecoration={el.textDecoration || ''}
        fill={isGradText ? undefined : (el.fill || '#ffffff')}
        {...gradTextProps}
        width={el.width || 400}
        align={el.align || 'center'}
        opacity={el.opacity ?? 1}
        lineHeight={el.lineHeight ?? 1.2}
        letterSpacing={el.letterSpacing ?? 0}
        shadowEnabled={el.shadow?.enabled || false}
        shadowColor={el.shadow?.color || '#000000'}
        shadowBlur={el.shadow?.blur ?? 4}
        shadowOffsetX={el.shadow?.offsetX ?? 2}
        shadowOffsetY={el.shadow?.offsetY ?? 2}
        shadowOpacity={el.shadow?.opacity ?? 0.5}
        stroke={el.outline?.enabled ? (el.outline.color || '#000000') : ''}
        strokeWidth={el.outline?.enabled ? (el.outline.width ?? 1) : 0}
        verticalAlign={el.verticalAlign || 'middle'}
        onDblClick={() => onDblClick(el.id)}
        onDblTap={() => onDblClick(el.id)}
      />
    );
    if (!el.textBg?.enabled) return textNode;
    return (
      <>
        <Rect
          x={(el.x || 0) - tbPad}
          y={(el.y || 0) - tbPad}
          width={(el.width || 400) + tbPad * 2}
          height={measuredH + tbPad * 2}
          fill={el.textBg.color || '#ffffff'}
          opacity={el.textBg.opacity ?? 1}
          cornerRadius={el.textBg.radius ?? 4}
          rotation={el.rotation || 0}
          listening={false}
          visible={!hidden && el.visible !== false}
        />
        {textNode}
      </>
    );
  }

  // Compute gradient fill props for shapes
  const shapeW = el.width || 200;
  const shapeH = el.height || 200;
  const isGradFill = el.fillType === 'gradient' && el.fillGradient;
  let gradFillProps = {};
  if (isGradFill) {
    const g = el.fillGradient;
    const gw = el.radius ? (el.radius || el.outerRadius || 60) * 2 : shapeW;
    const gh = el.radius ? (el.radius || el.outerRadius || 60) * 2 : shapeH;
    const { startPoint, endPoint } = gradientPoints(g.angle ?? 135, gw, gh);
    gradFillProps = {
      fill: undefined,
      fillLinearGradientStartPoint: startPoint,
      fillLinearGradientEndPoint: endPoint,
      fillLinearGradientColorStops: g.midColor
        ? [0, g.c1||'#ffffff', g.midStop??0.5, g.midColor, 1, g.c2||'#000000']
        : [0, g.c1||'#ffffff', 1, g.c2||'#000000'],
    };
  }

  if (el.type === 'rect') return (
    <Rect {...common}
      width={shapeW} height={el.height || 100}
      fill={isGradFill ? undefined : (el.fill || 'rgba(255,255,255,0.2)')}
      {...gradFillProps}
      cornerRadius={el.cornerRadius || 0}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'circle') return (
    <Circle {...common}
      radius={el.radius || 60}
      fill={isGradFill ? undefined : (el.fill || 'rgba(255,255,255,0.2)')}
      {...gradFillProps}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'line') return (
    <Line {...common}
      points={el.points || [0, 0, el.width || 200, 0]}
      stroke={el.stroke || '#ffffff'}
      strokeWidth={el.strokeWidth || 3}
      dash={(() => { const s = el.strokeStyle||'solid'; const w = el.strokeWidth||3; if (s==='dashed') return [w*4,w*3]; if (s==='dotted') return [w,w*2.5]; return undefined; })()}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'triangle') return (
    <RegularPolygon {...common}
      sides={el.sides || 3}
      radius={el.radius || 60}
      fill={isGradFill ? undefined : (el.fill || 'rgba(255,255,255,0.2)')}
      {...gradFillProps}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'star') return (
    <Star {...common}
      numPoints={el.numPoints || 5}
      outerRadius={el.outerRadius || 60}
      innerRadius={el.innerRadius || 25}
      fill={isGradFill ? undefined : (el.fill || 'rgba(255,255,255,0.2)')}
      {...gradFillProps}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'arrow') return (
    <Arrow {...common}
      points={[0, 0, el.width || 200, 0]}
      pointerLength={15}
      pointerWidth={12}
      fill={el.fill || '#ffffff'}
      stroke={el.fill || '#ffffff'}
      strokeWidth={el.strokeWidth || 4}
      dash={(() => { const s = el.strokeStyle||'solid'; const w = el.strokeWidth||4; if (s==='dashed') return [w*4,w*3]; if (s==='dotted') return [w,w*2.5]; return undefined; })()}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'shape') {
    const sw = el.width || 160, sh = el.height || 120;
    const kind = el.shapeKind || 'speechbubble';
    const fillColor = isGradFill ? undefined : (el.fill || 'rgba(255,255,255,0.2)');
    return (
      <Shape {...common}
        width={sw} height={sh}
        fill={fillColor}
        {...gradFillProps}
        opacity={el.opacity ?? 1}
        shadowEnabled={el.shadow?.enabled || false}
        shadowColor={el.shadow?.color || '#000000'}
        shadowBlur={el.shadow?.blur ?? 8}
        shadowOffsetX={el.shadow?.offsetX ?? 4}
        shadowOffsetY={el.shadow?.offsetY ?? 4}
        shadowOpacity={el.shadow?.opacity ?? 0.5}
        stroke={el.stroke || ''}
        strokeWidth={el.strokeWidth || 0}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape) => {
          const w = shape.width(), h = shape.height();
          ctx.beginPath();
          if (kind === 'speechbubble') {
            const r = 16; const tail = h * 0.22; const tw = w * 0.18;
            ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.arcTo(w, 0, w, r, r);
            ctx.lineTo(w, h - tail - r); ctx.arcTo(w, h - tail, w - r, h - tail, r);
            ctx.lineTo(w * 0.3 + tw, h - tail);
            ctx.lineTo(w * 0.2, h);
            ctx.lineTo(w * 0.3, h - tail);
            ctx.lineTo(r, h - tail); ctx.arcTo(0, h - tail, 0, h - tail - r, r);
            ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r);
          } else if (kind === 'speechbubble_right') {
            const r = 16; const tail = h * 0.22; const tw = w * 0.18;
            ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.arcTo(w, 0, w, r, r);
            ctx.lineTo(w, r); ctx.lineTo(w, h - tail - r); ctx.arcTo(w, h - tail, w - r, h - tail, r);
            ctx.lineTo(w * 0.7 + tw, h - tail);
            ctx.lineTo(w * 0.8, h);
            ctx.lineTo(w * 0.7, h - tail);
            ctx.lineTo(r, h - tail); ctx.arcTo(0, h - tail, 0, h - tail - r, r);
            ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r);
          } else if (kind === 'heart') {
            const cx = w / 2, cy = h / 2;
            ctx.moveTo(cx, cy + h * 0.3);
            ctx.bezierCurveTo(cx - w * 0.5, cy, cx - w * 0.5, cy - h * 0.4, cx, cy - h * 0.15);
            ctx.bezierCurveTo(cx + w * 0.5, cy - h * 0.4, cx + w * 0.5, cy, cx, cy + h * 0.3);
          } else if (kind === 'cross') {
            const t = w * 0.27; // thickness
            ctx.moveTo(t, 0); ctx.lineTo(w - t, 0); ctx.lineTo(w - t, t);
            ctx.lineTo(w, t); ctx.lineTo(w, h - t); ctx.lineTo(w - t, h - t);
            ctx.lineTo(w - t, h); ctx.lineTo(t, h); ctx.lineTo(t, h - t);
            ctx.lineTo(0, h - t); ctx.lineTo(0, t); ctx.lineTo(t, t);
          } else if (kind === 'pentagon') {
            const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
            for (let i = 0; i < 5; i++) {
              const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
              i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
                      : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
            }
          } else if (kind === 'octagon') {
            const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
            for (let i = 0; i < 8; i++) {
              const a = (Math.PI * 2 / 8) * i - Math.PI / 8;
              i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
                      : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
            }
          } else if (kind === 'hexagon') {
            const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
            for (let i = 0; i < 6; i++) {
              const a = (Math.PI * 2 / 6) * i - Math.PI / 2;
              i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
                      : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
            }
          } else if (kind === 'cloud') {
            const cx = w / 2, cy = h / 2;
            ctx.arc(cx * 0.55, cy * 1.1, w * 0.22, Math.PI, 0);
            ctx.arc(cx * 0.82, cy * 0.75, w * 0.2, Math.PI * 0.9, 0.1);
            ctx.arc(cx * 1.18, cy * 0.65, w * 0.25, Math.PI * 0.85, 0.05);
            ctx.arc(cx * 1.5, cy * 0.85, w * 0.19, Math.PI * 0.8, 0.2);
            ctx.arc(cx * 1.45, cy * 1.1, w * 0.18, 0, Math.PI);
          } else if (kind === 'parallelogram') {
            const skew = w * 0.2;
            ctx.moveTo(skew, 0); ctx.lineTo(w, 0); ctx.lineTo(w - skew, h); ctx.lineTo(0, h);
          } else if (kind === 'banner') {
            const notch = w * 0.08;
            ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w - notch, h / 2); ctx.lineTo(w, h);
            ctx.lineTo(0, h); ctx.lineTo(notch, h / 2);
          } else {
            ctx.rect(0, 0, w, h);
          }
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
      />
    );
  }

  if (el.type === 'progressbar') {
    const pw = el.width || 280, ph = el.height || 14;
    const pct = Math.min(100, Math.max(0, el.progress ?? 75)) / 100;
    const trackColor = el.trackColor || 'rgba(255,255,255,0.2)';
    const fillColor2 = el.fill || TEAL;
    const radius = el.cornerRadius ?? ph / 2;
    return (
      <Shape {...common}
        width={pw} height={ph}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape) => {
          const w = shape.width(), h = shape.height();
          const r = Math.min(radius, h / 2);
          // Track
          ctx.beginPath();
          ctx.roundRect(0, 0, w, h, r);
          ctx.fillStyle = trackColor;
          ctx.fill();
          // Fill
          if (pct > 0) {
            ctx.beginPath();
            const fw = Math.max(r * 2, w * pct);
            ctx.roundRect(0, 0, fw, h, r);
            ctx.fillStyle = fillColor2;
            ctx.fill();
          }
        }}
      />
    );
  }

  if (el.type === 'chart') {
    const cw = el.width || 240, ch = el.height || 160;
    const data = el.chartData || [
      { label: 'A', value: 40, color: TEAL },
      { label: 'B', value: 65, color: '#7C5CFC' },
      { label: 'C', value: 25, color: '#f59e0b' },
    ];
    const chartType = el.chartType || 'bar';
    return (
      <Shape {...common}
        width={cw} height={ch}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape) => {
          const w = shape.width(), h = shape.height();
          const pad = 12;

          if (chartType === 'bar') {
            const maxVal = Math.max(...data.map(d => d.value), 1);
            const barW = (w - pad * 2) / data.length;
            const labelH = 14, barAreaH = h - pad * 2 - labelH;

            data.forEach((d, i) => {
              const bh = Math.max(2, (d.value / maxVal) * barAreaH);
              const bx = pad + i * barW + barW * 0.12;
              const by = pad + barAreaH - bh;
              const bw = barW * 0.76;
              const r = Math.min(4, bw / 2);
              ctx.beginPath();
              ctx.roundRect(bx, by, bw, bh, [r, r, 0, 0]);
              ctx.fillStyle = d.color || TEAL;
              ctx.fill();
              // Label
              ctx.fillStyle = el.labelColor || 'rgba(255,255,255,0.7)';
              ctx.font = `${Math.max(9, Math.round(barW * 0.3))}px Inter, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillText(d.label || '', bx + bw / 2, pad + barAreaH + 3);
              // Value
              ctx.font = `bold ${Math.max(8, Math.round(barW * 0.26))}px Inter, sans-serif`;
              ctx.fillStyle = d.color || TEAL;
              ctx.textBaseline = 'bottom';
              ctx.fillText(d.value, bx + bw / 2, by - 1);
            });

          } else {
            // Pie chart
            const cx = w / 2, cy = h / 2;
            const r = Math.min(cx, cy) - pad;
            const total = data.reduce((s, d) => s + d.value, 0) || 1;
            let startAngle = -Math.PI / 2;

            data.forEach((d, i) => {
              const sliceAngle = (d.value / total) * Math.PI * 2;
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
              ctx.closePath();
              ctx.fillStyle = d.color || TEAL;
              ctx.fill();
              // Gap line
              ctx.strokeStyle = el.bgFill || 'rgba(0,0,0,0.3)';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              // Label at midpoint
              const midAngle = startAngle + sliceAngle / 2;
              const lx = cx + (r * 0.65) * Math.cos(midAngle);
              const ly = cy + (r * 0.65) * Math.sin(midAngle);
              ctx.fillStyle = '#fff';
              ctx.font = `bold ${Math.max(9, Math.round(r * 0.16))}px Inter, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              if (sliceAngle > 0.3) ctx.fillText(d.label || '', lx, ly);
              startAngle += sliceAngle;
            });
          }
        }}
      />
    );
  }

  if (el.type === 'table') {
    const tw = el.width || 280, th = el.height || 160;
    const rows = el.tableRows || 3, cols = el.tableCols || 3;
    const cellW = tw / cols, cellH = th / rows;
    const headerColor = el.headerColor || TEAL;
    const rowEven = el.rowEvenColor || 'rgba(255,255,255,0.08)';
    const rowOdd = el.rowOddColor || 'rgba(255,255,255,0.04)';
    const borderColor = el.borderColor || 'rgba(255,255,255,0.25)';
    const textColor = el.labelColor || '#ffffff';
    const cells = el.cells || [];

    return (
      <Shape {...common}
        width={tw} height={th}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape) => {
          const w = shape.width(), h = shape.height();
          const cw2 = w / cols, ch2 = h / rows;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const x = c * cw2, y = r * ch2;
              if (r === 0) {
                ctx.fillStyle = headerColor;
              } else {
                ctx.fillStyle = r % 2 === 0 ? rowEven : rowOdd;
              }
              ctx.fillRect(x, y, cw2, ch2);

              // Cell text
              const cellData = cells[r * cols + c] || {};
              const label = cellData.text || (r === 0 ? `Col ${c + 1}` : `${r},${c + 1}`);
              const fsize = Math.max(8, Math.min(14, Math.round(ch2 * 0.38)));
              ctx.font = `${r === 0 ? 'bold' : 'normal'} ${fsize}px Inter, sans-serif`;
              ctx.fillStyle = r === 0 ? '#ffffff' : textColor;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(label, x + cw2 / 2, y + ch2 / 2);
            }
          }

          // Grid lines
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 0.75;
          for (let r = 0; r <= rows; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * ch2);
            ctx.lineTo(w, r * ch2);
            ctx.stroke();
          }
          for (let c = 0; c <= cols; c++) {
            ctx.beginPath();
            ctx.moveTo(c * cw2, 0);
            ctx.lineTo(c * cw2, h);
            ctx.stroke();
          }
        }}
      />
    );
  }

  if (el.type === 'countdown') {
    const cw = el.width || 300, ch = el.height || 90;
    const targetDate = el.targetDate ? new Date(el.targetDate) : new Date(Date.now() + 7 * 86400000);
    const now = Date.now();
    const diff = Math.max(0, targetDate.getTime() - now);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const units = el.showSeconds ? [['days',days],['hrs',hours],['min',mins],['sec',secs]] : [['days',days],['hrs',hours],['min',mins]];
    const boxCount = units.length;
    const gap = 8;
    const boxW = (cw - gap * (boxCount + 1)) / boxCount;
    const boxH = ch - gap * 2;
    const boxColor = el.fill || TEAL;
    const textColor = el.labelColor || '#ffffff';

    return (
      <Shape {...common}
        width={cw} height={ch}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape) => {
          const w = shape.width(), h = shape.height();
          const bw = (w - gap * (boxCount + 1)) / boxCount;
          const bh = h - gap * 2;
          const numSize = Math.max(16, Math.round(bh * 0.5));
          const lblSize = Math.max(8, Math.round(bh * 0.2));
          const r = Math.min(8, bw * 0.15);

          units.forEach(([lbl, val], i) => {
            const x = gap + i * (bw + gap);
            const y = gap;

            // Box background
            ctx.beginPath();
            ctx.roundRect(x, y, bw, bh, r);
            ctx.fillStyle = boxColor;
            ctx.fill();

            // Number
            ctx.font = `bold ${numSize}px Inter, sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(val).padStart(2, '0'), x + bw / 2, y + bh * 0.42);

            // Label
            ctx.font = `${lblSize}px Inter, sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.fillText(lbl, x + bw / 2, y + bh * 0.78);
          });

          // Colons between boxes
          ctx.font = `bold ${Math.round(numSize * 0.7)}px Inter, sans-serif`;
          ctx.fillStyle = textColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (let i = 0; i < boxCount - 1; i++) {
            const colonX = gap + (i + 1) * (bw + gap) - gap / 2;
            ctx.fillText(':', colonX, h / 2 - gap * 0.3);
          }
        }}
      />
    );
  }

  if (el.type === 'rating') {
    const rw = el.width || 200, rh = el.height || 40;
    const maxStars = el.maxStars || 5;
    const rating = el.rating ?? 4.5;
    const starColor = el.fill || '#f59e0b';
    const emptyColor = el.emptyColor || 'rgba(255,255,255,0.25)';
    const showLabel = el.showLabel !== false;

    return (
      <Shape {...common}
        width={rw} height={rh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape) => {
          const w = shape.width(), h = shape.height();
          const labelH = showLabel ? Math.min(14, h * 0.3) : 0;
          const starAreaH = h - labelH;
          const starSize = Math.min(starAreaH, (w - 4 * (maxStars - 1)) / maxStars);
          const totalW = starSize * maxStars + 4 * (maxStars - 1);
          const startX = (w - totalW) / 2;
          const centerY = starAreaH / 2;

          function drawStar(cx, cy, r, fillFraction) {
            const ir = r * 0.4;
            const path = new Path2D();
            for (let i = 0; i < 10; i++) {
              const angle = (Math.PI / 5) * i - Math.PI / 2;
              const rad = i % 2 === 0 ? r : ir;
              const x = cx + rad * Math.cos(angle);
              const y = cy + rad * Math.sin(angle);
              i === 0 ? path.moveTo(x, y) : path.lineTo(x, y);
            }
            path.closePath();

            if (fillFraction >= 1) {
              ctx.fillStyle = starColor;
              ctx.fill(path);
            } else if (fillFraction <= 0) {
              ctx.fillStyle = emptyColor;
              ctx.fill(path);
            } else {
              // Clip to left portion for partial fill
              ctx.save();
              ctx.fillStyle = emptyColor;
              ctx.fill(path);
              ctx.clip(path);
              ctx.fillStyle = starColor;
              ctx.fillRect(cx - r, cy - r, r * 2 * fillFraction, r * 2);
              ctx.restore();
            }
          }

          for (let i = 0; i < maxStars; i++) {
            const fraction = Math.min(1, Math.max(0, rating - i));
            const sx = startX + i * (starSize + 4) + starSize / 2;
            drawStar(sx, centerY, starSize / 2 * 0.9, fraction);
          }

          if (showLabel) {
            ctx.font = `bold ${Math.max(10, labelH - 2)}px Inter, sans-serif`;
            ctx.fillStyle = starColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${rating} / ${maxStars}`, w / 2, starAreaH + 1);
          }
        }}
      />
    );
  }

  if (el.type === 'quote') {
    const qw = el.width || 300, qh = el.height || 160;
    const quoteText = el.quoteText || '"Great service, highly recommend!"';
    const attribution = el.attribution || '— Happy Customer';
    const accentColor = el.fill || TEAL;
    const textColor = el.labelColor || '#ffffff';
    const bgColor = el.bgColor || 'rgba(255,255,255,0.08)';
    const style = el.quoteStyle || 'block'; // 'block' | 'minimal' | 'bubble'

    return (
      <Shape {...common}
        width={qw} height={qh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape) => {
          const w = shape.width(), h = shape.height();
          const pad = 18;
          const r = el.cornerRadius ?? 12;

          if (style === 'block') {
            // Background card
            ctx.beginPath();
            ctx.roundRect(0, 0, w, h, r);
            ctx.fillStyle = bgColor;
            ctx.fill();
            // Left accent bar
            ctx.beginPath();
            ctx.roundRect(0, 0, 5, h, [r, 0, 0, r]);
            ctx.fillStyle = accentColor;
            ctx.fill();
            // Big opening quote mark
            ctx.font = `bold ${Math.min(60, h * 0.45)}px Georgia, serif`;
            ctx.fillStyle = accentColor;
            ctx.globalAlpha = 0.35;
            ctx.textBaseline = 'top';
            ctx.fillText('“', pad, 4);
            ctx.globalAlpha = 1;
            // Quote text
            const textSize = Math.max(11, Math.min(18, Math.round(h * 0.13)));
            ctx.font = `italic ${textSize}px Georgia, serif`;
            ctx.fillStyle = textColor;
            ctx.textBaseline = 'top';
            const lines = [];
            const maxLineW = w - pad * 2 - 8;
            let line = '';
            for (const word of quoteText.split(' ')) {
              const test = line ? `${line} ${word}` : word;
              if (ctx.measureText(test).width > maxLineW) { lines.push(line); line = word; }
              else line = test;
            }
            if (line) lines.push(line);
            const lineH = textSize * 1.5;
            const textBlockH = lines.length * lineH;
            const textY = (h - textBlockH - textSize * 1.2) / 2 + 8;
            lines.forEach((l, i) => ctx.fillText(l, pad + 8, textY + i * lineH));
            // Attribution
            ctx.font = `bold ${Math.max(10, textSize - 2)}px Inter, sans-serif`;
            ctx.fillStyle = accentColor;
            ctx.textBaseline = 'bottom';
            ctx.fillText(attribution, pad + 8, h - pad * 0.6);

          } else if (style === 'minimal') {
            // Just big quote mark + text, no background
            const qSize = Math.min(48, h * 0.35);
            ctx.font = `bold ${qSize}px Georgia, serif`;
            ctx.fillStyle = accentColor;
            ctx.textBaseline = 'top';
            ctx.fillText('“', 0, 0);
            const textSize = Math.max(11, Math.min(16, Math.round(h * 0.11)));
            ctx.font = `italic ${textSize}px Georgia, serif`;
            ctx.fillStyle = textColor;
            ctx.fillText(quoteText, 0, qSize * 0.7);
            ctx.font = `bold ${textSize - 1}px Inter, sans-serif`;
            ctx.fillStyle = accentColor;
            ctx.textBaseline = 'bottom';
            ctx.fillText(attribution, 0, h);

          } else {
            // Bubble style: circle avatar area on left, text on right
            const avatarR = Math.min(28, h * 0.28);
            const avatarX = pad + avatarR, avatarY = h / 2;
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
            ctx.fillStyle = accentColor;
            ctx.fill();
            ctx.font = `bold ${avatarR * 0.9}px Inter, sans-serif`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((attribution || '?').replace(/^[^A-Za-z]*/, '')[0]?.toUpperCase() || '?', avatarX, avatarY);
            const textSize = Math.max(10, Math.min(15, Math.round(h * 0.1)));
            const textX = pad + avatarR * 2 + 12;
            ctx.font = `italic ${textSize}px Georgia, serif`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(quoteText.slice(0, 60) + (quoteText.length > 60 ? '…' : ''), textX, h / 2 - textSize);
            ctx.font = `bold ${textSize - 1}px Inter, sans-serif`;
            ctx.fillStyle = accentColor;
            ctx.fillText(attribution, textX, h / 2 + textSize);
          }
        }}
      />
    );
  }

  if (el.type === 'badge') {
    const bw = el.width || 140, bh = el.height || 140;
    const r = Math.min(bw, bh) / 2;
    const bgColor = el.fill || '#ef4444';
    const textColor2 = el.labelColor || '#ffffff';
    const line1 = el.badgeLine1 || 'SALE';
    const line2 = el.badgeLine2 || '50% OFF';
    const line3 = el.badgeLine3 || '';
    const shape = el.badgeShape || 'circle'; // 'circle' | 'burst' | 'rounded'
    const hasBorder = el.badgeBorder !== false;
    const borderColor2 = el.badgeBorderColor || 'rgba(255,255,255,0.6)';

    return (
      <Shape {...common}
        width={bw} height={bh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          const cx = w / 2, cy = h / 2;
          const rad = Math.min(cx, cy);

          ctx.save();
          ctx.translate(cx, cy);

          if (shape === 'burst') {
            // Starburst / sunburst shape
            const points = 16;
            const outerR = rad;
            const innerR = rad * 0.82;
            ctx.beginPath();
            for (let i = 0; i < points * 2; i++) {
              const angle = (Math.PI / points) * i - Math.PI / 2;
              const r2 = i % 2 === 0 ? outerR : innerR;
              const x = r2 * Math.cos(angle), y = r2 * Math.sin(angle);
              i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = bgColor;
            ctx.fill();
            if (hasBorder) {
              ctx.strokeStyle = borderColor2;
              ctx.lineWidth = 2;
              ctx.stroke();
            }
            // Inner circle border
            ctx.beginPath();
            ctx.arc(0, 0, innerR * 0.88, 0, Math.PI * 2);
            ctx.strokeStyle = borderColor2;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (shape === 'rounded') {
            const rr = Math.min(rad * 0.35, 20);
            ctx.beginPath();
            ctx.roundRect(-cx, -cy, w, h, rr);
            ctx.fillStyle = bgColor;
            ctx.fill();
            if (hasBorder) {
              ctx.strokeStyle = borderColor2;
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.beginPath();
              ctx.roundRect(-cx + 5, -cy + 5, w - 10, h - 10, Math.max(0, rr - 5));
              ctx.strokeStyle = borderColor2;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          } else {
            // Circle
            ctx.beginPath();
            ctx.arc(0, 0, rad, 0, Math.PI * 2);
            ctx.fillStyle = bgColor;
            ctx.fill();
            if (hasBorder) {
              ctx.strokeStyle = borderColor2;
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(0, 0, rad - 6, 0, Math.PI * 2);
              ctx.strokeStyle = borderColor2;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }

          // Text lines
          const lines = [line1, line2, line3].filter(Boolean);
          const sizes = [rad * 0.22, rad * 0.32, rad * 0.18];
          const weights = ['normal', 'bold', 'normal'];
          const totalH = lines.reduce((s, _, i) => s + sizes[i] * 1.25, 0);
          let textY = -totalH / 2;

          ctx.textAlign = 'center';
          ctx.fillStyle = textColor2;
          lines.forEach((line, i) => {
            const sz = sizes[Math.min(i, sizes.length - 1)];
            ctx.font = `${weights[i] || 'bold'} ${sz}px Inter, sans-serif`;
            ctx.textBaseline = 'top';
            ctx.fillText(line, 0, textY);
            textY += sz * 1.25;
          });

          ctx.restore();
        }}
      />
    );
  }

  if (el.type === 'divider') {
    const dw = el.width || 280, dh = el.height || 24;
    const lineColor = el.fill || 'rgba(255,255,255,0.5)';
    const style2 = el.dividerStyle || 'solid'; // solid|dashed|double|gradient|ornament
    const lw = el.strokeWidth || 2;

    return (
      <Shape {...common}
        width={dw} height={dh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          const cy = h / 2;

          function drawLine(x1, x2, y, width, dash) {
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
            ctx.lineWidth = width;
            if (dash) ctx.setLineDash(dash);
            else ctx.setLineDash([]);
            ctx.strokeStyle = lineColor;
            ctx.stroke();
            ctx.setLineDash([]);
          }

          if (style2 === 'solid') {
            drawLine(0, w, cy, lw);
          } else if (style2 === 'dashed') {
            drawLine(0, w, cy, lw, [lw * 4, lw * 3]);
          } else if (style2 === 'dotted') {
            drawLine(0, w, cy, lw, [lw, lw * 2.5]);
          } else if (style2 === 'double') {
            drawLine(0, w, cy - lw, lw * 0.7);
            drawLine(0, w, cy + lw, lw * 0.7);
          } else if (style2 === 'gradient') {
            const grad = ctx.createLinearGradient(0, 0, w, 0);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(0.3, lineColor);
            grad.addColorStop(0.7, lineColor);
            grad.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.moveTo(0, cy);
            ctx.lineTo(w, cy);
            ctx.lineWidth = lw;
            ctx.strokeStyle = grad;
            ctx.stroke();
          } else if (style2 === 'ornament') {
            const ornW = Math.min(40, w * 0.15);
            const sideW = (w - ornW - 20) / 2;
            drawLine(0, sideW, cy, lw);
            drawLine(w - sideW, w, cy, lw);
            // Diamond ornament in center
            ctx.beginPath();
            const ox = w / 2, oy = cy;
            const os = ornW * 0.35;
            ctx.moveTo(ox, oy - os); ctx.lineTo(ox + os, oy);
            ctx.lineTo(ox, oy + os); ctx.lineTo(ox - os, oy);
            ctx.closePath();
            ctx.fillStyle = lineColor;
            ctx.fill();
          }
        }}
      />
    );
  }

  if (el.type === 'socialstats') {
    const sw = el.width || 300, sh = el.height || 80;
    const stats = el.stats || [
      { icon: '👥', value: '2.4K', label: 'Followers' },
      { icon: '❤', value: '18K', label: 'Likes' },
      { icon: '📸', value: '342', label: 'Posts' },
    ];
    const accentColor = el.fill || TEAL;
    const bgColor = el.bgColor || 'rgba(255,255,255,0.08)';
    const textColor2 = el.labelColor || '#ffffff';
    const platform = el.platform || ''; // optional platform label

    return (
      <Shape {...common}
        width={sw} height={sh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          const pad = 10;
          const r = el.cornerRadius ?? 10;
          const count = stats.length;
          const colW = (w - pad * 2) / count;

          // Background
          ctx.beginPath();
          ctx.roundRect(0, 0, w, h, r);
          ctx.fillStyle = bgColor;
          ctx.fill();

          // Platform label at top-left if set
          if (platform) {
            ctx.font = `bold ${Math.max(9, Math.round(h * 0.13))}px Inter, sans-serif`;
            ctx.fillStyle = accentColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(platform, pad, 6);
          }

          const vertCenter = h / 2;
          const valSize = Math.max(14, Math.round(h * 0.3));
          const lblSize = Math.max(8, Math.round(h * 0.14));
          const iconSize = Math.max(12, Math.round(h * 0.2));

          stats.forEach((s, i) => {
            const cx = pad + i * colW + colW / 2;

            // Vertical separator
            if (i > 0) {
              ctx.beginPath();
              ctx.moveTo(pad + i * colW, h * 0.2);
              ctx.lineTo(pad + i * colW, h * 0.8);
              ctx.strokeStyle = 'rgba(255,255,255,0.15)';
              ctx.lineWidth = 1;
              ctx.stroke();
            }

            // Icon
            ctx.font = `${iconSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = textColor2;
            ctx.fillText(s.icon || '', cx, vertCenter - valSize * 0.55);

            // Value
            ctx.font = `bold ${valSize}px Inter, sans-serif`;
            ctx.fillStyle = accentColor;
            ctx.fillText(s.value || '0', cx, vertCenter + valSize * 0.1);

            // Label
            ctx.font = `${lblSize}px Inter, sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(s.label || '', cx, vertCenter + valSize * 0.68);
          });
        }}
      />
    );
  }

  if (el.type === 'callout') {
    const cbw = el.width || 300, cbh = el.height || 100;
    const accentColor = el.fill || '#f59e0b';
    const bgColor = el.bgColor || 'rgba(255,255,255,0.08)';
    const icon = el.calloutIcon || '💡';
    const heading = el.calloutHeading || 'Pro Tip';
    const body = el.calloutBody || 'Here is something useful you should know about this topic.';
    const calloutStyle = el.calloutStyle || 'side'; // 'side' | 'top' | 'outline'
    const r = el.cornerRadius ?? 10;

    return (
      <Shape {...common}
        width={cbw} height={cbh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          const pad = 14;

          // Background
          ctx.beginPath();
          ctx.roundRect(0, 0, w, h, r);
          ctx.fillStyle = bgColor;
          ctx.fill();

          if (calloutStyle === 'side') {
            // Left accent strip
            ctx.beginPath();
            ctx.roundRect(0, 0, 5, h, [r, 0, 0, r]);
            ctx.fillStyle = accentColor;
            ctx.fill();

            const iconSize = Math.min(28, h * 0.35);
            const textX = pad + iconSize + 12;
            const textW = w - textX - pad;

            // Icon
            ctx.font = `${iconSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icon, pad + 8 + iconSize / 2, h / 2);

            // Heading
            const headSize = Math.max(12, Math.round(h * 0.16));
            ctx.font = `bold ${headSize}px Inter, sans-serif`;
            ctx.fillStyle = accentColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(heading, textX, pad);

            // Body text (word-wrap)
            const bodySize = Math.max(10, Math.round(h * 0.12));
            ctx.font = `${bodySize}px Inter, sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            const lines = [];
            let line = '';
            for (const word of body.split(' ')) {
              const test = line ? `${line} ${word}` : word;
              if (ctx.measureText(test).width > textW) { lines.push(line); line = word; }
              else line = test;
            }
            if (line) lines.push(line);
            const lineH = bodySize * 1.4;
            const bodyY = pad + headSize * 1.4;
            lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, textX, bodyY + i * lineH));

          } else if (calloutStyle === 'top') {
            // Top accent bar
            ctx.beginPath();
            ctx.roundRect(0, 0, w, 5, [r, r, 0, 0]);
            ctx.fillStyle = accentColor;
            ctx.fill();

            const iconSize = Math.min(20, h * 0.22);
            ctx.font = `${iconSize}px Inter, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(icon, pad, pad + 4);

            const headSize = Math.max(12, Math.round(h * 0.16));
            ctx.font = `bold ${headSize}px Inter, sans-serif`;
            ctx.fillStyle = accentColor;
            ctx.fillText(heading, pad + iconSize + 8, pad + 4);

            const bodySize = Math.max(10, Math.round(h * 0.12));
            ctx.font = `${bodySize}px Inter, sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.textBaseline = 'top';
            ctx.fillText(body.slice(0, 60) + (body.length > 60 ? '…' : ''), pad, pad + headSize * 1.8);

          } else {
            // Outline style: just a border rectangle
            ctx.beginPath();
            ctx.roundRect(0, 0, w, h, r);
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 2;
            ctx.stroke();

            const iconSize = Math.min(24, h * 0.28);
            ctx.font = `${iconSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(icon, pad + iconSize / 2, h / 2 - iconSize / 2);

            const headSize = Math.max(12, Math.round(h * 0.16));
            ctx.font = `bold ${headSize}px Inter, sans-serif`;
            ctx.fillStyle = accentColor;
            ctx.textAlign = 'left';
            ctx.fillText(heading, pad + iconSize + 10, h / 2 - headSize);

            const bodySize = Math.max(10, Math.round(h * 0.12));
            ctx.font = `${bodySize}px Inter, sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.fillText(body.slice(0, 55) + (body.length > 55 ? '…' : ''), pad + iconSize + 10, h / 2 + 2);
          }
        }}
      />
    );
  }

  if (el.type === 'coupon') {
    const cpw = el.width || 340, cph = el.height || 140;
    const leftColor = el.fill || TEAL;
    const rightColor = el.couponRightColor || 'rgba(255,255,255,0.1)';
    const code = el.couponCode || 'SAVE20';
    const headline = el.couponHeadline || '20% OFF';
    const subline = el.couponSubline || 'Your next purchase';
    const expiry = el.couponExpiry || 'Expires soon';
    const notchR = Math.min(14, cph * 0.12);
    const divX = cpw * 0.38;
    const r = el.cornerRadius ?? 12;

    return (
      <Shape {...common}
        width={cpw} height={cph}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();

          // Draw full coupon background as a custom path with notches
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.lineTo(w - r, 0); ctx.arcTo(w, 0, w, r, r);
          ctx.lineTo(w, h / 2 - notchR);
          ctx.arc(w, h / 2, notchR, -Math.PI / 2, Math.PI / 2, false); // right notch (inner)
          ctx.lineTo(w, h - r); ctx.arcTo(w, h, w - r, h, r);
          ctx.lineTo(r, h); ctx.arcTo(0, h, 0, h - r, r);
          ctx.lineTo(0, h / 2 + notchR);
          ctx.arc(0, h / 2, notchR, Math.PI / 2, -Math.PI / 2, false); // left notch (inner)
          ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r);
          ctx.closePath();
          ctx.fillStyle = rightColor;
          ctx.fill();

          // Left section (colored)
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.lineTo(divX, 0);
          ctx.lineTo(divX, h / 2 - notchR);
          ctx.arc(divX, h / 2, notchR, -Math.PI / 2, Math.PI / 2, true); // divider notch
          ctx.lineTo(divX, h);
          ctx.lineTo(r, h); ctx.arcTo(0, h, 0, h - r, r);
          ctx.lineTo(0, h / 2 + notchR);
          ctx.arc(0, h / 2, notchR, Math.PI / 2, -Math.PI / 2, false);
          ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r);
          ctx.closePath();
          ctx.fillStyle = leftColor;
          ctx.fill();
          ctx.restore();

          // Dashed divider line
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.moveTo(divX, notchR * 2);
          ctx.lineTo(divX, h - notchR * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);

          // Left section text
          const pad = 12;
          const headSize = Math.max(18, Math.round(cph * 0.25));
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `bold ${headSize}px Inter, sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(headline, divX / 2, h * 0.38);
          ctx.font = `${Math.max(10, Math.round(headSize * 0.45))}px Inter, sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillText(subline, divX / 2, h * 0.62);

          // Right section text
          const rightX = divX + (w - divX) / 2;
          ctx.font = `bold ${Math.max(16, Math.round(cph * 0.18))}px 'Courier New', monospace`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(code, rightX, h * 0.38);
          ctx.font = `${Math.max(9, Math.round(cph * 0.1))}px Inter, sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.fillText('USE CODE', rightX, h * 0.22);
          ctx.fillText(expiry, rightX, h * 0.76);
        }}
      />
    );
  }

  if (el.type === 'gradtext') {
    const gtw = el.width || 400, gth = el.height || 80;
    const rawText = applyTextTransform(el.text || 'Gradient Text', el.textTransform) || '';
    const fontSize = el.fontSize || 52;
    const fontStyle = el.fontStyle || 'bold';
    const fontFamily = el.fontFamily || 'Inter, sans-serif';
    const fontStr = `${fontStyle !== 'normal' ? fontStyle + ' ' : ''}${fontSize}px ${fontFamily}`;
    const color1 = el.gradColor1 || TEAL;
    const color2 = el.gradColor2 || '#7C5CFC';
    const direction = el.gradDirection || 'horizontal'; // 'horizontal' | 'vertical' | 'diagonal'

    return (
      <Shape {...common}
        width={gtw} height={gth}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          ctx.font = fontStr;
          ctx.textAlign = el.textAlign || 'center';
          ctx.textBaseline = 'middle';
          let grad;
          if (direction === 'vertical') {
            grad = ctx.createLinearGradient(0, 0, 0, h);
          } else if (direction === 'diagonal') {
            grad = ctx.createLinearGradient(0, 0, w, h);
          } else {
            grad = ctx.createLinearGradient(0, 0, w, 0);
          }
          grad.addColorStop(0, color1);
          grad.addColorStop(1, color2);
          ctx.fillStyle = grad;
          const tx = el.textAlign === 'left' ? 0 : el.textAlign === 'right' ? w : w / 2;
          // word-wrap
          const words = rawText.split(' ');
          const lineH = fontSize * 1.25;
          const lines = [];
          let cur = '';
          for (const word of words) {
            const test = cur ? cur + ' ' + word : word;
            if (ctx.measureText(test).width > w - 4 && cur) { lines.push(cur); cur = word; }
            else cur = test;
          }
          if (cur) lines.push(cur);
          const totalH = lines.length * lineH;
          const startY = (h - totalH) / 2 + lineH / 2;
          lines.forEach((line, i) => ctx.fillText(line, tx, startY + i * lineH));
          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'neontext') {
    const ntw = el.width || 400, nth = el.height || 90;
    const rawText = applyTextTransform(el.text || 'NEON', el.textTransform) || '';
    const fontSize = el.fontSize || 60;
    const fontStyle = el.fontStyle || 'bold';
    const fontFamily = el.fontFamily || 'Inter, sans-serif';
    const fontStr = `${fontStyle !== 'normal' ? fontStyle + ' ' : ''}${fontSize}px ${fontFamily}`;
    const glowColor = el.glowColor || TEAL;
    const glowIntensity = el.glowIntensity ?? 18; // blur radius in px

    return (
      <Shape {...common}
        width={ntw} height={nth}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          ctx.font = fontStr;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Draw glow layers (outer → inner)
          const glowLayers = [
            { blur: glowIntensity * 2.5, alpha: 0.25 },
            { blur: glowIntensity * 1.5, alpha: 0.45 },
            { blur: glowIntensity,       alpha: 0.65 },
            { blur: glowIntensity * 0.5, alpha: 0.85 },
          ];
          glowLayers.forEach(({ blur, alpha }) => {
            ctx.save();
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = blur;
            ctx.fillStyle = `rgba(${parseInt(glowColor.slice(1,3),16)},${parseInt(glowColor.slice(3,5),16)},${parseInt(glowColor.slice(5,7),16)},${alpha})`;
            ctx.fillText(rawText, w / 2, h / 2);
            ctx.restore();
          });
          // Bright core
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = glowIntensity * 0.3;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(rawText, w / 2, h / 2);
          ctx.shadowBlur = 0;
          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'sticker') {
    const sw = el.width || 100, sh = el.height || 100;
    const emoji = el.emoji || '🔥';
    const bgShape = el.stickerBg || 'none'; // 'none' | 'circle' | 'pill' | 'square'
    const bgColor = el.fill || 'rgba(255,255,255,0.15)';

    return (
      <Shape {...common}
        width={sw} height={sh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          const cx = w / 2, cy = h / 2;
          const minD = Math.min(w, h);

          if (bgShape === 'circle') {
            ctx.beginPath();
            ctx.arc(cx, cy, minD / 2 - 2, 0, Math.PI * 2);
            ctx.fillStyle = bgColor;
            ctx.fill();
          } else if (bgShape === 'square') {
            const pad = minD * 0.06;
            ctx.beginPath();
            ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, minD * 0.15);
            ctx.fillStyle = bgColor;
            ctx.fill();
          } else if (bgShape === 'pill') {
            const pH = h * 0.6, pW = w * 0.85;
            const px = (w - pW) / 2, py = (h - pH) / 2;
            ctx.beginPath();
            ctx.roundRect(px, py, pW, pH, pH / 2);
            ctx.fillStyle = bgColor;
            ctx.fill();
          }

          const emojiSize = Math.round(minD * 0.72);
          ctx.font = `${emojiSize}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(emoji, cx, cy);

          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'highlight') {
    const hlw = el.width || 380, hlh = el.height || 70;
    const rawText = applyTextTransform(el.text || 'Highlighted Text', el.textTransform) || '';
    const fontSize = el.fontSize || 42;
    const fontStyle = el.fontStyle || 'bold';
    const fontFamily = el.fontFamily || 'Inter, sans-serif';
    const fontStr = `${fontStyle !== 'normal' ? fontStyle + ' ' : ''}${fontSize}px ${fontFamily}`;
    const bgColor = el.fill || '#FFE135';
    const textColor = el.stroke || '#1a1a22';
    const hlStyle = el.highlightStyle || 'full'; // 'full' | 'brush' | 'underline'

    return (
      <Shape {...common}
        width={hlw} height={hlh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          ctx.font = fontStr;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const textW = Math.min(ctx.measureText(rawText).width + 24, w);
          const bgX = (w - textW) / 2, bgY = h * 0.08;
          const bgH = h * 0.84;

          if (hlStyle === 'full') {
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            ctx.roundRect(bgX, bgY, textW, bgH, 4);
            ctx.fill();
          } else if (hlStyle === 'brush') {
            // Slightly irregular brush-stroke rectangle
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            ctx.moveTo(bgX + 6, bgY + 3);
            ctx.bezierCurveTo(bgX + textW * 0.3, bgY - 4, bgX + textW * 0.7, bgY + 2, bgX + textW - 4, bgY + 5);
            ctx.bezierCurveTo(bgX + textW + 3, bgY + bgH * 0.4, bgX + textW + 2, bgY + bgH * 0.7, bgX + textW - 6, bgY + bgH - 3);
            ctx.bezierCurveTo(bgX + textW * 0.6, bgY + bgH + 4, bgX + textW * 0.3, bgY + bgH - 2, bgX + 4, bgY + bgH - 5);
            ctx.bezierCurveTo(bgX - 3, bgY + bgH * 0.6, bgX - 2, bgY + bgH * 0.3, bgX + 6, bgY + 3);
            ctx.fill();
          } else if (hlStyle === 'underline') {
            const ulY = bgY + bgH - 4, ulH2 = h * 0.22;
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            ctx.roundRect(bgX, ulY, textW, ulH2, 3);
            ctx.fill();
          }

          ctx.fillStyle = textColor;
          ctx.fillText(rawText, w / 2, h / 2);

          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'polaroid') {
    const pw = el.width || 200, ph = el.height || 230;
    const borderColor = el.fill || '#ffffff';
    const captionText = el.captionText || 'Caption here';
    const borderW = Math.max(8, pw * 0.06);
    const captionH = Math.max(32, ph * 0.18);
    const photoH = ph - captionH - borderW * 2;
    const photoW = pw - borderW * 2;
    const shadowBlur = el.shadowBlur ?? 18;
    const rotation = el.frameRotation ?? 0; // slight tilt for polaroid effect

    return (
      <Shape {...common}
        width={pw} height={ph}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();

          // Drop shadow
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.35)';
          ctx.shadowBlur = shadowBlur;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 4;

          // Main white frame
          ctx.fillStyle = borderColor;
          ctx.beginPath();
          ctx.roundRect(0, 0, w, h, 4);
          ctx.fill();
          ctx.restore();

          // Photo area (placeholder colored box)
          const photoColor = el.photoColor || 'rgba(100,120,160,0.35)';
          ctx.fillStyle = photoColor;
          ctx.beginPath();
          ctx.rect(borderW, borderW, photoW, photoH);
          ctx.fill();

          // Photo placeholder text
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.font = `${Math.max(10, Math.round(pw * 0.07))}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Photo', borderW + photoW / 2, borderW + photoH / 2);

          // Caption area
          const captionY = borderW + photoH;
          ctx.fillStyle = el.captionColor || '#333333';
          ctx.font = `${Math.max(9, Math.round(pw * 0.065))}px 'Caveat', cursive, Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(captionText, w / 2, captionY + captionH / 2);

          // Selection
          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'mappin') {
    const mpw = el.width || 160, mph = el.height || 180;
    const pinColor = el.fill || '#ef4444';
    const textColor = el.stroke || '#ffffff';
    const labelText = el.labelText || '📍 Location';
    const subText = el.subText || 'Your City';
    const pinStyle = el.pinStyle || 'pin'; // 'pin' | 'badge' | 'chip'

    return (
      <Shape {...common}
        width={mpw} height={mph}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          const cx = w / 2;

          if (pinStyle === 'pin') {
            // Teardrop / map pin shape
            const pinH = h * 0.78;
            const r = Math.min(w, pinH) / 2;
            const tipY = pinH;
            const ballCY = r;
            // Circle body
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 4;
            ctx.beginPath();
            ctx.arc(cx, ballCY, r - 2, 0, Math.PI * 2);
            ctx.fillStyle = pinColor;
            ctx.fill();
            // Triangle tip
            ctx.beginPath();
            ctx.moveTo(cx - r * 0.45, ballCY + r * 0.7);
            ctx.lineTo(cx + r * 0.45, ballCY + r * 0.7);
            ctx.lineTo(cx, tipY);
            ctx.closePath();
            ctx.fillStyle = pinColor;
            ctx.fill();
            ctx.restore();
            // Inner circle highlight
            ctx.beginPath();
            ctx.arc(cx, ballCY, r * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fill();
            // Label text below pin
            ctx.fillStyle = textColor;
            ctx.font = `bold ${Math.max(10, Math.round(w * 0.11))}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(subText, cx, tipY + 6);
          } else if (pinStyle === 'badge') {
            // Rounded rectangle badge with location icon
            const bH = h * 0.55, bY = (h - bH) / 2;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.25)';
            ctx.shadowBlur = 8;
            ctx.fillStyle = pinColor;
            ctx.beginPath();
            ctx.roundRect(0, bY, w, bH, bH / 2);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = textColor;
            ctx.font = `bold ${Math.max(10, Math.round(w * 0.12))}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, cx, bY + bH * 0.38);
            ctx.font = `${Math.max(8, Math.round(w * 0.09))}px Inter, sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.fillText(subText, cx, bY + bH * 0.68);
          } else {
            // Chip style: small pill
            const chipH = h * 0.42, chipY = (h - chipH) / 2;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 6;
            ctx.fillStyle = pinColor;
            ctx.beginPath();
            ctx.roundRect(0, chipY, w, chipH, chipH / 2);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = textColor;
            ctx.font = `bold ${Math.max(9, Math.round(w * 0.1))}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`📍 ${subText}`, cx, chipY + chipH / 2);
          }

          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'speechbubble') {
    const sbw = el.width || 260, sbh = el.height || 120;
    const bgColor = el.fill || '#ffffff';
    const textColor = el.stroke || '#1a1a22';
    const bubbleText = el.bubbleText || '"Great service!"';
    const tail = el.bubbleTail || 'bottom-left'; // 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'none'
    const tailSize = Math.min(22, sbh * 0.2);
    const bubbleR = el.cornerRadius ?? 16;

    return (
      <Shape {...common}
        width={sbw} height={sbh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          const boxH = tail !== 'none' ? h - tailSize : h;
          const boxY = tail.startsWith('top') ? tailSize : 0;

          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.18)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = bgColor;
          ctx.beginPath();
          ctx.roundRect(0, boxY, w, boxH, bubbleR);
          ctx.fill();
          ctx.restore();

          // Tail
          if (tail !== 'none') {
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            if (tail === 'bottom-left') {
              ctx.moveTo(bubbleR * 1.5, boxY + boxH);
              ctx.lineTo(bubbleR * 1.5 + tailSize * 0.8, boxY + boxH);
              ctx.lineTo(bubbleR, h);
            } else if (tail === 'bottom-right') {
              ctx.moveTo(w - bubbleR * 1.5 - tailSize * 0.8, boxY + boxH);
              ctx.lineTo(w - bubbleR * 1.5, boxY + boxH);
              ctx.lineTo(w - bubbleR, h);
            } else if (tail === 'top-left') {
              ctx.moveTo(bubbleR, 0);
              ctx.lineTo(bubbleR * 1.5, boxY);
              ctx.lineTo(bubbleR * 1.5 + tailSize * 0.8, boxY);
            } else if (tail === 'top-right') {
              ctx.moveTo(w - bubbleR, 0);
              ctx.lineTo(w - bubbleR * 1.5 - tailSize * 0.8, boxY);
              ctx.lineTo(w - bubbleR * 1.5, boxY);
            }
            ctx.closePath();
            ctx.fill();
          }

          // Word-wrapped text
          const pad = bubbleR * 0.8;
          const maxTW = w - pad * 2;
          const fSize = el.fontSize || Math.max(13, Math.round(sbw * 0.075));
          ctx.font = `${el.fontStyle && el.fontStyle !== 'normal' ? el.fontStyle + ' ' : ''}${fSize}px ${el.fontFamily || 'Inter, sans-serif'}`;
          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const words = bubbleText.split(' ');
          const lh = fSize * 1.4;
          const lines2 = [];
          let cur2 = '';
          for (const word of words) {
            const test2 = cur2 ? cur2 + ' ' + word : word;
            if (ctx.measureText(test2).width > maxTW && cur2) { lines2.push(cur2); cur2 = word; }
            else cur2 = test2;
          }
          if (cur2) lines2.push(cur2);
          const totalTH = lines2.length * lh;
          const startTY = boxY + (boxH - totalTH) / 2;
          lines2.forEach((line, i) => ctx.fillText(line, pad, startTY + i * lh));

          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'ribbon') {
    const rbw = el.width || 280, rbh = el.height || 64;
    const ribbonColor = el.fill || '#ef4444';
    const textColor = el.stroke || '#ffffff';
    const ribbonText = el.ribbonText || 'SPECIAL OFFER';
    const subText2 = el.ribbonSub || '';
    const ribbonStyle = el.ribbonStyle || 'fold'; // 'fold' | 'wave' | 'flat'
    const notchD = Math.min(20, rbh * 0.38); // depth of fold/notch

    return (
      <Shape {...common}
        width={rbw} height={rbh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();

          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.25)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = ribbonColor;

          if (ribbonStyle === 'fold') {
            // Classic ribbon with V-notches on both ends
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(w, 0);
            ctx.lineTo(w - notchD, h / 2);
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.lineTo(notchD, h / 2);
            ctx.closePath();
            ctx.fill();
          } else if (ribbonStyle === 'wave') {
            // Ribbon with curved wave ends
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(w, 0);
            ctx.bezierCurveTo(w - notchD * 1.2, h * 0.25, w - notchD * 1.2, h * 0.75, w, h);
            ctx.lineTo(0, h);
            ctx.bezierCurveTo(notchD * 1.2, h * 0.75, notchD * 1.2, h * 0.25, 0, 0);
            ctx.fill();
          } else {
            // Flat ribbon with pointed left end
            ctx.beginPath();
            ctx.moveTo(notchD, 0);
            ctx.lineTo(w, 0);
            ctx.lineTo(w, h);
            ctx.lineTo(notchD, h);
            ctx.lineTo(0, h / 2);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();

          // Shadow fold triangles for 'fold' style
          if (ribbonStyle === 'fold') {
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(notchD * 0.6, 0); ctx.lineTo(notchD, h / 2); ctx.lineTo(notchD * 0.6, h); ctx.lineTo(0, h); ctx.lineTo(notchD * 0.4, h / 2); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(w, 0); ctx.lineTo(w - notchD * 0.6, 0); ctx.lineTo(w - notchD, h / 2); ctx.lineTo(w - notchD * 0.6, h); ctx.lineTo(w, h); ctx.lineTo(w - notchD * 0.4, h / 2); ctx.closePath(); ctx.fill();
          }

          // Text
          const cx2 = w / 2;
          const mainSize = Math.max(12, Math.round(rbh * (subText2 ? 0.34 : 0.42)));
          ctx.textAlign = 'center';
          ctx.fillStyle = textColor;
          if (subText2) {
            ctx.font = `bold ${mainSize}px Inter, sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.fillText(ribbonText, cx2, rbh * 0.36);
            ctx.font = `${Math.max(9, Math.round(mainSize * 0.7))}px Inter, sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(subText2, cx2, rbh * 0.7);
          } else {
            ctx.font = `bold ${mainSize}px Inter, sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.fillText(ribbonText, cx2, rbh / 2);
          }

          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'steplist') {
    const slw = el.width || 280, slh = el.height || 180;
    const steps = el.steps || ['Step one', 'Step two', 'Step three'];
    const accentColor = el.fill || TEAL;
    const textColor = el.stroke || '#ffffff';
    const stepStyle = el.stepStyle || 'numbered'; // 'numbered' | 'check' | 'dot'
    const numSteps = steps.length;
    const rowH = slh / numSteps;
    const ballR = Math.min(16, rowH * 0.38);
    const fontSize2 = Math.max(10, Math.round(rowH * 0.28));

    return (
      <Shape {...common}
        width={slw} height={slh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          const rH = h / numSteps;

          steps.forEach((step, i) => {
            const cy2 = i * rH + rH / 2;
            const bx = ballR + 4;

            // Connecting line between bullets (except last)
            if (i < numSteps - 1) {
              ctx.beginPath();
              ctx.moveTo(bx, cy2 + ballR);
              ctx.lineTo(bx, cy2 + rH - ballR);
              ctx.strokeStyle = `${accentColor}55`;
              ctx.lineWidth = 2;
              ctx.stroke();
            }

            // Bullet circle
            ctx.beginPath();
            ctx.arc(bx, cy2, ballR, 0, Math.PI * 2);
            ctx.fillStyle = accentColor;
            ctx.fill();

            // Bullet label
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(8, Math.round(ballR * 0.95))}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (stepStyle === 'numbered') {
              ctx.fillText(String(i + 1), bx, cy2);
            } else if (stepStyle === 'check') {
              ctx.fillText('✓', bx, cy2);
            } else {
              ctx.beginPath();
              ctx.arc(bx, cy2, ballR * 0.45, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
            }

            // Step text
            ctx.font = `${fontSize2}px Inter, sans-serif`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(step, bx + ballR + 10, cy2);
          });

          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'pattern') {
    const ptw = el.width || 300, pth = el.height || 200;
    const fgColor = el.fill || 'rgba(255,255,255,0.15)';
    const bgColor2 = el.patternBg || 'transparent';
    const patternType = el.patternType || 'dots'; // 'dots' | 'grid' | 'diagonal' | 'chevron' | 'hex' | 'cross'
    const tileSize = el.tileSize || 20;
    const lineW = el.patternLineW || 1.5;

    return (
      <Shape {...common}
        width={ptw} height={pth}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();

          // Background fill
          if (bgColor2 && bgColor2 !== 'transparent') {
            ctx.fillStyle = bgColor2;
            ctx.fillRect(0, 0, w, h);
          }

          ctx.strokeStyle = fgColor;
          ctx.fillStyle = fgColor;
          ctx.lineWidth = lineW;

          if (patternType === 'dots') {
            const r = tileSize * 0.18;
            for (let x2 = tileSize / 2; x2 < w; x2 += tileSize) {
              for (let y2 = tileSize / 2; y2 < h; y2 += tileSize) {
                ctx.beginPath();
                ctx.arc(x2, y2, r, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          } else if (patternType === 'grid') {
            ctx.beginPath();
            for (let x2 = 0; x2 <= w; x2 += tileSize) {
              ctx.moveTo(x2, 0); ctx.lineTo(x2, h);
            }
            for (let y2 = 0; y2 <= h; y2 += tileSize) {
              ctx.moveTo(0, y2); ctx.lineTo(w, y2);
            }
            ctx.stroke();
          } else if (patternType === 'diagonal') {
            ctx.beginPath();
            for (let i = -h; i < w + h; i += tileSize) {
              ctx.moveTo(i, 0); ctx.lineTo(i + h, h);
            }
            ctx.stroke();
          } else if (patternType === 'chevron') {
            const ch = tileSize * 0.6;
            for (let y2 = -tileSize; y2 < h + tileSize; y2 += tileSize) {
              ctx.beginPath();
              for (let x2 = 0; x2 < w; x2 += tileSize * 2) {
                ctx.moveTo(x2, y2 + ch);
                ctx.lineTo(x2 + tileSize, y2);
                ctx.lineTo(x2 + tileSize * 2, y2 + ch);
              }
              ctx.stroke();
            }
          } else if (patternType === 'cross') {
            const arm = tileSize * 0.3;
            for (let x2 = tileSize / 2; x2 < w; x2 += tileSize) {
              for (let y2 = tileSize / 2; y2 < h; y2 += tileSize) {
                ctx.beginPath();
                ctx.moveTo(x2 - arm, y2); ctx.lineTo(x2 + arm, y2);
                ctx.moveTo(x2, y2 - arm); ctx.lineTo(x2, y2 + arm);
                ctx.stroke();
              }
            }
          } else if (patternType === 'hex') {
            const hx = tileSize, hy = tileSize * 0.87;
            for (let row = 0; row * hy < h + hy; row++) {
              const offX = row % 2 === 0 ? 0 : hx / 2;
              for (let col = 0; col * hx < w + hx; col++) {
                const cx3 = col * hx + offX, cy3 = row * hy;
                ctx.beginPath();
                for (let s = 0; s < 6; s++) {
                  const a = (Math.PI / 3) * s - Math.PI / 6;
                  const px = cx3 + (hx * 0.5 - lineW) * Math.cos(a);
                  const py = cy3 + (hx * 0.5 - lineW) * Math.sin(a);
                  s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
              }
            }
          }

          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'qrcode') {
    const qw = el.width || 160, qh = el.height || 160;
    const fgC = el.fill || '#1a1a22';
    const bgC = el.qrBg || '#ffffff';
    const label = el.qrLabel || 'Scan me';
    const showLabel = el.showQrLabel !== false;
    const qrSize = showLabel ? Math.min(qw, qh * 0.82) : Math.min(qw, qh);
    const pad = qrSize * 0.06;
    const cell = (qrSize - pad * 2) / 21; // 21×21 QR grid
    // Seeded pseudo-random data pattern based on element id
    const seed = el.id ? el.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 42;
    const prng = (x2, y2) => ((seed * 31 + x2 * 17 + y2 * 13) % 7) > 2;

    // Finder pattern: 7×7 at corners
    function drawFinder(ctx2, ox, oy, cs) {
      ctx2.fillStyle = fgC;
      ctx2.fillRect(ox, oy, cs * 7, cs * 7);
      ctx2.fillStyle = bgC;
      ctx2.fillRect(ox + cs, oy + cs, cs * 5, cs * 5);
      ctx2.fillStyle = fgC;
      ctx2.fillRect(ox + cs * 2, oy + cs * 2, cs * 3, cs * 3);
    }

    return (
      <Shape {...common}
        width={qw} height={qh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          const qox = (w - qrSize) / 2;
          const qoy = showLabel ? 0 : (h - qrSize) / 2;

          // Background
          ctx.fillStyle = bgC;
          ctx.beginPath();
          ctx.roundRect(qox, qoy, qrSize, qrSize, 6);
          ctx.fill();

          // Data dots
          ctx.fillStyle = fgC;
          for (let row = 0; row < 21; row++) {
            for (let col = 0; col < 21; col++) {
              const isFinder = (row < 8 && col < 8) || (row < 8 && col > 12) || (row > 12 && col < 8);
              const isTimingH = row === 6 && col >= 8 && col <= 12;
              const isTimingV = col === 6 && row >= 8 && row <= 12;
              if (isFinder || isTimingH || isTimingV) continue;
              if (prng(col, row)) {
                const cx3 = qox + pad + col * cell + cell / 2;
                const cy3 = qoy + pad + row * cell + cell / 2;
                ctx.beginPath();
                ctx.arc(cx3, cy3, cell * 0.42, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }

          // Timing patterns
          ctx.fillStyle = fgC;
          for (let i = 8; i <= 12; i += 2) {
            ctx.fillRect(qox + pad + i * cell, qoy + pad + 6 * cell, cell, cell);
            ctx.fillRect(qox + pad + 6 * cell, qoy + pad + i * cell, cell, cell);
          }

          // Finder patterns (drawn on top)
          drawFinder(ctx, qox + pad, qoy + pad, cell);                           // top-left
          drawFinder(ctx, qox + pad + 14 * cell, qoy + pad, cell);               // top-right
          drawFinder(ctx, qox + pad, qoy + pad + 14 * cell, cell);               // bottom-left

          // Label
          if (showLabel) {
            ctx.fillStyle = fgC;
            ctx.font = `bold ${Math.max(9, Math.round(qw * 0.1))}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(label, w / 2, h - 2);
          }

          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'glasspane') {
    const gpw = el.width || 300, gph = el.height || 160;
    const tintColor = el.fill || 'rgba(255,255,255,0.18)';
    const borderColor = el.glassBorder || 'rgba(255,255,255,0.35)';
    const cornerR = el.cornerRadius ?? 16;
    const noiseAmount = el.noiseAmount ?? 0.06; // subtle grain
    const glassText = el.glassText || '';
    const textColor3 = el.stroke || '#ffffff';

    return (
      <Shape {...common}
        width={gpw} height={gph}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();

          // Main frosted fill
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.2)';
          ctx.shadowBlur = 20;
          ctx.shadowOffsetY = 4;
          ctx.fillStyle = tintColor;
          ctx.beginPath();
          ctx.roundRect(0, 0, w, h, cornerR);
          ctx.fill();
          ctx.restore();

          // Noise grain overlay (very fine dots for frosted feel)
          if (noiseAmount > 0) {
            const seed2 = 77;
            for (let i = 0; i < w * h * noiseAmount; i++) {
              const nx = ((seed2 * i * 31 + i * 13) % w);
              const ny = ((seed2 * i * 17 + i * 7) % h);
              ctx.fillStyle = `rgba(255,255,255,${(((seed2 * i * 41) % 10) / 10) * 0.15})`;
              ctx.fillRect(nx, ny, 1.5, 1.5);
            }
          }

          // Border highlight (top-left edge brighter)
          ctx.save();
          const grad2 = ctx.createLinearGradient(0, 0, w, h);
          grad2.addColorStop(0, borderColor);
          grad2.addColorStop(1, 'rgba(255,255,255,0.05)');
          ctx.strokeStyle = grad2;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(0.6, 0.6, w - 1.2, h - 1.2, cornerR);
          ctx.stroke();
          ctx.restore();

          // Optional text
          if (glassText) {
            ctx.fillStyle = textColor3;
            ctx.font = `bold ${Math.max(12, Math.round(gph * 0.15))}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(glassText, w / 2, h / 2);
          }

          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'testimonial') {
    const tmw = el.width || 320, tmh = el.height || 180;
    const cardBg = el.fill || 'rgba(255,255,255,0.1)';
    const accentC = el.accentColor || TEAL;
    const tcText = el.stroke || '#ffffff';
    const reviewerName = el.reviewerName || 'John Smith';
    const reviewerRole = el.reviewerRole || 'Homeowner';
    const reviewText = el.reviewText || '"Absolutely fantastic work! Would recommend to anyone."';
    const starRating = el.starRating ?? 5;
    const cornerR2 = el.cornerRadius ?? 14;
    const avatarR = Math.min(24, tmh * 0.14);

    return (
      <Shape {...common}
        width={tmw} height={tmh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();

          // Card background
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.2)';
          ctx.shadowBlur = 12;
          ctx.fillStyle = cardBg;
          ctx.beginPath();
          ctx.roundRect(0, 0, w, h, cornerR2);
          ctx.fill();
          ctx.restore();

          // Left accent bar
          ctx.fillStyle = accentC;
          ctx.beginPath();
          ctx.roundRect(0, 0, 4, h, [cornerR2, 0, 0, cornerR2]);
          ctx.fill();

          const pad2 = 16;
          const contentX = 4 + pad2;

          // Avatar circle
          const avCY = avatarR + pad2;
          ctx.beginPath();
          ctx.arc(contentX + avatarR, avCY, avatarR, 0, Math.PI * 2);
          ctx.fillStyle = accentC;
          ctx.fill();
          // Avatar initial
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(avatarR * 0.95)}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(reviewerName.charAt(0).toUpperCase(), contentX + avatarR, avCY);

          // Name & role
          const nameX = contentX + avatarR * 2 + 10;
          ctx.textAlign = 'left';
          ctx.fillStyle = tcText;
          ctx.font = `bold ${Math.max(11, Math.round(tmw * 0.052))}px Inter, sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillText(reviewerName, nameX, pad2 - 2);
          ctx.font = `${Math.max(9, Math.round(tmw * 0.038))}px Inter, sans-serif`;
          ctx.fillStyle = `${tcText}aa`;
          ctx.fillText(reviewerRole, nameX, pad2 + Math.round(tmw * 0.056));

          // Stars
          const starY = avCY + avatarR + 10;
          const starSz = Math.max(10, Math.round(tmh * 0.08));
          ctx.font = `${starSz}px serif`;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          ctx.fillText('★'.repeat(starRating) + '☆'.repeat(Math.max(0, 5 - starRating)), contentX, starY);

          // Review quote (word-wrapped)
          const quoteY = starY + starSz + 8;
          const maxQW = w - contentX - pad2;
          const qfSize = Math.max(10, Math.round(tmh * 0.085));
          ctx.font = `italic ${qfSize}px Inter, sans-serif`;
          ctx.fillStyle = tcText;
          ctx.textBaseline = 'top';
          const qWords = reviewText.split(' ');
          const qLh = qfSize * 1.4;
          const qLines = [];
          let qCur = '';
          for (const word of qWords) {
            const test3 = qCur ? qCur + ' ' + word : word;
            if (ctx.measureText(test3).width > maxQW && qCur) { qLines.push(qCur); qCur = word; }
            else qCur = test3;
          }
          if (qCur) qLines.push(qCur);
          qLines.slice(0, 3).forEach((line, i) => ctx.fillText(line, contentX, quoteY + i * qLh));

          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'beforeafter') {
    const baw = el.width || 340, bah = el.height || 200;
    const leftColor = el.fill || '#6b7280';
    const rightColor = el.baRightColor || '#22c55e';
    const leftLabel = el.baLeftLabel || 'BEFORE';
    const rightLabel = el.baRightLabel || 'AFTER';
    const dividerColor = el.baDividerColor || '#ffffff';
    const cornerR3 = el.cornerRadius ?? 10;
    const labelStyle = el.baLabelStyle || 'pill'; // 'pill' | 'corner' | 'center'

    return (
      <Shape {...common}
        width={baw} height={bah}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          const half = w / 2;

          // Left panel
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(0, 0, half, h, [cornerR3, 0, 0, cornerR3]);
          ctx.fillStyle = leftColor;
          ctx.fill();
          ctx.restore();

          // Right panel
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(half, 0, half, h, [0, cornerR3, cornerR3, 0]);
          ctx.fillStyle = rightColor;
          ctx.fill();
          ctx.restore();

          // Divider line with arrow icon
          ctx.fillStyle = dividerColor;
          ctx.fillRect(half - 1.5, 0, 3, h);
          // Center circle
          const circleR2 = Math.min(18, h * 0.12);
          ctx.beginPath();
          ctx.arc(half, h / 2, circleR2, 0, Math.PI * 2);
          ctx.fillStyle = dividerColor;
          ctx.fill();
          ctx.fillStyle = '#333333';
          ctx.font = `bold ${Math.round(circleR2 * 0.9)}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⟺', half, h / 2);

          // Labels
          const fS4 = Math.max(10, Math.round(baw * 0.052));
          ctx.font = `bold ${fS4}px Inter, sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textBaseline = 'middle';

          if (labelStyle === 'pill') {
            [[leftLabel, half * 0.5], [rightLabel, half + half * 0.5]].forEach(([lbl, lx]) => {
              const tw4 = ctx.measureText(lbl).width + 16;
              ctx.save();
              ctx.fillStyle = 'rgba(0,0,0,0.45)';
              ctx.beginPath();
              ctx.roundRect(lx - tw4 / 2, h - fS4 * 1.8 - 8, tw4, fS4 * 1.6, fS4 * 0.8);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.fillText(lbl, lx, h - fS4 - 8);
              ctx.restore();
            });
          } else if (labelStyle === 'corner') {
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, half * 0.55, fS4 * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(leftLabel, 8, fS4);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(half, 0, half * 0.55, fS4 * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(rightLabel, half + 8, fS4);
          } else {
            ctx.textAlign = 'center';
            ctx.fillText(leftLabel, half * 0.5, h / 2 - circleR2 * 2);
            ctx.fillText(rightLabel, half + half * 0.5, h / 2 - circleR2 * 2);
          }

          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'comparison') {
    const cpw = el.width || 400, cph = el.height || 340;
    const col1Color = el.col1Color || '#ef4444';
    const col2Color = el.col2Color || TEAL;
    const bgC5 = el.bgColor || '#1a1a2e';
    const textC5 = el.fill || '#ffffff';
    const col1Label = el.col1Label || 'Others';
    const col2Label = el.col2Label || 'Us';
    const rows = el.cpRows || [
      { col1: '✗ Generic advice', col2: '✓ Industry expertise' },
      { col1: '✗ Slow response',  col2: '✓ Same-day service'   },
      { col1: '✗ Hidden costs',   col2: '✓ Upfront pricing'    },
    ];
    return (
      <Shape {...common} width={cpw} height={cph} opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          // Card bg
          ctx.fillStyle = bgC5;
          ctx.beginPath(); ctx.roundRect(0, 0, w, h, el.cornerRadius ?? 14); ctx.fill();
          const colW = w / 2;
          const headerH = h * 0.17;
          const rowH = (h - headerH - 12) / Math.max(1, rows.length);
          const fontSize5 = Math.max(10, Math.round(rowH * 0.38));
          const headFontSize = Math.max(12, Math.round(headerH * 0.42));
          // Column headers
          ctx.fillStyle = col1Color;
          ctx.beginPath(); ctx.roundRect(4, 4, colW - 8, headerH - 4, [8, 0, 0, 8]); ctx.fill();
          ctx.fillStyle = col2Color;
          ctx.beginPath(); ctx.roundRect(colW + 4, 4, colW - 8, headerH - 4, [0, 8, 8, 0]); ctx.fill();
          ctx.font = `bold ${headFontSize}px Inter, sans-serif`;
          ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(col1Label, colW / 2, headerH / 2 + 2);
          ctx.fillText(col2Label, colW + colW / 2, headerH / 2 + 2);
          // Rows
          rows.forEach((row, i) => {
            const ry = headerH + 6 + i * rowH;
            if (ry + rowH > h - 4) return;
            if (i % 2 === 1) {
              ctx.fillStyle = 'rgba(255,255,255,0.04)';
              ctx.fillRect(4, ry, w - 8, rowH);
            }
            // Divider
            ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(4, ry); ctx.lineTo(w - 4, ry); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.beginPath(); ctx.moveTo(colW, headerH); ctx.lineTo(colW, h - 4); ctx.stroke();
            // Cell text
            ctx.font = `${fontSize5}px Inter, sans-serif`;
            ctx.textBaseline = 'middle';
            const cy5 = ry + rowH / 2;
            ctx.fillStyle = `${col1Color}dd`;
            ctx.textAlign = 'center';
            ctx.fillText((row.col1 || '').slice(0, 30), colW / 2, cy5);
            ctx.fillStyle = `${col2Color}dd`;
            ctx.fillText((row.col2 || '').slice(0, 30), colW + colW / 2, cy5);
          });
          if (isSelected) { ctx.strokeStyle = '#7C5CFC'; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, w, h); }
        }}
      />
    );
  }

  if (el.type === 'watermark') {
    const wmw = el.width || 200, wmh = el.height || 60;
    const bgC4 = el.bgColor || 'rgba(0,0,0,0.55)';
    const textC4 = el.fill || '#ffffff';
    const accentC4 = el.accentColor || TEAL;
    const logoText = el.wmLogo || 'YourBrand';
    const tagline = el.wmTagline || '';
    const wmStyle = el.wmStyle || 'pill'; // 'pill' | 'plain' | 'bar' | 'badge'
    const logoSize = el.fontSize || 22;
    const taglineSize = Math.max(9, Math.round(logoSize * 0.55));
    return (
      <Shape {...common} width={wmw} height={wmh} opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          if (wmStyle === 'pill') {
            ctx.fillStyle = bgC4;
            ctx.beginPath(); ctx.roundRect(0, 0, w, h, h / 2); ctx.fill();
            ctx.strokeStyle = `${accentC4}55`; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(0.5, 0.5, w-1, h-1, h/2 - 0.5); ctx.stroke();
          } else if (wmStyle === 'badge') {
            ctx.fillStyle = bgC4;
            ctx.beginPath(); ctx.roundRect(0, 0, w, h, 8); ctx.fill();
            ctx.fillStyle = accentC4; ctx.fillRect(0, 0, 4, h);
          } else if (wmStyle === 'bar') {
            ctx.fillStyle = bgC4; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = accentC4; ctx.fillRect(0, h - 3, w, 3);
          }
          // Logo text
          const textY = tagline ? h * 0.42 : h / 2;
          ctx.font = `bold ${logoSize}px Inter, sans-serif`;
          ctx.fillStyle = textC4; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(logoText, w / 2, textY);
          // Tagline
          if (tagline) {
            ctx.font = `${taglineSize}px Inter, sans-serif`;
            ctx.fillStyle = `${textC4}bb`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(tagline, w / 2, h * 0.6);
          }
          if (isSelected) { ctx.strokeStyle = '#7C5CFC'; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, w, h); }
        }}
      />
    );
  }

  if (el.type === 'htimeline') {
    const tlw = el.width || 480, tlh = el.height || 180;
    const accentC3 = el.accentColor || TEAL;
    const textC3 = el.fill || '#ffffff';
    const bgC3 = el.bgColor || 'transparent';
    const steps = el.tlSteps || ['Step 1', 'Step 2', 'Step 3'];
    const dotStyle = el.tlDotStyle || 'filled'; // 'filled' | 'outline' | 'numbered'
    const lineStyle = el.tlLineStyle || 'solid'; // 'solid' | 'dashed' | 'dotted'
    const numSteps = Math.max(2, Math.min(6, steps.length));
    return (
      <Shape {...common} width={tlw} height={tlh} opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          if (bgC3 !== 'transparent' && bgC3 !== 'rgba(0,0,0,0)') {
            ctx.fillStyle = bgC3;
            ctx.beginPath(); ctx.roundRect(0, 0, w, h, el.cornerRadius ?? 10); ctx.fill();
          }
          const dotR = Math.min(w / (numSteps * 3), 22);
          const lineY = h * 0.38;
          const stepGap = (w - dotR * 2) / (numSteps - 1);
          const labelSize = Math.max(10, Math.round(dotR * 0.72));
          const stepLabelSize = Math.max(9, Math.round(dotR * 0.65));
          // Connecting line
          if (numSteps > 1) {
            ctx.save();
            if (lineStyle === 'dashed') ctx.setLineDash([dotR * 0.6, dotR * 0.4]);
            else if (lineStyle === 'dotted') ctx.setLineDash([dotR * 0.2, dotR * 0.5]);
            ctx.beginPath();
            ctx.moveTo(dotR, lineY); ctx.lineTo(w - dotR, lineY);
            ctx.strokeStyle = `${accentC3}66`; ctx.lineWidth = 2; ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }
          for (let i = 0; i < numSteps; i++) {
            const cx2 = dotR + i * stepGap;
            // Dot
            if (dotStyle === 'outline') {
              ctx.beginPath(); ctx.arc(cx2, lineY, dotR, 0, Math.PI * 2);
              ctx.strokeStyle = accentC3; ctx.lineWidth = 2.5; ctx.stroke();
            } else {
              ctx.beginPath(); ctx.arc(cx2, lineY, dotR, 0, Math.PI * 2);
              ctx.fillStyle = accentC3; ctx.fill();
            }
            // Number inside dot
            if (dotStyle === 'numbered' || dotStyle === 'filled') {
              ctx.font = `bold ${labelSize}px Inter, sans-serif`;
              ctx.fillStyle = dotStyle === 'outline' ? accentC3 : '#fff';
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(String(i + 1), cx2, lineY);
            }
            // Step label below
            const step = steps[i] || `Step ${i + 1}`;
            const isLong = step.length > 12;
            ctx.font = `${stepLabelSize}px Inter, sans-serif`;
            ctx.fillStyle = textC3; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            if (isLong) {
              const words = step.split(' ');
              const mid = Math.ceil(words.length / 2);
              ctx.fillText(words.slice(0, mid).join(' '), cx2, lineY + dotR + 8);
              ctx.fillText(words.slice(mid).join(' '), cx2, lineY + dotR + 8 + stepLabelSize + 3);
            } else {
              ctx.fillText(step, cx2, lineY + dotR + 8);
            }
          }
          if (isSelected) { ctx.strokeStyle = '#7C5CFC'; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, w, h); }
        }}
      />
    );
  }

  if (el.type === 'pricetag') {
    const ptw = el.width || 260, pth = el.height || 320;
    const bgC2 = el.bgColor || '#1a1a2e';
    const accentC2 = el.accentColor || TEAL;
    const textC2 = el.fill || '#ffffff';
    const currency = el.ptCurrency || '$';
    const price = el.ptPrice || '29';
    const period = el.ptPeriod || '/mo';
    const planLabel = el.ptLabel || 'Pro Plan';
    const features = el.ptFeatures || ['Unlimited posts', 'Priority support', 'Analytics'];
    const priceFontSize = el.fontSize || 52;
    return (
      <Shape {...common} width={ptw} height={pth} opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          // Card bg
          ctx.fillStyle = bgC2;
          ctx.beginPath(); ctx.roundRect(0, 0, w, h, el.cornerRadius ?? 14); ctx.fill();
          // Accent header band
          ctx.fillStyle = accentC2;
          ctx.fillRect(0, 0, w, 6);
          // Plan label
          ctx.font = `600 ${Math.round(priceFontSize * 0.26)}px Inter, sans-serif`;
          ctx.fillStyle = accentC2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(planLabel, w / 2, 18);
          // Price row
          const currSize = Math.round(priceFontSize * 0.55);
          const priceSize = priceFontSize;
          const perSize = Math.round(priceFontSize * 0.32);
          const priceY = h * 0.22;
          ctx.fillStyle = textC2; ctx.textBaseline = 'alphabetic';
          ctx.font = `600 ${currSize}px Inter, sans-serif`;
          ctx.textAlign = 'left';
          const totalPriceW = ctx.measureText(currency).width + ctx.measureText(price).width * (priceSize / currSize);
          let px = (w - totalPriceW * 1.1) / 2;
          ctx.fillText(currency, px, priceY + currSize * 0.1);
          px += ctx.measureText(currency).width + 2;
          ctx.font = `bold ${priceSize}px Inter, sans-serif`;
          ctx.fillText(price, px, priceY + currSize * 0.6);
          px += ctx.measureText(price).width + 2;
          ctx.font = `${perSize}px Inter, sans-serif`;
          ctx.fillStyle = `${textC2}99`;
          ctx.fillText(period, px, priceY + currSize * 0.35);
          // Divider
          ctx.fillStyle = `${accentC2}33`;
          ctx.fillRect(w * 0.1, h * 0.48, w * 0.8, 1);
          // Features
          const featureSize = Math.round(priceFontSize * 0.24);
          ctx.font = `${featureSize}px Inter, sans-serif`;
          ctx.fillStyle = textC2; ctx.textAlign = 'left';
          features.forEach((f, i) => {
            const fy = h * 0.53 + i * (featureSize + 14);
            if (fy + featureSize > h - 12) return;
            ctx.fillStyle = accentC2;
            ctx.font = `bold ${featureSize * 1.1}px Inter, sans-serif`;
            ctx.fillText('✓', w * 0.1, fy + featureSize);
            ctx.fillStyle = textC2;
            ctx.font = `${featureSize}px Inter, sans-serif`;
            ctx.fillText(f, w * 0.1 + featureSize * 1.4, fy + featureSize);
          });
          if (isSelected) { ctx.strokeStyle = '#7C5CFC'; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, w, h); }
        }}
      />
    );
  }

  if (el.type === 'iconshape') {
    const isw = el.width || 120, ish = el.height || 120;
    const iconColor = el.fill || '#ffffff';
    const iconBgColor = el.iconBgColor || 'rgba(0,196,204,0.2)';
    const iconBgShape = el.iconBgShape || 'circle';
    const kind = el.iconKind || 'check';
    return (
      <Shape {...common} width={isw} height={ish} opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          // Background shape
          if (iconBgShape !== 'none') {
            ctx.fillStyle = iconBgColor;
            if (iconBgShape === 'circle') { ctx.beginPath(); ctx.arc(w/2, h/2, Math.min(w,h)/2 - 1, 0, Math.PI*2); ctx.fill(); }
            else if (iconBgShape === 'rounded') { ctx.beginPath(); ctx.roundRect(0, 0, w, h, Math.min(w,h)*0.2); ctx.fill(); }
            else { ctx.fillRect(0, 0, w, h); }
          }
          // Icon paths
          const cx = w/2, cy = h/2;
          const s = Math.min(w, h) * 0.38;
          ctx.save();
          if (kind === 'check') {
            ctx.beginPath(); ctx.moveTo(cx-s,cy-s*0.05); ctx.lineTo(cx-s*0.2,cy+s*0.75); ctx.lineTo(cx+s,cy-s*0.75);
            ctx.strokeStyle=iconColor; ctx.lineWidth=s*0.22; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke();
          } else if (kind === 'x') {
            ctx.beginPath(); ctx.moveTo(cx-s*0.72,cy-s*0.72); ctx.lineTo(cx+s*0.72,cy+s*0.72); ctx.moveTo(cx+s*0.72,cy-s*0.72); ctx.lineTo(cx-s*0.72,cy+s*0.72);
            ctx.strokeStyle=iconColor; ctx.lineWidth=s*0.22; ctx.lineCap='round'; ctx.stroke();
          } else if (kind === 'plus') {
            ctx.beginPath(); ctx.moveTo(cx-s*0.85,cy); ctx.lineTo(cx+s*0.85,cy); ctx.moveTo(cx,cy-s*0.85); ctx.lineTo(cx,cy+s*0.85);
            ctx.strokeStyle=iconColor; ctx.lineWidth=s*0.22; ctx.lineCap='round'; ctx.stroke();
          } else if (kind === 'arrow') {
            ctx.beginPath(); ctx.moveTo(cx-s*0.7,cy); ctx.lineTo(cx+s*0.55,cy); ctx.moveTo(cx+s*0.15,cy-s*0.5); ctx.lineTo(cx+s*0.55,cy); ctx.lineTo(cx+s*0.15,cy+s*0.5);
            ctx.strokeStyle=iconColor; ctx.lineWidth=s*0.22; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke();
          } else if (kind === 'star') {
            const or=s*1.05, ir=or*0.42;
            ctx.beginPath();
            for(let i=0;i<5;i++){const oa=(i*4*Math.PI/5)-Math.PI/2;const ia=oa+(2*Math.PI/10);if(i===0)ctx.moveTo(cx+or*Math.cos(oa),cy+or*Math.sin(oa));else ctx.lineTo(cx+or*Math.cos(oa),cy+or*Math.sin(oa));ctx.lineTo(cx+ir*Math.cos(ia),cy+ir*Math.sin(ia));}
            ctx.closePath(); ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'heart') {
            const hs=s*1.1;
            ctx.beginPath(); ctx.moveTo(cx,cy+hs*0.6); ctx.bezierCurveTo(cx-hs*1.2,cy-hs*0.2,cx-hs*1.6,cy-hs*1.0,cx,cy-hs*0.2); ctx.bezierCurveTo(cx+hs*1.6,cy-hs*1.0,cx+hs*1.2,cy-hs*0.2,cx,cy+hs*0.6);
            ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'warning') {
            ctx.beginPath(); ctx.moveTo(cx,cy-s*1.0); ctx.lineTo(cx+s*1.0,cy+s*0.75); ctx.lineTo(cx-s*1.0,cy+s*0.75); ctx.closePath();
            ctx.fillStyle=iconColor; ctx.fill();
            ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.5)';
            ctx.fillRect(cx-s*0.1,cy-s*0.32,s*0.2,s*0.58); ctx.beginPath(); ctx.arc(cx,cy+s*0.5,s*0.1,0,Math.PI*2); ctx.fill();
          } else if (kind === 'shield') {
            const sw=s*1.0,sh=sw*1.3;
            ctx.beginPath(); ctx.moveTo(cx,cy-sh*0.85); ctx.lineTo(cx+sw*0.9,cy-sh*0.55); ctx.lineTo(cx+sw*0.9,cy+sh*0.05); ctx.quadraticCurveTo(cx+sw*0.9,cy+sh*0.7,cx,cy+sh*0.9); ctx.quadraticCurveTo(cx-sw*0.9,cy+sh*0.7,cx-sw*0.9,cy+sh*0.05); ctx.lineTo(cx-sw*0.9,cy-sh*0.55); ctx.closePath();
            ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'info') {
            const ir2=s*1.1;
            ctx.beginPath(); ctx.arc(cx,cy,ir2,0,Math.PI*2); ctx.fillStyle=iconColor; ctx.fill();
            ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.5)';
            ctx.beginPath(); ctx.arc(cx,cy-ir2*0.38,ir2*0.12,0,Math.PI*2); ctx.fill();
            ctx.fillRect(cx-ir2*0.11,cy-ir2*0.12,ir2*0.22,ir2*0.58);
          } else if (kind === 'bolt') {
            ctx.beginPath(); ctx.moveTo(cx+s*0.3,cy-s*1.05); ctx.lineTo(cx-s*0.12,cy-s*0.05); ctx.lineTo(cx+s*0.28,cy-s*0.05); ctx.lineTo(cx-s*0.3,cy+s*1.05); ctx.lineTo(cx+s*0.12,cy+s*0.05); ctx.lineTo(cx-s*0.22,cy+s*0.05); ctx.closePath();
            ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'wrench') {
            ctx.save(); ctx.translate(cx,cy); ctx.rotate(-Math.PI*0.55);
            ctx.beginPath(); ctx.roundRect(-s*0.13,-s*0.95,s*0.26,s*1.9,s*0.12); ctx.fillStyle=iconColor; ctx.fill();
            ctx.beginPath(); ctx.arc(0,-s*0.95,s*0.35,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(0,-s*0.95,s*0.18,0,Math.PI*2); ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)'; ctx.fill();
            ctx.restore();
          } else if (kind === 'drop') {
            ctx.beginPath(); ctx.moveTo(cx,cy-s*1.1);
            ctx.bezierCurveTo(cx+s*1.0,cy-s*0.1,cx+s*1.0,cy+s*0.5,cx,cy+s*1.05);
            ctx.bezierCurveTo(cx-s*1.0,cy+s*0.5,cx-s*1.0,cy-s*0.1,cx,cy-s*1.1);
            ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'flame') {
            ctx.beginPath(); ctx.moveTo(cx,cy-s*1.1);
            ctx.bezierCurveTo(cx+s*0.8,cy-s*0.3,cx+s*0.7,cy+s*0.4,cx+s*0.15,cy+s*1.1);
            ctx.bezierCurveTo(cx+s*0.5,cy+s*0.5,cx+s*0.28,cy,cx,cy+s*0.2);
            ctx.bezierCurveTo(cx-s*0.28,cy,cx-s*0.5,cy+s*0.5,cx-s*0.15,cy+s*1.1);
            ctx.bezierCurveTo(cx-s*0.7,cy+s*0.4,cx-s*0.8,cy-s*0.3,cx,cy-s*1.1);
            ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'house') {
            ctx.beginPath(); ctx.moveTo(cx,cy-s*1.1); ctx.lineTo(cx+s*1.1,cy-s*0.1); ctx.lineTo(cx-s*1.1,cy-s*0.1); ctx.closePath(); ctx.fillStyle=iconColor; ctx.fill();
            ctx.fillRect(cx-s*0.8,cy-s*0.12,s*1.6,s*1.1);
            ctx.beginPath(); ctx.roundRect(cx-s*0.22,cy+s*0.2,s*0.44,s*0.78,s*0.04); ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)'; ctx.fill();
          } else if (kind === 'leaf') {
            ctx.beginPath(); ctx.moveTo(cx,cy+s*1.1);
            ctx.bezierCurveTo(cx-s*1.0,cy+s*0.2,cx-s*0.6,cy-s*1.1,cx,cy-s*1.1);
            ctx.bezierCurveTo(cx+s*0.6,cy-s*1.1,cx+s*1.0,cy+s*0.2,cx,cy+s*1.1);
            ctx.fillStyle=iconColor; ctx.fill();
            ctx.strokeStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.3)'; ctx.lineWidth=s*0.1; ctx.lineCap='round';
            ctx.beginPath(); ctx.moveTo(cx,cy-s*1.1); ctx.lineTo(cx,cy+s*1.1); ctx.stroke();
          } else if (kind === 'hammer') {
            ctx.save(); ctx.translate(cx,cy); ctx.rotate(-Math.PI*0.25);
            ctx.beginPath(); ctx.roundRect(-s*0.12,0,s*0.24,s*1.35,s*0.1); ctx.fillStyle=iconColor; ctx.fill();
            ctx.beginPath(); ctx.roundRect(-s*0.5,-s*0.58,s*1.0,s*0.52,s*0.1); ctx.fill();
            ctx.restore();
          } else if (kind === 'phone') {
            ctx.beginPath(); ctx.roundRect(cx-s*0.52,cy-s*1.05,s*1.04,s*2.0,s*0.28); ctx.fillStyle=iconColor; ctx.fill();
            ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.35)';
            ctx.fillRect(cx-s*0.36,cy-s*0.68,s*0.72,s*1.12);
            ctx.beginPath(); ctx.arc(cx,cy+s*0.62,s*0.13,0,Math.PI*2); ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'clock') {
            ctx.beginPath(); ctx.arc(cx,cy,s*1.05,0,Math.PI*2); ctx.fillStyle=iconColor; ctx.fill();
            ctx.beginPath(); ctx.arc(cx,cy,s*0.8,0,Math.PI*2); ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)'; ctx.fill();
            ctx.strokeStyle=iconColor; ctx.lineWidth=s*0.13; ctx.lineCap='round';
            ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,cy-s*0.55); ctx.stroke();
            ctx.lineWidth=s*0.11; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+s*0.42,cy+s*0.28); ctx.stroke();
          } else if (kind === 'location') {
            ctx.beginPath(); ctx.moveTo(cx,cy+s*1.3);
            ctx.bezierCurveTo(cx-s*0.85,cy+s*0.55,cx-s*0.8,cy-s*0.2,cx-s*0.72,cy-s*0.28);
            ctx.arc(cx,cy-s*0.28,s*0.72,Math.PI,0);
            ctx.bezierCurveTo(cx+s*0.8,cy-s*0.2,cx+s*0.85,cy+s*0.55,cx,cy+s*1.3);
            ctx.fillStyle=iconColor; ctx.fill();
            ctx.beginPath(); ctx.arc(cx,cy-s*0.28,s*0.3,0,Math.PI*2); ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)'; ctx.fill();
          } else if (kind === 'mail') {
            const mw=s*1.85,mh=s*1.35,mx2=cx-mw/2,my2=cy-mh/2;
            ctx.beginPath(); ctx.roundRect(mx2,my2,mw,mh,s*0.12); ctx.fillStyle=iconColor; ctx.fill();
            ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.moveTo(mx2+2,my2+2); ctx.lineTo(cx,cy+s*0.2); ctx.lineTo(mx2+mw-2,my2+2); ctx.closePath(); ctx.fill();
          } else if (kind === 'dollar') {
            ctx.font=`bold ${Math.round(s*2.1)}px Arial,sans-serif`; ctx.fillStyle=iconColor; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('$',cx,cy);
          } else if (kind === 'trophy') {
            ctx.beginPath(); ctx.roundRect(cx-s*0.65,cy-s*1.05,s*1.3,s*1.2,s*0.12); ctx.fillStyle=iconColor; ctx.fill();
            ctx.strokeStyle=iconColor; ctx.lineWidth=s*0.2; ctx.lineCap='round';
            ctx.beginPath(); ctx.arc(cx-s*0.78,cy-s*0.5,s*0.28,Math.PI*0.5,Math.PI*1.5); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx+s*0.78,cy-s*0.5,s*0.28,-Math.PI*0.5,Math.PI*0.5); ctx.stroke();
            ctx.beginPath(); ctx.roundRect(cx-s*0.14,cy+s*0.15,s*0.28,s*0.58,s*0.05); ctx.fillStyle=iconColor; ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx-s*0.52,cy+s*0.73,s*1.04,s*0.22,s*0.08); ctx.fill();
          } else if (kind === 'calendar') {
            ctx.beginPath(); ctx.roundRect(cx-s*0.92,cy-s*0.8,s*1.84,s*1.78,s*0.12); ctx.fillStyle=iconColor; ctx.fill();
            ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)';
            ctx.fillRect(cx-s*0.86,cy-s*0.3,s*1.72,s*1.2);
            ctx.fillStyle=iconColor;
            ctx.beginPath(); ctx.roundRect(cx-s*0.62,cy-s*1.1,s*0.2,s*0.48,s*0.06); ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx+s*0.42,cy-s*1.1,s*0.2,s*0.48,s*0.06); ctx.fill();
            const gdr=s*0.1; [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]].forEach(([c,r])=>{ctx.beginPath();ctx.arc(cx-s*0.55+c*s*0.55,cy+s*0.08+r*s*0.4,gdr,0,Math.PI*2);ctx.fill();});
          } else if (kind === 'camera') {
            ctx.beginPath(); ctx.roundRect(cx-s*1.05,cy-s*0.62,s*2.1,s*1.55,s*0.18); ctx.fillStyle=iconColor; ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx-s*0.4,cy-s*1.05,s*0.8,s*0.48,s*0.1); ctx.fill();
            ctx.beginPath(); ctx.arc(cx,cy+s*0.12,s*0.52,0,Math.PI*2); ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)'; ctx.fill();
            ctx.beginPath(); ctx.arc(cx,cy+s*0.12,s*0.3,0,Math.PI*2); ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'arrowup') {
            ctx.beginPath();
            ctx.moveTo(cx,cy-s*1.1); ctx.lineTo(cx+s*0.8,cy-s*0.05); ctx.lineTo(cx+s*0.28,cy-s*0.05);
            ctx.lineTo(cx+s*0.28,cy+s*1.1); ctx.lineTo(cx-s*0.28,cy+s*1.1); ctx.lineTo(cx-s*0.28,cy-s*0.05);
            ctx.lineTo(cx-s*0.8,cy-s*0.05); ctx.closePath(); ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'arrowleft') {
            ctx.beginPath();
            ctx.moveTo(cx-s*1.1,cy); ctx.lineTo(cx-s*0.05,cy-s*0.8); ctx.lineTo(cx-s*0.05,cy-s*0.28);
            ctx.lineTo(cx+s*1.1,cy-s*0.28); ctx.lineTo(cx+s*1.1,cy+s*0.28); ctx.lineTo(cx-s*0.05,cy+s*0.28);
            ctx.lineTo(cx-s*0.05,cy+s*0.8); ctx.closePath(); ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'refresh') {
            ctx.strokeStyle=iconColor; ctx.lineWidth=s*0.24; ctx.lineCap='round';
            ctx.beginPath(); ctx.arc(cx,cy,s*0.88,-Math.PI*0.15,Math.PI*1.55); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx+s*0.6,cy-s*0.85); ctx.lineTo(cx+s*0.98,cy-s*0.5); ctx.lineTo(cx+s*0.18,cy-s*0.52); ctx.closePath(); ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'wifi') {
            ctx.strokeStyle=iconColor; ctx.lineCap='round'; ctx.lineJoin='round';
            const wb=cy+s*0.45;
            [s*1.05,s*0.68,s*0.35].forEach((r,i)=>{ ctx.lineWidth=s*(0.2-i*0.02); ctx.beginPath(); ctx.arc(cx,wb,r,Math.PI*1.22,Math.PI*1.78); ctx.stroke(); });
            ctx.beginPath(); ctx.arc(cx,wb,s*0.1,0,Math.PI*2); ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'lock') {
            ctx.strokeStyle=iconColor; ctx.lineWidth=s*0.24; ctx.lineCap='round';
            ctx.beginPath(); ctx.arc(cx,cy-s*0.5,s*0.55,Math.PI,0); ctx.stroke();
            ctx.beginPath(); ctx.roundRect(cx-s*0.68,cy-s*0.18,s*1.36,s*1.22,s*0.14); ctx.fillStyle=iconColor; ctx.fill();
            ctx.beginPath(); ctx.arc(cx,cy+s*0.38,s*0.22,0,Math.PI*2); ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)'; ctx.fill();
          } else if (kind === 'eye2') {
            ctx.beginPath();
            ctx.moveTo(cx-s*1.05,cy);
            ctx.bezierCurveTo(cx-s*0.3,cy-s*0.88,cx+s*0.3,cy-s*0.88,cx+s*1.05,cy);
            ctx.bezierCurveTo(cx+s*0.3,cy+s*0.88,cx-s*0.3,cy+s*0.88,cx-s*1.05,cy);
            ctx.fillStyle=iconColor; ctx.fill();
            ctx.beginPath(); ctx.arc(cx,cy,s*0.42,0,Math.PI*2); ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)'; ctx.fill();
            ctx.beginPath(); ctx.arc(cx,cy,s*0.2,0,Math.PI*2); ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'pipe') {
            ctx.strokeStyle=iconColor; ctx.lineWidth=s*0.38; ctx.lineCap='round';
            ctx.beginPath(); ctx.moveTo(cx-s*1.05,cy); ctx.lineTo(cx+s*0.3,cy); ctx.stroke();
            ctx.lineWidth=s*0.28;
            ctx.beginPath(); ctx.moveTo(cx-s*1.05,cy-s*0.35); ctx.lineTo(cx-s*1.05,cy+s*0.35); ctx.stroke();
            ctx.lineWidth=s*0.32;
            ctx.beginPath(); ctx.moveTo(cx+s*0.3,cy); ctx.lineTo(cx+s*0.3,cy-s*0.78); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx+s*0.3,cy-s*0.78); ctx.lineTo(cx+s*1.05,cy-s*0.78); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx+s*1.05,cy-s*0.48); ctx.lineTo(cx+s*1.05,cy-s*1.05); ctx.stroke();
          } else if (kind === 'snowflake') {
            ctx.strokeStyle=iconColor; ctx.lineWidth=s*0.18; ctx.lineCap='round';
            for(let i=0;i<6;i++){
              const a=(Math.PI/3)*i;
              ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*s*1.05,cy+Math.sin(a)*s*1.05); ctx.stroke();
              const bx=cx+Math.cos(a)*s*0.58, by=cy+Math.sin(a)*s*0.58, ba=a+Math.PI/2;
              ctx.beginPath(); ctx.moveTo(bx+Math.cos(ba)*s*0.26,by+Math.sin(ba)*s*0.26); ctx.lineTo(bx-Math.cos(ba)*s*0.26,by-Math.sin(ba)*s*0.26); ctx.stroke();
            }
            ctx.beginPath(); ctx.arc(cx,cy,s*0.14,0,Math.PI*2); ctx.fillStyle=iconColor; ctx.fill();
          } else if (kind === 'fan') {
            ctx.fillStyle=iconColor;
            for(let i=0;i<3;i++){
              ctx.save(); ctx.translate(cx,cy); ctx.rotate((Math.PI*2/3)*i);
              ctx.beginPath(); ctx.ellipse(-s*0.22,-(s*0.62),s*0.38,s*0.7,Math.PI*0.15,0,Math.PI*2);
              ctx.fill(); ctx.restore();
            }
            ctx.beginPath(); ctx.arc(cx,cy,s*0.2,0,Math.PI*2); ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)'; ctx.fill();
          } else if (kind === 'hardhat') {
            ctx.fillStyle=iconColor;
            ctx.beginPath(); ctx.arc(cx,cy-s*0.18,s*0.92,Math.PI,0); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx-s*1.05,cy-s*0.02,s*2.1,s*0.35,s*0.08); ctx.fill();
            ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.35)';
            ctx.beginPath(); ctx.moveTo(cx-s*0.16,cy-s*1.1); ctx.lineTo(cx+s*0.16,cy-s*1.1); ctx.lineTo(cx+s*0.08,cy-s*0.2); ctx.lineTo(cx-s*0.08,cy-s*0.2); ctx.closePath(); ctx.fill();
          } else if (kind === 'paintbrush') {
            ctx.save(); ctx.translate(cx,cy); ctx.rotate(-Math.PI*0.25);
            ctx.fillStyle=iconColor;
            ctx.beginPath(); ctx.roundRect(-s*0.1,-s*1.3,s*0.2,s*1.3,s*0.06); ctx.fill();
            ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.35)';
            ctx.beginPath(); ctx.rect(-s*0.13,0,s*0.26,s*0.3); ctx.fill();
            ctx.fillStyle=iconColor;
            ctx.beginPath(); ctx.moveTo(-s*0.2,s*0.3); ctx.lineTo(s*0.2,s*0.3); ctx.lineTo(s*0.06,s*0.82); ctx.lineTo(-s*0.06,s*0.82); ctx.closePath(); ctx.fill();
            ctx.restore();
          } else if (kind === 'spray') {
            ctx.fillStyle=iconColor;
            ctx.beginPath(); ctx.roundRect(cx-s*0.5,cy-s*0.35,s*1.0,s*1.32,s*0.14); ctx.fill();
            ctx.beginPath(); ctx.roundRect(cx-s*0.15,cy-s*1.02,s*0.58,s*0.7,s*0.09); ctx.fill();
            [[cx+s*0.62,cy-s*0.9],[cx+s*0.82,cy-s*0.68],[cx+s*0.75,cy-s*0.45],[cx+s*0.98,cy-s*0.55]].forEach(([mx,my])=>{ ctx.beginPath(); ctx.arc(mx,my,s*0.07,0,Math.PI*2); ctx.fill(); });
          } else if (kind === 'truck') {
            ctx.fillStyle=iconColor;
            ctx.beginPath(); ctx.roundRect(cx-s*1.05,cy-s*0.62,s*1.42,s*0.96,s*0.08); ctx.fill();
            ctx.beginPath(); ctx.moveTo(cx+s*0.37,cy-s*0.62); ctx.lineTo(cx+s*0.37,cy-s*1.06); ctx.lineTo(cx+s*0.94,cy-s*1.06); ctx.quadraticCurveTo(cx+s*1.08,cy-s*1.06,cx+s*1.08,cy-s*0.92); ctx.lineTo(cx+s*1.08,cy+s*0.34); ctx.lineTo(cx+s*0.37,cy+s*0.34); ctx.closePath(); ctx.fill();
            ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)';
            ctx.beginPath(); ctx.arc(cx-s*0.58,cy+s*0.44,s*0.25,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx+s*0.82,cy+s*0.44,s*0.25,0,Math.PI*2); ctx.fill();
            ctx.fillStyle=iconColor;
            ctx.beginPath(); ctx.arc(cx-s*0.58,cy+s*0.44,s*0.11,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx+s*0.82,cy+s*0.44,s*0.11,0,Math.PI*2); ctx.fill();
          } else if (kind === 'broom') {
            ctx.save(); ctx.translate(cx,cy); ctx.rotate(Math.PI*0.15);
            ctx.fillStyle=iconColor;
            ctx.beginPath(); ctx.roundRect(-s*0.08,-s*1.35,s*0.16,s*1.6,s*0.06); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-s*0.62,s*0.25); ctx.lineTo(s*0.62,s*0.25); ctx.lineTo(s*0.52,s*0.85); ctx.quadraticCurveTo(s*0.32,s*1.02,0,s*1.02); ctx.quadraticCurveTo(-s*0.32,s*1.02,-s*0.52,s*0.85); ctx.closePath(); ctx.fill();
            ctx.restore();
          } else if (kind === 'ladder') {
            ctx.strokeStyle=iconColor; ctx.lineWidth=s*0.18; ctx.lineCap='round';
            ctx.beginPath(); ctx.moveTo(cx-s*0.48,cy-s*1.12); ctx.lineTo(cx-s*0.48,cy+s*1.12); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx+s*0.48,cy-s*1.12); ctx.lineTo(cx+s*0.48,cy+s*1.12); ctx.stroke();
            [-0.82,-0.41,0,0.41,0.82].forEach(y=>{ ctx.beginPath(); ctx.moveTo(cx-s*0.48,cy+s*y); ctx.lineTo(cx+s*0.48,cy+s*y); ctx.stroke(); });
          } else if (kind === 'gear') {
            const gr=s*0.88, teeth=8;
            ctx.fillStyle=iconColor;
            ctx.beginPath();
            for(let i=0;i<teeth;i++){
              const a1=(Math.PI*2/teeth)*i-Math.PI/teeth*0.38;
              const a2=a1+Math.PI/teeth*0.38, a3=a2+Math.PI/teeth*0.24, a4=a3+Math.PI/teeth*0.38;
              i===0?ctx.moveTo(cx+gr*Math.cos(a1),cy+gr*Math.sin(a1)):ctx.lineTo(cx+gr*Math.cos(a1),cy+gr*Math.sin(a1));
              ctx.lineTo(cx+gr*1.22*Math.cos(a2),cy+gr*1.22*Math.sin(a2));
              ctx.lineTo(cx+gr*1.22*Math.cos(a3),cy+gr*1.22*Math.sin(a3));
              ctx.lineTo(cx+gr*Math.cos(a4),cy+gr*Math.sin(a4));
            }
            ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.arc(cx,cy,gr*0.52,0,Math.PI*2); ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)'; ctx.fill();
          } else if (kind === 'tag') {
            ctx.fillStyle=iconColor;
            ctx.beginPath(); ctx.moveTo(cx-s*0.92,cy-s*0.92); ctx.lineTo(cx+s*0.18,cy-s*0.92); ctx.lineTo(cx+s*1.02,cy); ctx.lineTo(cx+s*0.18,cy+s*0.92); ctx.lineTo(cx-s*0.92,cy+s*0.92); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.arc(cx-s*0.56,cy-s*0.44,s*0.17,0,Math.PI*2); ctx.fillStyle=iconBgShape!=='none'?iconBgColor:'rgba(0,0,0,0.4)'; ctx.fill();
          }
          ctx.restore();
          if (isSelected) { ctx.strokeStyle='#7C5CFC'; ctx.lineWidth=1.5; ctx.strokeRect(0,0,w,h); }
        }}
      />
    );
  }

  if (el.type === 'counter') {
    const cw = el.width || 200, ch = el.height || 160;
    const bgC = el.bgColor || 'rgba(0,196,204,0.15)';
    const textC = el.fill || '#ffffff';
    const accentC = el.accentColor || TEAL;
    const cStyle = el.counterStyle || 'card';
    const val = el.counterValue ?? 1234;
    const numStr = `${el.counterPrefix || ''}${Number(val).toLocaleString()}${el.counterSuffix || ''}`;
    const label = el.counterLabel || '';
    const numFontSize = el.fontSize || 52;
    const labelFontSize = Math.max(11, Math.round(numFontSize * 0.28));
    return (
      <Shape {...common} width={cw} height={ch} opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          if (cStyle === 'circle') {
            const r = Math.min(w, h) / 2 - 2;
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
            ctx.fillStyle = bgC;
            ctx.fill();
          } else if (cStyle === 'card') {
            ctx.fillStyle = bgC;
            ctx.beginPath();
            ctx.roundRect(0, 0, w, h, el.cornerRadius ?? 12);
            ctx.fill();
            ctx.fillStyle = accentC;
            ctx.fillRect(0, 0, w, 4);
          }
          const numY = label ? h * 0.40 : h * 0.50;
          ctx.font = `bold ${numFontSize}px Inter, sans-serif`;
          ctx.fillStyle = textC;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(numStr, w / 2, numY);
          if (label) {
            ctx.font = `${labelFontSize}px Inter, sans-serif`;
            ctx.fillStyle = accentC;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(label, w / 2, h * 0.68);
          }
          if (isSelected) { ctx.strokeStyle = '#7C5CFC'; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, w, h); }
        }}
      />
    );
  }

  if (el.type === 'gradrect') {
    const grw = el.width || 320, grh = el.height || 200;
    const stops = el.gradStops || [{ pos: 0, color: '#7C5CFC' }, { pos: 1, color: TEAL }];
    const dir2 = el.gradDir || 'horizontal'; // 'horizontal'|'vertical'|'diagonal'|'radial'
    const cornerR4 = el.cornerRadius ?? 0;

    return (
      <Shape {...common}
        width={grw} height={grh}
        opacity={el.opacity ?? 1}
        globalCompositeOperation={el.blendMode || 'source-over'}
        sceneFunc={(ctx, shape2) => {
          const w = shape2.width(), h = shape2.height();
          let grad3;
          if (dir2 === 'radial') {
            grad3 = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
          } else if (dir2 === 'vertical') {
            grad3 = ctx.createLinearGradient(0, 0, 0, h);
          } else if (dir2 === 'diagonal') {
            grad3 = ctx.createLinearGradient(0, 0, w, h);
          } else {
            grad3 = ctx.createLinearGradient(0, 0, w, 0);
          }
          stops.forEach(s => grad3.addColorStop(Math.max(0, Math.min(1, s.pos)), s.color));
          ctx.fillStyle = grad3;
          if (cornerR4 > 0) {
            ctx.beginPath();
            ctx.roundRect(0, 0, w, h, cornerR4);
            ctx.fill();
          } else {
            ctx.fillRect(0, 0, w, h);
          }
          if (isSelected) {
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, w, h);
          }
        }}
      />
    );
  }

  if (el.type === 'draw') return (
    <Line
      x={el.x || 0} y={el.y || 0}
      id={el.id}
      points={el.points || []}
      stroke={isSelected ? '#7C5CFC' : (el.stroke || '#ffffff')}
      strokeWidth={el.strokeWidth || 4}
      opacity={el.opacity ?? 1}
      tension={0.5}
      lineCap="round"
      lineJoin="round"
      globalCompositeOperation={el.blendMode || 'source-over'}
      draggable={!locked && !hidden}
      visible={!hidden && el.visible !== false}
      listening={!locked && !hidden}
      onClick={e => { e.cancelBubble = true; if (!locked) onSelect(el.id, e); }}
      onTap={e => { e.cancelBubble = true; if (!locked) onSelect(el.id, e); }}
      onDragStart={e => { setIsDragging(true); const s = e.target.getStage(); if (s) s.container().style.cursor = 'grabbing'; }}
      onDragMove={e => { if (!onDragMove) return; const { x: nx, y: ny } = onDragMove(el.id, e.target.x(), e.target.y(), el.width || 50, el.height || 50); e.target.position({ x: nx, y: ny }); }}
      onDragEnd={e => { setIsDragging(false); const s = e.target.getStage(); if (s) s.container().style.cursor = ''; if (onSnapClear) onSnapClear(); onChange({ ...el, x: e.target.x(), y: e.target.y() }); }}
    />
  );

  return null;
}

// ─── GroupNode ───────────────────────────────────────────────────────────────

function GroupNode({ el, isSelected, onSelect, onChange, stageW, stageH, onDragMove, onSnapClear, locked, hidden }) {
  const groupRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragMove = (e) => {
    if (!onDragMove) return;
    const { x: nx, y: ny } = onDragMove(el.id, e.target.x(), e.target.y(), el.width, el.height);
    e.target.position({ x: nx, y: ny });
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    const s = e.target.getStage(); if (s) s.container().style.cursor = '';
    if (onSnapClear) onSnapClear();
    onChange({ ...el, x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const sx = Math.abs(node.scaleX());
    const sy = Math.abs(node.scaleY());
    node.scaleX(1); node.scaleY(1);
    onChange({
      ...el,
      x: node.x(), y: node.y(),
      width:  Math.max(5, el.width  * sx),
      height: Math.max(5, el.height * sy),
      rotation: node.rotation(),
      children: (el.children || []).map(child => ({
        ...child,
        x:           child.x * sx,
        y:           child.y * sy,
        width:       child.width       != null ? Math.max(1, child.width       * sx) : undefined,
        height:      child.height      != null ? Math.max(1, child.height      * sy) : undefined,
        fontSize:    child.fontSize    != null ? Math.max(8, Math.round(child.fontSize * sx)) : undefined,
        radius:      child.radius      != null ? child.radius      * sx : undefined,
        outerRadius: child.outerRadius != null ? child.outerRadius * sx : undefined,
        innerRadius: child.innerRadius != null ? child.innerRadius * sx : undefined,
      })),
    });
  };

  return (
    <Group
      ref={groupRef}
      id={el.id}
      x={el.x}
      y={el.y}
      rotation={el.rotation || 0}
      opacity={isDragging ? Math.min(el.opacity ?? 1, 0.65) : (el.opacity ?? 1)}
      draggable={!locked}
      visible={!hidden && el.visible !== false}
      globalCompositeOperation={el.blendMode || 'source-over'}
      onClick={(e)  => { e.cancelBubble = true; if (!locked) onSelect(el.id, e); }}
      onTap={(e)    => { e.cancelBubble = true; if (!locked) onSelect(el.id, e); }}
      onDragStart={e => { setIsDragging(true); const s = e.target.getStage(); if (s) s.container().style.cursor = 'grabbing'; }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {(el.children || []).map(child =>
        child.type === 'image'
          ? <ImageNode  key={child.id} el={child} isSelected={false} onSelect={() => {}} onChange={() => {}} locked={false} hidden={false} />
          : <ContentNode key={child.id} el={child} isSelected={false} onSelect={() => {}} onChange={() => {}} stageW={stageW} stageH={stageH} onDblClick={() => {}} locked={false} hidden={false} />
      )}
      {isSelected && (
        <Rect x={0} y={0} width={el.width} height={el.height}
          stroke="#7C5CFC" strokeWidth={1.5} fill="transparent" listening={false} />
      )}
    </Group>
  );
}

// ─── Canvas Rulers ───────────────────────────────────────────────────────────

function RulerH({ canvasW, stageScale, isDark }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#1a1a22' : '#f0f0f0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#2a2a38' : '#d8d8d8';
    ctx.fillRect(0, h - 1, w, 1);
    const majorStep = stageScale >= 2 ? 50 : stageScale >= 1 ? 100 : stageScale >= 0.5 ? 200 : 500;
    const minorStep = majorStep / 5;
    ctx.lineWidth = 1;
    ctx.font = '8px system-ui, sans-serif';
    for (let px = 0; px <= canvasW + majorStep; px += minorStep) {
      const x = Math.round(px * stageScale) + 0.5;
      if (x > w) break;
      const isMajor = px % majorStep === 0;
      ctx.strokeStyle = isDark ? (isMajor ? '#555' : '#3a3a4a') : (isMajor ? '#bbb' : '#e0e0e0');
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x, isMajor ? 2 : h * 0.55); ctx.stroke();
      if (isMajor && px > 0) {
        ctx.fillStyle = isDark ? '#666' : '#999';
        ctx.fillText(String(px), x + 2, 9);
      }
    }
  }, [canvasW, stageScale, isDark]);
  const displayW = Math.round(canvasW * stageScale);
  return <canvas ref={ref} width={displayW} height={20} style={{ display: 'block', width: displayW, height: 20, flexShrink: 0 }} />;
}

function RulerV({ canvasH, stageScale, isDark }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#1a1a22' : '#f0f0f0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#2a2a38' : '#d8d8d8';
    ctx.fillRect(w - 1, 0, 1, h);
    const majorStep = stageScale >= 2 ? 50 : stageScale >= 1 ? 100 : stageScale >= 0.5 ? 200 : 500;
    const minorStep = majorStep / 5;
    ctx.lineWidth = 1;
    ctx.font = '8px system-ui, sans-serif';
    for (let px = 0; px <= canvasH + majorStep; px += minorStep) {
      const y = Math.round(px * stageScale) + 0.5;
      if (y > h) break;
      const isMajor = px % majorStep === 0;
      ctx.strokeStyle = isDark ? (isMajor ? '#555' : '#3a3a4a') : (isMajor ? '#bbb' : '#e0e0e0');
      ctx.beginPath(); ctx.moveTo(w, y); ctx.lineTo(isMajor ? 2 : w * 0.55, y); ctx.stroke();
      if (isMajor && px > 0) {
        ctx.fillStyle = isDark ? '#666' : '#999';
        ctx.save();
        ctx.translate(w - 3, y - 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(px), 0, 0);
        ctx.restore();
      }
    }
  }, [canvasH, stageScale, isDark]);
  const displayH = Math.round(canvasH * stageScale);
  return <canvas ref={ref} width={20} height={displayH} style={{ display: 'block', width: 20, height: displayH, flexShrink: 0 }} />;
}

// ─── TransformerLayer ────────────────────────────────────────────────────────

function TransformerLayer({ selectedIds, elements, stageRef, snapGuides, stageScale, canvasW, canvasH, onLiveBounds, onLiveBoundsClear }) {
  const trRef = useRef(null);
  const { t } = useTheme();

  useLayoutEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    const validIds = (selectedIds || []).filter(id => id && id !== '__bg__');
    if (!validIds.length) {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
      return;
    }
    const nodes = validIds.map(id => stageRef.current.findOne(`#${id}`)).filter(Boolean);
    trRef.current.nodes(nodes);
    trRef.current.getLayer()?.batchDraw();
  });

  // Only use text-only handles when a single text element is selected
  const singleEl = selectedIds?.length === 1 ? elements.find(e => e.id === selectedIds[0]) : null;
  const isText = singleEl?.type === 'text';

  return (
    <>
      <Transformer
        ref={trRef}
        borderStroke={t.primary}
        borderStrokeWidth={1.5 / stageScale}
        anchorSize={10 / stageScale}
        anchorCornerRadius={2 / stageScale}
        anchorStroke="rgba(30,30,30,0.55)"
        anchorFill="#ffffff"
        anchorStrokeWidth={1.5 / stageScale}
        rotateAnchorOffset={28 / stageScale}
        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        rotationSnapTolerance={5}
        enabledAnchors={isText
          ? ['middle-left', 'middle-right']
          : ['top-left', 'top-right', 'bottom-left', 'bottom-right',
             'top-center', 'bottom-center', 'middle-left', 'middle-right']
        }
        boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
        onTransform={e => {
          const node = e.target;
          onLiveBounds?.({ x: Math.round(node.x()), y: Math.round(node.y()), w: Math.round(node.width() * Math.abs(node.scaleX())), h: Math.round(node.height() * Math.abs(node.scaleY())) });
        }}
        onTransformEnd={() => onLiveBoundsClear?.()}
      />
      {(snapGuides?.v || []).map((x, i) => (
        <Line key={`sv${i}`} points={[x, 0, x, canvasH]} stroke="#FF0080"
          strokeWidth={1 / stageScale} dash={[4 / stageScale, 4 / stageScale]} listening={false} />
      ))}
      {(snapGuides?.h || []).map((y, i) => (
        <Line key={`sh${i}`} points={[0, y, canvasW, y]} stroke="#FF0080"
          strokeWidth={1 / stageScale} dash={[4 / stageScale, 4 / stageScale]} listening={false} />
      ))}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TemplatesEditorInner() {
  const { t, toggleTheme, theme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();

  // Canvas
  const [canvasSizeId, setCanvasSizeId] = useState('ig_portrait');
  const [canvasCustomW, setCanvasCustomW] = useState(1080);
  const [canvasCustomH, setCanvasCustomH] = useState(1080);
  const [showCustomSizeForm, setShowCustomSizeForm] = useState(false);
  const [scaleOnResize, setScaleOnResize] = useState(false);
  const canvasSize = canvasSizeId === 'custom'
    ? { id: 'custom', label: `Custom ${canvasCustomW}×${canvasCustomH}`, w: canvasCustomW, h: canvasCustomH }
    : (CANVAS_SIZES.find(s => s.id === canvasSizeId) || CANVAS_SIZES[0]);
  const prevCanvasSizeRef = useRef({ w: canvasSize.w, h: canvasSize.h });

  // Pages (multi-page state — replaces individual bg + elements state)
  const [pages, setPages] = useState(() => [emptyPage()]);
  const [activePage, setActivePage] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]); // multi-select
  const [floatingBar, setFloatingBar] = useState(null); // floating element toolbar position
  const [selectionStart, setSelectionStart] = useState(null); // rubber-band drag
  const [selectionRect, setSelectionRect] = useState(null);   // rubber-band rect
  const [editingTextId, setEditingTextId] = useState(null);
  const [textareaValue, setTextareaValue] = useState('');
  const [textareaPos, setTextareaPos] = useState({ x: 0, y: 0, w: 0 });

  // History
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Canva-parity state
  const [hoveredId, setHoveredId] = useState(null);
  const [clipboard,      setClipboard]      = useState(null);
  const [styleClipboard, setStyleClipboard] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, elementId } | null
  const [snapGuides, setSnapGuides] = useState({ v: [], h: [] });
  const [rightTab, setRightTab] = useState('properties');
  const [recentColors, setRecentColors] = useState([]);
  const [showShadowPanel, setShowShadowPanel] = useState(false);
  const [showOutlinePanel, setShowOutlinePanel] = useState(false);
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);
  const [showMorePanel, setShowMorePanel] = useState(false);
  const [aiImproving, setAiImproving] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [safeZonePlatform, setSafeZonePlatform] = useState('instagram');
  const [showPositionPanel, setShowPositionPanel] = useState(false);
  const [showAnimatePanel, setShowAnimatePanel] = useState(false);
  // Find & Replace
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText,        setFindText]        = useState('');
  const [replaceText,     setReplaceText]     = useState('');
  const [frMatchCount,    setFrMatchCount]    = useState(0);
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [showSpacingPanel, setShowSpacingPanel] = useState(false);
  const [showCurvePanel, setShowCurvePanel] = useState(false);
  const [showCropPanel, setShowCropPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [hoveredPhotoId, setHoveredPhotoId] = useState(null);
  const [imgTab, setImgTab] = useState('stock');
  const [uploadMediaTab, setUploadMediaTab] = useState('Images');
  const [pexelsPhotos, setPexelsPhotos] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockQuery, setStockQuery] = useState('');
  const [stockInputValue, setStockInputValue] = useState('');
  const [bgRemoverDismissed, setBgRemoverDismissed] = useState(false);
  const [activeBrandItem, setActiveBrandItem] = useState('All assets');
  const [bgRemoveLoading, setBgRemoveLoading] = useState(false);
  const [bgProgress, setBgProgress] = useState('');
  const [extractLoading, setExtractLoading] = useState(false);
  const [showImgUrlInput, setShowImgUrlInput] = useState(false);
  const [imgUrlValue, setImgUrlValue] = useState('');
  const [projectTab, setProjectTab] = useState('All');
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [savedDesignsLoading, setSavedDesignsLoading] = useState(false);
  const [curatedTemplates, setCuratedTemplates] = useState([]);
  const [curatedLoading, setCuratedLoading] = useState(false);
  const [templateCategory, setTemplateCategory] = useState('all');
  const [templateThumbs, setTemplateThumbs] = useState({});
  const [thumbGenProgress, setThumbGenProgress] = useState(null); // null | { current, total, name }
  const [brandProfile, setBrandProfile] = useState(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [uploadItems, setUploadItems] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadQuota, setUploadQuota] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadSearch, setUploadSearch] = useState('');
  const [hoveredDesign, setHoveredDesign] = useState(null); // { id, title, pagesCount, x, y }
  const [layerDragId, setLayerDragId] = useState(null);
  // Quick actions palette
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  // Text panel font search
  const [fontSearch, setFontSearch] = useState('');
  // Elements panel category tab
  const [elemTab, setElemTab] = useState('shapes');
  // Pages thumbnail sidebar
  const [showPagesPanel, setShowPagesPanel] = useState(false);
  // Page notes panel
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  // Canvas grid overlay
  const [showGrid, setShowGrid] = useState(false);
  // Emoji picker in text bar
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [panelAnchor, setPanelAnchor] = useState(null); // tracks button position for portal panels
  const [emojiCat, setEmojiCat] = useState(0);
  // Freehand draw mode
  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState('#7C5CFC');
  const [drawWidth, setDrawWidth] = useState(4);
  const [isDrawingNow, setIsDrawingNow] = useState(false);
  const currentDrawRef = useRef(null); // in-progress draw element (ref for perf)
  const [currentDrawEl, setCurrentDrawEl] = useState(null);
  // Canvas rulers + drag guides
  const [showRulers, setShowRulers] = useState(false);
  // Video mode
  const [isVideoMode, setIsVideoMode] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'video');
  const [videoPlayhead, setVideoPlayhead] = useState(0); // seconds
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);
  const [editingClipIdx, setEditingClipIdx] = useState(null); // page index being duration-edited
  const [rulerGuides, setRulerGuides] = useState({ h: [], v: [] });
  const [draggingGuide, setDraggingGuide] = useState(null); // { axis:'h'|'v', pos:number } canvas px
  const [liveBounds, setLiveBounds] = useState(null); // { x,y,w,h } shown while dragging/resizing
  const canvasWrapperRef = useRef(null);
  const replaceImgId  = useRef(null);  // id of image element being replaced (null = use selectedId)
  // Top bar dropdowns
  const [titleEditing, setTitleEditing] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showResizeMenu, setShowResizeMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [exportScale, setExportScale] = useState(2);
  const [editModeOpen, setEditModeOpen] = useState(false);
  const [editMode, setEditMode] = useState('editing');
  const [shareOpen, setShareOpen] = useState(false);
  const [previewOpen, setPreviewOpen]   = useState(false);
  const [previewUrl,  setPreviewUrl]    = useState(null);
  const [presentPlaying,  setPresentPlaying]  = useState(false);
  const [presentInterval, setPresentInterval] = useState(3);

  // UI
  const [activeLeftTool, setActiveLeftTool] = useState('templates');
  const [panelOpen, setPanelOpen] = useState(true);
  const [positionTab, setPositionTab] = useState('arrange');
  const [ratioLocked, setRatioLocked] = useState(false);
  const [elemSearch, setElemSearch] = useState('');
  const [activeElemCat, setActiveElemCat] = useState(null);
  const [elemSubPanel, setElemSubPanel] = useState(null); // null | 'photos' | 'videos'
  const [elemPhotos, setElemPhotos] = useState([]);
  const [elemPhotosLoading, setElemPhotosLoading] = useState(false);
  const [elemPhotosQuery, setElemPhotosQuery] = useState('');
  const [elemPhotosInput, setElemPhotosInput] = useState('');
  const [pexelsVideos, setPexelsVideos] = useState([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoQuery, setVideoQuery] = useState('');
  const [videoInput, setVideoInput] = useState('');
  const [bgPhotos, setBgPhotos] = useState([]);
  const [bgPhotosLoading, setBgPhotosLoading] = useState(false);
  const [bgTab, setBgTab] = useState('stock');
  const [replaceDocColorOld, setReplaceDocColorOld] = useState(null); // color being replaced
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const autosaveTimerRef = useRef(null);
  const postModalOpen_ref = useRef(false); // prevent autosave opening post modal
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [savedCreationId, setSavedCreationId] = useState(null);
  const [postCaption, setPostCaption] = useState('');
  const [postPlatforms, setPostPlatforms] = useState(['instagram']);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [postSuccess, setPostSuccess] = useState(false);
  const [titleForSave, setTitleForSave] = useState('Untitled');
  // Template editing (admin)
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [tmplSaving, setTmplSaving] = useState(false);
  const [tmplSaveStatus, setTmplSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'

  // Tooltip
  const [tip, setTip] = useState(null);
  const tipTimerRef = useRef(null);

  // ── Derived page state (computed from pages[activePage]) ───────────────────
  const currentPage = pages[activePage] || pages[0];
  const elements    = currentPage.elements;
  const bgType      = currentPage.bgType;
  const bgColor     = currentPage.bgColor;
  const bgImageUrl  = currentPage.bgImageUrl;
  const bgSource    = currentPage.bgSource;
  const bgSourceId  = currentPage.bgSourceId;
  const bgFilter    = currentPage.bgFilter;
  const bgBrightness = currentPage.bgBrightness;
  const bgContrast   = currentPage.bgContrast;
  const bgSaturation = currentPage.bgSaturation;
  const bgGradient     = currentPage.bgGradient;
  const bgPattern      = currentPage.bgPattern;
  const bgPatternColor = currentPage.bgPatternColor || 'rgba(255,255,255,0.18)';
  const lockedIds   = new Set(currentPage.lockedIds);
  const hiddenIds   = new Set(currentPage.hiddenIds);

  function patchPage(patch) {
    setPages(prev => prev.map((p, i) => i === activePage ? { ...p, ...patch } : p));
  }

  function patchElements(updater) {
    setPages(prev => prev.map((p, i) => {
      if (i !== activePage) return p;
      return { ...p, elements: typeof updater === 'function' ? updater(p.elements) : updater };
    }));
  }

  // Unified select handler — supports Shift+click multi-select
  function handleSelect(id, e) {
    if (e?.evt?.shiftKey) {
      setSelectedIds(prev => {
        if (prev.includes(id)) return prev.filter(x => x !== id);
        return [...prev, id];
      });
      setSelectedId(id);
    } else {
      setSelectedIds([id]);
      setSelectedId(id);
    }
  }

  function clearSelection() {
    setSelectedId(null);
    setSelectedIds([]);
  }

  // ── Tooltip helpers ───────────────────────────────────────────────────────
  function showTip(e, text, shortcut) {
    clearTimeout(tipTimerRef.current);
    const r = e.currentTarget.getBoundingClientRect();
    tipTimerRef.current = setTimeout(() => {
      setTip({ text, shortcut, x: r.left + r.width / 2, y: r.bottom + 6 });
    }, 400);
  }
  function hideTip() {
    clearTimeout(tipTimerRef.current);
    setTip(null);
  }
  // Parse "Label (Shortcut)" → { text, shortcut }
  function parseTipTitle(t) {
    const m = t?.match(/^(.+?)\s*\((.+?)\)$/);
    return m ? { text: m[1].trim(), shortcut: m[2].trim() } : { text: t || '', shortcut: undefined };
  }

  // Canvas display scale
  const containerRef = useRef(null);
  const replaceFileRef = useRef(null);
  const uploadFileRef = useRef(null);
  const [stageScale, setStageScale] = useState(1);
  const [stageDisplayW, setStageDisplayW] = useState(540);
  const [stageDisplayH, setStageDisplayH] = useState(675);
  const [zoomFactor, setZoomFactor] = useState(1.0);
  const baseScaleRef = useRef(1);
  const stageRef = useRef(null);
  const trLayerRef = useRef(null);
  const spaceDownRef = useRef(false);
  const panOriginRef = useRef(null);

  // ── Display scale ──────────────────────────────────────────────────────────
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const maxW = containerRef.current.clientWidth - 48;
      const base = Math.min(maxW / canvasSize.w, 1);
      baseScaleRef.current = base;
      const scale = base * zoomFactor;
      setStageScale(scale);
      setStageDisplayW(Math.floor(canvasSize.w * scale));
      setStageDisplayH(Math.floor(canvasSize.h * scale));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [canvasSizeId, canvasSize.w, canvasSize.h, zoomFactor]);

  function zoomIn()  { setZoomFactor(z => Math.min(parseFloat((z + 0.25).toFixed(2)), 3)); }
  function zoomOut() { setZoomFactor(z => Math.max(parseFloat((z - 0.25).toFixed(2)), 0.25)); }

  // ── Scale elements when canvas size changes (scaleOnResize) ───────────────
  useEffect(() => {
    const prev = prevCanvasSizeRef.current;
    const rW = canvasSize.w / prev.w;
    const rH = canvasSize.h / prev.h;
    prevCanvasSizeRef.current = { w: canvasSize.w, h: canvasSize.h };
    if (!scaleOnResize || (rW === 1 && rH === 1)) return;
    pushHistory();
    setPages(prev => prev.map(page => ({
      ...page,
      elements: page.elements.map(el => ({
        ...el,
        x: (el.x || 0) * rW,
        y: (el.y || 0) * rH,
        width:  el.width  != null ? el.width  * rW : el.width,
        height: el.height != null ? el.height * rH : el.height,
        fontSize: el.fontSize != null ? Math.max(8, Math.round(el.fontSize * Math.min(rW, rH))) : el.fontSize,
        strokeWidth: el.strokeWidth != null ? Math.max(1, Math.round(el.strokeWidth * Math.min(rW, rH))) : el.strokeWidth,
      })),
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize.w, canvasSize.h]);

  // ── Load photos (triggers on both old IDs and new Canva IDs) ─────────────
  useEffect(() => {
    const isMediaTool = ['background', 'images', 'uploads', 'templates'].includes(activeLeftTool);
    if (!isMediaTool) return;
    if (bgPhotos.length > 0) return;
    setBgPhotosLoading(true);
    studioAPI.getPhotos({ limit: 60, offset: 0 })
      .then(r => setBgPhotos(r.data?.photos || []))
      .catch(() => {})
      .finally(() => setBgPhotosLoading(false));
  }, [activeLeftTool]);

  // ── Load saved designs for Projects panel ─────────────────────────────────
  useEffect(() => {
    if (activeLeftTool !== 'projects' && activeLeftTool !== 'templates') return;
    if (savedDesigns.length > 0) return;
    setSavedDesignsLoading(true);
    studioAPI.getCreations({ limit: 40 })
      .then(r => setSavedDesigns(r.data?.creations || []))
      .catch(() => {})
      .finally(() => setSavedDesignsLoading(false));
  }, [activeLeftTool]);

  // ── Load curated ItsPosting templates ─────────────────────────────────────
  async function generateTemplateThumbs(templates) {
    // Pre-load fonts so thumbnails match real rendering
    try {
      await Promise.all([
        document.fonts.load('400 20px Inter'),
        document.fonts.load('700 20px Inter'),
        document.fonts.load('900 20px Inter'),
        document.fonts.load('400 20px Georgia'),
        document.fonts.load('700 20px Georgia'),
      ]);
    } catch (_) {}

    for (const tmpl of templates) {
      if (tmpl.thumbnail_url || templateThumbs[tmpl.id]) continue;
      const pageData = tmpl.canvas_json?.pages?.[0];
      if (!pageData) continue;
      try {
        const THUMB_W = 270, THUMB_H = 338; // 4:5, higher res for quality
        const container = document.createElement('div');
        container.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${THUMB_W}px;height:${THUMB_H}px;overflow:hidden`;
        document.body.appendChild(container);
        const stage = new Konva.Stage({ container, width: THUMB_W, height: THUMB_H });
        const layer = new Konva.Layer();
        stage.add(layer);
        const scale = THUMB_W / 1080;
        // Background
        layer.add(new Konva.Rect({ x: 0, y: 0, width: THUMB_W, height: THUMB_H, fill: pageData.bgColor || '#1a1a2e' }));
        for (const el of (pageData.elements || [])) {
          if (el.type === 'text' && el.text) {
            // Map fontWeight (CSS number) → Konva fontStyle ('bold'/'normal')
            const fw = parseInt(el.fontWeight) || 400;
            const isBold = fw >= 600;
            const isItalic = (el.fontStyle || '').includes('italic');
            const konvaFontStyle = isBold && isItalic ? 'bold italic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';
            layer.add(new Konva.Text({
              x: (el.x || 0) * scale, y: (el.y || 0) * scale,
              text: el.text,
              fontSize: Math.max(5, (el.fontSize || 16) * scale),
              fill: el.fill || '#fff',
              width: el.width ? el.width * scale : undefined,
              align: el.align || 'left',
              fontStyle: konvaFontStyle,
              fontFamily: el.fontFamily || 'Inter',
              lineHeight: el.lineHeight || 1.2,
              opacity: el.opacity ?? 1,
            }));
          } else if (el.type === 'rect') {
            layer.add(new Konva.Rect({
              x: (el.x || 0) * scale, y: (el.y || 0) * scale,
              width: (el.width || 100) * scale, height: (el.height || 20) * scale,
              fill: el.fill || 'transparent', opacity: el.opacity ?? 1,
              cornerRadius: (el.cornerRadius || 0) * scale,
              stroke: el.stroke, strokeWidth: el.strokeWidth ? el.strokeWidth * scale : 0,
            }));
          }
        }
        layer.draw();
        const dataUrl = stage.toDataURL({ mimeType: 'image/jpeg', quality: 0.92, pixelRatio: 2 });
        stage.destroy();
        document.body.removeChild(container);
        setTemplateThumbs(prev => ({ ...prev, [tmpl.id]: dataUrl }));
        await new Promise(r => setTimeout(r, 20));
      } catch (_) {}
    }
  }

  // ── Admin: generate permanent thumbnails by rendering each template into the canvas ──
  async function generateAllThumbsFromCanvas() {
    if (thumbGenProgress || !stageRef.current) return;
    const toProcess = curatedTemplates.filter(t => !t.thumbnail_url);
    if (toProcess.length === 0) return;

    // Save current canvas state so we can restore it
    const savedSnapshot = { activePage, pages: JSON.parse(JSON.stringify(pages)) };
    const token = localStorage.getItem('token');

    for (let i = 0; i < toProcess.length; i++) {
      const tmpl = toProcess[i];
      setThumbGenProgress({ current: i + 1, total: toProcess.length, name: tmpl.name });

      // Load template into the main canvas
      const snapData = tmpl.canvas_json || await studioAPI.getTemplate(tmpl.id).then(r => r.data?.template?.canvas_json).catch(() => null);
      if (!snapData) continue;
      restoreSnapshot(snapData);

      // Wait for React to re-render + Konva to draw all elements
      await new Promise(r => setTimeout(r, 700));

      if (!stageRef.current) continue;
      try {
        // Full-resolution screenshot
        const pixelRatio = 1080 / stageRef.current.width();
        const dataUrl = stageRef.current.toDataURL({ mimeType: 'image/jpeg', quality: 0.92, pixelRatio });

        // Save to Cloudinary via backend
        const resp = await fetch(`/api/studio/templates/${tmpl.id}/thumbnail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ dataUrl }),
        });
        const data = await resp.json();
        if (data.url) {
          setCuratedTemplates(prev => prev.map(t => t.id === tmpl.id ? { ...t, thumbnail_url: data.url } : t));
        }
      } catch (_) {}
    }

    // Restore the original canvas
    restoreSnapshot(savedSnapshot);
    setThumbGenProgress(null);
  }

  useEffect(() => {
    if (activeLeftTool !== 'templates') return;
    if (curatedTemplates.length > 0) return;
    setCuratedLoading(true);
    studioAPI.getTemplates({ limit: 60, industry: 'all' })
      .then(r => {
        const templates = r.data?.templates || [];
        setCuratedTemplates(templates);
        generateTemplateThumbs(templates);
      })
      .catch(() => {})
      .finally(() => setCuratedLoading(false));
  }, [activeLeftTool]);

  // ── Load admin status once on mount ───────────────────────────────────────
  useEffect(() => {
    customerAPI.getProfile()
      .then(r => setIsAdmin(!!r.data?.is_admin))
      .catch(() => {});
  }, []);

  // ── Load customer brand profile ────────────────────────────────────────────
  useEffect(() => {
    if (activeLeftTool !== 'brand') return;
    if (brandProfile) return;
    setBrandLoading(true);
    customerAPI.getProfile()
      .then(r => setBrandProfile(r.data || null))
      .catch(() => {})
      .finally(() => setBrandLoading(false));
  }, [activeLeftTool]);

  // ── Load stock photos (Pexels) when Stock tab opens ───────────────────────
  useEffect(() => {
    if (uploadMediaTab !== 'Stock') return;
    if (pexelsPhotos.length > 0 && !stockQuery) return;
    setStockLoading(true);
    const query = stockQuery || 'home services professional';
    studioAPI.searchStockPhotos(query)
      .then(r => setPexelsPhotos(r.data?.photos || []))
      .catch(() => setPexelsPhotos([]))
      .finally(() => setStockLoading(false));
  }, [uploadMediaTab, stockQuery]);

  // ── Load stock photos for Elements > Photos sub-panel ────────────────────
  function loadElemPhotos(query) {
    const q = query !== undefined ? query : (elemPhotosQuery || 'home services professional');
    setElemPhotosLoading(true);
    studioAPI.searchStockPhotos(q)
      .then(r => setElemPhotos(r.data?.photos || []))
      .catch(() => setElemPhotos([]))
      .finally(() => setElemPhotosLoading(false));
  }

  // ── Load stock videos for Elements > Videos sub-panel ────────────────────
  function loadElemVideos(query) {
    const q = query !== undefined ? query : (videoQuery || 'home services professional');
    setVideoLoading(true);
    studioAPI.searchStockVideos(q)
      .then(r => setPexelsVideos(r.data?.videos || []))
      .catch(() => setPexelsVideos([]))
      .finally(() => setVideoLoading(false));
  }

  // ── Load media library (uploads panel) ────────────────────────────────────
  useEffect(() => {
    if (activeLeftTool !== 'uploads' && activeLeftTool !== 'images') return;
    if (uploadItems.length > 0) return;
    setUploadLoading(true);
    Promise.all([
      mediaAPI.list({ limit: 100 }),
      mediaAPI.getQuota(),
    ])
      .then(([itemsRes, quotaRes]) => {
        setUploadItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
        setUploadQuota(quotaRes.data || null);
      })
      .catch(() => {})
      .finally(() => setUploadLoading(false));
  }, [activeLeftTool]);

  // ── Load existing creation ─────────────────────────────────────────────────
  useEffect(() => {
    const id = router.query?.id;
    if (!id) return;
    studioAPI.getCreation(id).then(r => {
      const c = r.data?.creation;
      if (c?.canvas_json) restoreSnapshot(c.canvas_json);
      if (c?.overlay_title) setTitleForSave(c.overlay_title);
    }).catch(() => {});
  }, [router.query?.id]);

  // ── Load canvas size from ?size param (from "Create Design" flow) ───────────
  useEffect(() => {
    const sizeId = router.query?.size;
    if (!sizeId) return;
    const preset = CANVAS_SIZES.find(s => s.id === sizeId);
    if (preset) setCanvasSizeId(preset.id);
  }, [router.query?.size]);

  // ── Load curated template from ?template= param ───────────────────────────
  useEffect(() => {
    const templateId = router.query?.template;
    if (!templateId) { setEditingTemplateId(null); return; }
    setEditingTemplateId(templateId);
    studioAPI.getTemplate(templateId)
      .then(r => {
        if (r.data?.template?.canvas_json) restoreSnapshot(r.data.template.canvas_json);
        if (r.data?.template?.name) setTitleForSave(r.data.template.name);
      })
      .catch(() => {});
  }, [router.query?.template]);

  // ── Add AI-generated image as draggable element (?addImage param) ───────────
  useEffect(() => {
    const rawUrl = router.query?.addImage;
    if (!rawUrl) return;
    const imgUrl = decodeURIComponent(rawUrl);
    const timer = setTimeout(() => {
      const id = `img_${Date.now()}`;
      patchPage({
        elements: [
          ...currentPage.elements,
          {
            id,
            type: 'image',
            src: imgUrl,
            x: 0,
            y: 0,
            width: canvasSize.w,
            height: canvasSize.h,
            rotation: 0,
            opacity: 1,
            blendMode: 'source-over',
            scaleX: 1,
            scaleY: 1,
            filters: { brightness: 0, contrast: 0, saturation: 0 },
          },
        ],
      });
      setSelectedId(id);
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query?.addImage]);

  // ── Autosave to localStorage (2s debounce — prevents data loss) ───────────
  useEffect(() => {
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      try {
        const key = `ip_autosave_${router.query?.id || 'new'}`;
        localStorage.setItem(key, JSON.stringify({ pages, titleForSave, canvasSizeId, ts: Date.now() }));
      } catch {}
    }, 2000);
    return () => clearTimeout(autosaveTimerRef.current);
  }, [pages]);

  // ── Keyboard handler ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (editingTextId) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        pushHistory();
        const toDelete = new Set(selectedIds);
        patchElements(prev => prev.filter(el => !toDelete.has(el.id)));
        clearSelection();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); return; }

      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        if (selectedIds.length > 1) {
          const multi = elements.filter(el => selectedIds.includes(el.id));
          setClipboard(JSON.parse(JSON.stringify(multi)));
        } else {
          const sel = elements.find(el => el.id === selectedId);
          if (sel) setClipboard(JSON.parse(JSON.stringify(sel)));
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboard) {
        e.preventDefault();
        pushHistory();
        const inPlace = e.shiftKey;
        if (Array.isArray(clipboard)) {
          const newEls = clipboard.map(el => ({ ...JSON.parse(JSON.stringify(el)), id: uid(), x: el.x + (inPlace ? 0 : 20), y: el.y + (inPlace ? 0 : 20) }));
          patchElements(prev => [...prev, ...newEls]);
          const newIds = newEls.map(e => e.id);
          setSelectedIds(newIds); setSelectedId(newIds[newIds.length - 1]);
        } else {
          const el = { ...JSON.parse(JSON.stringify(clipboard)), id: uid(), x: clipboard.x + (inPlace ? 0 : 20), y: clipboard.y + (inPlace ? 0 : 20) };
          patchElements(prev => [...prev, el]);
          setSelectedId(el.id);
        }
        return;
      }
      // Paste image from system clipboard when no canvas element is copied
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !clipboard && navigator.clipboard?.read) {
        e.preventDefault();
        navigator.clipboard.read().then(items => {
          for (const item of items) {
            const imgType = item.types.find(tp => tp.startsWith('image/'));
            if (imgType) {
              item.getType(imgType).then(blob => {
                const url = URL.createObjectURL(blob);
                const w = canvasSize.w * 0.7;
                const newEl = { id: uid(), type: 'image', src: url,
                  x: (canvasSize.w - w) / 2, y: (canvasSize.h - w) / 2,
                  width: w, height: w, rotation: 0, opacity: 1, flipH: false, flipV: false, cornerRadius: 0 };
                pushHistory();
                patchElements(prev => [...prev, newEl]);
                setSelectedId(newEl.id);
              });
              break;
            }
          }
        }).catch(() => {});
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        const sel = elements.find(el => el.id === selectedId);
        if (sel) {
          const el = { ...JSON.parse(JSON.stringify(sel)), id: uid(), x: sel.x + 20, y: sel.y + 20 };
          pushHistory();
          patchElements(prev => [...prev, el]);
          setSelectedId(el.id);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey) { e.preventDefault(); groupSelected(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' &&  e.shiftKey) { e.preventDefault(); ungroupSelected(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') { e.preventDefault(); setShowFindReplace(p => !p); return; }
      if (e.altKey && e.key === 'c') { e.preventDefault(); copyStyle(); return; }
      if (e.altKey && e.key === 'v') { e.preventDefault(); pasteStyle(); return; }

      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const selectableIds = elements
          .filter(el => !lockedIds.has(el.id) && !hiddenIds.has(el.id))
          .map(el => el.id);
        if (selectableIds.length) {
          setSelectedIds(selectableIds);
          setSelectedId(selectableIds[selectableIds.length - 1]);
        }
        return;
      }

      if (selectedId && selectedId !== '__bg__') {
        const NUDGE = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft')  { e.preventDefault(); nudge(selectedId, -NUDGE, 0); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); nudge(selectedId,  NUDGE, 0); return; }
        if (e.key === 'ArrowUp')    { e.preventDefault(); nudge(selectedId, 0, -NUDGE); return; }
        if (e.key === 'ArrowDown')  { e.preventDefault(); nudge(selectedId, 0,  NUDGE); return; }
      }

      // Tab — cycle through elements on current page
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        const selectable = elements.filter(el => !lockedIds.has(el.id) && !hiddenIds.has(el.id));
        if (selectable.length === 0) return;
        const idx = selectable.findIndex(el => el.id === selectedId);
        const next = e.shiftKey
          ? (idx <= 0 ? selectable.length - 1 : idx - 1)
          : (idx < 0 || idx >= selectable.length - 1 ? 0 : idx + 1);
        setSelectedId(selectable[next].id);
        setSelectedIds([]);
        return;
      }

      if (e.key === 'Escape') {
        if (previewOpen) { setPreviewOpen(false); return; }
        if (drawMode) { setDrawMode(false); setIsDrawingNow(false); setCurrentDrawEl(null); currentDrawRef.current = null; return; }
        clearSelection();
        setShowShadowPanel(false);
        setShowOutlinePanel(false);
        setShowPositionPanel(false);
        setShowAnimatePanel(false);
        setShowAdjustPanel(false);
        setCtxMenu(null);
        setQuickOpen(false);
        return;
      }

      // Quick actions palette
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        setQuickQuery('');
        setQuickOpen(o => !o);
        return;
      }

      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoomOut(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoomFactor(1); return; }

      // Layer order shortcuts: ] / [ (forward/back), Shift+] / Shift+[ (to front/back)
      if (selectedId && selectedId !== '__bg__') {
        const tag2 = document.activeElement?.tagName;
        if (tag2 !== 'INPUT' && tag2 !== 'TEXTAREA' && tag2 !== 'SELECT') {
          if (e.key === ']' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) bringToFront(selectedId); else bringForward(selectedId);
            return;
          }
          if (e.key === '[' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) sendToBack(selectedId); else sendBackward(selectedId);
            return;
          }
          // Flip: Shift+H / Shift+V
          if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === 'H') { e.preventDefault(); flipH(); return; }
          if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === 'V') { e.preventDefault(); flipV(); return; }
        }
      }

      // Grid toggle
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'g' || e.key === 'G')) {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault(); setShowGrid(o => !o); return;
        }
      }

      // Preview navigation (when preview is open)
      if (previewOpen) {
        if (e.key === 'ArrowRight') { setActivePage(i => Math.min(i + 1, pages.length - 1)); return; }
        if (e.key === 'ArrowLeft')  { setActivePage(i => Math.max(i - 1, 0)); return; }
        return;
      }

      // Tool hotkeys (only when no element focused and no modifier held)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !selectedId) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === 't' || e.key === 'T') { addText(); return; }
        if (e.key === 'r' || e.key === 'R') { addRect(); return; }
        if (e.key === 'c' || e.key === 'C') { addCircle(); return; }
        if (e.key === 'p' || e.key === 'P') { setPreviewOpen(true); return; }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, selectedIds, editingTextId, history, historyIndex, elements, clipboard, zoomFactor, previewOpen]);

  // ── Canvas-only Ctrl+scroll zoom (passive:false so preventDefault works) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left + el.scrollLeft;
      const cursorY = e.clientY - rect.top + el.scrollTop;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      setZoomFactor(prev => {
        const next = Math.max(0.1, Math.min(3, parseFloat((prev * factor).toFixed(3))));
        requestAnimationFrame(() => {
          const ratio = next / prev;
          el.scrollLeft = cursorX * ratio - (e.clientX - rect.left);
          el.scrollTop  = cursorY * ratio - (e.clientY - rect.top);
        });
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Spacebar pan ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !editingTextId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (!spaceDownRef.current) {
          spaceDownRef.current = true;
          if (el) el.style.cursor = 'grab';
        }
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false;
        panOriginRef.current = null;
        if (el) el.style.cursor = '';
      }
    };
    const onMouseDown = (e) => {
      if (!spaceDownRef.current) return;
      e.preventDefault();
      panOriginRef.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
      el.style.cursor = 'grabbing';
    };
    const onMouseMove = (e) => {
      if (!panOriginRef.current) return;
      const dx = e.clientX - panOriginRef.current.x;
      const dy = e.clientY - panOriginRef.current.y;
      el.scrollLeft = panOriginRef.current.scrollLeft - dx;
      el.scrollTop  = panOriginRef.current.scrollTop  - dy;
    };
    const onMouseUp = () => {
      if (panOriginRef.current) {
        panOriginRef.current = null;
        if (spaceDownRef.current && el) el.style.cursor = 'grab';
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    if (el) {
      el.addEventListener('mousedown', onMouseDown);
      el.addEventListener('mousemove', onMouseMove);
      el.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (el) {
        el.removeEventListener('mousedown', onMouseDown);
        el.removeEventListener('mousemove', onMouseMove);
        el.removeEventListener('mouseup', onMouseUp);
      }
    };
  }, [editingTextId]);

  // ── Floating bar — update on selection + scroll ────────────────────────────
  useEffect(() => { updateFloatingBar(); }, [updateFloatingBar]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateFloatingBar);
    return () => el.removeEventListener('scroll', updateFloatingBar);
  }, [updateFloatingBar]);

  // ── Preview capture ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!previewOpen || !stageRef.current) return;
    setPreviewUrl(null);
    const timer = setTimeout(() => {
      if (!stageRef.current) return;
      setSelectedId(null); setSelectedIds([]);
      if (trLayerRef.current) trLayerRef.current.hide();
      requestAnimationFrame(() => {
        if (!stageRef.current) return;
        const pixelRatio = canvasSize.w / stageRef.current.width();
        const url = stageRef.current.toDataURL({ mimeType: 'image/png', quality: 1, pixelRatio });
        if (trLayerRef.current) trLayerRef.current.show();
        setPreviewUrl(url);
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [previewOpen, activePage]);

  // ── Presentation auto-play ─────────────────────────────────────────────────
  useEffect(() => {
    if (!presentPlaying || !previewOpen || pages.length < 2) return;
    const id = setInterval(() => {
      setActivePage(p => {
        const next = p + 1;
        if (next >= pages.length) { setPresentPlaying(false); return p; }
        return next;
      });
    }, presentInterval * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentPlaying, previewOpen, presentInterval, pages.length]);

  // ── History helpers ────────────────────────────────────────────────────────
  function snapshot() {
    return { pages: JSON.parse(JSON.stringify(pages)), activePage };
  }

  function pushHistory() {
    const snap = snapshot();
    setHistory(prev => [...prev.slice(0, historyIndex + 1), snap].slice(-50));
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }

  function restoreSnapshot(snap) {
    if (!snap) return;
    if (snap.pages) {
      // New multi-page format
      setPages(snap.pages);
      setActivePage(snap.activePage ?? 0);
    } else {
      // Legacy single-page format (old saves)
      setPages([{
        ...emptyPage(),
        elements:      snap.elements      || [],
        bgType:        snap.bgType        || 'color',
        bgColor:       snap.bgColor       || '#1a1a22',
        bgImageUrl:    snap.bgImageUrl    ?? null,
        bgSource:      snap.bgSource      ?? null,
        bgSourceId:    snap.bgSourceId    ?? null,
        bgFilter:      snap.bgFilter      || 'normal',
        bgBrightness:  snap.bgBrightness  ?? 0,
        bgContrast:    snap.bgContrast    ?? 0,
        bgSaturation:  snap.bgSaturation  ?? 0,
        lockedIds:     snap.lockedIds     || [],
        hiddenIds:     snap.hiddenIds     || [],
      }]);
      setActivePage(0);
    }
    setSelectedId(null);
  }

  function undo() {
    if (historyIndex < 0) return;
    restoreSnapshot(history[historyIndex]);
    setHistoryIndex(prev => prev - 1);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    restoreSnapshot(history[historyIndex + 1]);
    setHistoryIndex(prev => prev + 1);
  }

  // ── Element helpers ────────────────────────────────────────────────────────
  const uid = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  function addText(overrides = {}) {
    pushHistory();
    const el = {
      id: uid(), type: 'text',
      x: canvasSize.w / 2 - 200, y: canvasSize.h / 2 - 30,
      text: 'Double-click to edit',
      fontSize: 48, fontFamily: 'Inter', fontStyle: 'bold',
      fill: '#ffffff', width: 400, align: 'center', opacity: 1,
      ...overrides,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addTextCombo(lines) {
    pushHistory();
    const cy = canvasSize.h / 2;
    const newEls = lines.map(line => ({
      id: uid(), type: 'text',
      x: canvasSize.w / 2 - (line.width || 540) / 2,
      y: cy + (line.yOff || 0) - 60,
      text: line.text,
      fontSize: line.fontSize || 36,
      fontFamily: line.fontFamily || 'Inter',
      fontStyle: line.fontStyle || 'normal',
      fill: line.fill || '#ffffff',
      width: line.width || 540,
      align: line.align || 'center',
      opacity: 1,
      lineHeight: line.lineHeight || 1.2,
      letterSpacing: line.letterSpacing || 0,
    }));
    patchElements(prev => [...prev, ...newEls]);
    setSelectedId(newEls[newEls.length - 1].id);
  }

  function addRect(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'rect', x: canvasSize.w / 2 - 100, y: canvasSize.h / 2 - 50, width: 200, height: 100, fill: 'rgba(255,255,255,0.15)', cornerRadius: 12, opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addCircle(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'circle', x: canvasSize.w / 2, y: canvasSize.h / 2, radius: 80, fill: 'rgba(255,255,255,0.15)', opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addLine(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'line', x: canvasSize.w / 2 - 150, y: canvasSize.h / 2, points: [0, 0, 300, 0], stroke: '#ffffff', strokeWidth: 4, opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addTriangle(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'triangle', x: canvasSize.w / 2, y: canvasSize.h / 2, radius: 80, fill: 'rgba(255,255,255,0.15)', opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addStar(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'star', x: canvasSize.w / 2, y: canvasSize.h / 2, outerRadius: 80, innerRadius: 35, fill: 'rgba(255,255,255,0.15)', opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addArrow(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'arrow', x: canvasSize.w / 2 - 100, y: canvasSize.h / 2, width: 200, fill: '#ffffff', strokeWidth: 4, opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addSmartShape(kind) {
    pushHistory();
    const el = { id: uid(), type: 'shape', shapeKind: kind, x: canvasSize.w / 2 - 80, y: canvasSize.h / 2 - 60, width: 160, height: 120, fill: 'rgba(255,255,255,0.15)', opacity: 1 };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addCoupon() {
    pushHistory();
    const el = {
      id: uid(), type: 'coupon',
      x: canvasSize.w / 2 - 170, y: canvasSize.h / 2 - 70,
      width: 340, height: 140, opacity: 1,
      fill: '#7C5CFC', couponCode: 'SAVE20', couponHeadline: '20% OFF',
      couponSubline: 'Your next purchase', couponExpiry: 'Expires 31 Dec',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addGradientText() {
    pushHistory();
    const el = {
      id: uid(), type: 'gradtext',
      x: canvasSize.w / 2 - 200, y: canvasSize.h / 2 - 40,
      width: 400, height: 80, opacity: 1,
      text: 'Gradient Text', fontSize: 52, fontStyle: 'bold',
      fontFamily: 'Inter, sans-serif', textAlign: 'center',
      gradColor1: TEAL, gradColor2: '#7C5CFC',
      gradDirection: 'horizontal',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addNeonText() {
    pushHistory();
    const el = {
      id: uid(), type: 'neontext',
      x: canvasSize.w / 2 - 200, y: canvasSize.h / 2 - 45,
      width: 400, height: 90, opacity: 1,
      text: 'NEON', fontSize: 60, fontStyle: 'bold',
      fontFamily: 'Inter, sans-serif',
      glowColor: TEAL, glowIntensity: 18,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addHighlight() {
    pushHistory();
    const el = {
      id: uid(), type: 'highlight',
      x: canvasSize.w / 2 - 190, y: canvasSize.h / 2 - 35,
      width: 380, height: 70, opacity: 1,
      text: 'Highlighted Text', fontSize: 42, fontStyle: 'bold',
      fontFamily: 'Inter, sans-serif',
      fill: '#FFE135', stroke: '#1a1a22',
      highlightStyle: 'full',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addComparison() {
    pushHistory();
    const el = {
      id: uid(), type: 'comparison',
      x: canvasSize.w / 2 - 200, y: canvasSize.h / 2 - 170,
      width: 400, height: 340, opacity: 1,
      bgColor: '#1a1a2e', fill: '#ffffff',
      col1Color: '#ef4444', col2Color: TEAL,
      col1Label: 'Others', col2Label: 'Us',
      cpRows: [
        { col1: '✗ Generic advice',  col2: '✓ Industry expertise' },
        { col1: '✗ Slow response',   col2: '✓ Same-day service'   },
        { col1: '✗ Hidden costs',    col2: '✓ Upfront pricing'    },
      ],
      cornerRadius: 14,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addWatermark() {
    pushHistory();
    const el = {
      id: uid(), type: 'watermark',
      x: canvasSize.w - 220, y: canvasSize.h - 80,
      width: 200, height: 60, opacity: 1,
      wmLogo: 'YourBrand', wmTagline: 'itsposting.com',
      wmStyle: 'pill',
      bgColor: 'rgba(0,0,0,0.55)', fill: '#ffffff', accentColor: t.primary,
      fontSize: 22,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addHTimeline() {
    pushHistory();
    const el = {
      id: uid(), type: 'htimeline',
      x: canvasSize.w / 2 - 240, y: canvasSize.h / 2 - 90,
      width: 480, height: 180, opacity: 1,
      accentColor: t.primary, fill: '#ffffff', bgColor: 'transparent',
      tlSteps: ['Contact Us', 'Get Quote', 'We Work', 'Done!'],
      tlDotStyle: 'filled', tlLineStyle: 'solid', cornerRadius: 10,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addPriceTag() {
    pushHistory();
    const el = {
      id: uid(), type: 'pricetag',
      x: canvasSize.w / 2 - 130, y: canvasSize.h / 2 - 160,
      width: 260, height: 320, opacity: 1,
      bgColor: '#1a1a2e', accentColor: t.primary, fill: '#ffffff',
      ptCurrency: '$', ptPrice: '29', ptPeriod: '/mo',
      ptLabel: 'Pro Plan',
      ptFeatures: ['Unlimited posts', 'Priority support', 'Analytics'],
      fontSize: 52, cornerRadius: 14,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addIconShape(opts = {}) {
    pushHistory();
    const el = {
      id: uid(), type: 'iconshape',
      x: canvasSize.w / 2 - 60, y: canvasSize.h / 2 - 60,
      width: 120, height: 120, opacity: 1,
      iconKind: opts.iconKind || 'check', iconBgShape: opts.iconBgShape || 'circle',
      fill: '#ffffff', iconBgColor: 'rgba(0,196,204,0.25)',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addCounter() {
    pushHistory();
    const el = {
      id: uid(), type: 'counter',
      x: canvasSize.w / 2 - 100, y: canvasSize.h / 2 - 80,
      width: 200, height: 160, opacity: 1,
      counterValue: 1234, counterPrefix: '', counterSuffix: '+',
      counterLabel: 'Customers Served',
      counterStyle: 'card',
      fill: '#ffffff', bgColor: 'rgba(0,196,204,0.15)', accentColor: t.primary,
      fontSize: 52, cornerRadius: 12,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addGradRect() {
    pushHistory();
    const el = {
      id: uid(), type: 'gradrect',
      x: canvasSize.w / 2 - 160, y: canvasSize.h / 2 - 100,
      width: 320, height: 200, opacity: 1,
      gradStops: [{ pos: 0, color: '#7C5CFC' }, { pos: 1, color: TEAL }],
      gradDir: 'horizontal', cornerRadius: 0,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addBeforeAfter() {
    pushHistory();
    const el = {
      id: uid(), type: 'beforeafter',
      x: canvasSize.w / 2 - 170, y: canvasSize.h / 2 - 100,
      width: 340, height: 200, opacity: 1,
      fill: '#6b7280', baRightColor: '#22c55e',
      baLeftLabel: 'BEFORE', baRightLabel: 'AFTER',
      baDividerColor: '#ffffff', cornerRadius: 10,
      baLabelStyle: 'pill',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addTestimonial() {
    pushHistory();
    const el = {
      id: uid(), type: 'testimonial',
      x: canvasSize.w / 2 - 160, y: canvasSize.h / 2 - 90,
      width: 320, height: 180, opacity: 1,
      fill: 'rgba(255,255,255,0.1)', accentColor: t.primary,
      stroke: '#ffffff', cornerRadius: 14,
      reviewerName: 'John Smith', reviewerRole: 'Homeowner',
      reviewText: '"Absolutely fantastic work! Would recommend to anyone."',
      starRating: 5,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addGlassPane() {
    pushHistory();
    const el = {
      id: uid(), type: 'glasspane',
      x: canvasSize.w / 2 - 150, y: canvasSize.h / 2 - 80,
      width: 300, height: 160, opacity: 1,
      fill: 'rgba(255,255,255,0.18)', glassBorder: 'rgba(255,255,255,0.35)',
      stroke: '#ffffff', cornerRadius: 16, noiseAmount: 0.06, glassText: '',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addQrCode() {
    pushHistory();
    const el = {
      id: uid(), type: 'qrcode',
      x: canvasSize.w / 2 - 80, y: canvasSize.h / 2 - 80,
      width: 160, height: 160, opacity: 1,
      fill: '#1a1a22', qrBg: '#ffffff',
      qrLabel: 'Scan me', showQrLabel: true,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addPattern() {
    pushHistory();
    const el = {
      id: uid(), type: 'pattern',
      x: canvasSize.w / 2 - 150, y: canvasSize.h / 2 - 100,
      width: 300, height: 200, opacity: 1,
      fill: 'rgba(255,255,255,0.15)', patternBg: 'transparent',
      patternType: 'dots', tileSize: 20, patternLineW: 1.5,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addStepList() {
    pushHistory();
    const el = {
      id: uid(), type: 'steplist',
      x: canvasSize.w / 2 - 140, y: canvasSize.h / 2 - 90,
      width: 280, height: 180, opacity: 1,
      fill: TEAL, stroke: '#ffffff',
      steps: ['Call us today', 'We come to you', 'Job done right'],
      stepStyle: 'numbered',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addRibbon() {
    pushHistory();
    const el = {
      id: uid(), type: 'ribbon',
      x: canvasSize.w / 2 - 140, y: canvasSize.h / 2 - 32,
      width: 280, height: 64, opacity: 1,
      fill: '#ef4444', stroke: '#ffffff',
      ribbonText: 'SPECIAL OFFER', ribbonSub: '',
      ribbonStyle: 'fold',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addSpeechBubble() {
    pushHistory();
    const el = {
      id: uid(), type: 'speechbubble',
      x: canvasSize.w / 2 - 130, y: canvasSize.h / 2 - 60,
      width: 260, height: 120, opacity: 1,
      fill: '#ffffff', stroke: '#1a1a22',
      bubbleText: '"Great service!"',
      bubbleTail: 'bottom-left', cornerRadius: 16,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addMapPin() {
    pushHistory();
    const el = {
      id: uid(), type: 'mappin',
      x: canvasSize.w / 2 - 80, y: canvasSize.h / 2 - 90,
      width: 160, height: 180, opacity: 1,
      fill: '#ef4444', stroke: '#ffffff',
      labelText: '📍 Location', subText: 'Your City',
      pinStyle: 'pin',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addPolaroid() {
    pushHistory();
    const el = {
      id: uid(), type: 'polaroid',
      x: canvasSize.w / 2 - 100, y: canvasSize.h / 2 - 115,
      width: 200, height: 230, opacity: 1,
      fill: '#ffffff', captionText: 'Caption here',
      captionColor: '#333333', photoColor: 'rgba(100,120,160,0.35)',
      shadowBlur: 18,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addSticker(emoji = '🔥') {
    pushHistory();
    const el = {
      id: uid(), type: 'sticker',
      x: canvasSize.w / 2 - 50, y: canvasSize.h / 2 - 50,
      width: 100, height: 100, opacity: 1,
      emoji, stickerBg: 'none', fill: 'rgba(255,255,255,0.15)',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addGridLayout(layoutId) {
    pushHistory();
    const cx = canvasSize.w / 2;
    const cy = canvasSize.h / 2;
    const GAP = 10;
    const layout = GRID_LAYOUTS.find(l => l.id === layoutId);
    if (!layout) return;
    const totalW = Math.min(canvasSize.w * 0.85, 700);
    const tallRatio = layout.tallRatio;
    const cellW = (totalW - GAP * (layout.cols - 1)) / layout.cols;
    const cellH = tallRatio ? cellW * 1.4 : cellW * (layout.rows === 1 ? 0.65 : 1);
    const totalH = cellH * layout.rows + GAP * (layout.rows - 1);
    const startX = cx - totalW / 2;
    const startY = cy - totalH / 2;
    const newEls = [];
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        newEls.push({
          id: uid(), type: 'rect',
          x: startX + c * (cellW + GAP),
          y: startY + r * (cellH + GAP),
          width: cellW, height: cellH,
          fill: 'rgba(255,255,255,0.06)',
          stroke: 'rgba(255,255,255,0.35)',
          strokeWidth: 1.5, dash: [10, 6],
          cornerRadius: 10, opacity: 1,
        });
      }
    }
    patchElements(prev => [...prev, ...newEls]);
    setSelectedId(newEls[0].id);
  }

  function addBackground(fill) {
    pushHistory();
    const el = { id: uid(), type: 'rect', x: 0, y: 0, width: canvasSize.w, height: canvasSize.h, fill, cornerRadius: 0, opacity: 1 };
    patchElements(prev => [el, ...prev]);
    setSelectedId(el.id);
  }

  function addGradientBackground(c1, c2, angle) {
    pushHistory();
    const el = { id: uid(), type: 'rect', x: 0, y: 0, width: canvasSize.w, height: canvasSize.h, fill: c1, fillType: 'gradient', fillGradient: { c1, c2, angle: angle ?? 135 }, cornerRadius: 0, opacity: 1 };
    patchElements(prev => [el, ...prev]);
    setSelectedId(el.id);
  }

  function addCallout() {
    pushHistory();
    const el = {
      id: uid(), type: 'callout',
      x: canvasSize.w / 2 - 150, y: canvasSize.h / 2 - 50,
      width: 300, height: 100, opacity: 1,
      fill: '#f59e0b', calloutStyle: 'side',
      calloutIcon: '💡', calloutHeading: 'Pro Tip',
      calloutBody: 'Here is something useful you should know.',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addSocialStats() {
    pushHistory();
    const el = {
      id: uid(), type: 'socialstats',
      x: canvasSize.w / 2 - 150, y: canvasSize.h / 2 - 40,
      width: 300, height: 80, opacity: 1,
      fill: TEAL,
      stats: [
        { icon: '👥', value: '2.4K', label: 'Followers' },
        { icon: '❤', value: '18K', label: 'Likes' },
        { icon: '📸', value: '342', label: 'Posts' },
      ],
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addDivider() {
    pushHistory();
    const el = {
      id: uid(), type: 'divider',
      x: canvasSize.w / 2 - 140, y: canvasSize.h / 2 - 12,
      width: 280, height: 24, opacity: 1,
      fill: 'rgba(255,255,255,0.5)', dividerStyle: 'gradient', strokeWidth: 2,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addBadge(preset = 'sale') {
    pushHistory();
    const presets = {
      sale:    { badgeLine1: 'SALE', badgeLine2: '50% OFF', badgeLine3: 'TODAY ONLY', fill: '#ef4444' },
      new:     { badgeLine1: 'NEW', badgeLine2: 'ARRIVAL', badgeLine3: '', fill: '#7C5CFC' },
      limited: { badgeLine1: 'LIMITED', badgeLine2: 'TIME', badgeLine3: 'OFFER', fill: '#f59e0b' },
      free:    { badgeLine1: 'FREE', badgeLine2: 'QUOTE', badgeLine3: 'TODAY', fill: '#22c55e' },
    };
    const p = presets[preset] || presets.sale;
    const el = {
      id: uid(), type: 'badge',
      x: canvasSize.w / 2 - 70, y: canvasSize.h / 2 - 70,
      width: 140, height: 140, opacity: 1,
      badgeShape: 'burst', ...p,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addQuote() {
    pushHistory();
    const el = {
      id: uid(), type: 'quote',
      x: canvasSize.w / 2 - 150, y: canvasSize.h / 2 - 80,
      width: 300, height: 160, opacity: 1,
      fill: TEAL, quoteStyle: 'block',
      quoteText: '"Great service, highly recommend!"',
      attribution: '— Happy Customer',
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addRating() {
    pushHistory();
    const el = {
      id: uid(), type: 'rating',
      x: canvasSize.w / 2 - 100, y: canvasSize.h / 2 - 20,
      width: 200, height: 40, opacity: 1,
      fill: '#f59e0b', rating: 4.5, maxStars: 5, showLabel: true,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addCountdown() {
    pushHistory();
    const target = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]; // 7 days from now
    const el = {
      id: uid(), type: 'countdown',
      x: canvasSize.w / 2 - 150, y: canvasSize.h / 2 - 45,
      width: 300, height: 90, opacity: 1,
      fill: TEAL, targetDate: target,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addTable() {
    pushHistory();
    const el = {
      id: uid(), type: 'table',
      x: canvasSize.w / 2 - 140, y: canvasSize.h / 2 - 80,
      width: 280, height: 160, opacity: 1,
      tableRows: 4, tableCols: 3,
      headerColor: TEAL,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addChart(chartType = 'bar') {
    pushHistory();
    const el = {
      id: uid(), type: 'chart', chartType,
      x: canvasSize.w / 2 - 120, y: canvasSize.h / 2 - 80,
      width: 240, height: 160, opacity: 1,
      chartData: [
        { label: 'A', value: 40, color: TEAL },
        { label: 'B', value: 65, color: '#7C5CFC' },
        { label: 'C', value: 25, color: '#f59e0b' },
      ],
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addProgressBar() {
    pushHistory();
    const el = { id: uid(), type: 'progressbar', x: canvasSize.w / 2 - 140, y: canvasSize.h / 2 - 7, width: 280, height: 14, fill: TEAL, trackColor: 'rgba(255,255,255,0.2)', progress: 75, cornerRadius: 7, opacity: 1 };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function setElementAsBackground(el) {
    if (!el || el.type !== 'image') return;
    pushHistory();
    patchPage({ bgType: 'image', bgImageUrl: el.src, bgSource: 'upload' });
    patchElements(prev => prev.filter(e => e.id !== el.id));
    setSelectedId(null);
  }

  function addImageElement(url) {
    const w = canvasSize.w * 0.6;
    const h = w;
    pushHistory();
    const el = {
      id: uid(), type: 'image', src: url,
      x: (canvasSize.w - w) / 2, y: (canvasSize.h - h) / 2,
      width: w, height: h, rotation: 0,
      opacity: 1, flipH: false, flipV: false, cornerRadius: 0,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  // Apply Claude-returned mask polygon to image using Canvas 2D — returns transparent PNG data URL
  async function applyRemoveBgMask(element, maskData) {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = element.src;
    });
    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = W; srcCanvas.height = H;
    srcCanvas.getContext('2d').drawImage(img, 0, 0);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = W; outCanvas.height = H;
    const ctx = outCanvas.getContext('2d');
    ctx.drawImage(srcCanvas, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    const polygon = maskData.maskPolygon;
    if (polygon && polygon.length >= 3) {
      const pts = polygon.map(p => ({ x: (p.xPercent / 100) * W, y: (p.yPercent / 100) * H }));
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
    } else {
      const bb = maskData.subject?.boundingBox || { xPercent: 0, yPercent: 0, widthPercent: 100, heightPercent: 100 };
      ctx.rect((bb.xPercent / 100) * W, (bb.yPercent / 100) * H, (bb.widthPercent / 100) * W, (bb.heightPercent / 100) * H);
    }
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    return outCanvas.toDataURL('image/png');
  }

  // Crop a bounding-box region from an image URL — returns data URL for that crop
  async function cropImageRegion(imgSrc, boundingBox) {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    // Cache-bust so the browser re-fetches with CORS headers if the image was previously cached without them
    const src = imgSrc.includes('?') ? `${imgSrc}&_cors=1` : `${imgSrc}?_cors=1`;
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = src; });
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (!natW || !natH) throw new Error('Image has zero dimensions');
    // Clamp all bounding-box values to valid range (backend already clamps, but be defensive)
    const xPct = Math.max(0, Math.min(99,  boundingBox.xPercent      || 0));
    const yPct = Math.max(0, Math.min(99,  boundingBox.yPercent      || 0));
    const wPct = Math.max(1, Math.min(100 - xPct, boundingBox.widthPercent  || 100));
    const hPct = Math.max(1, Math.min(100 - yPct, boundingBox.heightPercent || 100));
    const cropX = Math.round(xPct / 100 * natW);
    const cropY = Math.round(yPct / 100 * natH);
    const cropW = Math.max(8, Math.min(natW - cropX, Math.round(wPct / 100 * natW)));
    const cropH = Math.max(8, Math.min(natH - cropY, Math.round(hPct / 100 * natH)));
    const canvas = document.createElement('canvas');
    canvas.width = cropW; canvas.height = cropH;
    canvas.getContext('2d').drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return canvas.toDataURL('image/png');
  }

  function handleCanvasDrop(e) {
    e.preventDefault();
    const rect = (e.currentTarget || canvasWrapperRef.current)?.getBoundingClientRect();
    if (!rect) return;
    const canvasX = (e.clientX - rect.left) / stageScale;
    const canvasY = (e.clientY - rect.top)  / stageScale;

    // Helper: place image src at drop point
    const placeImage = (src) => {
      const hit = [...elements].reverse().find(el => {
        if (el.type !== 'image') return false;
        return canvasX >= el.x && canvasX <= el.x + (el.width || 200) &&
               canvasY >= el.y && canvasY <= el.y + (el.height || 200);
      });
      pushHistory();
      if (hit) {
        patchElements(prev => prev.map(el => el.id === hit.id ? { ...el, src } : el));
        setSelectedId(hit.id);
      } else {
        const w = canvasSize.w * 0.5;
        const newEl = { id: uid(), type: 'image', src,
          x: canvasX - w / 2, y: canvasY - w / 2,
          width: w, height: w, rotation: 0, opacity: 1, flipH: false, flipV: false, cornerRadius: 0 };
        patchElements(prev => [...prev, newEl]);
        setSelectedId(newEl.id);
      }
    };

    // Handle files dragged from desktop
    const files = Array.from(e.dataTransfer.files || []);
    const imgFile = files.find(f => f.type.startsWith('image/'));
    if (imgFile) {
      const url = URL.createObjectURL(imgFile);
      placeImage(url);
      return;
    }

    // Handle URL drop from browser or upload panel
    const rawUrl = (e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list') || '').trim();
    if (rawUrl && (rawUrl.startsWith('http') || rawUrl.startsWith('blob:'))) {
      placeImage(rawUrl);
      return;
    }

    // Handle HTML image src (dragging <img> from another page)
    const html = e.dataTransfer.getData('text/html');
    if (html) {
      const m = html.match(/src="([^"]+)"/);
      if (m && m[1]) { placeImage(m[1]); return; }
    }
  }

  function updateElement(updated) {
    patchElements(prev => prev.map(el => el.id === updated.id ? updated : el));
    if (updated.id === selectedId) requestAnimationFrame(updateFloatingBar);
  }

  function handleElementChange(updated) {
    pushHistory();
    updateElement(updated);
  }

  // ── Nudge ──────────────────────────────────────────────────────────────────
  function nudge(id, dx, dy) {
    pushHistory();
    patchElements(prev => prev.map(el => el.id === id ? { ...el, x: el.x + dx, y: el.y + dy } : el));
  }

  function alignEl(id, direction) {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const isCenterOrigin = ['circle', 'triangle', 'star'].includes(el.type);
    const elW = el.width || (el.radius ? el.radius * 2 : 100);
    const elH = el.height || (el.radius ? el.radius * 2 : 100);
    const cW = canvasSize.w, cH = canvasSize.h;
    let patch = {};
    if (direction === 'centerH') patch = { x: isCenterOrigin ? cW / 2 : cW / 2 - elW / 2 };
    if (direction === 'centerV') patch = { y: isCenterOrigin ? cH / 2 : cH / 2 - elH / 2 };
    if (direction === 'left')    patch = { x: isCenterOrigin ? elW / 2 : 0 };
    if (direction === 'right')   patch = { x: isCenterOrigin ? cW - elW / 2 : cW - elW };
    if (direction === 'top')     patch = { y: isCenterOrigin ? elH / 2 : 0 };
    if (direction === 'bottom')  patch = { y: isCenterOrigin ? cH - elH / 2 : cH - elH };
    pushHistory();
    patchElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  // ── Distribute ────────────────────────────────────────────────────────────
  function distributeH() {
    if (selectedIds.length < 3) return;
    const els = selectedIds.map(id => elements.find(e => e.id === id)).filter(Boolean);
    const getL = e => ['circle','triangle','star'].includes(e.type) ? e.x - (e.radius||e.outerRadius||60) : e.x;
    const getW = e => ['circle','triangle','star'].includes(e.type) ? (e.radius||e.outerRadius||60)*2 : (e.width||100);
    const sorted = [...els].sort((a, b) => getL(a) - getL(b));
    const span  = (getL(sorted[sorted.length - 1]) + getW(sorted[sorted.length - 1])) - getL(sorted[0]);
    const total = sorted.reduce((s, e) => s + getW(e), 0);
    const gap   = (span - total) / (sorted.length - 1);
    const updates = new Map();
    let cursor = getL(sorted[0]);
    for (const e of sorted) {
      const isCO = ['circle','triangle','star'].includes(e.type);
      const r = e.radius || e.outerRadius || 60;
      updates.set(e.id, { ...e, x: isCO ? cursor + r : cursor });
      cursor += getW(e) + gap;
    }
    pushHistory();
    patchElements(prev => prev.map(e => updates.has(e.id) ? updates.get(e.id) : e));
  }

  function distributeV() {
    if (selectedIds.length < 3) return;
    const els = selectedIds.map(id => elements.find(e => e.id === id)).filter(Boolean);
    const getT = e => ['circle','triangle','star'].includes(e.type) ? e.y - (e.radius||e.outerRadius||60) : e.y;
    const getH = e => ['circle','triangle','star'].includes(e.type) ? (e.radius||e.outerRadius||60)*2 : (e.height||60);
    const sorted = [...els].sort((a, b) => getT(a) - getT(b));
    const span  = (getT(sorted[sorted.length - 1]) + getH(sorted[sorted.length - 1])) - getT(sorted[0]);
    const total = sorted.reduce((s, e) => s + getH(e), 0);
    const gap   = (span - total) / (sorted.length - 1);
    const updates = new Map();
    let cursor = getT(sorted[0]);
    for (const e of sorted) {
      const isCO = ['circle','triangle','star'].includes(e.type);
      const r = e.radius || e.outerRadius || 60;
      updates.set(e.id, { ...e, y: isCO ? cursor + r : cursor });
      cursor += getH(e) + gap;
    }
    pushHistory();
    patchElements(prev => prev.map(e => updates.has(e.id) ? updates.get(e.id) : e));
  }

  // ── Copy / Paste style ────────────────────────────────────────────────────
  const STYLE_TEXT_KEYS  = ['fontSize','fontFamily','fontStyle','textDecoration','textTransform','align','verticalAlign','letterSpacing','lineHeight'];
  const STYLE_SHAPE_KEYS = ['stroke','strokeWidth','strokeStyle','cornerRadius','borderStyle'];
  const STYLE_COMMON_KEYS = ['opacity','fill','shadow'];

  function copyStyle() {
    const el = elements.find(e => e.id === selectedId);
    if (!el) return;
    const s = { _type: el.type };
    [...STYLE_COMMON_KEYS, ...STYLE_TEXT_KEYS, ...STYLE_SHAPE_KEYS].forEach(k => {
      if (el[k] != null) s[k] = el[k];
    });
    setStyleClipboard(s);
  }

  function pasteStyle(targetId) {
    const id = targetId || selectedId;
    const target = elements.find(e => e.id === id);
    if (!styleClipboard || !target) return;
    const { _type, ...props } = styleClipboard;
    const textSet  = new Set(STYLE_TEXT_KEYS);
    const shapeSet = new Set(STYLE_SHAPE_KEYS);
    const patch = {};
    for (const [k, v] of Object.entries(props)) {
      if (textSet.has(k)  && target.type !== 'text') continue;
      if (shapeSet.has(k) && target.type === 'text') continue;
      patch[k] = v;
    }
    pushHistory();
    patchElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  function pasteStyleToAll() {
    if (!styleClipboard || selectedIds.length < 2) return;
    const { _type, ...props } = styleClipboard;
    const textSet  = new Set(STYLE_TEXT_KEYS);
    const shapeSet = new Set(STYLE_SHAPE_KEYS);
    pushHistory();
    patchElements(prev => prev.map(e => {
      if (!selectedIds.includes(e.id)) return e;
      const patch = {};
      for (const [k, v] of Object.entries(props)) {
        if (textSet.has(k)  && e.type !== 'text') continue;
        if (shapeSet.has(k) && e.type === 'text') continue;
        patch[k] = v;
      }
      return { ...e, ...patch };
    }));
  }

  // ── Find & Replace ────────────────────────────────────────────────────────
  function findReplaceAll(find, replace) {
    if (!find) return;
    const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let count = 0;
    setPages(prev => prev.map(page => ({
      ...page,
      elements: page.elements.map(el => {
        if (el.type !== 'text' || !el.text) return el;
        const updated = el.text.replace(re, () => { count++; return replace; });
        return updated !== el.text ? { ...el, text: updated } : el;
      }),
    })));
    setFrMatchCount(count);
    return count;
  }

  // ── Flip ──────────────────────────────────────────────────────────────────
  function flipH() {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'image') return;
    pushHistory();
    patchElements(prev => prev.map(e => e.id === el.id ? { ...e, flipH: !e.flipH } : e));
  }

  function flipV() {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'image') return;
    pushHistory();
    patchElements(prev => prev.map(e => e.id === el.id ? { ...e, flipV: !e.flipV } : e));
  }

  function fitToPage() {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'image') return;
    pushHistory();
    const elW = el.width || 200; const elH = el.height || 200;
    const scale = Math.min(canvasSize.w / elW, canvasSize.h / elH);
    const nw = elW * scale; const nh = elH * scale;
    updateElement({ ...el, x: (canvasSize.w - nw) / 2, y: (canvasSize.h - nh) / 2, width: nw, height: nh });
  }

  function fillPage() {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'image') return;
    pushHistory();
    const elW = el.width || 200; const elH = el.height || 200;
    const scale = Math.max(canvasSize.w / elW, canvasSize.h / elH);
    const nw = elW * scale; const nh = elH * scale;
    updateElement({ ...el, x: (canvasSize.w - nw) / 2, y: (canvasSize.h - nh) / 2, width: nw, height: nh });
  }

  // ── Floating element toolbar position ─────────────────────────────────────
  const updateFloatingBar = useCallback(() => {
    if (!selectedId || !stageRef.current) { setFloatingBar(null); return; }
    requestAnimationFrame(() => {
      if (!stageRef.current) return;
      const node = stageRef.current.findOne('#' + selectedId);
      if (!node) { setFloatingBar(null); return; }
      const rect = node.getClientRect({ relativeTo: stageRef.current });
      const canvasRect = stageRef.current.container().getBoundingClientRect();
      setFloatingBar({ left: canvasRect.left + rect.x, top: canvasRect.top + rect.y, width: rect.width, height: rect.height });
    });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Layer order ────────────────────────────────────────────────────────────
  function bringForward(id) {
    const tid = id || selectedId; if (!tid) return;
    pushHistory();
    patchElements(prev => {
      const idx = prev.findIndex(e => e.id === tid);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function sendBackward(id) {
    const tid = id || selectedId; if (!tid) return;
    pushHistory();
    patchElements(prev => {
      const idx = prev.findIndex(e => e.id === tid);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return next;
    });
  }

  function bringToFront(id) {
    const tid = id || selectedId; if (!tid) return;
    pushHistory();
    patchElements(prev => { const el = prev.find(e => e.id === tid); return el ? [...prev.filter(e => e.id !== tid), el] : prev; });
  }

  function sendToBack(id) {
    const tid = id || selectedId; if (!tid) return;
    pushHistory();
    patchElements(prev => { const el = prev.find(e => e.id === tid); return el ? [el, ...prev.filter(e => e.id !== tid)] : prev; });
  }

  // ── Lock / Hidden ──────────────────────────────────────────────────────────
  function toggleLocked(id) {
    setPages(prev => prev.map((p, i) => {
      if (i !== activePage) return p;
      const has = p.lockedIds.includes(id);
      return { ...p, lockedIds: has ? p.lockedIds.filter(x => x !== id) : [...p.lockedIds, id] };
    }));
  }

  function toggleHidden(id) {
    setPages(prev => prev.map((p, i) => {
      if (i !== activePage) return p;
      const has = p.hiddenIds.includes(id);
      return { ...p, hiddenIds: has ? p.hiddenIds.filter(x => x !== id) : [...p.hiddenIds, id] };
    }));
  }

  // ── Alignment ─────────────────────────────────────────────────────────────
  function alignEl(dir) {
    const el = elements.find(e => e.id === selectedId);
    if (!el) return;
    pushHistory();
    const isCO = ['circle', 'triangle', 'star'].includes(el.type);
    const r = el.radius || el.outerRadius || 60;
    const w = isCO ? r * 2 : (el.width || 200);
    const h = isCO ? r * 2 : (el.height || 100);
    let updates = {};
    if (dir === 'left')    updates = { x: isCO ? r : 0 };
    if (dir === 'centerH') updates = { x: isCO ? canvasSize.w / 2 : (canvasSize.w - w) / 2 };
    if (dir === 'right')   updates = { x: isCO ? canvasSize.w - r : canvasSize.w - w };
    if (dir === 'top')     updates = { y: isCO ? r : 0 };
    if (dir === 'centerV') updates = { y: isCO ? canvasSize.h / 2 : (canvasSize.h - h) / 2 };
    if (dir === 'bottom')  updates = { y: isCO ? canvasSize.h - r : canvasSize.h - h };
    updateElement({ ...el, ...updates });
  }

  // ── Snap computation ───────────────────────────────────────────────────────
  function computeSnap(draggedId, rawX, rawY, elW, elH) {
    const threshold = SNAP_THRESHOLD / stageScale;
    const vGuides = [], hGuides = [];
    let snapX = rawX, snapY = rawY;
    const dEx = [rawX, rawX + elW / 2, rawX + elW];
    const dEy = [rawY, rawY + elH / 2, rawY + elH];
    const offX = [0, elW / 2, elW];
    const offY = [0, elH / 2, elH];
    const tgX = [0, canvasSize.w / 2, canvasSize.w];
    const tgY = [0, canvasSize.h / 2, canvasSize.h];

    for (const e of elements) {
      if (e.id === draggedId || lockedIds.has(e.id) || hiddenIds.has(e.id)) continue;
      const isCO = ['circle', 'triangle', 'star'].includes(e.type);
      const r = e.radius || e.outerRadius || 60;
      const ew = isCO ? r * 2 : (e.width || (e.type === 'arrow' ? e.width || 200 : 200));
      const eh = isCO ? r * 2 : (e.height || 100);
      const etlx = isCO ? e.x - r : e.x;
      const etly = isCO ? e.y - r : e.y;
      tgX.push(etlx, etlx + ew / 2, etlx + ew);
      tgY.push(etly, etly + eh / 2, etly + eh);
    }

    let snapXFound = false, snapYFound = false;
    for (const t of tgX) {
      if (snapXFound) break;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(dEx[i] - t) < threshold) { snapX = t - offX[i]; vGuides.push(t); snapXFound = true; break; }
      }
    }
    for (const t of tgY) {
      if (snapYFound) break;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(dEy[i] - t) < threshold) { snapY = t - offY[i]; hGuides.push(t); snapYFound = true; break; }
      }
    }
    setSnapGuides({ v: vGuides, h: hGuides });
    setLiveBounds({ x: Math.round(snapX), y: Math.round(snapY), w: Math.round(elW || 0), h: Math.round(elH || 0) });
    return { x: snapX, y: snapY };
  }

  function clearSnapGuides() { setSnapGuides({ v: [], h: [] }); setLiveBounds(null); }

  // ── Ruler drag guides ──────────────────────────────────────────────────────
  function startRulerDrag(axis) {
    const onMove = (ev) => {
      const rect = canvasWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const raw = axis === 'h' ? (ev.clientY - rect.top) / stageScale : (ev.clientX - rect.left) / stageScale;
      const pos = Math.max(0, Math.min(raw, axis === 'h' ? canvasSize.h : canvasSize.w));
      setDraggingGuide({ axis, pos });
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const rect = canvasWrapperRef.current?.getBoundingClientRect();
      if (rect) {
        const raw = axis === 'h' ? (ev.clientY - rect.top) / stageScale : (ev.clientX - rect.left) / stageScale;
        const pos = Math.round(raw);
        if (pos > 0 && pos < (axis === 'h' ? canvasSize.h : canvasSize.w)) {
          setRulerGuides(prev => ({ ...prev, [axis]: [...prev[axis], pos] }));
        }
      }
      setDraggingGuide(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ── Recent colors ──────────────────────────────────────────────────────────
  function pickColor(color, applyFn) {
    applyFn(color);
    setRecentColors(prev => [color, ...prev.filter(c => c !== color)].slice(0, 8));
  }

  function replaceDocColor(oldColor, newColor) {
    if (!oldColor || !newColor || oldColor === newColor) return;
    pushHistory();
    const swap = c => (c && c.toLowerCase() === oldColor.toLowerCase() ? newColor : c);
    setPages(prev => prev.map(page => ({
      ...page,
      bgColor: swap(page.bgColor),
      bgGradient: page.bgGradient ? { ...page.bgGradient, c1: swap(page.bgGradient.c1), c2: swap(page.bgGradient.c2), midColor: page.bgGradient.midColor ? swap(page.bgGradient.midColor) : undefined } : page.bgGradient,
      elements: page.elements.map(el => ({
        ...el,
        fill: swap(el.fill),
        stroke: swap(el.stroke),
        tintColor: swap(el.tintColor),
        shadow: el.shadow ? { ...el.shadow, color: swap(el.shadow.color) } : el.shadow,
        outline: el.outline ? { ...el.outline, color: swap(el.outline.color) } : el.outline,
        textBg: el.textBg ? { ...el.textBg, color: swap(el.textBg.color) } : el.textBg,
        fillGradient: el.fillGradient ? { ...el.fillGradient, c1: swap(el.fillGradient.c1), c2: swap(el.fillGradient.c2), midColor: el.fillGradient.midColor ? swap(el.fillGradient.midColor) : undefined } : el.fillGradient,
        borderColor: swap(el.borderColor),
      })),
    })));
    setRecentColors(prev => [newColor, ...prev.filter(c => c !== newColor)].slice(0, 8));
    setReplaceDocColorOld(null);
  }

  // ── Text inline editing ────────────────────────────────────────────────────
  function startEditText(id) {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    if (el.type === 'image') {
      replaceImgId.current = id;
      replaceFileRef.current?.click();
      return;
    }
    if (el.type !== 'text') return;
    const stage = stageRef.current;
    if (!stage) return;
    const node = stage.findOne(`#${id}`);
    if (!node) return;
    const absPos = node.getAbsolutePosition();
    setTextareaPos({ x: absPos.x * stageScale, y: absPos.y * stageScale, w: (el.width || 400) * stageScale, fontSize: (el.fontSize || 36) * stageScale });
    setTextareaValue(el.text || '');
    setEditingTextId(id);
    patchElements(prev => prev.map(e => e.id === id ? { ...e, visible: false } : e));
  }


  function commitTextEdit() {
    if (!editingTextId) return;
    pushHistory();
    patchElements(prev => prev.map(e => e.id === editingTextId ? { ...e, text: textareaValue, visible: true } : e));
    setEditingTextId(null);
  }

  // ── Background helpers ─────────────────────────────────────────────────────
  function selectBgPhoto(photo) {
    pushHistory();
    patchPage({ bgType: 'image', bgImageUrl: photo.url, bgSource: photo.source || 'stock', bgSourceId: photo.id });
  }

  function applyFilterPreset(key) {
    const p = FILTER_PRESETS[key];
    if (!p) return;
    pushHistory();
    patchPage({ bgFilter: key, bgBrightness: p.brightness, bgContrast: p.contrast, bgSaturation: p.saturation });
  }

  // ── Page management ───────────────────────────────────────────────────────
  function addPage() {
    pushHistory();
    const newPage = emptyPage();
    setPages(prev => [...prev, newPage]);
    setActivePage(pages.length);
    setSelectedId(null);
  }

  function duplicatePage(idx) {
    pushHistory();
    const copy = { ...JSON.parse(JSON.stringify(pages[idx])), id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` };
    setPages(prev => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
    setActivePage(idx + 1);
    setSelectedId(null);
  }

  function deletePage(idx) {
    if (pages.length <= 1) return;
    pushHistory();
    setPages(prev => prev.filter((_, i) => i !== idx));
    setActivePage(prev => Math.min(prev, pages.length - 2));
    setSelectedId(null);
  }

  function addElToAllPages(elId) {
    const el = elements.find(e => e.id === elId);
    if (!el) return;
    pushHistory();
    setPages(prev => prev.map((p, i) => {
      if (i === activePage) return p;
      const copy = { ...JSON.parse(JSON.stringify(el)), id: uid() };
      return { ...p, elements: [...p.elements, copy] };
    }));
  }

  function elBounds(e) {
    const isCO = ['circle', 'triangle', 'star'].includes(e.type);
    const r = e.radius || e.outerRadius || 60;
    if (isCO) return { x: e.x - r, y: e.y - r, w: r * 2, h: r * 2 };
    return { x: e.x, y: e.y, w: e.width || 100, h: e.height || 60 };
  }

  function groupSelected() {
    if (selectedIds.length < 2) return;
    const toGroup = elements.filter(e => selectedIds.includes(e.id));
    if (!toGroup.length) return;
    pushHistory();
    const bounds = toGroup.map(elBounds);
    const minX = Math.min(...bounds.map(b => b.x));
    const minY = Math.min(...bounds.map(b => b.y));
    const maxX = Math.max(...bounds.map(b => b.x + b.w));
    const maxY = Math.max(...bounds.map(b => b.y + b.h));
    const grpIdx = Math.min(...toGroup.map(e => elements.indexOf(e)));
    const group = {
      id: uid(), type: 'group',
      x: minX, y: minY,
      width: maxX - minX, height: maxY - minY,
      rotation: 0, opacity: 1,
      children: toGroup.map(e => ({ ...JSON.parse(JSON.stringify(e)), x: e.x - minX, y: e.y - minY })),
    };
    patchElements(prev => {
      const filtered = prev.filter(e => !selectedIds.includes(e.id));
      filtered.splice(grpIdx, 0, group);
      return filtered;
    });
    setSelectedId(group.id);
    setSelectedIds([group.id]);
  }

  function ungroupSelected() {
    const grp = elements.find(e => e.id === selectedId && e.type === 'group');
    if (!grp) return;
    pushHistory();
    const grpIdx = elements.indexOf(grp);
    const restored = (grp.children || []).map(child => ({
      ...child, id: uid(), x: grp.x + child.x, y: grp.y + child.y,
    }));
    patchElements(prev => {
      const filtered = prev.filter(e => e.id !== grp.id);
      filtered.splice(grpIdx, 0, ...restored);
      return filtered;
    });
    const newIds = restored.map(e => e.id);
    setSelectedIds(newIds);
    setSelectedId(newIds[newIds.length - 1] || null);
  }

  function movePageUp(idx) {
    if (idx <= 0) return;
    pushHistory();
    setPages(prev => { const next = [...prev]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; return next; });
    setActivePage(idx - 1);
  }

  function movePageDown(idx) {
    if (idx >= pages.length - 1) return;
    pushHistory();
    setPages(prev => { const next = [...prev]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; return next; });
    setActivePage(idx + 1);
  }

  // ── Save & Post ────────────────────────────────────────────────────────────
  async function downloadAllPages() {
    if (!stageRef.current) return;
    const savedPage = activePage;
    clearSelection();
    setSelectedId(null);
    if (trLayerRef.current) trLayerRef.current.hide();
    const pixelRatio = canvasSize.w / stageDisplayW;
    for (let i = 0; i < pages.length; i++) {
      setActivePage(i);
      await new Promise(r => setTimeout(r, 300));
      await new Promise(r => requestAnimationFrame(r));
      const uri = stageRef.current.toDataURL({ mimeType: 'image/png', quality: 1, pixelRatio });
      const a = document.createElement('a');
      a.href = uri;
      a.download = `${titleForSave || 'design'}_page${i + 1}.png`;
      a.click();
      await new Promise(r => setTimeout(r, 80));
    }
    if (trLayerRef.current) trLayerRef.current.show();
    setActivePage(savedPage);
  }

  function downloadCanvas(mimeType, ext, quality) {
    if (!stageRef.current) return;
    const pixelRatio = (canvasSize.w / stageDisplayW) * exportScale;
    clearSelection();
    if (trLayerRef.current) trLayerRef.current.hide();
    requestAnimationFrame(() => {
      const uri = stageRef.current.toDataURL({ mimeType, quality, pixelRatio });
      if (trLayerRef.current) trLayerRef.current.show();
      const a = document.createElement('a');
      a.href = uri;
      a.download = `${titleForSave || 'design'}.${ext}`;
      a.click();
    });
  }

  function downloadTransparentPng() {
    if (!stageRef.current) return;
    const pixelRatio = (canvasSize.w / stageDisplayW) * exportScale;
    clearSelection();
    if (trLayerRef.current) trLayerRef.current.hide();
    const bgLayer = stageRef.current.getLayers()[0];
    if (bgLayer) bgLayer.hide();
    requestAnimationFrame(() => {
      const uri = stageRef.current.toDataURL({ mimeType: 'image/png', quality: 1, pixelRatio });
      if (bgLayer) bgLayer.show();
      if (trLayerRef.current) trLayerRef.current.show();
      const a = document.createElement('a');
      a.href = uri;
      a.download = `${titleForSave || 'design'}_transparent.png`;
      a.click();
    });
  }

  async function handleSave() {
    if (!stageRef.current) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      setSelectedId(null);
      await new Promise(r => requestAnimationFrame(r));
      await document.fonts.ready;
      if (trLayerRef.current) trLayerRef.current.hide();
      const dataUrl = stageRef.current.toDataURL({ mimeType: 'image/jpeg', quality: 0.9, pixelRatio: canvasSize.w / stageRef.current.width() });
      if (trLayerRef.current) trLayerRef.current.show();
      const snap = snapshot();
      const { data } = await studioAPI.save({ imageDataUrl: dataUrl, canvasJson: snap, title: titleForSave, canvasWidth: canvasSize.w, canvasHeight: canvasSize.h, backgroundSource: currentPage.bgSource, backgroundId: currentPage.bgSourceId });
      setSavedCreationId(data.creation.id);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
      setPostModalOpen(true);
    } catch (err) {
      console.error('[TemplatesEditor] save:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } finally {
      setSaving(false);
    }
  }

  // ── Admin: update the template itself (not a user's design) ──────────────
  async function handleUpdateTemplate() {
    if (!editingTemplateId || !isAdmin || tmplSaving) return;
    setTmplSaving(true);
    setTmplSaveStatus('saving');
    try {
      const snap = snapshot();
      await studioAPI.updateTemplate(editingTemplateId, { name: titleForSave, canvas_json: snap });
      // Auto-regenerate thumbnail
      if (stageRef.current) {
        try {
          if (trLayerRef.current) trLayerRef.current.hide();
          const pixelRatio = 1080 / stageRef.current.width();
          const dataUrl = stageRef.current.toDataURL({ mimeType: 'image/jpeg', quality: 0.92, pixelRatio });
          if (trLayerRef.current) trLayerRef.current.show();
          const token = localStorage.getItem('token');
          await fetch(`/api/studio/templates/${editingTemplateId}/thumbnail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ dataUrl }),
          });
        } catch (_) {}
      }
      setTmplSaveStatus('saved');
      setTimeout(() => setTmplSaveStatus(''), 4000);
    } catch (err) {
      console.error('[UpdateTemplate]', err);
      setTmplSaveStatus('error');
      setTimeout(() => setTmplSaveStatus(''), 4000);
    } finally {
      setTmplSaving(false);
    }
  }

  async function handlePost() {
    if (!savedCreationId) return;
    setPosting(true);
    setPostError('');
    try {
      await studioAPI.postCreation(savedCreationId, { caption: postCaption, platforms: postPlatforms, scheduleMode: 'now' });
      setPostSuccess(true);
    } catch (err) {
      setPostError(err.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const selectedEl = elements.find(e => e.id === selectedId);
  const stockPhotos = bgPhotos.filter(p => p.source === 'stock');
  const myPhotos = bgPhotos.filter(p => p.source === 'mine');
  const displayedBgPhotos = bgTab === 'stock' ? stockPhotos : myPhotos;
  const displayedImgPhotos = imgTab === 'stock' ? stockPhotos : myPhotos;

  // ── Color picker helper ────────────────────────────────────────────────────
  const RecentColorsRow = ({ onPick }) => recentColors.length === 0 ? null : (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
      {recentColors.map(c => (
        <button key={c} onClick={() => onPick(c)}
          style={{ width: 20, height: 20, borderRadius: 4, background: c, border: `1px solid ${t.border}`, cursor: 'pointer', flexShrink: 0 }} />
      ))}
    </div>
  );

  function handleToolClick(toolId) {
    if (activeLeftTool === toolId && panelOpen) {
      setPanelOpen(false);
    } else {
      setActiveLeftTool(toolId);
      setPanelOpen(true);
      if (toolId !== 'elements' && toolId !== 'shapes') {
        setElemSubPanel(null);
        setActiveElemCat(null);
      }
    }
  }

  async function aiImproveText() {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'text' || aiImproving) return;
    setAiImproving(true);
    try {
      const platform = postPlatforms[0] || 'instagram';
      const { data } = await studioAPI.rewriteText({ text: el.text, platform });
      if (data?.improved) {
        pushHistory();
        updateElement({ ...el, text: data.improved });
      }
    } catch (e) {
      console.error('[AI Improve]', e);
    } finally {
      setAiImproving(false);
    }
  }

  // ─── Document colors (extracted from all elements across all pages) ────────
  const docColors = useMemo(() => {
    const seen = new Set();
    const add = c => { if (c && /^#[0-9A-Fa-f]{6}$/.test(c)) seen.add(c.toLowerCase()); };
    pages.forEach(page => {
      add(page.bgColor);
      if (page.bgGradient) { add(page.bgGradient.c1); add(page.bgGradient.c2); add(page.bgGradient.midColor); }
      page.elements.forEach(el => {
        add(el.fill); add(el.stroke); add(el.borderColor);
        add(el.outline?.color); add(el.shadow?.color);
        add(el.textBg?.color); add(el.tintColor);
        add(el.fillGradient?.c1); add(el.fillGradient?.c2); add(el.fillGradient?.midColor);
      });
    });
    return [...seen].slice(0, 20);
  }, [pages]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <DocColorsCtx.Provider value={docColors}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: t.bg, position: 'fixed', inset: 0, zIndex: 1 }}>
      <style>{`
        @keyframes floatIn { from { opacity:0; transform:translateX(-50%) scale(0.92) translateY(4px); } to { opacity:1; transform:translateX(-50%) scale(1) translateY(0); } }
        @keyframes shimmer { from { background-position:200% 0; } to { background-position:-200% 0; } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes dropdownIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
        @keyframes contextIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        @keyframes panelFadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes ctxbar-in { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes panel-in { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }
      `}</style>

      {/* ── Top toolbar (Canva-style) ── */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: '1px solid rgba(255,255,255,0.15)', background: 'linear-gradient(to right, #00C4CC, #7C5CFC)', flexShrink: 0, zIndex: 10 }}>

        {/* ── Left zone ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>

          {/* Back */}
          <button onClick={() => {
            const ref = document.referrer;
            if (ref.includes('/wizard')) router.push('/wizard');
            else if (ref.includes('/history')) router.push('/history');
            else router.back();
          }} title="Back"
            style={{ width: 36, height: 36, border: 'none', borderRadius: 8, background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IpArrowLeft size={18} />
          </button>

          {/* ItsPosting Studio brand mark */}
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #00C4CC 0%, #7C5CFC 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px',
            userSelect: 'none', cursor: 'default',
          }}>IP</div>

          {/* File dropdown */}
          <div style={{ position: 'relative' }}>
            {showFileMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setShowFileMenu(false)} />}
            <button onClick={() => { setShowFileMenu(m => !m); setShowResizeMenu(false); setShowDownloadMenu(false); }}
              style={{ height: 32, padding: '0 10px', border: `1px solid ${showFileMenu ? 'rgba(255,255,255,0.4)' : 'transparent'}`, borderRadius: 8, background: showFileMenu ? 'rgba(255,255,255,0.2)' : 'transparent', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 120ms ease', letterSpacing: '-0.01em' }}
              onMouseEnter={e => { if (!showFileMenu) { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; } }}
              onMouseLeave={e => { if (!showFileMenu) { e.currentTarget.style.background = 'transparent'; } }}>
              File <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 1 }}>▾</span>
            </button>
            {showFileMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 290, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 150, overflow: 'hidden', animation: 'dropdownIn 150ms ease forwards' }}>
                {/* Header: title + dimensions */}
                <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text }}>{titleForSave || 'Untitled design'}</span>
                    <button onMouseDown={e => { e.preventDefault(); setTitleEditing(true); setShowFileMenu(false); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 14, padding: '2px 4px', borderRadius: 4 }}>✏</button>
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{canvasSize.w}×{canvasSize.h}px</div>
                </div>
                {/* Menu items */}
                <div style={{ padding: '4px 0' }}>
                  {[
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>, label: 'New design', right: 'Ctrl+N', fn: () => { if (elements.length === 0 || confirm('Start a new blank design?')) { pushHistory(); setPages([emptyPage()]); setActivePage(0); clearSelection(); setTitleForSave(''); } } },
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>, label: 'Upload files', fn: () => { uploadFileRef.current?.click(); } },
                    null,
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>, label: 'Settings', right: '›', fn: () => {} },
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="3"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg>, label: 'Accessibility', right: '›', fn: () => {} },
                    null,
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>, label: 'Save', right: saveStatus === 'saving' ? 'Saving…' : 'All changes saved', rightMuted: true, fn: () => handleSave() },
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, label: 'Make available offline', fn: () => {} },
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, label: 'Move', fn: () => {} },
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>, label: 'Make a copy', fn: () => { const copy = JSON.parse(JSON.stringify(pages)); const now = Date.now(); copy.forEach((p,i) => { p.id = `page_${now+i}_copy`; }); pushHistory(); setPages(copy); } },
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, label: 'Download', fn: () => downloadCanvas('image/png', 'png', 1) },
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>, label: 'Print', right: 'Ctrl+P', fn: () => window.print() },
                    null,
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>, label: 'Version history', fn: () => {} },
                    null,
                    { icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>, label: 'Move to Trash', fn: () => {}, danger: true },
                  ].map((item, i) => item === null
                    ? <div key={i} style={{ height: 1, background: t.border, margin: '3px 0' }} />
                    : (
                      <button key={i} onMouseDown={e => { e.preventDefault(); item.fn(); setShowFileMenu(false); }}
                        style={{ width: '100%', padding: '7px 14px', border: 'none', background: 'transparent', color: item.danger ? t.error : t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', transition: 'background 80ms' }}
                        onMouseEnter={e => e.currentTarget.style.background = t.input}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', color: t.textMuted }}>{item.icon}</span>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.right && (item.rightMuted
                          ? <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0 }}>{item.right}</span>
                          : <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0, fontFamily: 'monospace', background: t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', padding: '2px 5px', borderRadius: 4 }}>{item.right}</span>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Resize/canvas-size dropdown */}
          <div style={{ position: 'relative' }}>
            {showResizeMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setShowResizeMenu(false)} />}
            <button onClick={() => { setShowResizeMenu(m => !m); setShowFileMenu(false); setShowDownloadMenu(false); }}
              style={{ height: 32, padding: '0 10px', border: `1px solid ${showResizeMenu ? 'rgba(255,255,255,0.4)' : 'transparent'}`, borderRadius: 8, background: showResizeMenu ? 'rgba(255,255,255,0.2)' : 'transparent', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, maxWidth: 160, overflow: 'hidden', transition: 'all 120ms ease', letterSpacing: '-0.01em' }}
              onMouseEnter={e => { if (!showResizeMenu) { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; } }}
              onMouseLeave={e => { if (!showResizeMenu) { e.currentTarget.style.background = 'transparent'; } }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{canvasSize.label}</span>
              <span style={{ fontSize: 9, opacity: 0.5, flexShrink: 0, marginLeft: 1 }}>▾</span>
            </button>
            {showResizeMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 320, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 150, overflow: 'hidden', animation: 'dropdownIn 150ms ease forwards' }}>
                {/* Search */}
                <div style={{ padding: '10px 14px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 8, padding: '0 12px', height: 36, border: `1px solid ${t.border}` }}>
                    <IpSearch size={14} color={t.textMuted} style={{ flexShrink: 0 }} />
                    <input placeholder="Search resize options" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                  </div>
                </div>
                {/* Suggested */}
                <div style={{ padding: '4px 14px 6px', fontSize: 12, fontWeight: 600, color: t.textMuted }}>Suggested</div>
                <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px', overflowX: 'auto' }}>
                  {[
                    { label: 'Instagram Story',      w: 1080, h: 1920, id: 'ig_story',    tw: 34, th: 60, thumbGrad: 'linear-gradient(135deg,#ec4899,#8b5cf6)' },
                    { label: 'Instagram Post (4:5)', w: 1080, h: 1350, id: 'ig_portrait', tw: 38, th: 48, thumbGrad: 'linear-gradient(135deg,#f97316,#ef4444)' },
                    { label: 'Facebook Post',        w: 1200, h:  630, id: 'fb_post',     tw: 56, th: 30, thumbGrad: 'linear-gradient(135deg,#3b82f6,#06b6d4)' },
                  ].map(p => (
                    <button key={p.label} onMouseDown={() => { setCanvasSizeId(p.id); setShowCustomSizeForm(false); setShowResizeMenu(false); }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: `1px solid ${canvasSizeId === p.id ? t.primary : t.border}`, borderRadius: 9, padding: '10px 8px', background: canvasSizeId === p.id ? t.primaryBg : 'transparent', cursor: 'pointer', flexShrink: 0 }}>
                      <div style={{ width: p.tw, height: p.th, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: canvasSizeId === p.id ? t.primary : p.thumbGrad, boxShadow: canvasSizeId === p.id ? `0 0 0 2px ${t.primary}` : 'none' }}>
                        <div style={{ width: '100%', height: '38%', background: 'rgba(255,255,255,0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2, paddingTop: 4 }}>
                          <div style={{ width: '60%', height: 2, background: 'rgba(255,255,255,0.75)', borderRadius: 1 }} />
                          <div style={{ width: '40%', height: 1.5, background: 'rgba(255,255,255,0.5)', borderRadius: 1 }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, textAlign: 'center', maxWidth: 80, color: canvasSizeId === p.id ? t.primary : '#7C5CFC' }}>{p.label}</span>
                      <span style={{ fontSize: 10, color: t.textMuted }}>{p.w}×{p.h}px</span>
                    </button>
                  ))}
                </div>
                {/* Browse by category */}
                {/* Scale-on-resize toggle */}
                <div style={{ padding: '8px 16px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: t.text, userSelect: 'none', flex: 1 }}>
                    <input type="checkbox" checked={scaleOnResize} onChange={e => setScaleOnResize(e.target.checked)}
                      style={{ accentColor: t.primary, width: 14, height: 14, cursor: 'pointer' }} />
                    Scale content with canvas
                  </label>
                  <span style={{ fontSize: 10, color: t.textMuted }}>Magic Resize</span>
                </div>
                <div style={{ padding: '4px 14px 4px', fontSize: 12, fontWeight: 600, color: t.textMuted, borderTop: `1px solid ${t.border}` }}>Browse by category</div>
                {/* Custom size row — expands to W×H form */}
                <button
                  onClick={() => setShowCustomSizeForm(p => !p)}
                  style={{ width: '100%', padding: '9px 16px', border: 'none', background: showCustomSizeForm ? t.primaryBg : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: showCustomSizeForm ? t.primary : t.text, fontSize: 13, cursor: 'pointer', transition: 'background 100ms' }}
                  onMouseEnter={e => { if (!showCustomSizeForm) e.currentTarget.style.background = t.input; }}
                  onMouseLeave={e => { if (!showCustomSizeForm) e.currentTarget.style.background = 'transparent'; }}>
                  <span>Custom size</span>
                  <span style={{ color: showCustomSizeForm ? t.primary : t.textMuted }}>{showCustomSizeForm ? '▴' : '›'}</span>
                </button>
                {showCustomSizeForm && (
                  <div style={{ padding: '10px 16px 12px', background: t.input, borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'end', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>Width (px)</div>
                        <input type="number" min={100} max={8000} value={canvasCustomW}
                          onChange={e => setCanvasCustomW(Math.max(100, Math.min(8000, parseInt(e.target.value) || 100)))}
                          style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <span style={{ fontSize: 14, color: t.textMuted, paddingBottom: 4 }}>×</span>
                      <div>
                        <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>Height (px)</div>
                        <input type="number" min={100} max={8000} value={canvasCustomH}
                          onChange={e => setCanvasCustomH(Math.max(100, Math.min(8000, parseInt(e.target.value) || 100)))}
                          style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <button
                      onMouseDown={() => { setCanvasSizeId('custom'); setShowCustomSizeForm(false); setShowResizeMenu(false); }}
                      style={{ width: '100%', background: t.primary, color: '#fff', border: 'none', borderRadius: 7, padding: '9px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      Apply custom size
                    </button>
                  </div>
                )}
                {[
                  { label: 'Custom size',   color: '#6366f1', emoji: '⊡' },
                  { label: 'Social media',  color: '#ef4444', emoji: '♥' },
                  { label: 'Presentations', color: '#f97316', emoji: '📊' },
                  { label: 'Videos',        color: '#ef4444', emoji: '▶' },
                  { label: 'Website',       color: '#3b82f6', emoji: '🌐' },
                  { label: 'Whiteboard',    color: '#22c55e', emoji: '◻' },
                ].map(c => (
                  <button key={c.label} style={{ width: '100%', padding: '9px 16px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 10, color: t.text, fontSize: 13, cursor: 'pointer', transition: 'background 100ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = t.input}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ color: c.color, fontSize: 14, flexShrink: 0, width: 18, textAlign: 'center' }}>{c.emoji}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{c.label}</span>
                    <span style={{ color: t.textMuted }}>›</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── "✏ Editing ▾" mode dropdown ── */}
          <div style={{ position: 'relative' }}>
            {editModeOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setEditModeOpen(false)} />}
            <button onClick={() => { setEditModeOpen(o => !o); setShowFileMenu(false); setShowResizeMenu(false); setShowDownloadMenu(false); }}
              style={{ height: 32, padding: '0 10px', border: `1px solid ${editModeOpen ? 'rgba(255,255,255,0.4)' : 'transparent'}`, borderRadius: 8, background: editModeOpen ? 'rgba(255,255,255,0.2)' : 'transparent', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 120ms ease', letterSpacing: '-0.01em' }}
              onMouseEnter={e => { if (!editModeOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; } }}
              onMouseLeave={e => { if (!editModeOpen) { e.currentTarget.style.background = 'transparent'; } }}>
              ✏ Editing <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 1 }}>▾</span>
            </button>
            {editModeOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 340, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 150, padding: '6px 0', animation: 'dropdownIn 150ms ease forwards' }}>
                {[
                  { id: 'editing',    label: 'Editing',    sub: 'Make changes',
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
                  { id: 'commenting', label: 'Commenting', sub: 'Add feedback',
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                  { id: 'viewing',    label: 'Viewing',    sub: 'Read-only',
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> },
                ].map(m => (
                  <button key={m.id} onClick={() => { setEditMode(m.id); setEditModeOpen(false); }}
                    style={{ width: '100%', height: 62, padding: '0 16px', border: 'none', background: editMode === m.id ? t.primaryBg : 'transparent', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', fontSize: 13, color: t.text, textAlign: 'left', transition: 'background 100ms' }}
                    onMouseEnter={e => { if (editMode !== m.id) e.currentTarget.style.background = t.input; }}
                    onMouseLeave={e => { if (editMode !== m.id) e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{ color: editMode === m.id ? t.primary : t.textMuted, flexShrink: 0 }}>{m.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: editMode === m.id ? t.primary : t.text }}>{m.label}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 1 }}>{m.sub}</div>
                    </div>
                    {editMode === m.id && <span style={{ color: t.primary, fontSize: 16, flexShrink: 0 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Video mode toggle ── */}
          <button onClick={() => { setIsVideoMode(v => !v); setIsPlaying(false); setVideoPlayhead(0); clearInterval(playIntervalRef.current); }}
            onMouseEnter={e => { showTip(e, isVideoMode ? 'Switch to Image mode' : 'Edit as Video'); if (!isVideoMode) { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; } }} onMouseLeave={e => { hideTip(); if (!isVideoMode) { e.currentTarget.style.background = 'transparent'; } }}
            style={{ height: 32, padding: '0 11px', border: `1px solid ${isVideoMode ? 'rgba(255,255,255,0.4)' : 'transparent'}`, borderRadius: 8, background: isVideoMode ? 'rgba(255,255,255,0.2)' : 'transparent', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)', flexShrink: 0, letterSpacing: '-0.01em' }}>
            {isVideoMode ? '◻ Image' : '▶ Video'}
          </button>

          {/* ── Separator ── */}
          <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.25)', flexShrink: 0, margin: '0 2px' }} />

          {/* ── Undo / Redo — always visible in left zone ── */}
          <button onClick={undo} disabled={historyIndex < 0}
            title="Undo (Ctrl+Z)"
            onMouseEnter={e => { showTip(e, 'Undo', 'Ctrl+Z'); if (historyIndex >= 0) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { hideTip(); e.currentTarget.style.background = 'transparent'; }}
            style={{ width: 34, height: 34, border: 'none', borderRadius: 8, background: 'transparent', color: historyIndex < 0 ? 'rgba(255,255,255,0.35)' : '#fff', cursor: historyIndex < 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 100ms', flexShrink: 0 }}>
            <IcoUndo size={17} />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Y)"
            onMouseEnter={e => { showTip(e, 'Redo', 'Ctrl+Y'); if (historyIndex < history.length - 1) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { hideTip(); e.currentTarget.style.background = 'transparent'; }}
            style={{ width: 34, height: 34, border: 'none', borderRadius: 8, background: 'transparent', color: historyIndex >= history.length - 1 ? 'rgba(255,255,255,0.35)' : '#fff', cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 100ms', flexShrink: 0 }}>
            <IcoRedo size={17} />
          </button>

          {/* Theme toggle — left zone so it doesn't crowd the right-side admin badges */}
          <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.25)', flexShrink: 0, margin: '0 2px' }} />
          <button onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            onMouseEnter={e => { showTip(e, theme === 'dark' ? 'Light mode' : 'Dark mode'); e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { hideTip(); e.currentTarget.style.background = 'transparent'; }}
            style={{ width: 34, height: 34, border: 'none', borderRadius: 8, background: 'transparent', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 100ms, color 100ms', flexShrink: 0 }}>
            {theme === 'dark'
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </div>

        {/* ── Center zone: flex:1 true 3-column layout — no absolute positioning ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0, padding: '0 8px' }}>
          {titleEditing ? (
            <input
              autoFocus
              value={titleForSave}
              onChange={e => setTitleForSave(e.target.value)}
              onBlur={() => setTitleEditing(false)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
              style={{ padding: '4px 10px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: 13, fontWeight: 600, outline: 'none', width: 220, textAlign: 'center', boxShadow: '0 0 0 3px rgba(255,255,255,0.1)' }}
            />
          ) : (
            <button onClick={() => setTitleEditing(true)} title="Click to rename"
              style={{ padding: '4px 10px', border: '1px solid transparent', borderRadius: 8, background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'text', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleForSave || 'Untitled design'}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45, flexShrink: 0 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
        </div>

        {/* ── Right zone ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

          {/* Save status indicator */}
          {saveStatus === 'saving' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span>
              Saving…
            </div>
          )}
          {saveStatus === 'saved' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
              ✓ Saved
            </div>
          )}
          {saveStatus === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#FFD0D0', fontWeight: 500 }}>
              ⚠ Save failed
            </div>
          )}

          {/* Template status: admin save indicator */}
          {tmplSaveStatus === 'saving' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
              <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span>
              Updating…
            </div>
          )}
          {tmplSaveStatus === 'saved' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
              ✓ Template updated
            </div>
          )}
          {tmplSaveStatus === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#FFD0D0', fontWeight: 500 }}>
              ⚠ Update failed
            </div>
          )}

          {/* Template badge for regular users */}
          {editingTemplateId && !isAdmin && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 7, fontSize: 11, color: '#fff', fontWeight: 500, flexShrink: 0,
            }}>
              ✦ Using template
            </div>
          )}

          {/* Admin: template mode badge */}
          {editingTemplateId && isAdmin && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 7, fontSize: 11, color: '#fff', fontWeight: 600, flexShrink: 0,
            }}>
              ✏ Admin
            </div>
          )}

          {/* Preview */}
          <button onClick={() => setPreviewOpen(true)}
            onMouseEnter={e => { showTip(e, 'Preview', 'P'); e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }} onMouseLeave={e => { hideTip(); e.currentTarget.style.background = 'transparent'; }}
            style={{ height: 32, padding: '0 12px', border: '1px solid transparent', borderRadius: 8, background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 120ms ease', letterSpacing: '-0.01em' }}>
            <IpEye size={15} /> Preview
          </button>

          {/* Admin: Update Template CTA */}
          {editingTemplateId && isAdmin && (
            <button
              onClick={handleUpdateTemplate}
              disabled={tmplSaving}
              onMouseEnter={e => showTip(e, 'Save changes back to the template')} onMouseLeave={hideTip}
              style={{
                height: 36, padding: '0 16px', borderRadius: 8,
                background: tmplSaving ? 'rgba(255,255,255,0.5)' : '#fff',
                color: '#7C5CFC', border: 'none', fontSize: 13, fontWeight: 700,
                cursor: tmplSaving ? 'not-allowed' : 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {tmplSaving ? '⟳ Updating…' : '✓ Update Template'}
            </button>
          )}

          {/* Post — primary CTA */}
          <button onClick={() => setPostModalOpen(true)}
            onMouseEnter={e => { showTip(e, 'Post to social media'); e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)'; }} onMouseLeave={e => { hideTip(); e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)'; }}
            style={{ height: 36, padding: '0 18px', borderRadius: 8, background: '#fff', color: '#7C5CFC', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)', letterSpacing: '-0.01em' }}>
            Post
          </button>

          {/* Share */}
          <button onClick={() => { setShareOpen(o => !o); setShowFileMenu(false); setShowResizeMenu(false); setShowDownloadMenu(false); setEditModeOpen(false); }}
            onMouseEnter={e => { showTip(e, 'Share design'); if (!shareOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }} onMouseLeave={e => { hideTip(); if (!shareOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            style={{ height: 36, padding: '0 18px', borderRadius: 8, background: shareOpen ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 120ms ease', letterSpacing: '-0.01em' }}>
            Share
          </button>

          {/* Download dropdown */}
          <div style={{ position: 'relative' }}>
            {showDownloadMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setShowDownloadMenu(false)} />}
            <button onClick={() => { setShowDownloadMenu(m => !m); setShowFileMenu(false); setShowResizeMenu(false); }}
              style={{ height: 32, padding: '0 12px', border: `1px solid ${showDownloadMenu ? 'rgba(255,255,255,0.4)' : 'transparent'}`, borderRadius: 8, background: showDownloadMenu ? 'rgba(255,255,255,0.2)' : 'transparent', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 120ms ease', letterSpacing: '-0.01em' }}
              onMouseEnter={e => { if (!showDownloadMenu) { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; } }}
              onMouseLeave={e => { if (!showDownloadMenu) { e.currentTarget.style.background = 'transparent'; } }}>
              <IpDownload size={15} /> <IpChevronDown size={9} />
            </button>
            {showDownloadMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: 200, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 150, padding: '4px 0', animation: 'dropdownIn 150ms ease forwards' }}>
                {/* Resolution selector */}
                <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>Quality</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3].map(s => {
                      const w = Math.round(canvasSize.w * s);
                      const h = Math.round(canvasSize.h * s);
                      const active = exportScale === s;
                      return (
                        <button key={s} onMouseDown={e => { e.preventDefault(); setExportScale(s); }}
                          title={`${w} × ${h} px`}
                          style={{ flex: 1, padding: '5px 0', border: `1px solid ${active ? t.primary : t.border}`, borderRadius: 6, background: active ? t.primaryBg : 'transparent', color: active ? t.primary : t.textMuted, fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer' }}>
                          {s}×
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: t.textMuted, marginTop: 5, textAlign: 'center' }}>
                    {Math.round(canvasSize.w * exportScale)} × {Math.round(canvasSize.h * exportScale)} px
                  </div>
                </div>
                {[
                  { label: 'PNG (lossless)',      fn: () => downloadCanvas('image/png',  'png',  1)    },
                  { label: 'JPEG (smaller)',       fn: () => downloadCanvas('image/jpeg', 'jpg',  0.92) },
                  { label: 'PNG (transparent bg)', fn: () => downloadTransparentPng()                   },
                  ...(pages.length > 1 ? [{ label: `All ${pages.length} pages (PNG)`, fn: downloadAllPages }] : []),
                ].map((item, i) => (
                  <button key={i} onMouseDown={e => { e.preventDefault(); item.fn(); setShowDownloadMenu(false); }}
                    style={{ width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: t.text, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { e.currentTarget.style.background = t.input; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Contextual action bar (Canva-style) ── */}
      <div onClick={() => { setShowShadowPanel(false); setShowOutlinePanel(false); setShowPositionPanel(false); setShowAnimatePanel(false); setShowAdjustPanel(false); setShowSpacingPanel(false); setShowCropPanel(false); setShowFilterPanel(false); setShowEmojiPanel(false); setShowEffectsPanel(false); setShowMorePanel(false); }}
        style={{ height: (selectedId || selectedIds.length > 0) ? 48 : 30, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: `1px solid ${t.border}`, background: t.sidebar, flexShrink: 0, zIndex: 9, position: 'relative', transition: 'height 180ms cubic-bezier(0.16,1,0.3,1)' }}>
        {!selectedId && selectedIds.length === 0 && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: t.textDisabled, letterSpacing: '0.04em' }}>Select an element to edit</span>
          </div>
        )}

        {/* Scrollable left zone */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* ── Multi-select bar ── */}
        {selectedIds.length > 1 && (() => {
          const D = () => <div style={{ width: 1, height: 18, background: t.border, margin: '0 6px', flexShrink: 0, opacity: 0.7 }} />;
          const Btn = ({ label, onClick, danger }) => (
            <button onClick={onClick} style={{ height: 30, padding: '0 10px', border: 'none', borderRadius: 8, background: 'transparent', color: danger ? t.error : t.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)', letterSpacing: '-0.01em' }}
              onMouseEnter={e => { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.color = t.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? t.error : t.textSecondary; }}
            >{label}</button>
          );
          const ALIGNS = [
            { label: <><IcoAlignLeft size={14} /> Left</>,    fn: () => { pushHistory(); const minX = Math.min(...selectedIds.map(id => elements.find(e=>e.id===id)?.x || 0)); patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, x: minX} : el)); } },
            { label: <><IcoAlignRight size={14} /> Right</>,  fn: () => { pushHistory(); const maxR = Math.max(...selectedIds.map(id => { const el=elements.find(e=>e.id===id); return (el?.x||0)+(el?.width||100); })); patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, x: maxR-(el.width||100)} : el)); } },
            { label: <><IcoAlignTop size={14} /> Top</>,      fn: () => { pushHistory(); const minY = Math.min(...selectedIds.map(id => elements.find(e=>e.id===id)?.y || 0)); patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, y: minY} : el)); } },
            { label: <><IcoAlignBot size={14} /> Bottom</>,   fn: () => { pushHistory(); const maxB = Math.max(...selectedIds.map(id => { const el=elements.find(e=>e.id===id); return (el?.y||0)+(el?.height||60); })); patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, y: maxB-(el.height||60)} : el)); } },
            { label: <><IcoAlignCH size={14} /> Center H</>,  fn: () => { pushHistory(); const xs = selectedIds.map(id => elements.find(e=>e.id===id)?.x||0); const midX = (Math.min(...xs) + Math.max(...xs)) / 2; patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, x: midX-(el.width||100)/2} : el)); } },
            { label: <><IcoAlignCV size={14} /> Center V</>,  fn: () => { pushHistory(); const ys = selectedIds.map(id => elements.find(e=>e.id===id)?.y||0); const midY = (Math.min(...ys) + Math.max(...ys)) / 2; patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, y: midY-(el.height||60)/2} : el)); } },
          ];
          return (
            <>
              <span style={{ fontSize: 12, color: t.textMuted, flexShrink: 0, paddingRight: 6 }}>{selectedIds.length} selected</span>
              <D />
              {ALIGNS.map((a, i) => <Btn key={i} label={a.label} onClick={a.fn} />)}
              {selectedIds.length >= 3 && (
                <>
                  <D />
                  <Btn label={<><IcoDistH size={14} /> Dist H</>} onClick={distributeH} />
                  <Btn label={<><IcoDistV size={14} /> Dist V</>} onClick={distributeV} />
                  <D />
                  <Btn label="Tidy up" onClick={() => {
                    const els = selectedIds.map(id => elements.find(e => e.id === id)).filter(Boolean);
                    if (els.length < 2) return;
                    pushHistory();
                    const cols = Math.ceil(Math.sqrt(els.length));
                    const gap = 20;
                    const maxW = Math.max(...els.map(e => e.width || 100));
                    const maxH = Math.max(...els.map(e => e.height || 60));
                    const minX = Math.min(...els.map(e => e.x || 0));
                    const minY = Math.min(...els.map(e => e.y || 0));
                    const arranged = els.map((el, i) => ({
                      ...el,
                      x: minX + (i % cols) * (maxW + gap),
                      y: minY + Math.floor(i / cols) * (maxH + gap),
                    }));
                    patchElements(prev => prev.map(el => {
                      const updated = arranged.find(a => a.id === el.id);
                      return updated || el;
                    }));
                  }} />
                </>
              )}
              {selectedIds.length >= 2 && (() => {
                const selEls = selectedIds.map(id => elements.find(e => e.id === id)).filter(Boolean);
                const first = selEls[0];
                const canMatchSize = first && first.width != null && first.height != null;
                return canMatchSize ? (
                  <>
                    <D />
                    <Btn label="Match size" onClick={() => {
                      pushHistory();
                      patchElements(prev => prev.map(el => selectedIds.includes(el.id) && el.id !== first.id
                        ? { ...el, width: first.width, height: first.height }
                        : el));
                    }} />
                  </>
                ) : null;
              })()}
              {styleClipboard && (
                <>
                  <D />
                  <Btn label={<><IpPalette size={14} /> Paste style</>} onClick={pasteStyleToAll} />
                </>
              )}
              <D />
              <Btn label="Group" onClick={groupSelected} />
              <D />
              <Btn label={<><IcoDuplicate size={14} /> Dup all</>} onClick={() => {
                pushHistory();
                const copies = selectedIds.map(id => {
                  const el = elements.find(e => e.id === id);
                  return el ? { ...JSON.parse(JSON.stringify(el)), id: `el_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, x: el.x+20, y: el.y+20 } : null;
                }).filter(Boolean);
                patchElements(prev => [...prev, ...copies]);
                setSelectedIds(copies.map(c => c.id));
                setSelectedId(copies[copies.length - 1]?.id || null);
              }} />
              <D />
              <Btn label={<><IpDelete size={14} /> Delete all</>} danger onClick={() => { pushHistory(); const s = new Set(selectedIds); patchElements(prev => prev.filter(e => !s.has(e.id))); clearSelection(); }} />
              <div style={{ flex: 1 }} />
              <button onClick={clearSelection} style={{ height: 30, padding: '0 8px', border: 'none', borderRadius: 6, background: 'transparent', color: t.textMuted, fontSize: 11, cursor: 'pointer' }}>✕ Deselect</button>
            </>
          );
        })()}

        {/* ── Nothing / background selected ── */}
        {selectedIds.length <= 1 && (!selectedEl && !selectedId) && (() => {
          const D = () => <div style={{ width: 1, height: 22, background: t.border, margin: '0 4px', flexShrink: 0 }} />;
          return (
            <>
              <span style={{ fontSize: 12, color: t.textMuted, flexShrink: 0, paddingRight: 4 }}>{canvasSize.w}×{canvasSize.h}px</span>
              <D />
              <button onMouseDown={e => { e.preventDefault(); addText(); }} title="Add text (T)"
                style={{ height: 30, padding: '0 10px', border: 'none', borderRadius: 6, background: 'transparent', color: t.text, fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, transition: 'background 80ms' }}
                onMouseEnter={e => e.currentTarget.style.background = t.input} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                T Text
              </button>
              <button onMouseDown={e => { e.preventDefault(); addRect(); }} title="Add rectangle (R)"
                style={{ height: 30, padding: '0 10px', border: 'none', borderRadius: 6, background: 'transparent', color: t.text, fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, transition: 'background 80ms' }}
                onMouseEnter={e => e.currentTarget.style.background = t.input} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                ▭ Shape
              </button>
              <button onMouseDown={e => { e.preventDefault(); setActiveLeftTool('images'); }} title="Upload image"
                style={{ height: 30, padding: '0 10px', border: 'none', borderRadius: 6, background: 'transparent', color: t.text, fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, transition: 'background 80ms' }}
                onMouseEnter={e => e.currentTarget.style.background = t.input} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <IpPhoto size={13}/> Image
              </button>
              <D />
              <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0 }}>Background</span>
              <input type="color" value={currentPage.bgColor || '#1a1a22'}
                onChange={e => patchPage({ bgColor: e.target.value, bgType: 'color' })}
                title="Canvas background color"
                style={{ width: 24, height: 24, padding: 0, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', background: 'none', flexShrink: 0 }} />
              <D />
              <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0 }}>Page {activePage + 1}/{pages.length}</span>
            </>
          );
        })()}
        {selectedIds.length <= 1 && selectedId === '__bg__' && (() => {
          const D = () => <div style={{ width: 1, height: 22, background: t.border, margin: '0 4px', flexShrink: 0 }} />;
          return (
            <>
              <span style={{ fontSize: 12, color: t.text, flexShrink: 0 }}>Background</span>
              <D />
              <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0 }}>Color</span>
              <input type="color" value={currentPage.bgColor || '#1a1a22'}
                onChange={e => patchPage({ bgColor: e.target.value, bgType: 'color' })}
                style={{ width: 24, height: 24, padding: 0, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', background: 'none', flexShrink: 0 }} />
              <D />
              <button onMouseDown={e => { e.preventDefault(); setActiveLeftTool('background'); }} title="Open Design panel"
                style={{ height: 30, padding: '0 10px', border: 'none', borderRadius: 6, background: 'transparent', color: t.text, fontSize: 13, cursor: 'pointer', flexShrink: 0, transition: 'background 80ms' }}
                onMouseEnter={e => e.currentTarget.style.background = t.input} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                More options ›
              </button>
            </>
          );
        })()}

        {/* ── TEXT selected ── */}
        {selectedIds.length <= 1 && selectedEl?.type === 'text' && (() => {
          const isBold   = (selectedEl.fontStyle || '').includes('bold');
          const isItalic = (selectedEl.fontStyle || '').includes('italic');
          const isUnder  = selectedEl.textDecoration === 'underline';
          const isStrike = selectedEl.textDecoration === 'line-through';
          const textXform = selectedEl.textTransform || 'none';
          const isUpper  = textXform !== 'none';
          const TEXT_XFORM_CYCLE = { none: 'uppercase', uppercase: 'lowercase', lowercase: 'capitalize', capitalize: 'none' };
          const TEXT_XFORM_LABEL = { none: 'Aa', uppercase: 'AA', lowercase: 'aa', capitalize: 'Ab' };
          const TEXT_XFORM_TIP   = { none: 'Text case: Normal', uppercase: 'Text case: UPPERCASE', lowercase: 'Text case: lowercase', capitalize: 'Text case: Title Case' };
          const D = () => <div style={{ width: 1, height: 24, background: t.border, margin: '0 8px', flexShrink: 0 }} />;
          const Btn = ({ label, active, onClick, title, extraStyle = {} }) => (
            <button onClick={onClick} title={title}
              style={{ height: 32, minWidth: 32, padding: '0 8px', border: 'none', borderRadius: 8,
                background: active ? t.primaryBg : 'transparent',
                color: active ? t.primary : t.textSecondary, fontSize: 13, cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)', ...extraStyle }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.color = t.text; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textSecondary; } }}>
              {label}
            </button>
          );
          const AlignLIcon = () => (
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <rect x="0" y="0"  width="14" height="2" rx="1" fill="currentColor"/>
              <rect x="0" y="5"  width="10" height="2" rx="1" fill="currentColor"/>
              <rect x="0" y="10" width="12" height="2" rx="1" fill="currentColor"/>
            </svg>
          );
          const AlignCIcon = () => (
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <rect x="0" y="0"  width="14" height="2" rx="1" fill="currentColor"/>
              <rect x="2" y="5"  width="10" height="2" rx="1" fill="currentColor"/>
              <rect x="1" y="10" width="12" height="2" rx="1" fill="currentColor"/>
            </svg>
          );
          const AlignRIcon = () => (
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <rect x="0" y="0"  width="14" height="2" rx="1" fill="currentColor"/>
              <rect x="4" y="5"  width="10" height="2" rx="1" fill="currentColor"/>
              <rect x="2" y="10" width="12" height="2" rx="1" fill="currentColor"/>
            </svg>
          );
          const TEXT_EFFECTS = [
            { id: 'none',      label: 'None',      preview: 'Aa', previewStyle: { color:'#fff', textShadow:'none', WebkitTextStroke:'0' },
              patch: { shadow: { enabled: false }, outline: { enabled: false }, textBg: { enabled: false, opacity: 0 } } },
            { id: 'shadow',    label: 'Shadow',    preview: 'Aa', previewStyle: { color:'#fff', textShadow:'3px 3px 4px rgba(0,0,0,0.8)' },
              patch: { shadow: { enabled: true, color: '#000000', blur: 6, offsetX: 3, offsetY: 3 } } },
            { id: 'lift',      label: 'Lift',      preview: 'Aa', previewStyle: { color:'#fff', textShadow:'0 6px 12px rgba(0,0,0,0.6)' },
              patch: { shadow: { enabled: true, color: '#000000', blur: 12, offsetX: 0, offsetY: 6 } } },
            { id: 'outline',   label: 'Outline',   preview: 'Aa', previewStyle: { color:'transparent', WebkitTextStroke:'1.5px #fff' },
              patch: { fill: 'transparent', fillType: 'solid', outline: { enabled: true, color: '#ffffff', width: 4 } } },
            { id: 'neon',      label: 'Neon',      preview: 'Aa', previewStyle: { color:TEAL, textShadow:'0 0 10px #00C4CC, 0 0 20px #00C4CC' },
              patch: { fill: TEAL, fillType: 'solid', shadow: { enabled: true, color: TEAL, blur: 18, offsetX: 0, offsetY: 0 } } },
            { id: 'sticker',   label: 'Sticker',   preview: 'Aa', previewStyle: { color:'#111', WebkitTextStroke:'6px #fff', paintOrder:'stroke' },
              patch: { fill: '#111111', fillType: 'solid', outline: { enabled: true, color: '#ffffff', width: 8 } } },
            { id: 'highlight', label: 'Highlight', preview: 'Aa', previewStyle: { color:'#111', background:'#ffe234', borderRadius:3, padding:'0 4px' },
              patch: { fill: '#111111', fillType: 'solid', textBg: { enabled: true, color: '#ffe234', opacity: 1, padding: 8, radius: 4 } } },
            { id: 'glitch',    label: 'Glitch',    preview: 'Aa', previewStyle: { color:'#fff', textShadow:'-2px 0 #ff0080, 2px 0 #00ffff' },
              patch: { fill: '#ffffff', fillType: 'solid', shadow: { enabled: true, color: '#ff0080', blur: 0, offsetX: -3, offsetY: 0 } } },
          ];
          return (
            <>
              {/* Font family */}
              <select value={selectedEl.fontFamily || 'Inter'} onChange={e => handleElementChange({ ...selectedEl, fontFamily: e.target.value })}
                style={{ height: 34, padding: '0 8px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, maxWidth: 140, cursor: 'pointer', flexShrink: 0, fontFamily: selectedEl.fontFamily || 'Inter' }}>
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              {/* Font size – n + */}
              <div style={{ display: 'flex', alignItems: 'center', background: t.input, borderRadius: 8, marginLeft: 4, overflow: 'hidden' }}>
                <button onMouseDown={e => { e.preventDefault(); handleElementChange({ ...selectedEl, fontSize: Math.max(8, (selectedEl.fontSize || 36) - 1) }); }}
                  style={{ width: 26, height: 34, border: 'none', background: 'transparent', color: t.text, fontSize: 16, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>–</button>
                <input type="number" value={selectedEl.fontSize || 36} min={8} max={400}
                  onChange={e => handleElementChange({ ...selectedEl, fontSize: parseInt(e.target.value) || 36 })}
                  onBlur={() => pushHistory()}
                  style={{ width: 44, height: 34, border: 'none', background: 'transparent', color: t.text, fontSize: 13, textAlign: 'center', outline: 'none' }} />
                <button onMouseDown={e => { e.preventDefault(); handleElementChange({ ...selectedEl, fontSize: Math.min(400, (selectedEl.fontSize || 36) + 1) }); }}
                  style={{ width: 26, height: 34, border: 'none', background: 'transparent', color: t.text, fontSize: 16, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              <D />
              {/* Text color swatch */}
              <ColorPickerButton
                value={selectedEl.fill || '#ffffff'}
                onChange={c => pickColor(c, color => updateElement({ ...selectedEl, fill: color, fillType: 'solid' }))}
                onCommit={() => pushHistory()}
                recentColors={recentColors}
              />
              {/* Gradient text toggle */}
              <Btn label={<><span style={{display:'inline-block',width:12,height:12,borderRadius:2,background:'linear-gradient(135deg,#00C4CC,#7C5CFC)',flexShrink:0,border:'1px solid rgba(255,255,255,0.15)'}}/>&nbsp;Grad</>} active={selectedEl.fillType === 'gradient'}
                onClick={() => {
                  if (selectedEl.fillType === 'gradient') {
                    pushHistory(); updateElement({ ...selectedEl, fillType: 'solid' });
                  } else {
                    pushHistory(); updateElement({ ...selectedEl, fillType: 'gradient',
                      fillGradient: selectedEl.fillGradient || { c1: selectedEl.fill || '#7C5CFC', c2: '#9B7FFF', angle: 135 } });
                  }
                }} />
              {selectedEl.fillType === 'gradient' && selectedEl.fillGradient && (
                <>
                  <ColorPickerButton value={selectedEl.fillGradient.c1 || '#7C5CFC'}
                    onChange={c => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, c1: c } })}
                    onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                  <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0 }}>→</span>
                  {selectedEl.fillGradient.midColor
                    ? <ColorPickerButton value={selectedEl.fillGradient.midColor}
                        onChange={c => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, midColor: c } })}
                        onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                    : <button title="Add mid color stop" onClick={() => { pushHistory(); updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, midColor: '#ffffff', midStop: 0.5 } }); }}
                        style={{ width: 18, height: 18, borderRadius: '50%', border: `1px dashed ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 11, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
                  }
                  {selectedEl.fillGradient.midColor && (
                    <>
                      <input type="range" min={0} max={100} step={5} value={Math.round((selectedEl.fillGradient.midStop ?? 0.5) * 100)}
                        onChange={e => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, midStop: parseInt(e.target.value) / 100 } })}
                        onMouseUp={() => pushHistory()}
                        title="Mid stop position"
                        style={{ width: 44, flexShrink: 0, accentColor: t.primary }} />
                      <button title="Remove mid color" onClick={() => { pushHistory(); const { midColor, midStop, ...rest } = selectedEl.fillGradient; updateElement({ ...selectedEl, fillGradient: rest }); }}
                        style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', background: t.border, color: t.textMuted, fontSize: 10, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                      <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0 }}>→</span>
                    </>
                  )}
                  <ColorPickerButton value={selectedEl.fillGradient.c2 || TEAL}
                    onChange={c => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, c2: c } })}
                    onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                </>
              )}
              <D />
              {/* B I U S aA */}
              <Btn label="B" active={isBold} extraStyle={{ fontWeight: 700 }}
                onClick={() => { const c = selectedEl.fontStyle||'normal'; handleElementChange({ ...selectedEl, fontStyle: isBold ? c.replace('bold','').trim()||'normal' : c==='normal'?'bold':`${c} bold` }); }} />
              <Btn label="I" active={isItalic} extraStyle={{ fontStyle: 'italic' }}
                onClick={() => { const c = selectedEl.fontStyle||'normal'; handleElementChange({ ...selectedEl, fontStyle: isItalic ? c.replace('italic','').trim()||'normal' : c==='normal'?'italic':`${c} italic` }); }} />
              <Btn label="U" active={isUnder}  extraStyle={{ textDecoration: 'underline' }}
                onClick={() => handleElementChange({ ...selectedEl, textDecoration: isUnder ? '' : 'underline' })} />
              <Btn label="S" active={isStrike} extraStyle={{ textDecoration: 'line-through' }}
                onClick={() => handleElementChange({ ...selectedEl, textDecoration: isStrike ? '' : 'line-through' })} />
              <button
                onMouseEnter={e => showTip(e, TEXT_XFORM_TIP[textXform])}
                onMouseLeave={hideTip}
                onClick={() => handleElementChange({ ...selectedEl, textTransform: TEXT_XFORM_CYCLE[textXform] })}
                style={{ height: 32, minWidth: 32, padding: '0 8px', border: 'none', borderRadius: 8, background: isUpper ? t.primaryBg : 'transparent', color: isUpper ? t.primary : t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)', letterSpacing: '0.04em' }}
                onMouseEnter={e => { if (!isUpper) { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.color = t.text; } }}
                onMouseLeave={e => { if (!isUpper) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textSecondary; } }}>
                {TEXT_XFORM_LABEL[textXform]}
              </button>
              <D />
              {/* Horizontal alignment — SVG paragraph icons */}
              {[['left', <AlignLIcon />], ['center', <AlignCIcon />], ['right', <AlignRIcon />]].map(([a, icon]) => (
                <Btn key={a} label={icon} active={selectedEl.align === a} onClick={() => handleElementChange({ ...selectedEl, align: a })} title={`Align ${a}`} />
              ))}
              {/* Vertical alignment */}
              {[['top',<IcoTxtTop size={13}/>,'Align text top'],['middle',<IcoTxtMid size={13}/>,'Align text middle'],['bottom',<IcoTxtBot size={13}/>,'Align text bottom']].map(([v,icon,lbl]) => (
                <Btn key={v} label={icon} active={(selectedEl.verticalAlign||'middle') === v}
                  title={lbl}
                  onClick={() => handleElementChange({ ...selectedEl, verticalAlign: v })} />
              ))}
              <D />
              {/* Emoji picker */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label={<IcoEmoji size={14}/>} active={showEmojiPanel}
                  onClick={e => { setPanelAnchor(e.currentTarget.getBoundingClientRect()); setShowEmojiPanel(p => !p); setShowShadowPanel(false); setShowOutlinePanel(false); setShowMorePanel(false); }} />
                {showEmojiPanel && panelAnchor && createPortal(
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setShowEmojiPanel(false)} />
                    <div style={{ position: 'fixed', top: panelAnchor.bottom + 4, left: Math.min(panelAnchor.left, window.innerWidth - 292), zIndex: 9999, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '8px 10px', width: 280, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8, borderBottom: `1px solid ${t.border}`, paddingBottom: 6 }}>
                        {EMOJI_SETS.map((s, i) => (
                          <button key={s.label} onClick={() => setEmojiCat(i)}
                            style={{ flex: 1, padding: '3px 0', border: 'none', borderRadius: 5, background: emojiCat === i ? t.primaryBg : 'transparent', color: emojiCat === i ? t.primary : t.textMuted, fontSize: 11, cursor: 'pointer', fontWeight: emojiCat === i ? 600 : 400 }}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
                        {EMOJI_SETS[emojiCat].list.map(em => (
                          <button key={em} onClick={() => {
                            pushHistory();
                            handleElementChange({ ...selectedEl, text: (selectedEl.text || '') + em });
                            setShowEmojiPanel(false);
                          }} style={{ width: 30, height: 30, border: 'none', borderRadius: 5, background: 'transparent', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 80ms' }}
                            onMouseEnter={e => e.currentTarget.style.background = t.input}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>,
                  document.body
                )}
              </div>
              <D />
              {/* ✦ Brand nudge — show if element color/font differs from brand */}
              {(() => {
                if (!brandProfile) return null;
                const bc = brandProfile?.brand_colors || {};
                const bPrimary = bc.primary || '#00C4CC';
                const needsColor = selectedEl.fillType !== 'gradient' && selectedEl.fill && selectedEl.fill.toLowerCase() !== bPrimary.toLowerCase();
                const needsFont = selectedEl.fontFamily && selectedEl.fontFamily !== 'Bebas Neue';
                if (!needsColor && !needsFont) return null;
                return (
                  <button
                    onClick={() => {
                      pushHistory();
                      const patch = {};
                      if (needsColor) patch.fill = bPrimary;
                      if (needsFont) patch.fontFamily = 'Bebas Neue';
                      updateElement({ ...selectedEl, ...patch });
                    }}
                    title="Apply your brand colors and fonts"
                    style={{
                      height: 32, padding: '0 10px', border: `1px solid ${t.primaryBorder}`, borderRadius: 8,
                      background: t.primaryBg, color: t.primary,
                      fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center',
                      gap: 4, flexShrink: 0, whiteSpace: 'nowrap', fontWeight: 600,
                    }}
                  >
                    ✦ Brand
                  </button>
                );
              })()}
              {/* ✦ AI Improve */}
              <button
                onClick={aiImproveText}
                disabled={aiImproving}
                style={{
                  height: 34, padding: '0 10px', border: 'none', borderRadius: 7,
                  background: aiImproving ? 'rgba(124,92,252,0.1)' : 'transparent',
                  color: aiImproving ? '#7C5CFC' : t.textMuted,
                  fontSize: 12, cursor: aiImproving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  transition: 'background 80ms, color 80ms', whiteSpace: 'nowrap',
                }}
              >
                {aiImproving ? '...' : '✦ Improve'}
              </button>
              <D />
              {/* Effects — stub button (visual parity with Canva) */}
              <button
                style={{ height: 32, padding: '0 10px', border: 'none', borderRadius: 8, background: 'transparent', color: t.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0, transition: 'all 120ms ease', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.color = t.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textSecondary; }}>
                Effects
              </button>
              {/* Animate — stub button (visual parity with Canva) */}
              <button
                style={{ height: 32, padding: '0 10px', border: 'none', borderRadius: 8, background: 'transparent', color: t.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0, transition: 'all 120ms ease', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.color = t.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textSecondary; }}>
                Animate
              </button>
              {/* Position — opens the Position left flyout panel */}
              <button
                onClick={() => { setActiveLeftTool('position'); setPanelOpen(true); }}
                style={{ height: 32, padding: '0 10px', border: 'none', borderRadius: 8, background: activeLeftTool === 'position' ? t.primaryBg : 'transparent', color: activeLeftTool === 'position' ? t.primary : t.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0, transition: 'all 120ms ease', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { if (activeLeftTool !== 'position') { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.color = t.text; } }}
                onMouseLeave={e => { if (activeLeftTool !== 'position') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textSecondary; } }}>
                Position
              </button>
              {/* ⋯ More — all advanced text controls in one panel */}
              <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button onClick={e => {
                  setPanelAnchor(e.currentTarget.getBoundingClientRect());
                  setShowMorePanel(p => !p);
                  setShowEmojiPanel(false);
                }}
                  style={{ height: 32, padding: '0 12px', border: 'none', borderRadius: 8,
                    background: (showMorePanel || selectedEl.shadow?.enabled || selectedEl.outline?.enabled || selectedEl.textBg?.enabled || selectedEl.textCurve) ? t.primaryBg : 'transparent',
                    color: (showMorePanel || selectedEl.shadow?.enabled || selectedEl.outline?.enabled || selectedEl.textBg?.enabled || selectedEl.textCurve) ? t.primary : t.textSecondary,
                    fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)' }}>
                  ⋯ More
                </button>
                {showMorePanel && panelAnchor && createPortal(
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setShowMorePanel(false)} />
                    <div style={{ position: 'fixed', top: panelAnchor.bottom + 4, right: Math.max(4, window.innerWidth - panelAnchor.right), zIndex: 9999, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px', width: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.24)', animation: 'dropdownIn 150ms ease forwards', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>

                      {/* Effects presets */}
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Effects</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
                        {TEXT_EFFECTS.map(fx => (
                          <button key={fx.id} onClick={() => { pushHistory(); updateElement({ ...selectedEl, ...fx.patch }); }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px 6px', border: `1px solid ${t.border}`, borderRadius: 8, background: t.input, cursor: 'pointer' }}>
                            <div style={{ width: 44, height: 28, background: '#1a1a2e', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'sans-serif', ...fx.previewStyle }}>{fx.preview}</span>
                            </div>
                            <span style={{ fontSize: 10, color: t.text }}>{fx.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Shadow */}
                      <div style={{ height: 1, background: t.border, margin: '0 0 12px' }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectedEl.shadow?.enabled ? 10 : 12, fontSize: 13, color: t.text, cursor: 'pointer', fontWeight: 500 }}>
                        <input type="checkbox" checked={selectedEl.shadow?.enabled || false}
                          onChange={e => handleElementChange({ ...selectedEl, shadow: { ...(selectedEl.shadow||{}), enabled: e.target.checked } })} />
                        Shadow
                      </label>
                      {selectedEl.shadow?.enabled && (
                        <div style={{ marginBottom: 12, paddingLeft: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 11, color: t.textMuted, minWidth: 52 }}>Color</span>
                            <input type="color" value={selectedEl.shadow?.color || '#000000'}
                              onChange={e => updateElement({ ...selectedEl, shadow: { ...selectedEl.shadow, color: e.target.value } })}
                              onBlur={() => pushHistory()} style={{ width: 28, height: 22, cursor: 'pointer', borderRadius: 4, border: `1px solid ${t.border}` }} />
                          </div>
                          {[{lbl:'Blur',k:'blur',mn:0,mx:40,def:4},{lbl:'Offset X',k:'offsetX',mn:-30,mx:30,def:2},{lbl:'Offset Y',k:'offsetY',mn:-30,mx:30,def:2}].map(({lbl,k,mn,mx,def}) => (
                            <div key={k} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                              <span style={{ fontSize:11, color:t.textMuted, minWidth:52 }}>{lbl}</span>
                              <input type="range" min={mn} max={mx} value={selectedEl.shadow?.[k]??def}
                                onChange={e => updateElement({ ...selectedEl, shadow:{...(selectedEl.shadow||{}),[k]:parseInt(e.target.value)}})}
                                onMouseUp={() => pushHistory()} style={{ flex:1, accentColor:t.primary }} />
                              <span style={{ fontSize:11, color:t.textMuted, minWidth:22, textAlign:'right' }}>{selectedEl.shadow?.[k]??def}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Outline */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectedEl.outline?.enabled ? 10 : 12, fontSize: 13, color: t.text, cursor: 'pointer', fontWeight: 500 }}>
                        <input type="checkbox" checked={selectedEl.outline?.enabled || false}
                          onChange={e => handleElementChange({ ...selectedEl, outline: {...(selectedEl.outline||{}), enabled: e.target.checked} })} />
                        Outline
                      </label>
                      {selectedEl.outline?.enabled && (
                        <div style={{ marginBottom: 12, paddingLeft: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 11, color: t.textMuted, minWidth: 52 }}>Color</span>
                            <input type="color" value={selectedEl.outline?.color||'#000000'}
                              onChange={e => updateElement({...selectedEl, outline:{...selectedEl.outline, color:e.target.value}})}
                              onBlur={() => pushHistory()} style={{ width: 28, height: 22, cursor: 'pointer', borderRadius: 4, border: `1px solid ${t.border}` }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: t.textMuted, minWidth: 52 }}>Width</span>
                            <input type="range" min={1} max={20} value={selectedEl.outline?.width??1}
                              onChange={e => updateElement({...selectedEl, outline:{...(selectedEl.outline||{}), width:parseInt(e.target.value)}})}
                              onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: t.primary }} />
                            <span style={{ fontSize:11, color:t.textMuted, minWidth:22, textAlign:'right' }}>{selectedEl.outline?.width??1}</span>
                          </div>
                        </div>
                      )}

                      {/* Highlight */}
                      <div style={{ height: 1, background: t.border, margin: '0 0 12px' }} />
                      <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 8 }}>Highlight</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <input type="color" value={selectedEl.textBg?.color || '#ffff00'}
                          onChange={e => updateElement({ ...selectedEl, textBg: { ...(selectedEl.textBg||{}), enabled: true, color: e.target.value, opacity: selectedEl.textBg?.opacity ?? 1 } })}
                          onBlur={() => pushHistory()} style={{ width: 28, height: 22, cursor: 'pointer', borderRadius: 4, border: `1px solid ${t.border}`, flexShrink: 0 }} />
                        <input type="range" min={0} max={1} step={0.05}
                          value={selectedEl.textBg?.enabled ? (selectedEl.textBg?.opacity ?? 1) : 0}
                          onChange={e => { const v = parseFloat(e.target.value); updateElement({ ...selectedEl, textBg: { ...(selectedEl.textBg||{}), enabled: v > 0, color: selectedEl.textBg?.color || '#ffff00', opacity: v } }); }}
                          onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: t.primary }} />
                        {selectedEl.textBg?.enabled && (
                          <button onMouseDown={e => { e.preventDefault(); pushHistory(); updateElement({ ...selectedEl, textBg: { ...selectedEl.textBg, enabled: false, opacity: 0 } }); }}
                            style={{ width: 20, height: 20, border: 'none', borderRadius: 4, background: t.input, color: t.textMuted, fontSize: 12, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        )}
                      </div>

                      {/* Spacing */}
                      <div style={{ height: 1, background: t.border, margin: '0 0 12px' }} />
                      <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 10 }}>Spacing</div>
                      {[
                        { lbl: 'Letters', k: 'letterSpacing', min: -10, max: 40, step: 0.5, def: 0, fmt: v => `${v}px` },
                        { lbl: 'Line height', k: 'lineHeight', min: 0.5, max: 4, step: 0.05, def: 1.2, fmt: v => v.toFixed(2) },
                      ].map(({ lbl, k, min, max, step, def, fmt }) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: t.textMuted, minWidth: 64 }}>{lbl}</span>
                          <input type="range" min={min} max={max} step={step} value={selectedEl?.[k] ?? def}
                            onChange={e => updateElement({ ...selectedEl, [k]: parseFloat(e.target.value) })}
                            onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: t.primary }} />
                          <span style={{ fontSize:11, color:t.textMuted, minWidth:30, textAlign:'right' }}>{fmt(selectedEl?.[k] ?? def)}</span>
                        </div>
                      ))}

                      {/* Curve */}
                      <div style={{ height: 1, background: t.border, margin: '4px 0 12px' }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: selectedEl.textCurve ? 10 : 14 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>Curve text</span>
                        <button onClick={() => { pushHistory(); updateElement({ ...selectedEl, textCurve: selectedEl.textCurve ? undefined : 200 }); }}
                          style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${selectedEl.textCurve ? t.primaryBorder : t.border}`, background: selectedEl.textCurve ? t.primaryBg : 'transparent', color: selectedEl.textCurve ? t.primary : t.textSecondary, fontSize: 12, cursor: 'pointer', fontWeight: 500, transition: 'all 120ms ease' }}>
                          {selectedEl.textCurve ? '✕ Remove' : '⌒ Add'}
                        </button>
                      </div>
                      {selectedEl.textCurve && (
                        <div style={{ paddingLeft: 4, marginBottom: 14 }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            {[['⌒', 'Up', 1], ['⌣', 'Down', -1]].map(([icon, label, dir]) => (
                              <button key={dir} onClick={() => { pushHistory(); updateElement({ ...selectedEl, textCurve: dir * Math.abs(selectedEl.textCurve || 200) }); }}
                                style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: `1px solid ${(selectedEl.textCurve > 0 ? 1 : -1) === dir ? t.primaryBorder : t.border}`, background: (selectedEl.textCurve > 0 ? 1 : -1) === dir ? t.primaryBg : t.input, color: (selectedEl.textCurve > 0 ? 1 : -1) === dir ? t.primary : t.textSecondary, fontSize: 14, cursor: 'pointer', transition: 'all 120ms ease' }}>
                                {icon} {label}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: t.textMuted, minWidth: 64 }}>Curvature</span>
                            <input type="range" min={60} max={600} step={10}
                              value={Math.abs(selectedEl.textCurve || 200)}
                              onChange={e => updateElement({ ...selectedEl, textCurve: (selectedEl.textCurve < 0 ? -1 : 1) * parseInt(e.target.value) })}
                              onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: t.primary }} />
                          </div>
                        </div>
                      )}

                      {/* Opacity + Blend */}
                      <div style={{ height: 1, background: t.border, margin: '0 0 12px' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: t.textMuted, minWidth: 52 }}>Opacity</span>
                        <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity ?? 1}
                          onChange={e => updateElement({ ...selectedEl, opacity: parseFloat(e.target.value) })}
                          onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: t.primary }} />
                        <span style={{ fontSize: 11, color: t.textMuted, minWidth: 30, textAlign: 'right' }}>{Math.round((selectedEl.opacity ?? 1) * 100)}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectedEl.fillType === 'gradient' ? 10 : 0 }}>
                        <span style={{ fontSize: 11, color: t.textMuted, minWidth: 52 }}>Blend</span>
                        <select value={selectedEl.blendMode || 'source-over'}
                          onChange={e => { pushHistory(); patchElements(p => p.map(el => el.id === selectedEl.id ? { ...el, blendMode: e.target.value } : el)); }}
                          style={{ flex: 1, height: 28, padding: '0 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, cursor: 'pointer' }}>
                          {BLEND_MODES.map(m => <option key={m} value={m}>{BLEND_LABELS[m]}</option>)}
                        </select>
                      </div>
                      {selectedEl.fillType === 'gradient' && selectedEl.fillGradient && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                          <span style={{ fontSize: 11, color: t.textMuted, minWidth: 52 }}>Angle</span>
                          <select value={selectedEl.fillGradient.angle ?? 135}
                            onChange={e => { pushHistory(); updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, angle: parseInt(e.target.value) } }); }}
                            style={{ flex: 1, height: 28, padding: '0 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, cursor: 'pointer' }}>
                            {[0,45,90,135,180,225,270,315].map(a => <option key={a} value={a}>{a}°</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  </>,
                  document.body
                )}
              </div>
            </>
          );
        })()}

        {/* ── IMAGE selected ── */}
        {selectedIds.length <= 1 && selectedEl?.type === 'image' && (() => {
          const D = () => <div style={{ width:1, height:22, background:t.border, margin:'0 4px', flexShrink:0 }} />;
          const Btn = ({ label, active, onClick }) => (
            <button onClick={onClick} style={{ height:30, padding:'0 9px', border:'none', borderRadius:8, background:active?t.primaryBg:'transparent', color:active?t.primary:t.textSecondary, fontSize:13, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4, transition:'all 150ms cubic-bezier(0.34,1.56,0.64,1)' }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.color = t.text; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textSecondary; } }}
            >{label}</button>
          );
          return (
            <>
              <Btn label={<><IcoReplace size={14} /> Replace</>} active={false} onClick={() => { replaceImgId.current = null; replaceFileRef.current?.click(); }} title="Replace image (or double-click)" />
              <Btn label="Set as BG" active={false} onClick={() => setElementAsBackground(selectedEl)} />
              <D />
              {/* Color tint */}
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Tint</span>
              <ColorPickerButton
                value={selectedEl.tintColor || '#000000'}
                onChange={c => updateElement({ ...selectedEl, tintColor: c, tintOpacity: selectedEl.tintOpacity ?? 0.5 })}
                onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
              <input type="range" min={0} max={1} step={0.05} value={selectedEl.tintOpacity ?? 0}
                onChange={e => { const v = parseFloat(e.target.value); updateElement({ ...selectedEl, tintOpacity: v, tintColor: selectedEl.tintColor || '#000000' }); }}
                onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0, accentColor:t.primary }} />
              <button onMouseDown={e => { e.preventDefault(); pushHistory(); updateElement({ ...selectedEl, tintOpacity: 0, tintColor: undefined }); }}
                style={{ height:24, padding:'0 6px', border:`1px solid ${t.border}`, borderRadius:5, background:'transparent', color:t.textMuted, fontSize:11, cursor:'pointer', flexShrink:0 }} title="Remove tint">×</button>
              <D />
              <Btn label={<><IcoFlipH size={14} /> Flip H</>} active={!!selectedEl.flipH} onClick={flipH} />
              <Btn label={<><IcoFlipV size={14} /> Flip V</>} active={!!selectedEl.flipV} onClick={flipV} />
              <D />
              <Btn label={<><IcoFit size={14} /> Fit page</>}  active={false} onClick={fitToPage}  />
              <Btn label="Fill page" active={false} onClick={fillPage} />
              <D />
              {/* Frame / shape clip presets */}
              {[
                { label: '▭', title: 'No frame',    ft: null },
                { label: '▢', title: 'Rounded',     ft: 'rounded' },
                { label: '●', title: 'Circle',      ft: 'circle' },
                { label: '⬡', title: 'Hexagon',     ft: 'hexagon' },
                { label: '◆', title: 'Diamond',     ft: 'diamond' },
                { label: '▲', title: 'Triangle',    ft: 'triangle' },
                { label: '★', title: 'Star',         ft: 'star' },
              ].map(({ label, title, ft }) => {
                const active = (selectedEl.frameType || null) === ft;
                return (
                  <button key={title} title={title} onMouseDown={e => { e.preventDefault(); pushHistory(); updateElement({ ...selectedEl, frameType: ft, cornerRadius: 0 }); }}
                    style={{ height:28, padding:'0 8px', border:`1px solid ${active ? t.primaryBorder : t.border}`, borderRadius:6, background: active ? t.primaryBg : 'transparent', color: active ? t.primary : t.textSecondary, fontSize:14, cursor:'pointer', flexShrink:0, transition:'all 150ms cubic-bezier(0.34,1.56,0.64,1)' }}>
                    {label}
                  </button>
                );
              })}
              {(!selectedEl.frameType || selectedEl.frameType === 'none') && <>
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Radius</span>
                <input type="range" min={0} max={200} value={selectedEl.cornerRadius||0}
                  onChange={e => updateElement({...selectedEl, cornerRadius:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:70, flexShrink:0 }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.cornerRadius||0}</span>
              </>}
              <D />
              {/* Image border */}
              <Btn label="Border" active={!!selectedEl.borderEnabled}
                onClick={() => handleElementChange({...selectedEl, borderEnabled: !selectedEl.borderEnabled, borderColor: selectedEl.borderColor||'#ffffff', borderWidth: selectedEl.borderWidth||3})} />
              {selectedEl.borderEnabled && <>
                <ColorPickerButton
                  value={selectedEl.borderColor || '#ffffff'}
                  onChange={c => pickColor(c, color => updateElement({ ...selectedEl, borderColor: color }))}
                  onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                <input type="range" min={1} max={30} value={selectedEl.borderWidth||3}
                  onChange={e => updateElement({...selectedEl, borderWidth:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.borderWidth||3}px</span>
                {[['solid','─'],['dashed','╌'],['dotted','···']].map(([s,icon]) => (
                  <button key={s} title={s.charAt(0).toUpperCase()+s.slice(1)} onClick={() => { pushHistory(); updateElement({...selectedEl, borderStyle: s}); }}
                    style={{ height:26, padding:'0 8px', border:`1px solid ${(selectedEl.borderStyle||'solid')===s?t.primaryBorder:t.border}`, borderRadius:6, background:(selectedEl.borderStyle||'solid')===s?t.primaryBg:'transparent', color:(selectedEl.borderStyle||'solid')===s?t.primary:t.textSecondary, fontSize:13, cursor:'pointer', flexShrink:0, letterSpacing:'0.05em', transition:'all 120ms ease' }}>
                    {icon}
                  </button>
                ))}
              </>}
              <D />
              <Btn label={<><IcoBringFwd size={14} /> Fwd</>}   active={false} onClick={() => bringForward()} />
              <Btn label={<><IcoSendBack size={14} /> Back</>}  active={false} onClick={() => sendBackward()} />
              <Btn label="Front" active={false} onClick={() => bringToFront()} />
              <Btn label="Back"  active={false} onClick={() => sendToBack()} />
              <D />
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Opacity</span>
              <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity??1}
                onChange={e => updateElement({...selectedEl, opacity:parseFloat(e.target.value)})}
                onMouseUp={() => pushHistory()} style={{ width:70, flexShrink:0 }} />
              <span style={{ fontSize:11, color:t.textMuted, minWidth:30, flexShrink:0 }}>{Math.round((selectedEl.opacity??1)*100)}%</span>
              <D />
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Blend</span>
              <select value={selectedEl.blendMode||'source-over'} onChange={e => { pushHistory(); patchElements(p => p.map(el => el.id===selectedEl.id ? {...el, blendMode:e.target.value} : el)); }} style={{ height:24, padding:'0 3px', borderRadius:5, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:11, cursor:'pointer', flexShrink:0, maxWidth:90 }}>
                {BLEND_MODES.map(m => <option key={m} value={m}>{BLEND_LABELS[m]}</option>)}
              </select>
              <D />
              <Btn label={lockedIds.has(selectedEl.id)?<IpLock size={13}/>:<IpUnlock size={13}/>} active={lockedIds.has(selectedEl.id)} onClick={() => toggleLocked(selectedEl.id)} />
              <D />
              {/* Image Filter presets panel */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="◐ Filter" active={showFilterPanel || !!(selectedEl.filterPreset && selectedEl.filterPreset !== 'normal') || !!selectedEl.duotone?.enabled}
                  onClick={e => { setPanelAnchor(e.currentTarget.getBoundingClientRect()); setShowFilterPanel(p => !p); setShowAdjustPanel(false); setShowCropPanel(false); setShowPositionPanel(false); setShowAnimatePanel(false); }} />
                {showFilterPanel && selectedEl && panelAnchor && createPortal(
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setShowFilterPanel(false)} />
                    <div style={{ position: 'fixed', top: panelAnchor.bottom + 4, left: Math.min(panelAnchor.left, window.innerWidth - 242), zIndex: 9999, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, width: 230, boxShadow: '0 6px 24px rgba(0,0,0,0.2)', animation: 'dropdownIn 150ms ease forwards' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Filter presets</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                      {Object.entries(FILTER_PRESETS).map(([key, p]) => {
                        const isActive = (selectedEl.filterPreset || 'normal') === key;
                        return (
                          <button key={key}
                            onClick={() => {
                              pushHistory();
                              updateElement({ ...selectedEl, filterPreset: key, brightness: p.brightness, contrast: p.contrast, saturation: p.saturation });
                            }}
                            style={{ padding: '6px 0', borderRadius: 8, border: `1.5px solid ${isActive ? t.primaryBorder : t.border}`, background: isActive ? t.primaryBg : t.input, color: isActive ? t.primary : t.textSecondary, fontSize: 10, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 120ms ease' }}>
                            {key}
                          </button>
                        );
                      })}
                    </div>
                    {/* Duotone section */}
                    <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8, marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>Duotone</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: t.text }}>
                          <input type="checkbox" checked={selectedEl.duotone?.enabled || false}
                            onChange={e => { pushHistory(); updateElement({ ...selectedEl, duotone: { ...(selectedEl.duotone||{}), enabled: e.target.checked, c1: selectedEl.duotone?.c1||'#1a1a22', c2: selectedEl.duotone?.c2||'#7C5CFC' } }); }}
                            style={{ accentColor: t.primary, cursor: 'pointer' }} />
                          On
                        </label>
                      </div>
                      {selectedEl.duotone?.enabled && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <ColorPickerButton value={selectedEl.duotone?.c1 || '#1a1a22'}
                            onChange={c => updateElement({ ...selectedEl, duotone: { ...selectedEl.duotone, c1: c } })}
                            onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                          <span style={{ color: t.textMuted, fontSize: 11 }}>→</span>
                          <ColorPickerButton value={selectedEl.duotone?.c2 || '#7C5CFC'}
                            onChange={c => updateElement({ ...selectedEl, duotone: { ...selectedEl.duotone, c2: c } })}
                            onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {[
                          { c1: '#1a1a22', c2: '#7C5CFC' },
                          { c1: '#1a1a22', c2: '#7C5CFC' },
                          { c1: '#1a1a22', c2: '#f97316' },
                          { c1: '#0c1445', c2: '#ec4899' },
                          { c1: '#000000', c2: '#ffffff' },
                          { c1: '#1e3a1e', c2: '#84cc16' },
                        ].map((pair, i) => {
                          const isOn = selectedEl.duotone?.enabled && selectedEl.duotone?.c1 === pair.c1 && selectedEl.duotone?.c2 === pair.c2;
                          return (
                            <button key={i} title={`${pair.c1} → ${pair.c2}`}
                              onMouseDown={() => { pushHistory(); updateElement({ ...selectedEl, duotone: { enabled: true, c1: pair.c1, c2: pair.c2 } }); }}
                              style={{ width: 30, height: 20, borderRadius: 5, border: `2px solid ${isOn ? t.primary : t.border}`, background: `linear-gradient(90deg, ${pair.c1} 0%, ${pair.c2} 100%)`, cursor: 'pointer', padding: 0 }} />
                          );
                        })}
                      </div>
                    </div>
                    </div>
                  </>,
                  document.body
                )}
              </div>
              {/* Image Adjust panel */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="◑ Adjust" active={showAdjustPanel || (selectedEl.brightness||0)!==0 || (selectedEl.contrast||0)!==0 || (selectedEl.saturation||0)!==0 || (selectedEl.blur||0)>0}
                  onClick={e => { setPanelAnchor(e.currentTarget.getBoundingClientRect()); setShowAdjustPanel(p => !p); setShowCropPanel(false); setShowFilterPanel(false); setShowPositionPanel(false); setShowAnimatePanel(false); }} />
                {showAdjustPanel && selectedEl && panelAnchor && createPortal(
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setShowAdjustPanel(false)} />
                    <div style={{ position: 'fixed', top: panelAnchor.bottom + 4, left: Math.min(panelAnchor.left, window.innerWidth - 232), zIndex: 9999, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 220, boxShadow: '0 6px 24px rgba(0,0,0,0.2)', animation: 'dropdownIn 150ms ease forwards' }}>
                    {[
                      { label: 'Brightness', k: 'brightness', min: -1,   max: 1,   step: 0.05, def: 0 },
                      { label: 'Contrast',   k: 'contrast',   min: -100, max: 100, step: 5,    def: 0 },
                      { label: 'Saturation', k: 'saturation', min: -1,   max: 1,   step: 0.05, def: 0 },
                      { label: 'Blur',       k: 'blur',       min: 0,    max: 40,  step: 0.5,  def: 0 },
                    ].map(({ label, k, min, max, step, def }) => (
                      <div key={k} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
                          <span style={{ fontSize: 11, color: t.textMuted }}>{+(selectedEl[k] ?? def).toFixed(2)}</span>
                        </div>
                        <input type="range" min={min} max={max} step={step} value={selectedEl[k] ?? def}
                          onChange={e => updateElement({ ...selectedEl, [k]: parseFloat(e.target.value) })}
                          onMouseUp={() => pushHistory()} style={{ width: '100%', accentColor: t.primary }} />
                      </div>
                    ))}
                    <button onClick={() => { pushHistory(); updateElement({ ...selectedEl, brightness: 0, contrast: 0, saturation: 0, blur: 0 }); }}
                      style={{ width: '100%', padding: '7px 0', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.textMuted, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
                      Reset adjustments
                    </button>
                    </div>
                  </>,
                  document.body
                )}
              </div>
              {/* Crop panel */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="⚟ Crop" active={showCropPanel || (selectedEl.cropTop||0)>0 || (selectedEl.cropBottom||0)>0 || (selectedEl.cropLeft||0)>0 || (selectedEl.cropRight||0)>0}
                  onClick={e => { setPanelAnchor(e.currentTarget.getBoundingClientRect()); setShowCropPanel(p => !p); setShowAdjustPanel(false); setShowFilterPanel(false); setShowPositionPanel(false); setShowAnimatePanel(false); }} />
                {showCropPanel && selectedEl && panelAnchor && createPortal(
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setShowCropPanel(false)} />
                    <div style={{ position: 'fixed', top: panelAnchor.bottom + 4, left: Math.min(panelAnchor.left, window.innerWidth - 232), zIndex: 9999, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 220, boxShadow: '0 6px 24px rgba(0,0,0,0.2)', animation: 'dropdownIn 150ms ease forwards' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 10 }}>Crop edges (%)</div>
                    {[
                      { label: 'Top',    k: 'cropTop'    },
                      { label: 'Bottom', k: 'cropBottom' },
                      { label: 'Left',   k: 'cropLeft'   },
                      { label: 'Right',  k: 'cropRight'  },
                    ].map(({ label, k }) => (
                      <div key={k} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
                          <span style={{ fontSize: 11, color: t.textMuted }}>{(selectedEl[k] || 0).toFixed(0)}%</span>
                        </div>
                        <input type="range" min={0} max={49} step={1} value={selectedEl[k] || 0}
                          onChange={e => updateElement({ ...selectedEl, [k]: parseInt(e.target.value) })}
                          onMouseUp={() => pushHistory()}
                          style={{ width: '100%', accentColor: t.primary }} />
                      </div>
                    ))}
                    <button onClick={() => { pushHistory(); updateElement({ ...selectedEl, cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0 }); }}
                      style={{ width: '100%', padding: '7px 0', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.textMuted, fontSize: 12, cursor: 'pointer' }}>
                      Reset crop
                    </button>
                    </div>
                  </>,
                  document.body
                )}
              </div>
              {/* Shadow panel for images */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="Shadow" active={!!selectedEl.shadow?.enabled}
                  onClick={e => { setPanelAnchor(e.currentTarget.getBoundingClientRect()); setShowShadowPanel(p => !p); setShowAdjustPanel(false); setShowFilterPanel(false); setShowCropPanel(false); setShowPositionPanel(false); setShowAnimatePanel(false); }} />
                {showShadowPanel && panelAnchor && createPortal(
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setShowShadowPanel(false)} />
                    <div style={{ position: 'fixed', top: panelAnchor.bottom + 4, right: Math.max(0, window.innerWidth - panelAnchor.right), zIndex: 9999, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 210, boxShadow: '0 6px 24px rgba(0,0,0,0.2)', animation: 'dropdownIn 150ms ease forwards' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: t.text, cursor: 'pointer', fontWeight: 500 }}>
                        <input type="checkbox" checked={selectedEl.shadow?.enabled || false}
                          onChange={e => handleElementChange({ ...selectedEl, shadow: { ...(selectedEl.shadow||{}), enabled: e.target.checked } })} />
                        Enable shadow
                      </label>
                      {selectedEl.shadow?.enabled && <>
                        <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 4 }}>Color</label>
                        <input type="color" value={selectedEl.shadow?.color || '#000000'}
                          onChange={e => updateElement({ ...selectedEl, shadow: { ...selectedEl.shadow, color: e.target.value } })}
                          onBlur={() => pushHistory()} style={{ width: '100%', height: 28, marginBottom: 10, cursor: 'pointer', borderRadius: 6, border: `1px solid ${t.border}` }} />
                        {[{lbl:'Blur',k:'blur',mn:0,mx:40,def:8},{lbl:'Offset X',k:'offsetX',mn:-30,mx:30,def:4},{lbl:'Offset Y',k:'offsetY',mn:-30,mx:30,def:4}].map(({lbl,k,mn,mx,def}) => (
                          <div key={k} style={{ marginBottom: 8 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                              <span style={{ fontSize:11, color:t.textMuted }}>{lbl}</span>
                              <span style={{ fontSize:11, color:t.textMuted }}>{selectedEl.shadow?.[k]??def}</span>
                            </div>
                            <input type="range" min={mn} max={mx} value={selectedEl.shadow?.[k]??def}
                              onChange={e => updateElement({ ...selectedEl, shadow: {...(selectedEl.shadow||{}), [k]:parseInt(e.target.value)} })}
                              onMouseUp={() => pushHistory()} style={{ width:'100%' }} />
                          </div>
                        ))}
                      </>}
                    </div>
                  </>,
                  document.body
                )}
              </div>
              {/* Remove Background — runs BiRefNet ML model in-browser via @imgly/background-removal (WASM, no API) */}
              <button
                onClick={async () => {
                  if (!selectedEl?.src || bgRemoveLoading) return;
                  setBgRemoveLoading(true);
                  setBgProgress('Loading…');
                  // Safety reset — if something hangs silently, unblock the UI after 3 min
                  const safetyTimer = setTimeout(() => { setBgRemoveLoading(false); setBgProgress(''); }, 180000);
                  try {
                    // Pre-fetch image as Blob so the WASM module never hits CORS issues
                    let imageInput = selectedEl.src;
                    if (!selectedEl.src.startsWith('blob:') && !selectedEl.src.startsWith('data:')) {
                      try {
                        setBgProgress('Fetching image…');
                        const resp = await fetch(selectedEl.src);
                        imageInput = await resp.blob();
                      } catch (_) {
                        // Fall back to URL — library will attempt its own fetch
                        imageInput = selectedEl.src;
                      }
                    }
                    setBgProgress('Starting…');
                    const { removeBackground } = await import('@imgly/background-removal');
                    const resultBlob = await removeBackground(imageInput, {
                      model: 'isnet_quint8', // smallest/fastest quantized model
                      progress: (key, current, total) => {
                        if (key.startsWith('fetch:')) {
                          if (total > 0) {
                            const pct = Math.round((current / total) * 100);
                            setBgProgress(`Downloading model… ${pct}%`);
                          } else {
                            setBgProgress('Downloading model…');
                          }
                        } else if (key.startsWith('compute:')) {
                          setBgProgress('Removing BG…');
                        }
                      },
                    });
                    const url = URL.createObjectURL(resultBlob);
                    // Revoke old blob URL to prevent memory leak
                    if (selectedEl.src?.startsWith('blob:')) URL.revokeObjectURL(selectedEl.src);
                    pushHistory();
                    updateElement({ ...selectedEl, src: url });
                  } catch (e) {
                    console.error('[RemoveBG]', e);
                    alert('Background removal failed. Please try again.');
                  } finally {
                    clearTimeout(safetyTimer);
                    setBgRemoveLoading(false);
                    setBgProgress('');
                  }
                }}
                disabled={bgRemoveLoading}
                title="Remove background (AI model runs in browser — first use downloads ~5MB model)"
                style={{ height: 32, padding: '0 10px', border: `1px solid ${t.border}`, borderRadius: 7, background: t.input, color: t.text, fontSize: 12, cursor: bgRemoveLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, opacity: bgRemoveLoading ? 0.6 : 1 }}>
                {bgRemoveLoading ? `✂ ${bgProgress || 'Removing…'}` : '✂ Remove BG'}
              </button>
              {/* Extract Elements — auto-detects all objects/text/background via Claude vision */}
              <button
                disabled={extractLoading}
                onClick={async () => {
                  if (!selectedEl?.src || extractLoading) return;
                  if (selectedEl.src.startsWith('blob:') || selectedEl.src.startsWith('data:')) {
                    alert('Please save your image first, then use Extract.');
                    return;
                  }
                  setExtractLoading(true);
                  try {
                    const res = await studioAPI.extractElements(selectedEl.src);
                    let detectedEls = res.data?.elements;
                    if (!detectedEls?.length) throw new Error('No elements detected');
                    // Cap at 12 to prevent canvas overload
                    if (detectedEls.length > 12) detectedEls = detectedEls.slice(0, 12);
                    const srcEl = selectedEl;
                    pushHistory();
                    for (const el of detectedEls) {
                      if (el.type === 'background') {
                        patchElements(prev => [...prev, {
                          id: uid(), type: 'rect',
                          x: srcEl.x, y: srcEl.y, width: srcEl.width, height: srcEl.height,
                          fill: el.dominantColor || '#1a1a2e', opacity: 1, rotation: 0, cornerRadius: 0, stroke: null,
                        }]);
                      } else if (el.type === 'text' && el.content && el.boundingBox) {
                        const x = srcEl.x + (el.boundingBox.xPercent / 100) * srcEl.width;
                        const y = srcEl.y + (el.boundingBox.yPercent / 100) * srcEl.height;
                        const w = (el.boundingBox.widthPercent / 100) * srcEl.width;
                        // Clamp font size to a readable range
                        const fontSize = Math.max(10, Math.min(200, el.estimatedFontSize || 24));
                        patchElements(prev => [...prev, {
                          id: uid(), type: 'text', text: String(el.content).replace(/[<>]/g, '').trim(),
                          x, y, width: w, fontSize,
                          fill: el.textColor || '#ffffff', fontFamily: 'Inter',
                          fontWeight: '700', align: 'left', opacity: 1, rotation: 0,
                        }]);
                      } else if (el.type === 'object' && el.boundingBox) {
                        try {
                          const dataUrl = await cropImageRegion(srcEl.src, el.boundingBox);
                          const x = srcEl.x + (el.boundingBox.xPercent / 100) * srcEl.width;
                          const y = srcEl.y + (el.boundingBox.yPercent / 100) * srcEl.height;
                          const w = Math.max(20, (el.boundingBox.widthPercent  / 100) * srcEl.width);
                          const h = Math.max(20, (el.boundingBox.heightPercent / 100) * srcEl.height);
                          patchElements(prev => [...prev, {
                            id: uid(), type: 'image', src: dataUrl,
                            x, y, width: w, height: h, opacity: 1, rotation: 0,
                            flipH: false, flipV: false, cornerRadius: 0,
                          }]);
                        } catch (cropErr) {
                          console.warn('[Extract] crop failed (possible CORS):', cropErr.message);
                        }
                      }
                    }
                    patchElements(prev => prev.filter(e => e.id !== srcEl.id));
                    setSelectedId(null);
                  } catch (err) {
                    console.error('[Extract]', err);
                    alert('Element extraction failed. Please try again.');
                  }
                  setExtractLoading(false);
                }}
                title="Extract image into separate movable elements (AI-powered)"
                style={{ height: 32, padding: '0 10px', border: `1px solid ${t.border}`, borderRadius: 7, background: t.input, color: t.text, fontSize: 12, cursor: extractLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, opacity: extractLoading ? 0.6 : 1 }}>
                {extractLoading ? '…' : '✦ Extract'}
              </button>
            </>
          );
        })()}

        {/* ── SHAPE selected (rect, circle, line, triangle, star, arrow) ── */}
        {selectedIds.length <= 1 && selectedEl && !['text','image'].includes(selectedEl.type) && (() => {
          const D = () => <div style={{ width:1, height:22, background:t.border, margin:'0 4px', flexShrink:0 }} />;
          const Btn = ({ label, active, onClick }) => (
            <button onClick={onClick} style={{ height:30, padding:'0 9px', border:'none', borderRadius:8, background:active?t.primaryBg:'transparent', color:active?t.primary:t.textSecondary, fontSize:13, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4, transition:'all 150ms cubic-bezier(0.34,1.56,0.64,1)' }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.color = t.text; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textSecondary; } }}
            >{label}</button>
          );
          const fillKey = ['line','arrow','draw'].includes(selectedEl.type) ? 'stroke' : 'fill';
          const fillVal = (selectedEl[fillKey] || '#ffffff').startsWith('rgba') ? '#888888' : (selectedEl[fillKey] || '#ffffff');
          return (
            <>
              {/* Fill/stroke color swatch */}
              <ColorPickerButton
                value={fillVal}
                onChange={c => pickColor(c, color => updateElement({ ...selectedEl, [fillKey]: color, fillType: 'solid' }))}
                onCommit={() => pushHistory()}
                recentColors={recentColors}
              />
              {/* Gradient toggle (not for lines/arrows/draw) */}
              {!['line','arrow','draw'].includes(selectedEl.type) && (
                <>
                  <Btn label="⚏ Gradient" active={selectedEl.fillType === 'gradient'}
                    onClick={() => {
                      if (selectedEl.fillType === 'gradient') {
                        pushHistory(); updateElement({ ...selectedEl, fillType: 'solid' });
                      } else {
                        pushHistory(); updateElement({ ...selectedEl, fillType: 'gradient',
                          fillGradient: selectedEl.fillGradient || { c1: selectedEl.fill || '#7C5CFC', c2: '#9B7FFF', angle: 135 } });
                      }
                    }} />
                  {selectedEl.fillType === 'gradient' && selectedEl.fillGradient && (
                    <>
                      <ColorPickerButton
                        value={selectedEl.fillGradient.c1 || '#7C5CFC'}
                        onChange={c => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, c1: c } })}
                        onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                      <span style={{ fontSize: 10, color: t.textMuted }}>→</span>
                      {selectedEl.fillGradient.midColor
                        ? <ColorPickerButton value={selectedEl.fillGradient.midColor}
                            onChange={c => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, midColor: c } })}
                            onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                        : <button title="Add mid color stop" onClick={() => { pushHistory(); updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, midColor: '#ffffff', midStop: 0.5 } }); }}
                            style={{ width: 18, height: 18, borderRadius: '50%', border: `1px dashed ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 11, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
                      }
                      {selectedEl.fillGradient.midColor && (
                        <>
                          <input type="range" min={0} max={100} step={5} value={Math.round((selectedEl.fillGradient.midStop ?? 0.5) * 100)}
                            onChange={e => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, midStop: parseInt(e.target.value) / 100 } })}
                            onMouseUp={() => pushHistory()}
                            title="Mid stop position"
                            style={{ width: 44, flexShrink: 0, accentColor: t.primary }} />
                          <button title="Remove mid color" onClick={() => { pushHistory(); const { midColor, midStop, ...rest } = selectedEl.fillGradient; updateElement({ ...selectedEl, fillGradient: rest }); }}
                            style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', background: t.border, color: t.textMuted, fontSize: 10, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                          <span style={{ fontSize: 10, color: t.textMuted }}>→</span>
                        </>
                      )}
                      <ColorPickerButton
                        value={selectedEl.fillGradient.c2 || '#9B7FFF'}
                        onChange={c => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, c2: c } })}
                        onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                      <select value={selectedEl.fillGradient.angle ?? 135}
                        onChange={e => { pushHistory(); updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, angle: parseInt(e.target.value) } }); }}
                        style={{ height: 24, padding: '0 3px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                        {[0,45,90,135,180,225,270,315].map(a => <option key={a} value={a}>{a}°</option>)}
                      </select>
                    </>
                  )}
                </>
              )}
              {['line','arrow','draw'].includes(selectedEl.type) && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Width</span>
                <input type="range" min={1} max={selectedEl.type==='draw'?40:20} value={selectedEl.strokeWidth||3}
                  onChange={e => updateElement({...selectedEl, strokeWidth:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.strokeWidth||3}px</span>
                {selectedEl.type !== 'draw' && [['solid','─'],['dashed','╌'],['dotted','···']].map(([s,icon]) => (
                  <button key={s} title={s.charAt(0).toUpperCase()+s.slice(1)} onClick={() => { pushHistory(); updateElement({...selectedEl, strokeStyle: s}); }}
                    style={{ height:26, padding:'0 8px', border:`1px solid ${(selectedEl.strokeStyle||'solid')===s?t.primaryBorder:t.border}`, borderRadius:6, background:(selectedEl.strokeStyle||'solid')===s?t.primaryBg:'transparent', color:(selectedEl.strokeStyle||'solid')===s?t.primary:t.textSecondary, fontSize:13, cursor:'pointer', flexShrink:0, letterSpacing:'0.05em', transition:'all 120ms ease' }}>
                    {icon}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'rect' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Radius</span>
                <input type="range" min={0} max={200} value={selectedEl.cornerRadius||0}
                  onChange={e => updateElement({...selectedEl, cornerRadius:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0 }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.cornerRadius||0}</span>
              </>}
              {selectedEl.type === 'triangle' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Sides</span>
                <input type="range" min={3} max={12} value={selectedEl.sides||3}
                  onChange={e => updateElement({...selectedEl, sides:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:18, flexShrink:0 }}>{selectedEl.sides||3}</span>
              </>}
              {selectedEl.type === 'star' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Points</span>
                <input type="range" min={3} max={12} value={selectedEl.numPoints||5}
                  onChange={e => updateElement({...selectedEl, numPoints:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:55, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:18, flexShrink:0 }}>{selectedEl.numPoints||5}</span>
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Depth</span>
                <input type="range" min={5} max={90} value={Math.round(((selectedEl.innerRadius||25)/(selectedEl.outerRadius||60))*100)}
                  onChange={e => { const outer=selectedEl.outerRadius||60; updateElement({...selectedEl, innerRadius:Math.max(2,Math.round(outer*parseInt(e.target.value)/100))}); }}
                  onMouseUp={() => pushHistory()} style={{ width:55, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:28, flexShrink:0 }}>{Math.round(((selectedEl.innerRadius||25)/(selectedEl.outerRadius||60))*100)}%</span>
              </>}
              {selectedEl.type === 'progressbar' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Progress</span>
                <input type="range" min={0} max={100} step={1} value={selectedEl.progress ?? 75}
                  onChange={e => updateElement({...selectedEl, progress: parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:70, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:28, flexShrink:0 }}>{selectedEl.progress ?? 75}%</span>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Track</span>
                <ColorPickerButton
                  value={(selectedEl.trackColor || 'rgba(255,255,255,0.2)').startsWith('rgba') ? '#888888' : (selectedEl.trackColor || '#888888')}
                  onChange={c => updateElement({...selectedEl, trackColor: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Height</span>
                <input type="range" min={4} max={40} value={selectedEl.height || 14}
                  onChange={e => updateElement({...selectedEl, height: parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:55, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.height || 14}px</span>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Radius</span>
                <input type="range" min={0} max={20} value={selectedEl.cornerRadius ?? 7}
                  onChange={e => updateElement({...selectedEl, cornerRadius: parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:55, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:18, flexShrink:0 }}>{selectedEl.cornerRadius ?? 7}</span>
              </>}
              {selectedEl.type === 'table' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Rows</span>
                <input type="range" min={1} max={10} step={1} value={selectedEl.tableRows || 3}
                  onChange={e => updateElement({...selectedEl, tableRows: parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:55, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:14, flexShrink:0 }}>{selectedEl.tableRows || 3}</span>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Cols</span>
                <input type="range" min={1} max={8} step={1} value={selectedEl.tableCols || 3}
                  onChange={e => updateElement({...selectedEl, tableCols: parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:55, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:14, flexShrink:0 }}>{selectedEl.tableCols || 3}</span>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Header</span>
                <ColorPickerButton
                  value={selectedEl.headerColor || TEAL}
                  onChange={c => updateElement({...selectedEl, headerColor: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
              </>}
              {selectedEl.type === 'countdown' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Target</span>
                <input type="date" value={selectedEl.targetDate || ''}
                  onChange={e => { pushHistory(); updateElement({...selectedEl, targetDate: e.target.value}); }}
                  style={{ height:26, padding:'0 6px', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:11, cursor:'pointer', flexShrink:0 }} />
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Box</span>
                <ColorPickerButton
                  value={selectedEl.fill || TEAL}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                <Btn label="Secs" active={!!selectedEl.showSeconds}
                  onClick={() => { pushHistory(); updateElement({...selectedEl, showSeconds: !selectedEl.showSeconds}); }} />
              </>}
              {selectedEl.type === 'gradrect' && <>
                <D />
                {[['→','horizontal'],['↓','vertical'],['↘','diagonal'],['◎','radial']].map(([icon,dir])=>(
                  <button key={dir} onClick={()=>{pushHistory();updateElement({...selectedEl,gradDir:dir});}}
                    title={dir}
                    style={{width:28,height:28,borderRadius:6,border:`1px solid ${(selectedEl.gradDir||'horizontal')===dir?t.primaryBorder:t.border}`,background:(selectedEl.gradDir||'horizontal')===dir?t.primaryBg:'transparent',color:(selectedEl.gradDir||'horizontal')===dir?t.primary:t.textSecondary,fontSize:14,cursor:'pointer',flexShrink:0,transition:'all 120ms ease'}}>
                    {icon}
                  </button>
                ))}
                <D />
                <span style={{fontSize:11,color:t.textMuted,whiteSpace:'nowrap',flexShrink:0}}>Stop 1</span>
                <ColorPickerButton value={(selectedEl.gradStops||[])[0]?.color||'#7C5CFC'} onChange={c=>{const s=[...(selectedEl.gradStops||[{pos:0,color:'#7C5CFC'},{pos:1,color:TEAL}])];s[0]={...s[0],color:c};updateElement({...selectedEl,gradStops:s});}} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <span style={{fontSize:11,color:t.textMuted,whiteSpace:'nowrap',flexShrink:0}}>Stop 2</span>
                <ColorPickerButton value={(selectedEl.gradStops||[])[1]?.color||TEAL} onChange={c=>{const s=[...(selectedEl.gradStops||[{pos:0,color:'#7C5CFC'},{pos:1,color:TEAL}])];s[1]={...s[1],color:c};updateElement({...selectedEl,gradStops:s});}} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <D />
                {[['Purple→Teal','#7C5CFC',TEAL],['Orange→Pink','#f97316','#ec4899'],['Blue→Cyan','#3b82f6','#06b6d4'],['Dark→Purple','#1a1a22','#7C5CFC'],['Green→Teal','#22c55e',TEAL],['Gold→Orange','#f59e0b','#f97316']].map(([lbl,c1,c2])=>(
                  <button key={lbl} onClick={()=>{pushHistory();updateElement({...selectedEl,gradStops:[{pos:0,color:c1},{pos:1,color:c2}]});}}
                    style={{height:26,padding:'0 7px',borderRadius:5,border:`1px solid ${t.border}`,background:`linear-gradient(to right,${c1},${c2})`,color:'#fff',fontSize:10,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap',fontWeight:600,textShadow:'0 1px 2px rgba(0,0,0,0.5)'}}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'comparison' && <>
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Col 1</span>
                <input type="text" value={selectedEl.col1Label||'Others'}
                  onChange={e=>updateElement({...selectedEl,col1Label:e.target.value})}
                  onBlur={()=>pushHistory()}
                  style={{width:65,padding:'2px 6px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none'}} />
                <ColorPickerButton value={selectedEl.col1Color||'#ef4444'} onChange={c=>updateElement({...selectedEl,col1Color:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Col 2</span>
                <input type="text" value={selectedEl.col2Label||'Us'}
                  onChange={e=>updateElement({...selectedEl,col2Label:e.target.value})}
                  onBlur={()=>pushHistory()}
                  style={{width:65,padding:'2px 6px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none'}} />
                <ColorPickerButton value={selectedEl.col2Color||TEAL} onChange={c=>updateElement({...selectedEl,col2Color:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Bg</span>
                <ColorPickerButton value={selectedEl.bgColor||'#1a1a2e'} onChange={c=>updateElement({...selectedEl,bgColor:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <D />
                {[['Red/Teal','#ef4444',TEAL],['Red/Green','#ef4444','#22c55e'],['Gray/Purple','#6b7280','#7C5CFC'],['Orange/Blue','#f97316','#3b82f6']].map(([lbl,c1,c2])=>(
                  <button key={lbl} onClick={()=>{pushHistory();updateElement({...selectedEl,col1Color:c1,col2Color:c2});}}
                    style={{height:26,padding:'0 7px',borderRadius:5,border:`1px solid ${t.border}`,background:`linear-gradient(to right,${c1} 50%,${c2} 50%)`,color:'#fff',fontSize:10,cursor:'pointer',flexShrink:0,fontWeight:600,textShadow:'0 1px 2px rgba(0,0,0,0.5)'}}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'watermark' && <>
                <D />
                {[['Pill','pill'],['Badge','badge'],['Bar','bar'],['Plain','plain']].map(([lbl,s]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, wmStyle: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.wmStyle||'pill')===s?t.primaryBorder:t.border}`, background:(selectedEl.wmStyle||'pill')===s?t.primaryBg:'transparent', color:(selectedEl.wmStyle||'pill')===s?t.primary:t.textSecondary, fontSize:11, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Logo</span>
                <input type="text" value={selectedEl.wmLogo||'YourBrand'}
                  onChange={e=>updateElement({...selectedEl,wmLogo:e.target.value})}
                  onBlur={()=>pushHistory()}
                  style={{width:100,padding:'2px 6px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none'}} />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Tag</span>
                <input type="text" value={selectedEl.wmTagline||''}
                  onChange={e=>updateElement({...selectedEl,wmTagline:e.target.value})}
                  onBlur={()=>pushHistory()}
                  placeholder="tagline"
                  style={{width:100,padding:'2px 6px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none'}} />
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Text</span>
                <ColorPickerButton value={selectedEl.fill||'#ffffff'} onChange={c=>updateElement({...selectedEl,fill:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Bg</span>
                <ColorPickerButton value={selectedEl.bgColor||'rgba(0,0,0,0.55)'} onChange={c=>updateElement({...selectedEl,bgColor:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Accent</span>
                <ColorPickerButton value={selectedEl.accentColor||TEAL} onChange={c=>updateElement({...selectedEl,accentColor:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
              </>}
              {selectedEl.type === 'htimeline' && <>
                <D />
                {[['Filled','filled'],['Outline','outline'],['Numbered','numbered']].map(([lbl,s]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, tlDotStyle: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.tlDotStyle||'filled')===s?t.primaryBorder:t.border}`, background:(selectedEl.tlDotStyle||'filled')===s?t.primaryBg:'transparent', color:(selectedEl.tlDotStyle||'filled')===s?t.primary:t.textSecondary, fontSize:11, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {lbl}
                  </button>
                ))}
                <D />
                {[['Solid','solid'],['Dashed','dashed'],['Dotted','dotted']].map(([lbl,s]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, tlLineStyle: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.tlLineStyle||'solid')===s?t.primaryBorder:t.border}`, background:(selectedEl.tlLineStyle||'solid')===s?t.primaryBg:'transparent', color:(selectedEl.tlLineStyle||'solid')===s?t.primary:t.textSecondary, fontSize:11, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Accent</span>
                <ColorPickerButton value={selectedEl.accentColor||TEAL} onChange={c=>updateElement({...selectedEl,accentColor:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Text</span>
                <ColorPickerButton value={selectedEl.fill||'#ffffff'} onChange={c=>updateElement({...selectedEl,fill:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Steps</span>
                <select value={(selectedEl.tlSteps||[]).length}
                  onChange={e=>{const n=+e.target.value;const cur=selectedEl.tlSteps||['Step 1','Step 2','Step 3'];const next=Array.from({length:n},(_,i)=>cur[i]||`Step ${i+1}`);pushHistory();updateElement({...selectedEl,tlSteps:next});}}
                  style={{height:26,padding:'0 6px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,cursor:'pointer'}}>
                  {[2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </>}
              {selectedEl.type === 'pricetag' && <>
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Currency</span>
                <input type="text" value={selectedEl.ptCurrency||'$'}
                  onChange={e=>updateElement({...selectedEl,ptCurrency:e.target.value})}
                  onBlur={()=>pushHistory()}
                  style={{width:32,padding:'2px 5px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none',textAlign:'center'}} />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Price</span>
                <input type="text" value={selectedEl.ptPrice||'29'}
                  onChange={e=>updateElement({...selectedEl,ptPrice:e.target.value})}
                  onBlur={()=>pushHistory()}
                  style={{width:52,padding:'2px 6px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none'}} />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Per</span>
                <input type="text" value={selectedEl.ptPeriod||'/mo'}
                  onChange={e=>updateElement({...selectedEl,ptPeriod:e.target.value})}
                  onBlur={()=>pushHistory()}
                  style={{width:44,padding:'2px 5px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none'}} />
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Label</span>
                <input type="text" value={selectedEl.ptLabel||'Pro Plan'}
                  onChange={e=>updateElement({...selectedEl,ptLabel:e.target.value})}
                  onBlur={()=>pushHistory()}
                  style={{width:90,padding:'2px 6px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none'}} />
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Bg</span>
                <ColorPickerButton value={selectedEl.bgColor||'#1a1a2e'} onChange={c=>updateElement({...selectedEl,bgColor:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Accent</span>
                <ColorPickerButton value={selectedEl.accentColor||TEAL} onChange={c=>updateElement({...selectedEl,accentColor:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <D />
                {[['Dark/Teal','#1a1a2e',TEAL],['Navy/Purple','#0f172a','#7C5CFC'],['Black/Gold','#111111','#f59e0b'],['White/Teal','#f8f9fa',TEAL]].map(([lbl,bg,ac])=>(
                  <button key={lbl} onClick={()=>{pushHistory();updateElement({...selectedEl,bgColor:bg,accentColor:ac});}}
                    style={{height:26,padding:'0 7px',borderRadius:5,border:`1px solid ${t.border}`,background:bg,color:ac,fontSize:10,cursor:'pointer',flexShrink:0,fontWeight:600}}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'iconshape' && <>
                <D />
                {[['✓','check'],['✗','x'],['+','plus'],['→','arrow'],['★','star'],['♥','heart'],['▲','warning'],['🛡','shield'],['ℹ','info'],['⚡','bolt'],['🔧','wrench'],['🔨','hammer'],['🏠','house'],['💧','drop'],['🔥','flame'],['🍃','leaf'],['📞','phone'],['🕐','clock'],['📍','location'],['✉','mail'],['$','dollar'],['🏆','trophy'],['📅','calendar'],['📷','camera'],['↑','arrowup'],['←','arrowleft'],['↻','refresh'],['📶','wifi'],['🔒','lock'],['👁','eye2'],['〰','pipe'],['❄','snowflake'],['🌀','fan'],['⛑','hardhat'],['🖌','paintbrush'],['💨','spray'],['🚐','truck'],['🧹','broom'],['🪜','ladder'],['⚙','gear'],['🏷','tag']].map(([icon,kind]) => (
                  <button key={kind} onClick={() => { pushHistory(); updateElement({...selectedEl, iconKind: kind}); }}
                    title={kind}
                    style={{ width:28, height:28, borderRadius:5, border:`1px solid ${(selectedEl.iconKind||'check')===kind?TEAL:t.border}`, background:(selectedEl.iconKind||'check')===kind?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.iconKind||'check')===kind?TEAL:t.text, fontSize:13, cursor:'pointer', flexShrink:0 }}>
                    {icon}
                  </button>
                ))}
                <D />
                {[['None','none'],['⬤','circle'],['◻','square'],['▣','rounded']].map(([icon,s]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, iconBgShape: s}); }}
                    style={{ width:28, height:28, borderRadius:5, border:`1px solid ${(selectedEl.iconBgShape||'circle')===s?TEAL:t.border}`, background:(selectedEl.iconBgShape||'circle')===s?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.iconBgShape||'circle')===s?TEAL:t.text, fontSize:13, cursor:'pointer', flexShrink:0 }}>
                    {icon}
                  </button>
                ))}
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Icon</span>
                <ColorPickerButton value={selectedEl.fill||'#ffffff'} onChange={c=>updateElement({...selectedEl,fill:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Bg</span>
                <ColorPickerButton value={selectedEl.iconBgColor||'rgba(0,196,204,0.2)'} onChange={c=>updateElement({...selectedEl,iconBgColor:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <D />
                {[['Teal','#ffffff','rgba(0,196,204,0.25)'],['Purple','#ffffff','rgba(124,92,252,0.3)'],['Green','#ffffff','rgba(34,197,94,0.3)'],['Red','#ffffff','rgba(239,68,68,0.25)'],['Dark','#ffffff','rgba(30,30,40,0.9)'],['Gold','#1a1a22','rgba(245,158,11,0.3)']].map(([lbl,fc,bgc])=>(
                  <button key={lbl} onClick={()=>{pushHistory();updateElement({...selectedEl,fill:fc,iconBgColor:bgc});}}
                    style={{height:26,padding:'0 7px',borderRadius:5,border:`1px solid ${t.border}`,background:bgc,color:fc,fontSize:10,cursor:'pointer',flexShrink:0,fontWeight:600}}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'counter' && <>
                <D />
                {[['Plain','plain'],['Card','card'],['Circle','circle']].map(([lbl,s]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, counterStyle: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.counterStyle||'card')===s?TEAL:t.border}`, background:(selectedEl.counterStyle||'card')===s?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.counterStyle||'card')===s?TEAL:t.text, fontSize:11, cursor:'pointer', flexShrink:0 }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Value</span>
                <input type="number" value={selectedEl.counterValue??1234}
                  onChange={e=>updateElement({...selectedEl,counterValue:+e.target.value})}
                  onBlur={()=>pushHistory()}
                  style={{width:70,padding:'2px 6px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none'}} />
                <input type="text" value={selectedEl.counterPrefix||''} placeholder="$"
                  onChange={e=>updateElement({...selectedEl,counterPrefix:e.target.value})}
                  onBlur={()=>pushHistory()}
                  title="Prefix (e.g. $)"
                  style={{width:36,padding:'2px 5px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none',textAlign:'center'}} />
                <input type="text" value={selectedEl.counterSuffix||''} placeholder="%"
                  onChange={e=>updateElement({...selectedEl,counterSuffix:e.target.value})}
                  onBlur={()=>pushHistory()}
                  title="Suffix (e.g. %)"
                  style={{width:36,padding:'2px 5px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none',textAlign:'center'}} />
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Label</span>
                <input type="text" value={selectedEl.counterLabel||''} placeholder="Label text"
                  onChange={e=>updateElement({...selectedEl,counterLabel:e.target.value})}
                  onBlur={()=>pushHistory()}
                  style={{width:110,padding:'2px 7px',borderRadius:5,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:'none'}} />
                <D />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Num</span>
                <ColorPickerButton value={selectedEl.fill||'#ffffff'} onChange={c=>updateElement({...selectedEl,fill:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Bg</span>
                <ColorPickerButton value={selectedEl.bgColor||'rgba(0,196,204,0.15)'} onChange={c=>updateElement({...selectedEl,bgColor:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <span style={{fontSize:11,color:t.textMuted,flexShrink:0}}>Accent</span>
                <ColorPickerButton value={selectedEl.accentColor||TEAL} onChange={c=>updateElement({...selectedEl,accentColor:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
              </>}
              {selectedEl.type === 'beforeafter' && <>
                <D />
                {[['Pill','pill'],['Corner','corner'],['Center','center']].map(([lbl,s]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, baLabelStyle: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.baLabelStyle||'pill')===s?TEAL:t.border}`, background:(selectedEl.baLabelStyle||'pill')===s?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.baLabelStyle||'pill')===s?TEAL:t.text, fontSize:11, cursor:'pointer', flexShrink:0 }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Before</span>
                <ColorPickerButton value={selectedEl.fill||'#6b7280'} onChange={c=>updateElement({...selectedEl,fill:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>After</span>
                <ColorPickerButton value={selectedEl.baRightColor||'#22c55e'} onChange={c=>updateElement({...selectedEl,baRightColor:c})} onCommit={()=>pushHistory()} recentColors={recentColors} size={18} />
                <D />
                {[['Gray→Green','#6b7280','#22c55e'],['Dark→Teal','#374151',TEAL],['Red→Green','#ef4444','#22c55e'],['Blue→Purple','#3b82f6','#7C5CFC']].map(([lbl,l,r])=>(
                  <button key={lbl} onClick={()=>{pushHistory();updateElement({...selectedEl,fill:l,baRightColor:r});}}
                    style={{height:26,padding:'0 7px',borderRadius:5,border:`1px solid ${t.border}`,background:`linear-gradient(to right,${l},${r})`,color:'#fff',fontSize:10,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap',fontWeight:600,textShadow:'0 1px 2px rgba(0,0,0,0.5)'}}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'testimonial' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Stars</span>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => { pushHistory(); updateElement({...selectedEl, starRating: n}); }}
                    style={{ width:26, height:26, borderRadius:5, border:`1px solid ${(selectedEl.starRating??5)===n?'#f59e0b':t.border}`, background:(selectedEl.starRating??5)===n?'rgba(245,158,11,0.15)':'transparent', color:(selectedEl.starRating??5)===n?'#f59e0b':t.text, fontSize:13, cursor:'pointer', flexShrink:0 }}>
                    {n}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Accent</span>
                <ColorPickerButton
                  value={selectedEl.accentColor || TEAL}
                  onChange={c => updateElement({...selectedEl, accentColor: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Card</span>
                <ColorPickerButton
                  value={selectedEl.fill || 'rgba(255,255,255,0.1)'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
              </>}
              {selectedEl.type === 'glasspane' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Tint</span>
                <ColorPickerButton
                  value={selectedEl.fill || 'rgba(255,255,255,0.18)'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Radius</span>
                <input type="range" min={0} max={60} step={2} value={selectedEl.cornerRadius ?? 16}
                  onChange={e => updateElement({...selectedEl, cornerRadius: parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()}
                  style={{ width:60, accentColor:t.primary, cursor:'pointer', flexShrink:0 }} />
                <D />
                {[['White Glass','rgba(255,255,255,0.18)'],['Dark Glass','rgba(0,0,0,0.35)'],['Teal Glass','rgba(0,196,204,0.25)'],['Purple Glass','rgba(124,92,252,0.25)']].map(([lbl,c]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, fill: c}); }}
                    style={{ height:26, padding:'0 7px', borderRadius:5, border:`1px solid ${t.border}`, background:c, color:'#ffffff', fontSize:10, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', fontWeight:600, textShadow:'0 1px 2px rgba(0,0,0,0.5)' }}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'qrcode' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Dots</span>
                <ColorPickerButton
                  value={selectedEl.fill || '#1a1a22'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Bg</span>
                <ColorPickerButton
                  value={selectedEl.qrBg || '#ffffff'}
                  onChange={c => updateElement({...selectedEl, qrBg: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                <button onClick={() => { pushHistory(); updateElement({...selectedEl, showQrLabel: !(selectedEl.showQrLabel !== false)}); }}
                  style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${selectedEl.showQrLabel !== false?TEAL:t.border}`, background:selectedEl.showQrLabel !== false?'rgba(0,196,204,0.1)':'transparent', color:selectedEl.showQrLabel !== false?TEAL:t.text, fontSize:11, cursor:'pointer', flexShrink:0 }}>
                  Label
                </button>
                <D />
                {[['Dark on White','#1a1a22','#ffffff'],['White on Dark','#ffffff','#1a1a22'],['Teal on Dark',TEAL,'#1a1a22'],['Purple on White','#7C5CFC','#ffffff']].map(([lbl,fg,bg]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, fill: fg, qrBg: bg}); }}
                    style={{ height:26, padding:'0 7px', borderRadius:5, border:`1px solid ${t.border}`, background:bg, color:fg, fontSize:10, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', fontWeight:600 }}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'pattern' && <>
                <D />
                {[['Dots','dots'],['Grid','grid'],['Lines','diagonal'],['Chevron','chevron'],['Cross','cross'],['Hex','hex']].map(([lbl, pt]) => (
                  <button key={pt} onClick={() => { pushHistory(); updateElement({...selectedEl, patternType: pt}); }}
                    style={{ height:28, padding:'0 7px', borderRadius:6, border:`1px solid ${(selectedEl.patternType||'dots')===pt?TEAL:t.border}`, background:(selectedEl.patternType||'dots')===pt?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.patternType||'dots')===pt?TEAL:t.text, fontSize:11, cursor:'pointer', flexShrink:0 }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Color</span>
                <ColorPickerButton
                  value={selectedEl.fill || 'rgba(255,255,255,0.15)'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Size</span>
                <input type="range" min={8} max={60} step={2} value={selectedEl.tileSize || 20}
                  onChange={e => updateElement({...selectedEl, tileSize: parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()}
                  style={{ width:64, accentColor:t.primary, cursor:'pointer', flexShrink:0 }} />
              </>}
              {selectedEl.type === 'steplist' && <>
                <D />
                {[['1,2,3','numbered'],['✓ Check','check'],['• Dot','dot']].map(([lbl, s]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, stepStyle: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.stepStyle||'numbered')===s?TEAL:t.border}`, background:(selectedEl.stepStyle||'numbered')===s?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.stepStyle||'numbered')===s?TEAL:t.text, fontSize:11, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Accent</span>
                <ColorPickerButton
                  value={selectedEl.fill || TEAL}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Steps</span>
                <input type="range" min={2} max={6} step={1}
                  value={(selectedEl.steps || []).length || 3}
                  onChange={e => {
                    const n = parseInt(e.target.value);
                    const cur = selectedEl.steps || ['Step one','Step two','Step three'];
                    const next = n > cur.length
                      ? [...cur, ...Array(n - cur.length).fill('Step ' + (cur.length + 1))]
                      : cur.slice(0, n);
                    updateElement({...selectedEl, steps: next});
                  }}
                  onMouseUp={() => pushHistory()}
                  style={{ width:60, accentColor:t.primary, cursor:'pointer', flexShrink:0 }} />
                <span style={{ fontSize:11, color:t.textMuted, flexShrink:0 }}>{(selectedEl.steps||[]).length||3}</span>
              </>}
              {selectedEl.type === 'ribbon' && <>
                <D />
                {[['Fold','fold'],['Wave','wave'],['Flat','flat']].map(([lbl, s]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, ribbonStyle: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.ribbonStyle||'fold')===s?TEAL:t.border}`, background:(selectedEl.ribbonStyle||'fold')===s?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.ribbonStyle||'fold')===s?TEAL:t.text, fontSize:11, cursor:'pointer', flexShrink:0 }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Color</span>
                <ColorPickerButton
                  value={selectedEl.fill || '#ef4444'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                {[['Red','#ef4444'],['Purple','#7C5CFC'],['Teal',TEAL],['Green','#22c55e'],['Orange','#f97316'],['Gold','#f59e0b']].map(([lbl,c]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, fill: c}); }}
                    title={lbl}
                    style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${(selectedEl.fill||'#ef4444')===c?'#fff':t.border}`, background:c, cursor:'pointer', flexShrink:0 }} />
                ))}
              </>}
              {selectedEl.type === 'speechbubble' && <>
                <D />
                {[['↙ BL','bottom-left'],['↘ BR','bottom-right'],['↖ TL','top-left'],['↗ TR','top-right'],['○ None','none']].map(([lbl, t2]) => (
                  <button key={t2} onClick={() => { pushHistory(); updateElement({...selectedEl, bubbleTail: t2}); }}
                    style={{ height:28, padding:'0 7px', borderRadius:6, border:`1px solid ${(selectedEl.bubbleTail||'bottom-left')===t2?TEAL:t.border}`, background:(selectedEl.bubbleTail||'bottom-left')===t2?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.bubbleTail||'bottom-left')===t2?TEAL:t.text, fontSize:10, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Bg</span>
                <ColorPickerButton
                  value={selectedEl.fill || '#ffffff'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Text</span>
                <ColorPickerButton
                  value={selectedEl.stroke || '#1a1a22'}
                  onChange={c => updateElement({...selectedEl, stroke: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                {[['White','#ffffff','#1a1a22'],['Dark','#1a1a22','#ffffff'],['Teal',TEAL,'#ffffff'],['Purple','#7C5CFC','#ffffff'],['Yellow','#FFE135','#1a1a22']].map(([lbl,bg,fg]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, fill: bg, stroke: fg}); }}
                    style={{ height:26, padding:'0 7px', borderRadius:5, border:`1px solid ${t.border}`, background:bg, color:fg, fontSize:10, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', fontWeight:600, boxShadow:'0 1px 3px rgba(0,0,0,0.15)' }}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'mappin' && <>
                <D />
                {[['Pin','pin'],['Badge','badge'],['Chip','chip']].map(([lbl, s]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, pinStyle: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.pinStyle||'pin')===s?t.primaryBorder:t.border}`, background:(selectedEl.pinStyle||'pin')===s?t.primaryBg:'transparent', color:(selectedEl.pinStyle||'pin')===s?t.primary:t.textSecondary, fontSize:11, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Color</span>
                <ColorPickerButton
                  value={selectedEl.fill || '#ef4444'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                {[['Red','#ef4444'],['Teal',TEAL],['Purple','#7C5CFC'],['Blue','#3b82f6'],['Orange','#f97316'],['Green','#22c55e']].map(([lbl,c]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, fill: c}); }}
                    title={lbl}
                    style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${(selectedEl.fill||'#ef4444')===c?'#fff':t.border}`, background:c, cursor:'pointer', flexShrink:0 }} />
                ))}
              </>}
              {selectedEl.type === 'polaroid' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Frame</span>
                <ColorPickerButton
                  value={selectedEl.fill || '#ffffff'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Photo</span>
                <ColorPickerButton
                  value={selectedEl.photoColor || 'rgba(100,120,160,0.35)'}
                  onChange={c => updateElement({...selectedEl, photoColor: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Shadow</span>
                <input type="range" min={0} max={40} step={1} value={selectedEl.shadowBlur ?? 18}
                  onChange={e => updateElement({...selectedEl, shadowBlur: parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()}
                  style={{ width:64, accentColor:t.primary, cursor:'pointer', flexShrink:0 }} />
                <D />
                {[['White','#ffffff','#333333'],['Black','#1a1a22','#ffffff'],['Cream','#f5f0e8','#333333'],['Pink','#ffe0f0','#d14080']].map(([lbl,fr,cp]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, fill: fr, captionColor: cp}); }}
                    style={{ height:26, padding:'0 8px', borderRadius:5, border:`1px solid ${t.border}`, background:fr, color:cp, fontSize:10, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', fontWeight:600, boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'highlight' && <>
                <D />
                {[['Full','full'],['Brush','brush'],['Underline','underline']].map(([lbl, s]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, highlightStyle: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.highlightStyle||'full')===s?t.primaryBorder:t.border}`, background:(selectedEl.highlightStyle||'full')===s?t.primaryBg:'transparent', color:(selectedEl.highlightStyle||'full')===s?t.primary:t.textSecondary, fontSize:11, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Mark</span>
                <ColorPickerButton
                  value={selectedEl.fill || '#FFE135'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Text</span>
                <ColorPickerButton
                  value={selectedEl.stroke || '#1a1a22'}
                  onChange={c => updateElement({...selectedEl, stroke: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                {[['Yellow','#FFE135','#1a1a22'],['Teal',TEAL,'#ffffff'],['Pink','#ec4899','#ffffff'],['Purple','#7C5CFC','#ffffff'],['Orange','#f97316','#ffffff'],['Green','#22c55e','#1a1a22']].map(([lbl,bg,fg]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, fill: bg, stroke: fg}); }}
                    style={{ height:26, padding:'0 8px', borderRadius:5, border:`1px solid ${t.border}`, background:bg, color:fg, fontSize:10, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', fontWeight:700 }}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'sticker' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Emoji</span>
                {['🔥','⭐','💯','🎯','✅','❤️','🚀','💎','👏','🌟','⚡','🎉'].map(em => (
                  <button key={em} onClick={() => { pushHistory(); updateElement({...selectedEl, emoji: em}); }}
                    style={{ width:30, height:30, borderRadius:6, border:`1px solid ${(selectedEl.emoji||'🔥')===em?t.primaryBorder:t.border}`, background:(selectedEl.emoji||'🔥')===em?t.primaryBg:'transparent', fontSize:16, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {em}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Bg</span>
                {[['○','none'],['●','circle'],['▬','pill'],['■','square']].map(([icon, bg]) => (
                  <button key={bg} onClick={() => { pushHistory(); updateElement({...selectedEl, stickerBg: bg}); }}
                    title={bg}
                    style={{ width:28, height:28, borderRadius:6, border:`1px solid ${(selectedEl.stickerBg||'none')===bg?t.primaryBorder:t.border}`, background:(selectedEl.stickerBg||'none')===bg?t.primaryBg:'transparent', color:(selectedEl.stickerBg||'none')===bg?t.primary:t.textSecondary, fontSize:14, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {icon}
                  </button>
                ))}
                {(selectedEl.stickerBg && selectedEl.stickerBg !== 'none') && <>
                  <ColorPickerButton
                    value={selectedEl.fill || 'rgba(255,255,255,0.15)'}
                    onChange={c => updateElement({...selectedEl, fill: c})}
                    onCommit={() => pushHistory()}
                    recentColors={recentColors}
                    size={18}
                  />
                </>}
              </>}
              {selectedEl.type === 'neontext' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Glow</span>
                <ColorPickerButton
                  value={selectedEl.glowColor || TEAL}
                  onChange={c => updateElement({...selectedEl, glowColor: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Intensity</span>
                <input type="range" min={4} max={40} step={1} value={selectedEl.glowIntensity ?? 18}
                  onChange={e => updateElement({...selectedEl, glowIntensity: parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()}
                  style={{ width:64, accentColor:t.primary, cursor:'pointer', flexShrink:0 }} />
                <D />
                {[['Cyan',TEAL],['Purple','#7C5CFC'],['Pink','#ec4899'],['Orange','#f97316'],['Green','#22c55e'],['White','#ffffff']].map(([lbl,c]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, glowColor: c}); }}
                    title={lbl}
                    style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${(selectedEl.glowColor||TEAL)===c?'#fff':t.border}`, background:c, cursor:'pointer', flexShrink:0, boxShadow:`0 0 6px ${c}` }} />
                ))}
              </>}
              {selectedEl.type === 'gradtext' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Color 1</span>
                <ColorPickerButton
                  value={selectedEl.gradColor1 || TEAL}
                  onChange={c => updateElement({...selectedEl, gradColor1: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Color 2</span>
                <ColorPickerButton
                  value={selectedEl.gradColor2 || '#7C5CFC'}
                  onChange={c => updateElement({...selectedEl, gradColor2: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                {[['→','horizontal'],['↓','vertical'],['↘','diagonal']].map(([icon, dir]) => (
                  <button key={dir} onClick={() => { pushHistory(); updateElement({...selectedEl, gradDirection: dir}); }}
                    title={dir}
                    style={{ width:28, height:28, borderRadius:6, border:`1px solid ${(selectedEl.gradDirection||'horizontal')===dir?t.primaryBorder:t.border}`, background:(selectedEl.gradDirection||'horizontal')===dir?t.primaryBg:'transparent', color:(selectedEl.gradDirection||'horizontal')===dir?t.primary:t.textSecondary, fontSize:14, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {icon}
                  </button>
                ))}
                <D />
                {/* Quick gradient presets */}
                {[['Teal→Purple',TEAL,'#7C5CFC'],['Orange→Pink','#f97316','#ec4899'],['Blue→Cyan','#3b82f6','#06b6d4'],['Gold→Red','#f59e0b','#ef4444']].map(([lbl,c1,c2]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, gradColor1: c1, gradColor2: c2}); }}
                    style={{ height:26, padding:'0 8px', borderRadius:5, border:`1px solid ${t.border}`, background:`linear-gradient(to right, ${c1}, ${c2})`, color:'#fff', fontSize:10, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', fontWeight:600, textShadow:'0 1px 2px rgba(0,0,0,0.5)' }}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'coupon' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Color</span>
                <ColorPickerButton
                  value={selectedEl.fill || '#7C5CFC'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                {/* Quick discount presets */}
                {[['10% Off','10% OFF','SAVE10'],['20% Off','20% OFF','SAVE20'],['Free Ship','FREE SHIP','FREESHIP'],['Buy 1 Get 1','BUY 1\nGET 1','B1G1FREE']].map(([lbl, h, code]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, couponHeadline: h, couponCode: code}); }}
                    style={{ height:26, padding:'0 7px', borderRadius:5, border:`1px solid ${t.border}`, background:'transparent', color:t.text, fontSize:11, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'callout' && <>
                <D />
                {[['side','Side'],['top','Top'],['outline','Outline']].map(([s, lbl]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, calloutStyle: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.calloutStyle||'side')===s?t.primaryBorder:t.border}`, background:(selectedEl.calloutStyle||'side')===s?t.primaryBg:'transparent', color:(selectedEl.calloutStyle||'side')===s?t.primary:t.textSecondary, fontSize:11, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {lbl}
                  </button>
                ))}
                <D />
                {['💡','⚠','✅','🔥','📌','💎','🎯','🚀'].map(ic => (
                  <button key={ic} onClick={() => { pushHistory(); updateElement({...selectedEl, calloutIcon: ic}); }}
                    style={{ width:28, height:28, borderRadius:6, border:`1px solid ${selectedEl.calloutIcon===ic?t.primaryBorder:t.border}`, background:selectedEl.calloutIcon===ic?t.primaryBg:'transparent', fontSize:14, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {ic}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Accent</span>
                <ColorPickerButton
                  value={selectedEl.fill || '#f59e0b'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
              </>}
              {selectedEl.type === 'socialstats' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Accent</span>
                <ColorPickerButton
                  value={selectedEl.fill || TEAL}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                {/* Quick platform presets */}
                {[['📸 IG',['👥','2.4K','Followers'],['❤','18K','Likes'],['📸','342','Posts']],['🐦 X',['👥','12K','Followers'],['🔁','4.2K','RTs'],['❤','24K','Likes']],['💼 LI',['👥','890','Connections'],['👁','5.6K','Views'],['📄','42','Posts']]].map(([lbl, ...s]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, stats: s.map(([icon,value,label]) => ({icon,value,label}))}); }}
                    style={{ height:26, padding:'0 7px', borderRadius:5, border:`1px solid ${t.border}`, background:'transparent', color:t.text, fontSize:11, cursor:'pointer', flexShrink:0 }}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'divider' && <>
                <D />
                {[['solid','─'],['dashed','╌'],['dotted','·····'],['double','═'],['gradient','▱'],['ornament','◆']].map(([s, icon]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, dividerStyle: s}); }}
                    title={s.charAt(0).toUpperCase() + s.slice(1)}
                    style={{ height:28, width:34, borderRadius:6, border:`1px solid ${(selectedEl.dividerStyle||'gradient')===s?t.primaryBorder:t.border}`, background:(selectedEl.dividerStyle||'gradient')===s?t.primaryBg:'transparent', color:(selectedEl.dividerStyle||'gradient')===s?t.primary:t.textSecondary, fontSize:13, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {icon}
                  </button>
                ))}
                <D />
                <ColorPickerButton
                  value={(selectedEl.fill||'rgba(255,255,255,0.5)').startsWith('rgba') ? '#888888' : (selectedEl.fill||'#888888')}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <input type="range" min={1} max={12} value={selectedEl.strokeWidth||2}
                  onChange={e => updateElement({...selectedEl, strokeWidth: parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:55, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.strokeWidth||2}px</span>
              </>}
              {selectedEl.type === 'badge' && <>
                <D />
                {[['burst','Burst'],['circle','Circle'],['rounded','Square']].map(([s, lbl]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, badgeShape: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.badgeShape||'burst')===s?t.primaryBorder:t.border}`, background:(selectedEl.badgeShape||'burst')===s?t.primaryBg:'transparent', color:(selectedEl.badgeShape||'burst')===s?t.primary:t.textSecondary, fontSize:11, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Color</span>
                <ColorPickerButton
                  value={selectedEl.fill || '#ef4444'}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <D />
                {/* Quick badge presets */}
                {[['🔴 Sale','#ef4444','SALE','50% OFF','TODAY ONLY'],['🟣 New','#7C5CFC','NEW','ARRIVAL',''],['🟡 Offer','#f59e0b','LIMITED','TIME','OFFER'],['🟢 Free','#22c55e','FREE','QUOTE','TODAY']].map(([lbl, color, l1, l2, l3]) => (
                  <button key={lbl} onClick={() => { pushHistory(); updateElement({...selectedEl, fill: color, badgeLine1: l1, badgeLine2: l2, badgeLine3: l3}); }}
                    style={{ height:26, padding:'0 7px', borderRadius:5, border:`1px solid ${t.border}`, background:'transparent', color:t.text, fontSize:11, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                    {lbl}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'quote' && <>
                <D />
                {[['block','Block'],['minimal','Minimal'],['bubble','Bubble']].map(([s, lbl]) => (
                  <button key={s} onClick={() => { pushHistory(); updateElement({...selectedEl, quoteStyle: s}); }}
                    style={{ height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${(selectedEl.quoteStyle||'block')===s?t.primaryBorder:t.border}`, background:(selectedEl.quoteStyle||'block')===s?t.primaryBg:'transparent', color:(selectedEl.quoteStyle||'block')===s?t.primary:t.textSecondary, fontSize:11, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {lbl}
                  </button>
                ))}
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Accent</span>
                <ColorPickerButton
                  value={selectedEl.fill || TEAL}
                  onChange={c => updateElement({...selectedEl, fill: c})}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
              </>}
              {selectedEl.type === 'rating' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Rating</span>
                <input type="range" min={0} max={selectedEl.maxStars || 5} step={0.5}
                  value={selectedEl.rating ?? 4.5}
                  onChange={e => updateElement({...selectedEl, rating: parseFloat(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:70, flexShrink:0, accentColor:'#f59e0b' }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:28, flexShrink:0 }}>{selectedEl.rating ?? 4.5}</span>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Stars</span>
                <input type="range" min={1} max={10} step={1}
                  value={selectedEl.maxStars || 5}
                  onChange={e => updateElement({...selectedEl, maxStars: parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:55, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:14, flexShrink:0 }}>{selectedEl.maxStars || 5}</span>
                <D />
                <Btn label="Label" active={selectedEl.showLabel !== false}
                  onClick={() => { pushHistory(); updateElement({...selectedEl, showLabel: !(selectedEl.showLabel !== false)}); }} />
              </>}
              {selectedEl.type === 'chart' && <>
                <D />
                {[['bar','📊 Bar'],['pie','🥧 Pie']].map(([ct, lbl]) => (
                  <button key={ct} onClick={() => { pushHistory(); updateElement({...selectedEl, chartType: ct}); }}
                    style={{ height:28, padding:'0 9px', borderRadius:6, border:`1px solid ${(selectedEl.chartType||'bar')===ct?t.primaryBorder:t.border}`, background:(selectedEl.chartType||'bar')===ct?t.primaryBg:'transparent', color:(selectedEl.chartType||'bar')===ct?t.primary:t.textSecondary, fontSize:12, cursor:'pointer', flexShrink:0, transition:'all 120ms ease' }}>
                    {lbl}
                  </button>
                ))}
                <D />
                {/* Per-item color pickers for the 3 default series */}
                {(selectedEl.chartData || []).map((d, i) => (
                  <ColorPickerButton key={i}
                    value={d.color || TEAL}
                    onChange={c => { const nd = [...(selectedEl.chartData||[])]; nd[i] = {...nd[i], color:c}; updateElement({...selectedEl, chartData:nd}); }}
                    onCommit={() => pushHistory()}
                    recentColors={recentColors}
                    size={18}
                  />
                ))}
              </>}
              <D />
              {/* Border toggle + color + width */}
              <Btn label="Border" active={!!selectedEl.borderEnabled}
                onClick={() => handleElementChange({...selectedEl, borderEnabled: !selectedEl.borderEnabled, borderColor: selectedEl.borderColor||'#ffffff', borderWidth: selectedEl.borderWidth||2})} />
              {selectedEl.borderEnabled && <>
                <ColorPickerButton
                  value={selectedEl.borderColor || '#ffffff'}
                  onChange={c => pickColor(c, color => updateElement({ ...selectedEl, borderColor: color }))}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <input type="range" min={1} max={20} value={selectedEl.borderWidth||2}
                  onChange={e => updateElement({...selectedEl, borderWidth:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0, accentColor:t.primary }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.borderWidth||2}px</span>
                {[['solid','─'],['dashed','╌'],['dotted','···']].map(([s,icon]) => (
                  <button key={s} title={s.charAt(0).toUpperCase()+s.slice(1)} onClick={() => { pushHistory(); updateElement({...selectedEl, borderStyle: s}); }}
                    style={{ height:26, padding:'0 8px', border:`1px solid ${(selectedEl.borderStyle||'solid')===s?t.primaryBorder:t.border}`, borderRadius:6, background:(selectedEl.borderStyle||'solid')===s?t.primaryBg:'transparent', color:(selectedEl.borderStyle||'solid')===s?t.primary:t.textSecondary, fontSize:13, cursor:'pointer', flexShrink:0, letterSpacing:'0.05em', transition:'all 120ms ease' }}>
                    {icon}
                  </button>
                ))}
              </>}
              <D />
              {/* Flip buttons (skip for circle — symmetric) */}
              {!['circle','draw'].includes(selectedEl.type) && <>
                <Btn label="⟺ Flip H" active={!!selectedEl.flipH} onClick={() => { pushHistory(); updateElement({ ...selectedEl, flipH: !selectedEl.flipH }); }} />
                <Btn label="⇅ Flip V" active={!!selectedEl.flipV} onClick={() => { pushHistory(); updateElement({ ...selectedEl, flipV: !selectedEl.flipV }); }} />
                <D />
              </>}
              {/* Shadow panel for shapes */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="Shadow" active={!!selectedEl.shadow?.enabled}
                  onClick={e => { setPanelAnchor(e.currentTarget.getBoundingClientRect()); setShowShadowPanel(p => !p); setShowPositionPanel(false); }} />
                {showShadowPanel && panelAnchor && createPortal(
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setShowShadowPanel(false)} />
                    <div style={{ position: 'fixed', top: panelAnchor.bottom + 4, left: Math.min(panelAnchor.left, window.innerWidth - 222), zIndex: 9999, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 210, boxShadow: '0 6px 24px rgba(0,0,0,0.2)', animation: 'dropdownIn 150ms ease forwards' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: t.text, cursor: 'pointer', fontWeight: 500 }}>
                        <input type="checkbox" checked={selectedEl.shadow?.enabled || false}
                          onChange={e => handleElementChange({ ...selectedEl, shadow: { ...(selectedEl.shadow||{}), enabled: e.target.checked } })} />
                        Enable shadow
                      </label>
                      {selectedEl.shadow?.enabled && <>
                        <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 4 }}>Color</label>
                        <input type="color" value={selectedEl.shadow?.color || '#000000'}
                          onChange={e => updateElement({ ...selectedEl, shadow: { ...selectedEl.shadow, color: e.target.value } })}
                          onBlur={() => pushHistory()} style={{ width: '100%', height: 28, marginBottom: 10, cursor: 'pointer', borderRadius: 6, border: `1px solid ${t.border}` }} />
                        {[{lbl:'Blur',k:'blur',mn:0,mx:40,def:4},{lbl:'Offset X',k:'offsetX',mn:-30,mx:30,def:2},{lbl:'Offset Y',k:'offsetY',mn:-30,mx:30,def:2}].map(({lbl,k,mn,mx,def}) => (
                          <div key={k} style={{ marginBottom: 8 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                              <span style={{ fontSize:11, color:t.textMuted }}>{lbl}</span>
                              <span style={{ fontSize:11, color:t.textMuted }}>{selectedEl.shadow?.[k]??def}</span>
                            </div>
                            <input type="range" min={mn} max={mx} value={selectedEl.shadow?.[k]??def}
                              onChange={e => updateElement({ ...selectedEl, shadow: {...(selectedEl.shadow||{}), [k]:parseInt(e.target.value)} })}
                              onMouseUp={() => pushHistory()} style={{ width:'100%' }} />
                          </div>
                        ))}
                      </>}
                    </div>
                  </>,
                  document.body
                )}
              </div>
              <D />
              <Btn label={<><IcoBringFwd size={14} /> Fwd</>}   active={false} onClick={() => bringForward()} />
              <Btn label={<><IcoSendBack size={14} /> Back</>}  active={false} onClick={() => sendBackward()} />
              <Btn label="Front" active={false} onClick={() => bringToFront()} />
              <Btn label="Back"  active={false} onClick={() => sendToBack()} />
              <D />
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Opacity</span>
              <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity??1}
                onChange={e => updateElement({...selectedEl, opacity:parseFloat(e.target.value)})}
                onMouseUp={() => pushHistory()} style={{ width:70, flexShrink:0 }} />
              <span style={{ fontSize:11, color:t.textMuted, minWidth:30, flexShrink:0 }}>{Math.round((selectedEl.opacity??1)*100)}%</span>
              <D />
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Blend</span>
              <select value={selectedEl.blendMode||'source-over'} onChange={e => { pushHistory(); patchElements(p => p.map(el => el.id===selectedEl.id ? {...el, blendMode:e.target.value} : el)); }} style={{ height:24, padding:'0 3px', borderRadius:5, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:11, cursor:'pointer', flexShrink:0, maxWidth:90 }}>
                {BLEND_MODES.map(m => <option key={m} value={m}>{BLEND_LABELS[m]}</option>)}
              </select>
              <D />
              <Btn label={lockedIds.has(selectedEl.id)?<IpLock size={13}/>:<IpUnlock size={13}/>} active={lockedIds.has(selectedEl.id)} onClick={() => toggleLocked(selectedEl.id)} />
            </>
          );
        })()}
        </div>{/* end scrollable left zone */}

        {/* ── Fixed right zone: alignment + dims + animate ── */}
        {selectedIds.length <= 1 && selectedEl && (() => {
          const D2 = () => <div style={{ width:1, height:22, background:t.border, margin:'0 4px', flexShrink:0 }} />;
          return (
            <div style={{ display:'flex', alignItems:'center', gap:1, flexShrink:0, paddingLeft:8, borderLeft:`1px solid ${t.border}`, marginLeft:4 }}>
              {/* Alignment */}
              <div style={{ display:'flex', gap:1, alignItems:'center' }}>
                {[
                  ['left',   <IcoAlignLeft  size={13}/>, 'Align left'],
                  ['centerH',<IcoAlignCH    size={13}/>, 'Center horizontally'],
                  ['right',  <IcoAlignRight size={13}/>, 'Align right'],
                  ['top',    <IcoAlignTop   size={13}/>, 'Align top'],
                  ['centerV',<IcoAlignCV    size={13}/>, 'Center vertically'],
                  ['bottom', <IcoAlignBot   size={13}/>, 'Align bottom'],
                ].map(([dir,icon,title]) => (
                  <button key={dir} title={title} onMouseDown={e => { e.preventDefault(); alignEl(selectedEl.id, dir); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:t.text, width:22, height:24, borderRadius:3, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {icon}
                  </button>
                ))}
              </div>
              <D2 />
              {/* Inline dimensions */}
              <div style={{ display:'flex', alignItems:'flex-end', gap:3, flexShrink:0 }}>
                {[['X','x'],['Y','y']].map(([lbl,k]) => (
                  <div key={k} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                    <span style={{ fontSize:9, color:t.textMuted, lineHeight:1, userSelect:'none' }}>{lbl}</span>
                    <input type="number" value={Math.round(selectedEl[k]||0)}
                      onChange={e => updateElement({...selectedEl, [k]: parseInt(e.target.value)||0})}
                      onBlur={() => pushHistory()}
                      style={{ width:50, height:24, padding:'0 3px', borderRadius:4, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, textAlign:'center', outline:'none', boxSizing:'border-box' }} />
                  </div>
                ))}
                {selectedEl.width != null && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                    <span style={{ fontSize:9, color:t.textMuted, lineHeight:1, userSelect:'none' }}>W</span>
                    <input type="number" value={Math.round(selectedEl.width||0)}
                      onChange={e => { const nw=Math.max(1,parseInt(e.target.value)||1); updateElement({...selectedEl, width:nw, height: lockAspectRatio&&selectedEl.height&&selectedEl.width ? Math.max(1,Math.round(nw*selectedEl.height/selectedEl.width)) : selectedEl.height}); }}
                      onBlur={() => pushHistory()}
                      style={{ width:52, height:24, padding:'0 3px', borderRadius:4, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, textAlign:'center', outline:'none', boxSizing:'border-box' }} />
                  </div>
                )}
                {selectedEl.width != null && selectedEl.height != null && (
                  <button title={lockAspectRatio?'Unlock aspect ratio':'Lock aspect ratio'}
                    onClick={() => setLockAspectRatio(p=>!p)}
                    style={{ alignSelf:'flex-end', height:24, width:18, border:'none', background:'transparent', cursor:'pointer', color:lockAspectRatio?t.primary:t.textMuted, padding:0, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', transition:'color 120ms ease' }}>
                    {lockAspectRatio?<IpLock size={12}/>:<IcoChain size={12}/>}
                  </button>
                )}
                {selectedEl.height != null && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                    <span style={{ fontSize:9, color:t.textMuted, lineHeight:1, userSelect:'none' }}>H</span>
                    <input type="number" value={Math.round(selectedEl.height||0)}
                      onChange={e => { const nh=Math.max(1,parseInt(e.target.value)||1); updateElement({...selectedEl, height:nh, width: lockAspectRatio&&selectedEl.height&&selectedEl.width ? Math.max(1,Math.round(nh*selectedEl.width/selectedEl.height)) : selectedEl.width}); }}
                      onBlur={() => pushHistory()}
                      style={{ width:52, height:24, padding:'0 3px', borderRadius:4, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, textAlign:'center', outline:'none', boxSizing:'border-box' }} />
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                  <span style={{ fontSize:9, color:t.textMuted, lineHeight:1, userSelect:'none' }}>°</span>
                  <input type="number" value={Math.round(selectedEl.rotation||0)}
                    onChange={e => updateElement({...selectedEl, rotation: parseInt(e.target.value)||0})}
                    onBlur={() => pushHistory()}
                    style={{ width:42, height:24, padding:'0 3px', borderRadius:4, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, textAlign:'center', outline:'none', boxSizing:'border-box' }} />
                </div>
                {/* Opacity % */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                  <span style={{ fontSize:9, color:t.textMuted, lineHeight:1, userSelect:'none' }}>%</span>
                  <input type="number" min={0} max={100} value={Math.round((selectedEl.opacity??1)*100)}
                    onChange={e => updateElement({...selectedEl, opacity: Math.max(0, Math.min(100, parseInt(e.target.value)||100)) / 100})}
                    onBlur={() => pushHistory()}
                    style={{ width:44, height:24, padding:'0 3px', borderRadius:4, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, textAlign:'center', outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <D2 />
              {/* Animate button + panel */}
              <div style={{ position:'relative' }} onClick={e => e.stopPropagation()}>
                <button onClick={e => { setPanelAnchor(e.currentTarget.getBoundingClientRect()); setShowAnimatePanel(p => !p); setShowShadowPanel(false); setShowOutlinePanel(false); setShowPositionPanel(false); }}
                  style={{ height:30, padding:'0 9px', border:'none', borderRadius:8, background:(showAnimatePanel || !!(selectedEl?.animateIn && selectedEl.animateIn !== 'none'))?t.primaryBg:'transparent', color:(showAnimatePanel || !!(selectedEl?.animateIn && selectedEl.animateIn !== 'none'))?t.primary:t.textSecondary, fontSize:13, cursor:'pointer', flexShrink:0, transition:'all 150ms cubic-bezier(0.34,1.56,0.64,1)', display:'flex', alignItems:'center', gap:4 }}>
                  <IpSparkle size={14} /> Animate
                </button>
                {showAnimatePanel && panelAnchor && createPortal(
                  <>
                    <div style={{ position:'fixed', inset:0, zIndex:9998 }} onMouseDown={() => setShowAnimatePanel(false)} />
                    <div style={{ position:'fixed', top:panelAnchor.bottom + 4, right:Math.max(0, window.innerWidth - panelAnchor.right), zIndex:9999, background:t.card, border:`1px solid ${t.border}`, borderRadius:12, padding:14, width:260, boxShadow:'0 8px 32px rgba(0,0,0,0.25)', animation:'dropdownIn 150ms ease forwards' }}>
                      <div style={{ fontSize:12, fontWeight:600, color:t.textMuted, marginBottom:10 }}>Entrance animation</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
                        {ANIMATE_PRESETS.map(a => {
                          const isActive = (selectedEl.animateIn || 'none') === a.id;
                          return (
                            <button key={a.id} title={a.desc}
                              onClick={() => { pushHistory(); handleElementChange({ ...selectedEl, animateIn: a.id }); }}
                              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'8px 4px', borderRadius:8, border:`1.5px solid ${isActive?t.primaryBorder:t.border}`, background:isActive?t.primaryBg:t.input, cursor:'pointer', color:isActive?t.primary:t.textSecondary, transition:'all 150ms cubic-bezier(0.34,1.56,0.64,1)' }}>
                              <span style={{ fontSize:18 }}>{a.icon}</span>
                              <span style={{ fontSize:10, fontWeight:isActive?600:400 }}>{a.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {selectedEl.animateIn && selectedEl.animateIn !== 'none' && (
                        <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}` }}>
                          <div style={{ fontSize:11, color:t.textMuted, marginBottom:6 }}>Duration</div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <input type="range" min={200} max={2000} step={100} value={selectedEl.animateDuration||600}
                              onChange={e => updateElement({...selectedEl, animateDuration:parseInt(e.target.value)})}
                              onMouseUp={() => pushHistory()} style={{ flex:1, accentColor:t.primary }} />
                            <span style={{ fontSize:11, color:t.textMuted, minWidth:36, textAlign:'right' }}>{((selectedEl.animateDuration||600)/1000).toFixed(1)}s</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>,
                  document.body
                )}
              </div>
              {/* Position — opens left panel (Canva-parity) */}
              <button
                onClick={() => { setActiveLeftTool('position'); setPanelOpen(true); }}
                style={{ height:30, padding:'0 9px', border:'none', borderRadius:8, background: activeLeftTool==='position' ? t.primaryBg : 'transparent', color: activeLeftTool==='position' ? t.primary : t.textSecondary, fontSize:13, cursor:'pointer', flexShrink:0, transition:'all 150ms cubic-bezier(0.34,1.56,0.64,1)', display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap' }}
                onMouseEnter={e => { if (activeLeftTool !== 'position') { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.color = t.text; } }}
                onMouseLeave={e => { if (activeLeftTool !== 'position') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textSecondary; } }}>
                Position
              </button>
            </div>
          );
        })()}

      </div>


      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left sidebar: 64px icon strip + 280px collapsible flyout ── */}

        {/* 72px icon strip — always visible (Canva-style) */}
        <div style={{ width: 72, borderRight: `1px solid ${t.border}`, background: t.sidebar,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '10px 0 8px', flexShrink: 0, gap: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
          {[
            { id: 'templates', icon: <IcoTemplates size={22} />, label: 'Templates' },
            { id: 'elements',  icon: <IpSparkle size={22} />,    label: 'Elements'  },
            { id: 'text',      icon: <IpTextCard size={22} />,   label: 'Text',      shortcut: 'T' },
            { id: 'brand',     icon: <IpPalette size={22} />,    label: 'Brand'    },
            { id: 'uploads',   icon: <IpPublish size={22} />,    label: 'Uploads'   },
            { id: 'layers',    icon: <IcoLayers size={22} />,    label: 'Layers'    },
            { id: 'tools',     icon: <IpEdit size={22} />,       label: 'Tools'     },
            { id: 'projects',  icon: <IpFolderOpen size={22} />, label: 'Projects'  },
            { id: 'apps',      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v6M14.5 17h6"/></svg>, label: 'Apps'     },
          ].map(tool => {
            const isActive = activeLeftTool === tool.id && panelOpen;
            return (
            <button key={tool.id} onClick={() => handleToolClick(tool.id)}
              onMouseEnter={e => { showTip(e, tool.label, tool.shortcut); if (!isActive) e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }}
              onMouseLeave={e => { hideTip(); e.currentTarget.style.background = isActive ? t.primaryBg : 'transparent'; }}
              style={{
                width: 60, height: 56, padding: '0',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                background: isActive ? t.primaryBg : 'transparent',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
                color: isActive ? t.primary : t.textSecondary,
                transition: 'background 120ms ease, color 100ms ease',
                position: 'relative', flexShrink: 0,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tool.icon}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, lineHeight: 1, textAlign: 'center', letterSpacing: '-0.01em' }}>{tool.label}</span>
              {/* active indicator removed — Canva uses background fill only, no border line */}
            </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ width: 40, height: 1, background: t.border, margin: '6px 0' }} />
          {[
            { id: 'magic', icon: <IpSparkle size={22} />, label: 'Magic Media' },
          ].map(tool => {
            const isActive = activeLeftTool === tool.id && panelOpen;
            return (
            <button key={tool.id} onClick={() => handleToolClick(tool.id)}
              onMouseEnter={e => { showTip(e, tool.label); if (!isActive) e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }}
              onMouseLeave={e => { hideTip(); e.currentTarget.style.background = isActive ? t.primaryBg : 'transparent'; }}
              style={{
                width: 60, height: 56,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                background: isActive ? t.primaryBg : 'transparent',
                border: 'none', borderRadius: 12, cursor: 'pointer',
                color: isActive ? t.primary : t.textSecondary,
                transition: 'background 120ms ease, color 100ms ease', flexShrink: 0,
              }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tool.icon}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, lineHeight: 1, textAlign: 'center', letterSpacing: '-0.01em' }}>{tool.label}</span>
            </button>
            );
          })}
        </div>

        {/* Tools floating tile column — appears instead of flyout when Tools active */}
        {activeLeftTool === 'tools' && panelOpen && (
          <div style={{
            position: 'fixed', left: 72, top: 56, zIndex: 120,
            background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            padding: '8px 8px 10px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            animation: 'panel-in 180ms cubic-bezier(0.16,1,0.3,1) forwards',
          }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
              <button onMouseDown={() => setPanelOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>
            {[
              { bg: '#f3f4f6', icon: '↖', dark: true,  title: 'Select', fn: () => setDrawMode(false) },
              { bg: 'linear-gradient(135deg,#ef4444,#dc2626)', icon: '✎', title: 'Pen',    fn: () => { setDrawMode(true); clearSelection(); } },
              { bg: '#374151', icon: '◉',  title: 'Eraser', fn: () => {} },
              { bg: '#3b82f6', icon: '╱',  title: 'Line',   fn: () => {} },
              { bg: '#f59e0b', icon: '▭',  title: 'Shape',  fn: () => {} },
              { bg: '#7c5cfc', icon: 'T',  title: 'Text',   fn: () => {} },
              { bg: '#0f172a', icon: '⊞',  title: 'Table',  fn: () => {} },
            ].map(tile => {
              const isActive = (tile.title === 'Pen' && drawMode) || (tile.title === 'Select' && !drawMode);
              return (
                <button key={tile.title} onMouseDown={tile.fn} title={tile.title}
                  onMouseEnter={e => showTip(e, tile.title)}
                  onMouseLeave={hideTip}
                  style={{
                    width: 42, height: 42, borderRadius: 10,
                    border: isActive ? `2px solid ${t.primary}` : '2px solid transparent',
                    background: tile.bg, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, color: tile.dark ? '#374151' : '#fff',
                    transition: 'opacity 80ms', flexShrink: 0,
                    boxShadow: isActive ? `0 0 0 3px ${t.primary}33` : '0 1px 3px rgba(0,0,0,0.15)',
                  }}>
                  {tile.icon}
                </button>
              );
            })}
          </div>
        )}

        {/* 300px collapsible flyout */}
        <div style={{
          width: (panelOpen && activeLeftTool !== 'tools') ? 300 : 0,
          overflow: 'hidden',
          transition: 'width 180ms cubic-bezier(0.16,1,0.3,1)',
          borderRight: panelOpen ? `1px solid ${t.border}` : 'none',
          background: t.sidebar,
          position: 'relative',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Tool content — rendered only when flyout is open */}
          {panelOpen && (
          <div key={activeLeftTool} style={{ flex: 1, overflowY: 'auto', padding: '16px', minWidth: 300, animation: 'panel-in 180ms cubic-bezier(0.16,1,0.3,1) forwards' }}>

            {/* TEMPLATES / DESIGN */}
            {(activeLeftTool === 'background' || activeLeftTool === 'templates') && (
              <div>
                {/* Search templates — Canva style: [+] prefix LEFT + mic RIGHT */}
                <div style={{ display: 'flex', alignItems: 'center', background: t.input, borderRadius: 22, padding: '0 14px', marginBottom: 14, height: 44, border: `1px solid ${t.border}` }}>
                  {/* [+] prefix icon on left */}
                  <span style={{ color: t.textMuted, fontSize: 20, fontWeight: 300, lineHeight: 1, flexShrink: 0, marginRight: 8, userSelect: 'none' }}>+</span>
                  <input placeholder="Search templates" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                  {/* Mic icon on right */}
                  <button style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 8 }} title="Search by voice">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  </button>
                </div>

                {/* ── ItsPosting Curated Templates ── */}
                {activeLeftTool === 'templates' && (() => {
                  const CATS = [
                    { id: 'all',          label: 'All' },
                    { id: 'before-after', label: 'Before & After' },
                    { id: 'social-proof', label: 'Reviews' },
                    { id: 'seasonal',     label: 'Seasonal' },
                    { id: 'showcase',     label: 'Showcase' },
                    { id: 'educational',  label: 'Tips' },
                    { id: 'promotional',  label: 'Promos' },
                    { id: 'team',         label: 'Team' },
                    { id: 'announcement', label: 'News' },
                  ];
                  const CAT_ICONS = { 'all':'✦', 'before-after':'◑', 'social-proof':'★', 'seasonal':'📅', 'showcase':'📸', 'educational':'💡', 'promotional':'🎁', 'team':'👥', 'announcement':'📢' };
                  const filtered = templateCategory === 'all' ? curatedTemplates : curatedTemplates.filter(tmpl => tmpl.category === templateCategory);
                  return (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>ItsPosting Templates</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {thumbGenProgress ? (
                            <div style={{ fontSize: 10, color: t.primary, fontWeight: 600 }}>{thumbGenProgress.current}/{thumbGenProgress.total}</div>
                          ) : brandProfile?.is_admin && curatedTemplates.some(t => !t.thumbnail_url) ? (
                            <button onClick={generateAllThumbsFromCanvas}
                              title="Generate permanent thumbnails for all templates (admin only)"
                              style={{ fontSize: 10, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontWeight: 600 }}>
                              Gen Thumbs
                            </button>
                          ) : null}
                          <div style={{ fontSize: 11, color: t.textMuted }}>{filtered.length}</div>
                        </div>
                      </div>
                      {/* Category chips */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                        {CATS.map(cat => (
                          <button key={cat.id} onClick={() => setTemplateCategory(cat.id)}
                            style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${templateCategory === cat.id ? t.primaryBorder : t.border}`, background: templateCategory === cat.id ? t.primaryBg : 'transparent', color: templateCategory === cat.id ? t.primary : t.textMuted, fontSize: 11, fontWeight: templateCategory === cat.id ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)' }}>
                            {CAT_ICONS[cat.id]} {cat.label}
                          </button>
                        ))}
                      </div>
                      {curatedLoading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} style={{ aspectRatio: '4/5', borderRadius: 8,
                              background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`,
                              backgroundSize: '1000px 100%', animation: `shimmer 1.4s ${i * 0.1}s ease-in-out infinite` }} />
                          ))}
                        </div>
                      ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: t.textMuted }}>
                          <div style={{ fontSize: 28, marginBottom: 6 }}>🎨</div>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>No templates in this category yet</div>
                          <div style={{ fontSize: 11 }}>More coming soon</div>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                          {filtered.map(tmpl => (
                            <div key={tmpl.id} style={{ cursor: 'pointer', transition: 'transform 150ms cubic-bezier(0.34,1.56,0.64,1)' }}
                              onMouseEnter={e => { e.currentTarget.querySelector('.tmpl-overlay').style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                              onMouseLeave={e => { e.currentTarget.querySelector('.tmpl-overlay').style.opacity = '0'; e.currentTarget.style.transform = 'scale(1)'; }}>
                              <div style={{ aspectRatio: '4/5', borderRadius: 10, overflow: 'hidden', background: t.input, border: `1px solid ${t.border}`, marginBottom: 4, position: 'relative', boxShadow: t.shadowSm }}>
                                {(() => {
                                  const thumbSrc = tmpl.thumbnail_url || templateThumbs[tmpl.id];
                                  return thumbSrc
                                    ? <img src={thumbSrc} alt={tmpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : (
                                      <div style={{ width: '100%', height: '100%', background: tmpl.canvas_json?.pages?.[0]?.bgColor || '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 }}>
                                        <span style={{ fontSize: 20 }}>{CAT_ICONS[tmpl.category] || '✦'}</span>
                                        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.3, fontWeight: 600 }}>{tmpl.name}</span>
                                      </div>
                                    );
                                })()}
                                <div className="tmpl-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 120ms ease', backdropFilter: 'blur(2px)' }}>
                                  <button
                                    onClick={async () => {
                                      try {
                                        if (tmpl.canvas_json) {
                                          restoreSnapshot(tmpl.canvas_json);
                                        } else {
                                          const r = await studioAPI.getTemplate(tmpl.id);
                                          if (r.data?.template?.canvas_json) restoreSnapshot(r.data.template.canvas_json);
                                        }
                                      } catch {}
                                    }}
                                    style={{ fontSize: 12, fontWeight: 600, background: t.primary, color: '#fff', padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', letterSpacing: '-0.01em' }}>
                                    Use Template
                                  </button>
                                </div>
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tmpl.name}>{tmpl.name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── My Designs (only in templates panel) ── */}
                {activeLeftTool === 'templates' && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>My Designs</div>
                      {savedDesigns.length > 0 && (
                        <button
                          onClick={() => router.push('/media?tab=templates')}
                          style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          See all
                        </button>
                      )}
                    </div>
                    {savedDesignsLoading ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} style={{ aspectRatio: '4/5', borderRadius: 8,
                            background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`,
                            backgroundSize: '1000px 100%', animation: `shimmer 1.4s ${i * 0.1}s ease-in-out infinite` }} />
                        ))}
                      </div>
                    ) : savedDesigns.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: t.textMuted }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>✦</div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>No saved designs yet</div>
                        <div style={{ fontSize: 11 }}>Save this design to see it here</div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        {savedDesigns.slice(0, 6).map(d => (
                          <div key={d.id}
                            onClick={() => { if (typeof window !== 'undefined') window.location.href = `/templates/editor?id=${d.id}`; }}
                            style={{ cursor: 'pointer', position: 'relative' }}
                            onMouseEnter={e => e.currentTarget.querySelector('.design-overlay').style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.querySelector('.design-overlay').style.opacity = '0'}>
                            <div style={{ aspectRatio: '4/5', borderRadius: 8, overflow: 'hidden', background: t.input, border: `1px solid ${t.border}`, marginBottom: 4 }}>
                              {d.output_url
                                ? <img src={d.output_url} alt={d.title || 'Design'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: t.textMuted }}>No preview</div>
                              }
                              <div className="design-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms' }}>
                                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, background: '#7C5CFC', padding: '5px 10px', borderRadius: 20 }}>Open</span>
                              </div>
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title || 'Untitled'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Background section header ── */}
                <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 10 }}>Background</div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Color</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {/* Transparent background tile */}
                    <button onClick={() => { pushHistory(); patchPage({ bgType: 'transparent', bgColor: 'transparent' }); }}
                      title="No background (transparent)"
                      style={{ width: 28, height: 28, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                        background: 'repeating-conic-gradient(#888 0% 25%, #fff 0% 50%) 0 0 / 10px 10px',
                        border: bgType === 'transparent' ? `3px solid ${t.primary}` : `2px solid ${t.border}` }} />
                    {COLOR_PALETTE.map(hex => (
                      <button key={hex} onClick={() => { pushHistory(); patchPage({ bgType: 'color', bgColor: hex }); pickColor(hex, () => {}); }}
                        style={{ width: 28, height: 28, borderRadius: 6, background: hex, border: bgType === 'color' && bgColor === hex ? `3px solid ${t.primary}` : `2px solid ${t.border}`, cursor: 'pointer' }} />
                    ))}
                    <input type="color" value={bgColor}
                      onChange={e => { patchPage({ bgType: 'color', bgColor: e.target.value }); }}
                      onBlur={e => { pushHistory(); pickColor(e.target.value, () => {}); }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2 }} title="Custom color" />
                  </div>
                  {recentColors.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>Recent</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {recentColors.map(c => (
                          <button key={c} onClick={() => { pushHistory(); patchPage({ bgType: 'color', bgColor: c }); }}
                            style={{ width: 22, height: 22, borderRadius: 4, background: c, border: `1px solid ${t.border}`, cursor: 'pointer' }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* ── Color Palettes ── */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Color Palettes</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {COLOR_SCHEMES.map(scheme => (
                      <button key={scheme.name} title={scheme.name}
                        onClick={() => {
                          pushHistory();
                          patchPage({ bgType: 'color', bgColor: scheme.colors[0] });
                          setRecentColors(prev => {
                            const combined = [...scheme.colors, ...prev].filter((c, i, a) => a.indexOf(c) === i);
                            return combined.slice(0, 12);
                          });
                        }}
                        style={{ border: `1px solid ${t.border}`, borderRadius: 7, overflow: 'hidden', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', height: 32 }}>
                        <div style={{ display: 'flex', height: '100%' }}>
                          {scheme.colors.map(c => (
                            <div key={c} style={{ flex: 1, background: c }} />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                {/* ── Gradient section ── */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Gradient</div>
                  {/* Preset swatches */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                    {GRADIENT_PRESETS.map(g => {
                      const isActive = bgType === 'gradient' && bgGradient?.c1 === g.c1 && bgGradient?.c2 === g.c2;
                      return (
                        <button key={g.label} title={g.label}
                          onClick={() => { pushHistory(); patchPage({ bgType: 'gradient', bgGradient: { c1: g.c1, c2: g.c2, angle: g.angle } }); }}
                          style={{ height: 36, borderRadius: 8, border: `2px solid ${isActive ? t.primary : t.border}`, background: `linear-gradient(${g.angle}deg, ${g.c1}, ${g.c2})`, cursor: 'pointer', padding: 0, transition:'border-color 120ms ease' }} />
                      );
                    })}
                  </div>
                  {/* Custom gradient editor */}
                  {bgType === 'gradient' && bgGradient && (
                    <div style={{ background: t.input, borderRadius: 9, padding: '10px 10px 8px' }}>
                      {/* Preview bar */}
                      <div style={{ height: 14, borderRadius: 5, marginBottom: 10,
                        background: bgGradient.type === 'radial'
                          ? (bgGradient.midColor
                              ? `radial-gradient(circle, ${bgGradient.c1}, ${bgGradient.midColor} ${Math.round((bgGradient.midStop ?? 0.5) * 100)}%, ${bgGradient.c2})`
                              : `radial-gradient(circle, ${bgGradient.c1}, ${bgGradient.c2})`)
                          : (bgGradient.midColor
                              ? `linear-gradient(${bgGradient.angle}deg, ${bgGradient.c1}, ${bgGradient.midColor} ${Math.round((bgGradient.midStop ?? 0.5) * 100)}%, ${bgGradient.c2})`
                              : `linear-gradient(${bgGradient.angle}deg, ${bgGradient.c1}, ${bgGradient.c2})`) }} />
                      {/* Linear / Radial toggle */}
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8, background: t.card, borderRadius: 7, padding: 3 }}>
                        {['linear','radial'].map(type => (
                          <button key={type} onClick={() => { pushHistory(); patchPage({ bgGradient: { ...bgGradient, type } }); }}
                            style={{ flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 500, borderRadius: 5, border: 'none',
                              background: (bgGradient.type || 'linear') === type ? t.primaryBg : 'transparent',
                              color: (bgGradient.type || 'linear') === type ? t.primary : t.textMuted, cursor: 'pointer', textTransform: 'capitalize' }}>
                            {type}
                          </button>
                        ))}
                      </div>
                      {/* Color stops */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3 }}>Color 1</div>
                          <input type="color" value={bgGradient.c1}
                            onChange={e => patchPage({ bgGradient: { ...bgGradient, c1: e.target.value } })}
                            onBlur={() => pushHistory()}
                            style={{ width: '100%', height: 30, borderRadius: 6, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2 }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3 }}>Color 2</div>
                          <input type="color" value={bgGradient.c2}
                            onChange={e => patchPage({ bgGradient: { ...bgGradient, c2: e.target.value } })}
                            onBlur={() => pushHistory()}
                            style={{ width: '100%', height: 30, borderRadius: 6, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2 }} />
                        </div>
                        <button title="Swap colors"
                          onClick={() => { pushHistory(); patchPage({ bgGradient: { ...bgGradient, c1: bgGradient.c2, c2: bgGradient.c1 } }); }}
                          style={{ width: 28, height: 28, marginTop: 14, borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.text, cursor: 'pointer', flexShrink: 0, fontSize: 14 }}>
                          ⇄
                        </button>
                      </div>
                      {/* Mid color stop */}
                      {bgGradient.midColor ? (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3 }}>Mid color</div>
                            <input type="color" value={bgGradient.midColor}
                              onChange={e => patchPage({ bgGradient: { ...bgGradient, midColor: e.target.value } })}
                              onBlur={() => pushHistory()}
                              style={{ width: '100%', height: 30, borderRadius: 6, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2 }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3 }}>Position {Math.round((bgGradient.midStop ?? 0.5) * 100)}%</div>
                            <input type="range" min={5} max={95} step={5} value={Math.round((bgGradient.midStop ?? 0.5) * 100)}
                              onChange={e => patchPage({ bgGradient: { ...bgGradient, midStop: parseInt(e.target.value) / 100 } })}
                              onMouseUp={() => pushHistory()}
                              style={{ width: '100%', accentColor: t.primary, marginTop: 6 }} />
                          </div>
                          <button title="Remove mid color" onClick={() => { pushHistory(); const { midColor, midStop, ...rest } = bgGradient; patchPage({ bgGradient: rest }); }}
                            style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.textMuted, cursor: 'pointer', flexShrink: 0, fontSize: 14, marginBottom: 0 }}>
                            ×
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { pushHistory(); patchPage({ bgGradient: { ...bgGradient, midColor: '#ffffff', midStop: 0.5 } }); }}
                          style={{ width: '100%', padding: '5px 0', marginBottom: 8, borderRadius: 6, border: `1px dashed ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 11, cursor: 'pointer' }}>
                          + Add mid color stop
                        </button>
                      )}
                      {/* Angle (linear only) */}
                      {(bgGradient.type || 'linear') === 'linear' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, color: t.textMuted, whiteSpace: 'nowrap' }}>Angle</span>
                          <input type="range" min={0} max={360} step={15} value={bgGradient.angle ?? 135}
                            onChange={e => patchPage({ bgGradient: { ...bgGradient, angle: parseInt(e.target.value) } })}
                            onMouseUp={() => pushHistory()}
                            style={{ flex: 1, accentColor: t.primary }} />
                          <span style={{ fontSize: 10, color: t.textMuted, width: 28, textAlign: 'right' }}>{bgGradient.angle ?? 135}°</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Quick angle presets when no gradient active */}
                  {bgType !== 'gradient' && (
                    <button onClick={() => { pushHistory(); patchPage({ bgType: 'gradient', bgGradient: GRADIENT_PRESETS[0] }); }}
                      style={{ width: '100%', padding: '7px 0', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.textMuted, fontSize: 12, cursor: 'pointer' }}>
                      + Custom gradient
                    </button>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Pattern</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {[
                      { id: null,         label: 'None',   preview: null },
                      { id: 'dots',       label: 'Dots',   preview: 'radial-gradient(circle, rgba(255,255,255,0.5) 1.5px, transparent 1.5px) 0 0 / 14px 14px' },
                      { id: 'grid',       label: 'Grid',   preview: 'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px) 0 0 / 18px 18px' },
                      { id: 'diagonal',   label: 'Lines',  preview: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0, rgba(255,255,255,0.4) 1px, transparent 0, transparent 50%) 0 0 / 14px 14px' },
                      { id: 'crosshatch', label: 'Cross',  preview: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0, rgba(255,255,255,0.3) 1px, transparent 0, transparent 50%) 0 0 / 14px 14px, repeating-linear-gradient(-45deg, rgba(255,255,255,0.3) 0, rgba(255,255,255,0.3) 1px, transparent 0, transparent 50%) 0 0 / 14px 14px' },
                    ].map(pat => {
                      const active = bgPattern === pat.id;
                      return (
                        <button key={String(pat.id)} onClick={() => { pushHistory(); patchPage({ bgPattern: pat.id }); }}
                          style={{ border: `2px solid ${active ? t.primary : t.border}`, borderRadius: 7, padding: 0, cursor: 'pointer', overflow: 'hidden', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingBottom: 5 }}>
                          <div style={{ width: '100%', aspectRatio: '1', background: pat.preview ? `${bgColor || '#1a1a22'}` : t.input, borderRadius: '5px 5px 0 0' }}>
                            {pat.preview && <div style={{ width: '100%', height: '100%', background: pat.preview, borderRadius: '5px 5px 0 0' }} />}
                          </div>
                          <span style={{ fontSize: 9, color: active ? t.primary : t.textMuted }}>{pat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  {/* Document colors — click to replace all instances */}
                  {docColors.length > 0 && (
                    <div style={{ marginBottom: 16 }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>Document Colors</div>
                      <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 8 }}>Click a color to replace all uses</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {docColors.map(c => (
                          <div key={c} style={{ position: 'relative' }}>
                            <button title={`Replace ${c}`}
                              onClick={() => setReplaceDocColorOld(prev => prev === c ? null : c)}
                              style={{ width: 32, height: 32, borderRadius: 8, background: c, border: `3px solid ${replaceDocColorOld === c ? t.primary : 'rgba(255,255,255,0.15)'}`, cursor: 'pointer', flexShrink: 0, boxShadow: replaceDocColorOld === c ? `0 0 0 2px ${t.primaryBorder}` : 'none', transition:'box-shadow 120ms ease, border-color 120ms ease' }} />
                            {replaceDocColorOld === c && (
                              <div style={{ position: 'absolute', top: 38, left: 0, zIndex: 500, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 10, width: 200, boxShadow: '0 6px 24px rgba(0,0,0,0.3)' }}>
                                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8 }}>Replace <span style={{ fontWeight: 600, color: t.text }}>{c}</span> with:</div>
                                <input type="color" defaultValue={c}
                                  onBlur={e => replaceDocColor(c, e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') replaceDocColor(c, e.target.value); }}
                                  style={{ width: '100%', height: 36, cursor: 'pointer', borderRadius: 6, border: `1px solid ${t.border}`, marginBottom: 8 }} />
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                  {COLOR_PALETTE.slice(0, 12).map(pc => (
                                    <button key={pc} onMouseDown={() => replaceDocColor(c, pc)}
                                      style={{ width: 22, height: 22, borderRadius: 4, background: pc, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: 0 }} />
                                  ))}
                                </div>
                                <button onClick={() => setReplaceDocColorOld(null)} style={{ width: '100%', padding: '5px 0', border: `1px solid ${t.border}`, borderRadius: 6, background: 'transparent', color: t.textMuted, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Photo Background</div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: t.input, borderRadius: 7, padding: 3 }}>
                    {['stock', 'mine'].map(tab => (
                      <button key={tab} onClick={() => setBgTab(tab)}
                        style={{ flex: 1, padding: '5px 0', fontSize: 12, fontWeight: 600, borderRadius: 5, border: 'none', background: bgTab === tab ? t.card : 'transparent', color: bgTab === tab ? t.text : t.textMuted, cursor: 'pointer' }}>
                        {tab === 'stock' ? 'Stock' : 'My Media'}
                      </button>
                    ))}
                  </div>
                  {bgPhotosLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ borderRadius: 7, aspectRatio: '1', background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`, backgroundSize: '1000px 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                      ))}
                    </div>
                  ) : displayedBgPhotos.length === 0 ? (
                    <div style={{ textAlign: 'center', color: t.textMuted, padding: '20px 0', fontSize: 12 }}>
                      {bgTab === 'mine' ? 'No uploaded images yet' : 'No stock photos available'}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {displayedBgPhotos.map(photo => (
                        <div key={photo.id} onClick={() => selectBgPhoto(photo)}
                          style={{ borderRadius: 7, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${bgImageUrl === photo.url ? t.primary : t.border}`, transition: 'border-color 120ms' }}>
                          <img src={photo.thumbnail_url || photo.url} alt={photo.title || ''} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TEXT */}
            {activeLeftTool === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                {/* S1: Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 10, padding: '7px 10px', marginBottom: 10, transition: 'box-shadow 120ms ease', border: `1px solid ${fontSearch ? t.primaryBorder : t.border}`, boxShadow: fontSearch ? `0 0 0 3px ${t.primaryBg}` : 'none', flexShrink: 0 }}>
                  <IpSearch size={14} style={{ color: t.textMuted, flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search fonts and combinations"
                    value={fontSearch}
                    onChange={e => setFontSearch(e.target.value)}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }}
                  />
                  {fontSearch && (
                    <button onMouseDown={e => { e.preventDefault(); setFontSearch(''); }}
                      style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
                  )}
                </div>

                {/* Scrollable content: sections 2–7 */}
                <div style={{ flex: 1, overflowY: 'auto' }}>

                  {/* S2: Add a text box — full-width purple primary (Canva: "T + Add a text box") */}
                  <button onMouseDown={e => { e.preventDefault(); addText(); }}
                    style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${t.primary}, ${t.primaryHover})`, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <IpTextCard size={15} /> + Add a text box
                  </button>

                  {/* S3: Magic Write (PostCore Write) — neutral outlined button, like Canva's "✦ Magic Write" */}
                  <button style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <IpSparkle size={14} color={t.primary} /> Magic Write
                  </button>

                  {/* S4: Brand Kit */}
                  {!fontSearch && (() => {
                    const BRAND_FONTS = [
                      { label: 'Heading',    fontFamily: 'Bebas Neue', previewSize: 22, overrides: { fontSize: 64, fontFamily: 'Bebas Neue',  fontStyle: 'normal', text: 'Service Announcement', letterSpacing: 2 } },
                      { label: 'Subheading', fontFamily: 'Montserrat', previewSize: 14, overrides: { fontSize: 36, fontFamily: 'Montserrat',  fontStyle: 'bold',   text: 'Your Local Expert' } },
                      { label: 'Body',       fontFamily: 'Inter',      previewSize: 11, overrides: { fontSize: 20, fontFamily: 'Inter',        fontStyle: 'normal', text: 'Professional service you can trust' } },
                    ];
                    const BRAND_COLORS = ['#00C4CC', '#7C5CFC', '#9B7FFF', '#1a1a2e', '#ffffff', '#0f172a'];
                    return (
                      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Brand Kit</span>
                          <button style={{ background: 'none', border: 'none', color: t.primary, fontSize: 12, cursor: 'pointer', padding: 0, fontWeight: 500 }}>Edit</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                          {BRAND_FONTS.map(bf => (
                            <button key={bf.label} onMouseDown={e => { e.preventDefault(); addText(bf.overrides); }}
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, textAlign: 'left', cursor: 'pointer', fontFamily: bf.fontFamily, fontSize: bf.previewSize, display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              {bf.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {BRAND_COLORS.map(hex => (
                            <button key={hex} onMouseDown={e => { e.preventDefault(); if (selectedEl?.type === 'text') handleElementChange({ ...selectedEl, fill: hex }); }}
                              style={{ width: 24, height: 24, borderRadius: 6, background: hex, border: `1.5px solid ${t.border}`, cursor: 'pointer', flexShrink: 0 }} />
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* S5: Default text styles */}
                  {!fontSearch && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Default Text Styles</div>
                      {[
                        { label: 'Add a heading',    family: 'Bebas Neue', size: 28, weight: 400, previewText: 'HEADING',    subLabel: 'Bebas Neue · 64px',    overrides: { fontSize: 64,  fontFamily: 'Bebas Neue',   fontStyle: 'normal', text: 'Service Announcement', letterSpacing: 2 } },
                        { label: 'Add a subheading', family: 'Montserrat', size: 17, weight: 700, previewText: 'Subheading', subLabel: 'Montserrat Bold · 36px', overrides: { fontSize: 36,  fontFamily: 'Montserrat',   fontStyle: 'bold',   text: 'Your Local Expert' } },
                        { label: 'Add a little bit of body text', family: 'Inter', size: 12, weight: 400, previewText: 'Body text — professional service you can trust', subLabel: 'Inter · 20px', overrides: { fontSize: 20, fontFamily: 'Inter', fontStyle: 'normal', text: 'Professional service you can trust' } },
                      ].map(s => (
                        <button key={s.label} onMouseDown={e => { e.preventDefault(); addText(s.overrides); }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.transform = 'scale(1.01)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = ''; }}
                          style={{ width: '100%', display: 'block', border: `1px solid ${t.border}`, borderRadius: 8, background: t.input, cursor: 'pointer', marginBottom: 7, overflow: 'hidden', textAlign: 'left', padding: 0, transition: 'border-color 150ms, transform 150ms' }}>
                          <div style={{ padding: '10px 14px 8px', background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderBottom: `1px solid ${t.border}` }}>
                            <span style={{ fontFamily: s.family, fontSize: s.size, fontWeight: s.weight, color: t.text, display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', lineHeight: 1.3 }}>{s.previewText}</span>
                          </div>
                          <div style={{ padding: '4px 10px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 10, color: t.textMuted }}>{s.label}</span>
                            <span style={{ fontSize: 9, color: t.textMuted, opacity: 0.6 }}>{s.subLabel}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Dynamic text */}
                  {!fontSearch && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Dynamic text</div>
                      <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${t.border}`, borderRadius: 10, background: t.input, cursor: 'pointer', padding: '10px 12px', textAlign: 'left', transition: 'border-color 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = t.primaryBorder}
                        onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
                        <div style={{ width: 44, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                          <div style={{ width: 26, height: 26, borderRadius: 4, border: '2px solid rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1 }}>1</span>
                          </div>
                          <span style={{ position: 'absolute', bottom: 3, right: 5, fontSize: 11, fontWeight: 800, color: '#fff' }}>2</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>Page numbers</span>
                      </button>
                    </div>
                  )}

                  {/* Apps section */}
                  {!fontSearch && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Apps</div>
                        <button style={{ fontSize: 12, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}>See all</button>
                      </div>
                    </div>
                  )}

                  {/* S6: Font Combinations */}
                  {!fontSearch && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Font Combinations</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        {TEXT_COMBOS.map(combo => (
                          <div key={combo.id} onMouseDown={e => { e.preventDefault(); addTextCombo(combo.lines); }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.transform = 'scale(1.03)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = ''; }}
                            style={{ border: `1px solid ${t.border}`, borderRadius: 8, background: t.input, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s' }}>
                            <div style={{ padding: '10px 10px 8px', minHeight: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
                              {combo.preview.map((p, pi) => (
                                <div key={pi} style={{ fontFamily: p.fontFamily, fontSize: p.previewSize, fontWeight: p.bold ? 700 : 400, fontStyle: p.italic ? 'italic' : 'normal', textTransform: p.uppercase ? 'uppercase' : 'none', letterSpacing: p.letterSpacing || 0, color: t.text, opacity: pi === 0 ? 1 : 0.7, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                                  {p.text}
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: 9, color: t.textMuted, padding: '3px 10px 5px', borderTop: `1px solid ${t.border}`, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              {combo.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* S7: Font list */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>
                      {fontSearch ? `Fonts — "${fontSearch}"` : 'Fonts'}
                    </div>
                    {fontSearch ? (
                      <>
                        {FONTS.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())).map(f => {
                          const isActive = selectedEl?.type === 'text' && (selectedEl.fontFamily || 'Inter') === f;
                          return (
                            <button key={f} onMouseDown={e => { e.preventDefault(); if (selectedEl?.type === 'text') handleElementChange({ ...selectedEl, fontFamily: f }); }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${isActive ? t.primaryBorder : 'transparent'}`, background: isActive ? t.primaryBg : 'transparent', color: isActive ? t.primary : t.text, fontSize: 15, fontFamily: f, textAlign: 'left', cursor: 'pointer', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {f}
                            </button>
                          );
                        })}
                        {FONTS.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())).length === 0 && (
                          <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 12, padding: '20px 0' }}>No fonts match "{fontSearch}"</div>
                        )}
                      </>
                    ) : (
                      FONT_GROUPS.map(group => (
                        <div key={group.label} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 4, paddingLeft: 4 }}>{group.label}</div>
                          {group.fonts.map(f => {
                            const isActive = selectedEl?.type === 'text' && (selectedEl.fontFamily || 'Inter') === f;
                            return (
                              <button key={f} onMouseDown={e => { e.preventDefault(); if (selectedEl?.type === 'text') handleElementChange({ ...selectedEl, fontFamily: f }); }}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${isActive ? t.primaryBorder : 'transparent'}`, background: isActive ? t.primaryBg : 'transparent', color: isActive ? t.primary : t.text, fontSize: 15, fontFamily: f, textAlign: 'left', cursor: 'pointer', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {f}
                              </button>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>

                </div>{/* end scrollable */}

                {/* S8: Text properties — unchanged */}
                {selectedEl?.type === 'text' && (
                  <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, flexShrink: 0 }}>
                    {/* Size + B/I/Align row */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
                      <input type="number" min={8} max={400} value={selectedEl.fontSize || 36}
                        onChange={e => handleElementChange({ ...selectedEl, fontSize: Math.max(8, Math.min(400, parseInt(e.target.value) || 36)) })}
                        onBlur={() => pushHistory()}
                        style={{ width: 56, padding: '6px 8px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, textAlign: 'center' }} />
                      {[{ label: 'B', style: 'bold' }, { label: 'I', style: 'italic' }].map(({ label, style }) => {
                        const active = (selectedEl.fontStyle || '').includes(style);
                        return (
                          <button key={style} onMouseDown={e => { e.preventDefault(); const cur = selectedEl.fontStyle || 'normal'; const next = active ? cur.replace(style, '').trim() || 'normal' : (cur === 'normal' ? style : `${cur} ${style}`); handleElementChange({ ...selectedEl, fontStyle: next }); }}
                            style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${active ? t.primaryBorder : t.border}`, background: active ? t.primaryBg : 'transparent', color: active ? t.primary : t.textSecondary, fontWeight: style === 'bold' ? 700 : 400, fontStyle: style === 'italic' ? 'italic' : 'normal', cursor: 'pointer', fontSize: 13, flexShrink: 0, transition:'all 120ms ease' }}>
                            {label}
                          </button>
                        );
                      })}
                      {[['left', '≡'], ['center', '☰'], ['right', '≡']].map(([align, icon], i) => (
                        <button key={align} onMouseDown={e => { e.preventDefault(); handleElementChange({ ...selectedEl, align }); }}
                          style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${(selectedEl.align || 'left') === align ? t.primaryBorder : t.border}`, background: (selectedEl.align || 'left') === align ? t.primaryBg : 'transparent', color: (selectedEl.align || 'left') === align ? t.primary : t.textSecondary, cursor: 'pointer', fontSize: 12, flexShrink: 0, transform: i === 2 ? 'scaleX(-1)' : 'none', transition:'all 120ms ease' }}>
                          {icon}
                        </button>
                      ))}
                    </div>
                    {/* Color row */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                      {COLOR_PALETTE.map(hex => (
                        <button key={hex} onMouseDown={e => { e.preventDefault(); handleElementChange({ ...selectedEl, fill: hex }); pickColor(hex, () => {}); }}
                          style={{ width: 22, height: 22, borderRadius: 5, background: hex, border: selectedEl.fill === hex ? `2px solid ${t.primary}` : `1px solid ${t.border}`, cursor: 'pointer', flexShrink: 0 }} />
                      ))}
                      <input type="color" value={selectedEl.fill || '#ffffff'}
                        onChange={e => updateElement({ ...selectedEl, fill: e.target.value })}
                        onBlur={e => { pushHistory(); pickColor(e.target.value, () => {}); }}
                        style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1, flexShrink: 0 }} />
                    </div>
                    {/* Line height & letter spacing */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap', width: 70 }}>Line height</span>
                      <input type="range" min={0.8} max={3} step={0.05} value={selectedEl.lineHeight ?? 1.2}
                        onChange={e => updateElement({ ...selectedEl, lineHeight: parseFloat(e.target.value) })}
                        onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: t.primary }} />
                      <span style={{ fontSize: 11, color: t.textMuted, width: 28, textAlign: 'right' }}>{(selectedEl.lineHeight ?? 1.2).toFixed(1)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap', width: 70 }}>Spacing</span>
                      <input type="range" min={-5} max={30} step={0.5} value={selectedEl.letterSpacing ?? 0}
                        onChange={e => updateElement({ ...selectedEl, letterSpacing: parseFloat(e.target.value) })}
                        onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: t.primary }} />
                      <span style={{ fontSize: 11, color: t.textMuted, width: 28, textAlign: 'right' }}>{(selectedEl.letterSpacing ?? 0).toFixed(1)}</span>
                    </div>
                    {/* Opacity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap', width: 70 }}>Opacity</span>
                      <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity ?? 1}
                        onChange={e => updateElement({ ...selectedEl, opacity: parseFloat(e.target.value) })}
                        onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: t.primary }} />
                      <span style={{ fontSize: 11, color: t.textMuted, width: 28, textAlign: 'right' }}>{Math.round((selectedEl.opacity ?? 1) * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* UPLOADS */}
            {(activeLeftTool === 'images' || activeLeftTool === 'uploads') && (() => {
              const uploadTabItems = uploadItems.filter(item =>
                uploadMediaTab === 'Images' ? item.file_type === 'image' : item.file_type === 'video'
              );
              const visibleItems = uploadSearch
                ? uploadTabItems.filter(i => (i.file_name || '').toLowerCase().includes(uploadSearch.toLowerCase()))
                : uploadTabItems;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Upload button row */}
                  <div style={{ display: 'flex', gap: 7 }}>
                    <label style={{ flex: 1, background: `linear-gradient(135deg, ${t.primary}, ${t.primaryHover})`, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <input type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
                        onChange={async e => {
                          const files = Array.from(e.target.files);
                          if (!files.length) return;
                          setUploadProgress(0);
                          try {
                            const res = await mediaAPI.upload(files, 'all', p => setUploadProgress(p));
                            const newItems = res.data?.files || [];
                            setUploadItems(prev => [...newItems, ...prev]);
                            if (newItems[0]) addImageElement(newItems[0].url);
                            const quotaRes = await mediaAPI.getQuota();
                            setUploadQuota(quotaRes.data || null);
                          } catch {}
                          finally { setUploadProgress(null); }
                        }} />
                      <IpPublish size={15} color="#000" /> Upload files
                    </label>
                    <button title="More upload options"
                      style={{ width: 40, height: 40, border: 'none', borderRadius: 8, background: t.primary, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, letterSpacing: 1, fontWeight: 700 }}>
                      ···
                    </button>
                  </div>
                  {/* Record yourself ghost button */}
                  <button
                    onClick={() => { if (typeof window !== 'undefined' && navigator.mediaDevices) { alert('Camera recording coming soon!'); } }}
                    style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'border-color 150ms, color 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="10" strokeDasharray="4 3"/></svg>
                    Record yourself
                  </button>
                  {/* Upload progress bar */}
                  {uploadProgress !== null && (
                    <div style={{ fontSize: 11, color: t.textMuted }}>
                      <div style={{ height: 4, borderRadius: 2, background: t.border, marginBottom: 4 }}>
                        <div style={{ height: '100%', width: `${uploadProgress}%`, borderRadius: 2, background: t.primary, transition: 'width 100ms' }} />
                      </div>
                      Uploading… {uploadProgress}%
                    </div>
                  )}
                  {/* Quota bar */}
                  {uploadQuota && (
                    <div style={{ fontSize: 11, color: t.textMuted }}>
                      <div style={{ height: 3, borderRadius: 2, background: t.border, marginBottom: 4 }}>
                        <div style={{ height: '100%', width: `${Math.min(100, parseFloat(uploadQuota.percentUsed))}%`, borderRadius: 2, background: parseFloat(uploadQuota.percentUsed) > 85 ? '#f87171' : t.primary }} />
                      </div>
                      {uploadQuota.usedFormatted} of {uploadQuota.quotaFormatted} used
                    </div>
                  )}
                  {/* 3 tabs: Images | Videos | Stock */}
                  <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, gap: 0 }}>
                    {[
                      { label: 'Images', icon: <IpPhoto size={12} /> },
                      { label: 'Videos', icon: <IpVideo size={12} /> },
                      { label: 'Stock', icon: <IpSearch size={12} /> },
                    ].map(({ label, icon }) => (
                      <button key={label} onClick={() => setUploadMediaTab(label)}
                        style={{ flex: 1, paddingBottom: 9, paddingTop: 6, border: 'none', borderBottom: `2px solid ${uploadMediaTab === label ? t.primary : 'transparent'}`, background: 'transparent', color: uploadMediaTab === label ? t.primary : t.textMuted, fontSize: 12, fontWeight: uploadMediaTab === label ? 600 : 400, cursor: 'pointer', transition: 'all 150ms ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                  {/* Search — My media or Stock Photos */}
                  {uploadMediaTab === 'Stock' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 20, padding: '8px 12px' }}>
                      <IpSearch size={13} color={t.textMuted} />
                      <input
                        placeholder="Search stock photos…"
                        value={stockInputValue}
                        onChange={e => {
                          setStockInputValue(e.target.value);
                          clearTimeout(window._stockSearchTimer);
                          window._stockSearchTimer = setTimeout(() => setStockQuery(e.target.value.trim() || ''), 500);
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') { clearTimeout(window._stockSearchTimer); setStockQuery(stockInputValue.trim() || ''); } }}
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 20, padding: '8px 12px' }}>
                      <IpSearch size={13} color={t.textMuted} />
                      <input
                        placeholder={`Search ${uploadMediaTab.toLowerCase()}…`}
                        value={uploadSearch}
                        onChange={e => setUploadSearch(e.target.value)}
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                    </div>
                  )}
                  {/* Stock Photos Grid */}
                  {uploadMediaTab === 'Stock' ? (
                    stockLoading ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} style={{ borderRadius: 6, aspectRatio: '1', background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`, backgroundSize: '1000px 100%', animation: `shimmer 1.4s ${i * 0.1}s ease-in-out infinite` }} />
                        ))}
                      </div>
                    ) : pexelsPhotos.length === 0 ? (
                      <div style={{ textAlign: 'center', color: t.textMuted, padding: '30px 0', fontSize: 12 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>No results</div>
                        <div>Try a different search term</div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                          {pexelsPhotos.map(photo => (
                            <div key={photo.id}
                              draggable
                              onDragStart={e => e.dataTransfer.setData('text/plain', photo.url)}
                              onClick={() => addImageElement(photo.url)}
                              style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${t.border}`, position: 'relative', cursor: 'pointer', aspectRatio: '1', background: t.input }}>
                              <img src={photo.thumbUrl} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: t.textMuted, textAlign: 'center' }}>Photos from Pexels · Free to use</div>
                      </>
                    )
                  ) : null}
                  {/* My Media Grid */}
                  {uploadMediaTab !== 'Stock' && uploadLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} style={{ borderRadius: 6, aspectRatio: '1', background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`, backgroundSize: '1000px 100%', animation: `shimmer 1.4s ${i * 0.1}s ease-in-out infinite` }} />
                      ))}
                    </div>
                  ) : uploadMediaTab !== 'Stock' && visibleItems.length === 0 ? (
                    <div style={{ textAlign: 'center', color: t.textMuted, padding: '30px 0', fontSize: 12 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{uploadMediaTab === 'Images' ? '🖼️' : '🎬'}</div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>No {uploadMediaTab.toLowerCase()} yet</div>
                      <div>{uploadMediaTab === 'Images' ? 'Upload photos from your phone or computer' : 'Upload videos from your jobs — before/afters, time-lapses'}</div>
                    </div>
                  ) : uploadMediaTab !== 'Stock' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                      {visibleItems.map(item => (
                        <div key={item.id}
                          draggable
                          onDragStart={e => e.dataTransfer.setData('text/plain', item.url)}
                          onMouseEnter={() => setHoveredPhotoId(item.id)}
                          onMouseLeave={() => setHoveredPhotoId(null)}
                          style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${t.border}`, position: 'relative', cursor: 'grab', aspectRatio: '1', background: t.input }}>
                          {item.thumbnail_url || item.file_type === 'image' ? (
                            <img src={item.thumbnail_url || item.url} alt={item.file_name || ''} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <IpVideo size={24} color={t.textMuted} />
                            </div>
                          )}
                          {item.file_type === 'video' && (item.thumbnail_url) && (
                            <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.6)', borderRadius: 3, padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                              <IpVideo size={9} color="#fff" />
                            </div>
                          )}
                          {hoveredPhotoId === item.id && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4 }}>
                              <button onClick={() => selectBgPhoto(item)}
                                style={{ width: '100%', padding: '4px 0', fontSize: 9, fontWeight: 600, borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>
                                Set BG
                              </button>
                              <button onClick={() => addImageElement(item.url)}
                                style={{ width: '100%', padding: '4px 0', fontSize: 9, fontWeight: 600, borderRadius: 4, border: 'none', background: t.primary, color: '#fff', cursor: 'pointer' }}>
                                Add
                              </button>
                              <button onClick={async () => {
                                try {
                                  await mediaAPI.delete(item.id);
                                  setUploadItems(prev => prev.filter(i => i.id !== item.id));
                                } catch {}
                              }}
                                style={{ width: '100%', padding: '4px 0', fontSize: 9, fontWeight: 600, borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.85)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                                <IpDelete size={9} color="#fff" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {/* Add from URL */}
                  {!showImgUrlInput ? (
                    <button onClick={() => setShowImgUrlInput(true)}
                      style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px', color: t.textMuted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      + Add from URL
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        autoFocus
                        placeholder="Paste image URL (https://...)"
                        value={imgUrlValue}
                        onChange={e => setImgUrlValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && imgUrlValue.trim()) {
                            addImageElement(imgUrlValue.trim());
                            setImgUrlValue('');
                            setShowImgUrlInput(false);
                          }
                          if (e.key === 'Escape') { setShowImgUrlInput(false); setImgUrlValue(''); }
                        }}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.primary}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { if (imgUrlValue.trim()) { addImageElement(imgUrlValue.trim()); setImgUrlValue(''); setShowImgUrlInput(false); } }}
                          disabled={!imgUrlValue.trim()}
                          style={{ flex: 1, background: imgUrlValue.trim() ? t.primary : t.border, color: imgUrlValue.trim() ? '#fff' : t.textMuted, border: 'none', borderRadius: 8, padding: '9px', fontWeight: 600, fontSize: 13, cursor: imgUrlValue.trim() ? 'pointer' : 'default' }}>
                          Add
                        </button>
                        <button onClick={() => { setShowImgUrlInput(false); setImgUrlValue(''); }}
                          style={{ flex: 1, background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px', color: t.text, fontSize: 13, cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── BG Remover Promo Card ── */}
                  {!bgRemoverDismissed && uploadMediaTab === 'Images' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.card, marginTop: 4, flexShrink: 0 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', background: 'linear-gradient(180deg, #f97316 0%, #7c3aed 100%)' }} />
                        <div style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', backgroundImage: 'linear-gradient(45deg,#c8c8c8 25%,transparent 25%),linear-gradient(-45deg,#c8c8c8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#c8c8c8 75%),linear-gradient(-45deg,transparent 75%,#c8c8c8 75%)', backgroundSize: '7px 7px', backgroundPosition: '0 0,0 3.5px,3.5px -3.5px,-3.5px 0', backgroundColor: '#f0f0f0' }} />
                        <div style={{ position: 'absolute', left: '50%', top: 5, bottom: 5, borderLeft: '1.5px dashed rgba(255,255,255,0.85)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 10 }}>👑</span> Background Remover
                        </div>
                        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>Remove the background of your image</div>
                      </div>
                      <button onClick={() => setBgRemoverDismissed(true)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}>×</button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ELEMENTS */}
            {(activeLeftTool === 'shapes' || activeLeftTool === 'elements') && (() => {
              const cats = [
                { id:'shapes', label:'Shapes', grad:'linear-gradient(135deg,#00C4CC,#0099A3)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><rect x="6" y="8" width="22" height="22" rx="2" fill="#fff" opacity=".8"/><circle cx="49" cy="19" r="11" fill="#fff" opacity=".7"/><polygon points="20,46 36,30 52,46" fill="#fff" opacity=".9"/></svg>,
                  sections:[
                    { label:'Lines', items:[
                      { label:'Line',     fn:()=>addLine(),               svg:<line x1="12" y1="27" x2="52" y2="27" stroke="#fff" strokeWidth="3" strokeLinecap="round"/> },
                      { label:'Dashed',   fn:()=>addLine({dash:[14,8]}),  svg:<line x1="12" y1="27" x2="52" y2="27" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 6"/> },
                      { label:'Dotted',   fn:()=>addLine({dash:[4,6]}),   svg:<line x1="12" y1="27" x2="52" y2="27" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 5"/> },
                      { label:'Arrow →',  fn:()=>addArrow(),              svg:<><line x1="8" y1="27" x2="42" y2="27" stroke="#fff" strokeWidth="3"/><polygon points="38,20 52,27 38,34" fill="#fff"/></> },
                      { label:'Thick',    fn:()=>addLine({strokeWidth:8}),svg:<line x1="12" y1="27" x2="52" y2="27" stroke="#fff" strokeWidth="8" strokeLinecap="round"/> },
                      { label:'Divider',  fn:()=>addDivider(),            svg:<><line x1="8" y1="27" x2="56" y2="27" stroke="#fff" strokeWidth="2"/><circle cx="32" cy="27" r="5" fill="#fff"/></> },
                    ]},
                    { label:'Basic shapes', items:[
                      { label:'Rect',     fn:()=>addRect(),                            svg:<rect x="12" y="18" width="40" height="24" rx="2" fill="#fff" opacity=".85"/> },
                      { label:'Rounded',  fn:()=>addRect({cornerRadius:20}),          svg:<rect x="12" y="18" width="40" height="24" rx="12" fill="#fff" opacity=".85"/> },
                      { label:'Circle',   fn:()=>addCircle(),                          svg:<circle cx="32" cy="27" r="18" fill="#fff" opacity=".85"/> },
                      { label:'Triangle', fn:()=>addTriangle(),                        svg:<polygon points="32,10 52,44 12,44" fill="#fff" opacity=".85"/> },
                      { label:'Diamond',  fn:()=>addTriangle({sides:4,rotation:45}),  svg:<polygon points="32,10 50,27 32,44 14,27" fill="#fff" opacity=".85"/> },
                    ]},
                    { label:'Polygons', items:[
                      { label:'Pentagon',  fn:()=>addSmartShape('pentagon'),  svg:<polygon points="32,10 52,26 44,46 20,46 12,26" fill="#fff" opacity=".85"/> },
                      { label:'Hexagon',   fn:()=>addSmartShape('hexagon'),   svg:<polygon points="32,10 48,19 48,37 32,46 16,37 16,19" fill="#fff" opacity=".85"/> },
                      { label:'Octagon',   fn:()=>addSmartShape('octagon'),   svg:<polygon points="22,10 42,10 52,22 52,38 42,48 22,48 12,38 12,22" fill="#fff" opacity=".85"/> },
                      { label:'Cross',     fn:()=>addSmartShape('cross'),     svg:<path d="M26 10h12v16h16v12H38v16H26V38H10V26h16Z" fill="#fff" opacity=".85"/> },
                    ]},
                    { label:'Stars', items:[
                      { label:'Star',   fn:()=>addStar(),              svg:<polygon points="32,10 36,23 50,23 39,31 43,44 32,36 21,44 25,31 14,23 28,23" fill="#fff" opacity=".85"/> },
                      { label:'Heart',  fn:()=>addSmartShape('heart'), svg:<path d="M32 42C32 42 12 30 12 18a10 10 0 0 1 20-2 10 10 0 0 1 20 2c0 12-20 24-20 24Z" fill="#fff" opacity=".85"/> },
                      { label:'Cloud',  fn:()=>addSmartShape('cloud'), svg:<path d="M20 38Q12 38 12 30Q12 22 20 22Q22 14 30 14Q38 14 40 22Q48 22 48 30Q48 38 40 38Z" fill="#fff" opacity=".85"/> },
                      { label:'Banner', fn:()=>addSmartShape('banner'),svg:<path d="M10 18h44v22l-22-6-22 6Z" fill="#fff" opacity=".85"/> },
                    ]},
                    { label:'Arrows', items:[
                      { label:'Right →',   fn:()=>addArrow(),                           svg:<><line x1="8" y1="27" x2="42" y2="27" stroke="#fff" strokeWidth="3"/><polygon points="38,20 52,27 38,34" fill="#fff"/></> },
                      { label:'← → Both', fn:()=>addArrow(),                           svg:<><polygon points="17,20 6,27 17,34" fill="#fff"/><line x1="8" y1="27" x2="56" y2="27" stroke="#fff" strokeWidth="3"/><polygon points="47,20 58,27 47,34" fill="#fff"/></> },
                      { label:'Speech →',  fn:()=>addSmartShape('speechbubble_right'), svg:<><rect x="8" y="12" width="36" height="24" rx="6" fill="#fff" opacity=".85"/><polygon points="20,36 14,46 28,36" fill="#fff" opacity=".85"/></> },
                    ]},
                  ],
                },
                { id:'lines', label:'Lines', grad:'linear-gradient(135deg,#7C5CFC,#5B3FE0)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><line x1="10" y1="18" x2="54" y2="18" stroke="#fff" strokeWidth="2.5" opacity=".8"/><line x1="10" y1="30" x2="54" y2="30" stroke="#fff" strokeWidth="2.5" strokeDasharray="7 5" opacity=".8"/><line x1="10" y1="44" x2="48" y2="44" stroke="#fff" strokeWidth="2" opacity=".8"/><polygon points="48,38 56,44 48,50" fill="#fff" opacity=".9"/></svg>,
                  items:[
                    { label:'Line',       fn:()=>addLine(),                               svg:<line x1="10" y1="28" x2="54" y2="28" stroke="#fff" strokeWidth="3" opacity=".9"/> },
                    { label:'Dashed',     fn:()=>addLine({dash:[14,8]}),                  svg:<line x1="10" y1="28" x2="54" y2="28" stroke="#fff" strokeWidth="3" strokeDasharray="10 7" opacity=".9"/> },
                    { label:'Arrow →',    fn:()=>addArrow(),                              svg:<><line x1="8" y1="28" x2="46" y2="28" stroke="#fff" strokeWidth="3" opacity=".9"/><polygon points="46,22 56,28 46,34" fill="#fff" opacity=".9"/></> },
                    { label:'Diagonal',   fn:()=>addLine({points:[0,0,300,300]}),         svg:<line x1="12" y1="44" x2="52" y2="12" stroke="#fff" strokeWidth="3" opacity=".9"/> },
                    { label:'Divider',    fn:()=>addDivider(),                            svg:<><line x1="8" y1="24" x2="56" y2="24" stroke="#fff" strokeWidth="1.5" opacity=".5"/><circle cx="32" cy="28" r="4" fill="#fff" opacity=".9"/><line x1="8" y1="32" x2="56" y2="32" stroke="#fff" strokeWidth="1.5" opacity=".5"/></> },
                    { label:'← → Arrow', fn:()=>addArrow(),                              svg:<><polygon points="14,22 4,28 14,34" fill="#fff" opacity=".9"/><line x1="4" y1="28" x2="60" y2="28" stroke="#fff" strokeWidth="2.5" opacity=".9"/><polygon points="50,22 60,28 50,34" fill="#fff" opacity=".9"/></> },
                    { label:'Dotted',     fn:()=>addLine({dash:[4,6]}),                  svg:<line x1="10" y1="28" x2="54" y2="28" stroke="#fff" strokeWidth="3" strokeDasharray="4 6" opacity=".9"/> },
                    { label:'Thick',      fn:()=>addLine({strokeWidth:8}),               svg:<line x1="10" y1="28" x2="54" y2="28" stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity=".9"/> },
                    { label:'Double',     fn:()=>{ addLine(); addLine({points:[0,0,300,0]}); }, svg:<><line x1="10" y1="22" x2="54" y2="22" stroke="#fff" strokeWidth="2.5" opacity=".9"/><line x1="10" y1="34" x2="54" y2="34" stroke="#fff" strokeWidth="2.5" opacity=".9"/></> },
                  ],
                },
                { id:'frames', label:'Frames', grad:'linear-gradient(135deg,#f59e0b,#d97706)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><rect x="10" y="8" width="44" height="40" rx="2" fill="none" stroke="#fff" strokeWidth="3" opacity=".9"/><rect x="16" y="14" width="32" height="28" rx="1" fill="#fff" opacity=".2"/></svg>,
                  sections:[
                    { label:'Basic shapes', items:[
                      { label:'Sq Frame',     fn:()=>addRect({fill:'transparent',stroke:'#ffffff',strokeWidth:4,width:200,height:200}), svg:<rect x="10" y="10" width="44" height="34" fill="none" stroke="#fff" strokeWidth="3"/> },
                      { label:'Circle Frame', fn:()=>addCircle({fill:'transparent',stroke:'#ffffff',strokeWidth:4}),                    svg:<circle cx="32" cy="27" r="18" fill="none" stroke="#fff" strokeWidth="3"/> },
                      { label:'Polaroid',     fn:()=>addPolaroid(),   svg:<><rect x="10" y="10" width="44" height="40" rx="2" fill="#fff" opacity=".85"/><rect x="10" y="40" width="44" height="10" fill="rgba(255,255,255,0.5)"/></> },
                      { label:'Circle Crop',  fn:()=>addCircle({fill:'rgba(255,255,255,0.12)',stroke:'#ffffff',strokeWidth:3,radius:100}), svg:<circle cx="32" cy="27" r="18" fill="rgba(255,255,255,0.18)" stroke="#fff" strokeWidth="3"/> },
                    ]},
                    { label:'Film and photo', items:[
                      { label:'Film Strip',   fn:()=>addRect({width:300,height:160}), svg:<><rect x="6" y="16" width="52" height="24" rx="2" fill="none" stroke="#fff" strokeWidth="2"/>{[8,15,22,29,36,43].map(x=><><rect key={x+'t'} x={x} y="10" width="5" height="5" rx="1" fill="#fff" opacity=".6"/><rect key={x+'b'} x={x} y="41" width="5" height="5" rx="1" fill="#fff" opacity=".6"/></>)}</> },
                      { label:'Before/After', fn:()=>addBeforeAfter(), svg:<><rect x="8" y="14" width="48" height="28" rx="3" fill="none" stroke="#fff" strokeWidth="2"/><line x1="32" y1="14" x2="32" y2="42" stroke="#fff" strokeWidth="2" strokeDasharray="3 2"/></> },
                    ]},
                    { label:'Devices', items:[
                      { label:'Phone',   fn:()=>addRect({width:140,height:260,cornerRadius:22}), svg:<><rect x="18" y="8" width="28" height="42" rx="6" fill="none" stroke="#fff" strokeWidth="2.5"/><circle cx="32" cy="46" r="2.5" fill="#fff" opacity=".7"/><line x1="27" y1="11" x2="37" y2="11" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></> },
                      { label:'Monitor', fn:()=>addRect({width:280,height:180}),                 svg:<><rect x="10" y="12" width="44" height="28" rx="3" fill="none" stroke="#fff" strokeWidth="2"/><line x1="32" y1="40" x2="32" y2="48" stroke="#fff" strokeWidth="2"/><line x1="22" y1="48" x2="42" y2="48" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></> },
                      { label:'Tablet',  fn:()=>addRect({width:180,height:240}),                 svg:<><rect x="14" y="8" width="36" height="42" rx="4" fill="none" stroke="#fff" strokeWidth="2"/><circle cx="32" cy="46" r="2" fill="#fff" opacity=".7"/></> },
                    ]},
                    { label:'Paper', items:[
                      { label:'Map Pin', fn:()=>addMapPin(),  svg:<><path d="M32 10a14 14 0 0 1 14 14c0 10-14 24-14 24S18 34 18 24a14 14 0 0 1 14-14Z" fill="none" stroke="#fff" strokeWidth="2.5"/><circle cx="32" cy="24" r="5" fill="#fff" opacity=".85"/></> },
                      { label:'QR Code', fn:()=>addQrCode(), svg:<><rect x="8" y="8" width="20" height="20" rx="2" fill="none" stroke="#fff" strokeWidth="2"/><rect x="36" y="8" width="20" height="20" rx="2" fill="none" stroke="#fff" strokeWidth="2"/><rect x="8" y="36" width="20" height="20" rx="2" fill="none" stroke="#fff" strokeWidth="2"/><rect x="12" y="12" width="10" height="10" fill="#fff" opacity=".85"/><rect x="40" y="12" width="10" height="10" fill="#fff" opacity=".85"/><rect x="12" y="40" width="10" height="10" fill="#fff" opacity=".85"/><rect x="38" y="38" width="14" height="6" fill="#fff" opacity=".5"/></> },
                    ]},
                  ],
                },
                { id:'charts', label:'Charts', grad:'linear-gradient(135deg,#ef4444,#dc2626)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><rect x="8" y="36" width="10" height="12" rx="1" fill="#fff" opacity=".6"/><rect x="22" y="26" width="10" height="22" rx="1" fill="#fff" opacity=".7"/><rect x="36" y="16" width="10" height="32" rx="1" fill="#fff" opacity=".8"/><rect x="50" y="30" width="10" height="18" rx="1" fill="#fff" opacity=".65"/></svg>,
                  startWithData: true,
                  sections:[
                    { label:'Bar charts', items:[
                      { label:'Bar',     fn:()=>addChart('bar'), svg:<><rect x="12" y="38" width="10" height="12" fill="#fff" opacity=".9"/><rect x="26" y="28" width="10" height="22" fill="#fff" opacity=".7"/><rect x="40" y="18" width="10" height="32" fill="#fff" opacity=".85"/></> },
                      { label:'Row',     fn:()=>addChart('bar'), svg:<><rect x="12" y="14" width="14" height="8" fill="#fff" opacity=".9"/><rect x="12" y="25" width="26" height="8" fill="#fff" opacity=".7"/><rect x="12" y="36" width="38" height="8" fill="#fff" opacity=".85"/></> },
                      { label:'Grouped', fn:()=>addChart('bar'), svg:<><rect x="10" y="32" width="8" height="18" fill="#fff" opacity=".9"/><rect x="20" y="24" width="8" height="26" fill="#fff" opacity=".6"/><rect x="34" y="28" width="8" height="22" fill="#fff" opacity=".9"/><rect x="44" y="18" width="8" height="32" fill="#fff" opacity=".6"/></> },
                    ]},
                    { label:'Line charts', items:[
                      { label:'Line',       fn:()=>addChart('bar'), svg:<><polyline points="10,40 22,28 34,32 46,16 56,20" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><circle cx="22" cy="28" r="3" fill="#fff"/><circle cx="34" cy="32" r="3" fill="#fff"/><circle cx="46" cy="16" r="3" fill="#fff"/></> },
                      { label:'Multi-line', fn:()=>addChart('bar'), svg:<><polyline points="10,38 22,28 34,30 46,18" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><polyline points="10,44 22,36 34,40 46,30" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round"/></> },
                    ]},
                    { label:'Pie and donut charts', items:[
                      { label:'Pie',      fn:()=>addChart('pie'),  svg:<><circle cx="32" cy="27" r="18" fill="none" stroke="#fff" strokeWidth="18" strokeDasharray="70 30" opacity=".9"/><circle cx="32" cy="27" r="18" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="18" strokeDasharray="30 70" strokeDashoffset="-70"/></> },
                      { label:'Donut',    fn:()=>addChart('pie'),  svg:<><circle cx="32" cy="27" r="16" fill="none" stroke="#fff" strokeWidth="8" strokeDasharray="65 35" opacity=".9"/><circle cx="32" cy="27" r="16" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="8" strokeDasharray="35 65" strokeDashoffset="-65"/></> },
                      { label:'Progress', fn:()=>addProgressBar(), svg:<><rect x="10" y="22" width="44" height="10" rx="5" fill="rgba(255,255,255,0.25)"/><rect x="10" y="22" width="28" height="10" rx="5" fill="#fff" opacity=".9"/></> },
                    ]},
                  ],
                },
                { id:'typography', label:'Typography', grad:'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><text x="32" y="24" fill="#fff" fontSize="18" textAnchor="middle" fontWeight="bold" opacity=".9">Aa</text><line x1="10" y1="34" x2="54" y2="34" stroke="#fff" strokeWidth="1" opacity=".4"/><line x1="14" y1="44" x2="50" y2="44" stroke="#fff" strokeWidth="1" opacity=".3"/></svg>,
                  items:[
                    { label:'Quote',      fn:()=>addQuote(),                              svg:<><text x="10" y="36" fill="#fff" fontSize="32" opacity=".9" fontFamily="Georgia">"</text><text x="42" y="50" fill="#fff" fontSize="32" opacity=".9" fontFamily="Georgia">"</text></> },
                    { label:'Callout',    fn:()=>addCallout(),                            svg:<><rect x="6" y="12" width="52" height="32" rx="6" fill="rgba(255,255,255,0.2)"/><rect x="6" y="12" width="5" height="32" rx="3" fill="#fff" opacity=".9"/><line x1="18" y1="22" x2="52" y2="22" stroke="#fff" strokeWidth="2" opacity=".6"/><line x1="18" y1="30" x2="46" y2="30" stroke="#fff" strokeWidth="1.5" opacity=".4"/></> },
                    { label:'Gradient',   fn:()=>addGradientText(),                       svg:<><defs><linearGradient id="eg1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#00C4CC"/><stop offset="100%" stopColor="#7C5CFC"/></linearGradient></defs><text x="32" y="36" fill="url(#eg1)" fontSize="22" textAnchor="middle" fontWeight="bold">Aa</text></> },
                    { label:'Neon',       fn:()=>addNeonText(),                           svg:<><text x="32" y="34" fill="rgba(0,196,204,0.3)" fontSize="16" textAnchor="middle" fontWeight="bold">NEON</text><text x="32" y="34" fill="#00C4CC" fontSize="16" textAnchor="middle" fontWeight="bold" opacity=".95">NEON</text></> },
                    { label:'Highlight',  fn:()=>addHighlight(),                          svg:<><rect x="8" y="20" width="48" height="20" rx="2" fill="#FFE135" opacity=".55"/><text x="32" y="34" fill="#fff" fontSize="11" textAnchor="middle" fontWeight="bold" opacity=".9">Highlight</text></> },
                    { label:'Speech',     fn:()=>addSpeechBubble(),                       svg:<><rect x="8" y="8" width="48" height="30" rx="8" fill="#fff" opacity=".85"/><polygon points="18,38 10,50 32,38" fill="#fff" opacity=".85"/></> },
                    { label:'Ribbon',     fn:()=>addRibbon(),                             svg:<><rect x="2" y="18" width="60" height="20" fill="#fff" opacity=".85"/><polygon points="2,18 -2,28 2,38" fill="rgba(255,255,255,0.5)"/><polygon points="62,18 66,28 62,38" fill="rgba(255,255,255,0.5)"/></> },
                    { label:'Badge',      fn:()=>addBadge('sale'),                        svg:<><circle cx="32" cy="28" r="20" fill="#fff" opacity=".85"/><text x="32" y="33" fill="#3b82f6" fontSize="10" textAnchor="middle" fontWeight="bold">SALE</text></> },
                  ],
                },
                { id:'marketing', label:'Marketing', grad:'linear-gradient(135deg,#22c55e,#16a34a)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><rect x="8" y="12" width="48" height="32" rx="4" fill="rgba(255,255,255,0.2)" stroke="#fff" strokeWidth="1.5" strokeDasharray="5 3"/><text x="32" y="31" fill="#fff" fontSize="10" textAnchor="middle" fontWeight="bold" opacity=".9">SALE</text></svg>,
                  items:[
                    { label:'Coupon',     fn:()=>addCoupon(),                             svg:<><rect x="6" y="14" width="52" height="28" rx="4" fill="rgba(255,255,255,0.2)" stroke="#fff" strokeWidth="1.5" strokeDasharray="5 3"/><line x1="28" y1="14" x2="28" y2="42" stroke="#fff" strokeWidth="1" strokeDasharray="3 2" opacity=".5"/><text x="17" y="31" fill="#fff" fontSize="8" textAnchor="middle" opacity=".9">20% OFF</text></> },
                    { label:'Review',     fn:()=>addTestimonial(),                        svg:<><rect x="8" y="8" width="48" height="38" rx="6" fill="rgba(255,255,255,0.2)"/><text x="12" y="24" fill="#FFB800" fontSize="10" opacity=".9">★★★★★</text><line x1="12" y1="30" x2="52" y2="30" stroke="#fff" strokeWidth="1" opacity=".4"/><line x1="12" y1="36" x2="44" y2="36" stroke="#fff" strokeWidth="1" opacity=".3"/></> },
                    { label:'Price Tag',  fn:()=>addPriceTag(),                           svg:<><rect x="14" y="6" width="36" height="46" rx="6" fill="rgba(255,255,255,0.2)"/><text x="32" y="30" fill="#fff" fontSize="14" textAnchor="middle" fontWeight="bold" opacity=".9">$29</text><line x1="18" y1="36" x2="46" y2="36" stroke="#fff" strokeWidth="1" opacity=".5"/></> },
                    { label:'Compare',    fn:()=>addComparison(),                         svg:<><rect x="6" y="8" width="52" height="40" rx="4" fill="rgba(255,255,255,0.1)"/><line x1="32" y1="8" x2="32" y2="48" stroke="#fff" strokeWidth="1.5" opacity=".5"/><text x="19" y="32" fill="#fca5a5" fontSize="7" textAnchor="middle" opacity=".9">✗ Old</text><text x="45" y="32" fill="#86efac" fontSize="7" textAnchor="middle" opacity=".9">✓ Us</text></> },
                    { label:'Stat Block', fn:()=>addSocialStats(),                        svg:<><rect x="4" y="16" width="56" height="24" rx="6" fill="rgba(255,255,255,0.2)"/><text x="16" y="32" fill="#fff" fontSize="6.5" textAnchor="middle" opacity=".9">👥 2.4K</text><text x="32" y="32" fill="#fff" fontSize="6.5" textAnchor="middle" opacity=".9">❤ 18K</text><text x="48" y="32" fill="#fff" fontSize="6.5" textAnchor="middle" opacity=".9">📸 342</text></> },
                    { label:'Watermark',  fn:()=>addWatermark(),                          svg:<><rect x="12" y="18" width="40" height="20" rx="10" fill="rgba(255,255,255,0.3)"/><text x="32" y="31" fill="#fff" fontSize="8" textAnchor="middle" opacity=".9">YourBrand</text></> },
                    { label:'🔥 Sticker', fn:()=>addSticker('🔥'),                       svg:<text x="32" y="40" fontSize="28" textAnchor="middle">🔥</text> },
                    { label:'⭐ Sticker', fn:()=>addSticker('⭐'),                       svg:<text x="32" y="40" fontSize="28" textAnchor="middle">⭐</text> },
                  ],
                },
                { id:'decoration', label:'Decoration', grad:'linear-gradient(135deg,#8b5cf6,#6d28d9)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><circle cx="16" cy="20" r="3" fill="#fff" opacity=".5"/><circle cx="32" cy="20" r="3" fill="#fff" opacity=".5"/><circle cx="48" cy="20" r="3" fill="#fff" opacity=".5"/><circle cx="16" cy="36" r="3" fill="#fff" opacity=".5"/><circle cx="32" cy="36" r="3" fill="#fff" opacity=".5"/><circle cx="48" cy="36" r="3" fill="#fff" opacity=".5"/></svg>,
                  items:[
                    { label:'Dots',       fn:()=>addPattern(),                            svg:<><circle cx="16" cy="16" r="3" fill="#fff" opacity=".7"/><circle cx="32" cy="16" r="3" fill="#fff" opacity=".7"/><circle cx="48" cy="16" r="3" fill="#fff" opacity=".7"/><circle cx="16" cy="28" r="3" fill="#fff" opacity=".7"/><circle cx="32" cy="28" r="3" fill="#fff" opacity=".7"/><circle cx="48" cy="28" r="3" fill="#fff" opacity=".7"/><circle cx="16" cy="40" r="3" fill="#fff" opacity=".7"/><circle cx="32" cy="40" r="3" fill="#fff" opacity=".7"/><circle cx="48" cy="40" r="3" fill="#fff" opacity=".7"/></> },
                    { label:'Grid Lines', fn:()=>addPattern({patternType:'grid'}),        svg:<><line x1="10" y1="20" x2="54" y2="20" stroke="#fff" strokeWidth="1.5" opacity=".6"/><line x1="10" y1="36" x2="54" y2="36" stroke="#fff" strokeWidth="1.5" opacity=".6"/><line x1="20" y1="8" x2="20" y2="48" stroke="#fff" strokeWidth="1.5" opacity=".6"/><line x1="36" y1="8" x2="36" y2="48" stroke="#fff" strokeWidth="1.5" opacity=".6"/><line x1="52" y1="8" x2="52" y2="48" stroke="#fff" strokeWidth="1.5" opacity=".6"/></> },
                    { label:'Glass',      fn:()=>addGlassPane(),                          svg:<><rect x="8" y="12" width="48" height="34" rx="8" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/><rect x="8" y="12" width="48" height="9" rx="8" fill="rgba(255,255,255,0.2)"/></> },
                    { label:'Grad Rect',  fn:()=>addGradRect(),                           svg:<><defs><linearGradient id="dg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#7C5CFC" stopOpacity=".9"/><stop offset="100%" stopColor="#00C4CC" stopOpacity=".9"/></linearGradient></defs><rect x="8" y="10" width="48" height="36" rx="4" fill="url(#dg1)"/></> },
                    { label:'Step List',  fn:()=>addStepList(),                           svg:<><circle cx="14" cy="20" r="6" fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth="1.5"/><text x="14" y="24" fill="#fff" fontSize="8" textAnchor="middle">1</text><circle cx="14" cy="36" r="6" fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth="1.5"/><text x="14" y="40" fill="#fff" fontSize="8" textAnchor="middle">2</text><line x1="20" y1="20" x2="54" y2="20" stroke="#fff" strokeWidth="1.5" opacity=".5"/><line x1="20" y1="36" x2="54" y2="36" stroke="#fff" strokeWidth="1.5" opacity=".5"/></> },
                    { label:'Icon Shape', fn:()=>addIconShape(),                          svg:<><circle cx="32" cy="28" r="18" fill="rgba(255,255,255,0.2)"/><text x="32" y="34" fill="#fff" fontSize="16" textAnchor="middle" opacity=".9">✓</text></> },
                    { label:'Confetti',   fn:()=>addSticker('🎉'),                       svg:<><rect x="14" y="16" width="5" height="10" rx="2" fill="#fff" opacity=".8" transform="rotate(-20 16 21)"/><rect x="28" y="10" width="5" height="8" rx="2" fill="#fff" opacity=".7" transform="rotate(15 30 14)"/><rect x="42" y="18" width="5" height="10" rx="2" fill="#fff" opacity=".8" transform="rotate(-30 44 23)"/><circle cx="20" cy="36" r="4" fill="#fff" opacity=".6"/><circle cx="38" cy="32" r="3" fill="#fff" opacity=".7"/><circle cx="48" cy="40" r="3" fill="#fff" opacity=".6"/></> },
                    { label:'Sparkle',    fn:()=>addSticker('✨'),                       svg:<><polygon points="32,8 33.5,22 46,22 35.5,30 39,44 32,35 25,44 28.5,30 18,22 30.5,22" fill="#fff" opacity=".9"/><circle cx="14" cy="14" r="3" fill="#fff" opacity=".6"/><circle cx="50" cy="14" r="3" fill="#fff" opacity=".6"/></> },
                    { label:'Rainbow',    fn:()=>addGradRect(),                          svg:<><defs><linearGradient id="rbg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f59e0b"/><stop offset="33%" stopColor="#22c55e"/><stop offset="66%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#a855f7"/></linearGradient></defs><rect x="8" y="20" width="48" height="16" rx="8" fill="url(#rbg)" opacity=".9"/></> },
                  ],
                },
                { id:'graphics', label:'Graphics', grad:'linear-gradient(135deg,#f97316,#ea580c)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><circle cx="16" cy="17" r="11" fill="rgba(255,255,255,0.25)"/><polyline points="11,17 14,21 21,12" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="40" cy="17" r="11" fill="rgba(255,255,255,0.25)"/><path d="M40 7 C44 12 47 15 47 19 C47 23.4 43.9 26 40 26 C36.1 26 33 23.4 33 19 C33 15 36 12 40 7Z" fill="#fff" opacity=".85"/><circle cx="16" cy="39" r="11" fill="rgba(255,255,255,0.25)"/><path d="M12 33 L16 29 L20 33 L20 45 L12 45Z" fill="#fff" opacity=".8"/><circle cx="40" cy="39" r="11" fill="rgba(255,255,255,0.25)"/><line x1="34" y1="39" x2="46" y2="39" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><polyline points="40,33 46,39 40,45" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                  sections:[
                    { label:'Magic recommendations', items:[
                      { label:'Phone',    fn:()=>addIconShape({iconKind:'phone'}),    svg:<path d="M20 10h24v34H20zm4 30h16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/> },
                      { label:'Heart',    fn:()=>addIconShape({iconKind:'heart'}),    svg:<path d="M32 42C32 42 12 30 12 18a10 10 0 0 1 20-2 10 10 0 0 1 20 2c0 12-20 24-20 24Z" fill="#fff" opacity=".85"/> },
                      { label:'Camera',   fn:()=>addIconShape({iconKind:'camera'}),   svg:<><rect x="10" y="18" width="44" height="28" rx="4" fill="none" stroke="#fff" strokeWidth="2.5"/><circle cx="32" cy="32" r="8" fill="none" stroke="#fff" strokeWidth="2"/><path d="M22 18l4-6h12l4 6" stroke="#fff" strokeWidth="2" fill="none"/></> },
                      { label:'Mail',     fn:()=>addIconShape({iconKind:'mail'}),     svg:<><rect x="8" y="16" width="48" height="30" rx="4" fill="none" stroke="#fff" strokeWidth="2.5"/><path d="M8 16l24 18 24-18" stroke="#fff" strokeWidth="2.5" fill="none"/></> },
                      { label:'Location', fn:()=>addIconShape({iconKind:'location'}), svg:<><path d="M32 10a14 14 0 0 1 14 14c0 10-14 24-14 24S18 34 18 24a14 14 0 0 1 14-14Z" fill="none" stroke="#fff" strokeWidth="2.5"/><circle cx="32" cy="24" r="4" fill="#fff" opacity=".85"/></> },
                      { label:'Star',     fn:()=>addIconShape({iconKind:'star'}),     svg:<polygon points="32,10 36,23 50,23 39,31 43,44 32,36 21,44 25,31 14,23 28,23" fill="#fff" opacity=".85"/> },
                    ]},
                    { label:'Featured', items:[
                      { label:'Shield',  fn:()=>addIconShape({iconKind:'shield'}),  svg:<path d="M32 10L14 18v10c0 11 8 20 18 24 10-4 18-13 18-24V18Z" fill="none" stroke="#fff" strokeWidth="2.5"/> },
                      { label:'Trophy',  fn:()=>addIconShape({iconKind:'trophy'}),  svg:<><path d="M20 10h24v16a12 12 0 0 1-24 0V10Z" fill="none" stroke="#fff" strokeWidth="2.5"/><path d="M20 18H10m34 0h10M32 36v8M24 44h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></> },
                      { label:'Check',   fn:()=>addIconShape({iconKind:'check'}),   svg:<><circle cx="32" cy="27" r="18" fill="none" stroke="#fff" strokeWidth="2.5"/><path d="M22 27l8 8 12-14" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"/></> },
                      { label:'Info',    fn:()=>addIconShape({iconKind:'info'}),    svg:<><circle cx="32" cy="27" r="18" fill="none" stroke="#fff" strokeWidth="2.5"/><circle cx="32" cy="20" r="2" fill="#fff"/><line x1="32" y1="26" x2="32" y2="37" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></> },
                      { label:'Warning', fn:()=>addIconShape({iconKind:'warning'}), svg:<><polygon points="32,10 52,44 12,44" fill="none" stroke="#fff" strokeWidth="2.5"/><circle cx="32" cy="39" r="2" fill="#fff"/><line x1="32" y1="22" x2="32" y2="34" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></> },
                      { label:'Bolt',    fn:()=>addIconShape({iconKind:'bolt'}),    svg:<polygon points="36,8 20,30 32,30 28,48 44,24 32,24" fill="#fff" opacity=".85"/> },
                    ]},
                    { label:'Icons', items:[
                      { label:'House',    fn:()=>addIconShape({iconKind:'house'}),    svg:<><path d="M12 30L32 12l20 18" fill="none" stroke="#fff" strokeWidth="2.5"/><rect x="20" y="30" width="24" height="18" fill="none" stroke="#fff" strokeWidth="2.5"/></> },
                      { label:'Wrench',   fn:()=>addIconShape({iconKind:'wrench'}),   svg:<path d="M40 12a10 10 0 0 0-12 14L14 40a4 4 0 0 0 6 6l14-14A10 10 0 0 0 40 12Z" fill="none" stroke="#fff" strokeWidth="2.5"/> },
                      { label:'Leaf',     fn:()=>addIconShape({iconKind:'leaf'}),     svg:<path d="M16 42C16 26 28 12 48 10 48 30 36 44 16 42Z" fill="#fff" opacity=".85"/> },
                      { label:'Clock',    fn:()=>addIconShape({iconKind:'clock'}),    svg:<><circle cx="32" cy="27" r="18" fill="none" stroke="#fff" strokeWidth="2.5"/><path d="M32 17v10l7 7" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></> },
                      { label:'Dollar',   fn:()=>addIconShape({iconKind:'dollar'}),   svg:<><circle cx="32" cy="27" r="18" fill="none" stroke="#fff" strokeWidth="2.5"/><path d="M32 14v26M26 20h9a5 5 0 0 1 0 10h-9m0 0h9a5 5 0 0 1 0 10h-9" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></> },
                      { label:'Calendar', fn:()=>addIconShape({iconKind:'calendar'}), svg:<><rect x="10" y="14" width="44" height="34" rx="4" fill="none" stroke="#fff" strokeWidth="2.5"/><path d="M10 24h44M22 10v8M42 10v8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></> },
                    ]},
                  ],
                  // keep flat items for search compatibility
                  get items() { return this.sections.flatMap(s => s.items); },
                },
                { id:'backgrounds', label:'Backgrounds', grad:'linear-gradient(135deg,#1a1a2e,#16213e)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><rect x="6" y="6" width="52" height="42" rx="6" fill="#1a1a2e"/><rect x="10" y="10" width="20" height="14" rx="2" fill="rgba(255,255,255,0.2)"/><rect x="34" y="10" width="20" height="14" rx="2" fill="#7C5CFC" opacity=".6"/><rect x="10" y="28" width="44" height="14" rx="2" fill="rgba(124,92,252,0.3)"/></svg>,
                  items:[
                    { label:'Black',      fn:()=>addBackground('#000000'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#000" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/> },
                    { label:'Dark',       fn:()=>addBackground('#111111'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#111" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/> },
                    { label:'Navy',       fn:()=>addBackground('#1a1a2e'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#1a1a2e"/> },
                    { label:'White',      fn:()=>addBackground('#ffffff'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#fff" stroke="rgba(0,0,0,0.12)" strokeWidth="1"/> },
                    { label:'Light Gray', fn:()=>addBackground('#f5f5f7'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#f5f5f7" stroke="rgba(0,0,0,0.1)" strokeWidth="1"/> },
                    { label:'Warm',       fn:()=>addBackground('#fdf6ec'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#fdf6ec" stroke="rgba(0,0,0,0.1)" strokeWidth="1"/> },
                    { label:'Purple',     fn:()=>addBackground('#7C5CFC'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#7C5CFC"/> },
                    { label:'Teal',       fn:()=>addBackground('#00C4CC'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#00C4CC"/> },
                    { label:'Rose',       fn:()=>addBackground('#f43f5e'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#f43f5e"/> },
                    { label:'Forest',     fn:()=>addBackground('#166534'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#166534"/> },
                    { label:'Amber',      fn:()=>addBackground('#d97706'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#d97706"/> },
                    { label:'Slate',      fn:()=>addBackground('#334155'),       svg:<rect x="6" y="6" width="52" height="42" rx="4" fill="#334155"/> },
                    { label:'Sunset',     fn:()=>addGradientBackground('#f43f5e','#f97316',135), svg:<><defs><linearGradient id="bgs1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f43f5e"/><stop offset="100%" stopColor="#f97316"/></linearGradient></defs><rect x="6" y="6" width="52" height="42" rx="4" fill="url(#bgs1)"/></> },
                    { label:'Ocean',      fn:()=>addGradientBackground('#0ea5e9','#6366f1',135), svg:<><defs><linearGradient id="bgs2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0ea5e9"/><stop offset="100%" stopColor="#6366f1"/></linearGradient></defs><rect x="6" y="6" width="52" height="42" rx="4" fill="url(#bgs2)"/></> },
                    { label:'Aurora',     fn:()=>addGradientBackground('#7C5CFC','#00C4CC',135), svg:<><defs><linearGradient id="bgs3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#7C5CFC"/><stop offset="100%" stopColor="#00C4CC"/></linearGradient></defs><rect x="6" y="6" width="52" height="42" rx="4" fill="url(#bgs3)"/></> },
                    { label:'Midnight',   fn:()=>addGradientBackground('#0f0c29','#302b63',135), svg:<><defs><linearGradient id="bgs4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0f0c29"/><stop offset="100%" stopColor="#302b63"/></linearGradient></defs><rect x="6" y="6" width="52" height="42" rx="4" fill="url(#bgs4)"/></> },
                    { label:'Peach',      fn:()=>addGradientBackground('#ffecd2','#fcb69f',135), svg:<><defs><linearGradient id="bgs5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffecd2"/><stop offset="100%" stopColor="#fcb69f"/></linearGradient></defs><rect x="6" y="6" width="52" height="42" rx="4" fill="url(#bgs5)"/></> },
                    { label:'Forest',     fn:()=>addGradientBackground('#134e5e','#71b280',135), svg:<><defs><linearGradient id="bgs6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#134e5e"/><stop offset="100%" stopColor="#71b280"/></linearGradient></defs><rect x="6" y="6" width="52" height="42" rx="4" fill="url(#bgs6)"/></> },
                    { label:'Rose Gold',  fn:()=>addGradientBackground('#f7797d','#FBD786',90),  svg:<><defs><linearGradient id="bgs7" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#f7797d"/><stop offset="100%" stopColor="#FBD786"/></linearGradient></defs><rect x="6" y="6" width="52" height="42" rx="4" fill="url(#bgs7)"/></> },
                    { label:'Night Sky',  fn:()=>addGradientBackground('#0F2027','#203A43',180), svg:<><defs><linearGradient id="bgs8" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#0F2027"/><stop offset="100%" stopColor="#2C5364"/></linearGradient></defs><rect x="6" y="6" width="52" height="42" rx="4" fill="url(#bgs8)"/></> },
                  ],
                },
                { id:'stickers', label:'Stickers', grad:'linear-gradient(135deg,#f59e0b,#ec4899)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><text x="16" y="30" fontSize="22" textAnchor="middle">🔥</text><text x="38" y="22" fontSize="18" textAnchor="middle">⭐</text><text x="50" y="40" fontSize="16" textAnchor="middle">❤️</text><text x="14" y="48" fontSize="14" textAnchor="middle">🎉</text></svg>,
                  sections: STICKER_SETS.map(s => ({
                    label: s.label,
                    items: s.stickers.map(emoji => ({
                      label: emoji,
                      fn: () => addSticker(emoji),
                      svg: <text x="32" y="40" fontSize="26" textAnchor="middle">{emoji}</text>,
                    })),
                  })),
                  get items() { return this.sections.flatMap(s => s.items); },
                },
                { id:'trades', label:'Trades', grad:'linear-gradient(135deg,#475569,#1e293b)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><circle cx="20" cy="18" r="11" fill="rgba(255,255,255,0.25)"/><line x1="14" y1="18" x2="20" y2="18" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><line x1="20" y1="18" x2="20" y2="10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><circle cx="44" cy="18" r="11" fill="rgba(255,255,255,0.25)"/><line x1="38" y1="12" x2="50" y2="24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><line x1="50" y1="12" x2="38" y2="24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><circle cx="20" cy="40" r="11" fill="rgba(255,255,255,0.25)"/><polygon points="20,31 26,44 14,44" fill="#fff" opacity=".8"/><circle cx="44" cy="40" r="11" fill="rgba(255,255,255,0.25)"/><rect x="38" y="35" width="12" height="10" rx="1" fill="#fff" opacity=".8"/><rect x="40" y="33" width="8" height="4" rx="1" fill="#fff" opacity=".6"/></svg>,
                  items:[
                    { label:'Pipe',       fn:()=>addIconShape({iconKind:'pipe'}),       svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><line x1="14" y1="28" x2="36" y2="28" stroke="#fff" strokeWidth="4" strokeLinecap="round"/><line x1="14" y1="21" x2="14" y2="35" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"/><line x1="36" y1="28" x2="36" y2="19" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"/><line x1="36" y1="19" x2="50" y2="19" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"/><line x1="50" y1="14" x2="50" y2="24" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"/></> },
                    { label:'Snowflake',  fn:()=>addIconShape({iconKind:'snowflake'}),  svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><line x1="32" y1="12" x2="32" y2="44" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><line x1="15" y1="20" x2="49" y2="36" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><line x1="15" y1="36" x2="49" y2="20" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><line x1="23" y1="14" x2="29" y2="20" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><line x1="41" y1="14" x2="35" y2="20" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></> },
                    { label:'Fan / AC',   fn:()=>addIconShape({iconKind:'fan'}),        svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><ellipse cx="26" cy="19" rx="7" ry="11" fill="#fff" opacity=".8" transform="rotate(15 26 19)"/><ellipse cx="42" cy="25" rx="7" ry="11" fill="#fff" opacity=".8" transform="rotate(135 42 25)"/><ellipse cx="25" cy="39" rx="7" ry="11" fill="#fff" opacity=".8" transform="rotate(255 25 39)"/><circle cx="32" cy="28" r="4" fill="rgba(255,255,255,0.25)"/></> },
                    { label:'Hard Hat',   fn:()=>addIconShape({iconKind:'hardhat'}),    svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><path d="M14 33 C14 24 22 16 32 16 C42 16 50 24 50 33Z" fill="#fff" opacity=".9"/><rect x="13" y="33" width="38" height="6" rx="2" fill="#fff" opacity=".9"/><rect x="29" y="11" width="6" height="10" rx="2" fill="rgba(255,255,255,0.6)"/></> },
                    { label:'Paintbrush', fn:()=>addIconShape({iconKind:'paintbrush'}), svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><line x1="22" y1="14" x2="42" y2="34" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"/><rect x="36" y="30" width="10" height="7" rx="2" fill="#fff" opacity=".5" transform="rotate(45 41 33)"/><ellipse cx="44" cy="38" rx="4" ry="6" fill="#fff" opacity=".85" transform="rotate(45 44 38)"/></> },
                    { label:'Spray',      fn:()=>addIconShape({iconKind:'spray'}),      svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><rect x="22" y="22" width="16" height="22" rx="4" fill="#fff" opacity=".9"/><rect x="28" y="14" width="10" height="10" rx="2" fill="#fff" opacity=".8"/><circle cx="46" cy="18" r="2" fill="#fff" opacity=".8"/><circle cx="48" cy="22" r="1.5" fill="#fff" opacity=".7"/><circle cx="46" cy="26" r="1.5" fill="#fff" opacity=".6"/></> },
                    { label:'Service Van', fn:()=>addIconShape({iconKind:'truck'}),     svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><rect x="10" y="20" width="28" height="16" rx="2" fill="#fff" opacity=".9"/><path d="M38 24 L38 18 L50 18 L50 36 L38 36Z" fill="#fff" opacity=".85"/><circle cx="18" cy="37" r="4" fill="rgba(255,255,255,0.5)"/><circle cx="18" cy="37" r="2" fill="#fff"/><circle cx="44" cy="37" r="4" fill="rgba(255,255,255,0.5)"/><circle cx="44" cy="37" r="2" fill="#fff"/></> },
                    { label:'Broom',      fn:()=>addIconShape({iconKind:'broom'}),      svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><line x1="32" y1="13" x2="32" y2="30" stroke="#fff" strokeWidth="3" strokeLinecap="round" transform="rotate(-10 32 13)"/><path d="M20 32 L44 32 L42 42 C38 46 26 46 22 42Z" fill="#fff" opacity=".9"/></> },
                    { label:'Ladder',     fn:()=>addIconShape({iconKind:'ladder'}),     svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><line x1="22" y1="12" x2="22" y2="46" stroke="#fff" strokeWidth="3" strokeLinecap="round"/><line x1="42" y1="12" x2="42" y2="46" stroke="#fff" strokeWidth="3" strokeLinecap="round"/><line x1="22" y1="20" x2="42" y2="20" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><line x1="22" y1="28" x2="42" y2="28" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><line x1="22" y1="36" x2="42" y2="36" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></> },
                    { label:'Gear',       fn:()=>addIconShape({iconKind:'gear'}),       svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><circle cx="32" cy="28" r="12" fill="#fff" opacity=".9"/><circle cx="32" cy="28" r="6" fill="rgba(255,255,255,0.25)"/>{[0,45,90,135].map(a=><rect key={a} x="30" y="13" width="4" height="5" rx="1" fill="#fff" opacity=".9" transform={`rotate(${a} 32 28)`}/>)}</> },
                    { label:'Price Tag',  fn:()=>addIconShape({iconKind:'tag'}),        svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><path d="M14 28 L22 16 L44 16 L52 28 L44 40 L22 40Z" fill="#fff" opacity=".9"/><circle cx="28" cy="22" r="3" fill="rgba(255,255,255,0.3)"/><line x1="26" y1="30" x2="40" y2="30" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/></> },
                    { label:'Fire Haz.',  fn:()=>addIconShape({iconKind:'flame'}),      svg:<><circle cx="32" cy="28" r="19" fill="rgba(255,255,255,0.2)"/><path d="M32 11 C36 17 40 21 39 26 C38 30 35 31 33 28 C36 23 32 18 32 18 C32 18 28 23 31 28 C29 31 26 30 25 26 C24 21 28 17 32 11Z" fill="#fff" opacity=".9"/><ellipse cx="32" cy="36" rx="3" ry="4" fill="#fff" opacity=".7"/></> },
                  ],
                },
                { id:'grids', label:'Grids', grad:'linear-gradient(135deg,#6366f1,#4f46e5)',
                  noLabels: true,
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><rect x="6" y="8" width="24" height="38" rx="3" fill="rgba(255,255,255,0.3)"/><rect x="34" y="8" width="24" height="17" rx="3" fill="rgba(255,255,255,0.3)"/><rect x="34" y="29" width="24" height="17" rx="3" fill="rgba(255,255,255,0.3)"/></svg>,
                  items:[
                    { label:'2 Columns',  fn:()=>addGridLayout('2col'),    svg:<><rect x="8" y="12" width="21" height="32" rx="3" fill="#fff" opacity=".7"/><rect x="35" y="12" width="21" height="32" rx="3" fill="#fff" opacity=".7"/></> },
                    { label:'3 Columns',  fn:()=>addGridLayout('3col'),    svg:<><rect x="6" y="14" width="14" height="28" rx="2" fill="#fff" opacity=".7"/><rect x="25" y="14" width="14" height="28" rx="2" fill="#fff" opacity=".7"/><rect x="44" y="14" width="14" height="28" rx="2" fill="#fff" opacity=".7"/></> },
                    { label:'4 Columns',  fn:()=>addGridLayout('4col'),    svg:<><rect x="4" y="16" width="11" height="24" rx="2" fill="#fff" opacity=".7"/><rect x="18" y="16" width="11" height="24" rx="2" fill="#fff" opacity=".7"/><rect x="32" y="16" width="11" height="24" rx="2" fill="#fff" opacity=".7"/><rect x="46" y="16" width="11" height="24" rx="2" fill="#fff" opacity=".7"/></> },
                    { label:'2 Rows',     fn:()=>addGridLayout('2row'),    svg:<><rect x="10" y="8" width="44" height="17" rx="3" fill="#fff" opacity=".7"/><rect x="10" y="29" width="44" height="17" rx="3" fill="#fff" opacity=".7"/></> },
                    { label:'4 Square',   fn:()=>addGridLayout('4sq'),     svg:<><rect x="8" y="8" width="21" height="17" rx="2" fill="#fff" opacity=".7"/><rect x="35" y="8" width="21" height="17" rx="2" fill="#fff" opacity=".7"/><rect x="8" y="29" width="21" height="17" rx="2" fill="#fff" opacity=".7"/><rect x="35" y="29" width="21" height="17" rx="2" fill="#fff" opacity=".7"/></> },
                    { label:'9 Square',   fn:()=>addGridLayout('9sq'),     svg:<><rect x="6" y="8" width="14" height="11" rx="1" fill="#fff" opacity=".7"/><rect x="25" y="8" width="14" height="11" rx="1" fill="#fff" opacity=".7"/><rect x="44" y="8" width="14" height="11" rx="1" fill="#fff" opacity=".7"/><rect x="6" y="22" width="14" height="11" rx="1" fill="#fff" opacity=".7"/><rect x="25" y="22" width="14" height="11" rx="1" fill="#fff" opacity=".7"/><rect x="44" y="22" width="14" height="11" rx="1" fill="#fff" opacity=".7"/><rect x="6" y="36" width="14" height="11" rx="1" fill="#fff" opacity=".7"/><rect x="25" y="36" width="14" height="11" rx="1" fill="#fff" opacity=".7"/><rect x="44" y="36" width="14" height="11" rx="1" fill="#fff" opacity=".7"/></> },
                    { label:'3-Strip',    fn:()=>addGridLayout('3strip'),  svg:<><rect x="6" y="10" width="14" height="36" rx="2" fill="#fff" opacity=".7"/><rect x="25" y="10" width="14" height="36" rx="2" fill="#fff" opacity=".7"/><rect x="44" y="10" width="14" height="36" rx="2" fill="#fff" opacity=".7"/></> },
                    { label:'2 Tall',     fn:()=>addGridLayout('2row_tall'), svg:<><rect x="8" y="8" width="21" height="38" rx="3" fill="#fff" opacity=".7"/><rect x="35" y="8" width="21" height="38" rx="3" fill="#fff" opacity=".7"/></> },
                  ],
                },
                { id:'animations', label:'Animations', grad:'linear-gradient(145deg,#22c55e,#4ade80)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><circle cx="32" cy="27" r="18" fill="rgba(255,255,255,0.25)"/><circle cx="32" cy="27" r="12" fill="rgba(255,255,255,0.35)"/><path d="M26 21 L26 33 L40 27Z" fill="#fff" opacity=".9"/><circle cx="18" cy="12" r="4" fill="#fff" opacity=".6"/><circle cx="46" cy="12" r="4" fill="#fff" opacity=".6"/></svg>,
                  sections:[
                    { label:'Arrow animations', items:[
                      { label:'Bounce →', fn:()=>{}, svg:<><line x1="8" y1="27" x2="42" y2="27" stroke="#fff" strokeWidth="3" strokeLinecap="round"/><polygon points="38,20 52,27 38,34" fill="#fff" opacity=".85"/></> },
                      { label:'Draw →',   fn:()=>{}, svg:<><line x1="8" y1="27" x2="42" y2="27" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 2"/><polygon points="38,20 52,27 38,34" fill="#fff" opacity=".7"/></> },
                      { label:'Spin',     fn:()=>{}, svg:<><path d="M32 14a14 14 0 1 1-10 4" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"/><polygon points="14,20 10,30 22,24" fill="#fff"/></> },
                    ]},
                    { label:'Word animations', items:[
                      { label:'Typewriter', fn:()=>{}, svg:<text x="10" y="32" fill="#fff" fontSize="13" fontWeight="bold" opacity=".9">Aa|</text> },
                      { label:'Fade in',    fn:()=>{}, svg:<text x="10" y="32" fill="#fff" fontSize="13" fontWeight="bold" opacity=".5">Text</text> },
                      { label:'Pop up',     fn:()=>{}, svg:<text x="10" y="34" fill="#fff" fontSize="14" fontWeight="bold" opacity=".9">Pop!</text> },
                    ]},
                    { label:'Shape animations', items:[
                      { label:'Pulse',  fn:()=>{}, svg:<><circle cx="32" cy="27" r="10" fill="#fff" opacity=".85"/><circle cx="32" cy="27" r="18" fill="none" stroke="#fff" strokeWidth="2" opacity=".4"/></> },
                      { label:'Spin',   fn:()=>{}, svg:<circle cx="32" cy="27" r="18" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="30 10"/> },
                      { label:'Bounce', fn:()=>{}, svg:<><circle cx="32" cy="28" r="10" fill="#fff" opacity=".85"/><path d="M22 40 Q32 34 42 40" fill="none" stroke="#fff" strokeWidth="2" opacity=".4"/></> },
                    ]},
                    { label:'Food animations', items:[
                      { label:'Pizza',  fn:()=>{}, svg:<text x="20" y="36" fontSize="22">🍕</text> },
                      { label:'Coffee', fn:()=>{}, svg:<text x="20" y="36" fontSize="22">☕</text> },
                      { label:'Burger', fn:()=>{}, svg:<text x="20" y="36" fontSize="22">🍔</text> },
                    ]},
                  ],
                },
                { id:'audio', label:'Audio', grad:'linear-gradient(145deg,#ef4444,#f97316)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><path d="M28 12 L28 42 L18 36 L10 36 L10 20 L18 20Z" fill="#fff" opacity=".85"/><path d="M36 20 C44 22 44 34 36 36" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round"/><path d="M42 14 C54 18 54 38 42 42" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round"/></svg>,
                  hasVoiceover: true,
                  sections:[
                    { label:'Magic recommendations', trackList:true, items:[
                      { label:'Corporate Music',  artist:'AudioCoffee',    duration:'2:19', grad:'linear-gradient(135deg,#1e293b,#0f172a)' },
                      { label:'Upbeat Promo',     artist:'SoundWave',      duration:'1:45', grad:'linear-gradient(135deg,#1e40af,#1e3a8a)' },
                      { label:'Inspirational',    artist:'MoodMedia',      duration:'3:02', grad:'linear-gradient(135deg,#065f46,#047857)' },
                    ]},
                    { label:'Popular music', trackList:true, items:[
                      { label:'Push The Pedal',   artist:'Jordan Olmos',   duration:'1:32', grad:'linear-gradient(135deg,#7c2d12,#9a3412)' },
                      { label:'I Need You',       artist:'Def Manic',      duration:'3:21', grad:'linear-gradient(135deg,#4c1d95,#5b21b6)' },
                      { label:'Summer Vibes',     artist:'CoastalSounds',  duration:'2:54', grad:'linear-gradient(135deg,#0c4a6e,#0369a1)' },
                    ]},
                  ],
                },
                { id:'forms', label:'Forms', grad:'linear-gradient(145deg,#10b981,#059669)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><rect x="12" y="14" width="40" height="8" rx="4" fill="rgba(255,255,255,0.3)"/><rect x="12" y="26" width="40" height="8" rx="4" fill="rgba(255,255,255,0.3)"/><rect x="12" y="38" width="24" height="8" rx="4" fill="#fff" opacity=".85"/><circle cx="44" cy="18" r="3" fill="#fff" opacity=".9"/><circle cx="44" cy="30" r="3" fill="rgba(255,255,255,0.4)"/></svg>,
                  sections:[
                    { label:'Business', formCards:true, items:[
                      { label:'Subscribe form', bg:'#f0fdf4',
                        preview:<><div style={{fontSize:9,fontWeight:700,color:'#166534',marginBottom:4}}>Subscribe to our newsletter</div><div style={{height:12,background:'#fff',borderRadius:3,border:'1px solid #d1fae5',marginBottom:3}}/><div style={{height:12,background:'#fff',borderRadius:3,border:'1px solid #d1fae5',marginBottom:4}}/><div style={{height:10,background:'#166534',borderRadius:3,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:7,color:'#fff',fontWeight:600}}>Join</span></div></> },
                      { label:'Contact form', bg:'#052e16',
                        preview:<><div style={{fontSize:9,fontWeight:700,color:'#fff',marginBottom:4}}>Contact Form</div><div style={{fontSize:7,color:'rgba(255,255,255,0.6)',marginBottom:2}}>Name</div><div style={{height:10,background:'rgba(255,255,255,0.1)',borderRadius:2,marginBottom:2}}/><div style={{fontSize:7,color:'rgba(255,255,255,0.6)',marginBottom:2}}>Email</div><div style={{height:10,background:'rgba(255,255,255,0.1)',borderRadius:2}}/></> },
                    ]},
                    { label:'Education', formCards:true, items:[
                      { label:'True/False quiz', bg:'#f0fdf4',
                        preview:<><div style={{fontSize:9,fontWeight:700,color:'#166534',marginBottom:4}}>Type your statement</div><div style={{height:10,background:'#fff',border:'1px solid #bbf7d0',borderRadius:3,marginBottom:2,display:'flex',alignItems:'center',paddingLeft:4}}><span style={{fontSize:7,color:'#166534'}}>True</span></div><div style={{height:10,background:'#fff',border:'1px solid #bbf7d0',borderRadius:3,display:'flex',alignItems:'center',paddingLeft:4}}><span style={{fontSize:7,color:'#166534'}}>False</span></div></> },
                      { label:'Multiple choice', bg:'#581c87',
                        preview:<><div style={{fontSize:8,fontWeight:700,color:'#fff',marginBottom:3}}>Which is NOT true?</div><div style={{height:8,background:'rgba(255,255,255,0.15)',borderRadius:2,marginBottom:2}}/><div style={{height:8,background:'rgba(255,255,255,0.15)',borderRadius:2}}/></> },
                    ]},
                    { label:'Events', formCards:true, items:[
                      { label:'RSVP form', bg:'#fffbeb',
                        preview:<><div style={{fontSize:9,fontWeight:700,color:'#92400e',marginBottom:2,border:'1px solid #fcd34d',padding:'1px 4px',display:'inline-block',borderRadius:2}}>RSVP</div><div style={{fontSize:7,color:'#78350f',marginBottom:2}}>Your name</div><div style={{height:8,background:'#fff',border:'1px solid #fde68a',borderRadius:2,marginBottom:3}}/><div style={{fontSize:7,color:'#78350f'}}>Are you coming?</div></> },
                      { label:'Event feedback', bg:'#eff6ff',
                        preview:<><div style={{fontSize:7,fontWeight:700,color:'#1e40af',marginBottom:3}}>HOW WOULD YOU RATE?</div><div style={{display:'flex',gap:2}}>{[1,2,3].map(n=><div key={n} style={{flex:1,height:12,background:'#dbeafe',borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:6,color:'#1e40af'}}>{n}</span></div>)}</div></> },
                    ]},
                    { label:'Feedback', formCards:true, items:[
                      { label:'Rating form', bg:'#fdf4ff',
                        preview:<><div style={{fontSize:8,fontWeight:600,color:'#7c3aed',marginBottom:4}}>Rate your experience</div><div style={{display:'flex',gap:2}}>{'★★★★☆'.split('').map((s,i)=><span key={i} style={{fontSize:12,color:s==='★'?'#f59e0b':'#d1d5db'}}>{s}</span>)}</div></> },
                      { label:'NPS form', bg:'#f0f9ff',
                        preview:<><div style={{fontSize:7,fontWeight:600,color:'#0369a1',marginBottom:3}}>How likely to recommend?</div><div style={{display:'flex',gap:1}}>{[0,1,2,3,4,5].map(n=><div key={n} style={{flex:1,height:12,background:'#e0f2fe',borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:6}}>{n}</span></div>)}</div></> },
                    ]},
                  ],
                },
                { id:'sheets', label:'Sheets', grad:'linear-gradient(145deg,#0ea5e9,#0284c7)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><rect x="8" y="10" width="48" height="36" rx="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/><line x1="8" y1="20" x2="56" y2="20" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/><line x1="8" y1="30" x2="56" y2="30" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/><line x1="8" y1="40" x2="56" y2="40" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/><line x1="24" y1="10" x2="24" y2="46" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/><line x1="40" y1="10" x2="40" y2="46" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/><text x="16" y="17" fill="#fff" fontSize="6" textAnchor="middle" opacity=".8">foo</text></svg>,
                  sections:[
                    { label:'Start', formCards:true, items:[
                      { label:'Blank sheet', bg:'#f8fafc',
                        preview:<><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:1,border:'1px solid #e2e8f0',borderRadius:3,overflow:'hidden'}}>{Array(9).fill(0).map((_,i)=><div key={i} style={{height:12,background:'#fff',border:'1px solid #f1f5f9'}}/>)}</div></> },
                      { label:'Teal header', bg:'#f0fdfa',
                        preview:<><div style={{height:12,background:'#0d9488',borderRadius:'3px 3px 0 0',marginBottom:1}}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1}}>{Array(4).fill(0).map((_,i)=><div key={i} style={{height:10,background:'#f0fdfa',border:'1px solid #ccfbf1'}}/>)}</div></> },
                    ]},
                    { label:'Track', formCards:true, items:[
                      { label:'Contact List', bg:'#faf5ff',
                        preview:<><div style={{fontSize:7,fontWeight:700,color:'#7c3aed',background:'#a78bfa',padding:'2px 4px',borderRadius:2,marginBottom:2}}>Contact List</div><div style={{fontSize:6,color:'#6d28d9',marginBottom:1}}>Date • Surname</div><div style={{height:6,background:'rgba(167,139,250,0.3)',borderRadius:1,marginBottom:1}}/><div style={{height:6,background:'rgba(167,139,250,0.2)',borderRadius:1}}/></> },
                      { label:'Inventory', bg:'#eff6ff',
                        preview:<><div style={{fontSize:7,fontWeight:700,color:'#1e40af',marginBottom:2}}>Inventory Tracker</div><div style={{fontSize:6,color:'#1e40af',marginBottom:1}}>Item Name</div><div style={{height:6,background:'#dbeafe',borderRadius:1,marginBottom:1}}/><div style={{height:6,background:'#eff6ff',borderRadius:1}}/></> },
                    ]},
                    { label:'Calculate', formCards:true, items:[
                      { label:'Budget', bg:'#0d9488',
                        preview:<><div style={{fontSize:8,fontWeight:700,color:'#fff',marginBottom:2}}>Budget</div><div style={{fontSize:7,color:'rgba(255,255,255,0.8)',marginBottom:1}}>Monthly Income $2,100</div><div style={{height:1,background:'rgba(255,255,255,0.3)',marginBottom:2}}/><div style={{fontSize:6,color:'rgba(255,255,255,0.7)'}}>Salary $2,000</div></> },
                      { label:'Expenses', bg:'#3b82f6',
                        preview:<><div style={{fontSize:8,fontWeight:700,color:'#fff',marginBottom:2}}>Expense Sheet</div><div style={{fontSize:7,color:'rgba(255,255,255,0.8)',marginBottom:1}}>Date • Category</div><div style={{height:6,background:'rgba(255,255,255,0.15)',borderRadius:1,marginBottom:1}}/><div style={{height:6,background:'rgba(255,255,255,0.1)',borderRadius:1}}/></> },
                    ]},
                    { label:'Plan', formCards:true, items:[
                      { label:'Project plan', bg:'#f0fdf4',
                        preview:<><div style={{fontSize:7,fontWeight:700,color:'#166534',marginBottom:2}}>Project Plan</div><div style={{display:'flex',gap:1,marginBottom:1}}>{['Q1','Q2','Q3'].map(q=><div key={q} style={{flex:1,height:10,background:'#dcfce7',borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:5,color:'#166534'}}>{q}</span></div>)}</div></> },
                      { label:'Weekly plan', bg:'#fefce8',
                        preview:<><div style={{fontSize:7,fontWeight:700,color:'#854d0e',marginBottom:2}}>Weekly Planner</div>{['Mon','Tue','Wed'].map(d=><div key={d} style={{display:'flex',gap:2,marginBottom:1,alignItems:'center'}}><span style={{fontSize:6,color:'#92400e',width:16}}>{d}</span><div style={{flex:1,height:5,background:'#fef9c3',borderRadius:1}}/></div>)}</> },
                    ]},
                  ],
                },
                { id:'tables', label:'Tables', grad:'linear-gradient(145deg,#f59e0b,#d97706)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54"><rect x="8" y="10" width="48" height="36" rx="3" fill="rgba(255,255,255,0.15)" stroke="#fff" strokeWidth="1.5" opacity=".8"/><rect x="8" y="10" width="48" height="10" rx="3" fill="rgba(255,255,255,0.35)"/><line x1="8" y1="30" x2="56" y2="30" stroke="#fff" strokeWidth="1" opacity=".5"/><line x1="8" y1="40" x2="56" y2="40" stroke="#fff" strokeWidth="1" opacity=".5"/><line x1="26" y1="20" x2="26" y2="46" stroke="#fff" strokeWidth="1" opacity=".5"/><line x1="44" y1="20" x2="44" y2="46" stroke="#fff" strokeWidth="1" opacity=".5"/></svg>,
                  tableStyles:[
                    { label:'Gray',   color:'#9ca3af' }, { label:'Dark',   color:'#374151' }, { label:'Black',  color:'#111827' },
                    { label:'Red',    color:'#ef4444' }, { label:'Salmon', color:'#f87171' }, { label:'Pink',   color:'#fca5a5' },
                    { label:'Orange', color:'#f97316' }, { label:'Amber',  color:'#fbbf24' }, { label:'Yellow', color:'#fde68a' },
                    { label:'Blue',   color:'#3b82f6' }, { label:'Indigo', color:'#6366f1' }, { label:'Violet', color:'#8b5cf6' },
                    { label:'Purple', color:'#a855f7' }, { label:'Teal',   color:'#14b8a6' }, { label:'Green',  color:'#22c55e' },
                  ],
                },
                { id:'mockups', label:'Mockups', grad:'linear-gradient(145deg,#f97316,#ea580c)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54">
                    <rect x="18" y="10" width="28" height="34" rx="4" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
                    <path d="M22 14h20v20H22Z" fill="rgba(255,255,255,0.3)"/>
                    <path d="M26 36h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
                    <path d="M18 44 Q10 40 12 32" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none"/>
                    <path d="M46 44 Q54 40 52 32" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none"/>
                  </svg>,
                  sections:[
                    { label:'Video Mockups', items:[
                      { label:'T-Shirt',   fn:()=>{}, svg:<path d="M20 10 L12 20 L20 18 L20 42 L44 42 L44 18 L52 20 L44 10 Q32 15 20 10Z" fill="#fff" opacity=".85"/> },
                      { label:'Mug',       fn:()=>{}, svg:<><rect x="14" y="14" width="28" height="28" rx="4" fill="none" stroke="#fff" strokeWidth="2.5"/><path d="M42 20 Q52 22 52 30 Q52 38 42 38" fill="none" stroke="#fff" strokeWidth="2.5"/></> },
                      { label:'Phone',     fn:()=>{}, svg:<><rect x="20" y="8" width="24" height="40" rx="5" fill="none" stroke="#fff" strokeWidth="2.5"/><line x1="28" y1="11" x2="36" y2="11" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></> },
                    ]},
                    { label:'Smartphones', items:[
                      { label:'iPhone',    fn:()=>{}, svg:<><rect x="20" y="8" width="24" height="40" rx="5" fill="none" stroke="#fff" strokeWidth="2.5"/><line x1="28" y1="11" x2="36" y2="11" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><circle cx="32" cy="44" r="2.5" fill="#fff" opacity=".7"/></> },
                      { label:'Hand',      fn:()=>{}, svg:<><rect x="22" y="10" width="20" height="34" rx="4" fill="none" stroke="#fff" strokeWidth="2"/><path d="M18 30 Q10 28 12 40 Q18 46 26 44" fill="none" stroke="#fff" strokeWidth="2"/></> },
                      { label:'Side view', fn:()=>{}, svg:<rect x="24" y="8" width="16" height="38" rx="4" fill="none" stroke="#fff" strokeWidth="2.5"/> },
                    ]},
                    { label:'Print', items:[
                      { label:'Sticker',  fn:()=>{}, svg:<circle cx="32" cy="27" r="18" fill="none" stroke="#fff" strokeWidth="2.5"/> },
                      { label:'Label',    fn:()=>{}, svg:<><rect x="10" y="18" width="44" height="24" rx="4" fill="none" stroke="#fff" strokeWidth="2.5"/><path d="M10 24h44" stroke="#fff" strokeWidth="1.5" opacity=".5"/></> },
                      { label:'Pin',      fn:()=>{}, svg:<><circle cx="32" cy="20" r="10" fill="none" stroke="#fff" strokeWidth="2.5"/><line x1="32" y1="30" x2="32" y2="46" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></> },
                    ]},
                    { label:'Apparel', items:[
                      { label:'T-Shirt',  fn:()=>{}, svg:<path d="M20 10 L12 20 L20 18 L20 42 L44 42 L44 18 L52 20 L44 10 Q32 15 20 10Z" fill="#fff" opacity=".85"/> },
                      { label:'Hoodie',   fn:()=>{}, svg:<><path d="M18 10 L10 24 L18 22 L18 44 L46 44 L46 22 L54 24 L46 10 Q32 16 18 10Z" fill="none" stroke="#fff" strokeWidth="2"/><path d="M26 10 Q32 14 38 10" fill="none" stroke="#fff" strokeWidth="2"/></> },
                      { label:'Bag',      fn:()=>{}, svg:<><rect x="14" y="18" width="36" height="28" rx="4" fill="none" stroke="#fff" strokeWidth="2.5"/><path d="M22 18 Q22 10 32 10 Q42 10 42 18" fill="none" stroke="#fff" strokeWidth="2.5"/></> },
                    ]},
                  ],
                },
                { id:'3d', label:'3D', grad:'linear-gradient(145deg,#8b5cf6,#6d28d9)',
                  preview:<svg viewBox="0 0 64 54" width="64" height="54">
                    <polygon points="32,10 52,22 52,38 32,48 12,38 12,22" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
                    <polygon points="32,10 52,22 32,30 12,22" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
                    <polygon points="32,30 52,22 52,38 32,48" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
                  </svg>,
                  sections:[
                    { label:'Icons & Stickers', items:[
                      { label:'Arrow',   fn:()=>{}, svg:<text x="20" y="36" fontSize="24" fill="#fff">↪</text> },
                      { label:'Check',   fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">✅</text> },
                      { label:'Zap',     fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">⚡</text> },
                      { label:'Heart',   fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">💜</text> },
                      { label:'Fire',    fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">🔥</text> },
                      { label:'Crown',   fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">👑</text> },
                    ]},
                    { label:'Characters & Emojis', items:[
                      { label:'Smile',   fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">😊</text> },
                      { label:'Panda',   fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">🐼</text> },
                      { label:'Cat',     fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">🐱</text> },
                      { label:'Ghost',   fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">👻</text> },
                      { label:'Robot',   fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">🤖</text> },
                      { label:'Dragon',  fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">🐲</text> },
                    ]},
                    { label:'Food & Lifestyle', items:[
                      { label:'Coffee',  fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">☕</text> },
                      { label:'Pizza',   fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">🍕</text> },
                      { label:'Burger',  fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">🍔</text> },
                      { label:'Gem',     fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">💎</text> },
                      { label:'Camera',  fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">📸</text> },
                      { label:'Trophy',  fn:()=>{}, svg:<text x="17" y="37" fontSize="24" fill="#fff">🏆</text> },
                    ]},
                  ],
                },
              ];
              const allItems = cats.flatMap(c =>
                (c.sections
                  ? c.sections.flatMap(s => (s.trackList || s.formCards) ? [] : (s.items || []))
                  : (c.items || []))
                  .filter(i => i.fn && i.svg)
                  .map(i => ({...i, catId:c.id}))
              );
              const q = elemSearch.trim().toLowerCase();
              const filtered = q ? allItems.filter(i => i.label.toLowerCase().includes(q)) : null;
              const activeCat = cats.find(c => c.id === activeElemCat);
              const renderCard = (item) => {
                const cat = cats.find(c => c.id === item.catId) || cats[0];
                return (
                  <button key={`${item.catId}-${item.label}`} onMouseDown={e => { e.preventDefault(); item.fn && item.fn(); }}
                    style={{ display:'flex', flexDirection:'column', border:`1px solid ${t.border}`, borderRadius:8, overflow:'hidden', background:t.input, cursor:'pointer', padding:0, transition:'transform 80ms, border-color 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=t.primaryBorder; e.currentTarget.style.transform='scale(1.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.transform='scale(1)'; }}>
                    <div style={{ height:54, background:cat.grad, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg viewBox="0 0 64 54" width="100%" height="54">{item.svg}</svg>
                    </div>
                    <div style={{ padding:'5px 4px 6px', fontSize:10, color:t.textMuted, textAlign:'center', fontWeight:500, lineHeight:1.2 }}>{item.label}</div>
                  </button>
                );
              };
              const renderScrollCard = (item) => {
                const cat = cats.find(c => c.id === item.catId) || cats[0];
                return (
                  <button key={`sc-${item.catId}-${item.label}`}
                    onMouseDown={e => { e.preventDefault(); item.fn && item.fn(); }}
                    style={{ flexShrink:0, width:72, display:'flex', flexDirection:'column', border:`1px solid ${t.border}`, borderRadius:8, overflow:'hidden', background:t.input, cursor:'pointer', padding:0, transition:'transform 80ms, border-color 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=t.primaryBorder; e.currentTarget.style.transform='scale(1.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.transform='scale(1)'; }}>
                    <div style={{ height:54, background:cat.grad, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                      <svg viewBox="0 0 64 54" width="100%" height="54">{item.svg}</svg>
                      {cat.id === '3d' && (
                        <div style={{ position:'absolute', bottom:3, left:3, background:'rgba(0,0,0,0.52)', color:'#fff', fontSize:7, fontWeight:700, padding:'1px 4px', borderRadius:3, lineHeight:1.4, letterSpacing:0.4 }}>3D</div>
                      )}
                    </div>
                    <div style={{ padding:'5px 4px 6px', fontSize:10, color:t.textMuted, textAlign:'center', fontWeight:500, lineHeight:1.2 }}>{item.label}</div>
                  </button>
                );
              };
              return (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {/* Search bar — AI-powered description search */}
                <div style={{ display:'flex', alignItems:'center', gap:8, background:t.input, borderRadius:10, padding:'8px 12px', border:`1px solid ${elemSearch ? t.primaryBorder : t.border}`, transition:'border-color 150ms ease, box-shadow 150ms ease', boxShadow: elemSearch ? `0 0 0 3px ${t.primaryBg}` : 'none' }}>
                  <span style={{ color: elemSearch ? t.primary : t.textMuted, flexShrink:0, display:'flex' }}><IpSearch size={15}/></span>
                  <input value={elemSearch} onChange={e => { setElemSearch(e.target.value); setActiveElemCat(null); }}
                    placeholder="+ Describe your ideal element" style={{ flex:1, background:'transparent', border:'none', outline:'none', color:t.text, fontSize:13 }} />
                  {elemSearch
                    ? <button onClick={() => setElemSearch('')} style={{ background:'none', border:'none', color:t.textMuted, cursor:'pointer', padding:0, fontSize:18, lineHeight:1, display:'flex' }}>×</button>
                    : <span title="Voice search" style={{ color: t.textMuted, flexShrink:0, fontSize:15, lineHeight:1 }}>🎤</span>
                  }
                </div>
                {/* Generate (split-button) + Search (purple pill) — Canva-style */}
                <div style={{ display:'flex', gap:8 }}>
                  {/* Generate split-button: white outlined + sparkle + Generate text + ▾ dropdown */}
                  <div style={{ flex:1.1, display:'flex', borderRadius:22, border:`1px solid ${t.border}`, overflow:'hidden', background:t.card }}>
                    <button style={{ flex:1, height:40, display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:t.text, fontSize:13, fontWeight:500, whiteSpace:'nowrap' }}>
                      <IpSparkle size={14} color={t.primary}/> Generate
                    </button>
                    <div style={{ width:1, background:t.border, flexShrink:0 }} />
                    <button style={{ width:36, height:40, background:'none', border:'none', cursor:'pointer', color:t.textMuted, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>▾</button>
                  </div>
                  {/* Search — solid purple pill */}
                  <button style={{ flex:1, height:40, borderRadius:22, background:t.primary, color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:600 }}
                    onClick={() => { if (elemSearch.trim()) setActiveElemCat(null); }}>
                    Search
                  </button>
                </div>
                {/* Search Results */}
                {filtered && (
                  <div>
                    <div style={{ fontSize:11, color:t.textMuted, marginBottom:8 }}>{filtered.length} result{filtered.length!==1?'s':''} for "{elemSearch}"</div>
                    {filtered.length===0 ? (
                      <div style={{ textAlign:'center', color:t.textMuted, fontSize:12, padding:'20px 0' }}>No elements found</div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7 }}>{filtered.map(it => renderCard(it))}</div>
                    )}
                  </div>
                )}
                {/* Category Detail */}
                {!filtered && activeCat && (
                  <div>
                    <button onClick={() => setActiveElemCat(null)}
                      style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:t.text, fontSize:13, fontWeight:600, cursor:'pointer', padding:'4px 0 10px' }}>
                      ← {activeCat.label}
                    </button>

                    {/* "Start with data" CTA — Charts only */}
                    {activeCat.startWithData && (
                      <button onMouseDown={e => { e.preventDefault(); addTable(); }}
                        style={{ width:'100%', padding:'11px 0', marginBottom:14, background:t.input, border:`1px solid ${t.border}`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', gap:8, color:t.text, fontSize:13, fontWeight:500, cursor:'pointer', transition:'border-color 150ms', boxSizing:'border-box' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor=t.primaryBorder}
                        onMouseLeave={e => e.currentTarget.style.borderColor=t.border}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
                        </svg>
                        Start with data
                      </button>
                    )}

                    {/* Voiceovers CTA — Audio only */}
                    {activeCat.hasVoiceover && (
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:t.text, marginBottom:8 }}>Voiceovers</div>
                        <button style={{ width:'100%', padding:'14px 16px', borderRadius:10, background:'linear-gradient(135deg,#8b5cf6,#6d28d9)', border:'none', display:'flex', alignItems:'center', gap:12, cursor:'pointer', boxSizing:'border-box' }}>
                          <div style={{ width:44, height:44, borderRadius:10, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                            </svg>
                          </div>
                          <span style={{ color:'#fff', fontSize:14, fontWeight:600, textAlign:'left' }}>Generate AI voice</span>
                        </button>
                      </div>
                    )}

                    {/* tableStyles grid — Tables only */}
                    {activeCat.tableStyles && (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                        {activeCat.tableStyles.map(ts => (
                          <button key={ts.label} onMouseDown={e => { e.preventDefault(); addTable(); }}
                            style={{ border:`1px solid ${t.border}`, borderRadius:8, overflow:'hidden', background:t.input, cursor:'pointer', padding:6, transition:'border-color 150ms' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor=t.primaryBorder}
                            onMouseLeave={e => e.currentTarget.style.borderColor=t.border}>
                            <div style={{ borderRadius:4, overflow:'hidden', border:`1px solid ${ts.color}40` }}>
                              <div style={{ background:ts.color, height:10 }}/>
                              {[0,1,2].map(r => (
                                <div key={r} style={{ display:'flex', borderTop:`1px solid ${ts.color}30` }}>
                                  {[0,1,2].map(c => <div key={c} style={{ flex:1, height:9, borderLeft:c>0?`1px solid ${ts.color}25`:'none' }}/>)}
                                </div>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Sections — all cats using sections architecture */}
                    {activeCat.sections && activeCat.sections.map(section => (
                      <div key={section.label} style={{ marginBottom:16 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:t.text }}>{section.label}</div>
                          <button style={{ fontSize:11, color:t.primary, background:'none', border:'none', cursor:'pointer', padding:0, fontWeight:500 }}>See all</button>
                        </div>
                        {section.trackList ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {(section.items||[]).map(track => (
                              <div key={track.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background:t.input, border:`1px solid ${t.border}`, cursor:'pointer' }}>
                                <div style={{ width:36, height:36, borderRadius:8, background:track.grad||'linear-gradient(135deg,#7C5CFC,#5E3ED9)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:12, fontWeight:500, color:t.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{track.label}</div>
                                  <div style={{ fontSize:11, color:t.textMuted }}>{track.artist} • {track.duration}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : section.formCards ? (
                          <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', paddingBottom:4 }}>
                            {(section.items||[]).map(card => (
                              <div key={card.label} style={{ flexShrink:0, width:130, borderRadius:8, border:`1px solid ${t.border}`, overflow:'hidden', background:t.card, cursor:'pointer' }}>
                                <div style={{ padding:'10px 12px', minHeight:72, background:card.bg||t.input, display:'flex', flexDirection:'column', justifyContent:'center', gap:4 }}>
                                  {card.preview}
                                </div>
                                <div style={{ padding:'5px 8px 7px', fontSize:10, color:t.textMuted, fontWeight:500 }}>{card.label}</div>
                              </div>
                            ))}
                          </div>
                        ) : activeCat.id === 'stickers' ? (
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4 }}>
                            {(section.items||[]).map(it => renderCard({...it, catId:activeCat.id}))}
                          </div>
                        ) : (
                          <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', paddingBottom:4 }}>
                            {(section.items||[]).map(it => renderScrollCard({...it, catId:activeCat.id}))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Fallback: flat grid for cats without sections or tableStyles */}
                    {!activeCat.sections && !activeCat.tableStyles && (
                      <div style={{ display:'grid', gridTemplateColumns:`repeat(${activeCat.id==='stickers'?4:3},1fr)`, gap:activeCat.id==='stickers'?4:7 }}>
                        {(activeCat.items||[]).map(it => activeCat.noLabels ? (
                          <button key={it.label} onMouseDown={e=>{e.preventDefault();it.fn&&it.fn();}}
                            style={{ border:`1px solid ${t.border}`, borderRadius:8, overflow:'hidden', background:t.input, cursor:'pointer', padding:0, transition:'border-color 150ms' }}
                            onMouseEnter={e=>e.currentTarget.style.borderColor=t.primaryBorder}
                            onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
                            <div style={{ height:54, background:activeCat.grad, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <svg viewBox="0 0 64 54" width="100%" height="54">{it.svg}</svg>
                            </div>
                          </button>
                        ) : renderCard({...it, catId:activeCat.id}))}
                      </div>
                    )}
                  </div>
                )}
                {/* ── Photos sub-panel ──────────────────────────────────── */}
                {!filtered && !activeCat && elemSubPanel === 'photos' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <button onClick={() => setElemSubPanel(null)}
                      style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:t.text, fontSize:13, fontWeight:600, cursor:'pointer', padding:'2px 0 6px' }}>
                      ← Photos
                    </button>
                    <div style={{ display:'flex', gap:6 }}>
                      <input value={elemPhotosInput} onChange={e => setElemPhotosInput(e.target.value)}
                        onKeyDown={e => { if (e.key==='Enter') { setElemPhotosQuery(elemPhotosInput); loadElemPhotos(elemPhotosInput); } }}
                        placeholder="Search photos…"
                        style={{ flex:1, padding:'8px 10px', borderRadius:7, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, outline:'none' }} />
                      <button onClick={() => { setElemPhotosQuery(elemPhotosInput); loadElemPhotos(elemPhotosInput); }}
                        style={{ padding:'8px 12px', borderRadius:7, background:t.primary, color:'#fff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                        Search
                      </button>
                    </div>
                    {/* Magic recommendations — shown only when no search active */}
                    {elemPhotos.length === 0 && !elemPhotosLoading && !elemPhotosQuery && (
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <span style={{ fontSize:12, fontWeight:600, color:t.text }}>Magic recommendations</span>
                          <button style={{ fontSize:11, color:t.primary, background:'none', border:'none', cursor:'pointer', padding:0, fontWeight:500 }}>See all</button>
                        </div>
                        <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:4 }}>
                          {['linear-gradient(135deg,#d4b896,#c4956a)','linear-gradient(135deg,#c8d6e5,#b0bec5)','linear-gradient(135deg,#a8d8a0,#7bc47b)','linear-gradient(135deg,#f0b8a8,#e88a7a)'].map((g,i) => (
                            <div key={i} style={{ flexShrink:0, width:90, height:60, borderRadius:8, background:g, border:`1px solid ${t.border}` }}/>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Trending label — shown when photos are loaded */}
                    {elemPhotos.length > 0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:12, fontWeight:600, color:t.text }}>Trending</span>
                        <button style={{ fontSize:11, color:t.primary, background:'none', border:'none', cursor:'pointer', padding:0, fontWeight:500 }}>See all</button>
                      </div>
                    )}
                    {elemPhotosLoading ? (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                        {Array.from({length:6}).map((_,i)=>(
                          <div key={i} style={{ borderRadius:8, background:t.input, aspectRatio:'1', animation:'shimmer 1.4s ease-in-out infinite' }} />
                        ))}
                      </div>
                    ) : elemPhotos.length === 0 && elemPhotosQuery ? (
                      <div style={{ textAlign:'center', padding:'30px 0', color:t.textMuted, fontSize:12 }}>
                        <div style={{ fontSize:28, marginBottom:8 }}>📷</div>
                        No photos found
                      </div>
                    ) : elemPhotos.length === 0 ? null : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                        {elemPhotos.map(photo => (
                          <div key={photo.id}
                            onClick={() => addImageElement(photo.url)}
                            style={{ borderRadius:8, overflow:'hidden', cursor:'pointer', border:`1.5px solid transparent`, transition:'border-color 120ms, transform 80ms', aspectRatio:'1' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor=t.primaryBorder; e.currentTarget.style.transform='scale(1.03)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.transform='scale(1)'; }}>
                            <img src={photo.thumbUrl || photo.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', pointerEvents:'none' }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {elemPhotos.length > 0 && (
                      <div style={{ fontSize:10, color:t.textMuted, textAlign:'center' }}>
                        Photos by <a href="https://www.pexels.com" target="_blank" rel="noreferrer" style={{ color:t.primary }}>Pexels</a>
                      </div>
                    )}
                  </div>
                )}
                {/* ── Videos sub-panel ──────────────────────────────────── */}
                {!filtered && !activeCat && elemSubPanel === 'videos' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <button onClick={() => setElemSubPanel(null)}
                      style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:t.text, fontSize:13, fontWeight:600, cursor:'pointer', padding:'2px 0 6px' }}>
                      ← Videos
                    </button>
                    <div style={{ display:'flex', gap:6 }}>
                      <input value={videoInput} onChange={e => setVideoInput(e.target.value)}
                        onKeyDown={e => { if (e.key==='Enter') { setVideoQuery(videoInput); loadElemVideos(videoInput); } }}
                        placeholder="Search videos…"
                        style={{ flex:1, padding:'8px 10px', borderRadius:7, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, outline:'none' }} />
                      <button onClick={() => { setVideoQuery(videoInput); loadElemVideos(videoInput); }}
                        style={{ padding:'8px 12px', borderRadius:7, background:t.primary, color:'#fff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                        Search
                      </button>
                    </div>
                    {/* Trending label — shown when videos are loaded */}
                    {pexelsVideos.length > 0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:12, fontWeight:600, color:t.text }}>Trending</span>
                        <button style={{ fontSize:11, color:t.primary, background:'none', border:'none', cursor:'pointer', padding:0, fontWeight:500 }}>See all</button>
                      </div>
                    )}
                    {videoLoading ? (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                        {Array.from({length:4}).map((_,i)=>(
                          <div key={i} style={{ borderRadius:8, background:t.input, aspectRatio:'16/9', animation:'shimmer 1.4s ease-in-out infinite' }} />
                        ))}
                      </div>
                    ) : pexelsVideos.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'30px 0', color:t.textMuted, fontSize:12 }}>
                        <div style={{ fontSize:28, marginBottom:8 }}>🎬</div>
                        {videoQuery ? 'No videos found' : 'Search for stock videos'}
                      </div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                        {pexelsVideos.map(video => (
                          <div key={video.id}
                            onClick={() => addImageElement(video.thumbnail_url)}
                            title="Click to add video thumbnail to canvas"
                            style={{ borderRadius:8, overflow:'hidden', cursor:'pointer', border:`1.5px solid transparent`, transition:'border-color 120ms, transform 80ms', aspectRatio:'16/9', position:'relative' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor=t.primaryBorder; e.currentTarget.style.transform='scale(1.03)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.transform='scale(1)'; }}>
                            <img src={video.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', pointerEvents:'none' }} />
                            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.25)' }}>
                              <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.9)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <svg viewBox="0 0 12 12" width="11" height="11"><polygon points="3,1 11,6 3,11" fill="#000"/></svg>
                              </div>
                            </div>
                            {video.duration && <div style={{ position:'absolute', bottom:4, right:5, fontSize:9, color:'#fff', background:'rgba(0,0,0,0.6)', borderRadius:3, padding:'1px 4px', fontWeight:600 }}>{Math.round(video.duration)}s</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {pexelsVideos.length > 0 && (
                      <div style={{ fontSize:10, color:t.textMuted, textAlign:'center' }}>
                        Videos by <a href="https://www.pexels.com" target="_blank" rel="noreferrer" style={{ color:t.primary }}>Pexels</a>
                      </div>
                    )}
                  </div>
                )}
                {/* ── Browse Categories (3D app-icon tiles) ─────────────── */}
                {!filtered && !activeCat && !elemSubPanel && (() => {
                  const catTileStyle = (grad) => ({
                    width:'100%', aspectRatio:'1', borderRadius:18, background:grad,
                    boxShadow:'0 6px 16px rgba(0,0,0,0.28), 0 2px 4px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.22)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'transform 120ms, box-shadow 120ms', overflow:'hidden',
                  });
                  const hoverIn = e => { e.currentTarget.style.transform='scale(1.07) translateY(-2px)'; e.currentTarget.style.boxShadow='0 14px 30px rgba(0,0,0,0.32), inset 0 1.5px 0 rgba(255,255,255,0.25)'; };
                  const hoverOut = e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 6px 16px rgba(0,0,0,0.28), 0 2px 4px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.22)'; };
                  const tileBtn = { display:'flex', flexDirection:'column', alignItems:'center', gap:7, background:'none', border:'none', cursor:'pointer', padding:0 };
                  const findCat = (id) => cats.find(c => c.id === id);
                  const catTileButton = (cat) => !cat ? null : (
                    <button key={cat.id} style={tileBtn} onClick={() => setActiveElemCat(cat.id)}>
                      <div style={catTileStyle(cat.grad)} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                        {cat.preview}
                      </div>
                      <span style={{ fontSize:11, color:t.text, fontWeight:500 }}>{cat.label}</span>
                    </button>
                  );
                  return (
                    <>
                      {/* ── Recommended for you ── */}
                      <div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                          <span style={{ fontSize:10, fontWeight:600, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.05em' }}>Recommended for you</span>
                          <button style={{ background:'none', border:'none', color:t.primary, fontSize:11, fontWeight:500, cursor:'pointer', padding:0 }}>See all</button>
                        </div>
                        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
                          {[
                            { label:'Rectangle', fn:()=>addRect(),         grad:'linear-gradient(135deg,#00C4CC,#0099A3)', svg:<rect x="10" y="18" width="34" height="20" rx="2" fill="#fff" opacity=".85"/> },
                            { label:'Circle',    fn:()=>addCircle(),        grad:'linear-gradient(135deg,#7C5CFC,#5E3ED9)', svg:<circle cx="27" cy="28" r="16" fill="#fff" opacity=".85"/> },
                            { label:'Arrow',     fn:()=>addArrow(),         grad:'linear-gradient(135deg,#f59e0b,#d97706)', svg:<><line x1="8" y1="28" x2="38" y2="28" stroke="#fff" strokeWidth="3"/><polygon points="35,21 46,28 35,35" fill="#fff"/></> },
                            { label:'Star',      fn:()=>addStar(),          grad:'linear-gradient(135deg,#ef4444,#dc2626)', svg:<polygon points="27,9 30,20 42,20 32,27 36,39 27,32 18,39 22,27 12,20 24,20" fill="#fff" opacity=".85"/> },
                            { label:'Text',      fn:()=>addText(),          grad:'linear-gradient(135deg,#3b82f6,#1d4ed8)', svg:<text x="27" y="34" fill="#fff" fontSize="24" textAnchor="middle" fontWeight="bold" opacity=".9">T</text> },
                            { label:'Line',      fn:()=>addLine(),          grad:'linear-gradient(135deg,#22c55e,#16a34a)', svg:<line x1="8" y1="28" x2="46" y2="28" stroke="#fff" strokeWidth="3" strokeLinecap="round"/> },
                          ].map(rec => (
                            <button key={rec.label} onMouseDown={e => { e.preventDefault(); rec.fn(); }}
                              title={rec.label}
                              style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                              <div style={{ width:56, height:56, borderRadius:14, background:rec.grad, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 10px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.18)', transition:'transform 120ms' }}
                                onMouseEnter={e => { e.currentTarget.style.transform='scale(1.07) translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; }}>
                                <svg viewBox="0 0 54 56" width="36" height="36">{rec.svg}</svg>
                              </div>
                              <span style={{ fontSize:10, color:t.text, fontWeight:500 }}>{rec.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ fontSize:12, fontWeight:600, color:t.text }}>Browse categories</div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                        {/* Row 1: Shapes · Graphics · Animations */}
                        {catTileButton(findCat('shapes'))}
                        {catTileButton(findCat('graphics'))}
                        {catTileButton(findCat('animations'))}
                        {/* Row 2: Photos · Videos · Audio */}
                        <button style={tileBtn} onClick={() => { setElemSubPanel('photos'); if(elemPhotos.length===0) loadElemPhotos(); }}>
                          <div style={catTileStyle('linear-gradient(145deg,#5b86e5,#36d1dc)')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                            <svg viewBox="0 0 54 54" width="38" height="38">
                              <rect x="8" y="15" width="38" height="27" rx="4" fill="rgba(255,255,255,0.18)"/>
                              <rect x="8" y="15" width="38" height="8" rx="4" fill="rgba(255,255,255,0.32)"/>
                              <circle cx="21" cy="31" r="7" fill="rgba(255,255,255,0.55)"/>
                              <circle cx="21" cy="31" r="4" fill="#5b86e5" opacity=".5"/>
                              <polygon points="10,41 24,27 33,35 39,27 46,38 46,42 10,42" fill="rgba(255,255,255,0.72)"/>
                              <rect x="21" y="8" width="12" height="8" rx="2" fill="rgba(255,255,255,0.48)"/>
                              <circle cx="27" cy="12" r="2" fill="rgba(255,255,255,0.85)"/>
                            </svg>
                          </div>
                          <span style={{ fontSize:11, color:t.text, fontWeight:500 }}>Photos</span>
                        </button>
                        <button style={tileBtn} onClick={() => { setElemSubPanel('videos'); if(pexelsVideos.length===0) loadElemVideos(); }}>
                          <div style={catTileStyle('linear-gradient(145deg,#a855f7,#f43f5e)')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                            <svg viewBox="0 0 54 54" width="38" height="38">
                              <rect x="6" y="13" width="42" height="28" rx="5" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/>
                              <polygon points="22,19 22,35 38,27" fill="rgba(255,255,255,0.88)"/>
                              <rect x="6" y="8" width="5" height="5" rx="1" fill="rgba(255,255,255,0.5)"/>
                              <rect x="13" y="8" width="5" height="5" rx="1" fill="rgba(255,255,255,0.5)"/>
                              <rect x="20" y="8" width="5" height="5" rx="1" fill="rgba(255,255,255,0.5)"/>
                              <rect x="27" y="8" width="5" height="5" rx="1" fill="rgba(255,255,255,0.5)"/>
                              <rect x="34" y="8" width="5" height="5" rx="1" fill="rgba(255,255,255,0.5)"/>
                              <rect x="41" y="8" width="7" height="5" rx="1" fill="rgba(255,255,255,0.5)"/>
                            </svg>
                          </div>
                          <span style={{ fontSize:11, color:t.text, fontWeight:500 }}>Videos</span>
                        </button>
                        {catTileButton(findCat('audio'))}
                        {/* Row 3: Charts · Forms · Sheets */}
                        {catTileButton(findCat('charts'))}
                        {catTileButton(findCat('forms'))}
                        {catTileButton(findCat('sheets'))}
                        {/* Row 4: Tables · Frames · Grids */}
                        {catTileButton(findCat('tables'))}
                        {catTileButton(findCat('frames'))}
                        {catTileButton(findCat('grids'))}
                        {/* Row 5: Mockups · 3D */}
                        {catTileButton(findCat('mockups'))}
                        {catTileButton(findCat('3d'))}
                        {/* Extra ItsPosting categories */}
                        {cats.filter(c => !['shapes','graphics','animations','audio','charts','forms','sheets','tables','frames','grids','mockups','3d'].includes(c.id)).map(cat => catTileButton(cat))}
                      </div>
                      <div style={{ fontSize:12, fontWeight:600, color:t.textMuted, marginTop:4 }}>Quick Add</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {[
                          { label:'▭ Rect',     fn:()=>addRect()        },
                          { label:'● Circle',   fn:()=>addCircle()      },
                          { label:'▲ Triangle', fn:()=>addTriangle()    },
                          { label:'★ Star',     fn:()=>addStar()        },
                          { label:'→ Arrow',    fn:()=>addArrow()       },
                          { label:'─ Line',     fn:()=>addLine()        },
                          { label:'T Text',     fn:()=>addText()        },
                          { label:'💬 Speech',  fn:()=>addSpeechBubble()},
                        ].map(q => (
                          <button key={q.label} onMouseDown={e => { e.preventDefault(); q.fn(); }}
                            style={{ padding:'5px 9px', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:11, cursor:'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.background=t.primaryBg; e.currentTarget.style.borderColor=t.primaryBorder; }}
                            onMouseLeave={e => { e.currentTarget.style.background=t.input; e.currentTarget.style.borderColor=t.border; }}>
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}
                {/* Properties panel for selected shape */}
                {selectedEl && !['text','image'].includes(selectedEl.type) && (
                  <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:12, marginTop:4 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Fill</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
                      {COLOR_PALETTE.map(hex => (
                        <button key={hex} onMouseDown={e => { e.preventDefault(); handleElementChange({...selectedEl, fill:hex}); pickColor(hex, ()=>{}); }}
                          style={{ width:22, height:22, borderRadius:5, background:hex, border:selectedEl.fill===hex?`2.5px solid ${t.primary}`:`1px solid ${t.border}`, cursor:'pointer', flexShrink:0 }} />
                      ))}
                      <input type="color" value={selectedEl.fill||'#ffffff'}
                        onChange={e => updateElement({...selectedEl, fill:e.target.value})}
                        onBlur={e => { pushHistory(); pickColor(e.target.value, ()=>{}); }}
                        style={{ width:22, height:22, borderRadius:5, border:`1px solid ${t.border}`, cursor:'pointer', padding:1, flexShrink:0 }} />
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap' }}>Opacity</span>
                      <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity!==undefined?selectedEl.opacity:1}
                        onChange={e => updateElement({...selectedEl, opacity:parseFloat(e.target.value)})}
                        onMouseUp={()=>pushHistory()} style={{ flex:1, accentColor:t.primary }} />
                      <span style={{ fontSize:11, color:t.textMuted, width:28, textAlign:'right' }}>{Math.round((selectedEl.opacity!==undefined?selectedEl.opacity:1)*100)}%</span>
                    </div>
                    {selectedEl.type==='pricetag' && (
                      <div style={{ marginTop:12 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Features</div>
                        {(selectedEl.ptFeatures||[]).map((f,i) => (
                          <div key={i} style={{ display:'flex', gap:4, marginBottom:5, alignItems:'center' }}>
                            <input value={f} onChange={e => { const arr=[...(selectedEl.ptFeatures||[])]; arr[i]=e.target.value; updateElement({...selectedEl,ptFeatures:arr}); }} onBlur={()=>pushHistory()}
                              style={{ flex:1, padding:'4px 8px', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, outline:'none' }} />
                            <button onClick={() => { const arr=(selectedEl.ptFeatures||[]).filter((_,j)=>j!==i); pushHistory(); updateElement({...selectedEl,ptFeatures:arr}); }}
                              style={{ width:22, height:22, border:'none', borderRadius:5, background:'transparent', color:t.textMuted, cursor:'pointer', fontSize:14, flexShrink:0 }}>×</button>
                          </div>
                        ))}
                        {(selectedEl.ptFeatures||[]).length<6 && (
                          <button onClick={() => { pushHistory(); updateElement({...selectedEl,ptFeatures:[...(selectedEl.ptFeatures||[]),'New feature']}); }}
                            style={{ width:'100%', padding:'5px', border:`1px dashed ${t.border}`, borderRadius:6, background:'transparent', color:t.textMuted, fontSize:11, cursor:'pointer' }}>+ Add feature</button>
                        )}
                      </div>
                    )}
                    {selectedEl.type==='htimeline' && (
                      <div style={{ marginTop:12 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Steps</div>
                        {(selectedEl.tlSteps||[]).map((s,i) => (
                          <div key={i} style={{ display:'flex', gap:4, marginBottom:5, alignItems:'center' }}>
                            <span style={{ fontSize:11, color:t.textMuted, width:16, flexShrink:0 }}>{i+1}</span>
                            <input value={s} onChange={e => { const arr=[...(selectedEl.tlSteps||[])]; arr[i]=e.target.value; updateElement({...selectedEl,tlSteps:arr}); }} onBlur={()=>pushHistory()}
                              style={{ flex:1, padding:'4px 8px', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, outline:'none' }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedEl.type==='comparison' && (
                      <div style={{ marginTop:12 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Rows</div>
                        {(selectedEl.cpRows||[]).map((row,i) => (
                          <div key={i} style={{ display:'flex', gap:4, marginBottom:5, alignItems:'center' }}>
                            <input value={row.col1||''} onChange={e => { const arr=[...(selectedEl.cpRows||[])]; arr[i]={...arr[i],col1:e.target.value}; updateElement({...selectedEl,cpRows:arr}); }} onBlur={()=>pushHistory()}
                              style={{ flex:1, padding:'4px 6px', borderRadius:5, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:11, outline:'none' }} />
                            <input value={row.col2||''} onChange={e => { const arr=[...(selectedEl.cpRows||[])]; arr[i]={...arr[i],col2:e.target.value}; updateElement({...selectedEl,cpRows:arr}); }} onBlur={()=>pushHistory()}
                              style={{ flex:1, padding:'4px 6px', borderRadius:5, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:11, outline:'none' }} />
                            <button onClick={() => { const arr=(selectedEl.cpRows||[]).filter((_,j)=>j!==i); pushHistory(); updateElement({...selectedEl,cpRows:arr}); }}
                              style={{ width:20, height:20, border:'none', borderRadius:4, background:'transparent', color:t.textMuted, cursor:'pointer', fontSize:14, flexShrink:0 }}>×</button>
                          </div>
                        ))}
                        {(selectedEl.cpRows||[]).length<6 && (
                          <button onClick={() => { pushHistory(); updateElement({...selectedEl,cpRows:[...(selectedEl.cpRows||[]),{col1:'✗ Them',col2:'✓ Us'}]}); }}
                            style={{ width:'100%', padding:'5px', border:`1px dashed ${t.border}`, borderRadius:6, background:'transparent', color:t.textMuted, fontSize:11, cursor:'pointer' }}>+ Add row</button>
                        )}
                      </div>
                    )}
                    {selectedEl.type==='steplist' && (
                      <div style={{ marginTop:12 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Steps</div>
                        {(selectedEl.steps||['Step one','Step two','Step three']).map((s,i) => (
                          <div key={i} style={{ display:'flex', gap:4, marginBottom:5, alignItems:'center' }}>
                            <span style={{ fontSize:11, color:t.textMuted, width:16, flexShrink:0 }}>{i+1}</span>
                            <input value={s} onChange={e => { const arr=[...(selectedEl.steps||['Step one','Step two','Step three'])]; arr[i]=e.target.value; updateElement({...selectedEl,steps:arr}); }} onBlur={()=>pushHistory()}
                              style={{ flex:1, padding:'4px 8px', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, outline:'none' }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })()}

            {/* FILTERS */}
            {activeLeftTool === 'filters' && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 10 }}>Filter Presets</div>
                {bgType !== 'image' && <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>Select a photo background first</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {Object.keys(FILTER_PRESETS).map(key => (
                    <button key={key} onClick={() => applyFilterPreset(key)}
                      style={{ padding: '8px 0', borderRadius: 7, border: `1px solid ${bgFilter === key ? t.primary : t.border}`, background: bgFilter === key ? t.primaryBg : t.input, color: bgFilter === key ? t.primary : t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ADJUST */}
            {activeLeftTool === 'adjust' && (
              <div>
                {bgType !== 'image' && <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>Select a photo background to adjust</div>}
                {[
                  { label: 'Brightness', value: bgBrightness, min: -1,   max: 1,   step: 0.05, key: 'bgBrightness' },
                  { label: 'Contrast',   value: bgContrast,   min: -100, max: 100, step: 5,    key: 'bgContrast'   },
                  { label: 'Saturation', value: bgSaturation, min: -1,   max: 1,   step: 0.05, key: 'bgSaturation' },
                ].map(({ label, value, min, max, step, key }) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>{label}</label>
                      <span style={{ fontSize: 11, color: t.textMuted }}>{value}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={value}
                      onChange={e => patchPage({ [key]: parseFloat(e.target.value) })}
                      onMouseUp={() => { patchPage({ bgFilter: 'normal' }); pushHistory(); }}
                      style={{ width: '100%' }} />
                  </div>
                ))}
              </div>
            )}

            {/* BRAND */}
            {activeLeftTool === 'brand' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Brand panel top navigation — search + All Brand Templates + Brand Kit ▾ */}
                <div style={{ padding: '0 0 8px', flexShrink: 0 }}>
                  {/* Search */}
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <IpSearch size={14} color={t.textMuted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input placeholder="Search" style={{ width: '100%', height: 36, paddingLeft: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  {/* All Brand Templates */}
                  <button style={{ width: '100%', height: 36, display: 'flex', alignItems: 'center', paddingLeft: 4, border: 'none', background: 'transparent', color: TEAL, fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 6, textAlign: 'left', transition: 'background 120ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    All Brand Templates
                  </button>
                  <div style={{ width: '100%', height: 1, background: t.border, margin: '8px 0' }} />
                  {/* Brand Kit ▾ dropdown */}
                  <button style={{ width: '100%', height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', border: `1px solid ${t.border}`, borderRadius: 8, background: t.input, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'border-color 120ms', boxSizing: 'border-box' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = t.primaryBorder}
                    onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                    <span style={{ flex: 1, textAlign: 'left' }}>Brand Kit</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {/* Sub-category navigation list */}
                  <div style={{ marginTop: 4 }}>
                    {[
                      { label: 'All assets',       color: TEAL      },
                      { label: 'Guidelines',        color: '#5BA3F5' },
                      { label: 'Brand Templates',   color: '#5BA3F5', badge: 'New' },
                      { label: 'Logos',             color: '#5BA3F5' },
                      { label: 'Colors',            color: '#5BA3F5' },
                      { label: 'Fonts',             color: '#F59E0B' },
                      { label: 'Brand voice',       color: '#5BA3F5' },
                      { label: 'Photos',            color: '#A855F7' },
                      { label: 'Components',        color: '#5BA3F5' },
                      { label: 'Graphics',          color: '#5BA3F5' },
                      { label: 'Icons',             color: '#F59E0B' },
                      { label: 'Charts',            color: '#5BA3F5' },
                    ].map((item) => {
                      const isActive = activeBrandItem === item.label;
                      return (
                        <button key={item.label} onClick={() => setActiveBrandItem(item.label)}
                          style={{ width: '100%', height: 34, display: 'flex', alignItems: 'center', paddingLeft: isActive ? 10 : 8, paddingRight: isActive ? 10 : 8, border: 'none', borderRadius: 20, background: isActive ? t.primaryBg : 'transparent', color: isActive ? t.primary : t.text, fontSize: 13, fontWeight: isActive ? 600 : 400, cursor: 'pointer', textAlign: 'left', transition: 'background 120ms' }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = t.cardHover; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                          {item.label}
                          {item.badge && (
                            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: t.primary, color: '#fff', padding: '1px 6px', borderRadius: 10, lineHeight: 1.6, flexShrink: 0 }}>{item.badge}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {brandLoading && (
                  <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 13, padding: '30px 0' }}>Loading your brand…</div>
                )}
                {!brandLoading && (() => {
                  const bc = brandProfile?.brand_colors || {};
                  const brandPrimary   = bc.primary   || '#00C4CC';
                  const brandSecondary = bc.secondary || '#7C5CFC';
                  const brandAccent    = bc.accent    || '#1a1a2e';
                  const swatches = [
                    { label: 'Primary',   hex: brandPrimary   },
                    { label: 'Secondary', hex: brandSecondary },
                    { label: 'Accent',    hex: brandAccent    },
                  ];
                  const brandFonts = [
                    { role: 'Heading',    fontFamily: 'Bebas Neue', previewSize: 22, overrides: { fontSize: 64, fontFamily: 'Bebas Neue', fontStyle: 'normal', text: 'Service Announcement', letterSpacing: 2, fill: brandPrimary } },
                    { role: 'Subheading', fontFamily: 'Montserrat', previewSize: 14, overrides: { fontSize: 36, fontFamily: 'Montserrat', fontStyle: 'bold',   text: 'Your Local Expert', fill: brandPrimary } },
                    { role: 'Body',       fontFamily: 'Inter',      previewSize: 11, overrides: { fontSize: 20, fontFamily: 'Inter',       fontStyle: 'normal', text: 'Professional service you can trust', fill: brandPrimary } },
                  ];
                  return (
                    <div style={{ flex: 1, overflowY: 'auto' }}>

                      {/* S1: Brand Logo */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Brand Logo</div>
                        {brandProfile?.logo_url ? (
                          <>
                            <div onMouseDown={e => { e.preventDefault(); addImageElement(brandProfile.logo_url); }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = t.primaryBorder}
                              onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
                              style={{ width: '100%', background: t.input, borderRadius: 10, border: `1px solid ${t.border}`, padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80, transition: 'border-color 0.15s', boxSizing: 'border-box' }}>
                              <img src={brandProfile.logo_url} alt="Brand logo" style={{ maxWidth: '100%', maxHeight: 70, objectFit: 'contain' }} />
                            </div>
                            <div style={{ fontSize: 10, color: t.textMuted, textAlign: 'center', marginTop: 5 }}>Click to add to canvas</div>
                          </>
                        ) : (
                          <div style={{ background: t.input, borderRadius: 10, border: `1px dashed ${t.border}`, padding: '18px', textAlign: 'center', color: t.textMuted, fontSize: 12 }}>
                            No logo yet — go to <span style={{ color: t.primary }}>Settings</span> to add one
                          </div>
                        )}
                      </div>

                      {/* S2: Brand Colors */}
                      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Brand Colors</div>
                          <button onClick={() => router.push('/settings')} style={{ background: 'none', border: 'none', color: t.primary, fontSize: 11, cursor: 'pointer', padding: 0, fontWeight: 600 }}>Edit</button>
                        </div>
                        {/* Large swatches row */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          {swatches.map(s => (
                            <div key={s.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}
                              onMouseDown={e => { e.preventDefault(); if (selectedEl) handleElementChange({ ...selectedEl, fill: s.hex }); }}>
                              <div
                                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = `0 0 0 2px ${t.primaryBorder}`; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                                title={`Apply ${s.label} (${s.hex})`}
                                style={{ width: '100%', height: 48, borderRadius: 8, background: s.hex, border: `1.5px solid ${t.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.18)', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }} />
                              <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
                                <div style={{ fontSize: 9, fontWeight: 600, color: t.textMuted }}>{s.label}</div>
                                <div style={{ fontSize: 9, color: t.textMuted, fontFamily: 'monospace', opacity: 0.7 }}>{s.hex}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Quick color chips: all brand colors */}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {[brandPrimary, brandSecondary, brandAccent, '#ffffff', '#000000', '#f1f5f9', '#0f172a'].map(hex => (
                            <button key={hex}
                              onMouseDown={e => { e.preventDefault(); if (selectedEl) handleElementChange({ ...selectedEl, fill: hex }); }}
                              title={hex}
                              style={{ width: 24, height: 24, borderRadius: 6, background: hex, border: `1.5px solid ${t.border}`, cursor: 'pointer', flexShrink: 0, transition: 'transform 100ms' }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                              onMouseLeave={e => e.currentTarget.style.transform = ''} />
                          ))}
                        </div>
                      </div>

                      {/* S3: Brand Fonts */}
                      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Brand Fonts</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {brandFonts.map(f => (
                            <button key={f.role} onMouseDown={e => { e.preventDefault(); addText(f.overrides); }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; }}
                              style={{ width: '100%', padding: 0, borderRadius: 9, border: `1px solid ${t.border}`, background: t.input, cursor: 'pointer', overflow: 'hidden', textAlign: 'left', transition: 'border-color 150ms' }}>
                              <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${t.border}`, background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                                <span style={{ fontFamily: f.fontFamily, fontSize: f.previewSize, fontWeight: f.previewSize > 18 ? 400 : 700, color: t.text, display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{f.role}</span>
                              </div>
                              <div style={{ padding: '4px 10px 5px', fontSize: 9, color: t.textMuted }}>{f.role} · {f.fontFamily}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* S4: Brand Voice */}
                      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Brand Voice</div>
                        <div style={{ background: t.input, borderRadius: 10, border: `1px solid ${t.border}`, padding: '12px 14px', marginBottom: 10 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 8, fontFamily: 'Montserrat', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {brandProfile?.business_name || 'Your Business'}
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {brandProfile?.tone && (
                              <span style={{ fontSize: 10, background: t.primaryBg, color: t.primary, padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>{brandProfile.tone}</span>
                            )}
                            {brandProfile?.visual_style && (
                              <span style={{ fontSize: 10, background: 'rgba(124,92,252,0.12)', color: '#7C5CFC', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>{brandProfile.visual_style}</span>
                            )}
                            {brandProfile?.industry && (
                              <span style={{ fontSize: 10, background: 'transparent', color: t.textMuted, padding: '3px 8px', borderRadius: 20, border: `1px solid ${t.border}` }}>{brandProfile.industry}</span>
                            )}
                          </div>
                        </div>
                        <button style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: `1.5px solid ${t.primaryBorder}`, background: 'transparent', color: t.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <IpSparkle size={14} /> PostCore Write
                        </button>
                      </div>

                    </div>
                  );
                })()}
              </div>
            )}

            {/* LAYERS */}
            {activeLeftTool === 'layers' && (() => {
              // Reversed so top of list = visually front element
              const layerEls = [...elements].reverse();
              const typeIcon = type => type === 'text' ? 'T' : type === 'image' ? '🖼' : type === 'group' ? '⊞' : '▭';
              const typeName = (el, i) => {
                if (el.text) return el.text.slice(0, 22) + (el.text.length > 22 ? '…' : '');
                return el.type === 'image' ? `Image ${i + 1}` : el.type === 'group' ? `Group ${i + 1}` : `Shape ${i + 1}`;
              };
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>
                      Page {activePage + 1} — {elements.length} element{elements.length !== 1 ? 's' : ''}
                    </span>
                    {selectedId && (
                      <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', fontSize: 11, color: t.textMuted, cursor: 'pointer' }}>Deselect</button>
                    )}
                  </div>
                  {layerEls.length === 0 && (
                    <div style={{ textAlign: 'center', color: t.textMuted, padding: '28px 0', fontSize: 12 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>▥</div>
                      No elements on this page yet
                    </div>
                  )}
                  {layerEls.map((el, i) => {
                    const isSelected = selectedId === el.id || selectedIds.includes(el.id);
                    const isHidden = hiddenIds.has(el.id);
                    const isLocked = lockedIds.has(el.id);
                    return (
                      <div key={el.id}
                        draggable
                        onDragStart={() => setLayerDragId(el.id)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => {
                          if (!layerDragId || layerDragId === el.id) return;
                          pushHistory();
                          patchElements(prev => {
                            const from = prev.findIndex(e => e.id === layerDragId);
                            const toEl = prev.findIndex(e => e.id === el.id);
                            if (from < 0 || toEl < 0) return prev;
                            const arr = [...prev];
                            const [moved] = arr.splice(from, 1);
                            arr.splice(toEl, 0, moved);
                            return arr;
                          });
                          setLayerDragId(null);
                        }}
                        onDragEnd={() => setLayerDragId(null)}
                        onClick={() => { setSelectedId(el.id); setSelectedIds([el.id]); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 8px', borderRadius: 7,
                          background: isSelected ? t.primaryBg : layerDragId === el.id ? t.input : 'transparent',
                          border: `1px solid ${isSelected ? t.primaryBorder : 'transparent'}`,
                          cursor: 'grab', opacity: isHidden ? 0.4 : 1,
                          transition: 'background 80ms, border-color 80ms',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = t.input; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0, color: isSelected ? t.primary : t.textMuted }}>
                          {typeIcon(el.type)}
                        </span>
                        <span style={{ flex: 1, fontSize: 12, color: isSelected ? t.text : t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {typeName(el, layerEls.length - 1 - i)}
                        </span>
                        <button onClick={e => { e.stopPropagation(); toggleHidden(el.id); }}
                          title={isHidden ? 'Show element' : 'Hide element'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isHidden ? t.textMuted : t.text, fontSize: 13, padding: '0 2px', flexShrink: 0, opacity: isHidden ? 0.5 : 0.75 }}>
                          {isHidden ? '🙈' : '👁'}
                        </button>
                        <button onClick={e => { e.stopPropagation(); toggleLocked(el.id); }}
                          title={isLocked ? 'Unlock element' : 'Lock element'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLocked ? '#FFB800' : t.textMuted, fontSize: 12, padding: '0 2px', flexShrink: 0 }}>
                          {isLocked ? '🔒' : '🔓'}
                        </button>
                      </div>
                    );
                  })}
                  {elements.length > 0 && (
                    <div style={{ marginTop: 10, padding: '8px 0', borderTop: `1px solid ${t.border}`, fontSize: 11, color: t.textMuted, textAlign: 'center' }}>
                      Drag rows to reorder · Click to select
                    </div>
                  )}
                </div>
              );
            })()}

            {/* POSITION / ARRANGE */}
            {activeLeftTool === 'position' && (() => {
              const SHP = { fontSize: 10, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 16 };
              const alignEl = (axis, mode) => {
                if (!stageRef.current || !selectedId) return;
                const node = stageRef.current.findOne(`#${selectedId}`);
                if (!node) return;
                const scale = stageRef.current.width() / canvasSize.w;
                const br = node.getClientRect({ relativeTo: stageRef.current });
                const elW = br.width / scale;
                const elH = br.height / scale;
                const elX = br.x / scale;
                const elY = br.y / scale;
                pushHistory();
                if (axis === 'h') {
                  let delta;
                  if (mode === 'left')   delta = -elX;
                  if (mode === 'center') delta = canvasSize.w / 2 - (elX + elW / 2);
                  if (mode === 'right')  delta = canvasSize.w - (elX + elW);
                  updateElement({ ...selectedEl, x: Math.round(selectedEl.x + delta) });
                } else {
                  let delta;
                  if (mode === 'top')    delta = -elY;
                  if (mode === 'middle') delta = canvasSize.h / 2 - (elY + elH / 2);
                  if (mode === 'bottom') delta = canvasSize.h - (elY + elH);
                  updateElement({ ...selectedEl, y: Math.round(selectedEl.y + delta) });
                }
              };
              const abtn = (title, children, onClick) => (
                <button key={title} onClick={onClick} title={title}
                  style={{ flex: 1, height: 32, border: `1px solid ${t.border}`, borderRadius: 7, background: t.input, color: t.textSecondary, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.background = t.primaryBg; e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                  onMouseLeave={e => { e.currentTarget.style.background = t.input; e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; }}>
                  {children}
                </button>
              );
              const posinp = { width: '100%', padding: '6px 8px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, boxSizing: 'border-box', outline: 'none' };
              const poslbl = { fontSize: 11, fontWeight: 500, color: t.textMuted, display: 'block', marginBottom: 4 };
              const hasSz = selectedEl && ['rect','image','arrow','circle','shape','draw','progressbar','chart','table','badge','glasspane','testimonial','socialstats','coupon','beforeafter','comparison','sticker'].includes(selectedEl.type);
              const layerEls = [...elements].reverse();
              const typeIcon = type => type === 'text' ? 'T' : type === 'image' ? '🖼' : type === 'group' ? '⊞' : '▭';
              const typeName = (el, i) => {
                if (el.text) return el.text.slice(0, 22) + (el.text.length > 22 ? '…' : '');
                return el.type === 'image' ? `Image ${i + 1}` : el.type === 'group' ? `Group ${i + 1}` : `Shape ${i + 1}`;
              };
              return (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Tab bar */}
                  <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, marginBottom: 4, marginTop: -4 }}>
                    {['arrange','layers'].map(tab => (
                      <button key={tab} onClick={() => setPositionTab(tab)}
                        style={{ flex: 1, height: 38, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: positionTab === tab ? 600 : 400, color: positionTab === tab ? t.primary : t.textMuted, borderBottom: positionTab === tab ? `2px solid ${t.primary}` : '2px solid transparent', transition: 'all 120ms ease', textTransform: 'capitalize' }}>
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* ── ARRANGE TAB ── */}
                  {positionTab === 'arrange' && (
                    <div>
                      <div style={SHP}>Arrange</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                        {[
                          { label: 'Forward',  fn: () => bringForward(selectedId) },
                          { label: 'Backward', fn: () => sendBackward(selectedId) },
                          { label: 'To Front', fn: () => bringToFront(selectedId) },
                          { label: 'To Back',  fn: () => sendToBack(selectedId) },
                        ].map(({ label: lbl2, fn }) => (
                          <button key={lbl2} onClick={fn}
                            style={{ height: 32, border: `1px solid ${t.border}`, borderRadius: 7, background: t.input, color: t.text, fontSize: 12, cursor: 'pointer', fontWeight: 500, transition: 'all 100ms ease' }}
                            onMouseEnter={e => { e.currentTarget.style.background = t.primaryBg; e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                            onMouseLeave={e => { e.currentTarget.style.background = t.input; e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.text; }}>
                            {lbl2}
                          </button>
                        ))}
                      </div>

                      <div style={SHP}>Align to page</div>
                      {selectedId ? (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                          {abtn('Align left',   <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="1.5" height="10" rx="0.75" fill="currentColor"/><rect x="3" y="3.5" width="7" height="3" rx="1" fill="currentColor" opacity=".6"/><rect x="3" y="7.5" width="5" height="3" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('h','left'))}
                          {abtn('Align center', <svg width="14" height="14" viewBox="0 0 14 14"><rect x="6.25" y="1" width="1.5" height="12" rx="0.75" fill="currentColor"/><rect x="2" y="3" width="10" height="3" rx="1" fill="currentColor" opacity=".6"/><rect x="3.5" y="8" width="7" height="3" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('h','center'))}
                          {abtn('Align right',  <svg width="14" height="14" viewBox="0 0 14 14"><rect x="11.5" y="2" width="1.5" height="10" rx="0.75" fill="currentColor"/><rect x="4" y="3.5" width="7" height="3" rx="1" fill="currentColor" opacity=".6"/><rect x="6" y="7.5" width="5" height="3" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('h','right'))}
                          {abtn('Align top',    <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="10" height="1.5" rx="0.75" fill="currentColor"/><rect x="3" y="3" width="3" height="7" rx="1" fill="currentColor" opacity=".6"/><rect x="8" y="3" width="3" height="5" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('v','top'))}
                          {abtn('Align middle', <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="6.25" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor" opacity=".6"/><rect x="8" y="3.5" width="3" height="7" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('v','middle'))}
                          {abtn('Align bottom', <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="11.5" width="10" height="1.5" rx="0.75" fill="currentColor"/><rect x="3" y="4" width="3" height="7" rx="1" fill="currentColor" opacity=".6"/><rect x="8" y="6" width="3" height="5" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('v','bottom'))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Select an element to align it</div>
                      )}

                      {selectedEl && (
                        <>
                          <div style={SHP}>Position & Size</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 4 }}>
                            <div><label style={poslbl}>X</label>
                              <input type="number" value={Math.round(selectedEl.x)} onChange={e => updateElement({ ...selectedEl, x: +e.target.value || 0 })} onBlur={() => pushHistory()} style={posinp} /></div>
                            <div><label style={poslbl}>Y</label>
                              <input type="number" value={Math.round(selectedEl.y)} onChange={e => updateElement({ ...selectedEl, y: +e.target.value || 0 })} onBlur={() => pushHistory()} style={posinp} /></div>
                            {hasSz && <>
                              <div style={{ gridColumn:'1/-1', display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:4, alignItems:'flex-end' }}>
                                <div><label style={poslbl}>W</label>
                                  <input type="number" value={Math.round(selectedEl.width || 0)}
                                    onChange={e => {
                                      const w = +e.target.value || 1;
                                      const h = ratioLocked && selectedEl.width
                                        ? Math.round(w * ((selectedEl.height || selectedEl.width) / selectedEl.width))
                                        : (selectedEl.height || selectedEl.width || 0);
                                      updateElement({ ...selectedEl, width: w, height: h });
                                    }}
                                    onBlur={() => pushHistory()} style={posinp} /></div>
                                <button
                                  title={ratioLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                                  onClick={() => setRatioLocked(r => !r)}
                                  style={{ width:24, height:32, display:'flex', alignItems:'center', justifyContent:'center', background:ratioLocked ? t.primaryBg : t.input, border:`1px solid ${ratioLocked ? t.primaryBorder : t.border}`, borderRadius:6, cursor:'pointer', flexShrink:0, transition:'all 150ms' }}>
                                  <svg width="11" height="13" viewBox="0 0 24 24" fill="none" stroke={ratioLocked ? t.primary : t.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                                    {ratioLocked
                                      ? <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                      : <path d="M7 11V6a5 5 0 0 1 9.9-1" opacity=".35"/>}
                                  </svg>
                                </button>
                                <div><label style={poslbl}>H</label>
                                  <input type="number" value={Math.round(selectedEl.height || selectedEl.width || 0)}
                                    onChange={e => {
                                      const h = +e.target.value || 1;
                                      const w = ratioLocked && (selectedEl.height || selectedEl.width)
                                        ? Math.round(h * (selectedEl.width / (selectedEl.height || selectedEl.width)))
                                        : (selectedEl.width || 0);
                                      updateElement({ ...selectedEl, height: h, width: w });
                                    }}
                                    onBlur={() => pushHistory()} style={posinp} /></div>
                              </div>
                            </>}
                            <div style={{ gridColumn: '1/-1' }}>
                              <label style={poslbl}>Rotation °</label>
                              <input type="number" value={Math.round(selectedEl.rotation || 0)} min={-360} max={360}
                                onChange={e => updateElement({ ...selectedEl, rotation: +e.target.value || 0 })} onBlur={() => pushHistory()} style={posinp} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── LAYERS TAB ── */}
                  {positionTab === 'layers' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>
                          Page {activePage + 1} — {elements.length} element{elements.length !== 1 ? 's' : ''}
                        </span>
                        {selectedId && (
                          <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', fontSize: 11, color: t.textMuted, cursor: 'pointer' }}>Deselect</button>
                        )}
                      </div>
                      {layerEls.length === 0 && (
                        <div style={{ textAlign: 'center', color: t.textMuted, padding: '28px 0', fontSize: 12 }}>
                          <div style={{ fontSize: 28, marginBottom: 8 }}>▥</div>
                          No elements on this page yet
                        </div>
                      )}
                      {layerEls.map((el, i) => {
                        const isSelected = selectedId === el.id || selectedIds.includes(el.id);
                        const isHidden = hiddenIds.has(el.id);
                        const isLocked = lockedIds.has(el.id);
                        return (
                          <div key={el.id}
                            draggable
                            onDragStart={() => setLayerDragId(el.id)}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => {
                              if (!layerDragId || layerDragId === el.id) return;
                              pushHistory();
                              patchElements(prev => {
                                const from = prev.findIndex(e => e.id === layerDragId);
                                const toEl = prev.findIndex(e => e.id === el.id);
                                if (from < 0 || toEl < 0) return prev;
                                const arr = [...prev];
                                const [moved] = arr.splice(from, 1);
                                arr.splice(toEl, 0, moved);
                                return arr;
                              });
                              setLayerDragId(null);
                            }}
                            onDragEnd={() => setLayerDragId(null)}
                            onClick={() => { setSelectedId(el.id); setSelectedIds([el.id]); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '7px 8px', borderRadius: 7,
                              background: isSelected ? t.primaryBg : layerDragId === el.id ? t.input : 'transparent',
                              border: `1px solid ${isSelected ? t.primaryBorder : 'transparent'}`,
                              cursor: 'grab', opacity: isHidden ? 0.4 : 1,
                              transition: 'background 80ms, border-color 80ms',
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = t.input; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <span style={{ fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0, color: isSelected ? t.primary : t.textMuted }}>
                              {typeIcon(el.type)}
                            </span>
                            <span style={{ flex: 1, fontSize: 12, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {typeName(el, layerEls.length - 1 - i)}
                            </span>
                            <button onClick={e => { e.stopPropagation(); toggleHidden(el.id); }}
                              title={isHidden ? 'Show element' : 'Hide element'}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: isHidden ? t.textMuted : t.text, fontSize: 13, padding: '0 2px', flexShrink: 0, opacity: isHidden ? 0.5 : 0.75 }}>
                              {isHidden ? '🙈' : '👁'}
                            </button>
                            <button onClick={e => { e.stopPropagation(); toggleLocked(el.id); }}
                              title={isLocked ? 'Unlock element' : 'Lock element'}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLocked ? '#FFB800' : t.textMuted, fontSize: 12, padding: '0 2px', flexShrink: 0 }}>
                              {isLocked ? '🔒' : '🔓'}
                            </button>
                          </div>
                        );
                      })}
                      {elements.length > 0 && (
                        <div style={{ marginTop: 10, padding: '8px 0', borderTop: `1px solid ${t.border}`, fontSize: 11, color: t.textMuted, textAlign: 'center' }}>
                          Drag rows to reorder · Click to select
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TOOLS — content moved to floating tile column (rendered outside flyout); flyout stays 0-width */}
            {activeLeftTool === 'tools' && null}

            {/* PROJECTS */}
            {activeLeftTool === 'projects' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 8, padding: '0 12px', height: 36, border: `1px solid ${t.border}` }}>
                  <IpSearch size={14} color={t.textMuted} style={{ flexShrink: 0 }} />
                  <input placeholder="Search your content" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                </div>
                <button style={{ background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>
                      {(user?.business_name || user?.email || 'U').charAt(0).toUpperCase()}
                    </span>
                    Your projects
                  </span>
                  <span style={{ color: t.textMuted }}>▾</span>
                </button>
                <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, gap: 4 }}>
                  {['All', 'Designs', 'Folders'].map(tab => (
                    <button key={tab} onClick={() => setProjectTab(tab)}
                      style={{ paddingBottom: 8, paddingTop: 4, paddingLeft: 8, paddingRight: 8, border: 'none', borderBottom: `2px solid ${projectTab === tab ? t.primary : 'transparent'}`, background: 'transparent', color: projectTab === tab ? t.primary : t.textMuted, fontSize: 13, fontWeight: projectTab === tab ? 600 : 400, cursor: 'pointer' }}>
                      {tab}
                    </button>
                  ))}
                </div>
                {savedDesignsLoading ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i}>
                        <div style={{ aspectRatio: '4/5', borderRadius: 8, background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`, backgroundSize: '1000px 100%', animation: `shimmer 1.4s ${i * 0.15}s ease-in-out infinite`, marginBottom: 6 }} />
                        <div style={{ height: 12, borderRadius: 4, width: '70%', background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`, backgroundSize: '1000px 100%', animation: 'shimmer 1.4s ease-in-out infinite', marginBottom: 4 }} />
                        <div style={{ height: 10, borderRadius: 4, width: '50%', background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`, backgroundSize: '1000px 100%', animation: 'shimmer 1.4s 0.1s ease-in-out infinite' }} />
                      </div>
                    ))}
                  </div>
                ) : savedDesigns.length === 0 ? (
                  <div style={{ textAlign: 'center', color: t.textMuted, padding: '24px 0', fontSize: 12 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No designs yet</div>
                    <div>Saved designs will appear here</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Designs</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {savedDesigns.map(d => (
                        <div key={d.id}
                          onClick={() => { if (typeof window !== 'undefined') window.location.href = `/templates/editor?id=${d.id}`; }}
                          onMouseEnter={e => {
                            const r = e.currentTarget.getBoundingClientRect();
                            const pagesCount = Array.isArray(d.pages_json) ? d.pages_json.length : 1;
                            setHoveredDesign({ id: d.id, title: d.title || 'Untitled', pagesCount, x: r.right + 10, y: r.top });
                          }}
                          onMouseLeave={() => setHoveredDesign(null)}
                          style={{ cursor: 'pointer' }}>
                          <div style={{ aspectRatio: '4/5', borderRadius: 8, overflow: 'hidden', background: t.input, border: `1px solid ${hoveredDesign?.id === d.id ? t.primaryBorder : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: t.textMuted, marginBottom: 5, transition: 'border-color 120ms' }}>
                            {d.title || 'Untitled'}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text }}>{d.title || 'Untitled'}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{canvasSize.w}×{canvasSize.h}px</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* APPS */}
            {activeLeftTool === 'apps' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 8, padding: '0 12px', height: 36, border: `1px solid ${t.border}` }}>
                  <IpSearch size={14} color={t.textMuted} style={{ flexShrink: 0 }} />
                  <input placeholder="Search apps" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                </div>
                {[
                  { icon: '🗄', label: 'Google Drive',   sub: 'Import from Drive'         },
                  { icon: '▶', label: 'YouTube',         sub: 'Add YouTube videos'         },
                  { icon: '📸', label: 'Instagram',      sub: 'Import Instagram photos'    },
                  { icon: '🎵', label: 'Soundcloud',     sub: 'Add background music'       },
                ].map(app => (
                  <button key={app.label}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${t.border}`, borderRadius: 10, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = t.input}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: 24, width: 36, textAlign: 'center' }}>{app.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{app.label}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{app.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* MAGIC MEDIA */}
            {activeLeftTool === 'magic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: t.primary }}>✦</span> Magic Media
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
                  Turn your text into stunning images and videos with AI
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: t.input, borderRadius: 8, padding: '10px 12px', border: `1px solid ${t.border}` }}>
                  <textarea placeholder="Describe an image or video…" rows={3}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ flex: 1, background: t.input, border: `1.5px solid ${t.border}`, borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: t.text, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    🖼 Image
                  </button>
                  <button style={{ flex: 1, background: t.input, border: `1.5px solid ${t.border}`, borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: t.text, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    🎬 Video
                  </button>
                </div>
                <button style={{ background: t.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  ✦ Generate
                </button>
              </div>
            )}

          </div>
          )}
        </div>

        {/* Collapse handle — sibling of flyout, outside overflow:hidden */}
        <div style={{ position: 'relative', width: 0, flexShrink: 0, overflow: 'visible', zIndex: 20 }}>
          <button
            onClick={() => setPanelOpen(o => !o)}
            title={panelOpen ? 'Collapse panel' : 'Expand panel'}
            style={{
              position: 'absolute', left: 0, top: '50%',
              transform: 'translateY(-50%)',
              width: 14, height: 44,
              background: t.card, border: `1px solid ${t.border}`,
              borderLeft: 'none',
              borderRadius: '0 6px 6px 0', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: t.textMuted, fontSize: 10, transition: 'background 100ms, color 100ms',
              boxShadow: '2px 0 4px rgba(0,0,0,0.07)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = t.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = t.card; e.currentTarget.style.color = t.textMuted; }}
          >
            {panelOpen ? '‹' : '›'}
          </button>
        </div>

        {/* ── Canvas area — multi-page vertical scroll ── */}
        <style>{`
          @keyframes ftb-in {
            from { opacity:0; transform:translateX(-50%) translateY(-4px) scale(0.97); }
            to   { opacity:1; transform:translateX(-50%) translateY(0)    scale(1);    }
          }
          @keyframes panel-in {
            from { opacity:0; transform:translateX(-6px); }
            to   { opacity:1; transform:translateX(0);    }
          }
          @keyframes save-check {
            from { opacity:0; transform:scale(0.7); }
            50%  { opacity:1; transform:scale(1.1); }
            to   { opacity:1; transform:scale(1);   }
          }
          @keyframes spin { to { transform:rotate(360deg); } }
          @keyframes shimmer {
            0%   { background-position:-500px 0; }
            100% { background-position: 500px 0; }
          }
          @keyframes preview-fade {
            from { opacity:0; transform:scale(0.97); }
            to   { opacity:1; transform:scale(1);    }
          }
        `}</style>
        <div ref={containerRef}
          style={{ flex: 1, overflow: 'auto', background: t.isDark ? '#111113' : '#EAEAEF', padding: '48px 56px', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
            {pages.map((page, pageIdx) => {
              const isActive = pageIdx === activePage;
              const pageElements = page.elements;
              const pageBgType = page.bgType;
              const pageBgColor = page.bgColor;
              const pageBgPattern = page.bgPattern;
              const pageBgPatternColor = page.bgPatternColor || 'rgba(255,255,255,0.18)';
              const pageBgImageUrl = page.bgImageUrl;
              const pageBgFilter = page.bgFilter;
              const pageBgBrightness = page.bgBrightness;
              const pageBgContrast = page.bgContrast;
              const pageBgSaturation = page.bgSaturation;
              const pageLockedIds = new Set(page.lockedIds);
              const pageHiddenIds = new Set(page.hiddenIds);
              return (
                <div key={page.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {/* ── Page label row ── */}
                  <div style={{ width: showRulers && isActive ? stageDisplayW + 20 : stageDisplayW, display: 'flex', alignItems: 'center', gap: 4, padding: `3px 4px 3px ${showRulers && isActive ? 24 : 4}px`, borderRadius: 7, background: isActive ? t.primaryBg : 'transparent', transition: 'background 150ms' }}>
                    <span
                      onClick={() => { setActivePage(pageIdx); setSelectedId(null); }}
                      style={{ fontSize: 11, fontWeight: 700, color: isActive ? t.primary : t.textMuted, cursor: 'pointer', userSelect: 'none', flexShrink: 0, minWidth: 48 }}
                    >
                      Page {pageIdx + 1}
                    </span>
                    <span style={{ color: t.textMuted, fontSize: 11, flexShrink: 0 }}>-</span>
                    <input
                      value={page.title || ''}
                      onChange={e => setPages(prev => prev.map((p, i) => i === pageIdx ? { ...p, title: e.target.value } : p))}
                      placeholder="Add page title…"
                      onClick={() => { setActivePage(pageIdx); setSelectedId(null); }}
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: isActive ? t.text : t.textMuted, fontSize: 11, minWidth: 0 }}
                    />
                    {/* Ask PostCore branded action */}
                    <button
                      onClick={() => { setActivePage(pageIdx); handleToolClick('magic'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, height: 20, padding: '0 7px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #00C4CC, #7C5CFC)', cursor: 'pointer', flexShrink: 0 }}
                      title="Ask PostCore AI">
                      <IpSparkle size={9} color="#fff" />
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>Ask PostCore</span>
                    </button>
                    {/* Controls — show on hover of parent row */}
                    {[
                      { title: 'Move up',    icon: <IcoChevUpSm size={11} />,   action: () => movePageUp(pageIdx),   disabled: pageIdx === 0 },
                      { title: 'Move down',  icon: <IcoChevDownSm size={11} />, action: () => movePageDown(pageIdx), disabled: pageIdx === pages.length - 1 },
                      { title: page.hidden ? 'Show page' : 'Hide page', icon: page.hidden ? <IcoEyeOff size={11} /> : <IcoEye size={11} />, action: () => setPages(prev => prev.map((p, i) => i === pageIdx ? { ...p, hidden: !p.hidden } : p)) },
                      { title: page.pageLocked ? 'Unlock page' : 'Lock page', icon: page.pageLocked ? <IpLock size={11} /> : <IpUnlock size={11} />, action: () => setPages(prev => prev.map((p, i) => i === pageIdx ? { ...p, pageLocked: !p.pageLocked } : p)) },
                      { title: 'Duplicate page', icon: <IcoDuplicate size={11} />, action: () => duplicatePage(pageIdx) },
                      { title: 'Delete page',    icon: <IpDelete size={11} />,     action: () => deletePage(pageIdx), disabled: pages.length <= 1, danger: true },
                      { title: 'Add page after', icon: <IcoAddPage size={11} />,   action: () => {
                          pushHistory();
                          const np = emptyPage();
                          setPages(prev => [...prev.slice(0, pageIdx + 1), np, ...prev.slice(pageIdx + 1)]);
                          setActivePage(pageIdx + 1);
                          setSelectedId(null);
                        }
                      },
                    ].map(({ title, icon, action, disabled, danger }) => (
                      <button
                        key={title}
                        title={title}
                        onClick={e => { e.stopPropagation(); if (!disabled) action(); }}
                        style={{
                          width: 20, height: 20, padding: 0, border: 'none', borderRadius: 4,
                          background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
                          color: disabled ? t.border : danger ? t.error : t.textMuted,
                          fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: disabled ? 0.35 : 1, flexShrink: 0, transition: 'background 80ms, color 80ms',
                        }}
                        onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = danger ? 'rgba(248,113,113,0.1)' : (t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'); if (!danger) e.currentTarget.style.color = t.text; } }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? t.error : t.textMuted; }}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>

                  {/* Ruler + canvas wrapper */}
                  <div style={{ position: 'relative', paddingLeft: showRulers && isActive ? 20 : 0, paddingTop: showRulers && isActive ? 20 : 0 }}>
                    {showRulers && isActive && (
                      <>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, background: t.isDark ? '#1a1a24' : '#ebebeb', zIndex: 3, borderRight: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }} />
                        <div onMouseDown={e => { e.preventDefault(); startRulerDrag('h'); }} style={{ position: 'absolute', top: 0, left: 20, zIndex: 3, cursor: 's-resize' }}><RulerH canvasW={canvasSize.w} stageScale={stageScale} isDark={!!t.isDark} /></div>
                        <div onMouseDown={e => { e.preventDefault(); startRulerDrag('v'); }} style={{ position: 'absolute', top: 20, left: 0, zIndex: 3, cursor: 'e-resize' }}><RulerV canvasH={canvasSize.h} stageScale={stageScale} isDark={!!t.isDark} /></div>
                      </>
                    )}
                  <div
                    ref={isActive ? canvasWrapperRef : null}
                    style={{
                      position: 'relative', width: stageDisplayW, height: stageDisplayH, flexShrink: 0,
                      borderRadius: 4, overflow: 'hidden', cursor: isActive ? (drawMode ? 'crosshair' : 'default') : 'pointer',
                      opacity: page.hidden ? 0.35 : 1,
                      boxShadow: isActive
                        ? `0 0 0 2px ${t.primary}, 0 12px 48px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.16)`
                        : `0 4px 20px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10)`,
                      transition: 'box-shadow 180ms ease',
                      background: pageBgType === 'transparent'
                        ? 'repeating-conic-gradient(#aaa 0% 25%, #fff 0% 50%) 0 0 / 20px 20px'
                        : undefined,
                    }}
                    onClick={!isActive ? () => { setActivePage(pageIdx); setSelectedId(null); } : undefined}
                    onDragOver={isActive ? e => { e.preventDefault(); } : undefined}
                    onDragLeave={isActive ? e => { } : undefined}
                    onDrop={isActive ? e => { handleCanvasDrop(e); } : undefined}
                  >
                    <Stage
                      ref={isActive ? stageRef : null}
                      width={canvasSize.w}
                      height={canvasSize.h}
                      scaleX={stageScale}
                      scaleY={stageScale}
                      style={{ display: 'block', width: stageDisplayW, height: stageDisplayH }}
                      onClick={isActive ? (e => {
                        if (e.target === e.target.getStage()) {
                          clearSelection();
                          setShowShadowPanel(false);
                          setShowOutlinePanel(false);
                          setShowPositionPanel(false);
                        }
                      }) : undefined}
                      onMouseDown={isActive ? (e => {
                        if (spaceDownRef.current) return;
                        if (drawMode) {
                          const pos = e.target.getStage().getRelativePointerPosition();
                          const newEl = { id: uid(), type: 'draw', points: [pos.x, pos.y], stroke: drawColor, strokeWidth: drawWidth, opacity: 1, x: 0, y: 0 };
                          currentDrawRef.current = newEl;
                          setCurrentDrawEl(newEl);
                          setIsDrawingNow(true);
                          return;
                        }
                        // Start rubber-band on empty canvas OR background rect
                        if (e.target !== e.target.getStage() && e.target.name() !== 'canvas-bg') return;
                        const pos = e.target.getRelativePointerPosition();
                        setSelectionStart(pos);
                        setSelectionRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
                        clearSelection();
                      }) : undefined}
                      onMouseMove={isActive ? (e => {
                        if (drawMode && isDrawingNow && currentDrawRef.current) {
                          const pos = e.target.getStage().getRelativePointerPosition();
                          const updated = { ...currentDrawRef.current, points: [...currentDrawRef.current.points, pos.x, pos.y] };
                          currentDrawRef.current = updated;
                          setCurrentDrawEl({ ...updated });
                          return;
                        }
                        if (!selectionStart) return;
                        const pos = e.target.getStage().getRelativePointerPosition();
                        setSelectionRect({
                          x: Math.min(selectionStart.x, pos.x),
                          y: Math.min(selectionStart.y, pos.y),
                          w: Math.abs(pos.x - selectionStart.x),
                          h: Math.abs(pos.y - selectionStart.y),
                        });
                      }) : undefined}
                      onMouseUp={isActive ? (() => {
                        if (drawMode && isDrawingNow && currentDrawRef.current) {
                          if ((currentDrawRef.current.points || []).length >= 4) {
                            pushHistory();
                            patchElements(prev => [...prev, currentDrawRef.current]);
                          }
                          currentDrawRef.current = null;
                          setCurrentDrawEl(null);
                          setIsDrawingNow(false);
                          return;
                        }
                        if (selectionRect && (selectionRect.w > 4 || selectionRect.h > 4)) {
                          const sr = selectionRect;
                          const hit = pageElements.filter(el => {
                            if (pageLockedIds.has(el.id) || pageHiddenIds.has(el.id)) return false;
                            const ex = el.x || 0, ey = el.y || 0;
                            const ew = el.width || 100, eh = el.height || 60;
                            return ex < sr.x + sr.w && ex + ew > sr.x && ey < sr.y + sr.h && ey + eh > sr.y;
                          });
                          if (hit.length > 0) {
                            setSelectedIds(hit.map(e => e.id));
                            setSelectedId(hit[hit.length - 1].id);
                          }
                        }
                        setSelectionStart(null);
                        setSelectionRect(null);
                      }) : undefined}
                      onContextMenu={isActive ? (e => {
                        e.evt.preventDefault();
                        const { clientX, clientY } = e.evt;
                        const isStage = e.target === e.target.getStage();
                        const targetId = isStage ? null : (e.target.id() || null);
                        if (targetId) { setSelectedId(targetId); setSelectedIds([targetId]); }
                        setCtxMenu({ x: clientX, y: clientY, elementId: targetId });
                      }) : undefined}
                    >
                      {/* Layer 1: Background */}
                      <Layer>
                        {pageBgType === 'gradient' && page.bgGradient ? (
                          (() => {
                            const g = page.bgGradient;
                            const isRadial = g.type === 'radial';
                            const cx = canvasSize.w / 2, cy = canvasSize.h / 2;
                            const r = Math.max(canvasSize.w, canvasSize.h) * 0.65;
                            const { startPoint, endPoint } = isRadial ? { startPoint: { x: cx, y: cy }, endPoint: { x: cx, y: cy } } : gradientPoints(g.angle ?? 135, canvasSize.w, canvasSize.h);
                            return (
                              <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h}
                                name="canvas-bg"
                                {...(isRadial ? {
                                  fillRadialGradientStartPoint: startPoint,
                                  fillRadialGradientEndPoint: endPoint,
                                  fillRadialGradientStartRadius: 0,
                                  fillRadialGradientEndRadius: r,
                                  fillRadialGradientColorStops: g.midColor
                                    ? [0, g.c1, g.midStop??0.5, g.midColor, 1, g.c2]
                                    : [0, g.c1, 1, g.c2],
                                } : {
                                  fillLinearGradientStartPoint: startPoint,
                                  fillLinearGradientEndPoint: endPoint,
                                  fillLinearGradientColorStops: g.midColor
                                    ? [0, g.c1, g.midStop??0.5, g.midColor, 1, g.c2]
                                    : [0, g.c1, 1, g.c2],
                                })}
                                onClick={isActive ? () => { setSelectedId('__bg__'); setSelectedIds([]); } : undefined}
                              />
                            );
                          })()
                        ) : pageBgType === 'transparent' ? (
                          null
                        ) : pageBgType === 'color' ? (
                          <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h} fill={pageBgColor}
                            name="canvas-bg"
                            onClick={isActive ? () => { setSelectedId('__bg__'); setSelectedIds([]); } : undefined} />
                        ) : pageBgImageUrl ? (
                          <BgImage url={pageBgImageUrl} filter={pageBgFilter} brightness={pageBgBrightness} contrast={pageBgContrast} saturation={pageBgSaturation}
                            stageW={canvasSize.w} stageH={canvasSize.h}
                            onClick={isActive ? () => { setSelectedId('__bg__'); setSelectedIds([]); } : undefined}
                            isSelected={isActive && selectedId === '__bg__'} />
                        ) : (
                          <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h} fill="#1a1a22" name="canvas-bg" />
                        )}
                        {/* Background pattern overlay */}
                        {pageBgPattern && (
                          <Shape
                            x={0} y={0} width={canvasSize.w} height={canvasSize.h}
                            listening={false} perfectDrawEnabled={false}
                            sceneFunc={(ctx) => {
                              ctx.save();
                              ctx.strokeStyle = pageBgPatternColor;
                              ctx.fillStyle = pageBgPatternColor;
                              if (pageBgPattern === 'dots') {
                                const sp = 28;
                                for (let x = sp / 2; x < canvasSize.w; x += sp) {
                                  for (let y = sp / 2; y < canvasSize.h; y += sp) {
                                    ctx.beginPath();
                                    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
                                    ctx.fill();
                                  }
                                }
                              } else if (pageBgPattern === 'grid') {
                                const sp = 44;
                                ctx.lineWidth = 0.8;
                                ctx.beginPath();
                                for (let x = 0; x <= canvasSize.w; x += sp) { ctx.moveTo(x, 0); ctx.lineTo(x, canvasSize.h); }
                                for (let y = 0; y <= canvasSize.h; y += sp) { ctx.moveTo(0, y); ctx.lineTo(canvasSize.w, y); }
                                ctx.stroke();
                              } else if (pageBgPattern === 'diagonal') {
                                const sp = 32;
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                for (let i = -canvasSize.h; i < canvasSize.w + canvasSize.h; i += sp) {
                                  ctx.moveTo(i, 0); ctx.lineTo(i + canvasSize.h, canvasSize.h);
                                }
                                ctx.stroke();
                              } else if (pageBgPattern === 'crosshatch') {
                                const sp = 32;
                                ctx.lineWidth = 0.8;
                                ctx.beginPath();
                                for (let i = -canvasSize.h; i < canvasSize.w + canvasSize.h; i += sp) {
                                  ctx.moveTo(i, 0); ctx.lineTo(i + canvasSize.h, canvasSize.h);
                                  ctx.moveTo(i, canvasSize.h); ctx.lineTo(i + canvasSize.h, 0);
                                }
                                ctx.stroke();
                              }
                              ctx.restore();
                            }}
                          />
                        )}
                      </Layer>

                      {/* Layer 2: Grid overlay (active page only) */}
                      {isActive && showGrid && (
                        <Layer listening={false}>
                          <Shape
                            perfectDrawEnabled={false}
                            sceneFunc={(ctx) => {
                              const step = 50;
                              ctx.fillStyle = 'rgba(150,150,150,0.4)';
                              for (let x = step; x < canvasSize.w; x += step) {
                                for (let y = step; y < canvasSize.h; y += step) {
                                  ctx.fillRect(x - 1, y - 1, 2, 2);
                                }
                              }
                            }}
                          />
                        </Layer>
                      )}

                      {/* Layer 3: Content */}
                      <Layer>
                        {pageElements.flatMap(el => {
                          const node = el.type === 'group'
                            ? <GroupNode
                                key={el.id}
                                el={el}
                                isSelected={isActive && (selectedId === el.id || selectedIds.includes(el.id))}
                                onSelect={isActive ? handleSelect : () => {}}
                                onChange={isActive ? handleElementChange : () => {}}
                                stageW={canvasSize.w}
                                stageH={canvasSize.h}
                                onDragMove={isActive ? computeSnap : null}
                                onSnapClear={isActive ? clearSnapGuides : null}
                                locked={pageLockedIds.has(el.id)}
                                hidden={pageHiddenIds.has(el.id)}
                              />
                          : el.type === 'image'
                            ? <ImageNode
                                key={el.id}
                                el={el}
                                isSelected={isActive && (selectedId === el.id || selectedIds.includes(el.id))}
                                onSelect={isActive ? handleSelect : () => {}}
                                onChange={isActive ? handleElementChange : () => {}}
                                onDragMove={isActive ? computeSnap : null}
                                onSnapClear={isActive ? clearSnapGuides : null}
                                locked={pageLockedIds.has(el.id)}
                                hidden={pageHiddenIds.has(el.id)}
                              />
                            : <ContentNode
                                key={el.id}
                                el={el}
                                isSelected={isActive && (selectedId === el.id || selectedIds.includes(el.id))}
                                isHovered={isActive && hoveredId === el.id && selectedId !== el.id && !selectedIds.includes(el.id)}
                                onSelect={isActive ? handleSelect : () => {}}
                                onChange={isActive ? handleElementChange : () => {}}
                                stageW={canvasSize.w}
                                stageH={canvasSize.h}
                                onDblClick={isActive ? startEditText : () => {}}
                                onDragMove={isActive ? computeSnap : null}
                                onSnapClear={isActive ? clearSnapGuides : null}
                                onHoverIn={isActive ? setHoveredId : null}
                                onHoverOut={isActive ? () => setHoveredId(null) : null}
                                locked={pageLockedIds.has(el.id)}
                                hidden={pageHiddenIds.has(el.id)}
                              />;
                          const tint = el.type === 'image' && el.tintColor && (el.tintOpacity || 0) > 0
                            ? <Rect key={`${el.id}_tint`}
                                x={el.x} y={el.y}
                                width={el.width || 200} height={el.height || 200}
                                fill={el.tintColor}
                                opacity={el.tintOpacity || 0}
                                cornerRadius={el.cornerRadius || 0}
                                rotation={el.rotation || 0}
                                listening={false}
                                globalCompositeOperation="source-atop"
                              />
                            : null;
                          return tint ? [node, tint] : [node];
                        })}
                      </Layer>

                      {/* Layer 4: Transformer + snap guides (active page only) */}
                      {isActive && (
                        <Layer ref={trLayerRef}>
                          <TransformerLayer
                            selectedIds={selectedIds.length > 0 ? selectedIds : (selectedId && selectedId !== '__bg__' ? [selectedId] : [])}
                            elements={pageElements}
                            stageRef={stageRef}
                            snapGuides={snapGuides}
                            stageScale={stageScale}
                            canvasW={canvasSize.w}
                            canvasH={canvasSize.h}
                            onLiveBounds={setLiveBounds}
                            onLiveBoundsClear={() => setLiveBounds(null)}
                          />
                        </Layer>
                      )}

                      {/* Layer 5: Rubber-band selection rect */}
                      {isActive && selectionRect && selectionRect.w > 1 && (
                        <Layer listening={false}>
                          <Rect
                            x={selectionRect.x} y={selectionRect.y}
                            width={selectionRect.w} height={selectionRect.h}
                            fill="rgba(124,92,252,0.07)"
                            stroke="#7C5CFC"
                            strokeWidth={1.5 / stageScale}
                            dash={[6 / stageScale, 3 / stageScale]}
                          />
                        </Layer>
                      )}
                      {/* Layer 6: In-progress freehand draw path */}
                      {isActive && drawMode && currentDrawEl && currentDrawEl.points.length >= 2 && (
                        <Layer listening={false}>
                          <Line
                            points={currentDrawEl.points}
                            stroke={currentDrawEl.stroke}
                            strokeWidth={currentDrawEl.strokeWidth}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                          />
                        </Layer>
                      )}
                    </Stage>

                    {/* Inline text textarea (active page only) */}
                    {isActive && editingTextId && (() => {
                      const editEl = elements.find(e => e.id === editingTextId);
                      return (
                        <textarea
                          autoFocus
                          value={textareaValue}
                          onChange={e => {
                            setTextareaValue(e.target.value);
                            // Auto-grow
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          onFocus={e => {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          onBlur={commitTextEdit}
                          onKeyDown={e => { if (e.key === 'Escape') commitTextEdit(); }}
                          style={{
                            position: 'absolute',
                            left: textareaPos.x, top: textareaPos.y,
                            width: textareaPos.w,
                            fontSize: textareaPos.fontSize,
                            fontFamily: editEl?.fontFamily || 'Inter',
                            fontWeight: editEl?.fontStyle?.includes('bold') || editEl?.fontStyle === 'bold' ? 'bold' : (editEl?.fontWeight || 'normal'),
                            fontStyle: editEl?.fontStyle?.includes('italic') ? 'italic' : 'normal',
                            textAlign: editEl?.align || 'left',
                            color: editEl?.fill || '#ffffff',
                            background: 'rgba(0,0,0,0.35)',
                            border: `2px solid ${t.primary}`,
                            borderRadius: 4, padding: '4px 6px', outline: 'none', resize: 'none',
                            overflow: 'hidden', zIndex: 100, lineHeight: 1.3, minHeight: 40,
                            letterSpacing: editEl?.letterSpacing ? `${editEl.letterSpacing}px` : undefined,
                          }}
                        />
                      );
                    })()}

                    {/* ── Floating object toolbar (Canva-style pill) — single + multi-select ── */}
                    {isActive && (selectedIds.length > 1 || (selectedId && selectedId !== '__bg__')) && !editingTextId && (() => {
                      const isMulti = selectedIds.length > 1;
                      // Collect active elements
                      const activeEls = isMulti
                        ? elements.filter(e => selectedIds.includes(e.id))
                        : [elements.find(e => e.id === selectedId)].filter(Boolean);
                      if (!activeEls.length) return null;

                      // Compute combined bounding box in canvas coords
                      const elBounds = activeEls.map(el => {
                        const isCO = ['circle', 'triangle', 'star'].includes(el.type);
                        const r = el.radius || el.outerRadius || 60;
                        return {
                          x: isCO ? el.x - r : (el.x || 0),
                          y: isCO ? el.y - r : (el.y || 0),
                          w: isCO ? r * 2 : (el.width || 200),
                          h: isCO ? r * 2 : (el.type === 'text' ? Math.max(60, (el.fontSize || 36) * 1.4) : (el.height || 100)),
                        };
                      });
                      const bx1 = Math.min(...elBounds.map(b => b.x));
                      const by1 = Math.min(...elBounds.map(b => b.y));
                      const bx2 = Math.max(...elBounds.map(b => b.x + b.w));
                      const by2 = Math.max(...elBounds.map(b => b.y + b.h));
                      const bw  = bx2 - bx1;
                      const bh  = by2 - by1;

                      // Convert to screen coords inside canvasWrapperRef
                      const cx = (bx1 + bw / 2) * stageScale;
                      const nearTop  = by1 * stageScale < 56;
                      const toolbarY = nearTop ? (by1 + bh) * stageScale + 12 : by1 * stageScale - 52;

                      const el = activeEls[0];
                      const isLocked = !isMulti && lockedIds.has(selectedId);
                      const isGroup  = !isMulti && el?.type === 'group';

                      // Actions
                      const dupEl = () => {
                        pushHistory();
                        const newEls = activeEls.map(e => ({
                          ...JSON.parse(JSON.stringify(e)),
                          id: `el_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
                          x: (e.x || 0) + 20, y: (e.y || 0) + 20,
                        }));
                        patchElements(prev => [...prev, ...newEls]);
                        setSelectedIds(newEls.map(e => e.id));
                        setSelectedId(newEls[newEls.length - 1].id);
                      };
                      const delEls = () => {
                        pushHistory();
                        const toDelete = new Set(isMulti ? selectedIds : [selectedId]);
                        patchElements(prev => prev.filter(e => !toDelete.has(e.id)));
                        clearSelection();
                      };

                      const BTNS = [
                        // Rotate — first item like Canva
                        ...(!isMulti ? [{
                          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>,
                          title: 'Rotate -15°',
                          fn: () => { pushHistory(); patchElements(prev => prev.map(e => e.id === selectedId ? { ...e, rotation: (((e.rotation || 0) - 15) % 360 + 360) % 360 } : e)); },
                        }] : []),
                        { sep: true },
                        // Ask PostCore — branded gradient pill (like Canva's "Ask Canva")
                        { label: 'Ask PostCore', icon: <IpSparkle size={13} />, title: 'Ask PostCore AI', fn: () => { handleToolClick('magic'); }, branded: true },
                        { sep: true },
                        // Edit / copy style (paintbrush wand icon)
                        ...(!isMulti ? [{ icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>, title: styleClipboard ? 'Style copied — click element to paste' : 'Copy style', fn: copyStyle }] : []),
                        // Link
                        ...(!isMulti ? [{ icon: <IcoChain size={14} />, title: 'Add link', fn: () => {} }] : []),
                        { sep: true },
                        // Group/Ungroup for multi-select
                        ...(isMulti
                          ? [{ label: 'Group', icon: <IpTeam size={13} />, title: 'Group (Ctrl+G)', fn: groupSelected }]
                          : isGroup
                          ? [{ label: 'Ungroup', icon: <IpTeam size={13} />, title: 'Ungroup (Ctrl+Shift+G)', fn: ungroupSelected }]
                          : []),
                        ...(isMulti || isGroup ? [{ sep: true }] : []),
                        // Duplicate
                        { icon: <IcoDuplicate size={14} />, title: 'Duplicate (Ctrl+D)', fn: dupEl },
                        ...(!isMulti ? [
                          // Copy
                          { icon: <IpCopy size={14} />, title: 'Copy (Ctrl+C)', fn: () => setClipboard(JSON.parse(JSON.stringify(el))) },
                          { sep: true },
                          // Arrange
                          { icon: <IcoBringFwd size={14} />, title: 'Bring forward (Ctrl+])', fn: () => bringForward(selectedId) },
                          { icon: <IcoSendBack size={14} />, title: 'Send backward (Ctrl+[)', fn: () => sendBackward(selectedId) },
                          { sep: true },
                          // Lock
                          { icon: isLocked ? <IpLock size={14} /> : <IpUnlock size={14} />, title: isLocked ? 'Unlock' : 'Lock', fn: () => toggleLocked(selectedId) },
                        ] : []),
                        { sep: true },
                        { icon: <IpDelete size={14} />, title: 'Delete (Del)', fn: delEls, danger: true },
                      ];

                      return (
                        <>
                        <div
                          key={isMulti ? selectedIds.join(',') : selectedId}
                          style={{
                            position: 'absolute', left: cx, top: toolbarY,
                            transform: 'translateX(-50%)',
                            background: t.isDark ? 'rgba(12,12,14,0.88)' : 'rgba(255,255,255,0.88)',
                            border: t.isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.08)',
                            borderRadius: 32,
                            boxShadow: t.isDark ? '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
                            display: 'flex', alignItems: 'center',
                            padding: '4px 8px', gap: 2,
                            zIndex: 200, whiteSpace: 'nowrap',
                            animation: 'ftb-in 150ms cubic-bezier(0.34,1.56,0.64,1) forwards',
                            backdropFilter: 'blur(20px) saturate(180%)',
                          }}
                        >
                          {BTNS.map((b, i) =>
                            b.sep ? (
                              <div key={i} style={{ width: 1, height: 18, background: t.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)', margin: '0 2px', flexShrink: 0 }} />
                            ) : b.label ? (
                              <button
                                key={i}
                                onMouseDown={e => { e.stopPropagation(); b.fn(); }}
                                onMouseEnter={e => { const p = parseTipTitle(b.title); showTip(e, p.text, p.shortcut); e.currentTarget.style.opacity = '0.85'; }}
                                onMouseLeave={e => { hideTip(); e.currentTarget.style.opacity = '1'; }}
                                style={{ height: 30, padding: '0 12px', border: 'none', borderRadius: 20, background: b.branded ? 'linear-gradient(135deg, #00C4CC, #7C5CFC)' : b.ai ? 'rgba(124,92,252,0.08)' : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, color: b.branded ? '#fff' : b.ai ? t.primary : t.text, transition: 'opacity 80ms', flexShrink: 0, letterSpacing: '-0.01em', boxShadow: b.branded ? '0 2px 8px rgba(0,196,204,0.35)' : 'none' }}>
                                {b.icon}{b.label}
                              </button>
                            ) : (
                              <button
                                key={i}
                                onMouseDown={e => { e.stopPropagation(); b.fn(); }}
                                onMouseEnter={e => { const p = parseTipTitle(b.title); showTip(e, p.text, p.shortcut); e.currentTarget.style.background = b.danger ? (t.isDark ? 'rgba(248,113,113,0.15)' : 'rgba(239,68,68,0.08)') : (t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'); }}
                                onMouseLeave={e => { hideTip(); e.currentTarget.style.background = 'transparent'; }}
                                style={{ width: 32, height: 32, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: b.danger ? t.error : t.text, transition: 'background 80ms', flexShrink: 0 }}>
                                {b.icon}
                              </button>
                            )
                          )}
                        </div>
                        {/* Below-element handles: ↻ Rotate + ✚ Add (Canva style — centered below element) */}
                        {!isMulti && (
                          <>
                            {/* Rotation handle — left circle, centered below element */}
                            <div
                              title="Rotate (drag · Shift = snap 45°)"
                              style={{
                                position: 'absolute',
                                left: cx - 36,
                                top: by2 * stageScale + 12,
                                width: 30, height: 30, borderRadius: '50%',
                                background: t.isDark ? 'rgba(28,28,36,0.92)' : 'rgba(255,255,255,0.95)',
                                border: t.isDark ? '1px solid rgba(255,255,255,0.18)' : '1px solid #D1D1D6',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.16), 0 0 0 0.5px rgba(0,0,0,0.06)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'crosshair', zIndex: 201,
                                color: t.isDark ? '#bbb' : '#4A4A4A',
                                userSelect: 'none', backdropFilter: 'blur(10px)',
                                transition: 'transform 150ms cubic-bezier(0.34,1.56,0.64,1)',
                              }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              onMouseDown={e => {
                                e.stopPropagation();
                                const elId = activeEls[0]?.id;
                                if (!elId) return;
                                const elCenterX = (bx1 + bw / 2) * stageScale;
                                const elCenterY = (by1 + bh / 2) * stageScale;
                                const onMove = ev => {
                                  const wrapperRect = canvasWrapperRef.current?.getBoundingClientRect();
                                  if (!wrapperRect) return;
                                  const mx = ev.clientX - wrapperRect.left;
                                  const my = ev.clientY - wrapperRect.top;
                                  const raw = Math.atan2(my - elCenterY, mx - elCenterX) * (180 / Math.PI) + 90;
                                  const snapped = ev.shiftKey ? Math.round(raw / 45) * 45 : Math.round(raw);
                                  patchElements(prev => prev.map(el => el.id === elId ? { ...el, rotation: snapped } : el));
                                };
                                const onUp = () => {
                                  pushHistory();
                                  window.removeEventListener('mousemove', onMove);
                                  window.removeEventListener('mouseup', onUp);
                                };
                                window.addEventListener('mousemove', onMove);
                                window.addEventListener('mouseup', onUp);
                              }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                            </div>
                            {/* Add/connect handle — right circle, centered below element */}
                            <div
                              title="Add connected element"
                              style={{
                                position: 'absolute',
                                left: cx + 6,
                                top: by2 * stageScale + 12,
                                width: 30, height: 30, borderRadius: '50%',
                                background: t.isDark ? 'rgba(28,28,36,0.92)' : 'rgba(255,255,255,0.95)',
                                border: t.isDark ? '1px solid rgba(255,255,255,0.18)' : '1px solid #D1D1D6',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.16), 0 0 0 0.5px rgba(0,0,0,0.06)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', zIndex: 201,
                                color: t.isDark ? '#bbb' : '#4A4A4A',
                                userSelect: 'none', backdropFilter: 'blur(10px)',
                                transition: 'transform 150ms cubic-bezier(0.34,1.56,0.64,1)',
                              }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </div>
                          </>
                        )}
                        </>
                      );
                    })()}

                    {/* ── Ruler guide lines (click to remove) ── */}
                    {isActive && rulerGuides.h.map((yPx, i) => (
                      <div key={`gh${i}`} onClick={() => setRulerGuides(g => ({ ...g, h: g.h.filter((_, j) => j !== i) }))}
                        style={{ position: 'absolute', left: 0, right: 0, top: Math.round(yPx * stageScale), height: 1, background: 'rgba(155,79,212,0.75)', cursor: 'n-resize', pointerEvents: 'auto', zIndex: 201 }}>
                        <div style={{ position: 'absolute', right: 4, top: -9, fontSize: 9, color: '#7C5CFC', opacity: 0.8, userSelect: 'none', whiteSpace: 'nowrap' }}>{Math.round(yPx)}px ×</div>
                      </div>
                    ))}
                    {isActive && rulerGuides.v.map((xPx, i) => (
                      <div key={`gv${i}`} onClick={() => setRulerGuides(g => ({ ...g, v: g.v.filter((_, j) => j !== i) }))}
                        style={{ position: 'absolute', top: 0, bottom: 0, left: Math.round(xPx * stageScale), width: 1, background: 'rgba(155,79,212,0.75)', cursor: 'e-resize', pointerEvents: 'auto', zIndex: 201 }}>
                        <div style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, color: '#7C5CFC', opacity: 0.8, userSelect: 'none', whiteSpace: 'nowrap', transform: 'rotate(-90deg)', transformOrigin: 'bottom left' }}>{Math.round(xPx)}px</div>
                      </div>
                    ))}
                    {/* Dragging guide preview */}
                    {isActive && draggingGuide && draggingGuide.axis === 'h' && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: Math.round(draggingGuide.pos * stageScale), height: 1, background: 'rgba(155,79,212,0.9)', pointerEvents: 'none', zIndex: 202 }} />
                    )}
                    {isActive && draggingGuide && draggingGuide.axis === 'v' && (
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: Math.round(draggingGuide.pos * stageScale), width: 1, background: 'rgba(155,79,212,0.9)', pointerEvents: 'none', zIndex: 202 }} />
                    )}
                    {/* Live bounds label while dragging / resizing */}
                    {isActive && liveBounds && (
                      <div style={{ position: 'absolute', left: Math.max(2, Math.round((liveBounds.x + liveBounds.w / 2) * stageScale) - 48), top: Math.max(2, Math.round(liveBounds.y * stageScale) - 28), background: 'rgba(0,0,0,0.72)', color: '#fff', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', pointerEvents: 'none', zIndex: 203, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                        {liveBounds.w > 0 && liveBounds.h > 0 ? `${liveBounds.w} × ${liveBounds.h}` : `${liveBounds.x}, ${liveBounds.y}`}
                      </div>
                    )}
                    {/* Empty canvas guidance */}
                    {pageElements.length === 0 && isActive && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, pointerEvents: 'none', userSelect: 'none', zIndex: 10 }}>
                        <div style={{ fontSize: Math.max(14, Math.round(stageDisplayW * 0.045)), fontWeight: 700, color: 'rgba(0,0,0,0.13)', letterSpacing: '-0.01em', textAlign: 'center', lineHeight: 1.2, maxWidth: '70%' }}>
                          Click to add your headline
                        </div>
                        <div style={{ fontSize: Math.max(10, Math.round(stageDisplayW * 0.025)), color: 'rgba(0,0,0,0.08)', textAlign: 'center', maxWidth: '60%', lineHeight: 1.5 }}>
                          Use the panels on the left to add text, images, and elements
                        </div>
                      </div>
                    )}
                    {/* Platform safe-zone overlay */}
                    {showSafeZones && isActive && (
                      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
                        {(() => {
                          const pct = safeZonePlatform === 'facebook'
                            ? { w: 0.86, h: 0.80 }
                            : safeZonePlatform === 'google_business'
                            ? { w: 0.90, h: 0.90 }
                            : { w: 0.88, h: 0.88 };
                          const mX = (stageDisplayW * (1 - pct.w)) / 2;
                          const mY = (stageDisplayH * (1 - pct.h)) / 2;
                          return (
                            <svg width={stageDisplayW} height={stageDisplayH} style={{ position: 'absolute', inset: 0 }}>
                              <rect x={0} y={0} width={stageDisplayW} height={stageDisplayH} fill="rgba(0,0,0,0.07)" />
                              <rect x={mX} y={mY} width={stageDisplayW - mX * 2} height={stageDisplayH - mY * 2} fill="transparent" stroke="#7C5CFC" strokeWidth={1.5} strokeDasharray="6 4" />
                              <text x={mX + 6} y={mY + 14} fill="#7C5CFC" fontSize={10} fontFamily="Inter, sans-serif">
                                {safeZonePlatform === 'google_business' ? 'Google' : safeZonePlatform === 'facebook' ? 'Facebook' : 'Instagram'} safe area
                              </text>
                            </svg>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  </div>{/* close ruler wrapper */}
                </div>
              );
            })}

            {/* Add page button — full canvas width with ▼ dropdown chevron */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'stretch', width: stageDisplayW, borderRadius: 10, border: `1px solid ${t.border}`, overflow: 'hidden', background: 'transparent', transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.background = t.primaryBg; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = 'transparent'; }}>
              <button onClick={addPage}
                style={{ flex: 1, height: 42, background: 'none', border: 'none', color: t.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add page
              </button>
              <div style={{ width: 1, background: t.border, flexShrink: 0 }} />
              <button onClick={addPage} style={{ width: 40, height: 42, background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Add blank page">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15l-7-7h14z"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Pages thumbnail sidebar (toggled from bottom bar) ── */}
        {showPagesPanel && (
          <div style={{ width: 140, borderLeft: `1px solid ${t.border}`, background: t.card, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px 6px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Pages</span>
              <button onClick={() => setShowPagesPanel(false)}
                style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pages.map((page, i) => {
                const isAct = i === activePage;
                return (
                  <div key={page.id} style={{ position: 'relative' }}>
                    {/* Page number label */}
                    <div style={{ fontSize: 9, fontWeight: 600, color: isAct ? t.primary : t.textMuted, textAlign: 'center', marginBottom: 3 }}>{i + 1}</div>
                    {/* Thumbnail tile */}
                    <div onClick={() => { setActivePage(i); setSelectedId(null); setSelectedIds([]); }}
                      style={{ width: '100%', aspectRatio: `${canvasSize.w} / ${canvasSize.h}`, borderRadius: 6, border: `2px solid ${isAct ? t.primary : t.border}`, background: page.bgType === 'gradient' && page.bgGradient ? `linear-gradient(${page.bgGradient.angle}deg, ${page.bgGradient.c1}, ${page.bgGradient.c2})` : (page.bgColor || '#1a1a22'), cursor: 'pointer', overflow: 'hidden', position: 'relative', boxSizing: 'border-box' }}>
                      {/* Tiny color-coded element indicators */}
                      {page.elements.slice(0, 8).map(el => (
                        <div key={el.id} style={{
                          position: 'absolute',
                          left: `${(el.x / canvasSize.w) * 100}%`,
                          top: `${(el.y / canvasSize.h) * 100}%`,
                          width: `${Math.min(((el.width || el.radius * 2 || 60) / canvasSize.w) * 100, 40)}%`,
                          height: `${Math.min(((el.height || el.radius * 2 || 40) / canvasSize.h) * 100, 30)}%`,
                          background: el.fill || el.stroke || 'rgba(255,255,255,0.3)',
                          opacity: el.opacity ?? 1,
                          borderRadius: el.type === 'circle' ? '50%' : 2,
                          pointerEvents: 'none',
                        }} />
                      ))}
                    </div>
                    {/* Delete button (only when >1 page) */}
                    {pages.length > 1 && (
                      <button onClick={e => { e.stopPropagation(); deletePage(i); }}
                        style={{ position: 'absolute', top: 16, right: -4, width: 14, height: 14, background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', fontSize: 8, cursor: 'pointer', lineHeight: '14px', textAlign: 'center', padding: 0 }}>
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              {/* Add page button */}
              <button onClick={addPage}
                style={{ width: '100%', aspectRatio: `${canvasSize.w} / ${canvasSize.h}`, borderRadius: 6, border: `1.5px dashed ${t.borderStrong}`, background: 'none', color: t.textMuted, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)' }}
                onMouseEnter={e => { e.currentTarget.style.background = t.primaryBg; e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = t.borderStrong; e.currentTarget.style.color = t.textMuted; }}>
                +
              </button>
            </div>
          </div>
        )}

        {/* ── Right panel ── */}
        <div style={{ width: 264, borderLeft: `1px solid ${t.border}`, background: t.sidebar, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, flexShrink: 0, height: 44 }}>
            {['properties', 'layers', 'caption'].map(tab => (
              <button key={tab} onClick={() => setRightTab(tab)}
                style={{ flex: 1, padding: '0 0 0', border: 'none', background: 'transparent', color: rightTab === tab ? t.primary : t.textMuted, fontSize: 12, fontWeight: rightTab === tab ? 600 : 500, cursor: 'pointer', borderBottom: rightTab === tab ? `2px solid ${t.primary}` : '2px solid transparent', textTransform: 'capitalize', transition: 'color 150ms ease, border-color 150ms ease' }}>
                {tab}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

            {/* PROPERTIES TAB */}
            {rightTab === 'properties' && (() => {
              const SH = ({ children }) => (
                <div style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, marginBottom: 6, marginTop: 16, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{children}</div>
              );
              const lbl = { fontSize: 11, fontWeight: 500, color: t.textMuted, display: 'block', marginBottom: 4, letterSpacing: '-0.01em' };
              const inp = { width: '100%', padding: '6px 8px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, boxSizing: 'border-box', outline: 'none', transition: 'border-color 120ms ease, box-shadow 120ms ease' };
              const hasSize = selectedEl && ['rect','image','arrow','circle','shape','draw','progressbar','chart','table','badge','glasspane','testimonial','socialstats','coupon','beforeafter','comparison','sticker'].includes(selectedEl.type);
              const btnBase = { height: 26, width: 26, border: `1px solid ${t.border}`, borderRadius: 5, background: t.input, color: t.text, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
              return (
                <>
                  {!selectedId && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 48, paddingBottom: 24, gap: 8, opacity: 0.6 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px dashed ${t.borderStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✦</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, textAlign: 'center', lineHeight: 1.5 }}>Select an element<br/>to view properties</div>
                    </div>
                  )}

                  {selectedId === '__bg__' && bgType === 'image' && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Background</div>
                      <button onClick={() => { pushHistory(); patchPage({ bgType: 'color', bgImageUrl: null, bgSource: null, bgSourceId: null }); }}
                        style={{ width: '100%', padding: '7px 0', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>
                        Remove Photo
                      </button>
                    </div>
                  )}

                  {selectedEl && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.text, textTransform: 'capitalize', paddingBottom: 4, borderBottom: `1px solid ${t.border}` }}>{selectedEl.type}</div>

                      {/* ── ARRANGE ── */}
                      <SH>Arrange</SH>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 4 }}>
                        {[
                          { label: 'Forward',  fn: () => bringForward(selectedId) },
                          { label: 'Backward', fn: () => sendBackward(selectedId) },
                          { label: 'To Front', fn: () => bringToFront(selectedId) },
                          { label: 'To Back',  fn: () => sendToBack(selectedId) },
                        ].map(({ label: label2, fn }) => (
                          <button key={label2} onClick={fn}
                            style={{ height: 28, border: `1px solid ${t.border}`, borderRadius: 7, background: t.input, color: t.text, fontSize: 11, cursor: 'pointer', fontWeight: 500, transition: 'all 100ms ease' }}
                            onMouseEnter={e => { e.currentTarget.style.background = t.primaryBg; e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                            onMouseLeave={e => { e.currentTarget.style.background = t.input; e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.text; }}>
                            {label2}
                          </button>
                        ))}
                      </div>
                      {/* Lock/Unlock */}
                      <button onClick={() => toggleLocked(selectedId)}
                        style={{ width: '100%', height: 28, border: `1px solid ${t.border}`, borderRadius: 7, background: t.input, color: t.text, fontSize: 11, cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}
                        onMouseEnter={e => { e.currentTarget.style.background = t.cardHover; }}
                        onMouseLeave={e => { e.currentTarget.style.background = t.input; }}>
                        {lockedIds.has(selectedId) ? <IpLock size={12} /> : <IpUnlock size={12} />}
                        {lockedIds.has(selectedId) ? 'Unlock element' : 'Lock element'}
                      </button>

                      {/* TEXT content */}
                      {selectedEl.type === 'text' && (
                        <div style={{ marginBottom: 4, marginTop: 10 }}>
                          <label style={lbl}>Content</label>
                          <textarea value={selectedEl.text} onChange={e => updateElement({ ...selectedEl, text: e.target.value })} onBlur={() => pushHistory()} rows={3}
                            style={{ ...inp, resize: 'vertical' }} />
                        </div>
                      )}

                      {/* ── POSITION & SIZE ── */}
                      <SH>Position & Size</SH>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 4 }}>
                        <div><label style={lbl}>X</label>
                          <input type="number" value={Math.round(selectedEl.x)} onChange={e => updateElement({ ...selectedEl, x: +e.target.value || 0 })} onBlur={() => pushHistory()} style={inp} /></div>
                        <div><label style={lbl}>Y</label>
                          <input type="number" value={Math.round(selectedEl.y)} onChange={e => updateElement({ ...selectedEl, y: +e.target.value || 0 })} onBlur={() => pushHistory()} style={inp} /></div>
                        {hasSize && <>
                          <div><label style={lbl}>W</label>
                            <input type="number" value={Math.round(selectedEl.width || 0)} onChange={e => updateElement({ ...selectedEl, width: +e.target.value || 1 })} onBlur={() => pushHistory()} style={inp} /></div>
                          <div><label style={lbl}>H</label>
                            <input type="number" value={Math.round(selectedEl.height || selectedEl.width || 0)} onChange={e => updateElement({ ...selectedEl, height: +e.target.value || 1 })} onBlur={() => pushHistory()} style={inp} /></div>
                        </>}
                        <div style={{ gridColumn: '1/-1' }}>
                          <label style={lbl}>Rotation °</label>
                          <input type="number" value={Math.round(selectedEl.rotation || 0)} min={-360} max={360}
                            onChange={e => updateElement({ ...selectedEl, rotation: +e.target.value || 0 })} onBlur={() => pushHistory()} style={inp} />
                        </div>
                      </div>

                      {/* ── ALIGN TO PAGE ── */}
                      <SH>Align to page</SH>
                      {(() => {
                        const alignEl = (axis, mode) => {
                          if (!stageRef.current || !selectedId) return;
                          const node = stageRef.current.findOne(`#${selectedId}`);
                          if (!node) return;
                          const scale = stageRef.current.width() / canvasSize.w;
                          const br = node.getClientRect({ relativeTo: stageRef.current });
                          const elW = br.width / scale;
                          const elH = br.height / scale;
                          const elX = br.x / scale;
                          const elY = br.y / scale;
                          pushHistory();
                          if (axis === 'h') {
                            // delta: how much to shift selectedEl.x so bounding box aligns
                            let delta;
                            if (mode === 'left')   delta = -elX;
                            if (mode === 'center') delta = canvasSize.w / 2 - (elX + elW / 2);
                            if (mode === 'right')  delta = canvasSize.w - (elX + elW);
                            updateElement({ ...selectedEl, x: Math.round(selectedEl.x + delta) });
                          } else {
                            let delta;
                            if (mode === 'top')    delta = -elY;
                            if (mode === 'middle') delta = canvasSize.h / 2 - (elY + elH / 2);
                            if (mode === 'bottom') delta = canvasSize.h - (elY + elH);
                            updateElement({ ...selectedEl, y: Math.round(selectedEl.y + delta) });
                          }
                        };
                        const abtn = (title, children, onClick) => (
                          <button key={title} onClick={onClick} title={title}
                            style={{ flex: 1, height: 28, border: `1px solid ${t.border}`, borderRadius: 6, background: t.input, color: t.textSecondary, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={e => { e.currentTarget.style.background = t.primaryBg; e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                            onMouseLeave={e => { e.currentTarget.style.background = t.input; e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; }}>
                            {children}
                          </button>
                        );
                        return (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                              {abtn('Align left',            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="1.5" height="10" rx="0.75" fill="currentColor"/><rect x="3" y="3.5" width="7" height="3" rx="1" fill="currentColor" opacity=".6"/><rect x="3" y="7.5" width="5" height="3" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('h','left'))}
                              {abtn('Align center',          <svg width="14" height="14" viewBox="0 0 14 14"><rect x="6.25" y="1" width="1.5" height="12" rx="0.75" fill="currentColor"/><rect x="2" y="3" width="10" height="3" rx="1" fill="currentColor" opacity=".6"/><rect x="3.5" y="8" width="7" height="3" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('h','center'))}
                              {abtn('Align right',           <svg width="14" height="14" viewBox="0 0 14 14"><rect x="11.5" y="2" width="1.5" height="10" rx="0.75" fill="currentColor"/><rect x="4" y="3.5" width="7" height="3" rx="1" fill="currentColor" opacity=".6"/><rect x="6" y="7.5" width="5" height="3" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('h','right'))}
                              {abtn('Align top',             <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="10" height="1.5" rx="0.75" fill="currentColor"/><rect x="3" y="3" width="3" height="7" rx="1" fill="currentColor" opacity=".6"/><rect x="8" y="3" width="3" height="5" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('v','top'))}
                              {abtn('Align middle',          <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="6.25" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor" opacity=".6"/><rect x="8" y="3.5" width="3" height="7" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('v','middle'))}
                              {abtn('Align bottom',          <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="11.5" width="10" height="1.5" rx="0.75" fill="currentColor"/><rect x="3" y="4" width="3" height="7" rx="1" fill="currentColor" opacity=".6"/><rect x="8" y="6" width="3" height="5" rx="1" fill="currentColor" opacity=".6"/></svg>, () => alignEl('v','bottom'))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── TEXT: FONT ── */}
                      {selectedEl.type === 'text' && (<>
                        <SH>Font</SH>
                        <select value={selectedEl.fontFamily || 'Inter'} onChange={e => handleElementChange({ ...selectedEl, fontFamily: e.target.value })}
                          style={{ ...inp, height: 28, marginBottom: 6 }}>
                          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                          <button onClick={() => handleElementChange({ ...selectedEl, fontSize: Math.max(6, (selectedEl.fontSize || 36) - 1) })}
                            style={{ ...btnBase, fontSize: 16, fontWeight: 400 }}>−</button>
                          <input type="number" value={selectedEl.fontSize || 36} min={6} max={400}
                            onChange={e => handleElementChange({ ...selectedEl, fontSize: +e.target.value || 36 })} onBlur={() => pushHistory()}
                            style={{ ...inp, width: 52, textAlign: 'center', flexShrink: 0 }} />
                          <button onClick={() => handleElementChange({ ...selectedEl, fontSize: Math.min(400, (selectedEl.fontSize || 36) + 1) })}
                            style={{ ...btnBase, fontSize: 16, fontWeight: 400 }}>+</button>
                          <div style={{ flex: 1 }} />
                          {[['B','bold','fontStyle'],['I','italic','fontStyle'],['U','underline','textDecoration'],['S','line-through','textDecoration']].map(([lbl2, val, prop]) => {
                            const isActive = prop === 'fontStyle' ? selectedEl.fontStyle === val : selectedEl.textDecoration === val;
                            return (
                              <button key={lbl2} onClick={() => handleElementChange({ ...selectedEl, [prop]: isActive ? (prop === 'fontStyle' ? 'normal' : 'none') : val })}
                                style={{ ...btnBase, background: isActive ? t.primary : t.input, color: isActive ? '#fff' : t.text, borderColor: isActive ? t.primary : t.border }}>{lbl2}</button>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                          <label style={{ ...lbl, marginBottom: 0, flexShrink: 0 }}>Color</label>
                          <input type="color" value={selectedEl.fill || '#ffffff'} onChange={e => updateElement({ ...selectedEl, fill: e.target.value })} onBlur={() => pushHistory()}
                            style={{ width: 28, height: 26, borderRadius: 5, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1, background: 'none', flexShrink: 0 }} />
                          <div style={{ flex: 1 }} />
                          {[['≡L','left'],['≡C','center'],['≡R','right']].map(([icon, align]) => (
                            <button key={align} onClick={() => handleElementChange({ ...selectedEl, align })}
                              style={{ ...btnBase, background: selectedEl.align === align ? t.primary : t.input, color: selectedEl.align === align ? '#fff' : t.text, borderColor: selectedEl.align === align ? t.primary : t.border }}>{icon}</button>
                          ))}
                        </div>
                        <SH>Spacing</SH>
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <label style={lbl}>Line height</label>
                            <span style={{ fontSize: 10, color: t.textMuted }}>{(selectedEl.lineHeight ?? 1.2).toFixed(1)}</span>
                          </div>
                          <input type="range" min={0.8} max={3} step={0.05} value={selectedEl.lineHeight ?? 1.2}
                            onChange={e => handleElementChange({ ...selectedEl, lineHeight: parseFloat(e.target.value) })}
                            onMouseUp={() => pushHistory()} style={{ width: '100%', accentColor: t.primary }} />
                        </div>
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <label style={lbl}>Letter spacing</label>
                            <span style={{ fontSize: 10, color: t.textMuted }}>{(selectedEl.letterSpacing ?? 0).toFixed(1)}px</span>
                          </div>
                          <input type="range" min={-2} max={20} step={0.5} value={selectedEl.letterSpacing ?? 0}
                            onChange={e => handleElementChange({ ...selectedEl, letterSpacing: parseFloat(e.target.value) })}
                            onMouseUp={() => pushHistory()} style={{ width: '100%', accentColor: t.primary }} />
                        </div>
                      </>)}

                      {/* ── RECT: FILL / STROKE / CORNERS ── */}
                      {(selectedEl.type === 'rect' || selectedEl.type === 'gradrect') && (<>
                        <SH>Fill</SH>
                        <input type="color" value={selectedEl.fill || '#7C5CFC'} onChange={e => updateElement({ ...selectedEl, fill: e.target.value })} onBlur={() => pushHistory()}
                          style={{ width: '100%', height: 28, borderRadius: 6, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1 }} />
                        <SH>Stroke</SH>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <input type="checkbox" checked={!!selectedEl.borderEnabled} onChange={e => handleElementChange({ ...selectedEl, borderEnabled: e.target.checked })} style={{ cursor: 'pointer' }} />
                          <label style={{ ...lbl, marginBottom: 0 }}>Enable</label>
                          <input type="color" value={selectedEl.borderColor || '#000000'} onChange={e => handleElementChange({ ...selectedEl, borderColor: e.target.value })} onBlur={() => pushHistory()}
                            style={{ width: 26, height: 22, borderRadius: 4, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1, background: 'none' }} />
                          <label style={{ ...lbl, marginBottom: 0, flexShrink: 0 }}>W</label>
                          <input type="number" value={selectedEl.borderWidth || 1} min={1} max={40}
                            onChange={e => handleElementChange({ ...selectedEl, borderWidth: +e.target.value || 1 })} onBlur={() => pushHistory()}
                            style={{ ...inp, width: 44, flexShrink: 0 }} />
                        </div>
                        <select value={selectedEl.strokeStyle || 'solid'} onChange={e => handleElementChange({ ...selectedEl, strokeStyle: e.target.value })}
                          style={{ ...inp, height: 28, marginBottom: 5 }}>
                          <option value="solid">Solid</option>
                          <option value="dashed">Dashed</option>
                          <option value="dotted">Dotted</option>
                        </select>
                        <SH>Corners</SH>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <label style={lbl}>Radius</label>
                          <span style={{ fontSize: 10, color: t.textMuted }}>{selectedEl.cornerRadius ?? 0}px</span>
                        </div>
                        <input type="range" min={0} max={150} step={1} value={selectedEl.cornerRadius ?? 0}
                          onChange={e => handleElementChange({ ...selectedEl, cornerRadius: +e.target.value })}
                          onMouseUp={() => pushHistory()} style={{ width: '100%', accentColor: t.primary, marginBottom: 4 }} />
                      </>)}

                      {/* ── CIRCLE / SHAPE: FILL ── */}
                      {(selectedEl.type === 'circle' || selectedEl.type === 'shape') && (<>
                        <SH>Fill</SH>
                        <input type="color" value={selectedEl.fill || '#7C5CFC'} onChange={e => updateElement({ ...selectedEl, fill: e.target.value })} onBlur={() => pushHistory()}
                          style={{ width: '100%', height: 28, borderRadius: 6, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1, marginBottom: 4 }} />
                        <SH>Stroke</SH>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <input type="checkbox" checked={!!selectedEl.borderEnabled} onChange={e => handleElementChange({ ...selectedEl, borderEnabled: e.target.checked })} style={{ cursor: 'pointer' }} />
                          <label style={{ ...lbl, marginBottom: 0 }}>Enable</label>
                          <input type="color" value={selectedEl.borderColor || '#000000'} onChange={e => handleElementChange({ ...selectedEl, borderColor: e.target.value })} onBlur={() => pushHistory()}
                            style={{ width: 26, height: 22, borderRadius: 4, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1, background: 'none' }} />
                          <label style={{ ...lbl, marginBottom: 0, flexShrink: 0 }}>W</label>
                          <input type="number" value={selectedEl.borderWidth || 1} min={1} max={40}
                            onChange={e => handleElementChange({ ...selectedEl, borderWidth: +e.target.value || 1 })} onBlur={() => pushHistory()}
                            style={{ ...inp, width: 44, flexShrink: 0 }} />
                        </div>
                      </>)}

                      {/* ── IMAGE: ADJUST / FRAME ── */}
                      {selectedEl.type === 'image' && (<>
                        <SH>Flip</SH>
                        <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
                          {[
                            { label: 'Flip H', prop: 'flipX', title: 'Flip horizontal' },
                            { label: 'Flip V', prop: 'flipY', title: 'Flip vertical' },
                          ].map(({ label: lbl2, prop, title }) => (
                            <button key={prop} onClick={() => { pushHistory(); updateElement({ ...selectedEl, [prop]: !selectedEl[prop] }); }}
                              title={title}
                              style={{ flex: 1, height: 28, border: `1px solid ${selectedEl[prop] ? t.primaryBorder : t.border}`, borderRadius: 7, background: selectedEl[prop] ? t.primaryBg : t.input, color: selectedEl[prop] ? t.primary : t.text, fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
                              onMouseEnter={e => { if (!selectedEl[prop]) { e.currentTarget.style.background = t.cardHover; } }}
                              onMouseLeave={e => { if (!selectedEl[prop]) { e.currentTarget.style.background = t.input; } }}>
                              {lbl2}
                            </button>
                          ))}
                        </div>
                        <SH>Adjust</SH>
                        {[
                          { key: 'brightness', label: 'Brightness', min: -1, max: 1, step: 0.05, fmt: v => `${Math.round(v * 100)}%` },
                          { key: 'contrast',   label: 'Contrast',   min: -100, max: 100, step: 5,    fmt: v => `${Math.round(v)}` },
                          { key: 'saturation', label: 'Saturation', min: -1, max: 1, step: 0.05, fmt: v => `${Math.round(v * 100)}%` },
                          { key: 'blur',       label: 'Blur',       min: 0,  max: 20, step: 0.5,  fmt: v => `${v}px` },
                        ].map(({ key, label: lbl2, min, max, step, fmt }) => (
                          <div key={key} style={{ marginBottom: 5 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                              <label style={lbl}>{lbl2}</label>
                              <span style={{ fontSize: 10, color: t.textMuted }}>{fmt(selectedEl[key] ?? 0)}</span>
                            </div>
                            <input type="range" min={min} max={max} step={step} value={selectedEl[key] ?? 0}
                              onChange={e => handleElementChange({ ...selectedEl, [key]: parseFloat(e.target.value) })}
                              onMouseUp={() => pushHistory()} style={{ width: '100%', accentColor: t.primary }} />
                          </div>
                        ))}
                        <SH>Frame</SH>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <label style={lbl}>Corner radius</label>
                          <span style={{ fontSize: 10, color: t.textMuted }}>{selectedEl.cornerRadius ?? 0}px</span>
                        </div>
                        <input type="range" min={0} max={150} step={1} value={selectedEl.cornerRadius ?? 0}
                          onChange={e => handleElementChange({ ...selectedEl, cornerRadius: +e.target.value })}
                          onMouseUp={() => pushHistory()} style={{ width: '100%', accentColor: t.primary, marginBottom: 4 }} />
                      </>)}

                      {/* ── ARROW / LINE: STROKE ── */}
                      {(selectedEl.type === 'arrow' || selectedEl.type === 'line') && (<>
                        <SH>Stroke</SH>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <input type="color" value={selectedEl.stroke || selectedEl.fill || '#ffffff'} onChange={e => handleElementChange({ ...selectedEl, stroke: e.target.value, fill: e.target.value })} onBlur={() => pushHistory()}
                            style={{ width: 28, height: 26, borderRadius: 5, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1, background: 'none' }} />
                          <label style={{ ...lbl, marginBottom: 0, flexShrink: 0 }}>W</label>
                          <input type="number" value={selectedEl.strokeWidth || selectedEl.borderWidth || 2} min={1} max={40}
                            onChange={e => handleElementChange({ ...selectedEl, strokeWidth: +e.target.value || 2, borderWidth: +e.target.value || 2 })} onBlur={() => pushHistory()}
                            style={{ ...inp, width: 50, flexShrink: 0 }} />
                          <select value={selectedEl.strokeStyle || 'solid'} onChange={e => handleElementChange({ ...selectedEl, strokeStyle: e.target.value })}
                            style={{ ...inp, height: 26, flex: 1 }}>
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                          </select>
                        </div>
                      </>)}

                      {/* ── APPEARANCE (all elements) ── */}
                      <SH>Appearance</SH>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <label style={lbl}>Opacity</label>
                          <span style={{ fontSize: 10, color: t.textMuted }}>{Math.round((selectedEl.opacity ?? 1) * 100)}%</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity ?? 1}
                          onChange={e => updateElement({ ...selectedEl, opacity: parseFloat(e.target.value) })}
                          onMouseUp={() => pushHistory()} style={{ width: '100%', accentColor: t.primary }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={lbl}>Blend mode</label>
                        <select value={selectedEl.blendMode || 'source-over'} onChange={e => { pushHistory(); updateElement({ ...selectedEl, blendMode: e.target.value }); }}
                          style={{ ...inp, height: 28 }}>
                          {BLEND_MODES.map(m => <option key={m} value={m}>{BLEND_LABELS[m]}</option>)}
                        </select>
                      </div>

                      {/* ── DELETE ── */}
                      <button onClick={() => { pushHistory(); patchElements(prev => prev.filter(e => e.id !== selectedId)); setSelectedId(null); }}
                        style={{ width: '100%', padding: '7px 0', marginTop: 4, borderRadius: 7, border: `1px solid ${t.errorBorder}`, background: t.errorBg, color: t.error, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Delete Element
                      </button>
                    </div>
                  )}
                </>
              );
            })()}

            {/* LAYERS TAB */}
            {rightTab === 'layers' && (
              <div>
                <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{elements.length} element{elements.length !== 1 ? 's' : ''}</div>
                {elements.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, gap: 8, opacity: 0.5 }}>
                    <div style={{ fontSize: 24 }}>◫</div>
                    <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'center' }}>No elements yet</div>
                  </div>
                )}
                {[...elements].reverse().map((el) => {
                  const isActive = selectedId === el.id;
                  const isLocked = lockedIds.has(el.id);
                  const isHidden = hiddenIds.has(el.id);
                  const typeIcon = el.type === 'text' ? 'T' : el.type === 'image' ? '🖼' : el.type === 'circle' ? '●' : el.type === 'triangle' ? '▲' : el.type === 'star' ? '★' : el.type === 'arrow' ? '→' : el.type === 'line' ? '─' : el.type === 'draw' ? '✏' : el.type === 'shape' ? (el.shapeKind === 'heart' ? '♥' : el.shapeKind === 'cross' ? '✚' : el.shapeKind?.startsWith('speech') ? '💬' : '⬠') : el.type === 'progressbar' ? '▬' : el.type === 'chart' ? '📊' : el.type === 'table' ? '⊞' : el.type === 'countdown' ? '⏱' : el.type === 'rating' ? '★' : el.type === 'quote' ? '❝' : el.type === 'badge' ? '🏷' : el.type === 'divider' ? '─' : el.type === 'socialstats' ? '📈' : el.type === 'callout' ? '💡' : el.type === 'coupon' ? '🎟' : el.type === 'gradtext' ? '🌈' : el.type === 'neontext' ? '✨' : el.type === 'sticker' ? '🔥' : el.type === 'highlight' ? '🖊' : el.type === 'polaroid' ? '📷' : el.type === 'mappin' ? '📍' : el.type === 'speechbubble' ? '💬' : el.type === 'ribbon' ? '🎀' : el.type === 'steplist' ? '📋' : el.type === 'pattern' ? '⊞' : el.type === 'qrcode' ? '▣' : el.type === 'glasspane' ? '◫' : el.type === 'testimonial' ? '⭐' : el.type === 'beforeafter' ? '⟺' : el.type === 'gradrect' ? '▨' : el.type === 'counter' ? '🔢' : el.type === 'iconshape' ? '✓' : el.type === 'pricetag' ? '💲' : el.type === 'htimeline' ? '⟶' : el.type === 'watermark' ? '◉' : el.type === 'comparison' ? '⫸' : '■';
                  const label = el.type === 'text' ? (el.text || 'Text').slice(0, 18) : el.type.charAt(0).toUpperCase() + el.type.slice(1);
                  return (
                    <div key={el.id}
                      onClick={() => !isLocked && setSelectedId(el.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, background: isActive ? t.primaryBg : 'transparent', cursor: isLocked ? 'default' : 'pointer', marginBottom: 2, opacity: isHidden ? 0.4 : 1, transition: 'background 120ms ease', border: `1px solid ${isActive ? t.primaryBorder : 'transparent'}` }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = t.cardHover; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                      <button onClick={e => { e.stopPropagation(); toggleHidden(el.id); }} title={isHidden ? 'Show' : 'Hide'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 13, padding: 0, flexShrink: 0 }}>
                        {isHidden ? '👁‍🗨' : '👁'}
                      </button>
                      <button onClick={e => { e.stopPropagation(); toggleLocked(el.id); }} title={isLocked ? 'Unlock' : 'Lock'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLocked ? t.primary : t.textMuted, fontSize: 12, padding: 0, flexShrink: 0 }}>
                        {isLocked ? '🔒' : '🔓'}
                      </button>
                      <span style={{ fontSize: 11, flexShrink: 0 }}>{typeIcon}</span>
                      <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? t.primary : t.text }}>{label}</span>
                      <button onClick={e => { e.stopPropagation(); bringForward(el.id); }} title="Move Up"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 13, padding: '0 2px', flexShrink: 0 }}>↑</button>
                      <button onClick={e => { e.stopPropagation(); sendBackward(el.id); }} title="Move Down"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 13, padding: '0 2px', flexShrink: 0 }}>↓</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* CAPTION TAB */}
            {rightTab === 'caption' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 2 }}>Caption</div>
                {/* Platform chips */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['instagram', 'IG'], ['facebook', 'FB'], ['google_business', 'GB']].map(([id, label]) => {
                    const active = postPlatforms.includes(id);
                    return (
                      <button key={id} onClick={() => setPostPlatforms(prev =>
                        active ? prev.filter(x => x !== id) : [...prev, id]
                      )} style={{
                        flex: 1, height: 30, border: `1px solid ${active ? t.primaryBorder : t.border}`, borderRadius: 8,
                        background: active ? t.primaryBg : 'transparent',
                        color: active ? t.primary : t.textMuted,
                        fontSize: 11, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 120ms ease',
                      }}>{label}</button>
                    );
                  })}
                </div>
                {/* Caption textarea */}
                <textarea
                  value={postCaption}
                  onChange={e => setPostCaption(e.target.value)}
                  placeholder="Write your caption here..."
                  rows={8}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: `1px solid ${t.border}`, background: t.input,
                    color: t.text, fontSize: 12, resize: 'vertical', outline: 'none',
                    boxSizing: 'border-box', lineHeight: 1.5, fontFamily: 'inherit',
                  }}
                />
                {/* Char count */}
                <div style={{ fontSize: 11, color: t.textMuted, textAlign: 'right' }}>
                  {postCaption.length} / {postPlatforms.includes('google_business') ? '1,500' : postPlatforms.includes('facebook') ? '63,206' : '2,200'} chars
                </div>
                <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
                  Caption saves automatically and appears when you click Post.
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Video Timeline (slides in when isVideoMode) ── */}
      {(() => {
        const pageDurations = pages.map(p => p.duration || 5);
        const totalDur = pageDurations.reduce((a, b) => a + b, 0);
        const TRACK_H = 36;
        const RULER_H = 24;
        const TIMELINE_W_PX = 600;
        const pxPerSec = TIMELINE_W_PX / Math.max(totalDur, 1);

        const togglePlay = () => {
          if (isPlaying) {
            clearInterval(playIntervalRef.current);
            setIsPlaying(false);
          } else {
            setIsPlaying(true);
            playIntervalRef.current = setInterval(() => {
              setVideoPlayhead(p => {
                if (p >= totalDur) { clearInterval(playIntervalRef.current); setIsPlaying(false); return 0; }
                return p + 0.1;
              });
            }, 100);
          }
        };

        const fmtTime = (s) => {
          const m = Math.floor(s / 60); const sec = (s % 60).toFixed(1);
          return `${m}:${sec.padStart(4, '0')}`;
        };

        return (
          <div style={{
            height: isVideoMode ? 200 : 0, overflow: 'hidden',
            transition: 'height 220ms ease',
            background: t.card, borderTop: `1px solid ${t.border}`,
            flexShrink: 0, display: 'flex', flexDirection: 'column',
          }}>
            {/* Playback controls row */}
            <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
              <button onClick={() => { setVideoPlayhead(0); setIsPlaying(false); clearInterval(playIntervalRef.current); }}
                style={{ width: 28, height: 26, border: `1px solid ${t.border}`, borderRadius: 5, background: t.input, color: t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⏮</button>
              <button onClick={togglePlay}
                style={{ width: 36, height: 30, border: 'none', borderRadius: 6, background: t.primary, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <span style={{ fontSize: 12, color: t.textMuted, fontFamily: 'monospace', minWidth: 90 }}>
                {fmtTime(videoPlayhead)} / {fmtTime(totalDur)}
              </span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: t.textMuted }}>{pages.length} page{pages.length !== 1 ? 's' : ''} · {totalDur}s</span>
              <button
                onClick={() => {
                  showToast('Download pages as PNG using File → Download PNG. MP4 export coming soon.', 'info');
                }}
                style={{ height: 26, padding: '0 10px', border: `1px solid ${t.border}`, borderRadius: 5, background: t.input, color: t.text, fontSize: 11, cursor: 'pointer', flexShrink: 0, fontWeight: 500 }}>
                ⬇ Export
              </button>
              <button onClick={() => setIsVideoMode(false)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>

            {/* Timeline tracks area */}
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex' }}>
              {/* Track labels */}
              <div style={{ width: 80, borderRight: `1px solid ${t.border}`, flexShrink: 0, paddingTop: RULER_H }}>
                {['Main', 'Text', 'Audio'].map(label => (
                  <div key={label} style={{ height: TRACK_H, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, fontWeight: 600, color: t.textMuted, borderBottom: `1px solid ${t.border}` }}>{label}</div>
                ))}
              </div>

              {/* Timeline ruler + clip lanes */}
              <div style={{ flex: 1, position: 'relative' }}>
                {/* Time ruler */}
                <div style={{ height: RULER_H, display: 'flex', alignItems: 'flex-end', borderBottom: `1px solid ${t.border}`, paddingBottom: 2, position: 'relative', background: t.card }}>
                  {Array.from({ length: Math.ceil(totalDur) + 1 }).map((_, i) => (
                    <div key={i} style={{ position: 'absolute', left: i * pxPerSec, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 1, height: i % 5 === 0 ? 12 : 6, background: t.border }} />
                      {i % 5 === 0 && <span style={{ fontSize: 9, color: t.textMuted, position: 'absolute', bottom: 14, left: 2 }}>{i}s</span>}
                    </div>
                  ))}
                </div>

                {/* Main track — pages as clips (double-click to edit duration) */}
                <div style={{ height: TRACK_H, borderBottom: `1px solid ${t.border}`, position: 'relative', background: t.input }}>
                  {(() => {
                    let offset = 0;
                    return pages.map((page, i) => {
                      const dur = page.duration || 5;
                      const left = offset * pxPerSec;
                      const w = Math.max(dur * pxPerSec - 2, 30);
                      const isActivePage = i === activePage;
                      const isEditingThis = editingClipIdx === i;
                      offset += dur;
                      return (
                        <div key={page.id}
                          onClick={() => { setActivePage(i); setSelectedId(null); }}
                          onDoubleClick={e => { e.stopPropagation(); setEditingClipIdx(i); }}
                          title={`Page ${i + 1} · ${dur}s — dbl-click to set duration`}
                          style={{ position: 'absolute', left, top: 3, width: w, height: TRACK_H - 8, borderRadius: 4, background: isActivePage ? 'rgba(124,92,252,0.35)' : 'rgba(124,92,252,0.3)', border: `1px solid ${isActivePage ? '#7C5CFC' : 'rgba(124,92,252,0.5)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', paddingLeft: 4, overflow: 'hidden', gap: 4 }}>
                          {isEditingThis ? (
                            <input autoFocus type="number" min={1} max={60} defaultValue={dur}
                              onBlur={e => { const v = Math.max(1, Math.min(60, parseFloat(e.target.value) || dur)); patchPage({ duration: v }); setEditingClipIdx(null); }}
                              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingClipIdx(null); }}
                              onClick={e => e.stopPropagation()}
                              style={{ width: 44, fontSize: 10, background: t.card, border: `1px solid #7C5CFC`, borderRadius: 3, color: t.text, padding: '1px 3px', outline: 'none' }} />
                          ) : (
                            <>
                              <span style={{ fontSize: 10, fontWeight: 600, color: isActivePage ? '#7C5CFC' : t.text, whiteSpace: 'nowrap' }}>P{i + 1}</span>
                              <span style={{ fontSize: 9, color: t.textMuted, whiteSpace: 'nowrap' }}>{dur}s</span>
                            </>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Text track — text elements as clips (click to select) */}
                <div style={{ height: TRACK_H, borderBottom: `1px solid ${t.border}`, position: 'relative', background: t.bg }}>
                  {elements.filter(e => e.type === 'text').map(el => {
                    const dur = el.videoDuration || 3;
                    const start = el.videoStart || 0;
                    const isSelEl = selectedId === el.id;
                    return (
                      <div key={el.id} onClick={() => { setSelectedId(el.id); setSelectedIds([el.id]); }}
                        title={el.text || 'Text element'}
                        style={{ position: 'absolute', left: start * pxPerSec, top: 3, width: Math.max(dur * pxPerSec - 2, 4), height: TRACK_H - 8, borderRadius: 4, background: isSelEl ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.25)', border: `1px solid ${isSelEl ? '#f59e0b' : 'rgba(245,158,11,0.5)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', paddingLeft: 4, overflow: 'hidden', gap: 3 }}>
                        <span style={{ fontSize: 9, color: '#f59e0b' }}>T</span>
                        <span style={{ fontSize: 9, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(el.text || '').slice(0, 12)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Audio track (placeholder) */}
                <div style={{ height: TRACK_H, position: 'relative', background: t.bg }} />

                {/* Playhead */}
                <div style={{ position: 'absolute', top: 0, left: videoPlayhead * pxPerSec, width: 2, height: '100%', background: t.primary, pointerEvents: 'none', zIndex: 5 }}>
                  <div style={{ width: 8, height: 8, background: t.primary, borderRadius: '50%', position: 'absolute', top: 0, left: -3 }} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Bottom status bar ── */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 12px', borderTop: `1px solid ${t.border}`,
        background: t.sidebar, flexShrink: 0, zIndex: 8, position: 'relative',
        fontSize: 12, color: t.textMuted, userSelect: 'none',
      }}>
        {/* Notes panel */}
        {showNotesPanel && (
          <div style={{ position: 'absolute', bottom: 44, left: 12, width: 320, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, boxShadow: '0 -4px 20px rgba(0,0,0,0.2)', zIndex: 20 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Page {activePage + 1} notes</span>
              <button onClick={() => setShowNotesPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <textarea
              value={currentPage.notes || ''}
              onChange={e => patchPage({ notes: e.target.value })}
              placeholder="Add notes for this page…"
              style={{ width: '100%', minHeight: 100, padding: '8px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            {currentPage.notes && (
              <button onClick={() => { patchPage({ notes: '' }); }} style={{ marginTop: 6, background: 'none', border: 'none', color: t.textMuted, fontSize: 11, cursor: 'pointer', padding: 0 }}>Clear notes</button>
            )}
          </div>
        )}
        {/* Notes button */}
        <button onClick={() => setShowNotesPanel(p => !p)}
          style={{ height: 28, padding: '0 10px', border: 'none', borderRadius: 6, background: showNotesPanel ? t.primaryBg : 'transparent', color: showNotesPanel ? t.primary : (currentPage.notes ? t.text : t.textMuted), fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
          onMouseEnter={e => { if (!showNotesPanel) e.currentTarget.style.background = t.input; }}
          onMouseLeave={e => { if (!showNotesPanel) e.currentTarget.style.background = 'transparent'; }}>
          📝 Notes{currentPage.notes ? ' •' : ''}
        </button>
        {/* Timer button */}
        <button
          onMouseEnter={e => { showTip(e, 'Presentation timer'); e.currentTarget.style.background = t.input; e.currentTarget.style.color = t.text; }}
          onMouseLeave={e => { hideTip(); e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textMuted; }}
          style={{ height: 28, padding: '0 10px', border: 'none', borderRadius: 6, background: 'transparent', color: t.textMuted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, transition: 'all 100ms ease' }}>
          ⏱ Timer
        </button>
        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Fit to screen */}
        <button onClick={() => setZoomFactor(1)}
          onMouseEnter={e => { showTip(e, 'Fit to screen', 'Ctrl+0'); e.currentTarget.style.color = t.text; }} onMouseLeave={e => { hideTip(); e.currentTarget.style.color = t.textMuted; }}
          style={{ height: 28, padding: '0 8px', border: 'none', borderRadius: 7,
            background: 'transparent', color: t.textMuted, fontSize: 11, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, transition: 'color 100ms' }}>
          <IcoFit size={13} /> Fit
        </button>

        {/* Zoom pill group */}
        <div style={{ display: 'flex', alignItems: 'center', background: t.card, border: `1px solid ${t.border}`, borderRadius: 20, padding: '0 4px', gap: 0, flexShrink: 0 }}>
          <button onClick={zoomOut}
            onMouseEnter={e => showTip(e, 'Zoom out', 'Ctrl+−')} onMouseLeave={hideTip}
            style={{ width: 24, height: 24, border: 'none', borderRadius: 16,
              background: 'transparent', color: t.textSecondary, fontSize: 16, lineHeight: 1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            −
          </button>

          <input type="range" min={25} max={300} step={25}
            value={Math.round(zoomFactor * 100)}
            onChange={e => setZoomFactor(parseInt(e.target.value) / 100)}
            style={{ width: 80, flexShrink: 0, cursor: 'pointer', accentColor: t.primary }} />

          <button onClick={zoomIn}
            onMouseEnter={e => showTip(e, 'Zoom in', 'Ctrl++')} onMouseLeave={hideTip}
            style={{ width: 24, height: 24, border: 'none', borderRadius: 16,
              background: 'transparent', color: t.textSecondary, fontSize: 16, lineHeight: 1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            +
          </button>

          <button onClick={() => setZoomFactor(1)}
            onMouseEnter={e => showTip(e, 'Reset zoom', 'Ctrl+0')} onMouseLeave={hideTip}
            style={{ minWidth: 42, height: 24, border: 'none', borderRadius: 16,
              background: 'transparent', color: t.textSecondary, fontSize: 12, cursor: 'pointer',
              padding: '0 6px', flexShrink: 0, fontWeight: 500 }}>
            {Math.round(zoomFactor * 100)}%
          </button>
        </div>

        <div style={{ width: 1, height: 18, background: t.border, margin: '0 4px', flexShrink: 0 }} />

        {/* Pages toggle */}
        <button onClick={() => setShowPagesPanel(o => !o)}
          onMouseEnter={e => showTip(e, 'Pages panel')} onMouseLeave={hideTip}
          style={{ height: 28, padding: '0 10px', border: `1px solid ${showPagesPanel ? t.primaryBorder : t.border}`, borderRadius: 8,
            background: showPagesPanel ? t.primaryBg : 'transparent', color: showPagesPanel ? t.primary : t.textSecondary,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', transition: 'all 150ms ease' }}>
          Pages
        </button>

        {/* Page counter */}
        <span style={{ fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap', flexShrink: 0, minWidth: 32, textAlign: 'center' }}>
          {activePage + 1}/{pages.length}
        </span>

        {/* Add page button */}
        <button onClick={addPage}
          style={{ width: 24, height: 24, border: `1px solid ${t.border}`, borderRadius: 6, background: 'transparent', color: t.textMuted, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms ease', flexShrink: 0 }}
          onMouseEnter={e => { showTip(e, 'Add page'); e.currentTarget.style.background = t.primaryBg; e.currentTarget.style.color = t.primary; e.currentTarget.style.borderColor = t.primaryBorder; }}
          onMouseLeave={e => { hideTip(); e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textMuted; e.currentTarget.style.borderColor = t.border; }}>
          +
        </button>

        <div style={{ width: 1, height: 18, background: t.border, margin: '0 4px', flexShrink: 0 }} />

        {/* Rulers toggle */}
        <button onClick={() => setShowRulers(o => !o)}
          onMouseEnter={e => showTip(e, 'Toggle rulers', 'Shift+R')} onMouseLeave={hideTip}
          style={{ width: 28, height: 28, border: `1px solid ${showRulers ? t.primaryBorder : t.border}`, borderRadius: 8,
            background: showRulers ? t.primaryBg : 'transparent', color: showRulers ? t.primary : t.textMuted,
            fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}>
          <IcoRuler size={13} />
        </button>

        {/* Grid toggle */}
        <button onClick={() => setShowGrid(o => !o)}
          onMouseEnter={e => showTip(e, 'Toggle grid', 'G')} onMouseLeave={hideTip}
          style={{ width: 28, height: 28, border: `1px solid ${showGrid ? t.primaryBorder : t.border}`, borderRadius: 8,
            background: showGrid ? t.primaryBg : 'transparent', color: showGrid ? t.primary : t.textMuted,
            fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}>
          <IcoGrid size={13} />
        </button>

        {/* Safe zones toggle */}
        <button onClick={() => setShowSafeZones(p => !p)}
          onMouseEnter={e => showTip(e, 'Platform safe zones')} onMouseLeave={hideTip}
          style={{ height: 28, padding: '0 8px', border: `1px solid ${showSafeZones ? t.primaryBorder : t.border}`, borderRadius: 8,
            background: showSafeZones ? t.primaryBg : 'transparent', color: showSafeZones ? t.primary : t.textMuted,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', transition: 'all 150ms ease' }}>
          ⊞ Safe zones
        </button>
        {showSafeZones && (
          <div style={{ display: 'flex', gap: 2, marginLeft: 2, background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, padding: '0 3px' }}>
            {[['instagram', 'IG'], ['facebook', 'FB'], ['google_business', 'GB']].map(([id, label]) => (
              <button key={id} onClick={() => setSafeZonePlatform(id)} style={{
                height: 26, padding: '0 8px', border: 'none', borderRadius: 6,
                background: safeZonePlatform === id ? t.primary : 'transparent',
                color: safeZonePlatform === id ? '#fff' : t.textMuted,
                fontSize: 11, cursor: 'pointer', fontWeight: safeZonePlatform === id ? 700 : 400,
                transition: 'all 150ms ease',
              }}>{label}</button>
            ))}
          </div>
        )}
        {/* Fullscreen */}
        <button onClick={() => document.documentElement.requestFullscreen?.()}
          onMouseEnter={e => showTip(e, 'Fullscreen')} onMouseLeave={hideTip}
          style={{ width: 28, height: 28, border: `1px solid ${t.border}`, borderRadius: 8,
            background: 'transparent', color: t.textMuted, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 100ms' }}>
          ⤢
        </button>

        {/* Help */}
        <button onClick={() => setQuickOpen(true)}
          onMouseEnter={e => showTip(e, 'Keyboard shortcuts', '?')} onMouseLeave={hideTip}
          style={{ width: 28, height: 28, border: `1px solid ${t.border}`, borderRadius: 8,
            background: 'transparent', color: t.textMuted, fontSize: 12, cursor: 'pointer', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 100ms' }}>
          ?
        </button>
      </div>

      {/* ── Quick Actions palette (/ key) ── */}
      {quickOpen && (() => {
        const actions = QUICK_ACTIONS.filter(a =>
          !quickQuery ||
          a.label.toLowerCase().includes(quickQuery.toLowerCase()) ||
          (a.sub || '').toLowerCase().includes(quickQuery.toLowerCase())
        );

        const dispatch = (id) => {
          setQuickOpen(false);
          setQuickQuery('');
          if (id === 'text')     return addText();
          if (id === 'rect')     return addRect();
          if (id === 'circle')   return addCircle();
          if (id === 'line')     { pushHistory(); const el = { id: uid(), type: 'line', x: canvasSize.w/2-80, y: canvasSize.h/2, points: [0,0,160,0], stroke: '#ffffff', strokeWidth: 3, opacity: 1 }; patchElements(prev => [...prev, el]); setSelectedId(el.id); return; }
          if (id === 'undo')     return undo();
          if (id === 'redo')     return redo();
          if (id === 'duplicate'){ const sel = elements.find(e => e.id === selectedId); if (sel) { const d = {...JSON.parse(JSON.stringify(sel)), id: uid(), x: sel.x+20, y: sel.y+20}; pushHistory(); patchElements(prev => [...prev, d]); setSelectedId(d.id); } return; }
          if (id === 'pasteinplace') { if (clipboard) { pushHistory(); if (Array.isArray(clipboard)) { const newEls = clipboard.map(el => ({ ...JSON.parse(JSON.stringify(el)), id: uid() })); patchElements(prev => [...prev, ...newEls]); const ids = newEls.map(e => e.id); setSelectedIds(ids); setSelectedId(ids[ids.length - 1]); } else { const p = { ...JSON.parse(JSON.stringify(clipboard)), id: uid() }; patchElements(prev => [...prev, p]); setSelectedId(p.id); } } return; }
          if (id === 'delete')   { if (selectedIds.length > 0) { pushHistory(); const s = new Set(selectedIds); patchElements(p => p.filter(e => !s.has(e.id))); clearSelection(); } return; }
          if (id === 'newpage')  return addPage();
          if (id === 'download') return downloadCanvas('image/png', 'png', 1);
          if (id === 'zoomin')   return zoomIn();
          if (id === 'zoomout')  return zoomOut();
          if (id === 'zoomfit')  return setZoomFactor(1);
          if (id === 'selectall') {
            const ids = elements.filter(el => !lockedIds.has(el.id) && !hiddenIds.has(el.id)).map(el => el.id);
            if (ids.length) { setSelectedIds(ids); setSelectedId(ids[ids.length - 1]); }
            return;
          }
          if (id === 'showgrid') { setShowGrid(o => !o); return; }
          if (id === 'nextel' || id === 'prevel') {
            const selectable = elements.filter(el => !lockedIds.has(el.id) && !hiddenIds.has(el.id));
            if (!selectable.length) return;
            const idx = selectable.findIndex(el => el.id === selectedId);
            const next = id === 'prevel'
              ? (idx <= 0 ? selectable.length - 1 : idx - 1)
              : (idx < 0 || idx >= selectable.length - 1 ? 0 : idx + 1);
            setSelectedId(selectable[next].id); setSelectedIds([]);
            return;
          }
        };

        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 1998, background: 'rgba(0,0,0,0.25)' }}
              onMouseDown={() => { setQuickOpen(false); setQuickQuery(''); }} />
            <div style={{
              position: 'fixed', top: '28%', left: '50%', transform: 'translateX(-50%)',
              width: 500, background: t.card, border: `1px solid ${t.border}`,
              borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
              zIndex: 1999, overflow: 'hidden',
            }}>
              {/* Search input */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${t.border}`, gap: 10 }}>
                <span style={{ fontSize: 18, color: t.textMuted, flexShrink: 0 }}>🔍</span>
                <input
                  autoFocus
                  value={quickQuery}
                  onChange={e => setQuickQuery(e.target.value)}
                  placeholder='Search actions or press "/" for commands…'
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: t.text, fontSize: 15 }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setQuickOpen(false); setQuickQuery(''); }
                    if (e.key === 'Enter' && actions.length > 0) dispatch(actions[0].id);
                  }}
                />
                <kbd style={{ fontSize: 11, color: t.textMuted, background: t.input, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>Esc</kbd>
              </div>

              {/* Action list */}
              <div style={{ maxHeight: 340, overflowY: 'auto', padding: '6px 0' }}>
                {actions.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: t.textMuted }}>No actions match "{quickQuery}"</div>
                )}
                {actions.map(a => (
                  <button key={a.id}
                    onMouseDown={e => { e.preventDefault(); dispatch(a.id); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 60ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = t.input; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.input, borderRadius: 8, fontSize: 16, flexShrink: 0 }}>{a.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{a.label}</div>
                      {a.sub && <div style={{ fontSize: 12, color: t.textMuted }}>{a.sub}</div>}
                    </div>
                    {a.shortcut && (
                      <kbd style={{ fontSize: 11, color: t.textMuted, background: t.input, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>{a.shortcut}</kbd>
                    )}
                  </button>
                ))}
              </div>

              {/* Footer hint */}
              <div style={{ padding: '8px 18px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 16, fontSize: 11, color: t.textMuted }}>
                <span><kbd style={{ background: t.input, border: `1px solid ${t.border}`, borderRadius: 3, padding: '1px 5px' }}>↵</kbd> select</span>
                <span><kbd style={{ background: t.input, border: `1px solid ${t.border}`, borderRadius: 3, padding: '1px 5px' }}>Esc</kbd> close</span>
                <span><kbd style={{ background: t.input, border: `1px solid ${t.border}`, borderRadius: 3, padding: '1px 5px' }}>/</kbd> to re-open</span>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Floating element toolbar ── */}
      {floatingBar && selectedId && !ctxMenu && !editingTextId && (() => {
        const el = elements.find(e => e.id === selectedId);
        if (!el) return null;
        const isLocked = lockedIds.has(selectedId);
        const tbW = 264;
        const left = Math.max(8, Math.min(window.innerWidth - tbW - 8, floatingBar.left + floatingBar.width / 2 - tbW / 2));
        const top  = Math.max(8, floatingBar.top - 50);
        return (
          <div style={{
            position: 'fixed', left, top, zIndex: 1002,
            background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            display: 'flex', alignItems: 'center', gap: 0, padding: '3px 4px',
            userSelect: 'none', pointerEvents: 'auto',
          }}>
            {/* Ask PostCore */}
            <button
              onMouseDown={e => { e.preventDefault(); handleToolClick && handleToolClick('magic'); }}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:7, background:'linear-gradient(135deg,#00C4CC,#7C5CFC)', border:'none', cursor:'pointer', height:30, flexShrink:0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2.4 7.4L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/></svg>
              <span style={{ fontSize:11, fontWeight:700, color:'#fff', whiteSpace:'nowrap' }}>Ask PostCore</span>
            </button>
            <div style={{ width:1, height:22, background:t.border, margin:'0 3px', flexShrink:0 }}/>
            {/* Duplicate */}
            <button title="Duplicate (Ctrl+D)"
              onMouseDown={e => {
                e.preventDefault();
                const d = { ...JSON.parse(JSON.stringify(el)), id: `el_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, x: el.x + 20, y: el.y + 20 };
                pushHistory(); patchElements(prev => [...prev, d]); setSelectedId(d.id);
              }}
              style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', borderRadius:6, cursor:'pointer', color:t.textMuted }}
              onMouseEnter={e => { e.currentTarget.style.background=t.input; }}
              onMouseLeave={e => { e.currentTarget.style.background='none'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            {/* Lock */}
            <button title={isLocked ? 'Unlock' : 'Lock'}
              onMouseDown={e => { e.preventDefault(); toggleLocked(selectedId); }}
              style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', borderRadius:6, cursor:'pointer', color: isLocked ? '#FFB800' : t.textMuted }}
              onMouseEnter={e => { e.currentTarget.style.background=t.input; }}
              onMouseLeave={e => { e.currentTarget.style.background='none'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                {isLocked
                  ? <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  : <path d="M7 11V7a5 5 0 0 1 9.9-1" opacity=".4"/>}
              </svg>
            </button>
            {/* Delete */}
            <button title="Delete"
              onMouseDown={e => {
                e.preventDefault();
                pushHistory(); patchElements(prev => prev.filter(e => e.id !== selectedId)); setSelectedId(null); setFloatingBar(null);
              }}
              style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', borderRadius:6, cursor:'pointer', color:'#ef4444' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='none'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
            <div style={{ width:1, height:22, background:t.border, margin:'0 3px', flexShrink:0 }}/>
            {/* More (opens context menu) */}
            <button title="More options"
              onMouseDown={e => {
                e.preventDefault();
                setCtxMenu({ x: left + tbW / 2, y: top + 50, elementId: selectedId });
              }}
              style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', borderRadius:6, cursor:'pointer', color:t.textMuted }}
              onMouseEnter={e => { e.currentTarget.style.background=t.input; }}
              onMouseLeave={e => { e.currentTarget.style.background='none'; }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
              </svg>
            </button>
          </div>
        );
      })()}

      {/* ── Right-click context menu ── */}
      {ctxMenu && (() => {
        const el = ctxMenu.elementId ? elements.find(e => e.id === ctxMenu.elementId) : null;
        const isLocked = el && lockedIds.has(el.id);
        const isHidden = el && hiddenIds.has(el.id);

        // Clamp to viewport so menu never overflows
        const menuW = 192, menuH = el ? 320 : 80;
        const mx = Math.min(ctxMenu.x, window.innerWidth  - menuW - 8);
        const my = Math.min(ctxMenu.y, window.innerHeight - menuH - 8);

        const close = () => setCtxMenu(null);

        const dupEl = () => {
          if (!el) return;
          const d = { ...JSON.parse(JSON.stringify(el)), id: `el_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, x: el.x + 20, y: el.y + 20 };
          pushHistory(); patchElements(prev => [...prev, d]); setSelectedId(d.id);
        };
        const delEl = () => {
          if (!el) return;
          pushHistory(); patchElements(prev => prev.filter(e => e.id !== el.id)); setSelectedId(null);
        };
        const pasteEl = () => {
          if (!clipboard) return;
          pushHistory();
          if (Array.isArray(clipboard)) {
            const newEls = clipboard.map(el => ({ ...JSON.parse(JSON.stringify(el)), id: uid(), x: el.x + 20, y: el.y + 20 }));
            patchElements(prev => [...prev, ...newEls]);
            const newIds = newEls.map(e => e.id);
            setSelectedIds(newIds); setSelectedId(newIds[newIds.length - 1]);
          } else {
            const p = { ...JSON.parse(JSON.stringify(clipboard)), id: uid(), x: clipboard.x + 20, y: clipboard.y + 20 };
            patchElements(prev => [...prev, p]); setSelectedId(p.id);
          }
        };

        const ITEMS = [
          el && { label: 'Copy',          shortcut: 'Ctrl+C', fn: () => setClipboard(JSON.parse(JSON.stringify(el))) },
          clipboard && { label: Array.isArray(clipboard) && clipboard.length > 1 ? `Paste ${clipboard.length} items` : 'Paste', shortcut: 'Ctrl+V', fn: pasteEl },
          clipboard && { label: 'Paste in place', shortcut: 'Ctrl+⇧V', fn: () => {
            if (!clipboard) return;
            pushHistory();
            if (Array.isArray(clipboard)) {
              const newEls = clipboard.map(el => ({ ...JSON.parse(JSON.stringify(el)), id: uid() }));
              patchElements(prev => [...prev, ...newEls]);
              const newIds = newEls.map(e => e.id);
              setSelectedIds(newIds); setSelectedId(newIds[newIds.length - 1]);
            } else {
              const p = { ...JSON.parse(JSON.stringify(clipboard)), id: uid() };
              patchElements(prev => [...prev, p]); setSelectedId(p.id);
            }
          }},
          el && { label: 'Duplicate',     shortcut: 'Ctrl+D', fn: dupEl },
          (el || clipboard) && { sep: true },
          el && { label: 'Bring Forward', shortcut: ']',      fn: () => bringForward(el.id) },
          el && { label: 'Send Backward', shortcut: '[',      fn: () => sendBackward(el.id) },
          el && { label: 'Bring to Front',shortcut: 'Shift+]',fn: () => bringToFront(el.id) },
          el && { label: 'Send to Back',  shortcut: 'Shift+[',fn: () => sendToBack(el.id) },
          el && { sep: true },
          el && el.type === 'group' && { label: 'Ungroup', shortcut: 'Ctrl+⇧G', fn: () => ungroupSelected() },
          el && el.type === 'image' && { label: '🖼 Set as background', fn: () => setElementAsBackground(el) },
          el && pages.length > 1 && { label: 'Add to all pages', fn: () => addElToAllPages(el.id) },
          (el?.type === 'group' || el?.type === 'image' || pages.length > 1) && el && { sep: true },
          el && { label: isLocked ? 'Unlock' : 'Lock',        fn: () => toggleLocked(el.id) },
          el && { label: isHidden ? 'Show'   : 'Hide',        fn: () => toggleHidden(el.id) },
          el && { sep: true },
          el && { label: 'Delete', shortcut: 'Del', fn: delEl, danger: true },
        ].filter(Boolean);

        return (
          <>
            {/* Invisible overlay to close on outside click */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 999 }}
              onMouseDown={close}
              onContextMenu={e => { e.preventDefault(); close(); }}
            />
            {/* Menu */}
            <div style={{
              position: 'fixed', left: mx, top: my,
              width: menuW, background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
              zIndex: 1000, overflow: 'hidden',
              padding: '4px 0',
              animation: 'contextIn 100ms ease forwards',
            }}>
              {ITEMS.map((item, i) =>
                item.sep ? (
                  <div key={i} style={{ height: 1, background: t.border, margin: '4px 0' }} />
                ) : (
                  <button key={i}
                    onMouseDown={e => { e.stopPropagation(); item.fn(); close(); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 14px', border: 'none', background: 'transparent',
                      color: item.danger ? t.error : t.text,
                      fontSize: 13, cursor: 'pointer', textAlign: 'left',
                      transition: 'background 60ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = item.danger ? t.errorBg : t.input; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 12, flexShrink: 0 }}>{item.shortcut}</span>
                    )}
                  </button>
                )
              )}
            </div>
          </>
        );
      })()}

      {/* ── Post modal ── */}
      {postModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: t.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, border: `1px solid ${t.border}` }}>
            {postSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 8 }}>Posted!</div>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Your template has been posted.</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setPostModalOpen(false); setPostSuccess(false); router.push('/media?tab=templates'); }}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: t.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    View Templates
                  </button>
                  <button onClick={() => { setPostModalOpen(false); setPostSuccess(false); }}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: t.input, color: t.text, border: `1px solid ${t.border}`, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Keep Editing
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>Post Your Graphic</h3>
                  <button onClick={() => setPostModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 20 }}>×</button>
                </div>
                <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 6 }}>Caption (optional)</label>
                <textarea value={postCaption} onChange={e => setPostCaption(e.target.value)} rows={3} placeholder="Add a caption..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
                <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 8 }}>Platforms</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {['facebook', 'instagram', 'google_business'].map(p => {
                    const active = postPlatforms.includes(p);
                    return (
                      <button key={p} onClick={() => setPostPlatforms(prev => active ? prev.filter(x => x !== p) : [...prev, p])}
                        style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: `1px solid ${active ? t.primary : t.border}`, background: active ? t.primaryBg : 'transparent', color: active ? t.primary : t.textMuted, cursor: 'pointer', fontWeight: 500, textTransform: 'capitalize' }}>
                        {p.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
                {postError && <div style={{ background: t.errorBg, color: t.error, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{postError}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setPostModalOpen(false)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: t.input, color: t.text, border: `1px solid ${t.border}`, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handlePost} disabled={posting || postPlatforms.length === 0}
                    style={{ flex: 2, padding: '10px 0', borderRadius: 8, background: postPlatforms.length === 0 ? t.textDisabled : t.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: posting || postPlatforms.length === 0 ? 'not-allowed' : 'pointer' }}>
                    {posting ? 'Posting...' : 'Post Now'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tooltip ── */}
      {tip && (
        <div style={{
          position: 'fixed', left: tip.x, top: tip.y,
          transform: 'translateX(-50%)',
          background: 'rgba(17,24,39,0.92)', color: '#fff',
          padding: '5px 10px', borderRadius: 6, fontSize: 12,
          pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          lineHeight: 1.4,
        }}>
          {tip.text}
          {tip.shortcut && (
            <kbd style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 3, padding: '1px 5px', fontSize: 11,
              fontFamily: 'monospace',
            }}>
              {tip.shortcut}
            </kbd>
          )}
        </div>
      )}

      {/* Hidden file input for upload-from-device (File menu → Upload files) */}
      <input ref={uploadFileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) addImageElement(URL.createObjectURL(f));
          e.target.value = '';
        }} />

      {/* Hidden file input for image replace (Replace button + double-click) */}
      <input ref={replaceFileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          const targetId = replaceImgId.current || selectedId;
          if (!f || !targetId) return;
          const reader = new FileReader();
          reader.onload = ev => {
            pushHistory();
            patchElements(prev => prev.map(el => el.id === targetId ? { ...el, src: ev.target.result } : el));
          };
          reader.readAsDataURL(f);
          e.target.value = '';
          replaceImgId.current = null;
        }} />

      {/* ── Design card hover preview ── */}
      {hoveredDesign && (
        <div style={{
          position: 'fixed',
          left: Math.min(hoveredDesign.x, window.innerWidth - 200),
          top: Math.max(8, Math.min(hoveredDesign.y, window.innerHeight - 130)),
          width: 180,
          background: 'rgba(17,24,39,0.96)',
          color: '#fff',
          borderRadius: 10,
          padding: '12px 14px',
          zIndex: 9998,
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          animation: 'panel-in 120ms ease forwards',
        }}>
          <div style={{ aspectRatio: '4/5', borderRadius: 6, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            {hoveredDesign.title}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hoveredDesign.title}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 3 }}>{canvasSize.w}×{canvasSize.h}px</div>
          {hoveredDesign.pagesCount > 1 && (
            <div style={{ fontSize: 11, color: '#7C5CFC' }}>{hoveredDesign.pagesCount} pages</div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Click to open</div>
        </div>
      )}

      {/* ── Share panel ── */}
      {shareOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setShareOpen(false)} />
          <div style={{ position: 'fixed', top: 56, right: 0, width: 380, height: 'calc(100vh - 56px)', background: t.card, borderLeft: `1px solid ${t.border}`, zIndex: 300, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', animation: 'slideInRight 200ms ease forwards' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 18, color: t.text }}>Share design</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: t.textMuted }}>📊 0 visitors</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 16 }}>⚙</button>
                <button onClick={() => setShareOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 20, lineHeight: 1 }}>×</button>
              </div>
            </div>
            {/* People with access */}
            <div>
              <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 14, color: t.text }}>People with access</div>
              <input placeholder="Add people, groups or teams" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {/* Access level */}
            <div>
              <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 14, color: t.text }}>Access level</div>
              <select style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none' }}>
                <option>Only you can access</option>
                <option>Anyone with the link can view</option>
                <option>Anyone with the link can edit</option>
              </select>
            </div>
            {/* Copy link */}
            <button onClick={() => { navigator.clipboard?.writeText(window.location.href); }}
              style={{ background: t.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              🔗 Copy link
            </button>
            {/* Custom link */}
            <button style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px', color: t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              + Create custom link <span style={{ fontSize: 12 }}>👑</span>
            </button>
            {/* Divider */}
            <div style={{ borderTop: `1px solid ${t.border}` }} />
            {/* Action grid — 48px circles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: 'Download',      bg: '#F2F2F7', action: () => { downloadCanvas('image/png', 'png', 1); setShareOpen(false); },
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
                { label: 'Present',       bg: t.primary, action: () => { setPreviewOpen(true); setShareOpen(false); },
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
                { label: 'Public',        bg: '#F2F2F7', action: () => {},
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
                { label: 'Template link', bg: '#F2F2F7', pro: true, action: () => {},
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
              ].map(o => (
                <div key={o.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
                  <button onClick={o.action}
                    style={{ width: 48, height: 48, borderRadius: '50%', background: o.bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 150ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 150ms ease', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)'; }}>
                    {o.icon}
                    {o.pro && <span style={{ position: 'absolute', top: -2, right: -2, fontSize: 10 }}>👑</span>}
                  </button>
                  <span style={{ fontSize: 11, color: t.textMuted, textAlign: 'center', lineHeight: 1.2 }}>{o.label}</span>
                </div>
              ))}
            </div>
            {/* Save button */}
            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
              <button onClick={() => { handleSave(); setShareOpen(false); }} disabled={saving}
                style={{ width: '100%', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px', color: t.text, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : '💾 Save design'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Find & Replace panel ── */}
      {showFindReplace && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 599 }} onClick={() => setShowFindReplace(false)} />
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'fixed', top: 60, right: 16, width: 320, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, zIndex: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: t.text }}>Find & Replace</span>
              <button onClick={() => setShowFindReplace(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Find</div>
              <input autoFocus value={findText} onChange={e => { setFindText(e.target.value); setFrMatchCount(0); }}
                placeholder="Search text…"
                onKeyDown={e => { if (e.key === 'Enter') { pushHistory(); const n = findReplaceAll(findText, replaceText); if (!n) setFrMatchCount(-1); } if (e.key === 'Escape') setShowFindReplace(false); }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Replace with</div>
              <input value={replaceText} onChange={e => setReplaceText(e.target.value)}
                placeholder="Replacement…"
                onKeyDown={e => { if (e.key === 'Enter') { pushHistory(); const n = findReplaceAll(findText, replaceText); if (!n) setFrMatchCount(-1); } if (e.key === 'Escape') setShowFindReplace(false); }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {frMatchCount !== 0 && (
              <div style={{ marginBottom: 8, fontSize: 12, color: frMatchCount > 0 ? '#10b981' : t.textMuted }}>
                {frMatchCount > 0 ? `✓ Replaced ${frMatchCount} occurrence${frMatchCount > 1 ? 's' : ''}` : 'No matches found'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { pushHistory(); const n = findReplaceAll(findText, replaceText); if (!n) setFrMatchCount(-1); }}
                disabled={!findText}
                style={{ flex: 1, background: findText ? t.primary : t.input, color: findText ? '#fff' : t.textMuted, border: 'none', borderRadius: 7, padding: '9px 0', fontWeight: 600, fontSize: 13, cursor: findText ? 'pointer' : 'not-allowed', opacity: findText ? 1 : 0.6 }}>
                Replace all
              </button>
              <button onClick={() => setShowFindReplace(false)}
                style={{ padding: '9px 14px', background: t.input, color: t.text, border: `1px solid ${t.border}`, borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Preview modal ── */}
      {previewOpen && (
        <div
          onClick={() => { setPreviewOpen(false); setPresentPlaying(false); }}
          style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center' }}
        >
          {/* Close */}
          <button onClick={() => { setPreviewOpen(false); setPresentPlaying(false); }}
            style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', width:38, height:38, borderRadius:'50%', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>
            ✕
          </button>

          {/* Page counter + auto-play controls */}
          <div style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:8 }} onClick={e => e.stopPropagation()}>
            {pages.length > 1 && (
              <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:20, padding:'4px 14px', color:'#fff', fontSize:13 }}>
                {activePage + 1} / {pages.length}
              </div>
            )}
            {pages.length > 1 && (
              <>
                <button onClick={() => setPresentPlaying(p => !p)}
                  title={presentPlaying ? 'Pause' : 'Auto-play slides'}
                  style={{ background: presentPlaying ? '#7C5CFC' : 'rgba(255,255,255,0.12)', border:'none', color:'#fff', width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {presentPlaying ? '⏸' : '▶'}
                </button>
                <select value={presentInterval} onChange={e => setPresentInterval(+e.target.value)}
                  style={{ background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', borderRadius:16, padding:'4px 8px', fontSize:12, cursor:'pointer', outline:'none' }}>
                  {[2,3,5,8,10].map(s => <option key={s} value={s} style={{ background:'#1e1e28' }}>{s}s</option>)}
                </select>
              </>
            )}
          </div>

          {/* Canvas image */}
          {previewUrl
            ? <img key={previewUrl} src={previewUrl} onClick={e => e.stopPropagation()}
                style={{ maxWidth:'85vw', maxHeight:'85vh', objectFit:'contain', borderRadius:6, boxShadow:'0 20px 60px rgba(0,0,0,0.5)', animation:'preview-fade 220ms cubic-bezier(0.2,0,0,1) forwards' }} />
            : <div style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>Rendering…</div>
          }

          {/* Left arrow */}
          {pages.length > 1 && activePage > 0 && (
            <button onClick={e => { e.stopPropagation(); setActivePage(i => i - 1); }}
              style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', width:44, height:44, borderRadius:'50%', cursor:'pointer', fontSize:22, display:'flex', alignItems:'center', justifyContent:'center' }}>
              ‹
            </button>
          )}

          {/* Right arrow */}
          {pages.length > 1 && activePage < pages.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setActivePage(i => i + 1); }}
              style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', width:44, height:44, borderRadius:'50%', cursor:'pointer', fontSize:22, display:'flex', alignItems:'center', justifyContent:'center' }}>
              ›
            </button>
          )}
        </div>
      )}


    </div>
    </DocColorsCtx.Provider>
  );
}
