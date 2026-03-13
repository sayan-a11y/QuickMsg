// socket is now initialized in api.js
const chatListContainer = document.getElementById('chat-list');
const userSearchInput = document.getElementById('user-search');
const menuBtn = document.getElementById('menu-btn');
const dotMenu = document.getElementById('dot-menu');
const currentUser = User.get();
let allLoadedChats = []; // To store all chats for filtering

const tabs = document.querySelectorAll('.bg-white.flex button');

if (!currentUser) window.location.href = '/index.html';

// Tab switching UI
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('tab-active', 'text-blue-600'));
        tab.classList.add('tab-active', 'text-blue-600');

        // Filter logic placeholder (Groups, Archived etc)
        if (tab.innerText === 'Chats') loadChats();
        else chatListContainer.innerHTML = `<div class="p-8 text-center text-gray-400">No ${tab.innerText.toLowerCase()} items.</div>`;
    });
});


// Register user for real-time
// Socket registration is now handled globally in api.js

async function loadChats() {
    const data = await API.get('/api/chats');
    allLoadedChats = data.chats || [];
    renderChats(allLoadedChats);
    API.post('/api/delivered', {});
    loadUnread();
}

async function loadUnread() {
    try {
        const data = await API.get('/api/unread');
        if (data.unread) {
            data.unread.forEach(row => {
                const badge = document.getElementById(`badge-${row.sender_id}`);
                if (badge) {
                    badge.innerText = row.total;
                    badge.classList.remove('hidden');
                }
            });
        }
    } catch (err) {
        console.error("Load unread error:", err);
    }
}

function renderChats(chats) {
    if (chats.length === 0) {
        chatListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No chats yet. Start a new one!</div>';
        return;
    }

    const cacheBuster = `?t=${Date.now()}`;
    chatListContainer.innerHTML = chats.map(chat => `
        <div class="p-4 flex items-center space-x-4 hover:bg-gray-100 cursor-pointer transition-colors" onclick="openChat('${chat.id}', '${chat.name}')">
            <div class="relative flex-shrink-0" onclick="event.stopPropagation(); window.location.href='profile-view.html?id=${chat.id}'">
                ${chat.avatar
            ? `<img src="${chat.avatar}${cacheBuster}" class="w-14 h-14 rounded-full object-cover shadow-sm" alt="avatar">`
            : `<div class="w-14 h-14 wa-bg-green text-white rounded-full flex items-center justify-center font-bold text-xl uppercase shadow-sm">${chat.name[0]}</div>`
        }
                <div id="status-${chat.id}" class="absolute bottom-0 right-0 w-3.5 h-3.5 ${chat.online ? 'bg-green-500' : 'hidden'} border-2 border-white rounded-full"></div>
            </div>
            <div class="flex-1 overflow-hidden">
                <div class="flex justify-between items-center">
                    <h3 class="font-bold text-gray-800 truncate">${chat.name}</h3>
                    <span class="text-xs text-gray-400">${utils.formatTime(chat.lastMessageTime)}</span>
                </div>
                <div class="flex justify-between items-center mt-1">
                    <div class="flex items-center gap-1 overflow-hidden flex-1">
                        ${chat.lastMessageSender === currentUser.id ? `
                            ${chat.lastMessageSeen === 2 ? '<i class="fas fa-check-double text-blue-500 text-[10px]"></i>' :
                (chat.lastMessageSeen === 1 ? '<i class="fas fa-check-double text-gray-400 text-[10px]"></i>' :
                    '<i class="fas fa-check text-gray-400 text-[10px]"></i>')}
                        ` : ''}
                        <p class="text-sm text-gray-500 truncate">${chat.lastMessage}</p>
                    </div>
                    <!-- Unread Badge -->
                    <span id="badge-${chat.id}" class="${chat.unreadCount > 0 ? 'flex' : 'hidden'} bg-[#25D366] text-white text-[10px] min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full font-bold transition-all">
                        ${chat.unreadCount}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

function openChat(userId, name) {
    window.location.href = `chat.html?id=${userId}&name=${encodeURIComponent(name)}`;
}

// Search Listener - Filters existing chats first
userSearchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim().toLowerCase();

    if (query.length === 0) {
        renderChats(allLoadedChats);
        return;
    }

    // 1. Filter local chats
    const filteredLocal = allLoadedChats.filter(chat =>
        chat.name.toLowerCase().includes(query) ||
        chat.lastMessage.toLowerCase().includes(query)
    );

    if (filteredLocal.length > 0) {
        renderChats(filteredLocal);
    } else {
        // 2. If no local chats match, search for new users
        const data = await API.get(`/api/search?query=${query}`);
        renderSearchResults(data.users || []);
    }
});

function renderSearchResults(users) {
    if (users.length === 0) {
        chatListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No users found.</div>';
        return;
    }

    const cacheBuster = `?t=${Date.now()}`;
    chatListContainer.innerHTML = users.map(user => `
        <div class="p-4 flex items-center space-x-4 hover:bg-blue-50 cursor-pointer border-b border-gray-100" onclick="openChat('${user.id}', '${user.name}')">
            <div class="relative flex-shrink-0" onclick="event.stopPropagation(); window.location.href='profile-view.html?id=${user.id}'">
                ${user.avatar
            ? `<img src="${user.avatar}${cacheBuster}" class="w-12 h-12 rounded-full object-cover shadow-lg shadow-blue-100" alt="avatar">`
            : `<div class="w-12 h-12 wa-bg-green text-white rounded-full flex items-center justify-center font-bold text-lg uppercase shadow-lg shadow-blue-100">${user.name[0]}</div>`
        }
            </div>
            <div class="flex-1">
                <h3 class="font-bold text-gray-800">${user.name}</h3>
                <p class="text-sm text-gray-400">@${user.username}</p>
            </div>
        </div>
    `).join('');
}

// Toggle Dot Menu
if (menuBtn && dotMenu) {
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        dotMenu.classList.toggle('hidden');
    };

    document.addEventListener('click', (e) => {
        if (!dotMenu.contains(e.target) && e.target !== menuBtn) {
            dotMenu.classList.add('hidden');
        }
    });
}

// Dark Mode Handling (Global)
function applyTheme() {
    const isDark = localStorage.getItem('dark-mode') === 'true';
    if (isDark) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
}

applyTheme();
loadChats();

// WebSocket Listeners
socket.on('receive_message', (message) => {
    console.log("Real-time message received on Home:", message);
    loadChats();
});

socket.on('newMessage', (data) => {
    console.log("New message notification for badge update:", data);
    loadUnread();
});

socket.on('user_status', (data) => {
    console.log("User status change received:", data);
    const statusDot = document.getElementById(`status-${data.userId}`);
    if (statusDot) {
        if (data.status === 'online') {
            statusDot.classList.remove('hidden');
            statusDot.classList.add('bg-green-500');
        } else {
            statusDot.classList.add('hidden');
        }
    }
});

socket.on('messages_seen_self', (data) => {
    console.log("Messages seen on another tab:", data);
    const badge = document.getElementById(`badge-${data.contactId}`);
    if (badge) badge.classList.add('hidden');
});

socket.on('profileUpdate', (data) => {
    console.log("Profile update received:", data);
    // Reload chats to refresh UI with correct data
    // Alternatively, find specifically the element to update. reloading is safer.
    loadChats();
});
