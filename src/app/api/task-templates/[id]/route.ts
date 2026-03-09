import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// GET — ดึง Template ตาม ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(session.user.id);

    const templates = await query<Record<string, unknown>[]>(`
      SELECT * FROM TaskTemplates
      WHERE Id = @id AND IsActive = 1
        AND (CreatedBy = @userId OR IsShared = 1)
    `, { id: parseInt(id), userId });

    if (templates.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ Template' }, { status: 404 });
    }

    return NextResponse.json(templates[0]);
  } catch (error) {
    console.error('GET /api/task-templates/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PATCH — แก้ไข Template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const userId = parseInt(session.user.id);
    const templateId = parseInt(id);

    // ตรวจสอบว่าเป็นเจ้าของ หรือ admin
    const existing = await query<{ CreatedBy: number }[]>(
      `SELECT CreatedBy FROM TaskTemplates WHERE Id = @id AND IsActive = 1`,
      { id: templateId }
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ Template' }, { status: 404 });
    }

    if (existing[0].CreatedBy !== userId && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์แก้ไข Template นี้' }, { status: 403 });
    }

    const updates: string[] = [];
    const sqlParams: Record<string, unknown> = { id: templateId };

    const fields: Record<string, string> = {
      name: 'Name', recipientName: 'RecipientName', recipientPhone: 'RecipientPhone',
      recipientCompany: 'RecipientCompany', taskType: 'TaskType', documentDesc: 'DocumentDesc',
      address: 'Address', district: 'District', subDistrict: 'SubDistrict',
      province: 'Province', postalCode: 'PostalCode', googleMapsUrl: 'GoogleMapsUrl',
      priority: 'Priority',
    };

    for (const [key, col] of Object.entries(fields)) {
      if (body[key] !== undefined) {
        updates.push(`${col} = @${key}`);
        sqlParams[key] = body[key] || null;
      }
    }

    if (body.latitude !== undefined) {
      updates.push('Latitude = @latitude');
      sqlParams.latitude = body.latitude ? parseFloat(body.latitude) : null;
    }
    if (body.longitude !== undefined) {
      updates.push('Longitude = @longitude');
      sqlParams.longitude = body.longitude ? parseFloat(body.longitude) : null;
    }

    // IsShared — admin/dispatcher only
    if (body.isShared !== undefined && ['admin', 'dispatcher'].includes(session.user.role)) {
      updates.push('IsShared = @isShared');
      sqlParams.isShared = body.isShared ? 1 : 0;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' }, { status: 400 });
    }

    updates.push('UpdatedAt = GETDATE()');

    await query(
      `UPDATE TaskTemplates SET ${updates.join(', ')} WHERE Id = @id`,
      sqlParams
    );

    logAudit({
      action: 'template_updated',
      userId,
      targetType: 'template',
      targetId: templateId,
      details: `แก้ไข Template: ${body.name || 'ID ' + templateId}`,
    });

    return NextResponse.json({ message: 'แก้ไข Template สำเร็จ' });
  } catch (error) {
    console.error('PATCH /api/task-templates/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE — ลบ Template (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(session.user.id);
    const templateId = parseInt(id);

    // ตรวจสอบสิทธิ์
    const existing = await query<{ CreatedBy: number }[]>(
      `SELECT CreatedBy FROM TaskTemplates WHERE Id = @id AND IsActive = 1`,
      { id: templateId }
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ Template' }, { status: 404 });
    }

    if (existing[0].CreatedBy !== userId && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ลบ Template นี้' }, { status: 403 });
    }

    await query(
      `UPDATE TaskTemplates SET IsActive = 0, UpdatedAt = GETDATE() WHERE Id = @id`,
      { id: templateId }
    );

    logAudit({
      action: 'template_deleted',
      userId,
      targetType: 'template',
      targetId: templateId,
      details: 'ลบ Template',
    });

    return NextResponse.json({ message: 'ลบ Template สำเร็จ' });
  } catch (error) {
    console.error('DELETE /api/task-templates/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
