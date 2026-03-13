
import { db, ref, push, set, serverTimestamp, update, get, onValue, remove } from './firebase-config.js';
import { User } from './api.js';

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const ring = new Audio("/ring.mp3");
ring.loop = true;

let peer = null;
let currentCallTo = null;
let currentCallId = null;
let isVideoCall = true;
let localStream = null;
let signalingUnsubscribe = null;

// Global setStatus helper
window.setStatus = (text) => {
    const statusText = document.getElementById('callStatus');
    if (statusText) statusText.innerText = text;
};

async function startPreview(type) {
    isVideoCall = type === 'video';
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: isVideoCall ? { facingMode: "user" } : false,
            audio: true
        });

        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.classList.remove('hidden');
        }
        window.localStream = localStream;
        return true;
    } catch (e) {
        console.error("Camera preview error:", e);
        return false;
    }
}

function createPeer() {
    peer = new RTCPeerConnection(configuration);

    if (localStream) {
        localStream.getTracks().forEach(t => peer.addTrack(t, localStream));
    }

    peer.ontrack = e => {
        if (remoteVideo) {
            remoteVideo.srcObject = e.streams[0];
            remoteVideo.classList.remove('hidden');
        }
    };

    peer.onicecandidate = e => {
        if (e.candidate && currentCallTo) {
            sendSignalingMessage(currentCallTo, { type: "ice", candidate: e.candidate });
        }
    };

    peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') {
            window.setStatus("Connected");
            if (window.startTimer) window.startTimer();
        } else if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
            window.endCall();
        }
    };
}

async function sendSignalingMessage(to, data) {
    const user = User.get();
    if (!user) return;
    const signalingRef = push(ref(db, `signaling/${to}`));
    await set(signalingRef, { ...data, from: user.id, time: serverTimestamp() });
}

// Start listening for signaling messages
function listenForSignaling() {
    const user = User.get();
    if (!user) return;
    const signalingRef = ref(db, `signaling/${user.id}`);
    
    // Clear old signaling on start
    remove(signalingRef);

    signalingUnsubscribe = onValue(signalingRef, async (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const messages = Object.values(data);
        for (const msg of messages) {
            handleSignalingMessage(msg);
        }
        // Clear handled messages
        remove(signalingRef);
    });
}

async function handleSignalingMessage(data) {
    const user = User.get();
    
    switch (data.type) {
        case 'call':
            if (currentCallTo) {
                sendSignalingMessage(data.from, { type: 'reject' });
                return;
            }
            currentCallTo = data.from;
            currentCallId = data.callId;
            isVideoCall = data.callType === 'video';

            // Log to history
            const rxCallRef = ref(db, `calls/${user.id}/${data.callId}`);
            await set(rxCallRef, {
                id: data.callId,
                peerId: data.from,
                peerName: data.name,
                type: data.callType,
                direction: 'incoming',
                status: 'missed',
                time: serverTimestamp()
            });

            try { ring.play(); } catch (e) {}

            if (confirm(`Incoming ${data.callType} call from ${data.name}. Accept?`)) {
                ring.pause();
                window.location.href = `call.html?id=${currentCallTo}&type=${data.callType}&incoming=true&callId=${data.callId}`;
            } else {
                ring.pause();
                sendSignalingMessage(currentCallTo, { type: 'reject' });
                currentCallTo = null;
            }
            break;

        case 'accept':
            window.setStatus("Connecting...");
            createPeer();
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            sendSignalingMessage(currentCallTo, { type: 'offer', offer: offer });
            
            // Update status
            if (currentCallId) {
                update(ref(db, `calls/${user.id}/${currentCallId}`), { status: 'connected' });
                update(ref(db, `calls/${currentCallTo}/${currentCallId}`), { status: 'connected' });
            }
            break;

        case 'offer':
            window.setStatus("Connecting...");
            if (!peer) createPeer();
            await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            sendSignalingMessage(currentCallTo, { type: 'answer', answer: answer });
            break;

        case 'answer':
            if (peer) await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
            break;

        case 'ice':
            if (peer && data.candidate) {
                try { await peer.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
            }
            break;

        case 'reject':
            alert("Call Rejected");
            window.endCall();
            break;

        case 'end':
            window.endCall();
            break;
    }
}

window.startCall = async (type) => {
    const success = await startPreview(type);
    if (!success) return;

    currentCallTo = typeof contactId !== 'undefined' ? contactId : null;
    if (!currentCallTo) {
        const urlParams = new URLSearchParams(window.location.search);
        currentCallTo = urlParams.get('id');
    }
    
    window.setStatus("Calling...");
    const curUser = User.get();
    
    const callLogRef = push(ref(db, 'calls/' + curUser.id));
    currentCallId = callLogRef.key;
    await set(callLogRef, {
        id: currentCallId,
        peerId: currentCallTo,
        peerName: window.contactName || 'User',
        type: type,
        direction: 'outgoing',
        status: 'calling',
        time: serverTimestamp()
    });

    sendSignalingMessage(currentCallTo, {
        type: 'call',
        from: curUser.id,
        name: curUser.name || curUser.username,
        callType: type,
        callId: currentCallId
    });
};

window.endCall = async () => {
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    if (peer) {
        peer.close();
        peer = null;
    }
    if (remoteVideo) remoteVideo.srcObject = null;
    if (ring) ring.pause();

    if (currentCallTo) {
        sendSignalingMessage(currentCallTo, { type: 'end' });
    }

    if (window.location.pathname.includes('call.html')) {
        window.history.back();
    }
    currentCallTo = null;
    currentCallId = null;
};

// Handle incoming acceptance from URL redirect
const params = new URLSearchParams(window.location.search);
if (params.get('incoming') === 'true' && window.location.pathname.includes('call.html')) {
    const fromId = params.get('id');
    currentCallTo = fromId;
    currentCallId = params.get('callId');
    const type = params.get('type') || 'video';

    (async () => {
        const success = await startPreview(type);
        if (success) {
            createPeer();
            sendSignalingMessage(currentCallTo, { type: 'accept' });
        } else {
            window.endCall();
        }
    })();
}

listenForSignaling();
