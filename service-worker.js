self.addEventListener('push', (event) => {
    let data = {};
    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        data = { title: 'New Notification', options: { body: event.data.text() } };
    }

    const title = data.title || 'QuickMsg';
    const options = {
        body: data.body || 'You have a new message.',
        icon: '/icon.png', // Provide a fallback if necessary
        badge: '/icon.png',
        data: data.url || '/',
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        requireInteraction: data.requireInteraction || false
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // This looks to see if the current is already open and focuses it
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url.includes('/') && 'focus' in client)
                    return client.focus();
            }
            if (clients.openWindow)
                return clients.openWindow(event.notification.data || '/');
        })
    );
});

// Also allow local messages from the app to trigger notifications directly for real-time
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, options } = event.data.payload;
        self.registration.showNotification(title, options);
    }
});
