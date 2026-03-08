import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRateLimitStats, unblockIp, getRateLimitConfig } from '@/lib/rate-limit';

// GET — ดึงสถิติ Rate Limit (admin only)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
