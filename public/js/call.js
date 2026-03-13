const callName = document.getElementById('callName');
const callStatus = document.getElementById('callStatus');
const callTimer = document.getElementById('callTimer');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
const speakerBtn = document.getElementById('speakerBtn');

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('id');
const callType = urlParams.get('type') || 'video';
const isIncoming = urlParams.get('incoming') === 'true';

let timerInterval;
let seconds = 0;
let muted = false;
let videoOff = false;
let speakerOn = true;

// Load User Info
async function loadTargetUser() {
    if (!targetUserId) {
        callName.innerText = "Unknown User";
        return null;
    }
    try {
        const res = await API.get(`/api/user/${targetUserId}`);
        if (res && res.user) {
            callName.innerText = res.user.name;
            return res.user;
        } else {
            callName.innerText = "Unknown User";
            callStatus.innerText = "Invalid user ID";
            return null;
        }
    } catch (e) {
        console.error("Error loading user info", e);
        callName.innerText = "Unknown User";
        return null;
    }
}

// Timer setup
window.startTimer = function() {
    if (timerInterval) return;
    seconds = 0;
    timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        callTimer.innerText = `${mins}:${secs}`;
    }, 1000);
};

// UI Toggles
window.toggleMute = () => {
    if (!window.localStream) return;
    muted = !muted;
    window.localStream.getAudioTracks()[0].enabled = !muted;
    muteBtn.classList.toggle('active', muted);
    muteBtn.innerHTML = muted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
};

window.toggleVideo = () => {
    if (!window.localStream) return;
    videoOff = !videoOff;
    window.localStream.getVideoTracks()[0].enabled = !videoOff;
    videoBtn.classList.toggle('active', videoOff);
    videoBtn.innerHTML = videoOff ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
};

window.toggleSpeaker = () => {
    speakerOn = !speakerOn;
    speakerBtn.classList.toggle('active', !speakerOn);
};

// Initialize
async function initCall() {
    await loadTargetUser();

    // Set globally for webrtc.js context identification
    window.contactId = targetUserId;
    window.contactName = callName.innerText;

    if (!isIncoming) {
        // STEP 1 & 2 & 13
        callStatus.innerText = "Calling...";
        window.startCall(callType);
    } else {
        callStatus.innerText = "Connecting...";
    }
}

// Override the global setStatus from webrtc.js to update call.html elements
window.setStatus = (text) => {
    if (callStatus) callStatus.innerText = text;
    if (text === "Connected") window.startTimer();
};

document.addEventListener('DOMContentLoaded', initCall);

// Cleanup on leave
window.onbeforeunload = () => {
    if (timerInterval) clearInterval(timerInterval);
    window.endCall();
};
