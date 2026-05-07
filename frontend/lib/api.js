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
};

export const socialAPI = {
  getAccounts: () => api.get('/api/social/accounts'),
  getStatus: () => api.get('/api/social/status'),
  getConnectUrl: (platform) => `/api/social/connect/${platform}`,
  updateAccount: (id, data) => api.patch(`/api/social/accounts/${id}`, data),
  disconnect: (platform) => api.delete(`/api/social/accounts/${platform}`),
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
};

export const billingAPI = {
  getPlans: () => api.get('/api/billing/plans'),
  getCurrent: () => api.get('/api/billing/current'),
  upgrade: (planId) => api.post('/api/billing/upgrade', { planId }),
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
  getCustomer: (id) => api.get(`/api/admin/customers/${id}`),
  updateCustomer: (id, data) => api.patch(`/api/admin/customers/${id}`, data),
  adjustCredits: (id, amount, reason) => api.post(`/api/admin/customers/${id}/credits`, { amount, reason }),
  suspend: (id, reason) => api.post(`/api/admin/customers/${id}/suspend`, { reason }),
  reactivate: (id) => api.post(`/api/admin/customers/${id}/reactivate`),
  resetPassword: (id, newPassword) => api.post(`/api/admin/customers/${id}/reset-password`, { newPassword }),
  promote: (id) => api.post(`/api/admin/customers/${id}/promote`),
  demote: (id) => api.post(`/api/admin/customers/${id}/demote`),
  getAuditLog: (params) => api.get('/api/admin/audit', { params }),
  getHealth: () => api.get('/api/admin/health'),
  getEmailQueue: (params) => api.get('/api/admin/email-queue', { params }),
  retryEmail: (id) => api.post(`/api/admin/email-queue/${id}/retry`),
  retryAllEmails: () => api.post('/api/admin/email-queue/retry-all'),
};

export const analyticsAPI = {
  listPosts: (params) => api.get('/api/analytics/posts', { params }),
  getPostDetail: (id) => api.get(`/api/analytics/posts/${id}`),
  getOverview: (params) => api.get('/api/analytics/overview', { params }),
  recordSnapshot: (id, data) => api.post(`/api/analytics/posts/${id}/snapshot`, data),
  getOptimalTimes: () => api.get('/api/analytics/optimal-times'),
  getContentPerformance: () => api.get('/api/analytics/content-performance'),
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
};

export const contactsAPI = {
  list: (params) => api.get('/api/contacts', { params }),
  create: (data) => api.post('/api/contacts', data),
  get: (id) => api.get(`/api/contacts/${id}`),
  update: (id, data) => api.patch(`/api/contacts/${id}`, data),
  delete: (id) => api.delete(`/api/contacts/${id}`),
};

export default api;
