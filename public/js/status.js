import { db, ref, onValue, get, update, push, set, serverTimestamp, remove, auth, onAuthStateChanged } from './firebase-config.js';
import { User, utils } from './api.js';

const statusListContainer = document.getElementById('status-list');
let currentUser = User.get();

// Wait for Auth
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = User.get() || { id: user.uid };
        loadStatuses();
    } else {
        window.location.href = '/index.html';
    }
});

// Elements
const viewer = document.getElementById('status-viewer');
const viewerImg = document.getElementById('viewer-img');
const viewerVid = document.getElementById('viewer-vid');
const viewerName = document.getElementById('viewer-name');
const viewerTime = document.getElementById('viewer-time');
const viewerAvatar = document.getElementById('viewer-avatar');
const progressBarContainer = document.getElementById('status-progress-bar');
const replyInput = document.getElementById('reply-input');
const viewerCountText = document.getElementById('viewer-count-text');
const viewersSheet = document.getElementById('viewers-sheet');
const viewersList = document.getElementById('viewers-list');
const viewerCaptionContainer = document.getElementById('viewer-caption-container');
const viewerCaptionText = document.getElementById('viewer-caption-text');

let groupedStatuses = {};
let currentViewUser = null;
let currentStatusIndex = 0;
let progressTimeout = null;
let viewingMyStatus = false;

async function loadStatuses() {
    const storiesRef = ref(db, 'stories');
    onValue(storiesRef, (snapshot) => {
        const stories = snapshot.val();
        if (!stories) {
            statusListContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No recent updates</div>';
            return;
        }

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        groupedStatuses = {};
        Object.values(stories).forEach(s => {
            // Auto-delete check (frontend filtering)
            if (now - s.time > oneDay) return;

            if (!groupedStatuses[s.userId]) {
                groupedStatuses[s.userId] = {
                    user_id: s.userId,
                    name: s.userName,
                    avatar: s.userAvatar,
                    items: []
                };
            }
            groupedStatuses[s.userId].items.push(s);
        });

        renderStatusList();
    });
}

function renderStatusList() {
    const others = Object.values(groupedStatuses).filter(u => u.user_id !== currentUser.id);
    const myStatus = groupedStatuses[currentUser.id];

    statusListContainer.innerHTML = others.map(user => `
        <div class="p-4 flex items-center space-x-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100" onclick="openStatus('${user.user_id}')">
            <div class="relative flex-shrink-0">
                <div class="w-14 h-14 rounded-full p-1 border-2 border-emerald-500 flex items-center justify-center">
                    ${user.avatar && user.avatar !== 'default.png'
                        ? `<img src="${user.avatar}" class="w-full h-full rounded-full object-cover">`
                        : `<div class="w-full h-full bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold uppercase text-xl">${(user.name || 'U')[0]}</div>`
                    }
                </div>
            </div>
            <div class="flex-1">
                <h3 class="font-bold text-gray-800">${user.name}</h3>
                <p class="text-[12px] font-medium text-gray-400">${utils.formatTime(user.items[user.items.length - 1].time)}</p>
            </div>
        </div>
    `).join('') || '<div class="p-8 text-center text-gray-400">No recent updates</div>';

    // Update My Status UI
    const myAvatarImg = document.getElementById('my-avatar');
    if (myAvatarImg) {
        if (currentUser.avatar && currentUser.avatar !== 'default.png') {
            myAvatarImg.src = currentUser.avatar;
            myAvatarImg.classList.remove('hidden');
            document.getElementById('my-avatar-placeholder').classList.add('hidden');
        } else {
            myAvatarImg.classList.add('hidden');
            const placeholder = document.getElementById('my-avatar-placeholder');
            placeholder.classList.remove('hidden');
            placeholder.innerText = (currentUser.name || currentUser.username || 'U')[0].toUpperCase();
        }
    }

    const myBorder = document.querySelector('[onclick*="status-upload.html"]').querySelector('.relative > div');
    if (myStatus) {
        myBorder.classList.add('border-emerald-500');
        // Reset onclick to open status if exists
        myBorder.closest('.flex').onclick = () => openStatus(currentUser.id);
    } else {
        myBorder.classList.remove('border-emerald-500');
        myBorder.closest('.flex').onclick = () => window.location.href = 'status-upload.html';
    }
}

window.deleteCurrentStatus = async (e) => {
    e.stopPropagation();
    if (!viewingMyStatus || !confirm("Delete this status?")) return;
    const s = currentViewUser.items[currentStatusIndex];
    await remove(ref(db, `stories/${s.id}`));
    closeStatus();
};

window.openStatus = function(userId) {
    const userGrp = groupedStatuses[userId];
    if (!userGrp) return;

    currentViewUser = userGrp;
    currentStatusIndex = 0;
    viewingMyStatus = userId === currentUser.id;

    viewer.classList.remove('hidden');
    viewerName.innerText = viewingMyStatus ? "My Status" : userGrp.name;
    
    if (userGrp.avatar && userGrp.avatar !== 'default.png') {
        viewerAvatar.src = userGrp.avatar;
        viewerAvatar.classList.remove('hidden');
    } else {
        viewerAvatar.classList.add('hidden');
    }

    renderProgressBars();
    showCurrentStatus();
}

function renderProgressBars() {
    progressBarContainer.innerHTML = currentViewUser.items.map((_, i) => `
        <div class="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div id="prog-${i}" class="h-full bg-white w-0 shadow-sm transition-none"></div>
        </div>
    `).join('');
}

async function showCurrentStatus() {
    clearTimeout(progressTimeout);
    viewerVid.pause();
    viewerImg.classList.add('hidden');
    viewerVid.classList.add('hidden');

    const s = currentViewUser.items[currentStatusIndex];
    viewerTime.innerText = utils.formatTime(s.time);
    viewerCaptionText.innerText = s.caption || '';
    
    if (s.caption) viewerCaptionContainer.classList.remove('hidden');
    else viewerCaptionContainer.classList.add('hidden');

    // Mark as viewed
    if (!viewingMyStatus) {
        update(ref(db, `stories/${s.id}/views/${currentUser.id}`), {
            name: currentUser.name || currentUser.username,
            avatar: currentUser.avatar || 'default.png',
            time: serverTimestamp()
        });
    } else {
        loadViewers(s.id);
    }

    const currentProg = document.getElementById(`prog-${currentStatusIndex}`);
    if (s.fileType.startsWith('video/')) {
        viewerVid.src = s.file;
        viewerVid.classList.remove('hidden');
        viewerVid.onloadedmetadata = () => {
             const dur = viewerVid.duration * 1000;
             animateProg(currentProg, dur);
             progressTimeout = setTimeout(() => nextStatus(), dur);
        };
        viewerVid.play();
    } else {
        viewerImg.src = s.file;
        viewerImg.classList.remove('hidden');
        animateProg(currentProg, 5000);
        progressTimeout = setTimeout(() => nextStatus(), 5000);
    }
}

function animateProg(el, dur) {
    el.style.width = '0%';
    el.style.transition = 'none';
    void el.offsetWidth;
    el.style.transition = `width ${dur}ms linear`;
    el.style.width = '100%';
}

function nextStatus() {
    if (currentStatusIndex < currentViewUser.items.length - 1) {
        currentStatusIndex++;
        showCurrentStatus();
    } else {
        closeStatus();
    }
}

window.closeStatus = function() {
    clearTimeout(progressTimeout);
    viewerVid.pause();
    viewer.classList.add('hidden');
}

async function loadViewers(storyId) {
    const storySnap = await get(ref(db, `stories/${storyId}/views`));
    const views = storySnap.val() || {};
    const viewList = Object.values(views);
    viewerCountText.innerText = viewList.length;
    viewersList.innerHTML = viewList.map(v => `
        <div class="p-3 flex items-center space-x-3 border-b">
            <img src="${v.avatar}" class="w-10 h-10 rounded-full">
            <span>${v.name}</span>
        </div>
    `).join('');
}

window.showViewers = () => viewersSheet.classList.remove('translate-y-full');
window.closeViewers = () => viewersSheet.classList.add('translate-y-full');

// loadStatuses is called inside onAuthStateChanged
