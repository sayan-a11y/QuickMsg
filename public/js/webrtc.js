// socket is now initialized in api.js
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

// STEP 1: CAMERA PREVIEW FIRST
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
        alert("Please enable camera/mic access.");
        return false;
    }
}

// STEP 6: CREATE PEER
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

    // STEP 9: ICE
    peer.onicecandidate = e => {
        if (e.candidate && currentCallTo) {
            socket.emit("ice", { to: currentCallTo, candidate: e.candidate });
        }
    };

    peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') {
            window.setStatus("Connected");
            if (typeof startTimer === 'function') startTimer();
        } else if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
            window.endCall();
        }
    };
}

// STEP 2: CALL BUTTON
window.startCall = async (type) => {
    const success = await startPreview(type);
    if (!success) return;

    currentCallTo = typeof contactId !== 'undefined' ? contactId : null;
    window.setStatus("Calling...");

    // Log history
    try {
        const res = await API.post('/api/call-history', { 
            receiver_id: currentCallTo, 
            type: type, 
            status: 'outgoing' 
        });
        if (res && res.call) currentCallId = res.call.id;
    } catch (e) { console.error(e); }

    const curUser = User.get();
    // STEP 13: SOCKET EVENTS
    socket.emit("callUser", { 
        to: currentCallTo, 
        from: curUser.id, 
        name: curUser.name,
        type: type, 
        callId: currentCallId 
    });
};

// STEP 4: INCOMING CALL
socket.on("incomingCall", data => {
    // If already in a call, busy
    if (currentCallTo) {
        socket.emit("rejectCall", { to: data.from });
        return;
    }

    currentCallTo = data.from;
    currentCallId = data.callId;
    isVideoCall = data.type === 'video';

    // Show generic confirmation since we might not be on call.html
    const msg = `Incoming ${isVideoCall ? 'video' : 'voice'} call from ${data.name || 'Someone'}. Accept?`;
    
    try { ring.play(); } catch (e) {}

    if (confirm(msg)) {
        ring.pause();
        window.location.href = `call.html?id=${currentCallTo}&type=${data.type}&incoming=true&callId=${data.callId}`;
    } else {
        ring.pause();
        socket.emit("rejectCall", { to: currentCallTo });
        currentCallTo = null;
    }
});

// STEP 5: ACCEPT CALL
socket.on("callAccepted", async data => {
    window.setStatus("Connecting...");
    createPeer();

    // STEP 7: OFFER
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("offer", { to: currentCallTo, offer: offer });
});

// STEP 8: ANSWER
socket.on("offer", async data => {
    window.setStatus("Connecting...");
    if (!peer) createPeer();

    await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { to: currentCallTo, answer: answer });
});

socket.on("answer", async data => {
    if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
});

socket.on("ice", async data => {
    if (peer && data.candidate) {
        try {
            await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) { console.error(e); }
    }
});

// STEP 11: END CALL
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
        
        // Update history status if we have a callId
        if (currentCallId) {
            API.put(`/api/calls/${currentCallId}`, { status: 'ended' });
            const curUser = User.get();
            socket.emit("callUpdate", { to: curUser.id });
            socket.emit("callUpdate", { to: currentCallTo });
        }
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

socket.on("callEnded", () => {
    window.endCall();
});

socket.on("endCall", () => {
    window.endCall();
});

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
            window.setStatus("Connecting...");
        } else {
            window.endCall();
        }
    })();
}

