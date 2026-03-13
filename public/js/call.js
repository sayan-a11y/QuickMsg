
import { db, ref, get } from './firebase-config.js';
import { User } from './api.js';

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

const currentUser = User.get();

async function loadTargetUser() {
    if (!targetUserId) {
        callName.innerText = "Unknown User";
        return null;
    }
    try {
        const userSnap = await get(ref(db, 'users/' + targetUserId));
        if (userSnap.exists()) {
            const user = userSnap.val();
            callName.innerText = user.name || user.username || "User";
            return user;
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

async function initCall() {
    await loadTargetUser();

    window.contactId = targetUserId;
    window.contactName = callName.innerText;

    if (!isIncoming) {
        callStatus.innerText = "Calling...";
        if (window.startCall) window.startCall(callType);
    } else {
        callStatus.innerText = "Connecting...";
    }
}

window.setStatus = (text) => {
    if (callStatus) callStatus.innerText = text;
    if (text === "Connected") window.startTimer();
};

document.addEventListener('DOMContentLoaded', initCall);

window.onbeforeunload = () => {
    if (timerInterval) clearInterval(timerInterval);
    if (window.endCall) window.endCall();
};

// Export to window for HTML onclicks
window.initCall = initCall;
