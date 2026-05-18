import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpSave, IpCredits, IpPalette, IpGlobe, IpDelete, IpClose, IpWarning,
  IpBusiness, IpShare, IpCheck, IpFacebook, IpInstagram,
  IpGoogle, IpSparkle, IpSchedule, IpLinkedIn, IpTikTok,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Input, Badge, SectionHeader, Spinner, ConfirmModal } from '../components/ui';
import { useTheme } from '../lib/theme';
import { customerAPI, contentAPI, socialAPI, scraperAPI, dmsAPI, apiKeysAPI } from '../lib/api';
import IntegrationSetupWizard from '../components/IntegrationSetupWizard';

const TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern Time (ET)',    offset: 'UTC-5/4'   },
  { value: 'America/Chicago',     label: 'Central Time (CT)',    offset: 'UTC-6/5'   },
  { value: 'America/Denver',      label: 'Mountain Time (MT)',   offset: 'UTC-7/6'   },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)',    offset: 'UTC-8/7'   },
  { value: 'America/Phoenix',     label: 'Arizona (no DST)',     offset: 'UTC-7'     },
  { value: 'America/Anchorage',   label: 'Alaska Time (AKT)',    offset: 'UTC-9/8'   },
  { value: 'Pacific/Honolulu',    label: 'Hawaii Time (HT)',     offset: 'UTC-10'    },
  { value: 'Asia/Karachi',        label: 'Pakistan Standard',    offset: 'UTC+5'     },
  { value: 'Europe/London',       label: 'London (GMT/BST)',     offset: 'UTC+0/1'   },
  { value: 'Europe/Paris',        label: 'Central European',     offset: 'UTC+1/2'   },
  { value: 'Europe/Berlin',       label: 'Berlin / Frankfurt',   offset: 'UTC+1/2'   },
  { value: 'Europe/Madrid',       label: 'Madrid / Barcelona',   offset: 'UTC+1/2'   },
  { value: 'Europe/Rome',         label: 'Rome / Milan',         offset: 'UTC+1/2'   },
  { value: 'Europe/Amsterdam',    label: 'Amsterdam',            offset: 'UTC+1/2'   },
  { value: 'Europe/Brussels',     label: 'Brussels',             offset: 'UTC+1/2'   },
  { value: 'Europe/Vienna',       label: 'Vienna',               offset: 'UTC+1/2'   },
  { value: 'Europe/Warsaw',       label: 'Warsaw',               offset: 'UTC+1/2'   },
  { value: 'Europe/Stockholm',    label: 'Stockholm',            offset: 'UTC+1/2'   },
  { value: 'Europe/Oslo',         label: 'Oslo',                 offset: 'UTC+1/2'   },
  { value: 'Europe/Copenhagen',   label: 'Copenhagen',           offset: 'UTC+1/2'   },
  { value: 'Europe/Zurich',       label: 'Zurich',               offset: 'UTC+1/2'   },
  { value: 'Europe/Lisbon',       label: 'Lisbon',               offset: 'UTC+0/1'   },
  { value: 'Europe/Dublin',       label: 'Dublin',               offset: 'UTC+0/1'   },
  { value: 'Europe/Helsinki',     label: 'Helsinki',             offset: 'UTC+2/3'   },
  { value: 'Europe/Athens',       label: 'Athens',               offset: 'UTC+2/3'   },
  { value: 'Europe/Bucharest',    label: 'Bucharest',            offset: 'UTC+2/3'   },
  { value: 'Europe/Istanbul',     label: 'Istanbul',             offset: 'UTC+3'     },
  { value: 'Europe/Moscow',       label: 'Moscow',               offset: 'UTC+3'     },
  { value: 'Asia/Dubai',          label: 'Gulf Standard (GST)',  offset: 'UTC+4'     },
  { value: 'Asia/Baku',           label: 'Azerbaijan',           offset: 'UTC+4'     },
  { value: 'Asia/Tbilisi',        label: 'Georgia',              offset: 'UTC+4'     },
  { value: 'Asia/Yerevan',        label: 'Armenia',              offset: 'UTC+4'     },
  { value: 'Asia/Kabul',          label: 'Afghanistan',          offset: 'UTC+4:30'  },
  { value: 'Asia/Tashkent',       label: 'Uzbekistan',           offset: 'UTC+5'     },
  { value: 'Asia/Yekaterinburg',  label: 'Yekaterinburg',        offset: 'UTC+5'     },
  { value: 'Asia/Kolkata',        label: 'India Standard (IST)', offset: 'UTC+5:30'  },
  { value: 'Asia/Colombo',        label: 'Sri Lanka',            offset: 'UTC+5:30'  },
  { value: 'Asia/Kathmandu',      label: 'Nepal',                offset: 'UTC+5:45'  },
  { value: 'Asia/Dhaka',          label: 'Bangladesh',           offset: 'UTC+6'     },
  { value: 'Asia/Almaty',         label: 'Kazakhstan',           offset: 'UTC+6'     },
  { value: 'Asia/Rangoon',        label: 'Myanmar',              offset: 'UTC+6:30'  },
  { value: 'Asia/Bangkok',        label: 'Bangkok / Hanoi',      offset: 'UTC+7'     },
  { value: 'Asia/Jakarta',        label: 'Jakarta',              offset: 'UTC+7'     },
  { value: 'Asia/Ho_Chi_Minh',    label: 'Ho Chi Minh City',     offset: 'UTC+7'     },
  { value: 'Asia/Singapore',      label: 'Singapore (SGT)',      offset: 'UTC+8'     },
  { value: 'Asia/Kuala_Lumpur',   label: 'Kuala Lumpur',         offset: 'UTC+8'     },
  { value: 'Asia/Manila',         label: 'Manila',               offset: 'UTC+8'     },
  { value: 'Asia/Shanghai',       label: 'China Standard (CST)', offset: 'UTC+8'     },
  { value: 'Asia/Hong_Kong',      label: 'Hong Kong',            offset: 'UTC+8'     },
  { value: 'Asia/Taipei',         label: 'Taipei',               offset: 'UTC+8'     },
  { value: 'Asia/Ulaanbaatar',    label: 'Ulaanbaatar',          offset: 'UTC+8'     },
  { value: 'Asia/Seoul',          label: 'Korea Standard (KST)', offset: 'UTC+9'     },
  { value: 'Asia/Tokyo',          label: 'Japan Standard (JST)', offset: 'UTC+9'     },
  { value: 'Australia/Perth',     label: 'Perth (AWST)',          offset: 'UTC+8'     },
  { value: 'Australia/Adelaide',  label: 'Adelaide (ACST)',       offset: 'UTC+9:30'  },
  { value: 'Australia/Darwin',    label: 'Darwin (ACST)',         offset: 'UTC+9:30'  },
  { value: 'Australia/Brisbane',  label: 'Brisbane (AEST)',       offset: 'UTC+10'    },
  { value: 'Australia/Sydney',    label: 'Sydney (AEST/AEDT)',    offset: 'UTC+10/11' },
  { value: 'Australia/Melbourne', label: 'Melbourne',             offset: 'UTC+10/11' },
  { value: 'Pacific/Auckland',    label: 'New Zealand (NZST)',    offset: 'UTC+12/13' },
  { value: 'Pacific/Fiji',        label: 'Fiji',                  offset: 'UTC+12'    },
  { value: 'Pacific/Guam',        label: 'Guam',                  offset: 'UTC+10'    },
  { value: 'America/Sao_Paulo',   label: 'Brasília (BRT)',        offset: 'UTC-3'     },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', offset: 'UTC-3'  },
  { value: 'America/Santiago',    label: 'Santiago',              offset: 'UTC-4/3'   },
  { value: 'America/Bogota',      label: 'Bogotá',                offset: 'UTC-5'     },
  { value: 'America/Lima',        label: 'Lima',                  offset: 'UTC-5'     },
  { value: 'America/Mexico_City', label: 'Mexico City',           offset: 'UTC-6/5'   },
  { value: 'America/Toronto',     label: 'Toronto (ET)',          offset: 'UTC-5/4'   },
  { value: 'America/Vancouver',   label: 'Vancouver (PT)',        offset: 'UTC-8/7'   },
  { value: 'Africa/Cairo',        label: 'Cairo (EET)',           offset: 'UTC+2'     },
  { value: 'Africa/Lagos',        label: 'Lagos (WAT)',           offset: 'UTC+1'     },
  { value: 'Africa/Nairobi',      label: 'Nairobi (EAT)',         offset: 'UTC+3'     },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)',   offset: 'UTC+2'     },
  { value: 'UTC',                 label: 'UTC',                   offset: 'UTC+0'     },
];

const VISUAL_STYLES = [
  { id: 'modern', name: 'Modern', description: 'Clean, contemporary' },
  { id: 'professional', name: 'Professional', description: 'Polished, business' },
  { id: 'bold', name: 'Bold', description: 'Strong, vibrant' },
  { id: 'minimal', name: 'Minimal', description: 'Simple, elegant' },
];

const TONES = [
  { id: 'professional', name: 'Professional' },
  { id: 'friendly', name: 'Friendly' },
  { id: 'expert', name: 'Expert' },
  { id: 'casual', name: 'Casual' },
];

const PLATFORM_CONFIG = {
  facebook: {
    label: 'Facebook',
    Icon: IpFacebook,
    color: '#1877F2',
    description: 'Post to your page',
    tokenHelp: {
      title: 'How to get your Facebook Page Token:',
      steps: [
        { text: 'Go to ', link: { url: 'https://developers.facebook.com/apps/creation/', label: 'Facebook Developers' }, suffix: ' → Create App → Business type (required first step)' },
        { text: 'In your app, click Add Product → Facebook Login → Set Up' },
        { text: 'Go to ', link: { url: 'https://developers.facebook.com/tools/explorer/', label: 'Graph API Explorer' }, suffix: ' → select your App → Page Access Token' },
        { text: 'Add permissions: pages_manage_posts, pages_read_engagement, pages_messaging → Generate' },
        { text: 'Copy the Page Access Token and paste below' },
        { text: 'Note: pages_manage_posts and pages_messaging (required for Inbox DMs) require Facebook App Review for non-developer accounts' },
      ],
      pageIdLabel: 'Page ID',
      pageIdHelp: 'Found in your Facebook Page settings → About → Page ID',
    },
  },
  instagram: {
    label: 'Instagram',
    Icon: IpInstagram,
    color: '#E1306C',
    description: 'Share to your profile',
    tokenHelp: {
      title: 'How to get your Instagram Token:',
      steps: [
        { text: 'Go to ', link: { url: 'https://developers.facebook.com/tools/explorer', label: 'Facebook Graph API Explorer' } },
        { text: 'Select your App → click "Generate Access Token"' },
        { text: 'Enable instagram_basic, instagram_content_publish, and instagram_manage_messages permissions (instagram_manage_messages required for Inbox DMs)' },
        { text: 'Copy the Access Token and paste below' },
      ],
      pageIdLabel: 'Instagram Business Account ID',
      pageIdHelp: 'Found in Instagram Settings → Account → Professional Account',
    },
  },
  google_business: {
    label: 'Business Profile',
    Icon: IpGoogle,
    color: '#4285F4',
    description: 'Post to your business listing',
    tokenHelp: {
      title: 'How to get your Google Business Token:',
      steps: [
        { text: 'Go to ', link: { url: 'https://developers.google.com/oauthplayground', label: 'Google OAuth Playground' } },
        { text: 'Find "Google My Business API v4" in the list' },
        { text: 'Select: https://www.googleapis.com/auth/business.manage' },
        { text: 'Click "Authorize APIs" and sign in with your Google account' },
        { text: 'Click "Exchange authorization code for tokens"' },
        { text: 'Copy the Access Token and paste below' },
      ],
      pageIdLabel: 'Business Account ID',
      pageIdHelp: 'Found in your Google Business Profile dashboard URL',
    },
  },
  linkedin: {
    label: 'LinkedIn',
    Icon: IpLinkedIn,
    color: '#0A66C2',
    description: 'Post to your company page',
    tokenHelp: {
      title: 'LinkedIn requires Partner Program access (2–8 weeks)',
      badge: '⏱ Partnership approval required — not instant',
      steps: [
        { text: '⚠️ LinkedIn does NOT offer public API access. You must apply to the LinkedIn Partner Program first.' },
        { text: 'Apply at ', link: { url: 'https://developer.linkedin.com/partner-programs', label: 'LinkedIn Partner Programs' }, suffix: ' — select the Social Sharing tier' },
        { text: 'Create an app at ', link: { url: 'https://www.linkedin.com/developers/apps/new', label: 'LinkedIn Developers' }, suffix: ' — requires a Company LinkedIn Page' },
        { text: 'In your app → Products → request "Share on LinkedIn" (posting) and "Messaging on LinkedIn" (for Inbox DMs) — submit justification for your scheduling use case' },
        { text: 'Once approved (2–8 weeks), generate an access token under the Auth tab' },
        { text: 'Paste the access token (must include w_organization_social + w_messaging scopes) and your Company URN (urn:li:organization:XXXXXXXX) below' },
      ],
      pageIdLabel: 'Company URN (e.g. urn:li:organization:12345678)',
      pageIdHelp: 'Find the numeric ID in your LinkedIn Company Page URL after /company/',
    },
  },
  tiktok: {
    label: 'TikTok',
    Icon: IpTikTok,
    color: '#010101',
    description: 'Post to your business account',
    tokenHelp: {
      title: 'TikTok Content Posting API (2–6 week review)',
      badge: '⏱ App review required — posts are private until approved',
      steps: [
        { text: 'Register a TikTok developer account at ', link: { url: 'https://developers.tiktok.com/', label: 'developers.tiktok.com' } },
        { text: 'Create an app at ', link: { url: 'https://developers.tiktok.com/apps/', label: 'Manage Apps' }, suffix: ' → Create App' },
        { text: 'Under Scopes, request "Content Posting API" — describe your scheduling/management use case clearly' },
        { text: 'TikTok review takes 2–6 weeks. Until approved + audited, all posts will be private-only.' },
        { text: 'Once approved, generate a user access token with video.publish scope' },
        { text: 'Paste the access token and your TikTok Open ID below' },
      ],
      pageIdLabel: 'TikTok Open ID (your account ID)',
      pageIdHelp: 'Found in TikTok for Business → Account Settings → Open ID',
    },
  },
};

// ─── Social Platform Wizard Configs ──────────────────────────────────────────

const FACEBOOK_SOCIAL_WIZARD = {
  title: 'Facebook',
  slides: [
    {
      heading: 'Create a Facebook Developer App',
      subtext: 'All Facebook page posting goes through the Facebook Developer API. Create a free developer app — it takes 2 minutes.\n\nNote: pages_manage_posts permission requires Facebook App Review for pages you don\'t already have developer access to.',
      callout: { platformName: 'Facebook Developers', highlight: 'My Apps → Create App → Business', color: '#1877F2' },
      linkButton: { label: 'Open Facebook Developers ↗', url: 'https://developers.facebook.com/apps/creation/' },
    },
    {
      heading: 'Add Facebook Login to your app',
      subtext: 'In your app dashboard → Add Product → Facebook Login → Set Up. This unlocks the permission scopes you\'ll need to generate a page access token.',
      callout: { platformName: 'App Dashboard', highlight: 'Add Product → Facebook Login → Set Up', color: '#1877F2' },
      linkButton: { label: 'Open your apps ↗', url: 'https://developers.facebook.com/apps/' },
    },
    {
      heading: 'Generate a Page Access Token',
      subtext: 'Go to Graph API Explorer → select your App → change token type to "Page Access Token" → choose your page → add permissions: pages_manage_posts, pages_read_engagement, pages_messaging → click Generate.\n\npages_messaging is required to receive DMs in the ItsPosting Inbox.',
      callout: { platformName: 'Graph API Explorer', highlight: 'Page Access Token → Generate', color: '#1877F2', note: 'Select your business page from the dropdown' },
      linkButton: { label: 'Open Graph API Explorer ↗', url: 'https://developers.facebook.com/tools/explorer/' },
    },
    {
      heading: 'Paste your token and connect',
      subtext: 'Paste the Page Access Token you generated. Click "Test connection" to verify it can reach your page.',
      isCredentialSlide: true,
      warningNote: 'pages_manage_posts and pages_messaging (required for Inbox DMs) require Facebook App Review for pages where you aren\'t already a developer. Graph API Explorer tokens expire in 60 days — use a System User token for production.',
    },
  ],
};
const FACEBOOK_SOCIAL_FIELDS = [
  { key: 'accessToken', label: 'Page Access Token', type: 'password', placeholder: 'EAAxxxxxxxx...', required: true, helpText: 'Generated via Graph API Explorer → Page Access Token' },
  { key: 'pageId', label: 'Page ID', type: 'text', placeholder: '123456789012345', hint: 'optional — auto-filled on test', helpText: 'Facebook Page → About → Page Transparency → Page ID' },
  { key: 'accountName', label: 'Display Name', type: 'text', placeholder: "Mike's Plumbing", hint: 'optional — auto-filled on test' },
];

const INSTAGRAM_SOCIAL_WIZARD = {
  title: 'Instagram',
  slides: [
    {
      heading: 'Switch to a Professional account',
      subtext: 'Instagram publishing via API requires a Professional account (Business or Creator) linked to a Facebook Page.\n\nIf you already have a Business account, skip this step.',
      callout: { platformName: 'Instagram', highlight: 'Settings → Account → Professional Account', color: '#E1306C' },
      linkButton: { label: 'Switch to Professional ↗', url: 'https://www.instagram.com/accounts/convert_to_ia/' },
    },
    {
      heading: 'Generate a token with Instagram permissions',
      subtext: 'Go to Graph API Explorer → select your Facebook Developer App → Generate User Token → add permissions: instagram_basic, instagram_content_publish, instagram_manage_messages, pages_read_engagement → Generate.\n\ninstagram_manage_messages is required to receive DMs in the ItsPosting Inbox. Your Instagram Business Account ID will auto-fill when you test.',
      callout: { platformName: 'Graph API Explorer', highlight: 'instagram_basic + instagram_content_publish + instagram_manage_messages', color: '#E1306C', note: 'instagram_manage_messages required for Inbox DMs' },
      linkButton: { label: 'Open Graph API Explorer ↗', url: 'https://developers.facebook.com/tools/explorer/' },
    },
    {
      heading: 'Paste your token and connect',
      subtext: 'Paste the access token you generated. Test connection will verify it and auto-fill your Instagram Business Account ID.',
      isCredentialSlide: true,
    },
  ],
};
const INSTAGRAM_SOCIAL_FIELDS = [
  { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'EAAxxxxxxxx...', required: true, helpText: 'From Graph API Explorer with instagram_basic + instagram_content_publish + instagram_manage_messages permissions' },
  { key: 'pageId', label: 'Instagram Business Account ID', type: 'text', placeholder: '17841400000000001', hint: 'optional — auto-filled on test', helpText: 'Auto-filled when you click Test connection' },
  { key: 'accountName', label: 'Display Name', type: 'text', placeholder: '@mikes.plumbing', hint: 'optional — auto-filled on test' },
];

const GOOGLE_SOCIAL_WIZARD = {
  title: 'Google Business Profile',
  slides: [
    {
      heading: 'Enable the Business Profile API',
      subtext: 'Go to Google Cloud Console → APIs & Services → Library → search for "Business Profile API" → click Enable. If you don\'t have a project yet, create one first.',
      callout: { platformName: 'Google Cloud Console', highlight: 'API Library → Business Profile API → Enable', color: '#4285F4' },
      linkButton: { label: 'Open API Library ↗', url: 'https://console.cloud.google.com/apis/library/' },
    },
    {
      heading: 'Generate an access token via OAuth Playground',
      subtext: 'Go to Google OAuth Playground → in the left panel, enter the scope:\nhttps://www.googleapis.com/auth/business.manage\n\nClick Authorize APIs → sign in with your Google account → click "Exchange authorization code for tokens" → copy the Access Token.',
      callout: { platformName: 'OAuth Playground', highlight: 'googleapis.com/auth/business.manage → Authorize', color: '#4285F4', note: 'Copy the Access Token, not the Refresh Token' },
      linkButton: { label: 'Open OAuth Playground ↗', url: 'https://developers.google.com/oauthplayground' },
    },
    {
      heading: 'Find your Business Account ID',
      subtext: 'Your Business Account ID is visible in your Google Business Profile dashboard URL, or under Business Profile → Info → Advanced settings.',
      callout: { platformName: 'Google Business Profile', highlight: 'Info → Advanced settings → Account ID', color: '#4285F4' },
      linkButton: { label: 'Open Business Profile ↗', url: 'https://business.google.com/' },
    },
    {
      heading: 'Paste your token and connect',
      subtext: 'Paste the access token from OAuth Playground and your Business Account ID.',
      isCredentialSlide: true,
      warningNote: 'OAuth Playground tokens expire in 1 hour. For a long-lived connection, you need to set up Google OAuth credentials in Cloud Console and use a refresh token.',
    },
  ],
};
const GOOGLE_SOCIAL_FIELDS = [
  { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'ya29.xxxxxxxxxx...', required: true, helpText: 'From Google OAuth Playground — expires in 1 hour' },
  { key: 'pageId', label: 'Business Account ID', type: 'text', placeholder: '1234567890', hint: 'optional — auto-filled on test', helpText: 'Found in Google Business Profile URL or Advanced settings' },
  { key: 'accountName', label: 'Display Name', type: 'text', placeholder: "Mike's Plumbing", hint: 'optional — auto-filled on test' },
];

const LINKEDIN_SOCIAL_WIZARD = {
  title: 'LinkedIn',
  slides: [
    {
      heading: 'LinkedIn requires Partner Program access',
      badge: '⏱ 2-8 week approval process',
      subtext: 'Unlike other platforms, LinkedIn does not offer public API access for posting. To post via API you must apply to the LinkedIn Partner Program — a formal approval process.\n\nThe Social Sharing tier is what you need. Approval typically takes 2-8 weeks.',
      callout: { platformName: 'LinkedIn Developer Portal', highlight: 'Partner Programs → Social Sharing tier', color: '#0A66C2' },
      linkButton: { label: 'Apply to Partner Program ↗', url: 'https://developer.linkedin.com/partner-programs' },
    },
    {
      heading: 'Create a developer app and apply for the product',
      subtext: 'Create an app at LinkedIn Developers (requires a Company LinkedIn Page).\n\nIn your app → Products → find "Share on LinkedIn" → click Select → submit your application explaining your posting use case. Also request "Messaging on LinkedIn" to receive DMs in the ItsPosting Inbox.\n\nOnce approved, LinkedIn grants your app the posting and messaging permissions.',
      callout: { platformName: 'LinkedIn Developer App', highlight: 'Products → Share on LinkedIn → Pending review', color: '#0A66C2', note: 'Describe scheduling / management use case clearly' },
      linkButton: { label: 'Open LinkedIn Developers ↗', url: 'https://www.linkedin.com/developers/apps/new' },
    },
    {
      heading: 'Enter your LinkedIn credentials',
      subtext: 'Once approved, generate an access token under your app → Auth → OAuth 2.0 Tools. Ensure the token includes w_organization_social (posting) and w_messaging (Inbox DMs) scopes.\n\nYour Company URN is in the format urn:li:organization:XXXXXXXX — the numeric ID is in your LinkedIn Company Page URL.',
      isCredentialSlide: true,
      warningNote: 'Tokens expire — use a refresh token workflow for production. Generate via your app → Auth → OAuth 2.0 Tools after Partner Program approval.',
    },
  ],
};
const LINKEDIN_SOCIAL_FIELDS = [
  { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'AQV...', required: true, helpText: 'Generated via LinkedIn Developer App → Auth → OAuth 2.0 Tools (requires Partner Program approval)' },
  { key: 'pageId', label: 'Company URN', type: 'text', placeholder: 'urn:li:organization:12345678', helpText: 'Find the numeric ID in your LinkedIn Company Page URL after /company/' },
  { key: 'accountName', label: 'Display Name', type: 'text', placeholder: "Mike's Plumbing", hint: 'optional — auto-filled on test' },
];

const TIKTOK_SOCIAL_WIZARD = {
  title: 'TikTok',
  slides: [
    {
      heading: 'Register a TikTok Developer account',
      badge: '⏱ 2-6 week app review required',
      subtext: 'TikTok posting requires the Content Posting API. Register at developers.tiktok.com using a TikTok for Business account.\n\nUntil your app passes TikTok\'s audit, all posts will be private-only (visible only to you).',
      callout: { platformName: 'TikTok Developer Portal', highlight: 'Register Developer Account', color: '#ff0050' },
      linkButton: { label: 'Open TikTok Developers ↗', url: 'https://developers.tiktok.com/' },
    },
    {
      heading: 'Create an app and request Content Posting API',
      subtext: 'Manage Apps → Create App → under Scopes, find and request "Content Posting API".\n\nDescribe your scheduling/management use case clearly — vague descriptions get rejected. Review takes 2-6 weeks.',
      callout: { platformName: 'TikTok Developer Portal', highlight: 'Manage Apps → Scopes → Content Posting API', color: '#ff0050', note: 'Explain your scheduling use case clearly' },
      linkButton: { label: 'Open TikTok Apps ↗', url: 'https://developers.tiktok.com/apps/' },
    },
    {
      heading: 'Enter your TikTok credentials',
      subtext: 'Once approved, generate a user access token with video.publish scope. Your Open ID identifies your TikTok account.',
      isCredentialSlide: true,
      warningNote: 'Until your TikTok app passes audit, all posts will be private-only and only visible to you.',
    },
  ],
};
const TIKTOK_SOCIAL_FIELDS = [
  { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'act.example...', required: true, helpText: 'Generated after app approval — must have video.publish scope' },
  { key: 'pageId', label: 'Open ID', type: 'text', placeholder: 'MS4wLjABAAAA...', hint: 'optional — auto-filled on test', helpText: 'Your TikTok account identifier — found in TikTok for Business → Account Settings' },
  { key: 'accountName', label: 'Display Name', type: 'text', placeholder: '@mikes.plumbing', hint: 'optional — auto-filled on test' },
];

const SOCIAL_WIZARD_MAP = {
  facebook:        { wizard: FACEBOOK_SOCIAL_WIZARD,  fields: FACEBOOK_SOCIAL_FIELDS },
  instagram:       { wizard: INSTAGRAM_SOCIAL_WIZARD, fields: INSTAGRAM_SOCIAL_FIELDS },
  google_business: { wizard: GOOGLE_SOCIAL_WIZARD,    fields: GOOGLE_SOCIAL_FIELDS },
  linkedin:        { wizard: LINKEDIN_SOCIAL_WIZARD,  fields: LINKEDIN_SOCIAL_FIELDS },
  tiktok:          { wizard: TIKTOK_SOCIAL_WIZARD,    fields: TIKTOK_SOCIAL_FIELDS },
};

export default function Settings() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const [profile, setProfile] = useState(null);
  const [providers, setProviders] = useState(null);
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [socialStatus, setSocialStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [scraperUrl, setScraperUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [timezone, setTimezone] = useState('UTC');
  const [loadError, setLoadError] = useState(false);

  // Brand asset upload
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  // Social platform wizard modal
  const [socialWizardModal, setSocialWizardModal] = useState(null); // null | 'facebook' | 'instagram' | 'google_business' | 'linkedin' | 'tiktok'
  const [dmsStats, setDmsStats] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Developer API Keys
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [createKeyStep, setCreateKeyStep] = useState(1); // 1=name+expiry, 2=scopes, 3=reveal
  const [newKeyForm, setNewKeyForm] = useState({ name: '', expiry: 'never', scopes: [] });
  const [createKeyError, setCreateKeyError] = useState('');
  const [createKeySaving, setCreateKeySaving] = useState(false);
  const [createdRawKey, setCreatedRawKey] = useState(null);
  const [revokingKeyId, setRevokingKeyId] = useState(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState(null);
  const [keyCopied, setKeyCopied] = useState(false);

  const openCreateKeyModal = () => {
    setNewKeyForm({ name: '', expiry: 'never', scopes: [] });
    setCreateKeyStep(1);
    setCreateKeyError('');
    setCreatedRawKey(null);
    setKeyCopied(false);
    setShowCreateKeyModal(true);
  };

  const toggleScope = (scope) => {
    setNewKeyForm(f => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope],
    }));
  };

  const handleCreateKey = async () => {
    setCreateKeyError('');
    setCreateKeySaving(true);
    try {
      const res = await apiKeysAPI.create({ name: newKeyForm.name, expiry: newKeyForm.expiry, scopes: newKeyForm.scopes });
      setCreatedRawKey(res.data.rawKey);
      setApiKeys(k => [res.data.key, ...k]);
      setCreateKeyStep(3);
    } catch (err) {
      setCreateKeyError(err.response?.data?.error || 'Failed to create API key');
    } finally {
      setCreateKeySaving(false);
    }
  };

  const handleRevokeKey = async (id) => {
    setRevokingKeyId(id);
    try {
      await apiKeysAPI.revoke(id);
      setApiKeys(k => k.filter(key => key.id !== id));
      setRevokeConfirmId(null);
    } catch {
      showToast('Failed to revoke key', 'error');
    } finally {
      setRevokingKeyId(null);
    }
  };

  const copyKey = () => {
    if (createdRawKey) {
      navigator.clipboard.writeText(createdRawKey).catch(() => {});
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadData();
  }, []);

  useEffect(() => {
    const { connected, error } = router.query;
    if (connected) {
      const names = { facebook: 'Facebook & Instagram', google: 'Business Profile', linkedin: 'LinkedIn', tiktok: 'TikTok' };
      showToast(`${names[connected] || connected} connected successfully!`);
      router.replace('/settings', undefined, { shallow: true });
      loadSocialAccounts();
    }
    if (error) {
      const msgs = {
        facebook_denied: 'Connection was cancelled',
        google_denied: 'Connection was cancelled',
        facebook_failed: 'Failed to connect Facebook. Please try again.',
        google_failed: 'Failed to connect Google. Please try again.',
        linkedin_denied: 'Connection was cancelled',
        linkedin_failed: 'Failed to connect LinkedIn. Please try again.',
        tiktok_denied: 'Connection was cancelled',
        tiktok_failed: 'Failed to connect TikTok. Please try again.',
      };
      showToast(msgs[error] || `Connection error: ${error}`, 'error');
      router.replace('/settings', undefined, { shallow: true });
    }
  }, [router.query]);

  const loadData = async () => {
    try {
      const [profileRes, providersRes, scrapedRes, dmsRes] = await Promise.all([
        customerAPI.getProfile(),
        contentAPI.getProviders().catch(() => ({ data: {} })),
        scraperAPI.getData().catch(() => ({ data: { hasData: false } })),
        dmsAPI.getStats().catch(() => ({ data: null })),
      ]);
      setProfile(profileRes.data);
      setTimezone(profileRes.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setProviders(providersRes.data);
      setDmsStats(dmsRes.data);
      if (scrapedRes.data.hasData) {
        setScrapedData(scrapedRes.data);
        setScraperUrl(scrapedRes.data.website || '');
      }
    } catch {
      showToast('Failed to load settings', 'error');
      setLoadError(true);
    } finally {
      setLoading(false);
    }
    loadSocialAccounts();
    loadApiKeys();
  };

  const loadApiKeys = async () => {
    setLoadingKeys(true);
    try {
      const res = await apiKeysAPI.list();
      setApiKeys(res.data.keys || []);
    } catch {
      // silently — non-critical
    } finally {
      setLoadingKeys(false);
    }
  };

  const loadSocialAccounts = async () => {
    try {
      const [accountsRes, statusRes] = await Promise.all([
        socialAPI.getAccounts(),
        socialAPI.getStatus(),
      ]);
      setSocialAccounts(accountsRes.data);
      setSocialStatus(statusRes.data);
    } catch {}
  };

  const handleScrape = async () => {
    if (!scraperUrl.trim()) { showToast('Please enter a website URL', 'error'); return; }
    let url = scraperUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    setScraping(true);
    try {
      const res = await scraperAPI.scrape(url);
      setScrapedData({
        hasData: true,
        website: url,
        services: res.data.data.services,
        about: res.data.data.about,
        scrapedAt: new Date().toISOString(),
      });
      showToast(res.data.cached ? 'Loaded saved website data' : `Found ${res.data.data.services.length} services from the site`);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to scrape website', 'error');
    } finally {
      setScraping(false);
    }
  };

  const handleClearScrape = () => {
    setConfirmModal({
      title: 'Clear Website Data',
      message: 'This will remove your saved website scan. You can re-scan anytime.',
      confirmLabel: 'Clear',
      onConfirm: async () => {
        try {
          await scraperAPI.clearData();
          setScrapedData(null);
          setScraperUrl('');
          showToast('Saved website data cleared');
        } catch {
          showToast('Failed to clear data', 'error');
        }
      },
    });
  };

  const handleConnect = (platform) => {
    setSocialWizardModal(platform);
  };

  const handleOAuthConnect = async (platform) => {
    try {
      const res = await socialAPI.getOAuthUrl(platform);
      window.location.href = res.data.url;
    } catch {
      showToast('Failed to start OAuth — try "Enter Tokens" instead', 'error');
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await dmsAPI.sync();
      const res = await dmsAPI.getStats();
      setDmsStats(res.data);
      showToast('Inbox synced successfully');
    } catch {
      showToast('Failed to sync inbox', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleAssetUpload = async (file, field) => {
    if (!file) return;
    const setUploading = field === 'logo_url' ? setLogoUploading : setFaviconUploading;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('asset', file);
      const res = await customerAPI.uploadAsset(formData);
      setProfile(prev => ({ ...prev, [field]: res.data.url }));
      showToast(field === 'logo_url' ? 'Logo uploaded' : 'Brand icon uploaded');
    } catch {
      showToast('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDisconnect = async (platform) => {
    const label = PLATFORM_CONFIG[platform]?.label || platform;
    setConfirmModal({
      title: `Disconnect ${label}`,
      message: `This will disconnect ${label} — you can reconnect anytime.`,
      confirmLabel: 'Disconnect',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setDisconnecting(platform);
        try {
          await socialAPI.disconnect(platform);
          showToast('Account disconnected');
          loadSocialAccounts();
        } catch {
          showToast('Failed to disconnect', 'error');
        } finally {
          setDisconnecting(null);
        }
      },
    });
  };

  const handleToggleAutoPost = async (account) => {
    try {
      await socialAPI.updateAccount(account.id, { autoPost: !account.auto_post });
      setSocialAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, auto_post: !a.auto_post } : a))
      );
      showToast('Updated');
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await customerAPI.updateProfile({
        businessName: profile.business_name,
        industry: profile.industry,
        location: profile.location,
        phone: profile.phone,
        website: profile.website,
        brandColors: profile.brand_colors,
        visualStyle: profile.visual_style,
        tone: profile.tone,
        preferredImageProvider: profile.preferred_image_provider,
        timezone,
        logoUrl: profile.logo_url ?? undefined,
        faviconUrl: profile.favicon_url ?? undefined,
      });
      showToast('Settings saved!');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <Layout title="Settings">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 16 }}>
          {loadError ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>Could not load settings</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>Check your connection and try refreshing the page.</div>
              <button onClick={() => { setLoadError(false); setLoading(true); loadData(); }} style={{ marginTop: 8, padding: '9px 20px', background: t.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Retry
              </button>
            </>
          ) : (
            <Spinner size={36} />
          )}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </Layout>
    );
  }

  const urlChanged = scrapedData && scraperUrl.trim() &&
    (scraperUrl.startsWith('http') ? scraperUrl.trim() : 'https://' + scraperUrl.trim()) !== scrapedData.website;

  // platformConfig removed — setupModal replaced by socialWizardModal + IntegrationSetupWizard

  return (
    <Layout
      title="Settings"
      subtitle="Manage your profile and preferences"
      action={
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          <IpSave size={14} /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      }
    >
      {/* Toast */}
      {toast.show && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: toast.type === 'success' ? t.success : t.error,
          boxShadow: t.shadow,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Business Info */}
        <Card>
          <SectionHeader icon={IpBusiness} title="Business Information" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {[
              { label: 'Business Name', key: 'business_name', type: 'text' },
              { label: 'Industry', key: 'industry', type: 'text' },
              { label: 'Location', key: 'location', type: 'text' },
              { label: 'Phone', key: 'phone', type: 'tel' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>{label}</label>
                <Input type={type} value={profile[key] || ''} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>Website</label>
              <Input type="url" placeholder="https://" value={profile.website || ''} onChange={(e) => setProfile({ ...profile, website: e.target.value })} />
            </div>
          </div>

          {/* Brand Assets */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.border}` }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Brand Assets</label>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {/* Logo */}
              <div>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>Business Logo</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 72, height: 72, borderRadius: 12, border: `1px solid ${t.border}`, background: t.input, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {profile.logo_url
                      ? <img src={profile.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 11, color: t.textMuted }}>No logo</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={(e) => e.target.files[0] && handleAssetUpload(e.target.files[0], 'logo_url')} />
                    <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                      style={{ padding: '7px 14px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, color: t.primary, fontSize: 12, fontWeight: 600, cursor: logoUploading ? 'not-allowed' : 'pointer', opacity: logoUploading ? 0.6 : 1 }}>
                      {logoUploading ? 'Uploading…' : 'Upload logo'}
                    </button>
                    {profile.logo_url && (
                      <button onClick={async () => {
                        setProfile(p => ({ ...p, logo_url: '' }));
                        try { await customerAPI.updateProfile({ logoUrl: '' }); showToast('Logo removed'); }
                        catch { showToast('Failed to remove logo', 'error'); }
                      }}
                        style={{ padding: '5px 14px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.error || '#ef4444', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>Used in emails and reports</div>
              </div>

              {/* Favicon / Brand Icon */}
              <div>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>Brand Icon <span style={{ fontSize: 11, color: t.primary }}>(workspace switcher)</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {profile.favicon_url
                      ? <img src={profile.favicon_url} alt="Brand icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 11, color: t.textMuted }}>Icon</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input ref={faviconInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={(e) => e.target.files[0] && handleAssetUpload(e.target.files[0], 'favicon_url')} />
                    <button onClick={() => faviconInputRef.current?.click()} disabled={faviconUploading}
                      style={{ padding: '7px 14px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, color: t.primary, fontSize: 12, fontWeight: 600, cursor: faviconUploading ? 'not-allowed' : 'pointer', opacity: faviconUploading ? 0.6 : 1 }}>
                      {faviconUploading ? 'Uploading…' : 'Upload icon'}
                    </button>
                    {profile.favicon_url && (
                      <button onClick={async () => {
                        setProfile(p => ({ ...p, favicon_url: '' }));
                        try { await customerAPI.updateProfile({ faviconUrl: '' }); showToast('Brand icon removed'); }
                        catch { showToast('Failed to remove brand icon', 'error'); }
                      }}
                        style={{ padding: '5px 14px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.error || '#ef4444', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>Square image, at least 64×64px</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Website Intelligence */}
        <Card>
          <SectionHeader icon={IpGlobe} title="Website Intelligence" action={<Badge variant="success">FREE</Badge>} />
          <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, marginTop: -12 }}>
            Scrape your website to extract services and improve content accuracy.
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: urlChanged ? 8 : 16, flexWrap: 'wrap' }}>
            <Input
              type="url"
              placeholder="https://yourbusiness.com"
              value={scraperUrl}
              onChange={(e) => setScraperUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              disabled={scraping}
              style={{ flex: '1 1 280px' }}
            />
            <Button onClick={handleScrape} disabled={scraping || !scraperUrl.trim()} variant="secondary">
              {scraping ? 'Working...' : urlChanged ? 'Update site' : scrapedData ? 'Refresh data' : 'Scan site'}
            </Button>
          </div>
          {urlChanged && (
            <div style={{ padding: '8px 12px', background: `${t.warning}15`, border: `1px solid ${t.warning}33`, borderRadius: 8, fontSize: 12, color: t.warning, marginBottom: 12 }}>
              New site detected — scan it to update your saved information.
            </div>
          )}
          {scrapedData && (
            <div style={{ background: `${t.success}15`, border: `1px solid ${t.success}33`, borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.success, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IpCheck size={14} strokeWidth={2.5} /> {scrapedData.services?.length || 0} services extracted
                </span>
                <button onClick={handleClearScrape} style={{ fontSize: 12, color: t.error, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0 }}>
                  <IpDelete size={14} /> Clear
                </button>
              </div>
              {scrapedData.services?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {scrapedData.services.slice(0, 12).map((s, i) => (
                    <span key={i} style={{ padding: '3px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, fontSize: 12, color: t.textSecondary }}>{s}</span>
                  ))}
                </div>
              )}
              {scrapedData.about && (
                <p style={{ fontSize: 12, color: t.textMuted }}>{scrapedData.about.slice(0, 200)}...</p>
              )}
            </div>
          )}
        </Card>

        {/* Image Source */}
        <Card>
          <SectionHeader icon={IpSparkle} title="Image Source" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { id: 'nanobanana', name: 'Image One', desc: 'Fast, affordable image generation', speed: providers?.nanobanana?.speed || '3-8 seconds', cost: '~$0.039/image', note: 'Recommended — cheaper & faster', noteColor: t.success },
              { id: 'midjourney', name: 'Image Two', desc: 'Premium artistic output', speed: providers?.midjourney?.speed || '15-20 seconds', cost: '~$0.08/image', note: providers?.midjourney?.available ? 'Premium artistic quality' : 'Requires setup', noteColor: providers?.midjourney?.available ? t.primary : t.warning },
            ].map((p) => {
              const selected = profile.preferred_image_provider === p.id;
              return (
                <button key={p.id} onClick={() => setProfile({ ...profile, preferred_image_provider: p.id })}
                  style={{ padding: 16, border: `2px solid ${selected ? t.primary : t.border}`, background: selected ? t.primaryBg : t.input, borderRadius: 10, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{p.name}</span>
                    <Badge variant={providers?.[p.id]?.available ? 'success' : 'warning'}>
                      {providers?.[p.id]?.available ? 'Active' : 'Not configured'}
                    </Badge>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{p.desc}</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8 }}>{p.speed}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{p.cost}</div>
                  <div style={{ fontSize: 12, color: p.noteColor, marginTop: 4, fontWeight: 500 }}>{p.note}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Branding */}
        <Card>
          <SectionHeader icon={IpPalette} title="Branding" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {['primary', 'secondary', 'accent'].map((key) => {
                const defaultColors = { primary: t.primary, secondary: '#22C55E', accent: '#F97316' };
                const val = profile.brand_colors?.[key] || defaultColors[key];
                return (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 11, color: t.textMuted, marginBottom: 6, textTransform: 'capitalize' }}>{key}</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={val}
                        onChange={(e) => setProfile({ ...profile, brand_colors: { ...profile.brand_colors, [key]: e.target.value } })}
                        style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2, background: t.input }} />
                      <Input type="text" value={val}
                        onChange={(e) => setProfile({ ...profile, brand_colors: { ...profile.brand_colors, [key]: e.target.value } })}
                        style={{ fontFamily: 'monospace', fontSize: 12 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 10 }}>Visual Style</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {VISUAL_STYLES.map((style) => (
                  <button key={style.id} onClick={() => setProfile({ ...profile, visual_style: style.id })}
                    style={{ padding: '10px 12px', border: `2px solid ${profile.visual_style === style.id ? t.primary : t.border}`, background: profile.visual_style === style.id ? t.primaryBg : t.input, borderRadius: 8, textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{style.name}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{style.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 10 }}>Tone</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {TONES.map((tone) => (
                  <button key={tone.id} onClick={() => setProfile({ ...profile, tone: tone.id })}
                    style={{ padding: '10px 12px', border: `2px solid ${profile.tone === tone.id ? t.primary : t.border}`, background: profile.tone === tone.id ? t.primaryBg : t.input, borderRadius: 8, textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{tone.name}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Timezone & Scheduling */}
        <Card>
          <SectionHeader icon={IpSchedule} title="Timezone & Scheduling" />
          <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, marginTop: -12 }}>
            Scheduled posts are converted to UTC using your timezone. All times display in local time.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>Your Timezone</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  style={{
                    flex: '1 1 280px', padding: '10px 12px',
                    background: t.input, border: `1px solid ${t.border}`,
                    borderRadius: 8, color: t.text, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    setTimezone(detected || 'UTC');
                  }}
                  style={{
                    padding: '10px 14px', background: t.input,
                    border: `1px solid ${t.border}`, borderRadius: 8,
                    color: t.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Auto-detect
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: t.textMuted, padding: '8px 12px', background: t.input, borderRadius: 8, border: `1px solid ${t.border}` }}>
              Current selection: <strong style={{ color: t.text }}>{timezone}</strong>
              {' — '}local time: <strong style={{ color: t.text }}>
                {new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true, weekday: 'short' }).format(new Date())}
              </strong>
            </div>
          </div>
        </Card>

        {/* Connected Accounts */}
        <Card>
          <SectionHeader icon={IpShare} title="Connected Accounts" subtitle="Connect social media accounts to enable publishing" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
              const connected = socialAccounts.find((a) => a.platform === platform);
              const oauthAvailable = socialStatus?.[platform]?.oauthAvailable;
              return (
                <div key={platform} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '14px 16px', background: t.input, borderRadius: 10,
                  border: `1px solid ${connected ? config.color + '40' : t.border}`, flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${config.color}15`, border: `1px solid ${config.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <config.Icon size={20} style={{ color: config.color }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{config.label}</div>
                        {connected && connected.token_expires_at && (() => {
                          const daysLeft = Math.floor((new Date(connected.token_expires_at) - new Date()) / 86400000);
                          return daysLeft >= 0 && daysLeft <= 7
                            ? <Badge variant="warning">Expires in {daysLeft}d</Badge>
                            : null;
                        })()}
                      </div>
                      <div style={{ fontSize: 12, color: connected ? t.success : t.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {connected ? <><IpCheck size={12} style={{ color: t.success }} />{connected.account_name || 'Connected'}</> : config.description}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {connected ? (
                      <>
                        <button type="button" onClick={() => handleToggleAutoPost(connected)}
                          style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: connected.auto_post ? 'rgba(34,197,94,0.1)' : t.card, border: `1px solid ${connected.auto_post ? 'rgba(34,197,94,0.3)' : t.border}`, color: connected.auto_post ? t.success : t.textMuted, cursor: 'pointer' }}>
                          {connected.auto_post ? 'Auto On' : 'Auto Off'}
                        </button>
                        <Button variant="ghost" size="sm" onClick={() => handleConnect(platform)} style={{ fontSize: 12 }}>
                          Update Tokens
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDisconnect(platform)} disabled={disconnecting === platform} style={{ color: t.error, fontSize: 12 }}>
                          {disconnecting === platform ? 'Disconnecting...' : 'Disconnect'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => oauthAvailable ? handleOAuthConnect(platform) : undefined}
                            style={{
                              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                              cursor: oauthAvailable ? 'pointer' : 'not-allowed',
                              background: oauthAvailable ? config.color : t.card,
                              color: oauthAvailable ? '#fff' : t.textMuted,
                              border: `1px solid ${oauthAvailable ? config.color : t.border}`,
                              opacity: oauthAvailable ? 1 : 0.65,
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}
                          >
                            <config.Icon size={13} style={{ color: oauthAvailable ? '#fff' : t.textMuted }} />
                            Connect
                          </button>
                          {!oauthAvailable && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#D97706', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 5, padding: '2px 6px', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                              SOON
                            </span>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleConnect(platform)} style={{ fontSize: 12, color: t.textMuted }}>
                          Enter Tokens
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Inbox Sync */}
        <Card>
          <SectionHeader icon={IpShare} title="Inbox Sync" subtitle="Sync incoming messages from social platforms into your Inbox" />
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14 }}>
            DM sync uses your connected social accounts above — no additional setup needed. Facebook and Instagram messages sync automatically.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { platform: 'facebook', label: 'Facebook Messenger', Icon: IpFacebook, color: '#1877F2' },
              { platform: 'instagram', label: 'Instagram DMs', Icon: IpInstagram, color: '#E1306C' },
            ].map(({ platform, label, Icon, color }) => {
              const isConnected = socialAccounts.find(a => a.platform === platform);
              return (
                <div key={platform} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', background: t.input, borderRadius: 10, border: `1px solid ${t.border}`, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{label}</div>
                      <div style={{ fontSize: 11, color: isConnected ? t.success : t.textMuted }}>
                        {isConnected ? 'Account connected — syncing enabled' : 'Connect account above to enable sync'}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>
                    {dmsStats ? `${dmsStats[platform + '_count'] || 0} messages` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button variant="secondary" size="sm" onClick={handleSyncNow} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            <span style={{ fontSize: 11, color: t.textMuted }}>Pull latest messages from all connected platforms</span>
          </div>
        </Card>

        {/* Developer API Keys */}
        {(() => {
          const SCOPE_DEFS = [
            { group: 'Content', scopes: [
              { value: 'posts:read',  label: 'View posts & schedule', desc: 'Read your posts, drafts, and scheduled content' },
              { value: 'posts:write', label: 'Create & schedule posts', desc: 'Create posts and update existing ones (includes read)' },
            ]},
            { group: 'AI Generation', scopes: [
              { value: 'generate:write', label: 'Generate AI content', desc: 'Generate captions using AI — uses 1 credit per call' },
            ]},
            { group: 'Analytics', scopes: [
              { value: 'analytics:read', label: 'View analytics', desc: 'Read post performance and engagement stats' },
            ]},
            { group: 'Media', scopes: [
              { value: 'media:write', label: 'Upload media', desc: 'Upload photos and videos to your media library' },
            ]},
            { group: 'Contacts', scopes: [
              { value: 'contacts:read',  label: 'View contacts', desc: 'List and read your contacts' },
              { value: 'contacts:write', label: 'Add & update contacts', desc: 'Create and update contacts (includes read)' },
            ]},
            { group: 'Knowledge Base', scopes: [
              { value: 'knowledge:write', label: 'Update knowledge base', desc: 'Add and edit knowledge base entries' },
            ]},
          ];

          const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
          const timeAgo = (d) => {
            if (!d) return 'Never used';
            const s = Math.floor((Date.now() - new Date(d)) / 1000);
            if (s < 60) return 'Just now';
            if (s < 3600) return `${Math.floor(s / 60)}m ago`;
            if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
            return `${Math.floor(s / 86400)}d ago`;
          };

          const isTrialUser = profile?.plan === 'trial';

          return (
            <Card>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: t.primary }}>
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Developer API</span>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>
                    Connect Zapier, Jobber, your website, or any custom tool.
                    {isTrialUser && <span style={{ color: t.warning, marginLeft: 4 }}>Upgrade to a paid plan to create API keys.</span>}
                  </div>
                </div>
                {!isTrialUser && (
                  <Button variant="primary" size="sm" onClick={openCreateKeyModal} style={{ flexShrink: 0 }}>
                    + Create Key
                  </Button>
                )}
              </div>

              {loadingKeys ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: t.textMuted, fontSize: 13 }}>Loading...</div>
              ) : apiKeys.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: t.textMuted, fontSize: 13 }}>
                  {isTrialUser
                    ? 'API keys are available on Starter, Professional, and Premium plans.'
                    : 'No API keys yet. Create one to start connecting external tools.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {apiKeys.map(key => (
                    <div key={key.id} style={{ padding: '12px 14px', background: t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 3 }}>{key.name}</div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: t.textMuted, marginBottom: 5 }}>
                            {key.key_prefix}...
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                            {(key.scopes || []).map(s => (
                              <span key={s} style={{ fontSize: 10, padding: '2px 7px', background: `${t.primary}15`, color: t.primary, borderRadius: 4, fontWeight: 500 }}>{s}</span>
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>
                            Created {formatDate(key.created_at)}
                            {' · '}
                            {timeAgo(key.last_used_at)}
                            {key.expires_at && <span> · Expires {formatDate(key.expires_at)}</span>}
                            {!key.expires_at && <span> · No expiry</span>}
                          </div>
                        </div>
                        <div>
                          {revokeConfirmId === key.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: t.warning }}>Revoke?</span>
                              <button
                                onClick={() => handleRevokeKey(key.id)}
                                disabled={revokingKeyId === key.id}
                                style={{ fontSize: 11, padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                              >
                                {revokingKeyId === key.id ? '...' : 'Yes, revoke'}
                              </button>
                              <button
                                onClick={() => setRevokeConfirmId(null)}
                                style={{ fontSize: 11, padding: '4px 10px', background: t.border, color: t.text, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRevokeConfirmId(key.id)}
                              style={{ fontSize: 12, padding: '6px 12px', background: 'transparent', color: '#ef4444', border: `1px solid #ef444440`, borderRadius: 7, cursor: 'pointer' }}
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 14, fontSize: 11, color: t.textMuted }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }}>
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Use <code style={{ background: t.input, padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>Authorization: Bearer itspost_...</code> in your requests.
                API base URL: <code style={{ background: t.input, padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>/api/v1/</code>
              </div>

              {/* Create Key Modal */}
              {showCreateKeyModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                  <div style={{ background: t.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                    {createKeyStep === 1 && (
                      <>
                        <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6 }}>Create API Key — Name & Expiry</div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 20 }}>Give your key a clear name so you remember what it's for.</div>
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6 }}>Key name</label>
                          <Input
                            value={newKeyForm.name}
                            onChange={e => setNewKeyForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Jobber Integration, My Website"
                            autoFocus
                          />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 8 }}>Expires after</label>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[
                              { val: '30d', label: '30 days' },
                              { val: '90d', label: '90 days' },
                              { val: '1y',  label: '1 year' },
                              { val: 'never', label: 'Never' },
                            ].map(opt => (
                              <button
                                key={opt.val}
                                onClick={() => setNewKeyForm(f => ({ ...f, expiry: opt.val }))}
                                style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${newKeyForm.expiry === opt.val ? t.primary : t.border}`, background: newKeyForm.expiry === opt.val ? `${t.primary}18` : t.input, color: newKeyForm.expiry === opt.val ? t.primary : t.text, fontSize: 13, cursor: 'pointer', fontWeight: newKeyForm.expiry === opt.val ? 600 : 400 }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {createKeyError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{createKeyError}</div>}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                          <Button variant="secondary" size="sm" onClick={() => setShowCreateKeyModal(false)}>Cancel</Button>
                          <Button variant="primary" size="sm" disabled={!newKeyForm.name.trim()} onClick={() => { setCreateKeyError(''); setCreateKeyStep(2); }}>Next: Permissions →</Button>
                        </div>
                      </>
                    )}

                    {createKeyStep === 2 && (
                      <>
                        <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6 }}>Choose Permissions</div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 18 }}>Only grant what your integration actually needs.</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 340, overflowY: 'auto', marginBottom: 18 }}>
                          {SCOPE_DEFS.map(group => (
                            <div key={group.group}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{group.group}</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {group.scopes.map(scope => {
                                  const checked = newKeyForm.scopes.includes(scope.value);
                                  return (
                                    <label key={scope.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${checked ? t.primary : t.border}`, background: checked ? `${t.primary}0d` : t.input, cursor: 'pointer' }}>
                                      <input type="checkbox" checked={checked} onChange={() => toggleScope(scope.value)} style={{ marginTop: 2, accentColor: t.primary, flexShrink: 0 }} />
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{scope.label}</div>
                                        <div style={{ fontSize: 11, color: t.textMuted }}>{scope.desc}</div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        {createKeyError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{createKeyError}</div>}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                          <Button variant="secondary" size="sm" onClick={() => setCreateKeyStep(1)}>← Back</Button>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={newKeyForm.scopes.length === 0 || createKeySaving}
                            onClick={handleCreateKey}
                          >
                            {createKeySaving ? 'Creating...' : 'Create Key'}
                          </Button>
                        </div>
                      </>
                    )}

                    {createKeyStep === 3 && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>API Key Created</div>
                        </div>
                        <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14, fontWeight: 500 }}>
                          Copy this key now — you won't be able to see it again.
                        </div>
                        <div style={{ position: 'relative', marginBottom: 18 }}>
                          <div style={{ padding: '12px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, fontFamily: 'monospace', fontSize: 12, color: t.text, wordBreak: 'break-all', paddingRight: 90 }}>
                            {createdRawKey}
                          </div>
                          <button
                            onClick={copyKey}
                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, padding: '5px 12px', background: keyCopied ? '#22c55e' : t.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}
                          >
                            {keyCopied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 18 }}>
                          Use it in your requests: <code style={{ background: t.input, padding: '2px 6px', borderRadius: 4 }}>Authorization: Bearer {createdRawKey?.substring(0, 20)}...</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Button variant="primary" size="sm" onClick={() => setShowCreateKeyModal(false)}>Done</Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })()}


      </div>

      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}


      {/* Social Platform Wizard */}
      {socialWizardModal && (() => {
        const config = PLATFORM_CONFIG[socialWizardModal];
        const wizardEntry = SOCIAL_WIZARD_MAP[socialWizardModal];
        if (!config || !wizardEntry) return null;
        const connected = socialAccounts.find(a => a.platform === socialWizardModal);
        const platform = socialWizardModal;
        return (
          <IntegrationSetupWizard
            wizardConfig={wizardEntry.wizard}
            formFields={wizardEntry.fields}
            initialValues={{}}
            onSave={async (vals) => {
              await socialAPI.connectManual(platform, {
                accessToken: vals.accessToken,
                pageId: vals.pageId || '',
                accountName: vals.accountName || '',
              });
              showToast(`${config.label} connected successfully!`);
              setSocialWizardModal(null);
              loadSocialAccounts();
            }}
            onTestConnection={async (vals) => {
              const res = await socialAPI.verifyToken(platform, vals.accessToken, vals.pageId || undefined);
              const d = res.data;
              return {
                data: {
                  success: d.valid,
                  detail: d.valid ? `Connected as "${d.accountName || d.accountId || 'account'}"` : undefined,
                  error: !d.valid ? (d.error || 'Token invalid or expired') : undefined,
                },
              };
            }}
            onClose={() => setSocialWizardModal(null)}
            isUpdate={!!connected}
            accentColor={config.color}
            logo={<config.Icon size={20} style={{ color: '#fff' }} />}
          />
        );
      })()}

      {false && null && (
        <div>
          <div>
            {integrationModal === '_removed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Account SID</label>
                  <input type="text" value={integrationForm.twilioAccountSid || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, twilioAccountSid: e.target.value }))}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Auth Token</label>
                  <input type="password" value={integrationForm.twilioAuthToken || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, twilioAuthToken: e.target.value }))}
                    placeholder="Leave blank to keep existing"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>SMS Phone Number</label>
                  <input type="text" value={integrationForm.twilioPhoneNumber || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, twilioPhoneNumber: e.target.value }))}
                    placeholder="+15551234567"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 4 }}>
                    WhatsApp Number <span style={{ fontSize: 11, fontWeight: 400, color: t.textMuted }}>(optional)</span>
                  </label>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>Include the whatsapp: prefix, e.g. whatsapp:+15551234567</div>
                  <input type="text" value={integrationForm.twilioWhatsappNumber || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, twilioWhatsappNumber: e.target.value }))}
                    placeholder="whatsapp:+15551234567"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Cal.com form */}
            {integrationModal === 'calcom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>API Key</label>
                  <input type="password" value={integrationForm.calcomApiKey || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, calcomApiKey: e.target.value }))}
                    placeholder="Leave blank to keep existing"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Booking Link</label>
                  <input type="url" value={integrationForm.bookingLink || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, bookingLink: e.target.value }))}
                    placeholder="https://cal.com/yourbusiness"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Mailgun form */}
            {integrationModal === 'mailgun' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>API Key</label>
                  <input type="password" value={integrationForm.mailgunApiKey || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, mailgunApiKey: e.target.value }))}
                    placeholder="Leave blank to keep existing"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Domain</label>
                  <input type="text" value={integrationForm.mailgunDomain || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, mailgunDomain: e.target.value }))}
                    placeholder="mail.yourbusiness.com"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>From Email</label>
                  <input type="email" value={integrationForm.mailgunFromEmail || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, mailgunFromEmail: e.target.value }))}
                    placeholder="hello@mail.yourbusiness.com"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Inbound Webhook URL</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="text" readOnly value="https://api.itsposting.com/api/mailgun/inbound"
                      style={{ flex: 1, padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                    <button onClick={() => { navigator.clipboard.writeText('https://api.itsposting.com/api/mailgun/inbound'); }}
                      style={{ padding: '10px 14px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Copy
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
                    Point your Mailgun inbound route to the webhook URL above. In Mailgun → Receiving → Routes, create a rule to forward to this URL.
                  </div>
                </div>
              </div>
            )}

            {/* Meta WhatsApp Business API form */}
            {integrationModal === 'meta_whatsapp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: '10px 14px', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 8, fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
                  Get these credentials from <strong>Meta Business Suite → WhatsApp → API Setup</strong>. Create a System User with a permanent access token for production use.
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Phone Number ID</label>
                  <input type="text" value={integrationForm.metaWaPhoneNumberId || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, metaWaPhoneNumberId: e.target.value }))}
                    placeholder="1234567890123456"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Found in WhatsApp → API Setup → Phone number ID</div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Permanent Access Token</label>
                  <input type="password" value={integrationForm.metaWaAccessToken || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, metaWaAccessToken: e.target.value }))}
                    placeholder="Leave blank to keep existing"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Generate via Meta Business Suite → System Users → Generate Token</div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 4 }}>
                    Business Account ID <span style={{ fontSize: 11, fontWeight: 400, color: t.textMuted }}>(optional)</span>
                  </label>
                  <input type="text" value={integrationForm.metaWaBusinessId || ''} onChange={(e) => setIntegrationForm(f => ({ ...f, metaWaBusinessId: e.target.value }))}
                    placeholder="Your WhatsApp Business Account ID"
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setIntegrationModal(null)}
                style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveIntegration} disabled={integrationSaving}
                style={{ padding: '9px 20px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: integrationSaving ? 0.6 : 1 }}>
                {integrationSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Token Modal — replaced by socialWizardModal + IntegrationSetupWizard */}
      {false && null && (
        <div onClick={() => { setSetupModal(null); setTokenVerified(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, padding: 0, maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

            {/* Colored header band */}
            <div style={{ padding: '22px 28px 18px', borderBottom: `1px solid ${t.border}`, background: `${platformConfig.color}10` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: `${platformConfig.color}20`, border: `1.5px solid ${platformConfig.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <platformConfig.Icon size={20} style={{ color: platformConfig.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Connect {platformConfig.label}</div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 1 }}>Follow the steps below — takes about 2 minutes</div>
                  </div>
                </div>
                <button onClick={() => { setSetupModal(null); setTokenVerified(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4 }}>
                  <IpClose size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Warning badge for platforms requiring approval */}
              {platformConfig.tokenHelp.badge && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', fontSize: 12, fontWeight: 600, color: '#d97706' }}>
                  <IpWarning size={13} style={{ color: '#d97706' }} />
                  {platformConfig.tokenHelp.badge}
                </div>
              )}

              {/* Step-by-step instructions */}
              <div style={{ background: t.input, borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, fontSize: 12, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {platformConfig.tokenHelp.title}
                </div>
                <div style={{ padding: '4px 0' }}>
                  {platformConfig.tokenHelp.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: i < platformConfig.tokenHelp.steps.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${platformConfig.color}20`, border: `1px solid ${platformConfig.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color: platformConfig.color }}>
                        {i + 1}
                      </div>
                      <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6, paddingTop: 2 }}>
                        {step.text}
                        {step.link && (
                          <a href={step.link.url} target="_blank" rel="noreferrer" style={{ color: platformConfig.color, fontWeight: 600, textDecoration: 'none', marginLeft: 2 }}>
                            {step.link.label} ↗
                          </a>
                        )}
                        {step.suffix && <span>{step.suffix}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Token input + Test button */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Access Token <span style={{ color: t.error }}>*</span>
                </label>
                <textarea
                  value={manualToken}
                  onChange={(e) => { setManualToken(e.target.value); setTokenVerified(null); }}
                  placeholder="Paste your access token here..."
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${tokenVerified?.valid === false ? t.error : tokenVerified?.valid ? 'rgba(34,197,94,0.5)' : t.border}`, borderRadius: 8, color: t.text, fontSize: 12, fontFamily: 'monospace', resize: 'none', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms' }}
                />
                {/* Verify result banner */}
                {tokenVerified && (
                  <div style={{ marginTop: 8, padding: '9px 12px', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, background: tokenVerified.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${tokenVerified.valid ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, color: tokenVerified.valid ? t.success : t.error }}>
                    {tokenVerified.valid ? <IpCheck size={13} /> : <IpWarning size={13} />}
                    {tokenVerified.valid
                      ? `Token valid — connected as "${tokenVerified.accountName}"`
                      : `Token failed: ${tokenVerified.error}`}
                  </div>
                )}
                <button
                  onClick={handleVerifyToken}
                  disabled={tokenVerifying || manualToken.trim().length < 10}
                  style={{ marginTop: 8, padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: manualToken.trim().length < 10 ? 'not-allowed' : 'pointer', opacity: manualToken.trim().length < 10 ? 0.4 : 1 }}>
                  {tokenVerifying ? 'Testing...' : '🔍 Test connection'}
                </button>
              </div>

              {/* Page ID */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {platformConfig.tokenHelp.pageIdLabel}
                  {' '}<span style={{ color: t.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>(optional — auto-filled on test)</span>
                </label>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>{platformConfig.tokenHelp.pageIdHelp}</div>
                <input type="text" value={manualPageId} onChange={(e) => setManualPageId(e.target.value)} placeholder="e.g. 123456789"
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Account Name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Display Name <span style={{ color: t.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>(auto-filled on test)</span>
                </label>
                <input type="text" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g. Mike's Plumbing"
                  style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

            </div>

            {/* Footer actions */}
            <div style={{ padding: '16px 28px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end', background: t.input }}>
              <button onClick={() => { setSetupModal(null); setTokenVerified(null); }}
                style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleManualSave}
                disabled={manualSaving || !manualToken.trim() || manualToken.trim().length < 10}
                style={{ padding: '10px 22px', background: platformConfig.color, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: manualSaving || manualToken.trim().length < 10 ? 'not-allowed' : 'pointer', opacity: manualSaving || manualToken.trim().length < 10 ? 0.5 : 1 }}>
                {manualSaving ? 'Connecting...' : `Save & Connect ${platformConfig.label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }