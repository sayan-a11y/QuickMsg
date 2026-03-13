import { db, ref, onValue, get, query, orderByChild, equalTo, startAt, endAt, auth, onAuthStateChanged } from './firebase-config.js';
import { User, utils } from './api.js';

const chatListContainer = document.getElementById('chat-list');
const userSearchInput = document.getElementById('user-search');
const menuBtn = document.getElementById('menu-btn');
const dotMenu = document.getElementById('dot-menu');

let allLoadedChats = [];
let currentUser = null;

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
        window.location.href = './index.html';
    }
});

async function loadChats() {
    if (!currentUser || !currentUser.id) {
        console.error("loadChats called without valid user");
        return;
    }
    
    console.log("Starting loadChats for:", currentUser.id);
    
    // Timeout if loading takes too long
    const timeoutMsg = setTimeout(() => {
        if (chatListContainer.innerHTML.includes('fa-spinner') || chatListContainer.innerHTML.includes('Loading messages')) {
            console.warn("Loading timeout reached after 15s");
            chatListContainer.innerHTML = `
                <div class="p-8 text-center text-gray-400">
                    <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                    <p>Still loading? Check your internet or Firebase config (Database URL).</p>
                    <button onclick="location.reload()" class="mt-4 text-blue-500 underline">Reload Page</button>
                </div>`;
        }
    }, 15000);

    // Monitor Firebase connection status
    onValue(ref(db, ".info/connected"), (snap) => {
        if (snap.val() === false) {
            console.warn("Firebase: Disconnected from real-time database");
        } else {
            console.log("Firebase: Connected/Reconnected to database");
        }
    });

    const chatsRef = ref(db, 'chats/' + currentUser.id);
    console.log("Registering listener for chats at:", chatsRef.toString());
    
    onValue(chatsRef, async (snapshot) => {
        console.log("Chats listener fired. Snapshot exists:", snapshot.exists());
        clearTimeout(timeoutMsg);
        
        const chatsData = snapshot.val();
        if (!chatsData) {
            console.log("No chats found for user:", currentUser.id);
            chatListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No chats yet. Start a new one!</div>';
            return;
        }

        const chatIds = Object.keys(chatsData);
        console.log("Fetching details for:", chatIds.length, "chats");
        
        try {
            const resolvedChats = [];
            for (const id of chatIds) {
                try {
                    const userSnap = await get(ref(db, 'users/' + id));
                    const userData = userSnap.val() || { name: 'Unknown User', avatar: 'default.png', username: 'unknown' };
                    
                    const statusSnap = await get(ref(db, 'status/' + id));
                    const statusData = statusSnap.val() || { online: false };

                    resolvedChats.push({
                        id,
                        ...userData,
                        ...chatsData[id],
                        online: statusData.online
                    });
                } catch (err) {
                    console.warn(`Error loading chat member ${id}:`, err);
                    resolvedChats.push({
                        id,
                        name: 'Unknown User',
                        ...chatsData[id],
                        online: false
                    });
                }
            }

            allLoadedChats = resolvedChats.sort((a, b) => (b.time || 0) - (a.time || 0));
            console.log("Rendering", allLoadedChats.length, "chats");
            renderChats(allLoadedChats);
        } catch (error) {
            console.error("Critical error in loadChats processing:", error);
            chatListContainer.innerHTML = '<div class="p-8 text-center text-red-400">Error processing your chats.</div>';
        }
    }, (error) => {
        clearTimeout(timeoutMsg);
        console.error("Firebase Database listener failed:", error);
        let msg = "Connection error.";
        if (error.code === 'PERMISSION_DENIED') msg = "Access denied (Auth required).";
        chatListContainer.innerHTML = `<div class="p-8 text-center text-red-500">${msg}</div>`;
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

userSearchInput.addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    if (q.length < 1) {
        renderChats(allLoadedChats);
        return;
    }

    const usersRef = ref(db, 'users');
    const userQuery = query(usersRef, orderByChild('username'), startAt(q), endAt(q + '\uf8ff'));
    
    const snapshot = await get(userQuery);
    const users = [];
    snapshot.forEach(child => {
        if (child.key !== currentUser.id) {
            users.push({ id: child.key, ...child.val() });
        }
    });
    renderSearchResults(users);
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
