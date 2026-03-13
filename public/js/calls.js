const callsList = document.getElementById('calls-list');
// socket is now initialized in api.js
const deleteModal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

let longPressTimer;
let currentDeleteId = null;

async function loadCalls() {
    try {
        const res = await API.get('/api/calls');
        if (!res.calls || res.calls.length === 0) {
            callsList.innerHTML = `
                <div class="flex flex-col items-center justify-center p-12 text-gray-400">
                    <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <i class="fas fa-phone-slash text-3xl"></i>
                    </div>
                    <p class="font-medium">No call logs yet</p>
                    <p class="text-xs">Your call history will appear here.</p>
                </div>
            `;
            return;
        }

        callsList.innerHTML = res.calls.map(call => {
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
                     onmousedown="startLongPress(${call.id})" 
                     onmouseup="endLongPress()" 
                     onmouseleave="endLongPress()"
                     ontouchstart="startLongPress(${call.id})"
                     ontouchend="endLongPress()">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold overflow-hidden">
                            ${call.avatar ? `<img src="${call.avatar}" class="w-full h-full object-cover">` : call.name[0].toUpperCase()}
                        </div>
                        <div>
                            <h3 class="font-semibold text-gray-800 ${isMissed && !isOutgoing ? 'text-red-600' : ''}">${call.name}</h3>
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
    } catch (e) {
        console.error("Load calls fetch error:", e);
        callsList.innerHTML = `
            <div class="p-8 text-center text-red-500">
                <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                <p>Error loading call history</p>
                <button onclick="loadCalls()" class="mt-4 text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full px-4 py-2 font-bold uppercase transition-all">Retry</button>
            </div>
        `;
    }
}

function startLongPress(id) {
    longPressTimer = setTimeout(() => {
        showDeleteModal(id);
    }, 600);
}

function endLongPress() {
    clearTimeout(longPressTimer);
}

function showDeleteModal(id) {
    currentDeleteId = id;
    deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    currentDeleteId = null;
}

confirmDeleteBtn.onclick = async () => {
    if (!currentDeleteId) return;
    try {
        await API.post('/api/delete-call', { id: currentDeleteId });
        socket.emit('callUpdate', { to: User.get().id });
        closeDeleteModal();
        loadCalls();
    } catch (e) {
        console.error(e);
    }
};

// Initial Load
loadCalls();

// Real-time updates
socket.on('callUpdate', () => {
    loadCalls();
});

// Register user for socket
const user = User.get();
if (user) {
    socket.emit('register', user.id);
}
