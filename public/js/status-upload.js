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

// Handle file selection
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    selectedFile = file;
    const url = URL.createObjectURL(file);

    // Reset views
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

// Auto trigger file selector on load
window.onload = () => {
    // Attempting auto-click, some browsers may prevent it without user gesture.
    // However, the button in the UI acts as a fallback.
    fileInput.click();
};

async function uploadStatus() {
    if (!selectedFile) return;

    // Start Loading Spin
    const ogIcon = sendBtn.innerHTML;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-xl translate-x-[-1px] translate-y-[1px]"></i>';
    sendBtn.disabled = true;

    const formData = new FormData();
    formData.append('status_file', selectedFile);
    formData.append('caption', captionInput.value.trim());

    try {
        await API.post('/api/status', formData, true);
        const socket = io();
        socket.emit("statusUpdate");
        window.location.href = 'status.html';
    } catch (err) {
        console.error("Status upload error", err);
        alert("Failed to share status, check internet connection.");
        sendBtn.innerHTML = ogIcon;
        sendBtn.disabled = false;
    }
}
