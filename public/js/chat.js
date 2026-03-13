// socket is now initialized in api.js
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages-container');
const headerName = document.getElementById('header-name');
const headerAvatar = document.getElementById('header-avatar');
const typingIndicator = document.getElementById('typing-indicator');
const headerStatus = document.getElementById('header-status');
const actionPreview = document.getElementById('action-preview');
const previewTitle = document.getElementById('preview-title');
const previewText = document.getElementById('preview-text');
const currentUser = User.get();

// WhatsApp Style Elements
const deletePopup = document.getElementById('deletePopup');
const delAll = document.getElementById('delAll');
const delMe = document.getElementById('delMe');
const cancelDel = document.getElementById('cancelDel');

let pressTimer;
let selectedMsgId = null;
let selectedMsgText = "";
let isMsgSentCurrent = false;
let isMoving = false;
let replyToId = null;
let isEditing = false;
let typingTimeout;

const urlParams = new URLSearchParams(window.location.search);
const contactId = urlParams.get('id');
const contactName = urlParams.get('name');
let lastSeenData = null;
let isOnlineData = 0;

if (!contactId || !currentUser) window.location.href = '/home.html';

headerName.innerText = contactName || 'User';
headerAvatar.innerText = (contactName || 'U')[0].toUpperCase();
headerAvatar.parentElement.onclick = () => window.location.href = `profile-view.html?id=${contactId}`;

// Fetch user detail for avatar
async function loadUserDetails() {
    try {
        const res = await API.get(`/api/user/${contactId}`);
        if (res.user && res.user.avatar) {
            const cacheBuster = `?t=${Date.now()}`;
            headerAvatar.innerHTML = `<img src="${res.user.avatar}${cacheBuster}" class="w-full h-full rounded-full object-cover">`;
            headerAvatar.classList.remove('p-2'); // remove padding if any to fit image
        }
        updateHeaderStatus(res.user.online, res.user.last_seen);
    } catch (e) {
        console.error("Failed to load user details", e);
    }
}
loadUserDetails();

// Socket registration is now handled globally in api.js

// Initial mark as delivered
API.post('/api/delivered', {});

async function loadMessages(skipSeen = false) {
    try {
        if (!skipSeen) {
            API.post('/api/seen', { contactId }).catch(e => console.error("Seen error:", e));
            socket.emit('seen_all', { to: contactId, from: currentUser.id });
        }

        const data = await API.get(`/api/messages?contactId=${contactId}`);
        if (data && data.messages) {
            renderMessages(data.messages);
            scrollToBottom();
        }
    } catch (err) {
        console.error("Load messages error:", err);
    }
}

function renderMessages(messages) {
    messagesContainer.innerHTML = messages.map(msg => {
        const isSent = msg.sender_id === currentUser.id;
        const isDeleted = msg.deleted === 1;
        const isStarred = msg.starred === 1;
        const isEdited = msg.edited === 1;
        const isForwarded = msg.forwarded === 1;

        if (isDeleted) {
            return `
                <div class="flex ${isSent ? 'justify-end' : 'justify-start'} animate-slide-up" id="msg-${msg.id}">
                    <div class="max-w-[80%] rounded-2xl px-5 py-3 shadow-sm border border-gray-100 ${isSent ? 'bg-gray-50' : 'bg-white'}">
                        <p class="text-[13px] text-gray-400 italic">
                            <i class="fas fa-ban mr-1 opacity-50"></i> 
                            ${isSent ? 'You deleted this message' : 'This message was deleted'}
                        </p>
                    </div>
                </div>
            `;
        }

        // Ticks Logic
        let ticks = '';
        if (isSent) {
            if (msg.seen === 2) ticks = '<i class="fas fa-check-double text-blue-400 ml-1"></i>';
            else if (msg.seen === 1) ticks = '<i class="fas fa-check-double text-gray-400 ml-1"></i>';
            else ticks = '<i class="fas fa-check text-gray-400 ml-1"></i>';
        }

        const safeText = msg.text ? msg.text.replace(/'/g, "\\'").replace(/"/g, "&quot;") : "";

        let mediaHtml = '';
        if (msg.file) {
            if (msg.file_type && msg.file_type.startsWith('image/')) {
                mediaHtml = `<img src="${msg.file}" class="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity" onclick="window.open('${msg.file}', '_blank')">`;
            } else if (msg.file_type && msg.file_type.startsWith('video/')) {
                mediaHtml = `<video src="${msg.file}" controls class="max-w-full rounded-lg mb-2"></video>`;
            } else {
                mediaHtml = `
                    <a href="${msg.file}" target="_blank" class="flex items-center p-3 bg-black/5 rounded-lg mb-2 hover:bg-black/10 transition-colors">
                        <i class="fas fa-file-download text-2xl mr-3 text-blue-500"></i>
                        <span class="text-sm font-medium truncate">${msg.file.split('_').slice(1).join('_')}</span>
                    </a>
                `;
            }
        }

        return `
            <div id="msg-${msg.id}" class="flex flex-col ${isSent ? 'items-end' : 'items-start'} mb-2 group">
                <div class="flex ${isSent ? 'justify-end' : 'justify-start'} w-full animate-slide-up" 
                     onmousedown="startPress('${msg.id}', '${safeText}', ${isSent})" 
                     onmouseup="cancelPress()" 
                     onmousemove="handleMove()"
                     oncontextmenu="return false"
                     ontouchstart="startPress('${msg.id}', '${safeText}', ${isSent})"
                     ontouchmove="handleMove()"
                     ontouchend="cancelPress()">
                    
                    <div class="max-w-[85%] rounded-2xl px-4 py-2.5 shadow-md flex flex-col relative transition-transform active:scale-95 select-none ${isSent ? 'chat-bubble-right rounded-tr-none' : 'chat-bubble-left rounded-tl-none bg-white'}">
                        ${isForwarded ? `<p class="text-[10px] italic text-gray-400 mb-1"><i class="fas fa-share mr-1"></i> Forwarded</p>` : ''}
                        ${msg.reply_to ? `
                            <div class="bg-black/5 border-l-4 border-blue-500 rounded p-1.5 mb-2 overflow-hidden cursor-pointer" onclick="const el = document.getElementById('msg-${msg.reply_to}'); if(el) el.scrollIntoView({behavior:'smooth'})">
                                <p class="text-[10px] font-bold text-blue-600 truncate">${msg.reply_sender === currentUser.id ? 'You' : contactName}</p>
                                <p class="text-[11px] text-gray-500 truncate">${msg.reply_text || 'Message'}</p>
                            </div>
                        ` : ''}
                        
                        ${mediaHtml}

                        <div class="flex items-end gap-2">
                            ${msg.text ? `<p class="text-[15px] leading-relaxed break-words">${msg.text}</p>` : ''}
                            <div class="flex items-center self-end pb-0.5">
                                ${isStarred ? '<i class="fas fa-star text-[9px] text-amber-500 mr-1"></i>' : ''}
                                ${isEdited ? '<p class="text-[9px] text-gray-400 italic mr-1">edited</p>' : ''}
                                <p class="text-[10px] ${isSent ? 'text-blue-100' : 'text-gray-400'} font-medium">
                                    ${utils.formatTime(msg.time)}
                                </p>
                                ${ticks}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.startPress = function (id, text, isSent) {
    selectedMsgId = id;
    selectedMsgText = text;
    isMsgSentCurrent = isSent;
    isMoving = false;
    clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => openPopup(id), 500);
};

window.cancelPress = function () {
    clearTimeout(pressTimer);
};

window.handleMove = function () {
    isMoving = true;
    clearTimeout(pressTimer);
};

function openPopup(id) {
    if (isMoving) return;
    // Highlight removed
    deletePopup.classList.remove("hidden");

    // show 'delete for everyone' only if sender
    if (isMsgSentCurrent) {
        delAll.style.display = "block";
    } else {
        delAll.style.display = "none";
    }
}

cancelDel.onclick = () => {
    deletePopup.classList.add("hidden");
    selectedMsgId = null;
};

delAll.onclick = async () => {
    const res = await API.post('/api/delete-everyone', { id: selectedMsgId });
    if (res.message) {
        socket.emit('deleteMessage', { to: contactId, messageId: selectedMsgId });
        loadMessages();
    }
    deletePopup.classList.add('hidden');
};

delMe.onclick = async () => {
    const res = await API.post('/api/delete-me', { id: selectedMsgId });
    if (res.message) loadMessages();
    deletePopup.classList.add('hidden');
};

// Toggle More Options Menu
const moreOptionsBtnEl = document.getElementById('more-options-btn');
const moreOptionsMenuEl = document.getElementById('more-options-menu');

moreOptionsBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    moreOptionsMenuEl.classList.toggle('hidden');
});

window.handleMoreAction = async (action) => {
    moreOptionsMenuEl.classList.add('hidden');
    if (action === 'clear') {
        if (confirm("Are you sure you want to clear all messages in this chat?")) {
            await API.post('/api/clear-chat', { contactId });
            loadMessages();
        }
    }
};

document.addEventListener('click', (e) => {
    if (!moreOptionsMenuEl.contains(e.target) && e.target !== moreOptionsBtnEl) {
        moreOptionsMenuEl.classList.add('hidden');
    }
});

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage(fileData = null) {
    const text = messageInput.value.trim();
    if (!text && !fileData) return;

    if (isEditing) {
        const res = await API.post('/api/edit', { messageId: replyToId, text });
        if (res.message) {
            socket.emit('edit_message', { to: contactId, messageId: replyToId, text });
            cancelAction();
            loadMessages(true);
        }
        return;
    }

    messageInput.value = '';
    const payload = {
        receiverId: contactId,
        text,
        replyTo: replyToId
    };

    if (fileData) {
        payload.file = fileData.file;
        payload.fileType = fileData.fileType;
    }

    const res = await API.post('/api/send', payload);
    if (res.message) {
        socket.emit('send_message', { to: contactId, from: currentUser.id, message: res.message });
        cancelAction();
        loadMessages(true);
        socket.emit('stop_typing', { to: contactId, from: currentUser.id });
    }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

messageInput.addEventListener('input', () => {
    socket.emit('typing', { to: contactId, from: currentUser.id });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop_typing', { to: contactId, from: currentUser.id });
    }, 2000);
});

socket.on('receive_message', (message) => {
    if (message.sender_id === contactId) {
        API.post('/api/seen', { contactId });
        socket.emit('seen_all', { to: contactId, from: currentUser.id });
        loadMessages();
        if (document.hidden && typeof window.showNotification === 'function') {
            window.showNotification(contactName, message.text, window.location.href);
        }
    } else {
        API.post('/api/delivered', {});
        socket.emit('delivered_update', { to: message.sender_id, from: currentUser.id });
        if (typeof window.showNotification === 'function') {
            window.showNotification("New Message", message.text, `/chat.html?id=${message.sender_id}`);
        }
    }
});

socket.on('deleteMessage', () => loadMessages());
socket.on('message_edited', (data) => loadMessages());
socket.on('messages_seen', (data) => data.from === contactId && loadMessages());
socket.on('messages_delivered', (data) => data.from === contactId && loadMessages());

socket.on('user_typing', (data) => {
    if (data.from === contactId) {
        typingIndicator.classList.remove('hidden');
        headerStatus.classList.add('hidden');
    }
});

socket.on('user_stop_typing', (data) => {
    if (data.from === contactId) {
        typingIndicator.classList.add('hidden');
        headerStatus.classList.remove('hidden');
    }
});

socket.on('user_status', (data) => {
    console.log("Chat Page: Received user_status update:", data);
    if (data.userId === contactId) {
        updateHeaderStatus(data.status === 'online' ? 1 : 0, data.last_seen);
    }
});

socket.on('profileUpdate', (data) => {
    if (data.userId === contactId) {
        console.log("Chat Page: Peer profile update received:", data);
        if (data.field === 'avatar') {
            const cacheBuster = `?t=${Date.now()}`;
            const avatarUrl = data.value.includes('/') ? data.value : "/uploads/" + data.value;
            headerAvatar.innerHTML = `<img src="${avatarUrl}${cacheBuster}" class="w-full h-full rounded-full object-cover">`;
        } else if (data.field === 'name') {
            headerName.innerText = data.value;
        }
    }
});

function updateHeaderStatus(isOnline, lastSeen) {
    isOnlineData = isOnline;
    lastSeenData = lastSeen;

    if (isOnline) {
        headerStatus.innerText = 'Online';
        headerStatus.classList.remove('text-gray-500');
        headerStatus.classList.add('text-blue-500');
    } else {
        if (lastSeen) {
            headerStatus.innerText = 'Last seen ' + utils.formatLastSeen(lastSeen);
        } else {
            headerStatus.innerText = 'Offline';
        }
        headerStatus.classList.remove('text-blue-500');
        headerStatus.classList.add('text-gray-500');
    }
}

// Refresh status every 30 seconds for real-time relative time (e.g., 2m ago)
setInterval(() => {
    if (!isOnlineData && lastSeenData) {
        updateHeaderStatus(isOnlineData, lastSeenData);
    }
}, 30000);

const typingSound = new Audio('/typing.mp3');
const ringtoneSound = new Audio('/ring.mp3');
// Make sure sounds don't block
ringtoneSound.loop = true;

loadMessages();

function startCall(type) {
    window.location.href = `call.html?id=${contactId}&type=${type}`;
}


window.cancelAction = () => {
    actionPreview.classList.add('hidden');
    replyToId = null;
    isEditing = false;
    messageInput.value = "";
};

// Emoji Logic
const emojiBtn = document.getElementById('emojiBtn');
const emojiBox = document.getElementById('emojiBox');

if (emojiBtn && emojiBox) {
    emojiBtn.onclick = () => {
        emojiBox.classList.toggle('hidden');
    };

    const emojis = emojiBox.querySelectorAll('span');
    emojis.forEach(e => {
        e.onclick = () => {
            messageInput.value += e.innerText;
            messageInput.focus();
        };
    });

    // Close emoji box when clicking outside
    document.addEventListener('click', (e) => {
        if (!emojiBtn.contains(e.target) && !emojiBox.contains(e.target)) {
            emojiBox.classList.add('hidden');
        }
    });
}

// Attachment Logic
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');

if (attachBtn && fileInput) {
    attachBtn.onclick = () => fileInput.click();

    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        attachBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        attachBtn.disabled = true;

        try {
            const res = await API.post('/api/upload', formData, true);
            if (res.file) {
                sendMessage({ file: res.file, fileType: file.type });
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("File upload failed!");
        } finally {
            attachBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
            attachBtn.disabled = false;
            fileInput.value = '';
        }
    };
}
