import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    if (error.response?.status === 429) {
      // Attach a readable message so page-level error states show something useful
      const retryAfter = error.response.headers?.['retry-after'];
      error.message = retryAfter
        ? `Too many requests — please wait ${retryAfter} seconds and try again.`
        : 'Too many requests — please wait a moment and try again.';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  verify: () => api.get('/api/auth/verify'),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/api/auth/reset-password', { token, newPassword }),
};

export const customerAPI = {
  getProfile: () => api.get('/api/customers/profile'),
  updateProfile: (data) => api.patch('/api/customers/profile', data),
  getSocialAccounts: () => api.get('/api/customers/social-accounts'),
  invite: (data) => api.post('/api/customers/invite', data),
  uploadAsset: (formData) => api.post('/api/customers/upload-asset', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const socialAPI = {
  getAccounts: () => api.get('/api/social/accounts'),
  getStatus: () => api.get('/api/social/status'),
  getConnectUrl: (platform) => `/api/social/connect/${platform}`,
  getOAuthUrl: (platform) => api.get(`/api/social/connect-url/${platform}`),
  connectManual: (platform, data) => api.post('/api/social/connect/manual', { platform, ...data }),
  updateAccount: (id, data) => api.patch(`/api/social/accounts/${id}`, data),
  disconnect: (platform) => api.delete(`/api/social/accounts/${platform}`),
  disconnectById: (id) => api.delete(`/api/social/accounts/by-id/${id}`),
  verifyToken: (platform, accessToken, accountId) => api.post('/api/social/verify-token', { platform, accessToken, accountId }),
  publish: (postId, accountIds, platforms) => api.post('/api/social/publish', { postId, accountIds, platforms }),
  getGroups: () => api.get('/api/social/groups'),
  createGroup: (data) => api.post('/api/social/groups', data),
  updateGroup: (id, data) => api.patch(`/api/social/groups/${id}`, data),
  deleteGroup: (id) => api.delete(`/api/social/groups/${id}`),
  searchLocations: (q) => api.get('/api/social/locations/search', { params: { q } }),
  getReviews: () => api.get('/api/social/reviews'),
  generateReviewPost: (data) => api.post('/api/social/reviews/generate-post', data),
};

export const scraperAPI = {
  scrape: (url) => api.post('/api/scraper/scrape', { url }),
  getData: () => api.get('/api/scraper/data'),
  clearData: () => api.delete('/api/scraper/data'),
};

export const postsAPI = {
  getAll: (params) => api.get('/api/posts', { params }),
  getUpcoming: () => api.get('/api/posts/upcoming'),
  getById: (id) => api.get(`/api/posts/${id}`),
  update: (id, data) => api.patch(`/api/posts/${id}`, data),
  delete: (id) => api.delete(`/api/posts/${id}`),
  getAnalytics: () => api.get('/api/posts/analytics/summary'),
};

export const contentAPI = {
  generate: (data) => api.post('/api/content/generate', data),
  getCredits: () => api.get('/api/content/credits'),
  getCreditHistory: () => api.get('/api/content/credits/history'),
  getProviders: () => api.get('/api/content/providers'),
  generateVariations: (data) => api.post('/api/content/generate-variations', data),
  getVariations: (postId) => api.get(`/api/content/variations/${postId}`),
  chooseVariation: (postId, label) => api.post(`/api/content/variations/${postId}/choose`, { label }),
};

export const suggestionsAPI = {
  getAll: () => api.get('/api/suggestions'),
  getCount: () => api.get('/api/suggestions/count'),
  generate: () => api.post('/api/suggestions/generate'),
  use: (id, postId = null) => api.post(`/api/suggestions/${id}/use`, { postId }),
  dismiss: (id) => api.post(`/api/suggestions/${id}/dismiss`),
};

export const wizardAPI = {
  start: (data) => api.post('/api/wizard/start', data),
  step: (data) => api.post('/api/wizard/step', data),
  generate: (data) => api.post('/api/wizard/generate', data),
  quick: (data) => api.post('/api/wizard/quick', data),
  refresh: (data) => api.post('/api/wizard/refresh', data),
  getSteps: (industry, contentType) => api.get(`/api/wizard/steps/${industry}/${contentType}`),
};

export const uploadAPI = {
  uploadMedia: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/upload/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  uploadCarousel: (files) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    return api.post('/api/upload/carousel', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  createPost: (data) => api.post('/api/upload/post', data),
  getPostImages: (postId) => api.get(`/api/upload/post-images/${postId}`),
  getPlatformSpecs: () => api.get('/api/upload/platform-specs'),
};

export const billingAPI = {
  getPlans: () => api.get('/api/billing/plans'),
  getCurrent: () => api.get('/api/billing/current'),
  getHistory: () => api.get('/api/billing/history'),
  getCheckoutLink: (plan, cycle) => api.get(`/api/billing/checkout-link?plan=${plan}&cycle=${cycle}`),
  buyCredits: (pack) => api.get(`/api/billing/buy-credits?pack=${pack}`),
  cancel: () => api.post('/api/billing/cancel'),
  upgrade: (planId) => api.post('/api/billing/upgrade', { planId }),
};

export const workspacesAPI = {
  list: () => api.get('/api/workspaces'),
  create: (data) => api.post('/api/workspaces', data),
  remove: (id) => api.delete(`/api/workspaces/${id}`),
  rename: (id, name) => api.patch(`/api/workspaces/${id}`, { name }),
  switchTo: (id) => api.post(`/api/workspaces/${id}/switch`),
  switchToMain: () => api.post('/api/workspaces/main/switch'),
  getMembers: () => api.get('/api/workspaces/members'),
  updateMember: (id, data) => api.patch(`/api/workspaces/members/${id}`, data),
  removeMember: (id) => api.delete(`/api/workspaces/members/${id}`),
  invite: (data) => api.post('/api/workspaces/invite', data),
  getInvitations: () => api.get('/api/workspaces/invitations'),
  cancelInvitation: (id) => api.delete(`/api/workspaces/invitations/${id}`),
  myMemberships: () => api.get('/api/workspaces/my-memberships'),
};

export const inviteAPI = {
  getInvite: (token) => api.get(`/api/auth/invite/${token}`),
  acceptInvite: (token, data) => api.post(`/api/auth/invite/${token}/accept`, data),
};

export const mediaAPI = {
  getQuota: () => api.get('/api/media/quota'),
  list: (params) => api.get('/api/media', { params }),
  getFolders: () => api.get('/api/media/folders'),
  upload: (files, folder = 'all', onProgress) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    formData.append('folder', folder);
    return api.post('/api/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total)); },
    });
  },
  delete: (id) => api.delete(`/api/media/${id}`),
  markUsed: (id) => api.post(`/api/media/${id}/use`),
};

export const adminAPI = {
  getStats: () => api.get('/api/admin/stats'),
  listCustomers: (params) => api.get('/api/admin/customers', { params }),
  exportCustomers: () => api.get('/api/admin/export/customers', { responseType: 'blob' }),
  getCustomer: (id) => api.get(`/api/admin/customers/${id}`),
  updateCustomer: (id, data) => api.patch(`/api/admin/customers/${id}`, data),
  adjustCredits: (id, amount, reason) => api.post(`/api/admin/customers/${id}/credits`, { amount, reason }),
  suspend: (id, reason) => api.post(`/api/admin/customers/${id}/suspend`, { reason }),
  reactivate: (id) => api.post(`/api/admin/customers/${id}/reactivate`),
  resetPassword: (id, newPassword) => api.post(`/api/admin/customers/${id}/reset-password`, { newPassword }),
  promote: (id) => api.post(`/api/admin/customers/${id}/promote`),
  demote: (id) => api.post(`/api/admin/customers/${id}/demote`),
  impersonate: (id) => api.post(`/api/admin/customers/${id}/impersonate`),
  getAuditLog: (params) => api.get('/api/admin/audit', { params }),
  getHealth: () => api.get('/api/admin/health'),
  getEmailQueue: (params) => api.get('/api/admin/email-queue', { params }),
  retryEmail: (id) => api.post(`/api/admin/email-queue/${id}/retry`),
  retryAllEmails: () => api.post('/api/admin/email-queue/retry-all'),
  listPosts: (params) => api.get('/api/admin/posts', { params }),
  deletePost: (id, reason) => api.delete(`/api/admin/posts/${id}`, { data: { reason } }),
  broadcast: (data) => api.post('/api/admin/broadcast', data),
  getBroadcasts: () => api.get('/api/admin/broadcasts'),
  uploadStockPhotos: (formData) => api.post('/api/admin/stock-photos', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  listStockPhotos: (params) => api.get('/api/admin/stock-photos', { params }),
  updateStockPhoto: (id, data) => api.patch(`/api/admin/stock-photos/${id}`, data),
  deleteStockPhoto: (id) => api.delete(`/api/admin/stock-photos/${id}`),
  changePlan: (id, data) => api.post(`/api/admin/customers/${id}/plan`, data),
};

export const analyticsAPI = {
  listPosts: (params) => api.get('/api/analytics/posts', { params }),
  getPostDetail: (id) => api.get(`/api/analytics/posts/${id}`),
  getOverview: (params) => api.get('/api/analytics/overview', { params }),
  recordSnapshot: (id, data) => api.post(`/api/analytics/posts/${id}/snapshot`, data),
  getOptimalTimes: () => api.get('/api/analytics/optimal-times'),
  getContentPerformance: () => api.get('/api/analytics/content-performance'),
  getContentHealth: () => api.get('/api/analytics/content-health'),
  getContentMix: () => api.get('/api/analytics/content-mix'),
  getStreak: () => api.get('/api/analytics/streak'),
  updateStreak: () => api.post('/api/analytics/streak/update'),
  getMonthlyStats: () => api.get('/api/analytics/monthly-stats'),
  syncMetrics: (data = {}) => api.post('/api/analytics/sync-metrics', data),
};

export const dmsAPI = {
  getStats: () => api.get('/api/dms/stats'),
  sync: () => api.post('/api/dms/sync'),
  list: (params) => api.get('/api/dms', { params }),
  getConversation: (id) => api.get(`/api/dms/${id}`),
  reply: (id, message) => api.post(`/api/dms/${id}/reply`, { message }),
  aiReply: (id, tone) => api.post(`/api/dms/${id}/ai-reply`, { tone }),
  markRead: (id) => api.patch(`/api/dms/${id}/read`),
  toggleStar: (id) => api.patch(`/api/dms/${id}/star`),
  setStatus: (id, status) => api.patch(`/api/dms/${id}/status`, { status }),
  getAutoReplies: () => api.get('/api/dms/auto-replies'),
  createAutoReply: (data) => api.post('/api/dms/auto-replies', data),
  updateAutoReply: (id, data) => api.patch(`/api/dms/auto-replies/${id}`, data),
  deleteAutoReply: (id) => api.delete(`/api/dms/auto-replies/${id}`),
  saveContact: (id) => api.post(`/api/dms/${id}/contact`),
};

export const contactsAPI = {
  list: (params) => api.get('/api/contacts', { params }),
  create: (data) => api.post('/api/contacts', data),
  get: (id) => api.get(`/api/contacts/${id}`),
  update: (id, data) => api.patch(`/api/contacts/${id}`, data),
  delete: (id) => api.delete(`/api/contacts/${id}`),
};

export const intelligenceAPI = {
  getMetrics: (params) => api.get('/api/intelligence/metrics', { params }),
  getTrend: (params) => api.get('/api/intelligence/trend', { params }),
  getBestPost: (params) => api.get('/api/intelligence/best-post', { params }),
  getContentMix: (params) => api.get('/api/intelligence/content-mix', { params }),
  getContentHealth: () => api.get('/api/intelligence/content-health'),
  getBriefing: () => api.get('/api/intelligence/briefing'),
  generateBriefing: () => api.post('/api/intelligence/briefing/generate'),
  markBriefingRead: (id) => api.patch(`/api/intelligence/briefing/${id}/read`),
  getBenchmarks: (params) => api.get('/api/intelligence/benchmarks', { params }),
  getBestTimes: () => api.get('/api/intelligence/best-times'),
};

export const notificationsAPI = {
  list: (params) => api.get('/api/notifications', { params }),
  markRead: (id) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: () => api.patch('/api/notifications/read-all'),
  delete: (id) => api.delete(`/api/notifications/${id}`),
};

export const knowledgeAPI = {
  getPreview: (params) => api.get('/api/knowledge/scrape-preview', { params }),
  list: () => api.get('/api/knowledge'),
  save: (data) => api.post('/api/knowledge/save', data),
  importWebsite: (data) => api.post('/api/knowledge/import-website', data),
  startCrawl: (url, mode) => api.post('/api/knowledge/crawl', { url, mode }),
  getCrawlStatus: (jobId) => api.get(`/api/knowledge/crawl/${jobId}`),
  importCrawl: (jobId, selectedUrls) => api.post(`/api/knowledge/crawl/${jobId}/import`, { selectedUrls }),
  cancelCrawl: (jobId) => api.delete(`/api/knowledge/crawl/${jobId}`),
  listCrawlJobs: () => api.get('/api/knowledge/crawls'),
  savePrices: (items) => api.post('/api/knowledge/prices', { items }),
  createEntry: (data) => api.post('/api/knowledge/entry', data),
  updateEntry: (id, data) => api.put(`/api/knowledge/${id}`, data),
  deleteEntry: (id) => api.delete(`/api/knowledge/${id}`),
  uploadFile: (formData) => api.post('/api/knowledge/upload-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const suggestionsAPIExtra = {
  getToday: () => api.get('/api/suggestions/today'),
};

export const geoAPI = {
  runAudit: (data = {}) => api.post('/api/geo/audit', data),
  getLatest: () => api.get('/api/geo/audit/latest'),
  getAudit: (id) => api.get(`/api/geo/audit/${id}`),
  getHistory: () => api.get('/api/geo/history'),
  getScore: () => api.get('/api/geo/score'),
};

export const studioAPI = {
  getPhotos: (params) => api.get('/api/studio/photos', { params }),
  getPhoto: (id) => api.get(`/api/studio/photos/${id}`),
  format: (data) => api.post('/api/studio/format', data),
  generate: (data) => api.post('/api/studio/generate', data),
  getCreations: (params) => api.get('/api/studio/creations', { params }),
  getCreation: (id) => api.get(`/api/studio/creations/${id}`),
  save: (data) => api.post('/api/studio/save', data),
  postCreation: (id, data) => api.post(`/api/studio/creations/${id}/post`, data),
  renderVideo: (data) => api.post('/api/studio/video-render', data),
  getRenderStatus: (jobId) => api.get(`/api/studio/video-render/${jobId}`),
  aiGenerateClip: (data) => api.post('/api/studio/ai-clip', data),
  getTemplates: (params) => api.get('/api/studio/templates', { params }),
  getTemplate: (id) => api.get(`/api/studio/templates/${id}`),
  searchStockPhotos: (q, page = 1) => api.get('/api/studio/stock-search', { params: { q, page } }),
  searchStockVideos: (q, page = 1) => api.get('/api/studio/stock-videos', { params: { q, page } }),
  removeBackground: (imageUrl) => api.post('/api/studio/remove-background', { imageUrl }),
  extractElement: (imageUrl, pointX, pointY) => api.post('/api/studio/extract-element', { imageUrl, pointX, pointY }),
  extractElements: (imageUrl) => api.post('/api/studio/extract-elements', { imageUrl }),
  rewriteText: (data) => api.post('/api/studio/rewrite-text', data),
  updateTemplate: (id, data) => api.patch(`/api/studio/templates/${id}`, data),
};

export const receptionistAPI = {
  getConfig: () => api.get('/api/receptionist/config'),
  saveConfig: (data) => api.post('/api/receptionist/config', data),
  getConversations: (params) => api.get('/api/receptionist/conversations', { params }),
  getStats: () => api.get('/api/receptionist/stats'),
  test: (message) => api.post('/api/receptionist/test', { message }),
  getLeads: (params) => api.get('/api/receptionist/leads', { params }),
  updateConversationStage: (id, stage) => api.patch(`/api/receptionist/conversations/${id}/stage`, { stage }),
  getReviewActions: () => api.get('/api/receptionist/review-actions'),
  skipReviewAction: (id) => api.post(`/api/receptionist/review-actions/${id}/skip`),
};

export const apiKeysAPI = {
  list: () => api.get('/api/api-keys'),
  create: (data) => api.post('/api/api-keys', data),
  revoke: (id) => api.delete(`/api/api-keys/${id}`),
};

export const ideasAPI = {
  getToday:  ()   => api.get('/api/ideas/today'),
  refresh:   ()   => api.post('/api/ideas/refresh'),
  markUsed:  (id) => api.post(`/api/ideas/${id}/use`),
};

export default api;
