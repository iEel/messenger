import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readFile, stat } from 'fs/promises';
import path from 'path';

// MIME type lookup
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

// GET /api/uploads/[...path] — serve uploaded files
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join('/');

    // Prevent path traversal
    if (relativePath.includes('..') || relativePath.includes('~')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'uploads', relativePath);

    // Check file exists
    try {
      await stat(filePath);
    } catch {
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    console.error('GET /api/uploads error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
