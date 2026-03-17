// Service worker for PWA - supports push notifications when configured
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json()
      const options = {
        body: data.body || 'Nueva notificación',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: data.url ? { url: data.url } : {},
      }
      event.waitUntil(self.registration.showNotification(data.title || 'Multiplanet', options))
    } catch {
      event.waitUntil(self.registration.showNotification('Multiplanet', { body: event.data.text() }))
    }
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url))
  }
})
