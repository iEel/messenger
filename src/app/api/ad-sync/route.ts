import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ldapSyncUsers, getLdapSettings } from '@/lib/ldap';
import { logAudit } from '@/lib/audit';

// ★ Auto-sync state
const syncState = {
  lastSync: null as string | null,
  lastResult: null as Record<string, unknown> | null,
  intervalId: null as ReturnType<typeof setInterval> | null,
};

// ★ Auto-sync ทุก 6 ชั่วโมง (เมื่อ LDAP enabled)
const AUTO_SYNC_INTERVAL = 6 * 60 * 60 * 1000; // 6 ชม.

async function runAutoSync() {
  try {
    const settings = await getLdapSettings();
    if (!settings.enabled) return;

    console.log('[AD Sync] Auto-sync starting...');
    const result = await ldapSyncUsers();
    syncState.lastSync = new Date().toISOString();
    syncState.lastResult = result as unknown as Record<string, unknown>;
    console.log(`[AD Sync] Auto-sync completed: ${result.message}`);

    // ★ Audit log สำหรับ auto-sync (userId = 0 = ระบบอัตโนมัติ)
    logAudit({
      action: 'settings_updated',
      userId: 0,
      targetType: 'ad_sync_auto',
      details: `[Auto] AD Sync: ${result.message}`,
    });
  } catch (err) {
    console.error('[AD Sync] Auto-sync error:', err);
  }
}

// เริ่ม auto-sync (ครั้งเดียว)
if (!syncState.intervalId && typeof setInterval !== 'undefined') {
  syncState.intervalId = setInterval(runAutoSync, AUTO_SYNC_INTERVAL);
  // รัน sync ครั้งแรกหลัง server start 30 วินาที
  setTimeout(runAutoSync, 30 * 1000);
}

// GET — ดูสถานะ sync ล่าสุด
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const settings = await getLdapSettings();

    return NextResponse.json({
      ldapEnabled: settings.enabled,
      autoSyncInterval: '6 ชั่วโมง',
      lastSync: syncState.lastSync,
      lastResult: syncState.lastResult,
    });
  } catch (error) {
    console.error('GET /api/ad-sync error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST — trigger sync manual (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await ldapSyncUsers();
    syncState.lastSync = new Date().toISOString();
    syncState.lastResult = result as unknown as Record<string, unknown>;

    // Audit log
    logAudit({
      action: 'settings_updated',
      userId: parseInt(session.user.id),
      targetType: 'ad_sync',
      details: `AD Sync: ${result.message}`,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/ad-sync error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
