
import { db, ref, push, set, serverTimestamp, update, get } from './firebase-config.js';

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
            socket.emit("ice", { to: currentCallTo, candidate: e.candidate });
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
    
    // Log Call to Firebase
    const callLogRef = push(ref(db, 'calls/' + curUser.id));
    currentCallId = callLogRef.key;
    const callData = {
        id: currentCallId,
        peerId: currentCallTo,
        peerName: window.contactName || 'User',
        type: type,
        direction: 'outgoing',
        status: 'calling',
        time: serverTimestamp()
    };
    await set(callLogRef, callData);

    // Also notify receiver (they will log their own incoming)
    socket.emit("callUser", { 
        to: currentCallTo, 
        from: curUser.id, 
        name: curUser.name || curUser.username,
        type: type, 
        callId: currentCallId 
    });
};

socket.on("incomingCall", async (data) => {
    if (currentCallTo) {
        socket.emit("rejectCall", { to: data.from });
        return;
    }

    currentCallTo = data.from;
    currentCallId = data.callId;
    isVideoCall = data.type === 'video';

    // Log to receiver's history
    const curUser = User.get();
    const rxCallRef = ref(db, `calls/${curUser.id}/${data.callId}`);
    await set(rxCallRef, {
        id: data.callId,
        peerId: data.from,
        peerName: data.name,
        type: data.type,
        direction: 'incoming',
        status: 'missed', // default until connected
        time: serverTimestamp()
    });

    try { ring.play(); } catch (e) {}

    if (confirm(`Incoming ${data.type} call from ${data.name}. Accept?`)) {
        ring.pause();
        window.location.href = `call.html?id=${currentCallTo}&type=${data.type}&incoming=true&callId=${data.callId}`;
    } else {
        ring.pause();
        socket.emit("rejectCall", { to: currentCallTo });
        currentCallTo = null;
    }
});

socket.on("callAccepted", async data => {
    window.setStatus("Connecting...");
    createPeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("offer", { to: currentCallTo, offer: offer });
    
    // Update status to connected
    if (currentCallId) {
        update(ref(db, `calls/${User.get().id}/${currentCallId}`), { status: 'connected' });
        update(ref(db, `calls/${currentCallTo}/${currentCallId}`), { status: 'connected' });
    }
});

socket.on("offer", async data => {
    window.setStatus("Connecting...");
    if (!peer) createPeer();
    await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { to: currentCallTo, answer: answer });
});

socket.on("answer", async data => {
    if (peer) await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on("ice", async data => {
    if (peer && data.candidate) {
        try { await peer.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
    }
});

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
        socket.emit("endCall", { to: currentCallTo });
    }

    if (window.location.pathname.includes('call.html')) {
        window.history.back();
    }
    currentCallTo = null;
    currentCallId = null;
};

socket.on("callRejected", () => {
    alert("Call Rejected");
    window.endCall();
});

socket.on("callEnded", () => window.endCall());

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
            socket.emit("acceptCall", { to: currentCallTo, from: User.get().id });
        } else {
            window.endCall();
        }
    })();
}
