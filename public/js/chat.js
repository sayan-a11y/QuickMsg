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
const MESSAGE_LIMIT = 30; // Load only last 30 messages initially
let lastMessageTimestamp = 0;

let currentUser = User.get();
const urlParams = new URLSearchParams(window.location.search);
const contactId = urlParams.get('id');
const contactName = urlParams.get('name');

let isEditing = false;
let editingMsgId = null;
let replyToId = null;
let currentChatId = null;

// Wait for Auth
onAuthStateChanged(auth, (user) => {
    if (user) {
        const localUser = User.get() || {};
        currentUser = { ...localUser, id: user.uid };
        if (!contactId) {
            window.location.href = './home.html';
            return;
        }
        currentChatId = currentUser.id < contactId ? `${currentUser.id}_${contactId}` : `${contactId}_${currentUser.id}`;
        headerName.innerText = contactName || 'User';
        initChat();
    } else {
        window.location.href = './index.html';
    }
});

function initChat() {
    if (!currentChatId) return;

    // Load message history with limit
    const dbQuery = query(ref(db, `messages/${currentChatId}`), limitToLast(MESSAGE_LIMIT));
    onValue(dbQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const messages = Object.values(data).sort((a, b) => {
                const timeDiff = (a.time || 0) - (b.time || 0);
                if (timeDiff !== 0) return timeDiff;
                return (a.id || "").localeCompare(b.id || "");
            });
            
            const latestTs = messages[messages.length - 1]?.time || 0;
            if (latestTs === lastMessageTimestamp && messages.length === messagesContainer.children.length) return;
            lastMessageTimestamp = latestTs;

            renderMessages(messages);
            scrollToBottom();
            
            // Mark as seen
            messages.forEach(msg => {
                if (msg.receiverId === currentUser.id && !msg.seen) {
                    update(ref(db, `messages/${currentChatId}/${msg.id}`), { seen: true });
                }
            });
        } else {
            messagesContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No messages yet.</div>';
        }
    });

    // Presence & Status
    onValue(ref(db, `typing/${currentUser.id}/${contactId}`), (snap) => {
        const isTyping = snap.val();
        typingIndicator.classList.toggle('hidden', !isTyping);
        headerStatus.classList.toggle('hidden', !!isTyping);
    });

    onValue(ref(db, `status/${contactId}`), (snap) => {
        const stat = snap.val() || { online: false };
        updateHeaderStatus(stat.online, stat.lastSeen);
    });

    // Profile Info
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
}

function renderMessages(messages) {
    messagesContainer.innerHTML = messages.map(msg => {
        const isSent = msg.senderId === currentUser.id;
        if (msg.deleted) {
            return `
                <div class="flex ${isSent ? 'justify-end' : 'justify-start'} mb-2">
                    <div class="max-w-[80%] rounded-2xl px-4 py-2 bg-gray-100 text-gray-400 italic text-xs">
                        <i class="fas fa-ban mr-1"></i> ${isSent ? 'You deleted this message' : 'This message was deleted'}
                    </div>
                </div>
            `;
        }

        let ticks = isSent ? (msg.seen ? '<i class="fas fa-check-double text-blue-400 ml-1"></i>' : '<i class="fas fa-check text-gray-400 ml-1"></i>') : '';
        let replyHtml = msg.replyTo ? `
            <div class="bg-black/5 rounded-lg p-2 mb-1 text-xs border-l-4 border-blue-500">
                <p class="opacity-60 truncate">${msg.replyTo.text}</p>
            </div>
        ` : '';

        return `
            <div class="flex ${isSent ? 'justify-end' : 'justify-start'} animate-fade-in group" id="msg-${msg.id}">
                <div class="max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm relative ${isSent ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}">
                    ${replyHtml}
                    ${msg.fileUrl ? (msg.fileType?.includes('image') ? `<img src="${msg.fileUrl}" class="rounded-lg mb-1 max-h-60 w-full object-cover">` : `<a href="${msg.fileUrl}" target="_blank" class="flex items-center p-2 bg-black/10 rounded mb-1"><i class="fas fa-file mr-2"></i> File</a>`) : ''}
                    <p class="text-[15px] leading-tight">${msg.text || ''}</p>
                    <div class="flex items-center justify-end space-x-1 mt-1 opacity-70 text-[10px]">
                        <span>${utils.formatTime(msg.time)}</span>
                        ${ticks}
                    </div>
                    
                    <button onclick="window.showMsgMenu('${msg.id}', '${(msg.text || '').replace(/'/g, "\\'")}', ${isSent})" class="absolute top-0 ${isSent ? '-left-8' : '-right-8'} p-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    ${!isSent ? `
                       <button onclick="window.setReply('${msg.id}', '${(msg.text || '').replace(/'/g, "\\'")}')" class="absolute top-8 ${isSent ? '-left-8' : '-right-8'} p-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                        <i class="fas fa-reply"></i>
                       </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('') + '<div class="h-4"></div>';
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !fileInput.files[0]) return;

    if (isEditing) {
        await update(ref(db, `messages/${currentChatId}/${editingMsgId}`), { 
            text, 
            edited: true,
            time: serverTimestamp() 
        });
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

    const msgId = push(ref(db, `messages/${currentChatId}`)).key;
    const msgData = {
        id: msgId,
        senderId: currentUser.id,
        receiverId: contactId,
        text,
        fileUrl,
        fileType,
        time: serverTimestamp(),
        seen: false
    };

    if (replyToId) {
        msgData.replyTo = { id: replyToId, text: previewText.innerText };
    }

    await set(ref(db, `messages/${currentChatId}/${msgId}`), msgData);
    messageInput.value = '';
    cancelAction();

    const commonUpdate = { lastMessage: text || (fileUrl ? 'Media' : ''), time: serverTimestamp() };
    update(ref(db, `chats/${currentUser.id}/${contactId}`), { ...commonUpdate, unread: 0 });
    update(ref(db, `chats/${contactId}/${currentUser.id}`), { ...commonUpdate, unread: increment(1) });
}

window.showMsgMenu = (id, text, isSent) => {
    const actions = [];
    if (isSent) {
        actions.push({ name: 'Edit', icon: 'fa-edit', action: () => setEdit(id, text) });
        actions.push({ name: 'Delete', icon: 'fa-trash', action: () => deleteMsg(id) });
    }
    actions.push({ name: 'Copy', icon: 'fa-copy', action: () => { navigator.clipboard.writeText(text); alert('Copied!'); } });
    
    // Simple custom menu or use a library. For now, let's keep it minimal for performance.
    const choice = prompt('Choose action: ' + actions.map(a => a.name).join(', '));
    const selected = actions.find(a => a.name.toLowerCase() === (choice || '').toLowerCase());
    if (selected) selected.action();
};

window.setReply = (id, text) => {
    replyToId = id;
    previewTitle.innerText = "Replying to";
    previewText.innerText = text;
    actionPreview.classList.remove('hidden');
    messageInput.focus();
};

function setEdit(id, text) {
    isEditing = true;
    editingMsgId = id;
    messageInput.value = text;
    previewTitle.innerText = "Editing message";
    previewText.innerText = text;
    actionPreview.classList.remove('hidden');
    messageInput.focus();
}

async function deleteMsg(id) {
    if (confirm('Delete message?')) {
        await update(ref(db, `messages/${currentChatId}/${id}`), { deleted: true });
    }
}

function cancelAction() {
    isEditing = false;
    editingMsgId = null;
    replyToId = null;
    actionPreview.classList.add('hidden');
}

window.cancelAction = cancelAction;

sendBtn.onclick = sendMessage;
messageInput.onkeypress = (e) => e.key === 'Enter' && sendMessage();

function updateHeaderStatus(online, lastSeen) {
    if (online) {
        headerStatus.innerHTML = '<span class="flex items-center"><span class="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span> Online</span>';
        headerStatus.classList.remove('text-gray-400');
        headerStatus.classList.add('text-green-500', 'font-medium');
    } else {
        headerStatus.innerText = lastSeen ? `Last seen ${utils.formatTime(lastSeen)}` : 'Offline';
        headerStatus.classList.remove('text-green-500', 'font-medium');
        headerStatus.classList.add('text-gray-400');
    }
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

attachBtn.onclick = () => fileInput.click();
fileInput.onchange = () => {
    if (fileInput.files[0]) {
        previewTitle.innerText = "Attachment";
        previewText.innerText = fileInput.files[0].name;
        actionPreview.classList.remove('hidden');
    }
};

let typingTimeout;
messageInput.oninput = () => {
    set(ref(db, `typing/${contactId}/${currentUser.id}`), true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        set(ref(db, `typing/${contactId}/${currentUser.id}`), false);
    }, 2000);
};
