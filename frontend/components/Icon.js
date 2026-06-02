import {
  Hammer, Lightbulb, Star, Calendar, CloudSun, Home, HelpCircle, PartyPopper,
  Smile, Briefcase, Laugh, BookOpen, Flame,
  Facebook, Instagram, Globe, ChevronRight, ChevronLeft, Check, X,
  Image as ImageIcon, FileText, Layers, Video, Camera, Sparkles,
  Bell, Moon, Sun, Plus, Search, Settings, User, LogOut, MessageSquare,
  Users, Inbox, Send, Pencil, Trash2, Download, Upload,
  Clock, MapPin, RefreshCw, Copy, AlertTriangle
} from 'lucide-react';

const ICON_MAP = {
  // Wizard content-type cards
  text_post: FileText,
  photo_post: Camera,
  branded_card: Sparkles,
  carousel: Layers,
  video: Video,

  // Wizard "What's happening" cards
  custom: Pencil,
  job_finished: Hammer,
  share_tip: Lightbulb,
  got_review: Star,
  promotion: Calendar,
  seasonal: CloudSun,
  community: Home,
  faq: HelpCircle,
  team_spotlight: PartyPopper,

  // Tone/vibe cards
  friendly: Smile,
  professional: Briefcase,
  funny: Laugh,
  educational: BookOpen,
  urgent: Flame,

  // Platforms (use IpFacebook etc in non-wizard UI — these are for wizard cards only)
  facebook: Facebook,
  instagram: Instagram,
  google_business: Globe,
  all_platforms: Layers,

  // UI actions
  next: ChevronRight,
  back: ChevronLeft,
  check: Check,
  close: X,
  sparkles: Sparkles,
  bell: Bell,
  moon: Moon,
  sun: Sun,
  add: Plus,
  search: Search,
  settings: Settings,
  user: User,
  logout: LogOut,
  message: MessageSquare,
  contacts: Users,
  inbox: Inbox,
  send: Send,
  edit: Pencil,
  delete: Trash2,
  download: Download,
  upload: Upload,
  schedule: Clock,
  location: MapPin,
  image: ImageIcon,
  refresh: RefreshCw,
  copy: Copy,
  warning: AlertTriangle,
};

export default function Icon({ name, size = 20, color, className = '', ...props }) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) {
    console.warn(`[Icon] Unknown icon name: "${name}"`);
    return null;
  }
  return (
    <IconComponent
      size={size}
      color={color || '#7C5CFC'}
      strokeWidth={2}
      className={className}
      {...props}
    />
  );
}
