import {supabase} from './supabase';

const publicVapidKey = 'YOUR_PUBLIC_VAPID_KEY'; // You'll need to set this up with web-push

export async function subscribeToPushNotifications() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications are not supported');
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicVapidKey
    });

    // Save subscription to database
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        endpoint: subscription.endpoint,
        auth: subscription.keys?.auth || '',
        p256dh: subscription.keys?.p256dh || ''
      });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return false;
  }
}