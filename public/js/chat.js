import { db, ref, onValue, get, push, set, update, remove, serverTimestamp, auth, onAuthStateChanged, query, limitToLast, increment } from './firebase-config.js';
import { User, API, utils } from './api.js';

const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages-container');
const headerName = document.getElementById('header-name');
const headerAvatar = document.getElementById('header-avatar');
const typingIndicator = document.getElementById('typing-indicator');
const headerStatus = document.getElementById('header-status');
const fileInput = document.getElementById('fileInput');
const attachBtn = document.getElementById('attachBtn');
const actionPreview = document.getElementById('action-preview');
const previewTitle = document.getElementById('preview-title');
const previewText = document.getElementById('preview-text');

// Performance settings
const MESSAGE_LIMIT = 40; 
let lastMessageTimestamp = 0;
let currentUser = User.get();
let currentChatId = null;

const urlParams = new URLSearchParams(window.location.search);
const contactId = urlParams.get('id');
const contactName = urlParams.get('name');

let isEditing = false;
let editingMsgId = null;
let replyToId = null;

// Wait for Auth
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = { ...(User.get() || {}), id: user.uid };
        if (!contactId) {
            window.location.href = './home.html';
            return;
        }
        // Unique Chat ID for 1-to-1 chats
        currentChatId = currentUser.id < contactId ? `${currentUser.id}_${contactId}` : `${contactId}_${currentUser.id}`;
        headerName.innerText = contactName || 'User';
        initChat();
    } else {
        window.location.href = './index.html';
    }
});

function initChat() {
    if (!currentChatId) return;

    // Load Message history (Realtime listener)
    const dbQuery = query(ref(db, `messages/${currentChatId}`), limitToLast(MESSAGE_LIMIT));
    onValue(dbQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const messages = Object.values(data).sort((a, b) => {
                const diff = (a.time || 0) - (b.time || 0);
                if (diff !== 0) return diff;
                return (a.id || "").localeCompare(b.id || "");
            });
            
            const latestTs = messages[messages.length - 1]?.time || 0;
            const currentCount = messagesContainer.querySelectorAll('.animate-fade-in').length;
            
            // Skip re-render if nothing new
            if (latestTs === lastMessageTimestamp && messages.length === currentCount) return;
            lastMessageTimestamp = latestTs;

            renderMessages(messages);
            scrollToBottom();
            
            // Unread messages logic
            messages.forEach(msg => {
                if (msg.receiverId === currentUser.id && !msg.seen) {
                    update(ref(db, `messages/${currentChatId}/${msg.id}`), { seen: true });
                }
            });
        } else {
            messagesContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No messages yet.</div>';
        }
    }, (err) => {
        console.error("Firebase Read Error:", err);
        messagesContainer.innerHTML = '<div class="p-8 text-center text-red-500">Error loading messages.</div>';
    });

    // Profile & Presence
    get(ref(db, `users/${contactId}`)).then((snap) => {
        const user = snap.val();
        if (user) {
            if (user.avatar && user.avatar !== 'default.png') {
                 headerAvatar.innerHTML = `<img src="${user.avatar}" class="w-full h-full rounded-full object-cover">`;
            } else {
                 headerAvatar.innerText = (user.name || user.username || 'U')[0].toUpperCase();
            }
        }
    });

    onValue(ref(db, `typing/${currentUser.id}/${contactId}`), (snap) => {
        const isTyping = snap.val();
        typingIndicator.classList.toggle('hidden', !isTyping);
        headerStatus.classList.toggle('hidden', !!isTyping);
    });

    onValue(ref(db, `status/${contactId}`), (snap) => {
        const stat = snap.val() || { online: false };
        updateHeaderStatus(stat.online, stat.lastSeen);
    });
}

function renderMessages(messages) {
    if (!messages.length) return;
    
    messagesContainer.innerHTML = messages.map(msg => {
        const isSent = msg.senderId === currentUser.id;
        
        if (msg.deleted) {
            return `
                <div class="flex ${isSent ? 'justify-end' : 'justify-start'} mb-2">
                    <div class="max-w-[80%] rounded-2xl px-4 py-2 bg-gray-100 text-gray-400 italic text-xs">
                        <i class="fas fa-ban mr-1"></i> Deleted
                    </div>
                </div>`;
        }

        const ticks = isSent ? (msg.seen ? '<i class="fas fa-check-double text-blue-400 ml-1"></i>' : '<i class="fas fa-check text-gray-400 ml-1"></i>') : '';
        const replyHtml = msg.replyTo ? `
            <div class="bg-black/5 rounded-lg p-2 mb-1 text-xs border-l-4 border-blue-500">
                <p class="opacity-60 truncate">${msg.replyTo.text}</p>
            </div>` : '';

        const mediaHtml = msg.fileUrl ? (msg.fileType?.includes('image') 
            ? `<img src="${msg.fileUrl}" class="rounded-lg mb-1 max-h-60 w-full object-cover cursor-pointer" onclick="window.open('${msg.fileUrl}')">` 
            : `<a href="${msg.fileUrl}" target="_blank" class="flex items-center p-2 bg-black/10 rounded mb-1 text-xs"><i class="fas fa-file mr-2 text-lg"></i> Attachment</a>`) : '';

        return `
            <div class="flex ${isSent ? 'justify-end' : 'justify-start'} animate-fade-in group mb-2" id="msg-${msg.id}">
                <div class="max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm relative ${isSent ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}">
                    ${replyHtml}
                    ${mediaHtml}
                    <p class="text-[15px] leading-tight break-words">${msg.text || ''}</p>
                    <div class="flex items-center justify-end space-x-1 mt-1 opacity-70 text-[10px]">
                        <span>${utils.formatTime(msg.time)}</span>
                        ${ticks}
                    </div>
                </div>
            </div>`;
    }).join('') + '<div class="h-4"></div>';
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !fileInput.files[0]) return;

    if (isEditing) {
        await update(ref(db, `messages/${currentChatId}/${editingMsgId}`), { text, edited: true });
        cancelAction();
        messageInput.value = '';
        return;
    }

    let fileUrl = null;
    let fileType = null;
    if (fileInput.files[0]) {
        const file = fileInput.files[0];
        const res = await API.uploadFile(file);
        fileUrl = res.url;
        fileType = file.type;
        fileInput.value = '';
    }

    const msgRef = push(ref(db, `messages/${currentChatId}`));
    const msgData = {
        id: msgRef.key,
        senderId: currentUser.id,
        receiverId: contactId,
        text,
        fileUrl,
        fileType,
        time: serverTimestamp(),
        seen: false
    };

    if (replyToId) msgData.replyTo = { id: replyToId, text: previewText.innerText };

    await set(msgRef, msgData);
    messageInput.value = '';
    cancelAction();

    // Summary Update
    const summary = { lastMessage: text || (fileUrl ? 'Media' : ''), time: serverTimestamp() };
    update(ref(db, `chats/${currentUser.id}/${contactId}`), { ...summary, unread: 0 });
    update(ref(db, `chats/${contactId}/${currentUser.id}`), { ...summary, unread: increment(1) });
}

function updateHeaderStatus(online, lastSeen) {
    if (online) {
        headerStatus.innerHTML = '<span class="flex items-center text-green-500 font-medium"><span class="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span> Online</span>';
    } else {
        headerStatus.innerText = lastSeen ? `Last seen ${utils.formatTime(lastSeen)}` : 'Offline';
        headerStatus.className = 'text-xs text-gray-400';
    }
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

sendBtn.onclick = sendMessage;
messageInput.onkeypress = (e) => e.key === 'Enter' && sendMessage();

attachBtn.onclick = () => fileInput.click();
fileInput.onchange = () => {
    if (fileInput.files[0]) {
        previewTitle.innerText = "Send File";
        previewText.innerText = fileInput.files[0].name;
        actionPreview.classList.remove('hidden');
    }
};

window.cancelAction = () => {
    isEditing = false;
    replyToId = null;
    actionPreview.classList.add('hidden');
};

// Typing indicator send
let typingTimeout;
messageInput.oninput = () => {
    set(ref(db, `typing/${contactId}/${currentUser.id}`), true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        set(ref(db, `typing/${contactId}/${currentUser.id}`), false);
    }, 2000);
};
