// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/service-worker.js').then(function (registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
            requestNotificationPermission();
        }, function (err) {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}

function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(function (permission) {
            if (permission === 'granted') {
                console.log('Notification permission granted.');
            }
        });
    }
}

window.showNotification = function (title, body, url = '/') {
    if ('Notification' in window && Notification.permission === 'granted') {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((registration) => {
                registration.active.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    payload: {
                        title: title,
                        options: {
                            body: body,
                            icon: '/icon.png',
                            data: url
                        }
                    }
                });
            });
        } else {
            // Fallback for immediate
            new Notification(title, { body: body, icon: '/icon.png' });
        }
    }
};

// Real-time notifications are handled via Firebase listeners in individual pages
// such as chat.js and home.js. This avoids legacy socket dependencies.
