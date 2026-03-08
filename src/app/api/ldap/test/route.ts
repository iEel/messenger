import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ldapTestConnection } from '@/lib/ldap';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await ldapTestConnection();
    return NextResponse.json(result);
  } catch (error) {
    console.error('LDAP test error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
