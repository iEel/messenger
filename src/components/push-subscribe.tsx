'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

/**
 * ★ PushSubscribe — auto-subscribes the current user to push notifications
 * Place inside the authenticated layout. It will:
 * 1. Register the service worker
 * 2. Request notification permission
 * 3. Subscribe to push via VAPID key
 * 4. Save the subscription to the server
 */
export function PushSubscribe() {
  const { data: session } = useSession();
  const subscribed = useRef(false);

  useEffect(() => {
    if (!session?.user?.id || subscribed.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    subscribed.current = true;

    const subscribe = async () => {
      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
          // Request permission
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;

          // Subscribe with VAPID key
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidKey) return;

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
          });
        }

        // Save subscription to server
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: parseInt(session.user.id),
            subscription: subscription.toJSON(),
          }),
        });
      } catch (error) {
        console.error('[Push] Subscribe error:', error);
      }
    };

    subscribe();
  }, [session?.user?.id]);

  return null; // invisible component
}

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
