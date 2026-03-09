import { NextRequest, NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { trackApiRequest } from '@/lib/api-rate-limit';

// ★ Auto-create table
async function ensureTable() {
  try {
    const pool = await getPool();
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TaskTemplates')
      CREATE TABLE TaskTemplates (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        CreatedBy INT NOT NULL,
        RecipientName NVARCHAR(200),
        RecipientPhone NVARCHAR(20),
        RecipientCompany NVARCHAR(200),
        TaskType VARCHAR(20) DEFAULT 'oneway',
        DocumentDesc NVARCHAR(500),
        Address NVARCHAR(500),
        District NVARCHAR(100),
        SubDistrict NVARCHAR(100),
        Province NVARCHAR(100) DEFAULT N'กรุงเทพมหานคร',
        PostalCode VARCHAR(10),
        GoogleMapsUrl NVARCHAR(500),
        Latitude FLOAT,
        Longitude FLOAT,
        Priority VARCHAR(20) DEFAULT 'normal',
        IsShared BIT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
      )
    `);
  } catch { /* table already exists */ }
}

let tableReady = false;

// GET — ดึง Template (ของตัวเอง + shared)
export async function GET(request: NextRequest) {
  try {
    trackApiRequest(request);
    if (!tableReady) { await ensureTable(); tableReady = true; }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const templates = await query<{
      Id: number; Name: string; CreatedBy: number; CreatorName: string;
      RecipientName: string; RecipientPhone: string | null; RecipientCompany: string | null;
      TaskType: string; DocumentDesc: string | null; Address: string | null;
      District: string | null; SubDistrict: string | null; Province: string | null;
      PostalCode: string | null; GoogleMapsUrl: string | null;
      Latitude: number | null; Longitude: number | null;
      Priority: string; IsShared: boolean; CreatedAt: string;
    }[]>(`
      SELECT t.*, u.FullName AS CreatorName
      FROM TaskTemplates t
      JOIN Users u ON t.CreatedBy = u.Id
      WHERE t.IsActive = 1
        AND (t.CreatedBy = @userId OR t.IsShared = 1)
      ORDER BY t.Name ASC
    `, { userId });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('GET /api/task-templates error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST — สร้าง Template ใหม่
export async function POST(request: NextRequest) {
  try {
    if (!tableReady) { await ensureTable(); tableReady = true; }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const userId = parseInt(session.user.id);

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อ Template' }, { status: 400 });
    }

    // IsShared ได้เฉพาะ admin/dispatcher
    const canShare = ['admin', 'dispatcher'].includes(session.user.role);
    const isShared = canShare && body.isShared ? 1 : 0;

    const result = await query<{ Id: number }[]>(`
      INSERT INTO TaskTemplates (
        Name, CreatedBy, RecipientName, RecipientPhone, RecipientCompany,
        TaskType, DocumentDesc, Address, District, SubDistrict,
        Province, PostalCode, GoogleMapsUrl, Latitude, Longitude,
        Priority, IsShared
      )
      OUTPUT INSERTED.Id
      VALUES (
        @name, @userId, @recipientName, @recipientPhone, @recipientCompany,
        @taskType, @documentDesc, @address, @district, @subDistrict,
        @province, @postalCode, @googleMapsUrl, @latitude, @longitude,
        @priority, @isShared
      )
    `, {
      name: body.name.trim(),
      userId,
      recipientName: body.recipientName || null,
      recipientPhone: body.recipientPhone || null,
      recipientCompany: body.recipientCompany || null,
      taskType: body.taskType || 'oneway',
      documentDesc: body.documentDesc || null,
      address: body.address || null,
      district: body.district || null,
      subDistrict: body.subDistrict || null,
      province: body.province || 'กรุงเทพมหานคร',
      postalCode: body.postalCode || null,
      googleMapsUrl: body.googleMapsUrl || null,
      latitude: body.latitude ? parseFloat(body.latitude) : null,
      longitude: body.longitude ? parseFloat(body.longitude) : null,
      priority: body.priority || 'normal',
      isShared,
    });

    logAudit({
      action: 'template_created',
      userId,
      targetType: 'template',
      targetId: result[0].Id,
      details: `สร้าง Template: ${body.name}${isShared ? ' (แชร์)' : ''}`,
    });

    return NextResponse.json(
      { message: 'สร้าง Template สำเร็จ', id: result[0].Id },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/task-templates error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
