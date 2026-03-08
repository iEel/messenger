import { NextRequest } from 'next/server';
import { checkRateLimit } from './rate-limit';

/**
 * ★ Track API request สำหรับ rate limit stats
 * เรียกที่ API route layer เพื่อให้ stats page เห็นข้อมูล
 * (middleware Edge Runtime แยก process กับ API routes — share memory ไม่ได้)
 */
export function trackApiRequest(
  request: NextRequest,
  type: 'general' | 'login' = 'general'
): { allowed: boolean; remaining: number; ip: string } {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const result = checkRateLimit(ip, type);
  return { ...result, ip };
}
