import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * ★ Centralized Auth Middleware + Rate Limiting
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

  // ★ Rate Limiting
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const isLoginAttempt = pathname === '/api/auth/callback/credentials' && request.method === 'POST';
  const rateType = isLoginAttempt ? 'login' as const : 'general' as const;

  const { allowed, remaining, retryAfterMs } = checkRateLimit(ip, rateType);

  if (!allowed) {
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Too Many Requests — คุณส่ง request มากเกินไป กรุณารอสักครู่',
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      );
    }

    // Page route → แสดงหน้า error แบบง่าย
    return new NextResponse(
      `<!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>429 - Too Many Requests</title></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
        <div style="text-align:center;max-width:400px;padding:40px;">
          <h1 style="font-size:64px;margin:0;color:#ef4444;">429</h1>
          <h2 style="color:#374151;margin-top:8px;">Too Many Requests</h2>
          <p style="color:#6b7280;margin-top:12px;">คุณส่ง request มากเกินไป กรุณารอ ${retryAfterSeconds} วินาที แล้วลองใหม่</p>
          <button onclick="location.reload()" 
                  style="margin-top:20px;padding:10px 24px;border-radius:8px;background:#6366f1;color:white;border:none;cursor:pointer;font-size:14px;">
            ลองใหม่
          </button>
        </div>
      </body></html>`,
      {
        status: 429,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Retry-After': String(retryAfterSeconds),
        },
      }
    );
  }

  // ★ Skip public paths (after rate limit check)
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    return response;
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

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png).*)',
  ],
};
