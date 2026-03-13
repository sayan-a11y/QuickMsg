
import { db, storage, ref, push, set, serverTimestamp } from './firebase-config.js';

const currentUser = User.get();
if (!currentUser) window.location.href = '/index.html';

const fileInput = document.getElementById('file-input');
const filePickerContainer = document.getElementById('file-picker-container');
const previewUi = document.getElementById('preview-ui');
const previewImg = document.getElementById('preview-img');
const previewVid = document.getElementById('preview-vid');
const captionInput = document.getElementById('caption-input');
const sendBtn = document.getElementById('send-btn');

let selectedFile = null;

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    selectedFile = file;
    const url = URL.createObjectURL(file);

    previewVid.pause();
    previewImg.classList.add('hidden');
    previewVid.classList.add('hidden');

    if (file.type.startsWith('video/')) {
        previewVid.src = url;
        previewVid.classList.remove('hidden');
        previewVid.play();
    } else {
        previewImg.src = url;
        previewImg.classList.remove('hidden');
    }

    filePickerContainer.classList.add('hidden');
    previewUi.classList.remove('hidden');
});

window.uploadStatus = async () => {
    if (!selectedFile) return;

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        // Upload to Storage
        const fileUrl = await API.uploadFile(selectedFile, 'stories/' + currentUser.id);
        
        // Save to RTDB
        const storyRef = push(ref(db, 'stories'));
        await set(storyRef, {
            id: storyRef.key,
            userId: currentUser.id,
            userName: currentUser.name || currentUser.username,
            userAvatar: currentUser.avatar || 'default.png',
            file: fileUrl,
            fileType: selectedFile.type,
            caption: captionInput.value.trim(),
            time: serverTimestamp(),
            views: {}
        });

        window.location.href = 'status.html';
    } catch (err) {
        console.error("Story upload error:", err);
        alert("Failed to share story.");
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
};

sendBtn.onclick = window.uploadStatus;
