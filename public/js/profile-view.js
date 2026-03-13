
import { db, ref, get, update } from './firebase-config.js';

const currentUser = User.get();
if (!currentUser) window.location.href = '/index.html';

const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('id') || currentUser.id;
const isOwner = (targetId === currentUser.id);

let currentEditingField = '';

async function loadProfile() {
    try {
        const userRef = ref(db, 'users/' + targetId);
        const snap = await get(userRef);
        if (!snap.exists()) throw new Error("User not found");
        
        const user = snap.val();
        if (isOwner) User.set({ ...user, id: targetId });

        document.getElementById('profile-name').innerText = user.name || user.username || 'User';
        document.getElementById('profile-username').innerText = `@${user.username || 'username'}`;
        document.getElementById('profile-about').innerText = user.about || 'Hey there! I am using QuickMsg.';
        document.getElementById('profile-phone').innerText = user.phone || 'No phone added';
        document.getElementById('profile-links').innerText = user.links || 'No links added';

        const avatarImg = document.getElementById('profile-avatar');
        if (user.avatar && user.avatar !== 'default.png') {
            avatarImg.src = user.avatar;
        } else {
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.username)}&background=random&size=200`;
        }

        if (isOwner) {
            document.querySelectorAll('.edit-btn').forEach(btn => btn.classList.remove('hidden'));
            document.getElementById('extra-actions').classList.remove('hidden');
            setupEditListeners();
        }
    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

function setupEditListeners() {
    const editAvatarBtn = document.getElementById('edit-avatar-btn');
    const avatarInput = document.getElementById('avatar-input');
    
    if (editAvatarBtn && avatarInput) {
        editAvatarBtn.onclick = () => avatarInput.click();
        avatarInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            showToast('Uploading photo...');
            try {
                const url = await API.uploadFile(file, 'avatars');
                await update(ref(db, 'users/' + targetId), { avatar: url });
                showToast('Avatar updated!');
                loadProfile();
            } catch (err) {
                showToast('Failed to upload image');
            }
        };
    }

    const editActions = {
        'edit-about-btn': 'about',
        'edit-phone-btn': 'phone',
        'edit-links-btn': 'links'
    };

    Object.entries(editActions).forEach(([btnId, field]) => {
        const btn = document.getElementById(btnId);
        if (btn) btn.onclick = () => openEditModal(field);
    });
}

window.openEditModal = function(field) {
    currentEditingField = field;
    const modal = document.getElementById('editModal');
    const title = document.getElementById('modalTitle');
    const input = document.getElementById('modalInput');
    const displayElement = document.getElementById(`profile-${field}`);
    const currentValue = displayElement ? displayElement.innerText : '';

    title.innerText = `Edit ${field.charAt(0).toUpperCase() + field.slice(1)}`;
    input.value = (currentValue.includes('No ') || currentValue === 'Loading...') ? '' : currentValue;
    modal.classList.remove('hidden');
    input.focus();
}

window.closeModal = function() {
    document.getElementById('editModal').classList.add('hidden');
}

document.getElementById('saveBtn').onclick = async () => {
    const newValue = document.getElementById('modalInput').value.trim();
    try {
        await update(ref(db, 'users/' + targetId), { [currentEditingField]: newValue });
        showToast('Profile updated');
        closeModal();
        loadProfile();
    } catch (err) {
        showToast('Error saving changes');
    }
};

window.logout = async function() {
    if (confirm("Logout from QuickMsg?")) {
        User.clear();
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.replace('opacity-0', 'opacity-100');
    toast.classList.replace('translate-y-5', 'translate-y-0');
    setTimeout(() => {
        toast.classList.replace('opacity-100', 'opacity-0');
        toast.classList.replace('translate-y-0', 'translate-y-5');
    }, 3000);
}

loadProfile();
