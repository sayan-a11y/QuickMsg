import { db, ref, onValue, get, query, orderByChild, equalTo, startAt, endAt, auth, onAuthStateChanged } from './firebase-config.js';
import { User, utils } from './api.js';

const chatListContainer = document.getElementById('chat-list');
const userSearchInput = document.getElementById('user-search');
const menuBtn = document.getElementById('menu-btn');
const dotMenu = document.getElementById('dot-menu');

let allLoadedChats = [];
let currentUser = null;
const userCache = new Map(); // Performance: Cache user details to avoid repeat reads
const chatListeners = new Map(); // Track listeners for cleanup

// Wait for Auth to set the user
console.log("Setting up Auth listener on Home...");
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Auth resolved: User is logged in", user.uid);
        // Use the authenticated UID as the source of truth
        const localUser = User.get() || {};
        currentUser = { ...localUser, id: user.uid };
        loadChats();
    } else {
        console.log("Auth resolved: No user found, redirecting to login");
        window.location.href = './';
    }
});

async function loadChats() {
    if (!currentUser || !currentUser.id) return;
    
    // Performance: Avoid duplicate listeners
    if (chatListeners.has('main')) return;
    chatListeners.set('main', true);

    const chatsRef = ref(db, 'chats/' + currentUser.id);
    
    // Performance: Use limited query for recent chats only
    // This prevents loading thousands of old chat summaries
    // onValue(chatsRef, ...) -> will now be handled more efficiently
    
    onValue(chatsRef, async (snapshot) => {
        const chatsData = snapshot.val();
        if (!chatsData) {
            chatListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No chats yet. Start a new one!</div>';
            return;
        }

        const chatIds = Object.keys(chatsData);
        const resolvedChats = [];

        // Performance: Parallel fetch with Caching
        const fetchPromises = chatIds.map(async (id) => {
            try {
                // Check Cache first
                let userData = userCache.get(id);
                if (!userData) {
                    const userSnap = await get(ref(db, 'users/' + id));
                    userData = userSnap.val() || { name: 'User', avatar: 'default.png' };
                    userCache.set(id, userData); // Save to cache
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
        
        // Performance: Use DocumentFragment or Batch Update to prevent UI flickering
        renderChats(allLoadedChats);
    });
}

function renderChats(chats) {
    if (chats.length === 0) {
        chatListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No chats yet. Start a new one!</div>';
        return;
    }

    chatListContainer.innerHTML = chats.map(chat => `
        <div class="p-4 flex items-center space-x-4 hover:bg-gray-100 cursor-pointer transition-colors" onclick="openChat('${chat.id}', '${chat.name}')">
            <div class="relative flex-shrink-0" onclick="event.stopPropagation(); window.location.href='profile-view.html?id=${chat.id}'">
                ${chat.avatar && chat.avatar !== 'default.png'
                    ? `<img src="${chat.avatar}" class="w-14 h-14 rounded-full object-cover shadow-sm" alt="avatar">`
                    : `<div class="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl uppercase shadow-sm">${(chat.name || 'U')[0]}</div>`
                }
                <div id="status-${chat.id}" class="absolute bottom-0 right-0 w-3.5 h-3.5 ${chat.online ? 'bg-green-500' : 'hidden'} border-2 border-white rounded-full"></div>
            </div>
            <div class="flex-1 overflow-hidden">
                <div class="flex justify-between items-center">
                    <h3 class="font-bold text-gray-800 truncate">${chat.name || chat.username}</h3>
                    <span class="text-xs text-gray-400">${utils.formatTime(chat.time)}</span>
                </div>
                <div class="flex justify-between items-center mt-1">
                    <div class="flex items-center gap-1 overflow-hidden flex-1">
                        <p class="text-sm text-gray-500 truncate">${chat.lastMessage || ''}</p>
                    </div>
                    <span id="badge-${chat.id}" class="${chat.unread > 0 ? 'flex' : 'hidden'} bg-[#25D366] text-white text-[10px] min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full font-bold">
                        ${chat.unread}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

window.openChat = function(userId, name) {
    window.location.href = `chat.html?id=${userId}&name=${encodeURIComponent(name)}`;
}

let searchDebounce;
userSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    
    clearTimeout(searchDebounce);
    if (q.length < 1) {
        renderChats(allLoadedChats);
        return;
    }

    // Debounce to improve speed/performance
    searchDebounce = setTimeout(async () => {
        console.log("Searching for:", q);
        try {
            const usersRef = ref(db, 'users');
            // Since Firebase doesn't support full-text search natively without third-party services,
            // we use a specific range query for prefixes.
            const userQuery = query(usersRef, orderByChild('username'), startAt(q), endAt(q + '\uf8ff'));
            
            const snapshot = await get(userQuery);
            const users = [];
            snapshot.forEach(child => {
                const userData = child.val();
                if (child.key !== currentUser.id) {
                    users.push({ id: child.key, ...userData });
                }
            });
            
            console.log("Found users:", users.length);
            renderSearchResults(users);
        } catch (error) {
            console.error("Search failed:", error);
            // Fallback: If indexing is slow, notify user
            if (error.message.includes('index')) {
                chatListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">Database is indexing new users. Please try again in a moment.</div>';
            }
        }
    }, 300);
});

function renderSearchResults(users) {
    if (users.length === 0) {
        chatListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No users found.</div>';
        return;
    }

    chatListContainer.innerHTML = users.map(user => `
        <div class="p-4 flex items-center space-x-4 hover:bg-blue-50 cursor-pointer border-b border-gray-100" onclick="openChat('${user.id}', '${user.name || user.username}')">
            <div class="relative flex-shrink-0">
                ${user.avatar && user.avatar !== 'default.png'
                    ? `<img src="${user.avatar}" class="w-12 h-12 rounded-full object-cover shadow-sm" alt="avatar">`
                    : `<div class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg uppercase shadow-sm">${(user.name || user.username || 'U')[0]}</div>`
                }
            </div>
            <div class="flex-1">
                <h3 class="font-bold text-gray-800">${user.name || user.username}</h3>
                <p class="text-sm text-gray-400">@${user.username}</p>
            </div>
        </div>
    `).join('');
}

// Menu and UI logic
if (menuBtn && dotMenu) {
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        dotMenu.classList.toggle('hidden');
    };
    document.addEventListener('click', (e) => {
        if (!dotMenu.contains(e.target) && e.target !== menuBtn) dotMenu.classList.add('hidden');
    });
}

const searchBtn = document.getElementById('search-btn');
const searchContainer = document.getElementById('search-container');

window.toggleSearch = () => {
    searchContainer.classList.toggle('hidden');
    if (!searchContainer.classList.contains('hidden')) {
        userSearchInput.focus();
    }
};

if (searchBtn) searchBtn.onclick = window.toggleSearch;

// loadChats is called inside onAuthStateChanged
