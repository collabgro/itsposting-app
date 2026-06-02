import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpPublish as UploadIcon, IpPhoto as ImageIcon,
  IpCalendar as CalendarIcon, IpSave, IpFacebook, IpInstagram, IpGoogle,
  IpLinkedIn, IpTikTok, IpFolderOpen, IpClose, IpSparkle, IpPlay,
} from '../components/icons';
import Layout from '../components/Layout';
import ImageEditor from '../components/ImageEditor';
import { Card, Button, Input, Textarea, SectionHeader, Skeleton, EmptyState } from '../components/ui';
import { useTheme } from '../lib/theme';
import { mediaAPI, uploadAPI, socialAPI, analyticsAPI, scraperAPI } from '../lib/api';
import {
  CHAR_LIMITS, PLATFORM_META, MOCKUP_MAP,
} from '../components/PostMockups';

const EMOJI_CATEGORIES = [
  { label: 'Smileys', emojis: ['😀','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤭','🤫','🤔','🤐','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'] },
  { label: 'Gestures', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🙏','🤝','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁️','👅','👄'] },
  { label: 'People', emojis: ['👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷','👮','🕵️','💂','🥷','👷','🤴','👸','👳','👲','🧕','🤵','👰','🤰','🤱','👼','🎅','🤶','🦸','🦹','🧙','🧝','🧛','🧟','🧞','🧜','🧚','👫','👬','👭','💏','💑','👨‍👩‍👦','👨‍👩‍👧','🧑‍🤝‍🧑'] },
  { label: 'Hearts & Symbols', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','✡️','🔯','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','⛎','🔀','🔁','🔂','▶️','⏩','⏫','🔼','⏭️','⏹️','⏸️','⏺️','⏏️','🎦','🔅','🔆','📶','📳','📴','♻️','🔱','📛','🔰','⭕','✅','☑️','✔️','❌','❎','➕','➖','➗','➰','➿','❓','❔','❕','❗','‼️','⚡','🔥','💥','⭐','🌟','✨','💫','🎵','🎶','🎸'] },
  { label: 'Nature', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🌸','🌺','🌻','🌹','🌷','🌼','🌾','🍀','🌿','🌱','🌲','🌳','🌴','🌵','☘️','🍃','🍂','🍁','🍄','🌊','💧','🌙','☀️','🌤️','⛅','🌦️','🌧️','⛈️','❄️','🌈','🌪️','🌫️','🌍','🌎','🌏','🏔️','⛰️','🌋','🏕️','🏖️','🏜️','🏝️'] },
  { label: 'Food & Drink', emojis: ['🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥦','🥬','🥒','🌽','🥕','🧅','🧄','🥔','🍠','🥜','🌰','🍞','🥐','🥖','🫓','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫔','🌮','🌯','🥙','🧆','🥚','🥘','🍲','🫕','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🦪','🍣','🍤','🍙','🥟','🦞','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾'] },
  { label: 'Travel & Places', emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣️','🛤️','⛽','🛞','🚨','🚥','🚦','🛑','🚧','⚓','🛟','⛵','🚤','🛥️','🛳️','⛴️','🚢','✈️','🛩️','🛫','🛬','🛰️','🚀','🛸','🚁','🛶','⛺','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🕍','⛩️','🕋','⛲','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🗺️','🧭'] },
  { label: 'Activities', emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥍','🏑','🥊','🥋','🎯','⛳','🎣','🤿','🎽','🎿','🛷','🥌','🎮','🕹️','🎲','♟️','🎭','🎨','🧵','🧶','🎻','🎸','🎹','🥁','🎷','🎺','🎤','🎧','🎼','🎙️','📻','🎬','🎥','📽️','🎞️','📺','🎪','🤹','🎠','🎡','🎢','🎀','🎁','🎊','🎉','🎈','🎋','🎍','🎑','🧧','🎏','🎐','🧨','🎆','🎇','✨','🎃','🎄','🎋','🎍'] },
  { label: 'Objects', emojis: ['📱','💻','🖥️','🖨️','⌨️','🖱️','🖲️','💽','💾','💿','📀','📷','📸','📹','🎥','📽️','📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','💰','💳','💵','💴','💶','💷','💸','💹','✉️','📧','📨','📩','📤','📥','📦','📫','📪','📬','📭','📮','🗳️','✏️','✒️','🖊️','🖋️','📝','📁','📂','🗂️','📅','📆','📇','📈','📉','📊','📋','📌','📍','📎','🖇️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️','🔨','🪓','⛏️','⚒️','🛠️','🗡️','⚔️','🔧','🔩','🗜️','⚙️','🔗','⛓️','🪝','🧲','🔫','🧨','💣','🪃','🏹','🛡️','🪚','🔬','🔭','📡','💊','🩺','🩻','🌡️','🧬','🦠','🧪','🧫','🔑','🪞','🪟','🛋️','🪑','🚿','🛁','🪠','🧴','🧷','🧹','🧺','🧻','🪣','🧼','🫧','🪥','🧽','🪒','🛒','🚪','🪤','🧸','🪆','🖼️','🪄','🎩','🧢','👒','🎓','⛑️','💄','💍','👛','👜','🎒','🧳'] },
  { label: 'Business & Work', emojis: ['💼','📊','📈','📉','🗂️','📋','📌','📍','📎','✂️','🖊️','✏️','📝','💡','🔍','🔎','🏆','🥇','🎯','✅','❌','⚠️','🔔','🔕','📢','📣','🗣️','💬','💭','🤝','🙌','👏','💪','🧠','💰','💵','💳','📱','💻','⌚','📞','✉️','📧','📅','🗓️','⏰','🔑','🔒','🏠','🏢','🏗️','🔨','🔧','⚙️','🛠️','🚀','⭐','🌟','✨','💫','🔥','🎉','🎊','🏅','🎗️','🎁','🎀'] },
];


const FB_BG_OPTIONS = [
  { id: 'none',     label: 'None',     css: null,                                              bg: null,      text: '#1c1e21' },
  // Gradient backgrounds (matching Facebook's native colored-background text post styles)
  { id: 'sunrise',  label: 'Sunrise',  css: 'linear-gradient(135deg,#FF6B35,#FF4785)',         bg: null,      text: '#fff'    },
  { id: 'golden',   label: 'Golden',   css: 'linear-gradient(135deg,#F7C948,#FF8C00)',         bg: null,      text: '#1c1e21' },
  { id: 'coral',    label: 'Coral',    css: 'linear-gradient(135deg,#FF6B6B,#FE8C4B)',         bg: null,      text: '#fff'    },
  { id: 'rose',     label: 'Rose',     css: 'linear-gradient(135deg,#F43F5E,#EC4899)',         bg: null,      text: '#fff'    },
  { id: 'violet',   label: 'Violet',   css: 'linear-gradient(135deg,#8B5CF6,#EC4899)',         bg: null,      text: '#fff'    },
  { id: 'ocean',    label: 'Ocean',    css: 'linear-gradient(135deg,#4FACFE,#00F2FE)',         bg: null,      text: '#fff'    },
  { id: 'sky',      label: 'Sky',      css: 'linear-gradient(135deg,#6EE7F7,#3B82F6)',         bg: null,      text: '#fff'    },
  { id: 'lavender', label: 'Lavender', css: 'linear-gradient(135deg,#C084FC,#7C3AED)',         bg: null,      text: '#fff'    },
  { id: 'midnight', label: 'Midnight', css: 'linear-gradient(135deg,#1A1A2E,#0F3460)',         bg: null,      text: '#fff'    },
  { id: 'forest',   label: 'Forest',   css: 'linear-gradient(135deg,#134E5E,#71B280)',         bg: null,      text: '#fff'    },
  { id: 'mint',     label: 'Mint',     css: 'linear-gradient(135deg,#23D5AB,#23A6D5)',         bg: null,      text: '#fff'    },
  { id: 'peach',    label: 'Peach',    css: 'linear-gradient(135deg,#FFDAB9,#FF9A8B)',         bg: null,      text: '#1c1e21' },
  { id: 'aurora',   label: 'Aurora',   css: 'linear-gradient(135deg,#43E97B,#38F9D7)',         bg: null,      text: '#fff'    },
  // Solid colors
  { id: 'yellow',   label: 'Yellow',   css: null,                                              bg: '#F5E642', text: '#1c1e21' },
  { id: 'orange',   label: 'Orange',   css: null,                                              bg: '#F08C00', text: '#fff'    },
  { id: 'red',      label: 'Red',      css: null,                                              bg: '#E24444', text: '#fff'    },
  { id: 'crimson',  label: 'Crimson',  css: null,                                              bg: '#9F1239', text: '#fff'    },
  { id: 'purple',   label: 'Purple',   css: null,                                              bg: '#7B5AF6', text: '#fff'    },
  { id: 'blue',     label: 'Blue',     css: null,                                              bg: '#4E7BF6', text: '#fff'    },
  { id: 'navy',     label: 'Navy',     css: null,                                              bg: '#1E3A5F', text: '#fff'    },
  { id: 'green',    label: 'Green',    css: null,                                              bg: '#5FBF5E', text: '#fff'    },
  { id: 'teal',     label: 'Teal',     css: null,                                              bg: '#4EB7C4', text: '#fff'    },
  { id: 'pink',     label: 'Pink',     css: null,                                              bg: '#EC4899', text: '#fff'    },
  { id: 'dark',     label: 'Dark',     css: null,                                              bg: '#2E2E2E', text: '#fff'    },
  { id: 'white',    label: 'White',    css: null,                                              bg: '#FFFFFF', text: '#1c1e21' },
];

const toUnicodeBold = (text) => [...text].map(c => {
  const cap = c.charCodeAt(0) - 65;
  const low = c.charCodeAt(0) - 97;
  const dig = c.charCodeAt(0) - 48;
  if (cap >= 0 && cap < 26) return String.fromCodePoint(0x1D400 + cap);
  if (low >= 0 && low < 26) return String.fromCodePoint(0x1D41A + low);
  if (dig >= 0 && dig < 10) return String.fromCodePoint(0x1D7CE + dig);
  return c;
}).join('');

const toUnicodeItalic = (text) => {
  const exc = { H: 'ℋ', I: 'ℑ', L: 'ℒ', R: 'ℛ', Z: 'ℨ', e: 'ℯ', g: 'ℊ', h: 'ℎ' };
  return [...text].map(c => {
    if (exc[c]) return exc[c];
    const cap = c.charCodeAt(0) - 65;
    const low = c.charCodeAt(0) - 97;
    if (cap >= 0 && cap < 26) return String.fromCodePoint(0x1D434 + cap);
    if (low >= 0 && low < 26) return String.fromCodePoint(0x1D44E + low);
    return c;
  }).join('');
};


const PLATFORMS = [
  { id: 'facebook',        name: 'Facebook',         icon: IpFacebook },
  { id: 'instagram',       name: 'Instagram',        icon: IpInstagram },
  { id: 'linkedin',        name: 'LinkedIn',         icon: IpLinkedIn },
  { id: 'tiktok',          name: 'TikTok',           icon: IpTikTok },
  { id: 'google_business', name: 'Google Business',  icon: IpGoogle },
];
const ALL_PLATFORM_IDS = PLATFORMS.map(p => p.id);

const TIME_SLOTS = [
  { label: '8 AM',  value: '08:00' },
  { label: '9 AM',  value: '09:00' },
  { label: '10 AM', value: '10:00' },
  { label: '12 PM', value: '12:00' },
  { label: '1 PM',  value: '13:00' },
  { label: '3 PM',  value: '15:00' },
  { label: '5 PM',  value: '17:00' },
  { label: '6 PM',  value: '18:00' },
];

export default function Upload() {
  const router = useRouter();
  const { t } = useTheme();
  const fileInputRef = useRef(null);
  const accountDropdownRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [contentType, setContentType] = useState('photo');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [platforms, setPlatforms] = useState(['facebook', 'instagram']);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [accountGroups, setAccountGroups] = useState([]);
  const [customCaptionsEnabled, setCustomCaptionsEnabled] = useState(false);
  const [platformCaptions, setPlatformCaptions] = useState({});
  const [activePlatformTab, setActivePlatformTab] = useState(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const locationTimerRef = useRef(null);
  const [previewPlatform, setPreviewPlatform] = useState('all');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleMode, setScheduleMode] = useState('now');
  const [uploading, setUploading] = useState(false);
  const [bestTimes, setBestTimes] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [libraryFolders, setLibraryFolders] = useState([]);
  const [libraryFolder, setLibraryFolder] = useState(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const captionRef = useRef(null);
  const postDropdownRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiPortalRef = useRef(null);
  const bgPickerRef = useRef(null);   // "A" button wrapper
  const bgPortalRef = useRef(null);   // picker portal at root level
  const libraryFileInputRef = useRef(null);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpComment, setFollowUpComment] = useState('');
  const [mediaOptimization, setMediaOptimization] = useState(true);
  const [postDropdownOpen, setPostDropdownOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPos, setEmojiPickerPos] = useState({ top: 0, left: 0 });
  const [fbPostFormat, setFbPostFormat] = useState('feed');
  const [igPostFormat, setIgPostFormat] = useState('feed');
  const [igCollaborator, setIgCollaborator] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkTargetUrl, setLinkTargetUrl] = useState('');
  const [linkUtmCampaign, setLinkUtmCampaign] = useState('');
  const [linkUtmSource, setLinkUtmSource] = useState('social');
  const [linkUtmMedium, setLinkUtmMedium] = useState('');
  const [linkCustomParams, setLinkCustomParams] = useState([]);
  const [linkPreviewUrl, setLinkPreviewUrl] = useState(null);
  const [linkPreviewData, setLinkPreviewData] = useState(null);
  const [linkPreviewDismissed, setLinkPreviewDismissed] = useState(false);
  const [fbBgColor, setFbBgColor] = useState(null);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [bgPickerPos, setBgPickerPos] = useState({ top: 0, right: 0 });
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const locationPopupRef = useRef(null);
  const [imageEditorIdx, setImageEditorIdx] = useState(null);
  const [editDropdownIdx, setEditDropdownIdx] = useState(null);
  const [editDropdownAnchor, setEditDropdownAnchor] = useState({ top: 0, right: 0 });
  const [libraryUploadType, setLibraryUploadType] = useState('image');
  const [replaceFileIdx, setReplaceFileIdx] = useState(null);
  const draggedIdxRef = useRef(null);
  const replaceFileInputRef = useRef(null);

  useEffect(() => {
    if (!router.isReady) return;
    const { scheduleDate: qDate } = router.query;
    if (qDate) {
      setScheduleDate(qDate);
      setScheduleMode('scheduled');
    }
  }, [router.isReady]);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    if (!localStorage.getItem('token')) { router.replace('/login'); return; }

    // Load best times for the schedule section
    analyticsAPI.getOptimalTimes().then(res => {
      setBestTimes((res.data?.recommendations || []).slice(0, 3));
    }).catch(() => {});

    // Load connected social accounts and groups for the account picker
    Promise.all([
      socialAPI.getAccounts(),
      socialAPI.getGroups().catch(() => ({ data: [] })),
    ]).then(([accountsRes, groupsRes]) => {
      const accounts = accountsRes.data || [];
      setSocialAccounts(accounts);
      setAccountGroups(groupsRes.data || []);
      // Default-select all enabled accounts
      setSelectedAccountIds(accounts.filter(a => a.enabled).map(a => a.id));
      // Sync platforms state for charLimit/previewPlatform
      const uniquePlatforms = [...new Set(accounts.filter(a => a.enabled).map(a => a.platform))];
      if (uniquePlatforms.length) setPlatforms(uniquePlatforms);
    }).catch(() => {});

    const uploadPrefill = sessionStorage.getItem('uploadPrefill');
    if (uploadPrefill) {
      try {
        const data = JSON.parse(uploadPrefill);
        const tagStr = data.hashtags?.length ? '\n' + data.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') : '';
        if (data.caption) setCaption(data.caption + tagStr);
        else if (tagStr) setCaption(tagStr.trim());
        sessionStorage.removeItem('uploadPrefill');
      } catch {}
    }

    const preSelected = sessionStorage.getItem('selectedMediaFile');
    if (preSelected) {
      try {
        const file = JSON.parse(preSelected);
        setContentType(file.file_type === 'video' ? 'video' : 'photo');
        setPreviews([file.url]);
        setFiles([{ libraryFileId: file.id, url: file.url, type: file.file_type, name: file.file_name }]);
        sessionStorage.removeItem('selectedMediaFile');
      } catch {}
    }
    const quickPostData = sessionStorage.getItem('quickPostData');
    if (quickPostData) {
      try {
        const data = JSON.parse(quickPostData);
        const tagStr = data.hashtags?.length ? '\n' + data.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') : '';
        if (data.caption) setCaption(data.caption + tagStr);
        else if (tagStr) setCaption(tagStr.trim());
        if (data.platforms?.length) setPlatforms(data.platforms.filter(p => p !== 'all'));
        sessionStorage.removeItem('quickPostData');
      } catch {}
    }
    const wizardPost = sessionStorage.getItem('wizardPost');
    if (wizardPost) {
      try {
        const data = JSON.parse(wizardPost);
        const tagStr = data.hashtags?.length ? '\n' + data.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') : '';
        if (data.caption) setCaption(data.caption + tagStr);
        else if (tagStr) setCaption(tagStr.trim());
        if (data.platform) setPlatforms([data.platform]);
        sessionStorage.removeItem('wizardPost');
      } catch {}
    }

    return () => {
      window.removeEventListener('resize', checkMobile);
      clearTimeout(locationTimerRef.current);
    };
  }, []);

  // Close account dropdown when clicking outside
  useEffect(() => {
    if (!accountDropdownOpen) return;
    const handler = (e) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) {
        setAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [accountDropdownOpen]);

  useEffect(() => {
    if (!postDropdownOpen) return;
    const handler = (e) => {
      if (postDropdownRef.current && !postDropdownRef.current.contains(e.target)) setPostDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [postDropdownOpen]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e) => {
      const inButton = emojiPickerRef.current?.contains(e.target);
      const inPortal = emojiPortalRef.current?.contains(e.target);
      if (!inButton && !inPortal) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!showBgPicker) return;
    const handler = (e) => {
      const inBtn    = bgPickerRef.current && bgPickerRef.current.contains(e.target);
      const inPortal = bgPortalRef.current && bgPortalRef.current.contains(e.target);
      if (!inBtn && !inPortal) setShowBgPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBgPicker]);

  // Detect first URL in caption → fetch OG preview
  useEffect(() => {
    const urlMatch = caption.match(/https?:\/\/[^\s"'<>]{6,}/);
    const detected = urlMatch ? urlMatch[0] : null;
    if (!detected || detected === linkPreviewUrl) return;
    if (linkPreviewDismissed && detected === linkPreviewUrl) return;
    setLinkPreviewUrl(detected);
    setLinkPreviewData(null);
    setLinkPreviewDismissed(false);
    const tid = setTimeout(() => {
      scraperAPI.getOG(detected)
        .then(r => { if (r.data?.title || r.data?.description || r.data?.image) setLinkPreviewData(r.data); })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(tid);
  }, [caption]);

  useEffect(() => {
    if (editDropdownIdx === null) return;
    const handler = () => setEditDropdownIdx(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editDropdownIdx]);

  useEffect(() => {
    if (!showLocationPopup) return;
    const handler = (e) => {
      if (locationPopupRef.current && !locationPopupRef.current.contains(e.target)) setShowLocationPopup(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLocationPopup]);

  const handleLibraryUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data } = await uploadAPI.uploadMedia(file);
      setFiles(prev => [...prev, { libraryFileId: data.id || null, url: data.url, type: data.type || (file.type.startsWith('video') ? 'video' : 'image'), name: file.name }]);
      setPreviews(prev => [...prev, data.url]);
    } catch { setMessage({ type: 'error', text: 'Upload failed. Please try again.' }); }
    e.target.value = '';
  };

  const handleReplaceFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || replaceFileIdx === null) return;
    const prevUrl = previews[replaceFileIdx];
    if (prevUrl?.startsWith('blob:')) URL.revokeObjectURL(prevUrl);
    const url = URL.createObjectURL(file);
    setPreviews(prev => prev.map((u, i) => i === replaceFileIdx ? url : u));
    setFiles(prev => prev.map((f, i) => i === replaceFileIdx ? file : f));
    setReplaceFileIdx(null);
    e.target.value = '';
  };

  const handleDragStart = (idx) => { draggedIdxRef.current = idx; };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = draggedIdxRef.current;
    if (fromIdx == null || fromIdx === dropIdx) { draggedIdxRef.current = null; return; }
    const nf = [...files]; const np = [...previews];
    const [fi] = nf.splice(fromIdx, 1); const [pi] = np.splice(fromIdx, 1);
    nf.splice(dropIdx, 0, fi); np.splice(dropIdx, 0, pi);
    setFiles(nf); setPreviews(np);
    draggedIdxRef.current = null;
  };

  // Keep previewPlatform in sync with selected platforms
  useEffect(() => {
    if (previewPlatform === 'all') return;
    if (!platforms.includes(previewPlatform)) setPreviewPlatform('all');
  }, [platforms]);

  // Keep activePlatformTab in sync — default to first platform
  useEffect(() => {
    if (!activePlatformTab || !platforms.includes(activePlatformTab)) {
      setActivePlatformTab(platforms[0] || null);
    }
  }, [platforms]);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;

    // Appending to an existing carousel — don't replace
    if (files.length > 0 && contentType === 'carousel') {
      const combined = [...files, ...selected];
      if (combined.length > 10) { setMessage({ type: 'error', text: 'Carousel max is 10 images' }); return; }
      setFiles(combined);
      setPreviews(prev => [...prev, ...selected.map(f => URL.createObjectURL(f))]);
      setMessage({ type: '', text: '' });
      e.target.value = '';
      return;
    }

    // Fresh selection — auto-detect type
    if (selected.length > 10) { setMessage({ type: 'error', text: 'Maximum 10 files allowed' }); return; }
    const hasVideo = selected.some(f => f.type.startsWith('video/'));
    const autoType = hasVideo ? 'video' : selected.length > 1 ? 'carousel' : 'photo';
    setContentType(autoType);
    setFiles(selected);
    setPreviews(selected.map(f => URL.createObjectURL(f)));
    setMessage({ type: '', text: '' });
    e.target.value = '';
  };

  const removeFile = (idx) => {
    const url = previews[idx];
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const openLibrary = async () => {
    setShowLibrary(true);
    setLibraryLoading(true);
    setLibraryFolder(null);
    try {
      const [filesRes, foldersRes] = await Promise.all([
        mediaAPI.list({ type: contentType === 'video' ? 'video' : 'image' }),
        mediaAPI.getFolders(),
      ]);
      setLibraryFiles(filesRes.data);
      setLibraryFolders(foldersRes.data);
    } catch {}
    finally { setLibraryLoading(false); }
  };

  const openLibraryForType = async (type) => {
    setShowLibrary(true);
    setLibraryLoading(true);
    setLibraryFolder(null);
    try {
      const [filesRes, foldersRes] = await Promise.all([
        mediaAPI.list({ type }),
        mediaAPI.getFolders(),
      ]);
      setLibraryFiles(filesRes.data.filter(f => f.file_type === type));
      setLibraryFolders(foldersRes.data);
    } catch {}
    finally { setLibraryLoading(false); }
  };

  const selectFromLibrary = (file) => {
    if (files.length > 0) {
      // Already have files — add to carousel
      if (files.length >= 10) { setMessage({ type: 'error', text: 'Carousel max is 10 files' }); return; }
      const newFiles = [...files, { libraryFileId: file.id, url: file.url, type: file.file_type, name: file.file_name }];
      setFiles(newFiles);
      setPreviews(prev => [...prev, file.url]);
      if (newFiles.length > 1) setContentType('carousel');
    } else {
      // First file — auto-detect type
      const autoType = file.file_type === 'video' ? 'video' : 'photo';
      setContentType(autoType);
      setFiles([{ libraryFileId: file.id, url: file.url, type: file.file_type, name: file.file_name }]);
      setPreviews([file.url]);
      setShowLibrary(false);
    }
  };

  const togglePlatform = (id) => {
    setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const toggleAllPlatforms = () => {
    setPlatforms(platforms.length === ALL_PLATFORM_IDS.length ? [] : [...ALL_PLATFORM_IDS]);
  };

  const handleLocationSearch = (val) => {
    setLocationQuery(val);
    if (!val.trim()) { setLocationResults([]); return; }
    clearTimeout(locationTimerRef.current);
    locationTimerRef.current = setTimeout(async () => {
      setLocationSearching(true);
      try {
        const res = await socialAPI.searchLocations(val);
        setLocationResults(res.data?.locations || []);
      } catch { setLocationResults([]); }
      finally { setLocationSearching(false); }
    }, 350);
  };

  const toggleAccount = (id) => {
    setSelectedAccountIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // Keep platforms in sync for charLimit / previewPlatform
      const uniquePlatforms = [...new Set(
        socialAccounts.filter(a => next.includes(a.id)).map(a => a.platform)
      )];
      setPlatforms(uniquePlatforms.length ? uniquePlatforms : []);
      return next;
    });
  };

  const insertIntoCaption = (text) => {
    const el = captionRef.current;
    if (customCaptionsEnabled && activePlatformTab) {
      const platId = activePlatformTab;
      const val = platformCaptions[platId] ?? caption;
      if (el) {
        const start = el.selectionStart ?? val.length;
        const end = el.selectionEnd ?? val.length;
        const newVal = val.substring(0, start) + text + val.substring(end);
        setPlatformCaptions(prev => ({ ...prev, [platId]: newVal }));
        requestAnimationFrame(() => {
          if (captionRef.current) {
            captionRef.current.selectionStart = captionRef.current.selectionEnd = start + text.length;
            captionRef.current.focus();
          }
        });
      } else {
        setPlatformCaptions(prev => ({ ...prev, [platId]: val + text }));
      }
    } else {
      if (el) {
        const start = el.selectionStart ?? caption.length;
        const end = el.selectionEnd ?? caption.length;
        const newVal = caption.substring(0, start) + text + caption.substring(end);
        setCaption(newVal);
        requestAnimationFrame(() => {
          if (captionRef.current) {
            captionRef.current.selectionStart = captionRef.current.selectionEnd = start + text.length;
            captionRef.current.focus();
          }
        });
      } else {
        setCaption(prev => prev + text);
      }
    }
  };

  const applyFormatting = (type) => {
    const el = captionRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start === end) return;
    const selected = caption.substring(start, end);
    const converted = type === 'bold' ? toUnicodeBold(selected) : toUnicodeItalic(selected);
    const newVal = caption.substring(0, start) + converted + caption.substring(end);
    setCaption(newVal);
    requestAnimationFrame(() => {
      if (captionRef.current) {
        captionRef.current.selectionStart = start;
        captionRef.current.selectionEnd = start + converted.length;
        captionRef.current.focus();
      }
    });
  };

  const togglePlatformGroup = (platId, platAccounts, allSelected) => {
    setSelectedAccountIds(prev => {
      const enabledIds = platAccounts.filter(a => a.enabled).map(a => a.id);
      const next = allSelected
        ? prev.filter(id => !platAccounts.some(a => a.id === id))
        : [...new Set([...prev, ...enabledIds])];
      const uniquePlatforms = [...new Set(socialAccounts.filter(a => next.includes(a.id)).map(a => a.platform))];
      setPlatforms(uniquePlatforms.length ? uniquePlatforms : []);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (contentType === 'carousel' && files.length > 0 && files.length < 2) { setMessage({ type: 'error', text: 'Carousel needs at least 2 images' }); return; }
    if (!caption.trim()) { setMessage({ type: 'error', text: 'Caption is required' }); return; }
    const hasSelection = selectedAccountIds.length > 0 || platforms.length > 0;
    if (!hasSelection) { setMessage({ type: 'error', text: 'Select at least one account' }); return; }
    if (scheduleMode === 'later' && !scheduleDate) { setMessage({ type: 'error', text: 'Pick a date to schedule' }); return; }

    const scheduledDateTime = scheduleMode === 'later' && scheduleDate
      ? `${scheduleDate}T${scheduleTime}:00` : null;

    setUploading(true);
    setMessage({ type: 'info', text: files.length > 0 ? 'Uploading files...' : 'Creating post...' });

    try {
      let mediaUrl = null;
      let mediaUrls = null;
      // FB background = always text-only — image generated server-side; skip any leftover file state
      // No files = text-only post; use 'static' so backend skips mediaUrl requirement
      // Also force 'static' when no actual media URL ends up being set (safety net for stale file state)
      let resolvedContentType = (fbBgColor || files.length === 0) ? 'static' : contentType;

      if (files.length > 0 && !fbBgColor) {
        if (resolvedContentType === 'carousel') {
          // Each slide handled individually — supports mixed library + new uploads in same carousel
          mediaUrls = await Promise.all(files.map(async (f) => {
            if (f.libraryFileId !== undefined) {
              await mediaAPI.markUsed(f.libraryFileId).catch(() => {});
              return f.url;
            }
            const { data } = await uploadAPI.uploadMedia(f);
            return data.url;
          }));
        } else {
          // Single file (photo or video)
          const f = files[0];
          if (f.libraryFileId !== undefined) {
            mediaUrl = f.url;
            await mediaAPI.markUsed(f.libraryFileId).catch(() => {});
          } else {
            const { data } = await uploadAPI.uploadMedia(f);
            // When media optimization is OFF, post the original unprocessed file.
            // When ON (default), use the platform-optimised universal_feed URL.
            mediaUrl = mediaOptimization ? data.url : (data.originalUrl || data.url);
          }
        }
      }

      // If files were provided but no URL came through (stale/failed entry), treat as text-only
      if (!mediaUrl && !mediaUrls && resolvedContentType !== 'static') resolvedContentType = 'static';

      setMessage({ type: 'info', text: 'Creating post...' });
      const hashtagArr = (caption.match(/#[\w]+/g) || []).map(h => h.replace(/^#/, '')).filter(Boolean);
      const { data: postData } = await uploadAPI.createPost({
        contentType: resolvedContentType, mediaUrl, mediaUrls, caption, hashtags: hashtagArr,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platforms, accountIds: selectedAccountIds,
        platform_captions: customCaptionsEnabled && Object.keys(platformCaptions).length > 0 ? platformCaptions : undefined,
        location_id: selectedLocation?.id || null,
        location_name: selectedLocation?.name || null,
        scheduledDate: scheduledDateTime,
        publishNow: scheduleMode === 'now',
        followUpComment: followUpEnabled && followUpComment.trim() ? followUpComment.trim() : null,
        optimizeMedia: mediaOptimization,
        fbPostFormat, igPostFormat,
        igCollaborator: igCollaborator.trim() || null,
        fbTextBackground: fbBgColor || null,
        status: scheduleMode === 'approval' ? 'pending_approval' : undefined,
      });
      let successMsg, msgType = 'success';
      if (scheduleMode === 'now') {
        const r = postData.publishResult;
        const succeeded = Object.keys(r?.platformPostIds || {});
        const failed = r?.errors || [];
        if (succeeded.length === 0 && failed.length > 0) {
          msgType = 'error';
          successMsg = 'Publish failed: ' + failed.map(e => `${e.platform}: ${e.message}`).join('; ');
        } else if (succeeded.length > 0 && failed.length > 0) {
          successMsg = `Published to ${succeeded.join(', ')}. Failed: ${failed.map(e => e.platform).join(', ')}.`;
        } else if (succeeded.length > 0) {
          successMsg = `Published to ${succeeded.join(', ')}!`;
        } else {
          successMsg = 'Published successfully!';
        }
      } else if (scheduleMode === 'approval') {
        successMsg = 'Sent for approval!';
      } else if (scheduleMode === 'draft') {
        successMsg = 'Saved as draft';
      } else {
        successMsg = 'Scheduled!';
      }
      setMessage({ type: msgType, text: successMsg });
      if (msgType !== 'error') {
        setTimeout(() => {
          setFiles([]); setPreviews([]); setCaption('');
          setScheduleDate(''); setMessage({ type: '', text: '' });
          setFbBgColor(null); setIgCollaborator('');
          if (scheduleMode === 'draft' || scheduleMode === 'approval') {
            router.push('/calendar?view=list');
          } else {
            router.push('/calendar');
          }
        }, 2000);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
    } finally {
      setUploading(false);
    }
  };

  if (!mounted) return null;

  // ── computed ──────────────────────────────────────────────────────────────
  const allSelected = platforms.length === ALL_PLATFORM_IDS.length;
  // Use most restrictive char limit across all selected platforms
  const activeCharPlatforms = platforms.filter(p => CHAR_LIMITS[p]);
  const charLimit = activeCharPlatforms.length > 0
    ? Math.min(...activeCharPlatforms.map(p => CHAR_LIMITS[p]))
    : 63206;
  const charLimitPlatId = activeCharPlatforms.length > 1
    ? activeCharPlatforms.reduce((min, p) => CHAR_LIMITS[p] < CHAR_LIMITS[min] ? p : min)
    : null;
  const overLimitPlatforms = platforms.filter(p => {
    if (!CHAR_LIMITS[p]) return false;
    const text = customCaptionsEnabled ? (platformCaptions[p] ?? caption) : caption;
    return text.length > CHAR_LIMITS[p];
  });

  // Convert dow (0-6 Sun-Sat) + hour → next-occurrence date + time strings
  const bestTimeToDateParts = (dow, hour) => {
    const today = new Date();
    const todayDow = today.getDay();
    let daysAhead = (dow - todayDow + 7) % 7;
    if (daysAhead === 0 && (today.getHours() >= hour)) daysAhead = 7; // already past today
    const target = new Date(today);
    target.setDate(today.getDate() + daysAhead);
    const pad = n => String(n).padStart(2, '0');
    return {
      date: `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`,
      time: `${pad(hour)}:00`,
    };
  };

  const scheduledPreview = scheduleDate && scheduleTime
    ? new Date(`${scheduleDate}T${scheduleTime}`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      + ' at ' + new Date(`${scheduleDate}T${scheduleTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  const quickDates = (() => {
    const today = new Date();
    const fmt = d => d.toISOString().slice(0, 10);
    const result = [
      { label: 'Today',    value: fmt(today) },
      { label: 'Tomorrow', value: (() => { const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d); })() },
    ];
    for (let i = 2; i <= 4; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      result.push({ label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), value: fmt(d) });
    }
    return result;
  })();

  const libFolderNamesSet = new Set(libraryFolders.map(f => f.folder));
  const looseLibraryFiles = libraryFiles.filter(f => !f.folder || !libFolderNamesSet.has(f.folder));
  const folderLibraryFiles = libraryFolder ? libraryFiles.filter(f => f.folder === libraryFolder) : [];

  const msgStyle = {
    error:   { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  color: t.error },
    success: { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  color: t.success },
    info:    { bg: t.primaryBg,            border: t.primaryBorder,        color: t.primary },
  };

  const chipStyle = (active) => ({
    padding: '6px 13px', borderRadius: 8,
    border: `1.5px solid ${active ? t.primary : t.border}`,
    background: active ? t.primaryBg : t.input,
    color: active ? t.text : t.textMuted,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  });

  // Get real profile data for a platform from connected social accounts
  const getProfileForPlatform = (pid) => {
    const acc = socialAccounts.find(a => a.platform === pid && a.enabled !== false);
    if (!acc) return null;
    return {
      name: acc.account_name || null,
      handle: acc.account_username || acc.account_name?.toLowerCase().replace(/[^a-z0-9._]/g, '') || null,
      picture: acc.profile_image_url || null,
    };
  };

  // Live preview post object (synthetic — drives mockup)
  const _previewBgOpt = fbBgColor ? FB_BG_OPTIONS.find(o => o.id === fbBgColor) : null;
  const previewPost = {
    content_type: contentType,
    media_url: previews[0] || null,
    media_urls: previews,
    hashtags: (caption.match(/#[\w]+/g) || []).map(h => h.replace(/^#/, '')),
    platforms,
    caption,
    fb_text_background: fbBgColor || null,
    fb_text_background_css: _previewBgOpt ? (_previewBgOpt.css || _previewBgOpt.bg) : null,
    fb_text_color: _previewBgOpt ? _previewBgOpt.text : '#050505',
  };

  const ActiveMockup = MOCKUP_MAP[previewPlatform];


  const renderLibraryGrid = (fileList) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
      {fileList.map(file => (
        <button
          key={file.id} type="button"
          onClick={() => selectFromLibrary(file)}
          style={{ background: t.isDark ? 'rgba(255,255,255,0.04)' : t.input, border: `1.5px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', padding: 0, position: 'relative', transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)', backdropFilter: 'blur(8px)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.5)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,92,252,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.07)' : t.border; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
        >
          <div style={{ aspectRatio: '1/1', overflow: 'hidden', position: 'relative' }}>
            {file.file_type === 'video' ? (
              <video src={file.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src={file.url} alt={file.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {file.file_type === 'video' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
                <IpPlay size={26} color="white" />
              </div>
            )}
          </div>
          <div style={{ padding: '7px 8px', borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.file_name}</div>
            {file.file_size_bytes > 0 && (
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 1 }}>
                {(file.file_size_bytes / 1024 / 1024).toFixed(1)} MB
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );

  const glassCard = {
    padding: '20px',
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };

  return (
    <Layout
      title="Social Planner"
      subtitle="Plan and publish your own content"
      action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => router.push('/wizard')}>
            <IpSparkle size={14} color="url(#brand-gradient)" /> Post Wizard
          </Button>
          <Button variant="secondary" onClick={() => router.push('/calendar')}>View Calendar</Button>
        </div>
      }
    >
      <div style={{ maxWidth: 1300, margin: '0 auto', width: '100%', paddingBottom: 80, paddingLeft: isMobile ? 0 : undefined, paddingRight: isMobile ? 0 : undefined }}>

        {message.text && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msgStyle[message.type]?.bg, border: `1px solid ${msgStyle[message.type]?.border}`, color: msgStyle[message.type]?.color }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: isMobile ? 12 : 20, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>

            {/* ══ LEFT — Compose ══════════════════════════════════════════════ */}
            <div style={{ flex: isMobile ? '1' : '0 0 54%', width: isMobile ? '100%' : undefined, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Post to — compact GHL-style dropdown */}
              <div style={{ ...glassCard, position: 'relative', zIndex: 50 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>

                  {/* Left: Post to selector */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 7 }}>Post to</label>

                    <div ref={accountDropdownRef} style={{ position: 'relative' }}>
                      {/* Trigger button */}
                      <button
                        type="button"
                        onClick={() => setAccountDropdownOpen(v => !v)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${accountDropdownOpen ? t.primary : t.border}`, background: t.isDark ? 'rgba(255,255,255,0.03)' : t.card, transition: 'all 150ms', minHeight: 48, boxSizing: 'border-box' }}
                      >
                        {selectedAccountIds.length === 0 ? (
                          <span style={{ fontSize: 13, color: t.textMuted, flex: 1, textAlign: 'left' }}>Select accounts…</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                            {/* Stacked overlapping avatars */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {socialAccounts.filter(a => selectedAccountIds.includes(a.id)).slice(0, 7).map((acct, idx) => {
                                const meta = PLATFORM_META[acct.platform];
                                return (
                                  <div key={acct.id} style={{ position: 'relative', marginLeft: idx === 0 ? 0 : -10, zIndex: idx, flexShrink: 0 }}>
                                    {acct.profile_image_url ? (
                                      <img src={acct.profile_image_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: `2.5px solid ${t.isDark ? 'rgba(12,12,22,1)' : '#fff'}`, display: 'block' }} />
                                    ) : (
                                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#7C5CFC,#5B3FF0)', border: `2.5px solid ${t.isDark ? 'rgba(12,12,22,1)' : '#fff'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{(acct.account_name || acct.account_username || '?')[0].toUpperCase()}</span>
                                      </div>
                                    )}
                                    {/* Platform badge bottom-right */}
                                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: '50%', background: meta?.color || '#666', border: `1.5px solid ${t.isDark ? 'rgba(12,12,22,1)' : '#fff'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                                      {meta?.Icon && <meta.Icon size={8} color="#fff" />}
                                    </div>
                                  </div>
                                );
                              })}
                              {selectedAccountIds.length > 7 && (
                                <div style={{ width: 34, height: 34, borderRadius: '50%', background: t.input, border: `2.5px solid ${t.isDark ? 'rgba(12,12,22,1)' : '#fff'}`, marginLeft: -10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: t.textSecondary, flexShrink: 0, zIndex: 10 }}>
                                  +{selectedAccountIds.length - 7}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Chevron */}
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transition: 'transform 200ms', transform: accountDropdownOpen ? 'rotate(180deg)' : 'none', color: t.textMuted }}>
                          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>

                      {/* Clear all */}
                      {selectedAccountIds.length > 0 && (
                        <button type="button" onClick={() => { setSelectedAccountIds([]); setPlatforms([]); }}
                          style={{ marginTop: 5, fontSize: 12, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block' }}
                        >Clear all</button>
                      )}
                      {selectedAccountIds.length === 0 && platforms.length === 0 && (
                        <div style={{ marginTop: 5, fontSize: 12, color: t.error }}>Select at least one account</div>
                      )}

                      {/* Dropdown panel */}
                      {accountDropdownOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0, zIndex: 300, background: t.isDark ? 'rgba(12,12,22,0.98)' : t.card, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.22)', maxHeight: 340, overflowY: 'auto' }}>

                          {socialAccounts.length === 0 ? (
                            <div style={{ padding: '16px 14px' }}>
                              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 8 }}>No accounts connected yet.</div>
                              <a href="/settings" style={{ color: t.primary, fontSize: 13, fontWeight: 600 }}>Connect in Settings →</a>
                            </div>
                          ) : (
                            <>
                              {/* Global select all */}
                              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={socialAccounts.filter(a => a.enabled).length > 0 && socialAccounts.filter(a => a.enabled).every(a => selectedAccountIds.includes(a.id))}
                                  ref={el => { if (el) el.indeterminate = selectedAccountIds.length > 0 && !socialAccounts.filter(a => a.enabled).every(a => selectedAccountIds.includes(a.id)); }}
                                  onChange={() => {
                                    const allEnabled = socialAccounts.filter(a => a.enabled);
                                    const allSel = allEnabled.every(a => selectedAccountIds.includes(a.id));
                                    if (allSel) { setSelectedAccountIds([]); setPlatforms([]); }
                                    else { setSelectedAccountIds(allEnabled.map(a => a.id)); setPlatforms([...new Set(allEnabled.map(a => a.platform))]); }
                                  }}
                                  style={{ accentColor: t.primary, width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, flex: 1 }}>All accounts</span>
                                <span style={{ fontSize: 11, color: t.textMuted }}>{socialAccounts.filter(a => a.enabled).length} connected</span>
                              </label>

                              {/* Quick groups */}
                              {accountGroups.length > 0 && accountGroups.map(group => (
                                <button key={group.id} type="button"
                                  onClick={() => {
                                    const ids = group.account_ids || [];
                                    setSelectedAccountIds(ids);
                                    setPlatforms([...new Set(socialAccounts.filter(a => ids.includes(a.id)).map(a => a.platform))]);
                                    setAccountDropdownOpen(false);
                                  }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'none', border: 'none', borderBottom: `1px solid ${t.border}`, cursor: 'pointer', textAlign: 'left' }}
                                  onMouseEnter={e => e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: t.primary }}>{group.name}</span>
                                  <span style={{ fontSize: 11, color: t.textMuted }}>({(group.account_ids || []).length})</span>
                                </button>
                              ))}

                              {/* Platform groups */}
                              {PLATFORMS.filter(p => socialAccounts.some(a => a.platform === p.id)).map(({ id: platId, name: platName, icon: PlatIcon }) => {
                                const platAccounts = socialAccounts.filter(a => a.platform === platId);
                                const enabledPlatAccounts = platAccounts.filter(a => a.enabled);
                                const meta = PLATFORM_META[platId];
                                const allPlatSel = enabledPlatAccounts.length > 0 && enabledPlatAccounts.every(a => selectedAccountIds.includes(a.id));
                                const somePlatSel = platAccounts.some(a => selectedAccountIds.includes(a.id));

                                return (
                                  <div key={platId}>
                                    {/* Platform group header */}
                                    <div
                                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', background: t.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }}
                                      onClick={() => togglePlatformGroup(platId, platAccounts, allPlatSel)}
                                    >
                                      <input type="checkbox" checked={allPlatSel}
                                        ref={el => { if (el) el.indeterminate = somePlatSel && !allPlatSel; }}
                                        onChange={() => togglePlatformGroup(platId, platAccounts, allPlatSel)}
                                        style={{ accentColor: meta.color, width: 14, height: 14, flexShrink: 0, cursor: 'pointer' }}
                                        onClick={e => e.stopPropagation()}
                                      />
                                      <div style={{ width: 20, height: 20, borderRadius: 5, background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 1px 5px ${meta.color}55` }}>
                                        <PlatIcon size={11} color="#fff" />
                                      </div>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: t.text, flex: 1 }}>{platName}</span>
                                      <span style={{ fontSize: 11, color: t.textMuted }}>{platAccounts.length}</span>
                                    </div>

                                    {/* Account rows */}
                                    {platAccounts.map((account, idx) => {
                                      const checked = selectedAccountIds.includes(account.id);
                                      const isLast = idx === platAccounts.length - 1;
                                      return (
                                        <label key={account.id}
                                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px 9px 42px', background: checked ? `${meta.color}0a` : 'transparent', cursor: account.enabled ? 'pointer' : 'default', borderBottom: isLast ? 'none' : `1px solid ${t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`, transition: 'background 120ms' }}
                                          onMouseEnter={e => { if (!checked && account.enabled) e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                                          onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                          <input type="checkbox" checked={checked} disabled={!account.enabled}
                                            onChange={() => account.enabled && toggleAccount(account.id)}
                                            style={{ accentColor: meta.color, width: 14, height: 14, flexShrink: 0, cursor: account.enabled ? 'pointer' : 'default' }}
                                          />
                                          {/* Avatar + platform badge */}
                                          <div style={{ position: 'relative', flexShrink: 0 }}>
                                            {account.profile_image_url ? (
                                              <img src={account.profile_image_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                                            ) : (
                                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${meta.color}20`, border: `1.5px solid ${meta.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{(account.account_name || account.account_username || '?')[0].toUpperCase()}</span>
                                              </div>
                                            )}
                                            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 13, height: 13, borderRadius: '50%', background: meta.color, border: `1.5px solid ${t.isDark ? 'rgba(12,12,22,0.98)' : t.card}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                                              <PlatIcon size={7} color="#fff" />
                                            </div>
                                          </div>
                                          {/* Name + handle */}
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: account.enabled ? t.text : t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {account.account_name || account.account_username || platName}
                                            </div>
                                            {account.account_username && (
                                              <div style={{ fontSize: 11, color: t.textMuted }}>@{account.account_username.replace(/^@/, '')}</div>
                                            )}
                                          </div>
                                          {/* Status dot */}
                                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: account.enabled ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Customize for each channel toggle */}
                  {platforms.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 3, gap: 8, flexShrink: 0 }}>
                      <button type="button" onClick={() => setCustomCaptionsEnabled(v => !v)}
                        style={{ width: 40, height: 22, borderRadius: 11, background: customCaptionsEnabled ? t.primary : t.isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 220ms', padding: 0, flexShrink: 0 }}
                      >
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: customCaptionsEnabled ? 20 : 2, transition: 'left 220ms', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
                      </button>
                      <span style={{ fontSize: 12, color: t.textSecondary, whiteSpace: 'nowrap' }}>Customize for each channel</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Caption + Hashtags */}
              <div style={glassCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type content</label>
                  {!customCaptionsEnabled && platforms.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {charLimitPlatId && PLATFORM_META[charLimitPlatId] && (
                        <span style={{ fontSize: 11, color: t.textMuted }}>Limited by {PLATFORM_META[charLimitPlatId].label}</span>
                      )}
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 11px', borderRadius: 20, background: caption.length > charLimit ? 'rgba(239,68,68,0.1)' : t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: caption.length > charLimit ? t.error : t.text, border: `1px solid ${caption.length > charLimit ? 'rgba(239,68,68,0.3)' : t.border}`, transition: 'all 150ms' }}>
                        Char limit: {Math.max(0, charLimit - caption.length).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {customCaptionsEnabled && platforms.length > 1 ? (
                  <div>
                    {/* GHL-style platform tabs */}
                    <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, marginBottom: 14, gap: 0 }}>
                      {platforms.map(platId => {
                        const meta = PLATFORM_META[platId];
                        const PlatIcon = meta?.Icon;
                        const isActive = (activePlatformTab || platforms[0]) === platId;
                        return (
                          <button key={platId} type="button"
                            onClick={() => setActivePlatformTab(platId)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'none', border: 'none', borderBottom: `2.5px solid ${isActive ? (meta?.color || t.primary) : 'transparent'}`, marginBottom: -1, color: isActive ? (meta?.color || t.primary) : t.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 700 : 500, transition: 'all 150ms', whiteSpace: 'nowrap' }}
                          >
                            {PlatIcon && <PlatIcon size={15} color={isActive ? (meta?.color || t.primary) : t.textMuted} />}
                            <span>{meta?.label || platId}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Active platform caption textarea */}
                    {(() => {
                      const platId = activePlatformTab || platforms[0];
                      const meta = PLATFORM_META[platId];
                      const limit = CHAR_LIMITS[platId] || 63206;
                      const val = platformCaptions[platId] ?? caption;
                      const over = val.length > limit;
                      return (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: meta?.color || t.textSecondary }}>{meta?.label || platId}</span>
                            <span style={{ fontSize: 12, color: over ? t.error : t.textMuted, fontWeight: over ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>{val.length.toLocaleString()} / {limit.toLocaleString()}</span>
                          </div>
                          <textarea
                            key={platId}
                            ref={captionRef}
                            value={val}
                            onChange={e => setPlatformCaptions(prev => ({ ...prev, [platId]: e.target.value }))}
                            placeholder={`Caption for ${meta?.label || platId}...`}
                            rows={7}
                            style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1.5px solid ${over ? t.error : (t.isDark ? 'rgba(255,255,255,0.08)' : t.borderStrong)}`, borderRadius: 8, color: t.text, fontSize: 14, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 150ms' }}
                            onFocus={e => { if (!over) e.target.style.borderColor = meta?.color || t.primary; }}
                            onBlur={e => { e.target.style.borderColor = over ? t.error : (t.isDark ? 'rgba(255,255,255,0.08)' : t.borderStrong); }}
                          />
                          {over && (
                            <div style={{ marginTop: 6, fontSize: 12, color: t.error }}>
                              {val.length - limit} characters over the {meta?.label} limit
                            </div>
                          )}
                          {/* Formatting toolbar — same as single caption mode */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: 6, padding: '4px 6px', background: t.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: 8, border: `1px solid ${t.border}`, flexWrap: 'wrap' }}>
                            <div ref={emojiPickerRef}>
                              <button type="button" title="Emoji" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setEmojiPickerPos({ top: r.bottom + 6, left: r.left }); setShowEmojiPicker(v => !v); }}
                                style={{ width: 32, height: 28, background: showEmojiPicker ? (t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)') : 'none', border: 'none', cursor: 'pointer', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms', color: t.textSecondary }}
                                onMouseEnter={e => e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = showEmojiPicker ? (t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)') : 'none'}
                              >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                              </button>
                            </div>
                            <div style={{ width: 1, height: 18, background: t.border, margin: '0 3px', flexShrink: 0 }} />
                            <button type="button" title="Insert hashtag" onClick={() => setPlatformCaptions(prev => ({ ...prev, [platId]: (prev[platId] ?? caption) + ' #' }))}
                              style={{ height: 28, padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 5, fontSize: 14, fontWeight: 700, color: t.textSecondary, transition: 'background 120ms' }}
                              onMouseEnter={e => e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >#</button>
                            <button type="button" title="Insert mention" onClick={() => setPlatformCaptions(prev => ({ ...prev, [platId]: (prev[platId] ?? caption) + ' @' }))}
                              style={{ height: 28, padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 5, fontSize: 14, fontWeight: 700, color: t.textSecondary, transition: 'background 120ms' }}
                              onMouseEnter={e => e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >@</button>
                            <div style={{ width: 1, height: 18, background: t.border, margin: '0 3px', flexShrink: 0 }} />
                            <button type="button" title="Insert link"
                              onClick={() => { const url = window.prompt('Paste a URL to insert:'); if (url?.trim()) setPlatformCaptions(prev => ({ ...prev, [platId]: (prev[platId] ?? caption) + ` ${url.trim().startsWith('http') ? url.trim() : 'https://'+url.trim()}` })); }}
                              style={{ width: 32, height: 28, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms', color: t.textSecondary }}
                              onMouseEnter={e => e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <>
                    <textarea
                      ref={captionRef}
                      value={caption}
                      onChange={e => setCaption(e.target.value)}
                      placeholder="Write a caption…"
                      rows={7}
                      style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1.5px solid ${t.isDark ? 'rgba(255,255,255,0.08)' : t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 14, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 150ms' }}
                      onFocus={e => e.target.style.borderColor = t.primary}
                      onBlur={e => e.target.style.borderColor = t.isDark ? 'rgba(255,255,255,0.08)' : t.borderStrong}
                    />

                    {/* Formatting toolbar — GHL style */}
                    {(() => {
                      const tbBtn = (opts = {}) => ({ width: 30, height: 30, background: 'none', border: 'none', cursor: opts.disabled ? 'default' : 'pointer', borderRadius: 6, color: opts.disabled ? t.textMuted : t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 120ms', opacity: opts.disabled ? 0.38 : 1, padding: 0, fontSize: 13, fontWeight: 600 });
                      const tbHover = (e, on) => { if (e.currentTarget.style.opacity !== '0.38') e.currentTarget.style.background = on ? (t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)') : 'none'; };
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: 8, padding: '4px 6px', background: t.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)', borderRadius: 10, border: `1px solid ${t.border}`, flexWrap: 'wrap', position: 'relative' }}>
                          {/* Bold */}
                          <button type="button" title="Bold — select text first"
                            onClick={() => applyFormatting('bold')}
                            style={tbBtn()} onMouseEnter={e => tbHover(e,true)} onMouseLeave={e => tbHover(e,false)}
                          >
                            <span style={{ fontWeight: 800, fontFamily: 'serif', fontSize: 14 }}>B</span>
                          </button>
                          {/* Italic */}
                          <button type="button" title="Italic — select text first"
                            onClick={() => applyFormatting('italic')}
                            style={tbBtn()} onMouseEnter={e => tbHover(e,true)} onMouseLeave={e => tbHover(e,false)}
                          >
                            <span style={{ fontStyle: 'italic', fontFamily: 'serif', fontSize: 14 }}>I</span>
                          </button>
                          <div style={{ width: 1, height: 18, background: t.border, margin: '0 3px', flexShrink: 0 }} />
                          {/* Emoji — picker rendered as root portal (see below) */}
                          <div ref={emojiPickerRef}>
                            <button type="button" title="Add emoji" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setEmojiPickerPos({ top: r.bottom + 6, left: r.left }); setShowEmojiPicker(v => !v); }}
                              style={{ ...tbBtn(), background: showEmojiPicker ? (t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)') : 'none' }}
                              onMouseEnter={e => tbHover(e,true)} onMouseLeave={e => tbHover(e,false)}
                            >
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                            </button>
                          </div>
                          {/* Add Image — opens library modal directly */}
                          <button type="button" title="Add Image"
                            onClick={() => { setLibraryUploadType('image'); openLibraryForType('image'); }}
                            style={tbBtn()} onMouseEnter={e => tbHover(e,true)} onMouseLeave={e => tbHover(e,false)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          </button>
                          {/* Upload from device */}
                          <button type="button" title="Upload from device"
                            onClick={() => fileInputRef.current?.click()}
                            style={tbBtn()} onMouseEnter={e => tbHover(e,true)} onMouseLeave={e => tbHover(e,false)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                          </button>
                          {/* Add Video — opens library modal */}
                          <button type="button" title="Add Video"
                            onClick={() => { setLibraryUploadType('video'); openLibraryForType('video'); }}
                            style={tbBtn()} onMouseEnter={e => tbHover(e,true)} onMouseLeave={e => tbHover(e,false)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                          </button>
                          <div style={{ width: 1, height: 18, background: t.border, margin: '0 3px', flexShrink: 0 }} />
                          {/* Hashtag */}
                          <button type="button" title="Add Hashtag" onClick={() => insertIntoCaption(' #')}
                            style={tbBtn()} onMouseEnter={e => tbHover(e,true)} onMouseLeave={e => tbHover(e,false)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                          </button>
                          {/* Tag / Mention */}
                          <button type="button" title="Tag someone" onClick={() => insertIntoCaption(' @')}
                            style={tbBtn()} onMouseEnter={e => tbHover(e,true)} onMouseLeave={e => tbHover(e,false)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                          </button>
                          {/* Link Shortener — opens UTM builder modal */}
                          <button type="button" title="Link Shortener"
                            onClick={() => { setLinkName(''); setLinkTargetUrl(''); setLinkUtmCampaign(''); setLinkUtmSource('social'); setLinkUtmMedium(''); setLinkCustomParams([]); setShowLinkModal(true); }}
                            style={{ ...tbBtn(), background: showLinkModal ? (t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)') : 'none' }}
                            onMouseEnter={e => tbHover(e,true)} onMouseLeave={e => tbHover(e,false)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          </button>
                          {/* Add Location — inline popup */}
                          <div style={{ position: 'relative', flexShrink: 0 }} ref={locationPopupRef}>
                            <button type="button" title="Add Location"
                              onClick={() => setShowLocationPopup(v => !v)}
                              style={{ ...tbBtn(), background: (showLocationPopup || selectedLocation) ? (t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)') : 'none', color: selectedLocation ? t.primary : t.textSecondary }}
                              onMouseEnter={e => tbHover(e,true)} onMouseLeave={e => tbHover(e,false)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            </button>
                            {showLocationPopup && (
                              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', zIndex: 600, background: t.isDark ? 'rgba(12,12,22,0.98)' : t.card, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${t.border}`, borderRadius: 12, padding: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.22)', width: 280 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add Location</div>
                                {selectedLocation ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8 }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill={t.primary} stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: t.primary, flex: 1 }}>{selectedLocation.name}{selectedLocation.city ? `, ${selectedLocation.city}` : ''}</span>
                                    <button type="button" onClick={() => { setSelectedLocation(null); }}
                                      style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                                  </div>
                                ) : (
                                  <div style={{ position: 'relative' }}>
                                    <input
                                      value={locationQuery}
                                      onChange={e => handleLocationSearch(e.target.value)}
                                      placeholder="Search a place…"
                                      autoFocus
                                      style={{ width: '100%', padding: '8px 10px', background: t.input, border: `1.5px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                      onFocus={e => e.target.style.borderColor = t.primary}
                                      onBlur={e => e.target.style.borderColor = t.border}
                                    />
                                    {locationSearching && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Searching…</div>}
                                    {locationResults.length > 0 && (
                                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 700, background: t.isDark ? 'rgba(12,12,22,0.98)' : t.card, border: `1px solid ${t.border}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', marginTop: 4, overflow: 'hidden' }}>
                                        {locationResults.map(loc => (
                                          <button key={loc.id} type="button"
                                            onClick={() => { setSelectedLocation(loc); setLocationQuery(''); setLocationResults([]); setShowLocationPopup(false); }}
                                            style={{ width: '100%', padding: '9px 12px', background: 'none', border: 'none', borderBottom: `1px solid ${t.border}`, color: t.text, fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}
                                            onMouseEnter={e => e.currentTarget.style.background = t.input}
                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                          >
                                            <span style={{ fontWeight: 600 }}>{loc.name}</span>
                                            {loc.city && <span style={{ fontSize: 11, color: t.textMuted }}>{loc.city}{loc.country ? `, ${loc.country}` : ''}</span>}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Text Background — Facebook only */}
                          {(() => {
                            const selBg = FB_BG_OPTIONS.find(o => o.id === fbBgColor);
                            const selCss = selBg ? (selBg.css || selBg.bg) : null;
                            return (
                          <div style={{ position: 'relative', flexShrink: 0 }} ref={bgPickerRef}>
                            <button type="button" title="Text backgrounds — Facebook text-only posts only."
                              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setBgPickerPos({ top: r.bottom + 6, right: window.innerWidth - r.right }); setShowBgPicker(v => !v); }}
                              style={{ ...tbBtn(), background: selCss ? 'none' : (showBgPicker ? (t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)') : 'none') }}
                              onMouseEnter={e => tbHover(e,true)} onMouseLeave={e => tbHover(e,false)}
                            >
                              <span style={{ fontSize: 13, fontWeight: 700, background: selCss || (t.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'), color: selCss ? '#fff' : 'inherit', borderRadius: 3, padding: '1px 4px', letterSpacing: '-0.02em' }}>A</span>
                            </button>
                          </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {overLimitPlatforms.length > 0 && (
                      <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, fontSize: 12, color: t.error }}>
                        Too long for: {overLimitPlatforms.map(p => `${PLATFORM_META[p]?.label || p} (${caption.length.toLocaleString()} / ${CHAR_LIMITS[p].toLocaleString()})`).join(' · ')}
                      </div>
                    )}
                    {fbBgColor && caption.length > 130 && (
                      <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 7, fontSize: 12, color: '#d97706' }}>
                        Facebook backgrounds require ≤130 characters. Your caption ({caption.length}) will post without the background on Facebook.
                      </div>
                    )}

                    {/* URL preview card — auto-detects first URL in caption */}
                    {linkPreviewUrl && !linkPreviewDismissed && linkPreviewData && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 0, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                        {linkPreviewData.image && (
                          <img src={linkPreviewData.image} alt="" style={{ width: 72, height: 72, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                        )}
                        <div style={{ flex: 1, padding: '9px 12px', minWidth: 0 }}>
                          {linkPreviewData.title && <div style={{ fontSize: 13, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{linkPreviewData.title}</div>}
                          <div style={{ fontSize: 11, color: t.primary, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkPreviewUrl}</div>
                          {linkPreviewData.description && <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{linkPreviewData.description}</div>}
                        </div>
                        <button type="button" onClick={() => setLinkPreviewDismissed(true)} style={{ width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-start', margin: 4 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    )}

                    {/* Media optimization + thumbnail preview */}
                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: 'fit-content' }}>
                        <div onClick={() => setMediaOptimization(v => !v)}
                          style={{ width: 36, height: 20, borderRadius: 10, background: mediaOptimization ? t.primary : (t.isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'), position: 'relative', transition: 'background 220ms', cursor: 'pointer', flexShrink: 0 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: mediaOptimization ? 18 : 2, transition: 'left 220ms', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
                        </div>
                        <span style={{ fontSize: 12, color: t.textSecondary }}>Media optimization</span>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          onMouseEnter={e => { const tip = e.currentTarget.querySelector('[data-tip]'); if (tip) tip.style.display = 'block'; }}
                          onMouseLeave={e => { const tip = e.currentTarget.querySelector('[data-tip]'); if (tip) tip.style.display = 'none'; }}
                        >
                          <span style={{ cursor: 'help', color: t.textMuted, display: 'flex', alignItems: 'center' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>
                          </span>
                          <div data-tip style={{ display: 'none', position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', background: '#1c1c1c', color: '#fff', fontSize: 12, lineHeight: 1.55, padding: '9px 13px', borderRadius: 8, width: 240, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.35)', pointerEvents: 'none', whiteSpace: 'normal' }}>
                            All images will be optimized for all required content formats to support all channels
                            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1c1c1c' }} />
                          </div>
                        </div>
                      </label>

                      {previews.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
                          {previews.map((url, idx) => {
                            const isVideo = files[idx]?.type === 'video' || (typeof files[idx] === 'object' && !files[idx]?.libraryFileId && files[idx]?.name?.match(/\.(mp4|mov|webm)$/i));
                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
                                draggable={contentType === 'carousel'}
                                onDragStart={() => handleDragStart(idx)}
                                onDragOver={handleDragOver}
                                onDrop={e => handleDrop(e, idx)}
                              >
                                {/* Drag handle — outside left, GHL style */}
                                {contentType === 'carousel' && (
                                  <div style={{ cursor: 'grab', padding: '4px 2px', color: t.textMuted, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                    title="Drag to reorder"
                                  >
                                    <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                                      <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                                      <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
                                      <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
                                    </svg>
                                  </div>
                                )}
                                {/* Thumbnail */}
                                <div style={{ position: 'relative', width: 88, height: 88, borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${t.border}`, flexShrink: 0 }}>
                                  {isVideo ? (
                                    <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  )}
                                  {/* Overlay: trash (left) + pencil+chevron (right) — GHL style */}
                                  <div style={{ position: 'absolute', top: 3, left: 3, right: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    {/* Trash */}
                                    <button type="button" title="Remove" onClick={() => removeFile(idx)}
                                      style={{ width: 22, height: 22, background: 'rgba(30,30,30,0.82)', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, backdropFilter: 'blur(4px)' }}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                                    </button>
                                    {/* Pencil + Chevron — split edit button (dropdown is a fixed portal, not inline) */}
                                    {!isVideo && (
                                      <div style={{ display: 'flex', flexShrink: 0 }}>
                                        <button type="button" title="Edit in Image Editor"
                                          onClick={e => { e.stopPropagation(); setImageEditorIdx(idx); setEditDropdownIdx(null); }}
                                          style={{ width: 22, height: 22, background: t.primary, border: 'none', borderRadius: '5px 0 0 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button type="button"
                                          onClick={e => {
                                            e.stopPropagation();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setEditDropdownAnchor({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                                            setEditDropdownIdx(editDropdownIdx === idx ? null : idx);
                                          }}
                                          style={{ width: 16, height: 22, background: t.primary, border: 'none', borderLeft: '1px solid rgba(255,255,255,0.28)', borderRadius: '0 5px 5px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                          <svg width="7" height="5" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {/* Add more for carousel */}
                          {contentType === 'carousel' && files.length < 10 && (
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                              style={{ width: 88, height: 88, borderRadius: 10, border: `2px dashed ${t.border}`, background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: t.textMuted, flexShrink: 0, transition: 'all 150ms' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = t.primary; e.currentTarget.style.color = t.primary; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              <span style={{ fontSize: 10, fontWeight: 600 }}>Add</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Hidden file inputs */}
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect}
                        accept="image/*,video/*"
                        multiple
                        style={{ display: 'none' }}
                      />
                      <input type="file" ref={libraryFileInputRef} onChange={handleLibraryUpload}
                        accept={libraryUploadType === 'video' ? 'video/*' : 'image/*,video/*'}
                        style={{ display: 'none' }}
                      />
                      <input type="file" ref={replaceFileInputRef} onChange={handleReplaceFile}
                        accept="image/*"
                        style={{ display: 'none' }}
                      />
                    </div>
                  </>
                )}

                {/* Follow up comment */}
                <div style={{ marginTop: 14, borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
                  <button type="button" onClick={() => setFollowUpEnabled(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%', color: followUpEnabled ? t.primary : t.textMuted }}
                    onMouseEnter={e => { e.currentTarget.style.color = t.primary; }}
                    onMouseLeave={e => { e.currentTarget.style.color = followUpEnabled ? t.primary : t.textMuted; }}
                  >
                    {/* Custom speech bubble with reply arrow icon */}
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'color 150ms' }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      <line x1="9" y1="10" x2="15" y2="10"/>
                      <line x1="9" y1="13" x2="13" y2="13"/>
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'inherit', flex: 1, textAlign: 'left', transition: 'color 150ms' }}>Follow up comment</span>
                    <div title="Automatically posts a first comment — great for adding links without hurting organic reach"
                      onClick={e => e.stopPropagation()}
                      style={{ width: 16, height: 16, borderRadius: '50%', background: t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', flexShrink: 0, marginRight: 4 }}>
                      <span style={{ fontSize: 10, color: t.textMuted, lineHeight: 1 }}>?</span>
                    </div>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: 'transform 200ms', transform: followUpEnabled ? 'rotate(180deg)' : 'none', color: 'inherit', flexShrink: 0 }}>
                      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {followUpEnabled && (
                    <Textarea
                      value={followUpComment}
                      onChange={e => setFollowUpComment(e.target.value)}
                      placeholder="Add a follow-up comment posted automatically as the first comment…"
                      rows={3}
                      style={{ marginTop: 10 }}
                    />
                  )}
                </div>
              </div>

              {/* Selected location badge — shown inline when a location is chosen */}
              {selectedLocation && (
                <div style={{ ...glassCard, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={t.primary} stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.primary, flex: 1 }}>{selectedLocation.name}{selectedLocation.city ? `, ${selectedLocation.city}` : ''}</span>
                  <button type="button" onClick={() => setSelectedLocation(null)}
                    style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
              )}


              {/* Advanced options — Facebook/Instagram platform-specific */}
              {(platforms.includes('facebook') || platforms.includes('instagram')) && (
                <div style={glassCard}>
                  <button type="button" onClick={() => setShowAdvancedOptions(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%', textAlign: 'left' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary, flex: 1 }}>Advanced options</span>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: 'transform 200ms', transform: showAdvancedOptions ? 'rotate(180deg)' : 'none', color: t.textMuted }}>
                      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>

                  {showAdvancedOptions && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>

                      {/* Facebook options */}
                      {platforms.includes('facebook') && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <IpFacebook size={16} color="#1877F2" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Facebook options</span>
                          </div>
                          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8, fontWeight: 500 }}>Post this as</div>
                          <div style={{ display: 'flex', gap: 20 }}>
                            {['Feed', 'Reel', 'Story'].map(fmt => (
                              <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                                <input type="radio" name="fb-format" value={fmt.toLowerCase()}
                                  checked={fbPostFormat === fmt.toLowerCase()}
                                  onChange={() => setFbPostFormat(fmt.toLowerCase())}
                                  style={{ accentColor: '#1877F2', width: 15, height: 15, cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{fmt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Instagram options */}
                      {platforms.includes('instagram') && (
                        <div style={{ borderTop: platforms.includes('facebook') ? `1px solid ${t.border}` : 'none', paddingTop: platforms.includes('facebook') ? 18 : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <IpInstagram size={16} color="#E1306C" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Instagram options</span>
                          </div>
                          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8, fontWeight: 500 }}>Post this as</div>
                          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                            {['Feed', 'Reel', 'Story'].map(fmt => (
                              <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                                <input type="radio" name="ig-format" value={fmt.toLowerCase()}
                                  checked={igPostFormat === fmt.toLowerCase()}
                                  onChange={() => setIgPostFormat(fmt.toLowerCase())}
                                  style={{ accentColor: '#E1306C', width: 15, height: 15, cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{fmt}</span>
                              </label>
                            ))}
                          </div>

                          {/* Invite collaborators */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Invite collaborators</span>
                              <div title="If they accept, this post will be shared to their followers and they'll be shown as authors of this post." style={{ width: 15, height: 15, borderRadius: '50%', background: t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', flexShrink: 0 }}>
                                <span style={{ fontSize: 10, color: t.textMuted }}>?</span>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
                              If they accept, this post will be shared to their followers and they'll be shown as authors of this post. Please confirm that you're using the correct username.
                            </div>
                            <Input
                              value={igCollaborator}
                              onChange={e => setIgCollaborator(e.target.value)}
                              placeholder="Invite collaborators by entering their Instagram username here."
                            />
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )}

              {/* Schedule — only visible when "Schedule for Later" is chosen from the Post split button */}
              {scheduleMode === 'later' && (
              <div style={glassCard}>
                <SectionHeader icon={CalendarIcon} title="When to Post" />
                {(
                  <div>
                    {/* Best time suggestion chips */}
                    {bestTimes.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Best times for you</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {bestTimes.map((bt, i) => {
                            const { date, time } = bestTimeToDateParts(bt.dow, bt.hour);
                            return (
                              <button
                                key={i} type="button"
                                onClick={() => { setScheduleDate(date); setScheduleTime(time); }}
                                title={bt.reason}
                                style={{ padding: '5px 11px', borderRadius: 20, border: `1.5px solid ${t.primary}`, background: scheduleDate === date && scheduleTime === time ? t.primary : t.primaryBg, color: scheduleDate === date && scheduleTime === time ? '#fff' : t.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                              >
                                {bt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Date</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        {quickDates.map(qd => (
                          <button key={qd.value} type="button" onClick={() => setScheduleDate(qd.value)} style={chipStyle(scheduleDate === qd.value)}>
                            {qd.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginBottom: scheduledPreview ? 12 : 0 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Time</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        {TIME_SLOTS.map(ts => (
                          <button key={ts.value} type="button" onClick={() => setScheduleTime(ts.value)} style={chipStyle(scheduleTime === ts.value)}>
                            {ts.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                        style={{ padding: '8px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 13 }}
                      />
                    </div>
                    {scheduledPreview && (
                      <div style={{ padding: '10px 14px', background: 'rgba(124,92,252,0.08)', border: `1px solid rgba(124,92,252,0.22)`, borderRadius: 10, fontSize: 13, color: t.primary, fontWeight: 600, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Scheduled for {scheduledPreview}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Hidden form submit anchor — the visible action bar is fixed at the bottom */}
              <button id="upload-submit-btn" type="submit" style={{ display: 'none' }} disabled={uploading} />
            </div>

            {/* ══ RIGHT — Live Preview ════════════════════════════════════════ */}
            <div style={{ flex: 1, width: isMobile ? '100%' : undefined, minWidth: 0, position: isMobile ? 'static' : 'sticky', top: 20, alignSelf: 'flex-start' }}>
              <div style={{ ...glassCard, boxShadow: `0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.05' : '0.9'})` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Post Preview</span>
                </div>

                {/* Platform tabs — GHL style: All + platform icons with underline */}
                {platforms.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}`, marginBottom: 16, gap: 0 }}>
                    {/* All tab */}
                    <button type="button" onClick={() => setPreviewPlatform('all')}
                      style={{ padding: '7px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: previewPlatform === 'all' ? t.primary : t.textMuted, borderBottom: `2px solid ${previewPlatform === 'all' ? t.primary : 'transparent'}`, marginBottom: -1, transition: 'all 150ms', whiteSpace: 'nowrap' }}
                    >All</button>
                    {/* Per-platform icon tabs */}
                    {platforms.filter(pid => MOCKUP_MAP[pid]).map(pid => {
                      const meta = PLATFORM_META[pid];
                      const PlatIcon = meta?.Icon;
                      const isActive = previewPlatform === pid;
                      return (
                        <button key={pid} type="button" onClick={() => setPreviewPlatform(pid)}
                          style={{ padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${isActive ? (meta?.color || t.primary) : 'transparent'}`, marginBottom: -1, transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {PlatIcon && <PlatIcon size={18} style={{ color: isActive ? meta?.color : t.textMuted, transition: 'color 150ms' }} />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ marginBottom: 16, fontSize: 12, color: t.textMuted }}>Select accounts on the left to preview</div>
                )}

                {/* Mockup area */}
                <div style={{ borderRadius: 12, padding: previewPlatform === 'all' ? 0 : 0, minHeight: 280, overflow: 'hidden' }}>
                  {previewPlatform === 'all' ? (
                    /* All — stack every selected platform preview */
                    platforms.filter(pid => MOCKUP_MAP[pid]).length > 0 && (caption || previews.length > 0) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {platforms.filter(pid => MOCKUP_MAP[pid]).map((pid, idx) => {
                          const Mock = MOCKUP_MAP[pid];
                          const platCaption = customCaptionsEnabled ? (platformCaptions[pid] ?? caption) : caption;
                          const isLast = idx === platforms.filter(p => MOCKUP_MAP[p]).length - 1;
                          return (
                            <div key={pid} style={{ borderBottom: isLast ? 'none' : `1px solid ${t.border}`, paddingBottom: isLast ? 0 : 20, marginBottom: isLast ? 0 : 20 }}>
                              <Mock post={previewPost} caption={platCaption} profile={getProfileForPlatform(pid)} />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 12, textAlign: 'center', padding: 20 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: t.isDark ? 'rgba(124,92,252,0.08)' : 'rgba(124,92,252,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid rgba(124,92,252,0.15)` }}>
                          <IpSave size={22} color="url(#brand-gradient)" />
                        </div>
                        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>Start typing your caption or<br />upload media to see a preview</div>
                      </div>
                    )
                  ) : (
                    /* Single platform */
                    ActiveMockup && (caption || previews.length > 0) ? (
                      <ActiveMockup post={previewPost} caption={customCaptionsEnabled ? (platformCaptions[previewPlatform] ?? caption) : caption} profile={getProfileForPlatform(previewPlatform)} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 12, textAlign: 'center', padding: 20 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: t.isDark ? 'rgba(124,92,252,0.08)' : 'rgba(124,92,252,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid rgba(124,92,252,0.15)` }}>
                          <IpSave size={22} color="url(#brand-gradient)" />
                        </div>
                        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>Start typing your caption or<br />upload media to see a preview</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

          </div>
        </form>
      </div>

      {/* ─── Edit image dropdown portal — fixed so it escapes overflow:hidden thumbnail ─── */}
      {editDropdownIdx !== null && (
        <div onMouseDown={e => e.stopPropagation()}
          style={{ position: 'fixed', top: editDropdownAnchor.top, right: editDropdownAnchor.right, zIndex: 10000, background: t.isDark ? 'rgba(12,12,22,0.98)' : t.card, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.22)', minWidth: 185 }}>
          <button type="button"
            onClick={() => { setImageEditorIdx(editDropdownIdx); setEditDropdownIdx(null); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', borderBottom: `1px solid ${t.border}`, cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Edit in Image Editor</span>
          </button>
          <button type="button"
            onClick={() => { setReplaceFileIdx(editDropdownIdx); setEditDropdownIdx(null); replaceFileInputRef.current?.click(); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Replace Image</span>
          </button>
        </div>
      )}

      {/* ─── Image Editor Modal ─── */}
      {imageEditorIdx !== null && previews[imageEditorIdx] && (
        <ImageEditor
          imageUrl={previews[imageEditorIdx]}
          onSave={(newUrl) => {
            setPreviews(prev => prev.map((u, i) => i === imageEditorIdx ? newUrl : u));
            setFiles(prev => prev.map((f, i) => i === imageEditorIdx ? { ...f, url: newUrl, libraryFileId: null } : f));
            setImageEditorIdx(null);
          }}
          onClose={() => setImageEditorIdx(null)}
        />
      )}

      {/* ─── Fixed bottom action bar — GHL style, right-aligned ─── */}
      <div style={{ position: 'fixed', bottom: 0, left: isMobile ? 0 : 240, right: 0, zIndex: 300, background: t.isDark ? 'rgba(10,10,20,0.96)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: `1px solid ${t.border}`, padding: isMobile ? '10px 16px' : '12px 32px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: isMobile ? 8 : 10, boxShadow: '0 -4px 24px rgba(0,0,0,0.08)' }}>

        {/* Cancel — hidden on mobile */}
        {!isMobile && (
          <button type="button" onClick={() => router.push('/dashboard')}
            style={{ padding: '9px 18px', borderRadius: 9, border: `1.5px solid ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.textMuted; e.currentTarget.style.color = t.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; }}
          >Cancel</button>
        )}

        {/* Save for later / Draft */}
        <button type="button" disabled={uploading}
          onClick={() => { setScheduleMode('draft'); setTimeout(() => document.getElementById('upload-submit-btn')?.click(), 50); }}
          style={{ padding: '9px 18px', borderRadius: 9, border: `1.5px solid ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: 14, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap' }}
          onMouseEnter={e => { if (!uploading) { e.currentTarget.style.borderColor = t.primary; e.currentTarget.style.color = t.primary; } }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; }}
        >{isMobile ? 'Draft' : 'Save for later'}</button>

        {/* Split action button — main + chevron dropdown */}
        <div ref={postDropdownRef} style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
          <button type="button"
            disabled={uploading || (selectedAccountIds.length === 0 && platforms.length === 0) || overLimitPlatforms.length > 0}
            onClick={() => document.getElementById('upload-submit-btn')?.click()}
            style={{
              padding: '9px 20px', borderRadius: '9px 0 0 9px', border: 'none', cursor: uploading ? 'wait' : 'pointer',
              background: (uploading || (selectedAccountIds.length === 0 && platforms.length === 0)) ? t.border : 'linear-gradient(135deg,#7C5CFC,#5B3FF0)',
              color: '#fff', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap',
              boxShadow: (uploading || (selectedAccountIds.length === 0 && platforms.length === 0)) ? 'none' : '0 4px 16px rgba(124,92,252,0.3)',
              transition: 'all 200ms', display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            {scheduleMode === 'later' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ) : scheduleMode === 'now' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ) : scheduleMode === 'approval' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            )}
            {uploading ? 'Saving…' : scheduleMode === 'later' ? 'Schedule' : scheduleMode === 'now' ? 'Post Now' : scheduleMode === 'approval' ? 'Send for Approval' : 'Save Draft'}
          </button>
          <button type="button" disabled={uploading}
            onClick={() => setPostDropdownOpen(v => !v)}
            style={{ padding: '9px 12px', borderRadius: '0 9px 9px 0', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.22)', background: (uploading || (selectedAccountIds.length === 0 && platforms.length === 0)) ? t.border : 'linear-gradient(135deg,#7C5CFC,#5B3FF0)', color: '#fff', cursor: uploading ? 'default' : 'pointer', transition: 'all 200ms', display: 'flex', alignItems: 'center' }}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {postDropdownOpen && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', right: 0, background: t.isDark ? 'rgba(12,12,22,0.98)' : t.card, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)', minWidth: 240, zIndex: 9999 }}>
              {[
                { mode: 'now',
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
                  label: 'Post Now', desc: 'Publish immediately' },
                { mode: 'later',
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
                  label: 'Schedule for Later', desc: 'Choose a date & time' },
                { mode: 'draft',
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
                  label: 'Save as Draft', desc: 'Finish and publish later' },
                { mode: 'approval',
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>,
                  label: 'Send for Approval', desc: 'Request team review' },
              ].map(({ mode, icon, label, desc }, idx, arr) => (
                <button key={mode} type="button"
                  onClick={() => { setScheduleMode(mode); setPostDropdownOpen(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: scheduleMode === mode ? t.primaryBg : 'none', border: 'none', borderBottom: idx < arr.length - 1 ? `1px solid ${t.border}` : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 120ms' }}
                  onMouseEnter={e => { if (scheduleMode !== mode) e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'; }}
                  onMouseLeave={e => { if (scheduleMode !== mode) e.currentTarget.style.background = 'none'; }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: scheduleMode === mode ? t.primaryBg : (t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: scheduleMode === mode ? t.primary : t.textSecondary }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: scheduleMode === mode ? t.primary : t.text }}>{label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{desc}</div>
                  </div>
                  {scheduleMode === mode && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Media Library Modal ─── */}
      {showLibrary && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowLibrary(false)}
        >
          <div
            style={{ background: t.isDark ? 'rgba(12,12,20,0.95)' : t.card, backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.1)' : t.border}`, borderRadius: 20, width: '100%', maxWidth: 820, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Media Library</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {contentType === 'carousel'
                    ? `Click files to add them — ${files.length} / 10 selected`
                    : 'Click a file to select it'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Upload button — GHL style */}
                <button type="button"
                  onClick={() => libraryFileInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: 'linear-gradient(135deg,#7C5CFC,#5B3FF0)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.3)', transition: 'opacity 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                  Upload
                </button>
                {contentType === 'carousel' && files.length > 0 && (
                  <Button variant="primary" size="sm" onClick={() => setShowLibrary(false)}>
                    Done ({files.length} selected)
                  </Button>
                )}
                <button
                  onClick={() => setShowLibrary(false)}
                  style={{ width: 30, height: 30, background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <IpClose size={14} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {libraryLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={130} borderRadius={10} />)}
                </div>
              ) : libraryFolder !== null ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <button
                      type="button" onClick={() => setLibraryFolder(null)}
                      style={{ padding: '5px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 7, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >← All Files</button>
                    <IpFolderOpen size={15} color={t.primary} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{libraryFolder}</span>
                    <span style={{ fontSize: 12, color: t.textMuted }}>· {folderLibraryFiles.length} {folderLibraryFiles.length === 1 ? 'file' : 'files'}</span>
                  </div>
                  {folderLibraryFiles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: t.textMuted, fontSize: 13 }}>No files in this folder</div>
                  ) : renderLibraryGrid(folderLibraryFiles)}
                </>
              ) : (
                <>
                  {libraryFolders.length > 0 && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 8 }}>
                        {libraryFolders.map(f => (
                          <div
                            key={f.folder}
                            onClick={() => setLibraryFolder(f.folder)}
                            style={{ background: t.isDark ? 'rgba(124,92,252,0.06)' : 'rgba(124,92,252,0.04)', border: `1.5px solid rgba(124,92,252,0.18)`, borderRadius: 12, cursor: 'pointer', padding: '18px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 90, transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)', backdropFilter: 'blur(8px)' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.4)'; e.currentTarget.style.background = 'rgba(124,92,252,0.1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,92,252,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.18)'; e.currentTarget.style.background = t.isDark ? 'rgba(124,92,252,0.06)' : 'rgba(124,92,252,0.04)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                          >
                            <IpFolderOpen size={28} color={t.primary} />
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{f.folder}</div>
                              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{f.count} {f.count === 1 ? 'file' : 'files'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
                        <div style={{ flex: 1, height: 1, background: t.border }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Files{looseLibraryFiles.length > 0 ? ` · ${looseLibraryFiles.length}` : ''}
                        </span>
                        <div style={{ flex: 1, height: 1, background: t.border }} />
                      </div>
                    </>
                  )}
                  {looseLibraryFiles.length === 0 && libraryFolders.length === 0 ? (
                    <EmptyState
                      icon={IpFolderOpen}
                      title="Your media library is empty"
                      subtitle="Upload files to your library first, then you can reuse them here."
                    />
                  ) : looseLibraryFiles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, color: t.textMuted, fontSize: 13 }}>
                      All files are organised into folders above
                    </div>
                  ) : renderLibraryGrid(looseLibraryFiles)}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Emoji picker portal — at root level, escapes all backdropFilter stacking contexts ─── */}
      {showEmojiPicker && mounted && (
        <div ref={emojiPortalRef}
          style={{
            position: 'fixed',
            top: Math.min(emojiPickerPos.top, window.innerHeight - 360),
            left: Math.min(Math.max(4, emojiPickerPos.left), window.innerWidth - 344),
            zIndex: 99999,
            background: t.isDark ? 'rgba(12,12,22,0.98)' : '#fff',
            border: `1px solid ${t.border}`,
            borderRadius: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
            width: 340,
            maxHeight: 360,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Scrollable grid */}
          <div style={{ overflowY: 'auto', padding: '8px 8px 10px' }}>
            {EMOJI_CATEGORIES.map(cat => (
              <div key={cat.label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 4px 4px' }}>{cat.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {cat.emojis.map(emoji => (
                    <button key={emoji} type="button"
                      onClick={() => { insertIntoCaption(emoji); setShowEmojiPicker(false); }}
                      style={{ width: 30, height: 30, background: 'none', border: 'none', cursor: 'pointer', fontSize: 19, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 80ms' }}
                      onMouseEnter={e => e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >{emoji}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── FB Background Styles picker portal — root level, escapes backdropFilter stacking contexts ─── */}
      {showBgPicker && mounted && (
        <div ref={bgPortalRef}
          style={{
            position: 'fixed',
            top: Math.min(bgPickerPos.top, window.innerHeight - 340),
            right: Math.max(0, bgPickerPos.right),
            zIndex: 99999,
            background: t.isDark ? 'rgba(12,12,22,0.98)' : '#fff',
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
            width: 282,
            maxHeight: Math.min(340, window.innerHeight - 80),
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Facebook Background Styles</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
            {FB_BG_OPTIONS.map(c => {
              const swatchBg = c.css || c.bg || (t.isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0');
              const isSelected = fbBgColor === c.id;
              return (
                <button key={c.id} type="button"
                  onClick={() => { setFbBgColor(c.id === 'none' ? null : c.id); setShowBgPicker(false); }}
                  title={c.label}
                  style={{ width: '100%', aspectRatio: '1', borderRadius: 8, background: swatchBg, border: isSelected ? `2.5px solid ${t.primary}` : `1.5px solid ${t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 100ms', transform: isSelected ? 'scale(1.08)' : 'scale(1)', boxShadow: isSelected ? `0 0 0 3px ${t.primary}44` : 'none' }}
                >
                  {c.id === 'none' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>
            Selecting a background generates a styled image posted to Facebook as a photo.
          </div>
        </div>
      )}

      {/* ─── Link Shortener / UTM Builder Modal ─── */}
      {showLinkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowLinkModal(false)}>
          <div style={{ background: t.isDark ? 'rgba(12,12,22,0.98)' : '#fff', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: `1px solid ${t.border}`, borderRadius: 18, width: '100%', maxWidth: 560, boxShadow: '0 32px 80px rgba(0,0,0,0.45)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: t.isDark ? 'rgba(255,255,255,0.07)' : t.input, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Insert Shortened Link</div>
              </div>
              <button type="button" onClick={() => setShowLinkModal(false)} style={{ width: 30, height: 30, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Name + Target URL */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    Name of the Link <span style={{ color: '#EF4444' }}>*</span>
                    <span title="A friendly label to identify this link (not shown in the post)" style={{ width: 14, height: 14, borderRadius: '50%', background: t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: 9, color: t.textMuted }}>i</span>
                  </label>
                  <input value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="e.g. summer_promo"
                    style={{ width: '100%', padding: '8px 11px', background: t.input, border: `1.5px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = t.primary} onBlur={e => e.target.style.borderColor = t.border} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    Target URL <span style={{ color: '#EF4444' }}>*</span>
                    <span title="The destination URL that the shortened link will redirect to" style={{ width: 14, height: 14, borderRadius: '50%', background: t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: 9, color: t.textMuted }}>i</span>
                  </label>
                  <div style={{ display: 'flex', border: `1.5px solid ${t.border}`, borderRadius: 8, overflow: 'hidden', background: t.input }}>
                    <span style={{ padding: '8px 10px', background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRight: `1px solid ${t.border}`, fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>https://</span>
                    <input value={linkTargetUrl} onChange={e => setLinkTargetUrl(e.target.value)} placeholder="mysite.com/page"
                      style={{ flex: 1, padding: '8px 10px', background: 'transparent', border: 'none', color: t.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', minWidth: 0 }} />
                  </div>
                </div>
              </div>

              {/* UTM Tracking section */}
              <div style={{ background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>Tracking Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, fontWeight: 600, color: t.primary, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${t.border}` }}>
                  <span>UTM Parameter</span><span>UTM Parameter Value</span>
                </div>

                {/* utm_campaign */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.primary, fontWeight: 600 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    UTM Campaign (utm_campaign) <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input value={linkUtmCampaign} onChange={e => setLinkUtmCampaign(e.target.value)} placeholder="e.g. summer_sale"
                    style={{ padding: '7px 10px', background: t.input, border: `1.5px solid ${t.border}`, borderRadius: 7, color: t.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                    onFocus={e => e.target.style.borderColor = t.primary} onBlur={e => e.target.style.borderColor = t.border} />
                </div>

                {/* utm_source */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.primary, fontWeight: 600 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    UTM Source (utm_source)
                  </label>
                  <input value={linkUtmSource} onChange={e => setLinkUtmSource(e.target.value)} placeholder="social"
                    style={{ padding: '7px 10px', background: t.input, border: `1.5px solid ${t.border}`, borderRadius: 7, color: t.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                    onFocus={e => e.target.style.borderColor = t.primary} onBlur={e => e.target.style.borderColor = t.border} />
                </div>

                {/* utm_medium */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.primary, fontWeight: 600 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    UTM Medium (utm_medium)
                  </label>
                  <input value={linkUtmMedium} onChange={e => setLinkUtmMedium(e.target.value)} placeholder="e.g. facebook, google"
                    style={{ padding: '7px 10px', background: t.input, border: `1.5px solid ${t.border}`, borderRadius: 7, color: t.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                    onFocus={e => e.target.style.borderColor = t.primary} onBlur={e => e.target.style.borderColor = t.border} />
                </div>

                {/* Custom params */}
                {linkCustomParams.map((param, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                    <input value={param.key} onChange={e => setLinkCustomParams(prev => prev.map((p, i) => i === idx ? { ...p, key: e.target.value } : p))} placeholder="Parameter name"
                      style={{ padding: '7px 10px', background: t.input, border: `1.5px solid ${t.border}`, borderRadius: 7, color: t.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={param.value} onChange={e => setLinkCustomParams(prev => prev.map((p, i) => i === idx ? { ...p, value: e.target.value } : p))} placeholder="Value"
                        style={{ flex: 1, padding: '7px 10px', background: t.input, border: `1.5px solid ${t.border}`, borderRadius: 7, color: t.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                      <button type="button" onClick={() => setLinkCustomParams(prev => prev.filter((_, i) => i !== idx))}
                        style={{ width: 30, height: 32, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={() => setLinkCustomParams(prev => [...prev, { key: '', value: '' }])}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: t.primary, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 0', marginTop: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Custom UTM Parameter
                </button>
              </div>

              {/* Preview of built URL */}
              {(linkTargetUrl || linkUtmCampaign) && (
                <div style={{ padding: '8px 12px', background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderRadius: 8, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Generated URL preview</div>
                  <div style={{ fontSize: 11, color: t.textSecondary, wordBreak: 'break-all', lineHeight: 1.5, fontFamily: 'monospace' }}>
                    {(() => {
                      const base = linkTargetUrl ? (linkTargetUrl.startsWith('http') ? linkTargetUrl : `https://${linkTargetUrl}`) : 'https://yoursite.com';
                      const params = new URLSearchParams();
                      if (linkUtmCampaign) params.set('utm_campaign', linkUtmCampaign);
                      if (linkUtmSource) params.set('utm_source', linkUtmSource);
                      if (linkUtmMedium) params.set('utm_medium', linkUtmMedium);
                      linkCustomParams.forEach(p => { if (p.key && p.value) params.set(p.key, p.value); });
                      const qs = params.toString();
                      return qs ? `${base}?${qs}` : base;
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 24px', borderTop: `1px solid ${t.border}` }}>
              <button type="button" onClick={() => setShowLinkModal(false)}
                style={{ padding: '9px 20px', borderRadius: 9, border: `1.5px solid ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button"
                disabled={!linkTargetUrl.trim() || !linkUtmCampaign.trim()}
                onClick={() => {
                  const base = linkTargetUrl.trim().startsWith('http') ? linkTargetUrl.trim() : `https://${linkTargetUrl.trim()}`;
                  const params = new URLSearchParams();
                  if (linkUtmCampaign) params.set('utm_campaign', linkUtmCampaign);
                  if (linkUtmSource) params.set('utm_source', linkUtmSource);
                  if (linkUtmMedium) params.set('utm_medium', linkUtmMedium);
                  linkCustomParams.forEach(p => { if (p.key && p.value) params.set(p.key, p.value); });
                  const qs = params.toString();
                  const finalUrl = qs ? `${base}?${qs}` : base;
                  insertIntoCaption(` ${finalUrl}`);
                  setShowLinkModal(false);
                }}
                style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: (!linkTargetUrl.trim() || !linkUtmCampaign.trim()) ? 'rgba(124,92,252,0.4)' : '#7C5CFC', color: '#fff', fontSize: 13, fontWeight: 700, cursor: (!linkTargetUrl.trim() || !linkUtmCampaign.trim()) ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.3)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Generate and Insert Link
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}

