const statusListContainer = document.getElementById('status-list');
// socket is now initialized in api.js
const currentUser = User.get();

if (!currentUser) window.location.href = '/index.html';
socket.emit('register', currentUser.id);

// Elements
const viewer = document.getElementById('status-viewer');
const viewerImg = document.getElementById('viewer-img');
const viewerVid = document.getElementById('viewer-vid');
const viewerName = document.getElementById('viewer-name');
const viewerTime = document.getElementById('viewer-time');
const viewerAvatar = document.getElementById('viewer-avatar');
const viewerAvatarText = document.getElementById('viewer-avatar-text');
const progressBarContainer = document.getElementById('status-progress-bar');
const replyContainer = document.getElementById('reply-container');
const replyInput = document.getElementById('reply-input');
const viewerCountUI = document.getElementById('viewer-count');
const viewerCountText = document.getElementById('viewer-count-text');
const viewersSheet = document.getElementById('viewers-sheet');
const viewersList = document.getElementById('viewers-list');

let groupedStatuses = {};
let currentViewUser = null;
let currentStatusIndex = 0;
let progressTimeout = null;
let viewingMyStatus = false;

const viewerCaptionContainer = document.getElementById('viewer-caption-container');
const viewerCaptionText = document.getElementById('viewer-caption-text');

// My Avatar UI
const myAvatarImg = document.getElementById('my-avatar');
const myAvatarPlaceholder = document.getElementById('my-avatar-placeholder');
if (currentUser.avatar) {
    myAvatarImg.src = currentUser.avatar;
    myAvatarImg.classList.remove('hidden');
    myAvatarPlaceholder.classList.add('hidden');
} else {
    myAvatarPlaceholder.innerText = currentUser.name[0];
}

socket.on("statusUpdate", () => {
    loadStatuses();
});

socket.on("statusDeleted", () => {
    loadStatuses();
});

async function loadStatuses() {
    try {
        const res = await API.get('/api/status/' + currentUser.id);
        const statuses = res.statuses || [];

        // Group by user
        groupedStatuses = {};
        statuses.forEach(s => {
            if (!groupedStatuses[s.user_id]) {
                groupedStatuses[s.user_id] = {
                    user_id: s.user_id,
                    name: s.name,
                    avatar: s.avatar,
                    items: []
                };
            }
            groupedStatuses[s.user_id].items.push(s);
        });

        renderStatusList();
    } catch (e) {
        console.error("Fetch statuses error", e);
    }
}

function renderStatusList() {
    const others = Object.values(groupedStatuses).filter(u => u.user_id !== currentUser.id);

    if (others.length === 0) {
        statusListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No recent updates</div>';
    } else {
        statusListContainer.innerHTML = others.map(user => `
            <div class="p-4 flex items-center space-x-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100" onclick="openStatus('${user.user_id}')">
                <div class="relative flex-shrink-0">
                    <div class="w-14 h-14 rounded-full p-1 border-2 border-emerald-500 flex items-center justify-center">
                        ${user.avatar
                ? `<img src="${user.avatar}" class="w-full h-full rounded-full object-cover">`
                : `<div class="w-full h-full bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold uppercase text-xl">${user.name[0]}</div>`}
                    </div>
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-gray-800">${user.name}</h3>
                    <p class="text-[12px] font-medium text-gray-400">${utils.formatTime(user.items[user.items.length - 1].time)}</p>
                </div>
            </div>
        `).join('');
    }

    // Update "My Status" if I have one
    const myStatus = groupedStatuses[currentUser.id];
    const myBorder = document.querySelector('#my-avatar').parentElement;
    if (myStatus && myStatus.items.length > 0) {
        myBorder.classList.remove('border-gray-200');
        myBorder.classList.add('border-emerald-500');
        myBorder.onclick = (e) => {
            e.stopPropagation();
            openStatus(currentUser.id);
        };
    } else {
        myBorder.classList.add('border-gray-200');
        myBorder.classList.remove('border-emerald-500');
        myBorder.onclick = (e) => {
            e.stopPropagation();
            window.location.href = 'status-upload.html';
        };
    }
}

function openStatus(userId) {
    const userGrp = groupedStatuses[userId];
    if (!userGrp || userGrp.items.length === 0) return;

    currentViewUser = userGrp;
    currentStatusIndex = 0;
    viewingMyStatus = userId === currentUser.id;

    // UI Toggle
    viewer.classList.remove('hidden');
    viewer.classList.remove('animate-slide-down');

    if (userGrp.avatar) {
        viewerAvatar.src = userGrp.avatar;
        viewerAvatar.classList.remove('hidden');
        viewerAvatarText.classList.add('hidden');
    } else {
        viewerAvatar.classList.add('hidden');
        viewerAvatarText.classList.remove('hidden');
        viewerAvatarText.innerText = userGrp.name[0];
    }

    viewerName.innerText = viewingMyStatus ? "My Status" : userGrp.name;

    const deleteBtn = document.getElementById('delete-status-btn');
    if (viewingMyStatus) {
        replyContainer.classList.add('hidden');
        viewerCountUI.classList.remove('hidden');
        deleteBtn.classList.remove('hidden');
    } else {
        replyContainer.classList.remove('hidden');
        viewerCountUI.classList.add('hidden');
        deleteBtn.classList.add('hidden');
    }

    renderProgressBars();
    showCurrentStatus();
}

function renderProgressBars() {
    progressBarContainer.innerHTML = currentViewUser.items.map((_, i) => `
        <div class="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div id="prog-${i}" class="h-full bg-white w-0 transition-none"></div>
        </div>
    `).join('');
}

async function showCurrentStatus() {
    clearTimeout(progressTimeout);
    viewerVid.pause();
    viewerImg.classList.add('hidden');
    viewerVid.classList.add('hidden');

    // Fill previous bars completely
    for (let i = 0; i < currentStatusIndex; i++) {
        document.getElementById(`prog-${i}`).style.width = '100%';
        document.getElementById(`prog-${i}`).style.transition = 'none';
    }
    // Clear future bars
    for (let i = currentStatusIndex + 1; i < currentViewUser.items.length; i++) {
        document.getElementById(`prog-${i}`).style.width = '0%';
        document.getElementById(`prog-${i}`).style.transition = 'none';
    }

    const s = currentViewUser.items[currentStatusIndex];
    viewerTime.innerText = utils.formatTime(s.time);

    if (s.caption && s.caption.trim() !== '') {
        viewerCaptionText.innerText = s.caption;
        viewerCaptionContainer.classList.remove('hidden');
    } else {
        viewerCaptionContainer.classList.add('hidden');
        viewerCaptionText.innerText = '';
    }

    // Current bar animation handling
    const currentProg = document.getElementById(`prog-${currentStatusIndex}`);
    currentProg.style.width = '0%';
    currentProg.style.transition = 'none';

    // Force reflow
    void currentProg.offsetWidth;

    // Server Call to view (only if not me)
    if (!viewingMyStatus) {
        API.post('/api/status/view', { status_id: s.id });
    } else {
        loadViewers(s.id);
    }

    if (s.type === 'video') {
        viewerVid.src = s.file;
        viewerVid.classList.remove('hidden');
        viewerVid.onloadedmetadata = () => {
            const dur = viewerVid.duration * 1000;
            currentProg.style.transition = `width ${dur}ms linear`;
            currentProg.style.width = '100%';
            progressTimeout = setTimeout(() => nextStatus(), dur);
        };
        viewerVid.play();
    } else {
        viewerImg.src = s.file;
        viewerImg.classList.remove('hidden');
        currentProg.style.transition = `width 5000ms linear`;
        currentProg.style.width = '100%';
        progressTimeout = setTimeout(() => nextStatus(), 5000);
    }
}

function nextStatus() {
    if (currentStatusIndex < currentViewUser.items.length - 1) {
        currentStatusIndex++;
        showCurrentStatus();
    } else {
        closeStatus();
    }
}

function closeStatus() {
    clearTimeout(progressTimeout);
    viewerVid.pause();
    viewer.classList.add('animate-slide-down');
    setTimeout(() => {
        viewer.classList.add('hidden');
        viewersSheet.classList.add('translate-y-full');
    }, 300);
}

// Swipe / Click logic on viewer to pause or go next can be expanded. 
// For now, next status on full click (except reply bar)

async function loadViewers(statusId) {
    const res = await API.get(`/api/status/viewers/${statusId}`);
    const v = res.viewers || [];
    viewerCountText.innerText = v.length;

    if (v.length === 0) {
        viewersList.innerHTML = '<div class="p-8 text-center text-gray-400">No views yet</div>';
    } else {
        viewersList.innerHTML = v.map(usr => `
            <div class="p-4 flex items-center space-x-4 border-b border-gray-50">
                ${usr.avatar
                ? `<img src="${usr.avatar}" class="w-10 h-10 rounded-full object-cover">`
                : `<div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold uppercase">${usr.name[0]}</div>`}
                <h3 class="font-bold text-gray-800">${usr.name}</h3>
            </div>
        `).join('');
    }
}

function showViewers() {
    viewersSheet.classList.remove('hidden');
    // small reflow
    void viewersSheet.offsetWidth;
    viewersSheet.classList.remove('translate-y-full');
}

function closeViewers() {
    viewersSheet.classList.add('translate-y-full');
}

async function sendReply() {
    const txt = replyInput.value.trim();
    if (!txt) return;

    const s = currentViewUser.items[currentStatusIndex];
    await API.post('/api/status/reply', {
        status_id: s.id,
        message: txt,
        receiver_id: s.user_id,
        status_file: s.file
    });

    replyInput.value = '';
    closeStatus();
}

function toggleStatusMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('status-menu');
    menu.classList.toggle('hidden');
}

async function deleteCurrentStatus(e) {
    e.stopPropagation();
    const menu = document.getElementById('status-menu');
    menu.classList.add('hidden');

    if (!viewingMyStatus) return;

    const s = currentViewUser.items[currentStatusIndex];
    if (!s) return;

    try {
        await API.post('/api/status/delete', { statusId: s.id });
        socket.emit("statusDeleted");
        closeStatus();
        loadStatuses();
    } catch (err) {
        console.error("Delete status error", err);
        alert("Could not delete status");
    }
}

// Close menu when clicking outside
document.addEventListener('click', () => {
    const menu = document.getElementById('status-menu');
    if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
    }
});

loadStatuses();
