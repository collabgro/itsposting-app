import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  IpSave, IpCredits, IpPalette, IpGlobe, IpDelete, IpClose, IpWarning,
  IpBusiness, IpShare, IpCheck, IpFacebook, IpInstagram,
  IpGoogle, IpSparkle, IpSchedule, IpLinkedIn, IpTikTok, IpBell,
  IpPlus, IpEdit,
} from '../components/icons';
import Layout from '../components/Layout';
import { Button, Input, Badge, SectionHeader, Spinner, ConfirmModal } from '../components/ui';
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
  { value: 'America/Sao_Paulo',   label: 'BrasÃ­lia (BRT)',        offset: 'UTC-3'     },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', offset: 'UTC-3'  },
  { value: 'America/Santiago',    label: 'Santiago',              offset: 'UTC-4/3'   },
  { value: 'America/Bogota',      label: 'BogotÃ¡',                offset: 'UTC-5'     },
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
        { text: 'Go to ', link: { url: 'https://developers.facebook.com/apps/creation/', label: 'Facebook Developers' }, suffix: ' â†’ Create App â†’ Business type (required first step)' },
        { text: 'In your app, click Add Product â†’ Facebook Login â†’ Set Up' },
        { text: 'Go to ', link: { url: 'https://developers.facebook.com/tools/explorer/', label: 'Graph API Explorer' }, suffix: ' â†’ select your App â†’ Page Access Token' },
        { text: 'Add permissions: pages_manage_posts, pages_read_engagement, pages_messaging â†’ Generate' },
        { text: 'Copy the Page Access Token and paste below' },
        { text: 'Note: pages_manage_posts and pages_messaging (required for Inbox DMs) require Facebook App Review for non-developer accounts' },
      ],
      pageIdLabel: 'Page ID',
      pageIdHelp: 'Found in your Facebook Page settings â†’ About â†’ Page ID',
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
        { text: 'Select your App â†’ click "Generate Access Token"' },
        { text: 'Enable instagram_basic, instagram_content_publish, and instagram_manage_messages permissions (instagram_manage_messages required for Inbox DMs)' },
        { text: 'Copy the Access Token and paste below' },
      ],
      pageIdLabel: 'Instagram Business Account ID',
      pageIdHelp: 'Found in Instagram Settings â†’ Account â†’ Professional Account',
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
    description: 'Company page posting — requires LinkedIn partner approval',
    tokenHelp: {
      title: 'LinkedIn requires Partner Program access (2â€“8 weeks)',
      badge: 'â± Partnership approval required â€” not instant',
      steps: [
        { text: 'âš ï¸ LinkedIn does NOT offer public API access. You must apply to the LinkedIn Partner Program first.' },
        { text: 'Apply at ', link: { url: 'https://developer.linkedin.com/partner-programs', label: 'LinkedIn Partner Programs' }, suffix: ' â€” select the Social Sharing tier' },
        { text: 'Create an app at ', link: { url: 'https://www.linkedin.com/developers/apps/new', label: 'LinkedIn Developers' }, suffix: ' â€” requires a Company LinkedIn Page' },
        { text: 'In your app â†’ Products â†’ request "Share on LinkedIn" (posting) and "Messaging on LinkedIn" (for Inbox DMs) â€” submit justification for your scheduling use case' },
        { text: 'Once approved (2â€“8 weeks), generate an access token under the Auth tab' },
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
      title: 'TikTok Content Posting API (2â€“6 week review)',
      badge: 'â± App review required â€” posts are private until approved',
      steps: [
        { text: 'Register a TikTok developer account at ', link: { url: 'https://developers.tiktok.com/', label: 'developers.tiktok.com' } },
        { text: 'Create an app at ', link: { url: 'https://developers.tiktok.com/apps/', label: 'Manage Apps' }, suffix: ' â†’ Create App' },
        { text: 'Under Scopes, request "Content Posting API" â€” describe your scheduling/management use case clearly' },
        { text: 'TikTok review takes 2â€“6 weeks. Until approved + audited, all posts will be private-only.' },
        { text: 'Once approved, generate a user access token with video.publish scope' },
        { text: 'Paste the access token and your TikTok Open ID below' },
      ],
      pageIdLabel: 'TikTok Open ID (your account ID)',
      pageIdHelp: 'Found in TikTok for Business â†’ Account Settings â†’ Open ID',
    },
  },
};

// â”€â”€â”€ Social Platform Wizard Configs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const FACEBOOK_SOCIAL_WIZARD = {
  title: 'Facebook',
  slides: [
    {
      heading: 'Step 1 â€” Create a Facebook Developer App',
      subtext: '1. Click "Open Facebook Developers" below and sign in with your Facebook account\n2. Click "Create App" in the top-right corner\n3. Choose "Business" as the app type â†’ click Next\n4. Give your app any name (e.g. "My Business Posting") â†’ click "Create App"\n\nYou only need to do this once â€” the same app is used for both Facebook and Instagram.',
      callout: { platformName: 'Facebook Developers', highlight: 'Create App â†’ Business â†’ Next', color: '#1877F2', note: 'Any name works â€” e.g. "My Business Posting"' },
      linkButton: { label: 'Open Facebook Developers â†—', url: 'https://developers.facebook.com/apps/creation/' },
    },
    {
      heading: 'Step 2 â€” Add Facebook Login to your app',
      subtext: '1. In your new app dashboard, scroll down to "Add Products to Your App"\n2. Find "Facebook Login" â†’ click "Set Up"\n3. Select "Web" as the platform\n4. You can skip the Quick Start guide â€” just close or skip it\n\nThis step unlocks the permission scopes you need in the next step.',
      callout: { platformName: 'App Dashboard', highlight: 'Add Products â†’ Facebook Login â†’ Set Up', color: '#1877F2', note: 'Select "Web" then skip the Quick Start' },
      linkButton: { label: 'Open your apps â†—', url: 'https://developers.facebook.com/apps/' },
    },
    {
      heading: 'Step 3 â€” Generate your Page Access Token',
      subtext: '1. Click "Open Graph API Explorer" below and sign in\n2. Top-left: click the "Meta App" dropdown â†’ select your app\n3. Click "User or Page" dropdown â†’ change to "Page Access Token"\n4. A list of your pages appears â€” select your business page\n5. Click "+ Add a Permission" and add ALL of these one by one:\n   â€¢ pages_show_list\n   â€¢ pages_manage_posts\n   â€¢ pages_read_engagement\n   â€¢ pages_read_user_content\n   â€¢ pages_messaging\n   â€¢ read_insights\n6. Click "Generate Access Token" â†’ approve the popup\n7. Copy the long token that appears at the top',
      callout: { platformName: 'Graph API Explorer', highlight: 'Page Access Token â†’ select your page â†’ add 6 permissions â†’ Generate', color: '#1877F2', note: 'Must add all 6 permissions before generating' },
      linkButton: { label: 'Open Graph API Explorer â†—', url: 'https://developers.facebook.com/tools/explorer/' },
    },
    {
      heading: 'Step 4 â€” Paste your token and connect',
      subtext: 'Paste the token you copied. Click "Test connection" â€” we\'ll verify it works and auto-fill your Page ID.',
      isCredentialSlide: true,
      warningNote: 'Graph API Explorer tokens expire in 60 days. For a permanent connection, generate a System User token via Business Manager â†’ System Users, or reconnect using the "Connect" button once OAuth is live.',
    },
  ],
};
const FACEBOOK_SOCIAL_FIELDS = [
  { key: 'accessToken', label: 'Page Access Token', type: 'password', placeholder: 'EAAxxxxxxxx...', required: true, helpText: 'Generated via Graph API Explorer â†’ Page Access Token' },
  { key: 'pageId', label: 'Page ID', type: 'text', placeholder: '123456789012345', hint: 'optional â€” auto-filled on test', helpText: 'Facebook Page â†’ About â†’ Page Transparency â†’ Page ID' },
  { key: 'accountName', label: 'Display Name', type: 'text', placeholder: "Mike's Plumbing", hint: 'optional â€” auto-filled on test' },
];

const INSTAGRAM_SOCIAL_WIZARD = {
  title: 'Instagram',
  slides: [
    {
      heading: 'Step 1 â€” Set up a Professional account',
      subtext: 'Instagram posting via API requires a Business or Creator account linked to a Facebook Page.\n\nâ†’ Already a Business account linked to a Facebook Page? Skip to Step 2.\n\n1. Open Instagram on your phone\n2. Go to Settings â†’ Account â†’ "Switch to Professional Account"\n3. Choose "Business"\n4. Connect it to your Facebook Business Page when prompted\n\nThis is a one-time setup on Instagram â€” takes under 2 minutes.',
      callout: { platformName: 'Instagram', highlight: 'Settings â†’ Account â†’ Switch to Professional Account', color: '#E1306C', note: 'Choose "Business" then connect your Facebook Page' },
      linkButton: { label: 'Switch to Professional â†—', url: 'https://www.instagram.com/accounts/convert_to_ia/' },
    },
    {
      heading: 'Step 2 â€” Generate your access token',
      subtext: '1. Click "Open Graph API Explorer" below and sign in\n2. Click the "Meta App" dropdown â†’ select your Facebook Developer App\n   (Need an app? Connect Facebook first â€” it walks you through creating one)\n3. Click "+ Add a Permission" and add ALL 5 below:\n   â€¢ instagram_basic\n   â€¢ instagram_content_publish\n   â€¢ instagram_manage_messages\n   â€¢ instagram_manage_insights\n   â€¢ pages_read_engagement\n4. Click "Generate Access Token" â†’ approve the popup\n5. Copy the long token that appears at the top\n\nYour Instagram Business Account ID will auto-fill when you test.',
      callout: { platformName: 'Graph API Explorer', highlight: 'Add 5 permissions â†’ Generate Access Token â†’ copy it', color: '#E1306C', note: 'Must add all 5 permissions before generating' },
      linkButton: { label: 'Open Graph API Explorer â†—', url: 'https://developers.facebook.com/tools/explorer/' },
    },
    {
      heading: 'Step 3 â€” Paste your token and connect',
      subtext: 'Paste the token you copied. Click "Test connection" â€” we\'ll verify it and auto-fill your Instagram Account ID.',
      isCredentialSlide: true,
    },
  ],
};
const INSTAGRAM_SOCIAL_FIELDS = [
  { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'EAAxxxxxxxx...', required: true, helpText: 'From Graph API Explorer with instagram_basic + instagram_content_publish + instagram_manage_messages + instagram_manage_insights + pages_read_engagement' },
  { key: 'pageId', label: 'Instagram Business Account ID', type: 'text', placeholder: '17841400000000001', hint: 'optional â€” auto-filled on test', helpText: 'Auto-filled when you click Test connection' },
  { key: 'accountName', label: 'Display Name', type: 'text', placeholder: '@mikes.plumbing', hint: 'optional â€” auto-filled on test' },
];

const GOOGLE_SOCIAL_WIZARD = {
  title: 'Google Business Profile',
  slides: [
    {
      heading: 'Step 1 â€” Enable the Business Profile API',
      subtext: '1. Click "Open API Library" below â€” sign in with the Google account that manages your business\n2. If prompted to create a project, click "Create Project" â†’ give it any name â†’ click "Create"\n3. In the search bar, type "Business Profile API" â†’ click the result\n4. Click "Enable"\n\nThis one-time step activates Google\'s posting API for your account.',
      callout: { platformName: 'Google Cloud Console', highlight: 'API Library â†’ Business Profile API â†’ Enable', color: '#4285F4', note: 'Use the Google account that manages your business' },
      linkButton: { label: 'Open API Library â†—', url: 'https://console.cloud.google.com/apis/library/' },
    },
    {
      heading: 'Step 2 â€” Get your access token',
      subtext: '1. Click "Open OAuth Playground" below\n2. In the left panel under "Input your own scopes", paste this exactly:\n   https://www.googleapis.com/auth/business.manage\n3. Click "Authorize APIs" â†’ sign in with your Google account â†’ click "Allow"\n4. Click "Exchange authorization code for tokens"\n5. Copy the "Access token" value (starts with ya29...)\n\nImportant: copy the Access Token â€” NOT the Refresh Token.',
      callout: { platformName: 'OAuth Playground', highlight: 'Paste scope â†’ Authorize APIs â†’ Exchange â†’ copy Access Token', color: '#4285F4', note: 'Copy Access Token, NOT the Refresh Token' },
      linkButton: { label: 'Open OAuth Playground â†—', url: 'https://developers.google.com/oauthplayground' },
    },
    {
      heading: 'Step 3 â€” Find your Business Account ID',
      subtext: '1. Click "Open Business Profile" below\n2. Look at your browser URL bar â€” you\'ll see a number like:\n   business.google.com/u/0/id/1234567890\n   That number is your Account ID\n\nAlternatively: in Business Profile â†’ go to Settings â†’ Advanced settings â†’ Account ID',
      callout: { platformName: 'Google Business Profile', highlight: 'business.google.com â†’ the number in the URL', color: '#4285F4', note: 'Or Settings â†’ Advanced settings â†’ Account ID' },
      linkButton: { label: 'Open Business Profile â†—', url: 'https://business.google.com/' },
    },
    {
      heading: 'Step 4 â€” Paste your token and connect',
      subtext: 'Paste the access token and your Account ID below. Click "Test connection" to verify.',
      isCredentialSlide: true,
      warningNote: 'OAuth Playground tokens expire in 1 hour. For a permanent connection, use the "Connect" button once OAuth is live â€” it handles token refresh automatically.',
    },
  ],
};
const GOOGLE_SOCIAL_FIELDS = [
  { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'ya29.xxxxxxxxxx...', required: true, helpText: 'From Google OAuth Playground â€” expires in 1 hour' },
  { key: 'pageId', label: 'Business Account ID', type: 'text', placeholder: '1234567890', hint: 'optional â€” auto-filled on test', helpText: 'Found in Google Business Profile URL or Advanced settings' },
  { key: 'accountName', label: 'Display Name', type: 'text', placeholder: "Mike's Plumbing", hint: 'optional â€” auto-filled on test' },
];

const LINKEDIN_SOCIAL_WIZARD = {
  title: 'LinkedIn',
  slides: [
    {
      heading: 'Step 1 â€” Create your LinkedIn Developer App',
      badge: 'â± Product approval takes 2-8 weeks',
      subtext: 'LinkedIn requires apps to be approved before they can post to company pages.\n\n1. Click "Open LinkedIn Developers" below\n2. Click "Create App"\n3. Enter your app name and paste your Company LinkedIn Page URL\n4. In your app â†’ go to the "Products" tab\n5. Click "Select" next to "Community Management API" â†’ describe your use case:\n   "We schedule and publish posts for a local business to our company LinkedIn Page"\n6. Also click "Select" next to "Messaging on LinkedIn" (for Inbox DMs)\n7. Submit â€” you\'ll get an email when approved\n\nWhile you wait, your app is created. You can generate a token in Step 2 after approval.',
      callout: { platformName: 'LinkedIn Developer App', highlight: 'Products â†’ Community Management API â†’ Select â†’ Submit', color: '#0A66C2', note: 'Describe your posting use case clearly â€” vague descriptions are rejected' },
      linkButton: { label: 'Open LinkedIn Developers â†—', url: 'https://www.linkedin.com/developers/apps/new' },
    },
    {
      heading: 'Step 2 â€” Request Community Management API access',
      subtext: 'The Community Management API is what enables posting to your company page.\n\n1. In your app â†’ "Products" tab â†’ find "Community Management API"\n2. Click "Select" and complete the request form\n3. Explain clearly: "Scheduling and publishing posts on behalf of a local service business"\n4. Submit and wait for LinkedIn\'s approval email (usually 1-4 weeks)\n\nOnce approved, the product shows as "Active" and you can generate a token in Step 3.',
      callout: { platformName: 'LinkedIn Developer App', highlight: 'Products â†’ Community Management API â†’ Active', color: '#0A66C2', note: 'Status changes to "Active" when approved' },
      linkButton: { label: 'Open LinkedIn Developers â†—', url: 'https://www.linkedin.com/developers/apps/' },
    },
    {
      heading: 'Step 3 â€” Generate your access token',
      subtext: '1. In your app, go to the "Auth" tab â†’ scroll to "OAuth 2.0 Tools"\n2. Under scopes, select all three:\n   â€¢ w_member_social (post as yourself)\n   â€¢ w_organization_social (post as your company page)\n   â€¢ r_organization_social (read company analytics)\n3. Click "Request access token" â†’ sign in â†’ authorize â†’ copy the token\n4. Find your Company URN: go to your LinkedIn Company Page, copy the number from the URL (after /company/) and format it as:\n   urn:li:organization:XXXXXXXX\n\nPaste both below.',
      isCredentialSlide: true,
      warningNote: 'LinkedIn tokens expire after 60 days â€” reconnect when prompted. Community Management API approval is required before this step will work.',
    },
  ],
};
const LINKEDIN_SOCIAL_FIELDS = [
  { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'AQV...', required: true, helpText: 'Generated via LinkedIn Developer App â†’ Auth â†’ OAuth 2.0 Tools (requires Partner Program approval)' },
  { key: 'pageId', label: 'Company URN', type: 'text', placeholder: 'urn:li:organization:12345678', helpText: 'Find the numeric ID in your LinkedIn Company Page URL after /company/' },
  { key: 'accountName', label: 'Display Name', type: 'text', placeholder: "Mike's Plumbing", hint: 'optional â€” auto-filled on test' },
];

const TIKTOK_SOCIAL_WIZARD = {
  title: 'TikTok',
  slides: [
    {
      heading: 'Step 1 â€” Register as a TikTok developer',
      badge: 'â± App review takes 2-6 weeks',
      subtext: '1. Click "Open TikTok Developers" below\n2. Sign in with your TikTok for Business account\n   (Don\'t have one? Create it free at business.tiktok.com â€” use the same email as your TikTok)\n3. Complete the developer registration form â€” takes about 5 minutes\n\nNote: until your app passes review, all posts will be private and only visible to you.',
      callout: { platformName: 'TikTok Developer Portal', highlight: 'Sign in â†’ Register Developer Account', color: '#ff0050', note: 'Use your TikTok for Business account' },
      linkButton: { label: 'Open TikTok Developers â†—', url: 'https://developers.tiktok.com/' },
    },
    {
      heading: 'Step 2 â€” Create your app and request scopes',
      subtext: '1. In the developer portal, click "Manage Apps" â†’ "Create App"\n2. Choose "Web" as the platform type\n3. In the Scopes section, request all three:\n   â€¢ Content Posting API (direct publishing)\n   â€¢ Video Upload (draft uploads)\n   â€¢ User Info Basic (account info)\n4. In your app description, write:\n   "We schedule and publish social media posts for a local business"\n5. Click "Submit for Review"\n\nClear, honest descriptions are approved faster â€” vague ones get rejected.',
      callout: { platformName: 'TikTok Developer Portal', highlight: 'Manage Apps â†’ Scopes â†’ request 3 scopes â†’ Submit', color: '#ff0050', note: 'Request all 3 scopes in one submission' },
      linkButton: { label: 'Open TikTok Apps â†—', url: 'https://developers.tiktok.com/apps/' },
    },
    {
      heading: 'Step 3 â€” Get your access token',
      subtext: '1. After approval, go to your app â†’ "Manage" â†’ "Tokens"\n2. Click "Generate access token"\n3. Select the posting scopes â€” look for: video.publish (required), video.upload, user.info.basic\n4. Click "Authorize" â†’ sign in with your TikTok account â†’ copy the access token\n5. Your Open ID will also appear on the same screen â€” copy it too\n\nPaste both below.',
      isCredentialSlide: true,
      warningNote: 'Until your TikTok app passes audit, all posts will be private-only. Once approved, posts publish publicly. Scope names may vary slightly â€” check your app\'s Scopes section for exact names.',
    },
  ],
};
const TIKTOK_SOCIAL_FIELDS = [
  { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'act.example...', required: true, helpText: 'Generated after app approval â€” must have video.publish scope' },
  { key: 'pageId', label: 'Open ID', type: 'text', placeholder: 'MS4wLjABAAAA...', hint: 'optional â€” auto-filled on test', helpText: 'Your TikTok account identifier â€” found in TikTok for Business â†’ Account Settings' },
  { key: 'accountName', label: 'Display Name', type: 'text', placeholder: '@mikes.plumbing', hint: 'optional â€” auto-filled on test' },
];

const SOCIAL_WIZARD_MAP = {
  facebook:        { wizard: FACEBOOK_SOCIAL_WIZARD,  fields: FACEBOOK_SOCIAL_FIELDS },
  instagram:       { wizard: INSTAGRAM_SOCIAL_WIZARD, fields: INSTAGRAM_SOCIAL_FIELDS },
  google_business: { wizard: GOOGLE_SOCIAL_WIZARD,    fields: GOOGLE_SOCIAL_FIELDS },
  linkedin:        { wizard: LINKEDIN_SOCIAL_WIZARD,  fields: LINKEDIN_SOCIAL_FIELDS },
  tiktok:          { wizard: TIKTOK_SOCIAL_WIZARD,    fields: TIKTOK_SOCIAL_FIELDS },
};

const DEFAULT_NOTIF_PREFS = {
  weekly_briefing: true,
  seasonal_reminders: true,
  low_credit_alerts: true,
  token_expiry_warnings: true,
  post_milestones: false,
  new_dm_notifications: true,
};

const NOTIF_GROUPS = [
  {
    label: 'PostCore Insights',
    items: [
      { key: 'weekly_briefing', title: 'Weekly PostCore briefing', desc: 'Monday morning summary — performance, opportunities, suggested posts' },
      { key: 'seasonal_reminders', title: 'Seasonal content reminders', desc: '"It\'s winter — frozen pipe season is here" before key months' },
    ],
  },
  {
    label: 'Account Alerts',
    items: [
      { key: 'low_credit_alerts', title: 'Low credit alerts', desc: 'Notify when you have fewer than 5 credits remaining' },
      { key: 'token_expiry_warnings', title: 'Token expiry warnings', desc: '7 days before a connected social account needs to be reconnected' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { key: 'post_milestones', title: 'Post milestone alerts', desc: 'When a post hits 50, 100, or 500 likes or comments' },
      { key: 'new_dm_notifications', title: 'New message alerts', desc: 'In-app notifications for DMs and inbox messages' },
    ],
  },
];

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

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState(DEFAULT_NOTIF_PREFS);

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

  // Account Groups
  const [accountGroups, setAccountGroups] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null); // null = new, object = editing
  const [groupForm, setGroupForm] = useState({ name: '', accountIds: [] });
  const [groupSaving, setGroupSaving] = useState(false);

  // Hashtag Sets
  const [hashtagSets, setHashtagSets] = useState([]);
  const [loadingHashtags, setLoadingHashtags] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetTags, setNewSetTags] = useState('');
  const [hashtagsSaving, setHashtagsSaving] = useState(false);
  const [editingHashtagSetId, setEditingHashtagSetId] = useState(null);
  const [editHashtagName, setEditHashtagName] = useState('');
  const [editHashtagTags, setEditHashtagTags] = useState('');

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
    const names = {
      facebook: 'Facebook',
      facebook_instagram: 'Facebook & Instagram',
      google: 'Google Business Profile',
      linkedin: 'LinkedIn',
      tiktok: 'TikTok',
    };
    const msgs = {
      facebook_denied: 'Connection was cancelled.',
      facebook_no_pages: 'No Facebook Pages found on this account. Make sure you\'re logged into the Facebook account that manages your business Page, then try again.',
      facebook_failed: 'Failed to connect Facebook. Please try again.',
      facebook_invalid: 'Facebook connection failed — invalid response.',
      facebook_state_invalid: 'Facebook connection failed — please try again.',
      google_denied: 'Connection was cancelled.',
      google_failed: 'Failed to connect Google. Please try again.',
      linkedin_denied: 'Connection was cancelled.',
      linkedin_failed: 'Failed to connect LinkedIn. Please try again.',
      tiktok_denied: 'Connection was cancelled.',
      tiktok_failed: 'Failed to connect TikTok. Please try again.',
    };

    function handleResult(connected, error) {
      if (connected) {
        showToast(`${names[connected] || connected} connected successfully!`);
        loadSocialAccounts();
      }
      if (error) {
        showToast(msgs[error] || `Connection error: ${error}`, 'error');
      }
    }

    // postMessage — same-origin popup fallback (kept for compatibility)
    const messageHandler = (e) => {
      if (e.data?.type !== 'oauth_callback') return;
      handleResult(e.data.connected, e.data.error);
    };

    // storage event — fires in parent window when popup writes oauth_result.
    // This works even after cross-origin redirect chains (unlike window.opener).
    const storageHandler = (e) => {
      if (e.key !== 'oauth_result') return;
      try {
        const { connected, error } = JSON.parse(e.newValue || '{}');
        handleResult(connected, error);
        localStorage.removeItem('oauth_result');
      } catch {}
    };

    window.addEventListener('message', messageHandler);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('message', messageHandler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  // Handle same-window OAuth redirect (fires when popup was blocked and user
  // was redirected back to /settings?connected=... in the main tab)
  useEffect(() => {
    if (!router.isReady) return;
    const { connected, error } = router.query;
    if (!connected && !error) return;
    const names = {
      facebook: 'Facebook',
      facebook_instagram: 'Facebook & Instagram',
      google: 'Google Business Profile',
      linkedin: 'LinkedIn',
      tiktok: 'TikTok',
    };
    const msgs = {
      facebook_denied: 'Connection was cancelled.',
      facebook_no_pages: 'No Facebook Pages found on this account. Make sure you\'re logged into the Facebook account that manages your business Page, then try again.',
      facebook_failed: 'Failed to connect Facebook. Please try again.',
      google_denied: 'Connection was cancelled.',
      google_failed: 'Failed to connect Google. Please try again.',
      linkedin_denied: 'Connection was cancelled.',
      linkedin_failed: 'Failed to connect LinkedIn. Please try again.',
      tiktok_denied: 'Connection was cancelled.',
      tiktok_failed: 'Failed to connect TikTok. Please try again.',
    };
    if (connected) {
      showToast(`${names[connected] || connected} connected successfully!`);
      loadSocialAccounts();
    }
    if (error) {
      showToast(msgs[error] || `Connection error: ${error}`, 'error');
    }
    router.replace('/settings', undefined, { shallow: true });
  }, [router.isReady]);

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
      if (profileRes.data.content_preferences?.notifications) {
        setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...profileRes.data.content_preferences.notifications });
      }
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
    loadHashtagSets();
  };

  const loadHashtagSets = async () => {
    setLoadingHashtags(true);
    try {
      const res = await customerAPI.getHashtagSets();
      setHashtagSets(res.data || []);
    } catch {
      // silently
    } finally {
      setLoadingHashtags(false);
    }
  };

  const parseTags = (raw) =>
    raw.split(/[\s,]+/).map(t => t.replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50)).filter(Boolean);

  const handleCreateHashtagSet = async () => {
    const name = newSetName.trim();
    if (!name) return;
    const tags = parseTags(newSetTags);
    if (!tags.length) return;
    const newSet = { id: String(Date.now()), name, tags, usage_count: 0 };
    const updated = [...hashtagSets, newSet];
    setHashtagsSaving(true);
    try {
      await customerAPI.updateHashtagSets(updated);
      setHashtagSets(updated);
      setNewSetName('');
      setNewSetTags('');
      showToast('Hashtag set saved');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setHashtagsSaving(false);
    }
  };

  const handleUpdateHashtagSet = async (id) => {
    const name = editHashtagName.trim();
    if (!name) return;
    const tags = parseTags(editHashtagTags);
    const updated = hashtagSets.map(s => s.id === id ? { ...s, name, tags } : s);
    setHashtagsSaving(true);
    try {
      await customerAPI.updateHashtagSets(updated);
      setHashtagSets(updated);
      setEditingHashtagSetId(null);
      showToast('Hashtag set updated');
    } catch {
      showToast('Failed to update', 'error');
    } finally {
      setHashtagsSaving(false);
    }
  };

  const handleDeleteHashtagSet = async (id) => {
    const updated = hashtagSets.filter(s => s.id !== id);
    try {
      await customerAPI.updateHashtagSets(updated);
      setHashtagSets(updated);
      showToast('Hashtag set deleted');
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const loadApiKeys = async () => {
    setLoadingKeys(true);
    try {
      const res = await apiKeysAPI.list();
      setApiKeys(res.data.keys || []);
    } catch {
      // silently â€” non-critical
    } finally {
      setLoadingKeys(false);
    }
  };

  const loadSocialAccounts = async () => {
    try {
      const [accountsRes, statusRes, groupsRes] = await Promise.all([
        socialAPI.getAccounts(),
        socialAPI.getStatus(),
        socialAPI.getGroups().catch(() => ({ data: [] })),
      ]);
      setSocialAccounts(accountsRes.data);
      setSocialStatus(statusRes.data);
      setAccountGroups(groupsRes.data || []);
    } catch {}
  };

  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupForm({ name: '', accountIds: [] });
    setShowGroupModal(true);
  };

  const openEditGroup = (group) => {
    setEditingGroup(group);
    setGroupForm({ name: group.name, accountIds: group.account_ids || [] });
    setShowGroupModal(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) return;
    setGroupSaving(true);
    try {
      if (editingGroup) {
        const res = await socialAPI.updateGroup(editingGroup.id, { name: groupForm.name, accountIds: groupForm.accountIds });
        setAccountGroups(g => g.map(x => x.id === editingGroup.id ? { ...x, ...res.data } : x));
      } else {
        const res = await socialAPI.createGroup({ name: groupForm.name, accountIds: groupForm.accountIds });
        setAccountGroups(g => [...g, res.data]);
      }
      setShowGroupModal(false);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save group', 'error');
    } finally {
      setGroupSaving(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    try {
      await socialAPI.deleteGroup(id);
      setAccountGroups(g => g.filter(x => x.id !== id));
    } catch {
      showToast('Failed to delete group', 'error');
    }
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
      const popup = window.open(res.data.url, 'oauth_popup', 'width=600,height=700,scrollbars=yes');
      if (!popup) window.location.href = res.data.url;
    } catch {
      showToast('Connection failed â€” try "Manual setup" instead', 'error');
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
      message: `This will disconnect ${label} â€” you can reconnect anytime.`,
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

  const handleDisconnectById = (account) => {
    setConfirmModal({
      title: `Disconnect ${account.account_name || account.platform}`,
      message: `This will disconnect "${account.account_name || account.platform}" — you can reconnect anytime.`,
      confirmLabel: 'Disconnect',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await socialAPI.disconnectById(account.id);
          showToast('Account disconnected');
          loadSocialAccounts();
        } catch {
          showToast('Failed to disconnect', 'error');
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
        notificationPreferences: notifPrefs,
      });
      showToast('Settings saved!');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const completeness = useMemo(() => {
    const checks = [
      { label: 'Business name', done: !!profile?.business_name?.trim(), weight: 15 },
      { label: 'Industry', done: !!profile?.industry?.trim(), weight: 15 },
      { label: 'Location', done: !!profile?.location?.trim(), weight: 15 },
      { label: 'Website', done: !!profile?.website?.trim(), weight: 10 },
      { label: 'Logo', done: !!profile?.logo_url, weight: 10 },
      { label: 'Tone', done: !!profile?.tone, weight: 10 },
      { label: 'Social account', done: socialAccounts.length > 0, weight: 25 },
    ];
    const percent = checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
    const missing = checks.filter(c => !c.done).map(c => c.label);
    return { percent, missing };
  }, [profile, socialAccounts]);

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

  // platformConfig removed â€” setupModal replaced by socialWizardModal + IntegrationSetupWizard

  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16,
    padding: 24,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };

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

        {/* Profile Completeness Bar */}
        <div style={{
          ...gc,
          background: completeness.percent === 100
            ? (t.isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)')
            : gc.background,
          border: completeness.percent === 100
            ? `1px solid rgba(34,197,94,0.25)`
            : gc.border,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                {completeness.percent === 100 ? 'Profile complete' : 'Profile setup'}
              </span>
              {completeness.percent === 100 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: t.success, padding: '2px 8px', background: `${t.success}18`, border: `1px solid ${t.success}30`, borderRadius: 20 }}>
                  <IpCheck size={10} /> Complete
                </span>
              )}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: completeness.percent === 100 ? t.success : completeness.percent >= 70 ? t.warning : t.primary }}>
              {completeness.percent}%
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 6, background: t.isDark ? 'rgba(255,255,255,0.07)' : t.border, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${completeness.percent}%`,
              borderRadius: 6,
              background: completeness.percent === 100
                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                : completeness.percent >= 70
                  ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                  : 'linear-gradient(90deg, #7C5CFC, #9B7BFF)',
              transition: 'width 600ms cubic-bezier(0.34,1.56,0.64,1)',
            }} />
          </div>
          {completeness.missing.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: t.textMuted }}>Still needed:</span>
              {completeness.missing.map(item => (
                <span key={item} style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, padding: '2px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 12 }}>{item}</span>
              ))}
            </div>
          )}
        </div>

        {/* Business Info */}
        <div style={gc}>
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
                      {logoUploading ? 'Uploadingâ€¦' : 'Upload logo'}
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
                      {faviconUploading ? 'Uploadingâ€¦' : 'Upload icon'}
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
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>Square image, at least 64Ã—64px</div>
              </div>
            </div>
          </div>
        </div>

        {/* Website Intelligence */}
        <div style={gc}>
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
              New site detected â€” scan it to update your saved information.
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
        </div>

        {/* Branding */}
        <div style={gc}>
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
                {VISUAL_STYLES.map((style) => {
                  const sel = profile.visual_style === style.id;
                  return (
                    <button key={style.id} onClick={() => setProfile({ ...profile, visual_style: style.id })}
                      style={{ padding: '12px 14px', border: `2px solid ${sel ? 'rgba(124,92,252,0.55)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, background: sel ? (t.isDark ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.07)') : t.isDark ? 'rgba(15,15,24,0.6)' : t.input, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)', transform: sel ? 'translateY(-2px)' : 'none', boxShadow: sel ? '0 6px 20px rgba(124,92,252,0.2), inset 0 1px 0 rgba(255,255,255,0.07)' : `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.03' : '0.85'})` }}
                      onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.3)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                      onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.07)' : t.border; e.currentTarget.style.transform = 'none'; } }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: sel ? t.primary : t.text }}>{style.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3, lineHeight: 1.4 }}>{style.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 10 }}>Tone</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {TONES.map((tone) => {
                  const sel = profile.tone === tone.id;
                  return (
                    <button key={tone.id} onClick={() => setProfile({ ...profile, tone: tone.id })}
                      style={{ padding: '11px 14px', border: `2px solid ${sel ? 'rgba(124,92,252,0.55)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, background: sel ? (t.isDark ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.07)') : t.isDark ? 'rgba(15,15,24,0.6)' : t.input, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 10, textAlign: 'center', cursor: 'pointer', transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)', transform: sel ? 'translateY(-2px)' : 'none', boxShadow: sel ? '0 6px 20px rgba(124,92,252,0.2), inset 0 1px 0 rgba(255,255,255,0.07)' : `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.03' : '0.85'})` }}
                      onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.3)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                      onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.07)' : t.border; e.currentTarget.style.transform = 'none'; } }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: sel ? t.primary : t.text }}>{tone.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Timezone & Scheduling */}
        <div style={gc}>
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
              {' â€” '}local time: <strong style={{ color: t.text }}>
                {new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true, weekday: 'short' }).format(new Date())}
              </strong>
            </div>
          </div>
        </div>

        {/* Connected Accounts */}
        <div style={gc}>
          <SectionHeader icon={IpShare} title="Connected Accounts" subtitle="Connect social media accounts to enable publishing" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
              const connectedAccounts = socialAccounts.filter((a) => a.platform === platform);
              const oauthAvailable = socialStatus?.[platform]?.oauthAvailable;
              const hasAny = connectedAccounts.length > 0;
              return (
                <div key={platform} style={{
                  padding: '16px 18px',
                  background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
                  backdropFilter: 'blur(16px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(16px) saturate(160%)',
                  borderRadius: 14,
                  border: `1px solid ${hasAny ? config.color + '35' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
                  boxShadow: hasAny
                    ? `0 4px 16px ${config.color}10, inset 0 1px 0 rgba(255,255,255,0.04)`
                    : `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.03' : '0.85'})`,
                  transition: 'all 200ms ease',
                }}>
                  {/* Platform header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${config.color}18`, border: `1px solid ${config.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: hasAny ? `0 2px 8px ${config.color}20` : 'none' }}>
                        <config.Icon size={22} style={{ color: config.color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{config.label}</div>
                        <div style={{ fontSize: 12, color: hasAny ? t.success : t.textMuted }}>
                          {hasAny ? `${connectedAccounts.length} account${connectedAccounts.length > 1 ? 's' : ''} connected` : config.description}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {oauthAvailable ? (
                        <button type="button" onClick={() => handleOAuthConnect(platform)}
                          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: hasAny ? 'transparent' : config.color, color: hasAny ? config.color : '#fff', border: `1px solid ${config.color}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <config.Icon size={12} style={{ color: hasAny ? config.color : '#fff' }} />
                          {hasAny ? '+ Add account' : 'Connect'}
                        </button>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button type="button" disabled style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'not-allowed', background: t.card, color: t.textMuted, border: `1px solid ${t.border}`, opacity: 0.65 }}>Connect</button>
                          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#D97706', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap' }}>Coming soon</span>
                        </div>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleConnect(platform)} style={{ fontSize: 12, color: t.textMuted }}>Manual setup</Button>
                    </div>
                  </div>

                  {/* Per-account rows */}
                  {connectedAccounts.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {connectedAccounts.map((acct) => {
                        const daysLeft = acct.token_expires_at
                          ? Math.floor((new Date(acct.token_expires_at) - new Date()) / 86400000)
                          : null;
                        const tokenExpired = daysLeft !== null && daysLeft < 0;
                        return (
                          <div key={acct.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', minHeight: 64, background: t.isDark ? 'rgba(255,255,255,0.03)' : t.card, borderRadius: 10, border: `1px solid ${tokenExpired ? 'rgba(239,68,68,0.3)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, flexWrap: 'wrap', boxShadow: `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.03' : '0.7'})` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: tokenExpired ? 'rgba(239,68,68,0.1)' : t.success + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <IpCheck size={14} style={{ color: tokenExpired ? t.error : t.success }} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {acct.account_name || 'Connected'}
                                </div>
                                {acct.account_username && (
                                  <div style={{ fontSize: 11, color: t.textMuted }}>@{acct.account_username}</div>
                                )}
                              </div>
                              {daysLeft !== null && daysLeft < 0 && (
                                <Badge variant="error">Token expired</Badge>
                              )}
                              {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && (
                                <Badge variant="warning">Reconnect in {daysLeft}d</Badge>
                              )}
                              {daysLeft !== null && daysLeft > 7 && daysLeft <= 30 && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: t.warning, padding: '2px 8px', background: `${t.warning}15`, border: `1px solid ${t.warning}30`, borderRadius: 12, whiteSpace: 'nowrap' }}>Expires in {daysLeft}d</span>
                              )}
                              {daysLeft !== null && daysLeft > 30 && (
                                <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>Expires in {daysLeft}d</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                              {/* Apple-style toggle switch */}
                              <button type="button" onClick={() => handleToggleAutoPost(acct)}
                                title={acct.auto_post ? 'Auto-post on — click to disable' : 'Auto-post off — click to enable'}
                                style={{ width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', padding: 3, background: acct.auto_post ? '#34C759' : t.borderStrong, transition: 'background 150ms ease', display: 'flex', alignItems: 'center', justifyContent: acct.auto_post ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'transform 150ms cubic-bezier(0.34,1.56,0.64,1)' }} />
                              </button>
                              <span style={{ fontSize: 11, color: acct.auto_post ? t.success : t.textMuted, fontWeight: 600, minWidth: 36 }}>{acct.auto_post ? 'Auto' : 'Off'}</span>
                              <Button variant="ghost" size="sm" onClick={() => handleDisconnectById(acct)} style={{ color: t.error, fontSize: 12 }}>
                                Disconnect
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Groups */}
        <div style={gc}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 3 }}>Account Groups</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>Bundle accounts for one-click selection when posting</div>
            </div>
            <Button variant="primary" size="sm" onClick={openNewGroup} disabled={socialAccounts.length === 0}>+ New Group</Button>
          </div>
          {accountGroups.length === 0 ? (
            <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: t.textMuted }}>
              {socialAccounts.length === 0 ? 'Connect accounts first, then create groups.' : 'No groups yet. Create one to bundle accounts for quick selection.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accountGroups.map(group => {
                const memberNames = socialAccounts
                  .filter(a => (group.account_ids || []).includes(a.id))
                  .map(a => a.account_name || a.username || a.platform);
                return (
                  <div key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{group.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                        {memberNames.length > 0 ? memberNames.join(' · ') : 'No accounts'}
                        <span style={{ marginLeft: 6, padding: '1px 6px', background: t.primaryBg, color: t.primary, borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                          {(group.account_ids || []).length}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEditGroup(group)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteGroup(group.id)} style={{ color: t.error }}>Delete</Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Group create/edit modal */}
        {showGroupModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowGroupModal(false)}>
            <div style={{ background: t.isDark ? 'rgba(12,12,20,0.95)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(32px) saturate(200%)', WebkitBackdropFilter: 'blur(32px) saturate(200%)', borderRadius: 22, padding: 26, width: '100%', maxWidth: 420, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'}`, boxShadow: t.isDark ? '0 24px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)' : '0 20px 60px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,1)' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 16 }}>{editingGroup ? 'Edit Group' : 'New Group'}</div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Group Name</label>
                <input
                  value={groupForm.name}
                  onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. All Facebook Pages"
                  style={{ width: '100%', padding: '9px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Accounts in this group</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
                  {socialAccounts.filter(a => a.enabled).map(account => {
                    const checked = groupForm.accountIds.includes(account.id);
                    return (
                      <label key={account.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 8px', borderRadius: 7, background: checked ? t.primaryBg : 'transparent', border: `1px solid ${checked ? t.primaryBorder : 'transparent'}` }}>
                        <input type="checkbox" checked={checked} onChange={() => setGroupForm(f => ({ ...f, accountIds: f.accountIds.includes(account.id) ? f.accountIds.filter(x => x !== account.id) : [...f.accountIds, account.id] }))} style={{ accentColor: t.primary }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{account.account_name || account.username || account.platform}</span>
                        <span style={{ fontSize: 11, color: t.textMuted, textTransform: 'capitalize' }}>{account.platform.replace('_', ' ')}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="primary" onClick={handleSaveGroup} disabled={groupSaving || !groupForm.name.trim()} style={{ flex: 1 }}>
                  {groupSaving ? 'Saving...' : 'Save Group'}
                </Button>
                <Button variant="secondary" onClick={() => setShowGroupModal(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* Notification Preferences */}
        <div style={gc}>
          <SectionHeader icon={IpBell} title="Notification Preferences" subtitle="Choose which alerts and updates PostCore sends you" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {NOTIF_GROUPS.map(group => (
              <div key={group.label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{group.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {group.items.map(item => {
                    const enabled = notifPrefs[item.key] !== false;
                    return (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '11px 14px', borderRadius: 10, background: t.isDark ? 'rgba(255,255,255,0.02)' : t.input, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.05)' : t.border}`, cursor: 'pointer', transition: 'background 120ms' }}
                        onClick={() => setNotifPrefs(p => ({ ...p, [item.key]: !enabled }))}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? t.text : t.textMuted, marginBottom: 2, transition: 'color 150ms' }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>{item.desc}</div>
                        </div>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setNotifPrefs(p => ({ ...p, [item.key]: !enabled })); }}
                          style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', padding: 3, background: enabled ? '#34C759' : (t.isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'), transition: 'background 150ms ease', display: 'flex', alignItems: 'center', justifyContent: enabled ? 'flex-end' : 'flex-start', flexShrink: 0 }}
                        >
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)' }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 12px', background: t.isDark ? 'rgba(124,92,252,0.06)' : 'rgba(124,92,252,0.04)', border: `1px solid ${t.isDark ? 'rgba(124,92,252,0.2)' : 'rgba(124,92,252,0.15)'}`, borderRadius: 8, fontSize: 11, color: t.textMuted }}>
            Changes save when you click <strong style={{ color: t.textSecondary }}>Save Changes</strong> above. Email notifications are also controlled by your email preferences.
          </div>
        </div>

        {/* Hashtag Sets */}
        <div style={gc}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Hashtag Sets</span>
                <span style={{ padding: '2px 8px', background: t.primaryBg, color: t.primary, fontSize: 11, fontWeight: 600, borderRadius: 5, border: `1px solid ${t.primaryBorder}` }}>
                  {hashtagSets.length}/30
                </span>
              </div>
              <div style={{ fontSize: 13, color: t.textMuted }}>Save groups of hashtags to apply in one click when creating posts.</div>
            </div>
          </div>

          {/* Existing sets */}
          {hashtagSets.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {hashtagSets.map(set => (
                <div key={set.id} style={{ padding: '12px 14px', background: t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                  {editingHashtagSetId === set.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        value={editHashtagName}
                        onChange={e => setEditHashtagName(e.target.value)}
                        placeholder="Set name"
                        style={{ padding: '8px 10px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                      />
                      <textarea
                        value={editHashtagTags}
                        onChange={e => setEditHashtagTags(e.target.value)}
                        placeholder="Paste hashtags separated by spaces or commas"
                        rows={2}
                        style={{ padding: '8px 10px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 12, fontFamily: 'monospace', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleUpdateHashtagSet(set.id)}
                          disabled={hashtagsSaving || !editHashtagName.trim()}
                          style={{ padding: '7px 14px', background: t.primary, border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: hashtagsSaving ? 0.6 : 1 }}>
                          {hashtagsSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingHashtagSetId(null)}
                          style={{ padding: '7px 14px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 7, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{set.name}</span>
                          {set.usage_count > 0 && (
                            <span style={{ fontSize: 11, color: t.textMuted }}>Used {set.usage_count}×</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(set.tags || []).slice(0, 15).map((tag, i) => (
                            <span key={i} style={{ padding: '2px 7px', borderRadius: 4, background: t.primaryBg, color: t.primary, fontSize: 11, border: `1px solid ${t.primaryBorder}` }}>
                              #{tag}
                            </span>
                          ))}
                          {(set.tags || []).length > 15 && (
                            <span style={{ fontSize: 11, color: t.textMuted, padding: '2px 4px' }}>+{set.tags.length - 15} more</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => { setEditingHashtagSetId(set.id); setEditHashtagName(set.name); setEditHashtagTags((set.tags || []).join(' ')); }}
                          style={{ padding: '5px 8px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 6, color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <IpEdit size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteHashtagSet(set.id)}
                          style={{ padding: '5px 8px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 6, color: t.error, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <IpDelete size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Create new set */}
          {hashtagSets.length < 30 && (
            <div style={{ padding: '14px', background: t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Set</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  value={newSetName}
                  onChange={e => setNewSetName(e.target.value)}
                  placeholder="Set name (e.g. Roofing, Seasonal, Local)"
                  maxLength={60}
                  style={{ padding: '9px 11px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                />
                <textarea
                  value={newSetTags}
                  onChange={e => setNewSetTags(e.target.value)}
                  placeholder="Paste hashtags here — separate by spaces or commas&#10;e.g. roofing homeimprovement localroofer storm damage"
                  rows={3}
                  style={{ padding: '9px 11px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 12, fontFamily: 'monospace', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: t.textMuted }}>
                    {parseTags(newSetTags).length > 0 ? `${parseTags(newSetTags).length} tags detected` : 'Up to 30 tags per set'}
                  </span>
                  <button
                    onClick={handleCreateHashtagSet}
                    disabled={hashtagsSaving || !newSetName.trim() || !parseTags(newSetTags).length}
                    style={{ padding: '8px 16px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: hashtagsSaving || !newSetName.trim() || !parseTags(newSetTags).length ? 0.5 : 1 }}>
                    <IpPlus size={14} /> {hashtagsSaving ? 'Saving...' : 'Add Set'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {hashtagSets.length === 0 && !loadingHashtags && (
            <div style={{ textAlign: 'center', padding: '20px 0 8px', color: t.textMuted, fontSize: 13 }}>
              No hashtag sets yet. Create your first one above.
            </div>
          )}
        </div>

        {/* Developer API Keys */}
        {(() => {
          const SCOPE_DEFS = [
            { group: 'Content', scopes: [
              { value: 'posts:read',  label: 'View posts & schedule', desc: 'Read your posts, drafts, and scheduled content' },
              { value: 'posts:write', label: 'Create & schedule posts', desc: 'Create posts and update existing ones (includes read)' },
            ]},
            { group: 'AI Generation', scopes: [
              { value: 'generate:write', label: 'Generate AI content', desc: 'Generate captions using AI â€” uses 1 credit per call' },
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
            <div style={gc}>
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
                  {(() => {
                    const scopeLabelMap = Object.fromEntries(SCOPE_DEFS.flatMap(g => g.scopes).map(sc => [sc.value, sc.label]));
                    return apiKeys.map(key => (
                    <div key={key.id} style={{ padding: '12px 14px', background: t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 3 }}>{key.name}</div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: t.textMuted, marginBottom: 5 }}>
                            {key.key_prefix}...
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                            {(key.scopes || []).map(s => (
                              <span key={s} style={{ fontSize: 10, padding: '2px 7px', background: `${t.primary}15`, color: t.primary, borderRadius: 4, fontWeight: 500 }}>{scopeLabelMap[s] || s}</span>
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>
                            Created {formatDate(key.created_at)}
                            {' Â· '}
                            {timeAgo(key.last_used_at)}
                            {key.expires_at && <span> Â· Expires {formatDate(key.expires_at)}</span>}
                            {!key.expires_at && <span> Â· No expiry</span>}
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
                  ));
                  })()}
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
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                  <div style={{ background: t.isDark ? 'rgba(12,12,20,0.95)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(32px) saturate(200%)', WebkitBackdropFilter: 'blur(32px) saturate(200%)', borderRadius: 22, padding: 28, width: '100%', maxWidth: 480, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'}`, boxShadow: t.isDark ? '0 24px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)' : '0 20px 60px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,1)' }}>
                    {createKeyStep === 1 && (
                      <>
                        <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6 }}>Create API Key â€” Name & Expiry</div>
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
                          <Button variant="primary" size="sm" disabled={!newKeyForm.name.trim()} onClick={() => { setCreateKeyError(''); setCreateKeyStep(2); }}>Next: Permissions â†’</Button>
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
                          <Button variant="secondary" size="sm" onClick={() => setCreateKeyStep(1)}>â† Back</Button>
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
                          Copy this key now â€” you won't be able to see it again.
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
            </div>
          );
        })()}


      </div>

      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}


      {/* Social Platform Wizard */}
      {socialWizardModal && (() => {
        const config = PLATFORM_CONFIG[socialWizardModal];
        const wizardEntry = SOCIAL_WIZARD_MAP[socialWizardModal];
        if (!config || !wizardEntry) return null;
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
            isUpdate={false}
            accentColor={config.color}
            logo={<config.Icon size={20} style={{ color: '#fff' }} />}
          />
        );
      })()}


      {/* Manual Token Modal â€” replaced by socialWizardModal + IntegrationSetupWizard */}
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
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 1 }}>Follow the steps below â€” takes about 2 minutes</div>
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
                            {step.link.label} â†—
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
                      ? `Token valid â€” connected as "${tokenVerified.accountName}"`
                      : `Token failed: ${tokenVerified.error}`}
                  </div>
                )}
                <button
                  onClick={handleVerifyToken}
                  disabled={tokenVerifying || manualToken.trim().length < 10}
                  style={{ marginTop: 8, padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: manualToken.trim().length < 10 ? 'not-allowed' : 'pointer', opacity: manualToken.trim().length < 10 ? 0.4 : 1 }}>
                  {tokenVerifying ? 'Testing...' : 'ðŸ” Test connection'}
                </button>
              </div>

              {/* Page ID */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {platformConfig.tokenHelp.pageIdLabel}
                  {' '}<span style={{ color: t.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>(optional â€” auto-filled on test)</span>
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

