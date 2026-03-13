
import { db, ref, onValue } from './firebase-config.js';

const profileName = document.getElementById('profile-name');
const profileStatus = document.getElementById('profile-status');
const profileAvatar = document.getElementById('profile-avatar');
const currentUser = User.get();

if (!currentUser) window.location.href = '/index.html';

function loadDetails() {
    const userRef = ref(db, 'users/' + currentUser.id);
    onValue(userRef, (snap) => {
        const user = snap.val();
        if (!user) return;

        profileName.innerText = user.name || user.username;
        profileStatus.innerText = user.about || "Hey there! I am using QuickMsg.";
        
        if (user.avatar && user.avatar !== 'default.png') {
            profileAvatar.innerHTML = `<img src="${user.avatar}" class="w-full h-full rounded-full object-cover">`;
        } else {
            profileAvatar.innerText = (user.name || user.username || 'U')[0].toUpperCase();
        }
    });
}

window.go = (path) => window.location.href = path;

loadDetails();
