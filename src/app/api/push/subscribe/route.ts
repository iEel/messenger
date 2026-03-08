import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { auth } from '@/lib/auth';

// ★ Save / update push subscription for a user
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { userId, subscription } = await req.json();
    if (!userId || !subscription) {
      return NextResponse.json({ error: 'userId and subscription required' }, { status: 400 });
    }

    const pool = await getPool();

    // Ensure table exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PushSubscriptions')
      CREATE TABLE PushSubscriptions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Endpoint NVARCHAR(MAX) NOT NULL,
        P256dh NVARCHAR(500) NOT NULL,
        Auth NVARCHAR(500) NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_PushSub_User FOREIGN KEY (UserId) REFERENCES Users(Id)
      )
    `);

    // Upsert: delete old subscription for same endpoint, insert new
    await pool.request()
      .input('userId', userId)
      .input('endpoint', subscription.endpoint)
      .input('p256dh', subscription.keys.p256dh)
      .input('auth', subscription.keys.auth)
      .query(`
        DELETE FROM PushSubscriptions WHERE UserId = @userId AND Endpoint = @endpoint;
        INSERT INTO PushSubscriptions (UserId, Endpoint, P256dh, Auth) 
        VALUES (@userId, @endpoint, @p256dh, @auth);
      `);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

// ★ Delete push subscription
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { userId, endpoint } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const pool = await getPool();
    await pool.request()
      .input('userId', userId)
      .input('endpoint', endpoint || '')
      .query(endpoint
        ? 'DELETE FROM PushSubscriptions WHERE UserId = @userId AND Endpoint = @endpoint'
        : 'DELETE FROM PushSubscriptions WHERE UserId = @userId'
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
