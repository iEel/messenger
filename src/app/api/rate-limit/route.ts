import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRateLimitStats, unblockIp, getRateLimitConfig, updateRateLimitConfig, loadRateLimitConfigFromDb } from '@/lib/rate-limit';
import { trackApiRequest } from '@/lib/api-rate-limit';

let configLoaded = false;

// GET — ดึงสถิติ Rate Limit (admin only)
export async function GET(request: NextRequest) {
  try {
    trackApiRequest(request);
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // โหลด config จาก DB ครั้งแรก
    if (!configLoaded) {
      await loadRateLimitConfigFromDb();
      configLoaded = true;
    }

    const stats = getRateLimitStats();
    const config = getRateLimitConfig();

    return NextResponse.json({ stats, config });
  } catch (error) {
    console.error('GET /api/rate-limit error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE — ปลดบล็อก IP (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ip } = await request.json();
    if (!ip) {
      return NextResponse.json({ error: 'ต้องระบุ IP' }, { status: 400 });
    }

    const result = unblockIp(ip);
    return NextResponse.json({
      success: result,
      message: result ? `ปลดบล็อก ${ip} เรียบร้อย` : `ไม่พบ ${ip} ในรายการ`,
    });
  } catch (error) {
    console.error('DELETE /api/rate-limit error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT — อัปเดต config (admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates: { general?: Record<string, number>; login?: Record<string, number> } = {};

    if (body.general) {
      updates.general = {};
      if (body.general.maxRequests) updates.general.maxRequests = Number(body.general.maxRequests);
      if (body.general.windowMs) updates.general.windowMs = Number(body.general.windowMs);
      if (body.general.blockDurationMs) updates.general.blockDurationMs = Number(body.general.blockDurationMs);
    }
    if (body.login) {
      updates.login = {};
      if (body.login.maxRequests) updates.login.maxRequests = Number(body.login.maxRequests);
      if (body.login.windowMs) updates.login.windowMs = Number(body.login.windowMs);
      if (body.login.blockDurationMs) updates.login.blockDurationMs = Number(body.login.blockDurationMs);
    }

    const newConfig = await updateRateLimitConfig(updates);
    return NextResponse.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('PUT /api/rate-limit error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
