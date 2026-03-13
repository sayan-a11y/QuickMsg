import { db, ref, onValue, get, push, set, update, remove, serverTimestamp, auth, onAuthStateChanged, query, limitToLast } from './firebase-config.js';
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
console.log("Setting up Auth listener on Chat...");
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Auth resolved: User is logged in", user.uid);
        // Use authenticated UID as source of truth
        const localUser = User.get() || {};
        currentUser = { ...localUser, id: user.uid };
        if (!contactId) {
            console.warn("No contact ID provided, going home");
            window.location.href = './home.html';
            return;
        }
        currentChatId = currentUser.id < contactId ? `${currentUser.id}_${contactId}` : `${contactId}_${currentUser.id}`;
        headerName.innerText = contactName || 'User';
        initChat();
    } else {
        console.log("Auth resolved: No user, going to login");
        window.location.href = './index.html';
    }
});

// Initialize chat
function initChat() {
    if (!currentChatId) return;

    // Performance: Use Limited Query (limitToLast)
    // Avoid loading the entire message history which causes slowness
    const dbQuery = query(ref(db, `messages/${currentChatId}`), limitToLast(MESSAGE_LIMIT));

    onValue(dbQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const messages = Object.values(data).sort((a, b) => (a.time || 0) - (b.time || 0));
            
            // Optimization: Only re-render if data actually changed
            const latestTs = messages[messages.length - 1]?.time || 0;
            if (latestTs === lastMessageTimestamp) return;
            lastMessageTimestamp = latestTs;

            renderMessages(messages);
            scrollToBottom();
            
            // Mark as seen (Batch update if possible)
            messages.forEach(msg => {
                if (msg.receiverId === currentUser.id && !msg.seen) {
                    update(ref(db, `messages/${currentChatId}/${msg.id}`), { seen: true });
                }
            });
        } else {
            messagesContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No messages yet.</div>';
        }
    });

    // Performance: Use 'once' for profile data to reduce listeners
    get(ref(db, `users/${contactId}`)).then((snapshot) => {
        const user = snapshot.val();
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

        return `
            <div class="flex flex-col ${isSent ? 'items-end' : 'items-start'} mb-2 group" id="msg-${msg.id}" 
                 oncontextmenu="event.preventDefault(); window.showMsgMenu('${msg.id}', '${(msg.text || '').replace(/'/g, "\\'")}', ${isSent})">
                <div class="max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm relative ${isSent ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}">
                    ${msg.replyTo ? `<div class="bg-black/10 p-2 rounded mb-1 text-[11px] opacity-70 border-l-2 border-blue-400">Replying to a message</div>` : ''}
                    ${msg.file ? renderFile(msg) : ''}
                    <div class="flex items-end gap-2">
                        <p class="text-[15px] whitespace-pre-wrap break-words">${msg.text || ''}</p>
                        <div class="flex items-center text-[10px] opacity-70">
                            ${msg.edited ? '<span class="mr-1 italic">edited</span>' : ''}
                            ${utils.formatTime(msg.time)}
                            ${ticks}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderFile(msg) {
    const type = msg.fileType || '';
    if (type.startsWith('image/')) {
        return `<img src="${msg.file}" class="max-w-full rounded-lg mb-1 cursor-pointer" onclick="window.open('${msg.file}')">`;
    } else if (type.startsWith('video/')) {
        return `<video src="${msg.file}" controls class="max-w-full rounded-lg mb-1"></video>`;
    }
    return `<a href="${msg.file}" target="_blank" class="block p-2 bg-black/10 rounded mb-1 text-xs truncate">📎 File</a>`;
}

window.showMsgMenu = (id, text, isSent) => {
    editingMsgId = id;
    const choice = confirm(isSent ? "Edit or Delete this message?" : "Reply to this message?");
    if (!choice) return;

    if (isSent) {
        const action = prompt("Type 'e' to Edit, 'd' to Delete (for everyone)");
        if (action === 'e') {
            isEditing = true;
            messageInput.value = text;
            showActionPreview('Editing', text);
            messageInput.focus();
        } else if (action === 'd') {
            update(ref(db, `messages/${currentChatId}/${id}`), { deleted: true });
        }
    } else {
        replyToId = id;
        showActionPreview('Replying', text);
        messageInput.focus();
    }
};

function showActionPreview(title, text) {
    previewTitle.innerText = title;
    previewText.innerText = text;
    actionPreview.classList.remove('hidden');
}

window.cancelAction = () => {
    isEditing = false;
    replyToId = null;
    editingMsgId = null;
    messageInput.value = '';
    actionPreview.classList.add('hidden');
};

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !fileInput.files[0]) return;

    const file = fileInput.files[0];
    let fileUrl = null;
    let fileType = null;

    if (file) {
        messageInput.placeholder = "Uploading...";
        fileUrl = await API.uploadFile(file, 'chats/' + currentChatId);
        fileType = file.type;
        fileInput.value = '';
        messageInput.placeholder = "Type a message...";
    }

    if (isEditing) {
        await update(ref(db, `messages/${currentChatId}/${editingMsgId}`), { text, edited: true });
        cancelAction();
        return;
    }

    const msgRef = push(ref(db, `messages/${currentChatId}`));
    const msgId = msgRef.key;

    const msgData = {
        id: msgId,
        senderId: currentUser.id,
        receiverId: contactId,
        text: text,
        time: serverTimestamp(),
        seen: false,
        deleted: false
    };

    if (fileUrl) {
        msgData.file = fileUrl;
        msgData.fileType = fileType;
    }

    if (replyToId) {
        msgData.replyTo = replyToId;
    }

    await set(msgRef, msgData);
    cancelAction();

    // Update summaries
    const commonUpdate = { lastMessage: text || (fileUrl ? 'Media' : ''), time: serverTimestamp() };
    update(ref(db, `chats/${currentUser.id}/${contactId}`), { ...commonUpdate, unread: 0 });
    
    const receiverChatRef = ref(db, `chats/${contactId}/${currentUser.id}`);
    const rxSnap = await get(receiverChatRef);
    const currentUnread = (rxSnap.val()?.unread || 0);
    update(receiverChatRef, { ...commonUpdate, unread: currentUnread + 1 });
}

attachBtn.onclick = () => fileInput.click();
fileInput.onchange = () => {
    if (fileInput.files[0]) {
        showActionPreview('Attachment', fileInput.files[0].name);
    }
};

function updateHeaderStatus(isOnline, lastSeen) {
    if (isOnline) {
        headerStatus.innerText = 'Online';
        headerStatus.className = 'text-[10px] text-blue-500 font-semibold uppercase mt-0.5';
    } else {
        headerStatus.innerText = lastSeen ? 'Last seen ' + utils.formatLastSeen(lastSeen) : 'Offline';
        headerStatus.className = 'text-[10px] text-gray-400 font-semibold uppercase mt-0.5';
    }
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

sendBtn.onclick = sendMessage;

let typingTimeout;
messageInput.oninput = () => {
    // Notify receiver that I am typing
    set(ref(db, `typing/${contactId}/${currentUser.id}`), true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        set(ref(db, `typing/${contactId}/${currentUser.id}`), false);
    }, 2000);
};

// initChat is called inside onAuthStateChanged
