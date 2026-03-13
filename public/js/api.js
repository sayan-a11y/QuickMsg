const socket = typeof io !== 'undefined' ? io() : null;

if (socket) {
    socket.on('connect', () => {
        const user = User.get();
        if (user && user.id) {
            console.log("Socket connected, registering user:", user.id);
            socket.emit('register', user.id);
        }
    });

    socket.on('connect_error', (error) => {
        console.error("Socket Connection Error:", error);
    });
}
const API = {
    async get(url) {
        const res = await fetch(url);
        if (res.status === 401) window.location.href = '/index.html';
        return res.json();
    },
    async post(url, body, isFormData = false) {
        const options = {
            method: 'POST',
            body: isFormData ? body : JSON.stringify(body)
        };
        if (!isFormData) {
            options.headers = { 'Content-Type': 'application/json' };
        }
        const res = await fetch(url, options);
        if (res.status === 401) window.location.href = '/index.html';
        return res.json();
    },
    async put(url, body) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.status === 401) window.location.href = '/index.html';
        return res.json();
    }
};

const User = {
    get() {
        return JSON.parse(localStorage.getItem('user'));
    },
    set(data) {
        localStorage.setItem('user', JSON.stringify(data));
    },
    clear() {
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    }
};

const utils = {
    formatTime(dateStr) {
        if (!dateStr) return "";
        let ds = dateStr.toString().replace(' ', 'T');
        if (ds.length > 10 && !ds.includes('Z') && !ds.includes('+')) ds += 'Z';
        const date = new Date(ds);
        if (isNaN(date.getTime())) return "";
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    formatLastSeen(dateStr) {
        if (!dateStr) return "Offline";
        let ds = dateStr.toString().replace(' ', 'T');
        if (ds.length > 10 && !ds.includes('Z') && !ds.includes('+')) ds += 'Z';
        const date = new Date(ds);
        if (isNaN(date.getTime())) return "Offline";

        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return "Just now";
        if (diffInSeconds < 3600) return Math.floor(diffInSeconds / 60) + "m ago";
        
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return "at " + this.formatTime(dateStr);
        }

        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return "yesterday at " + this.formatTime(dateStr);
        }

        return date.toLocaleDateString() + " at " + this.formatTime(dateStr);
    }
};
