/**
 * useBranding() — single source of truth for white-label brand tokens.
 *
 * Reads white_label_config from the authenticated user (which the backend
 * already merges from the parent agency account for sub-accounts/members).
 *
 * Falls back to ItsPosting defaults so non-agency users are unaffected.
 * Import this hook in any page/component that renders brand-sensitive copy.
 */
import { useAuthStore } from './store';

const DEFAULTS = {
  appName:      'ItsPosting',
  aiName:       'ItsPosting AI',
  primaryColor: null,       // null = use theme default
  logo:         null,
  hidePoweredBy: false,
  isWhiteLabeled: false,
};

export function useBranding() {
  const user = useAuthStore(s => s.user);
  const wl   = user?.white_label_config || {};

  return {
    appName:       wl.agencyName    || DEFAULTS.appName,
    aiName:        wl.aiAdvisorName || DEFAULTS.aiName,
    primaryColor:  wl.primaryColor  || DEFAULTS.primaryColor,
    logo:          wl.logo          || DEFAULTS.logo,
    hidePoweredBy: wl.hidePoweredBy || DEFAULTS.hidePoweredBy,
    isWhiteLabeled: !!(wl.agencyName || wl.logo || wl.primaryColor),
  };
}
