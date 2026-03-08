// @ts-expect-error — web-push has no type declarations
import webPush from 'web-push';
import { query, getPool } from '@/lib/db';

// ★ Lazy VAPID init — ป้องกัน crash ตอน build
let vapidInitialized = false;
function ensureVapid() {
  if (vapidInitialized) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn('[Push] VAPID keys not configured, push notifications disabled');
    return;
  }
  try {
    webPush.setVapidDetails('mailto:admin@company.com', publicKey, privateKey);
    vapidInitialized = true;
  } catch (err) {
    console.error('[Push] VAPID init error:', err);
  }
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

interface PushSubscription {
  Id: number;
  Endpoint: string;
  P256dh: string;
  Auth: string;
}

/**
 * ★ Send push notification to a specific user
 */
export async function sendPushToUser(userId: number, payload: PushPayload) {
  try {
    ensureVapid();
    if (!vapidInitialized) return; // VAPID not configured, skip
    const subscriptions = await query<PushSubscription[]>(
      'SELECT Id, Endpoint, P256dh, Auth FROM PushSubscriptions WHERE UserId = @userId',
      { userId }
    );

    if (subscriptions.length === 0) return;

    const jsonPayload = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subscriptions.map((sub: PushSubscription) =>
        webPush.sendNotification(
          {
            endpoint: sub.Endpoint,
            keys: { p256dh: sub.P256dh, auth: sub.Auth },
          },
          jsonPayload
        )
      )
    );

    // Clean up expired/invalid subscriptions
    const expiredIds: number[] = [];
    results.forEach((result: PromiseSettledResult<unknown>, index: number) => {
      if (result.status === 'rejected') {
        const statusCode = (result.reason as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(subscriptions[index].Id);
        }
      }
    });

    if (expiredIds.length > 0) {
      const pool = await getPool();
      await pool.request()
        .query(`DELETE FROM PushSubscriptions WHERE Id IN (${expiredIds.join(',')})`);
    }
  } catch (error) {
    console.error('Push notification error:', error);
  }
}

/**
 * ★ Send push notification to a messenger when task is assigned
 */
export async function notifyTaskAssigned(messengerId: number, taskNumber: string, documentDesc: string, recipientName: string) {
  const result = await query<{ UserId: number }[]>(
    'SELECT UserId FROM Messengers WHERE Id = @messengerId',
    { messengerId }
  );

  const userId = result[0]?.UserId;
  if (!userId) return;

  await sendPushToUser(userId, {
    title: '📦 งานใหม่!',
    body: `${taskNumber} — ${documentDesc}\nผู้รับ: ${recipientName}`,
    url: '/messenger',
    tag: `task-${taskNumber}`,
  });
}
