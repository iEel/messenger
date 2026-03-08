import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['admin', 'dispatcher'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const action = searchParams.get('action') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const search = searchParams.get('search') || '';

    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: Record<string, unknown> = { limit, offset };

    if (action) {
      conditions.push('a.Action = @action');
      params.action = action;
    }
    if (from) {
      conditions.push('CAST(a.CreatedAt AS DATE) >= @from');
      params.from = from;
    }
    if (to) {
      conditions.push('CAST(a.CreatedAt AS DATE) <= @to');
      params.to = to;
    }
    if (search) {
      conditions.push('(a.UserName LIKE @search OR a.Details LIKE @search)');
      params.search = `%${search}%`;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [logs, countResult] = await Promise.all([
      query<{
        Id: number; Action: string; UserId: number; UserName: string;
        TargetType: string; TargetId: number; Details: string;
        IpAddress: string; CreatedAt: string;
      }[]>(
        `SELECT a.Id, a.Action, a.UserId, a.UserName, a.TargetType, a.TargetId,
                a.Details, a.IpAddress, a.CreatedAt
         FROM AuditLog a
         ${where}
         ORDER BY a.CreatedAt DESC
         OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
        params
      ),
      query<{ total: number }[]>(
        `SELECT COUNT(*) AS total FROM AuditLog a ${where}`,
        params
      ),
    ]);

    return NextResponse.json({
      logs,
      total: countResult[0]?.total || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('GET /api/audit error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
