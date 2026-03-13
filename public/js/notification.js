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

// Global socket listeners for notifications in background
if (typeof socket !== 'undefined') {
    socket.on('receive_message', (msg) => {
        // If we are on chat page and talking to that user, don't notify unless hidden
        const isChatPage = window.location.pathname.includes('chat.html');
        const isCurrentContact = typeof contactId !== 'undefined' && contactId === msg.sender_id;

        if (!isChatPage || !isCurrentContact || document.hidden) {
            // We need sender name, we might just have id. We could decode token or just use "New message"
            showNotification('New Message', msg.text, `/chat.html?id=${msg.sender_id}`);
        }
    });

    socket.on('incoming_call', (data) => {
        // Data has {from, type, signalData}
        showNotification('Incoming Call', `You have an incoming ${data.type} call.`, `/chat.html?id=${data.from}`);
    });
}
