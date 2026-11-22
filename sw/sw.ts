/// <reference lib="webworker" />
// Service worker: precaches the app shell so the installed app opens instantly. Data is never cached.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// The in-app "Reload" button asks the waiting worker to take over.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// Push notifications (web push, sent by supabase/functions/push-dispatch): { title, body, url, tag }.
// A newer notification with the same tag replaces the older one.
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string | null } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Inside Out', {
      body: data.body ?? '',
      icon: '/pwa-192x192.png',
      data: { url: data.url ?? '/' },
      ...(data.tag ? { tag: data.tag, renotify: true } : {}),
    } as NotificationOptions),
  )
})

// Tapping one opens its page: in a window that's already open (the app navigates itself), or a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url ?? '/', self.location.origin)
  const path = target.origin === self.location.origin ? target.pathname + target.search : '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        open.postMessage({ type: 'navigate', url: path })
      } else {
        await self.clients.openWindow(path)
      }
    })(),
  )
})
