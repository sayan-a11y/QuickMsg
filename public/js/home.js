
import { db, ref, onValue, get, query, orderByChild, startAt, endAt, auth, onAuthStateChanged } from './firebase-config.js';
import { User, utils } from './api.js';

const chatListContainer = document.getElementById('chat-list');
const userSearchInput = document.getElementById('user-search');

let allLoadedChats = [];
let currentUser = null;
const userCache = new Map();
const chatListeners = new Map();

console.log("Setting up Auth listener on Home...");
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = { ...(User.get() || {}), id: user.uid };
        loadChats();
    } else {
        window.location.href = './index.html';
    }
});

async function loadChats() {
    if (!currentUser || !currentUser.id) return;
    if (chatListeners.has('main-chats')) return;
    chatListeners.set('main-chats', true);

    const chatsRef = ref(db, 'chats/' + currentUser.id);
    
    // Live update for chat list
    onValue(chatsRef, async (snapshot) => {
        const chatsData = snapshot.val();
        if (!chatsData) {
            chatListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No messages yet.</div>';
            return;
        }

        const chatIds = Object.keys(chatsData);
        const fetchPromises = chatIds.map(async (id) => {
            try {
                let userData = userCache.get(id);
                if (!userData) {
                    const userSnap = await get(ref(db, 'users/' + id));
                    userData = userSnap.val() || { name: 'User', avatar: 'default.png' };
                    userCache.set(id, userData);
                }

                return {
                    id,
                    ...userData,
                    ...chatsData[id]
                };
            } catch (err) {
                return { id, name: 'User', ...chatsData[id] };
            }
        });

        const results = await Promise.all(fetchPromises);
        allLoadedChats = results.sort((a, b) => (b.time || 0) - (a.time || 0));
        renderChats(allLoadedChats);
    });
}

function renderChats(chats) {
    if (!chats.length) {
        chatListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No chats found.</div>';
        return;
    }

    chatListContainer.innerHTML = chats.map(chat => {
        const unreadBadge = chat.unread > 0 ? `<div class="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">${chat.unread}</div>` : '';
        const name = chat.name || chat.username || 'User';
        const avatarHtml = chat.avatar && chat.avatar !== 'default.png' 
            ? `<img src="${chat.avatar}" class="w-full h-full object-cover">` 
            : `<div class="w-full h-full bg-blue-600 text-white flex items-center justify-center font-bold">${name[0]}</div>`;

        return `
            <div class="p-4 flex items-center justify-between border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition-all cursor-pointer select-none" 
                 onclick="window.location.href='chat.html?id=${chat.id}&name=${encodeURIComponent(name)}'">
                <div class="flex items-center space-x-3 overflow-hidden">
                    <div class="relative w-12 h-12 flex-shrink-0 bg-blue-100 rounded-full overflow-hidden shadow-inner">
                        ${avatarHtml}
                    </div>
                    <div class="overflow-hidden">
                        <h3 class="font-semibold text-gray-800 text-[15px] truncate">${name}</h3>
                        <p class="text-sm text-gray-500 truncate ${chat.unread > 0 ? 'font-bold text-gray-900' : ''}">${chat.lastMessage || 'No messages'}</p>
                    </div>
                </div>
                <div class="flex flex-col items-end space-y-1 flex-shrink-0 ml-2">
                    <span class="text-[11px] text-gray-400">${utils.formatTime(chat.time)}</span>
                    ${unreadBadge}
                </div>
            </div>`;
    }).join('');
}

// Search Logic
let searchDebounce;
userSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    clearTimeout(searchDebounce);
    if (!q) { renderChats(allLoadedChats); return; }

    searchDebounce = setTimeout(async () => {
        try {
            const usersRef = ref(db, 'users');
            const userQuery = query(usersRef, orderByChild('username'), startAt(q), endAt(q + '\uf8ff'));
            const snap = await get(userQuery);
            const users = [];
            snap.forEach(child => {
                if (child.key !== currentUser.id) users.push({ id: child.key, ...child.val() });
            });
            renderSearchResults(users);
        } catch (err) { console.error(err); }
    }, 300);
});

function renderSearchResults(users) {
    if (!users.length) { chatListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No users found.</div>'; return; }
    chatListContainer.innerHTML = users.map(user => `
        <div class="p-4 flex items-center space-x-3 border-b border-gray-50 hover:bg-blue-50 cursor-pointer" 
             onclick="window.location.href='chat.html?id=${user.id}&name=${encodeURIComponent(user.name || user.username)}'">
            <div class="w-12 h-12 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center font-bold text-blue-600">
                ${user.avatar && user.avatar !== 'default.png' ? `<img src="${user.avatar}" class="w-full h-full object-cover">` : (user.name || 'U')[0]}
            </div>
            <div>
                <h3 class="font-semibold text-gray-800">${user.name || user.username}</h3>
                <p class="text-xs text-gray-500">Tap to start chatting</p>
            </div>
        </div>
    `).join('');
}
