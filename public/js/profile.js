
import { db, ref, get, update } from './firebase-config.js';

const currentUser = User.get();
if (!currentUser) window.location.href = '/index.html';
const userId = currentUser.id;

let currentEditingField = '';

async function loadUser() {
    const userRef = ref(db, 'users/' + userId);
    const snap = await get(userRef);
    if (!snap.exists()) return;

    const user = snap.val();
    User.set({ ...user, id: userId });

    document.getElementById('name').innerText = user.name || user.username || 'Not set';
    document.getElementById('about').innerText = user.about || 'Hey there! I am using QuickMsg.';
    document.getElementById('phone').innerText = user.phone || 'Add phone number';
    document.getElementById('links').innerText = user.links || 'No links added';
    
    const avatarImg = document.getElementById('avatar');
    if (user.avatar && user.avatar !== 'default.png') {
        avatarImg.src = user.avatar;
    } else {
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.username)}&background=random&size=200`;
    }
}

// Avatar upload
const editPhotoBtn = document.getElementById('editPhoto');
const avatarInput = document.getElementById('avatar-input');

if (editPhotoBtn && avatarInput) {
    editPhotoBtn.onclick = () => avatarInput.click();

    avatarInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showToast('Uploading photo...');
        try {
            const url = await API.uploadFile(file, 'avatars');
            await update(ref(db, 'users/' + userId), { avatar: url });
            showToast('Avatar updated!');
            loadUser();
        } catch (err) {
            console.error("Upload error:", err);
            showToast('Failed to upload image');
        }
    };
}

// Modal Logic
window.editField = function(field) {
    currentEditingField = field;
    const modal = document.getElementById('editModal');
    const title = document.getElementById('modalTitle');
    const input = document.getElementById('modalInput');
    const currentValue = document.getElementById(field).innerText;

    title.innerText = `Edit ${field.charAt(0).toUpperCase() + field.slice(1)}`;
    input.value = (['Not set', 'Add phone number', 'No links added', 'Loading...'].includes(currentValue)) ? '' : currentValue;
    
    modal.classList.remove('hidden');
    input.focus();
}

window.closeModal = function() {
    document.getElementById('editModal').classList.add('hidden');
}

document.getElementById('saveBtn').onclick = async () => {
    const newValue = document.getElementById('modalInput').value.trim();
    if (!newValue && currentEditingField === 'name') return showToast('Name cannot be empty');

    try {
        await update(ref(db, 'users/' + userId), { [currentEditingField]: newValue });
        showToast('Profile updated');
        closeModal();
        loadUser();
    } catch (err) {
        console.error("Update error:", err);
        showToast('Error saving changes');
    }
};

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.replace('opacity-0', 'opacity-100');
    setTimeout(() => {
        toast.classList.replace('opacity-100', 'opacity-0');
    }, 3000);
}

loadUser();
