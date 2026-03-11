/**
 * ALEX — Service Worker
 * ─────────────────────────────────────────────────────────────────────
 * Handles:
 *   1. Push notifications (chat messages + incoming calls)
 *   2. Notification click → open/focus app
 *   3. Offline caching (app shell strategy)
 *   4. Custom notification sounds via postMessage
 *
 * Push payload shape (from Edge Function):
 *   {
 *     type:      'message' | 'call' | 'call_end',
 *     roomId:    'ALEX-XXXX-XXXX',
 *     senderName:'...',
 *     preview:   '...',        // for message type
 *     callType:  'voice'|'video', // for call type
 *     icon:      '/icons/icon-192.png',
 *     badge:     '/icons/badge-72.png',
 *     tag:        roomId,       // collapse same-room notifs
 *     timestamp:  Date.now(),
 *   }
 */

const SW_VERSION   = 'alex-sw-v3';
const CACHE_NAME   = `alex-cache-${SW_VERSION}`;
const STATIC_URLS  = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/* ═══════════════════════════════════════════════════════════════════
   INSTALL — cache app shell
   ═══════════════════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* ═══════════════════════════════════════════════════════════════════
   ACTIVATE — clean old caches
   ═══════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ═══════════════════════════════════════════════════════════════════
   FETCH — cache-first for app shell, network-first for API
   ═══════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Skip non-GET, cross-origin, and Supabase API requests */
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/supabase')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        /* Update cache for static assets */
        if (response.ok && STATIC_URLS.includes(url.pathname)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      });
      /* Return cached immediately, update in background */
      return cached || network;
    })
  );
});

/* ═══════════════════════════════════════════════════════════════════
   PUSH — receive push notification from server
   ═══════════════════════════════════════════════════════════════════ */
self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { type: 'message', preview: event.data.text(), senderName: 'ALEX' };
  }

  const { type, roomId, senderName, preview, callType, icon, badge, timestamp } = payload;

  let title, body, actions, data, vibrate, tag;

  if (type === 'call') {
    title   = `📞 Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`;
    body    = `${senderName} is calling you`;
    actions = [
      { action: 'accept', title: '✅ Answer' },
      { action: 'decline', title: '❌ Decline' },
    ];
    vibrate = [200, 100, 200, 100, 200];
    tag     = `call-${roomId}`;
    data    = { type, roomId, callType, url: `/?room=${roomId}&action=answer` };
  } else if (type === 'call_end') {
    /* Silent — just close any existing call notification */
    return self.registration.getNotifications({ tag: `call-${roomId}` })
      .then(notifs => notifs.forEach(n => n.close()));
  } else {
    /* Message */
    title   = `💬 ${senderName}`;
    body    = preview || 'Sent you a message';
    actions = [
      { action: 'open', title: '💬 Open' },
      { action: 'dismiss', title: '✕ Dismiss' },
    ];
    vibrate = [100, 50, 100];
    tag     = `msg-${roomId}`;
    data    = { type, roomId, url: `/?room=${roomId}` };
  }

  const options = {
    body,
    icon:       icon   || '/icons/icon-192.png',
    badge:      badge  || '/icons/badge-72.png',
    tag,
    renotify:   true,
    vibrate,
    actions,
    data,
    timestamp:  timestamp || Date.now(),
    requireInteraction: type === 'call',  /* call notif stays until acted on */
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATION CLICK — focus app or open with context
   ═══════════════════════════════════════════════════════════════════ */
self.addEventListener('notificationclick', event => {
  const { action, notification } = event;
  const { data } = notification;
  notification.close();

  if (action === 'decline') {
    /* Optionally send decline signal — for now just close */
    return;
  }

  const targetUrl = (action === 'accept' && data?.callType)
    ? `/?room=${data.roomId}&action=answer`
    : (data?.url || '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        /* Try to find existing open window */
        const match = clients.find(c => {
          const u = new URL(c.url);
          return u.origin === self.location.origin;
        });
        if (match) {
          match.focus();
          match.postMessage({ type: 'NOTIF_CLICK', action, data });
          return;
        }
        /* Open new window */
        return self.clients.openWindow(targetUrl);
      })
  );
});

/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATION CLOSE — track dismissed notifications
   ═══════════════════════════════════════════════════════════════════ */
self.addEventListener('notificationclose', event => {
  /* Notify open clients that notification was dismissed */
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(c => c.postMessage({
      type: 'NOTIF_CLOSED',
      tag: event.notification.tag,
      data: event.notification.data,
    }));
  });
});

/* ═══════════════════════════════════════════════════════════════════
   MESSAGE — receive commands from app (e.g. close notifs)
   ═══════════════════════════════════════════════════════════════════ */
self.addEventListener('message', event => {
  const { type, tag, roomId } = event.data || {};

  if (type === 'CLOSE_NOTIF' && tag) {
    self.registration.getNotifications({ tag }).then(notifs => {
      notifs.forEach(n => n.close());
    });
  }

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
