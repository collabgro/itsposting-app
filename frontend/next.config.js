const path = require('path');

/** @type {import('next').NextConfig} */
const isNetlify = process.env.NETLIFY === 'true';
const backendUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

if (isNetlify && !process.env.BACKEND_URL && !process.env.SKIP_BACKEND_URL_CHECK) {
  throw new Error(
    'BACKEND_URL is required for Netlify builds. Set it to your deployed API origin (no trailing slash), e.g. https://api.yourdomain.com — or set SKIP_BACKEND_URL_CHECK=1 only for debugging.'
  );
}

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "media-src 'self' https: blob:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, '..'),
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    optimizePackageImports: ['date-fns'],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
