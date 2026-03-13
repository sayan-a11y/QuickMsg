
import { 
    auth, db, storage, ref, set, get, onValue, push, update, remove, query, orderByChild, equalTo, serverTimestamp, 
    sRef, uploadBytes, getDownloadURL, onAuthStateChanged, onDisconnect 
} from './firebase-config.js';

// Global exports
window.auth = auth;
window.db = db;
window.storage = storage;
window.limitToLast = limitToLast;
window.query = query;
window.increment = increment;

// Firebase Client-side API
const APP_URL = window.location.origin;

export const User = {
    get() {
        const local = localStorage.getItem('user');
        return local ? JSON.parse(local) : null;
    },
    set(data) {
        localStorage.setItem('user', JSON.stringify(data));
    },
    clear() {
        localStorage.removeItem('user');
        auth.signOut();
        window.location.href = window.location.origin;
    }
};

window.User = User;

// Track online status globally using the 'status' node
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Fetch user profile from 'users' node
        const userRef = ref(db, 'users/' + user.uid);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                User.set({ ...userData, id: user.uid });
                // If we are on the login page, redirect to home immediately
                if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
                    window.location.href = 'home.html';
                }
            } else {
                // If profile missing, set minimal data
                const minimal = { id: user.uid, email: user.email, name: user.displayName || 'User' };
                User.set(minimal);
            }
        }, { onlyOnce: true }); // optimize for login check

        // Online status in 'status' node
        const statusRef = ref(db, 'status/' + user.uid);
        set(statusRef, {
            online: true,
            lastSeen: serverTimestamp()
        });

        onDisconnect(statusRef).set({
            online: false,
            lastSeen: serverTimestamp()
        });

    } else {
        const path = window.location.pathname;
        // Protect all pages except root, /index, and login page variants
        const isLoginPage = path === '/' || path === '' || path.includes('index.html');
        if (!isLoginPage) {
            window.location.href = window.location.origin;
        }
    }
});

export const API = {
    // Messaging using the 'messages' node
    async sendMessage(to, text, file = null, fileType = null, replyTo = null) {
        const user = User.get();
        if (!user) return;

        const chatId = user.id < to ? `${user.id}_${to}` : `${to}_${user.id}`;
        // Use 'messages' node as requested
        const msgRef = push(ref(db, `messages/${chatId}`));
        const msgId = msgRef.key;
        
        const msgData = {
            id: msgId,
            senderId: user.id,
            receiverId: to,
            text: text || '',
            time: serverTimestamp(),
            seen: false,
            deleted: false
        };

        if (file) {
            msgData.file = file;
            msgData.fileType = fileType;
        }
        if (replyTo) msgData.replyTo = replyTo;

        await set(msgRef, msgData);
        
        // Update chats index for Home page
        const summary = {
            lastMessage: text || (file ? 'Media' : ''),
            time: serverTimestamp(),
            unread: 0
        };
        update(ref(db, `chats/${user.id}/${to}`), summary);
        
        const rxRef = ref(db, `chats/${to}/${user.id}`);
        const rxSnap = await get(rxRef);
        const rxUnread = (rxSnap.val()?.unread || 0) + 1;
        update(rxRef, { ...summary, unread: rxUnread });

        return msgId;
    },

    async uploadFile(file, path) {
        const storageRef = sRef(storage, path + '/' + Date.now() + '_' + file.name);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
    },

    setTyping(to, isTyping) {
        const user = User.get();
        if (!user) return;
        set(ref(db, `typing/${to}/${user.id}`), isTyping);
    }
};

window.API = API;

export const utils = {
    formatTime(timestamp) {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    formatLastSeen(timestamp) {
        if (!timestamp) return "Never";
        const date = new Date(timestamp);
        const now = new Date();
        const diff = (now - date) / 1000;

        if (diff < 60) return "Just now";
        if (diff < 3600) return Math.floor(diff / 60) + "m ago";
        if (date.toDateString() === now.toDateString()) return "Today at " + this.formatTime(timestamp);
        return date.toLocaleDateString();
    }
};

window.utils = utils;
export { APP_URL };
