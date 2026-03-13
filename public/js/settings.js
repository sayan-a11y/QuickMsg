const profileName = document.getElementById('profile-name');
const profileStatus = document.getElementById('profile-status');
const profileAvatar = document.getElementById('profile-avatar');
const currentUser = User.get();

// Load initial details
function loadDetails() {
    if (!currentUser) {
        window.location.href = '/index.html';
        return;
    }

    // Load from localStorage if available, otherwise from User object
    const savedName = localStorage.getItem('profile-name') || currentUser.name;
    const savedStatus = localStorage.getItem('profile-status') || "Hey there! I am using QuickMsg.";

    profileName.innerText = savedName;
    profileStatus.innerText = savedStatus;
    profileAvatar.innerText = savedName[0].toUpperCase();
}

// Navigation helper
function go(path) {
    window.location.href = path;
}

// Global Dark Mode Application
function applyTheme() {
    const isDark = localStorage.getItem('dark-mode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDetails();
    applyTheme();
});

// Expose go function to window for onclick handlers
window.go = go;
