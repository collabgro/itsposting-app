import { NextResponse } from 'next/server';

// Detect custom agency domains so login/join pages can fetch agency branding
export function middleware(request) {
  const host = request.headers.get('host') || '';

  // Strip port for comparison
  const bareHost = host.replace(/:\d+$/, '').toLowerCase();

  const isOwnDomain =
    bareHost === 'localhost' ||
    bareHost.includes('.railway.app') ||
    bareHost.includes('itsposting.com') ||
    bareHost.includes('vercel.app');

  if (!isOwnDomain) {
    // Pass the custom domain via header so pages can fetch agency branding
    const response = NextResponse.next();
    response.headers.set('x-custom-domain', bareHost);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all pages except static assets and API routes
    '/((?!_next/static|_next/image|favicon.ico|icon-|manifest.json|sw.js|api/).*)',
  ],
};
