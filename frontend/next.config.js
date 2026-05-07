const path = require('path');

/** @type {import('next').NextConfig} */
const isNetlify = process.env.NETLIFY === 'true';
const backendUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

if (isNetlify && !process.env.BACKEND_URL && !process.env.SKIP_BACKEND_URL_CHECK) {
  throw new Error(
    'BACKEND_URL is required for Netlify builds. Set it to your deployed API origin (no trailing slash), e.g. https://api.yourdomain.com — or set SKIP_BACKEND_URL_CHECK=1 only for debugging.'
  );
}

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, '..'),
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    optimizePackageImports: ['date-fns'],
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
