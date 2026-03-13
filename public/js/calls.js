import { db, ref, onValue, get, push, set, remove, serverTimestamp, auth, onAuthStateChanged } from './firebase-config.js';
import { User, utils } from './api.js';

const callsList = document.getElementById('calls-list');
const deleteModal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

let currentUser = User.get();

// Wait for Auth
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = User.get() || { id: user.uid };
        loadCalls();
    } else {
        window.location.href = '/index.html';
    }
});

let longPressTimer;
let currentDeleteId = null;

async function loadCalls() {
    const callsRef = ref(db, 'calls/' + currentUser.id);
    onValue(callsRef, async (snapshot) => {
        const callsData = snapshot.val();
        if (!callsData) {
            callsList.innerHTML = `
                <div class="flex flex-col items-center justify-center p-12 text-gray-400">
                    <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <i class="fas fa-phone-slash text-3xl"></i>
                    </div>
                    <p class="font-medium">No call logs yet</p>
                </div>
            `;
            return;
        }

        const callLogs = Object.values(callsData).sort((a, b) => b.time - a.time);
        
        callsList.innerHTML = callLogs.map(call => {
            const isMissed = call.status === 'missed';
            const isOutgoing = call.direction === 'outgoing';
            const statusIcon = isOutgoing 
                ? '<i class="fas fa-arrow-up-right text-green-500 mr-1 text-[10px]"></i>' 
                : (isMissed ? '<i class="fas fa-arrow-down-left text-red-500 mr-1 text-[10px]"></i>' : '<i class="fas fa-arrow-down-left text-blue-500 mr-1 text-[10px]"></i>');
            
            const callIcon = call.type === 'video' 
                ? '<i class="fas fa-video text-blue-600"></i>' 
                : '<i class="fas fa-phone-alt text-blue-600"></i>';

            return `
                <div class="p-4 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-all cursor-pointer select-none"
                     onmousedown="startLongPress('${call.id}')" 
                     ontouchstart="startLongPress('${call.id}')"
                     onclick="window.location.href='chat.html?id=${call.peerId}&name=${encodeURIComponent(call.peerName)}'">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold overflow-hidden">
                            ${call.peerAvatar && call.peerAvatar !== 'default.png' ? `<img src="${call.peerAvatar}" class="w-full h-full object-cover">` : (call.peerName || 'U')[0]}
                        </div>
                        <div>
                            <h3 class="font-semibold text-gray-800 ${isMissed && !isOutgoing ? 'text-red-600' : ''}">${call.peerName}</h3>
                            <div class="flex items-center text-xs text-gray-500">
                                ${statusIcon}
                                <span>${utils.formatTime(call.time)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="p-2">
                        ${callIcon}
                    </div>
                </div>
            `;
        }).join('');
    });
}

window.startLongPress = function(id) {
    longPressTimer = setTimeout(() => {
        currentDeleteId = id;
        deleteModal.classList.remove('hidden');
    }, 600);
}

window.endLongPress = function() {
    clearTimeout(longPressTimer);
}

confirmDeleteBtn.onclick = async () => {
    if (!currentDeleteId) return;
    await remove(ref(db, `calls/${currentUser.id}/${currentDeleteId}`));
    deleteModal.classList.add('hidden');
};

// loadCalls is called inside onAuthStateChanged
