import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * ★ Centralized Auth Middleware
 * ป้องกันทุก route ที่ต้อง login — redirect ไป /login ถ้าไม่มี session
 */

// Routes ที่ไม่ต้อง login
const PUBLIC_PATHS = [
  '/login',
  '/api/auth',        // NextAuth endpoints (login, callback, session)
  '/api/email-action', // ใช้ HMAC token แทน session
];

// Static files / assets ที่ไม่ต้องตรวจสอบ
const STATIC_PREFIXES = [
  '/_next',
  '/favicon',
  '/icons',
  '/manifest',
  '/sw.js',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ★ Skip static files
  if (STATIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // ★ Skip public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // ★ Check session token (NextAuth v5 uses authjs.session-token)
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value;

  if (!sessionToken) {
    // API routes → return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized — กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Page routes → redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, favicon.png
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png).*)',
  ],
};
