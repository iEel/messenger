import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// POST /api/upload — อัปโหลดไฟล์ POD (photo / signature)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const taskId = formData.get('taskId') as string | null;
    const type = formData.get('type') as string | null; // photo | signature

    if (!file || !taskId || !type) {
      return NextResponse.json(
        { error: 'ต้องระบุ file, taskId, type' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['photo', 'signature'].includes(type)) {
      return NextResponse.json(
        { error: 'type ต้องเป็น photo หรือ signature' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'ไฟล์ใหญ่เกิน 10MB' },
        { status: 400 }
      );
    }

    // Validate task exists
    const tasks = await query<{ Id: number }[]>(
      'SELECT Id FROM Tasks WHERE Id = @id',
      { id: parseInt(taskId) }
    );
    if (tasks.length === 0) {
      return NextResponse.json({ error: 'ไม่พบใบงาน' }, { status: 404 });
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'uploads', 'pod', taskId);
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(file.name) || '.png';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${type}_${timestamp}_${safeName}`;
    const filePath = path.join(uploadDir, fileName);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Save to database
    const relativePath = `pod/${taskId}/${fileName}`;
    await query(
      `INSERT INTO ProofOfDelivery (TaskId, Type, FilePath, FileName, UploadedBy)
       VALUES (@taskId, @type, @filePath, @fileName, @uploadedBy)`,
      {
        taskId: parseInt(taskId),
        type,
        filePath: relativePath,
        fileName: file.name || fileName,
        uploadedBy: parseInt(session.user.id),
      }
    );

    return NextResponse.json({
      message: 'อัปโหลดสำเร็จ',
      filePath: relativePath,
      fileName,
    });
  } catch (error) {
    console.error('POST /api/upload error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
