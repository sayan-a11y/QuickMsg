const currentUser = User.get();
if (!currentUser) window.location.href = '/index.html';

const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('id') || currentUser.id;
const isOwner = (targetId === currentUser.id);

let currentEditingField = '';

async function loadProfile() {
    try {
        const response = await API.get(`/api/user/${targetId}`);
        const user = response.user;
        const cacheBuster = `?t=${Date.now()}`;

        // Sync local storage if it's the owner's profile
        if (isOwner) User.set(user);

        // Populate fields
        document.getElementById('profile-name').innerText = user.name || 'User';
        document.getElementById('profile-username').innerText = `@${user.username || 'username'}`;
        document.getElementById('profile-about').innerText = user.about || 'Hey there! I am using QuickMsg.';
        document.getElementById('profile-phone').innerText = user.phone || 'No phone added';
        document.getElementById('profile-links').innerText = user.links || 'No links added';

        if (user.avatar) {
            const avatarUrl = user.avatar.includes('/') ? user.avatar : "/uploads/" + user.avatar;
            document.getElementById('profile-avatar').src = avatarUrl + cacheBuster;
        } else {
            document.getElementById('profile-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&size=200`;
        }

        // Show/Hide Edit UI
        if (isOwner) {
            document.getElementById('edit-avatar-btn').classList.remove('hidden');
            document.getElementById('edit-about-btn').classList.remove('hidden');
            document.getElementById('edit-phone-btn').classList.remove('hidden');
            document.getElementById('edit-links-btn').classList.remove('hidden');
            document.getElementById('extra-actions').classList.remove('hidden');
            
            // Set up edit listeners
            setupEditListeners();
        }
    } catch (err) {
        console.error("Error loading profile:", err);
        showToast("User not found");
    }
}

function setupEditListeners() {
    document.getElementById('edit-avatar-btn').onclick = () => document.getElementById('avatar-input').click();
    
    document.getElementById('avatar-input').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            showToast('Uploading photo...');
            const data = await API.post('/api/avatar', formData, true);
            if (data.ok) {
                showToast('Avatar updated!');
                loadProfile();
            }
        } catch (err) {
            showToast('Failed to upload image');
        }
    };

    document.getElementById('edit-about-btn').onclick = () => openEditModal('about');
    document.getElementById('edit-phone-btn').onclick = () => openEditModal('phone');
    document.getElementById('edit-links-btn').onclick = () => openEditModal('links');
}

function openEditModal(field) {
    currentEditingField = field;
    const modal = document.getElementById('editModal');
    const title = document.getElementById('modalTitle');
    const input = document.getElementById('modalInput');
    
    const displayElement = document.getElementById(`profile-${field}`);
    const currentValue = displayElement.innerText;

    title.innerText = `Edit ${field.charAt(0).toUpperCase() + field.slice(1)}`;
    input.value = (currentValue.includes('No ') || currentValue === 'Loading...') ? '' : currentValue;
    
    modal.classList.remove('hidden');
    input.focus();
}

function closeModal() {
    document.getElementById('editModal').classList.add('hidden');
}

document.getElementById('saveBtn').onclick = async () => {
    const newValue = document.getElementById('modalInput').value;
    const endpoint = `/api/${currentEditingField}`; 
    
    try {
        const res = await API.post(endpoint, { 
            [currentEditingField]: newValue 
        });

        if (res.ok || res.message) {
            showToast('Profile updated');
            closeModal();
            loadProfile();

            // Special handling for name in case it's ever added to this page
            if (currentEditingField === 'name') {
                const user = User.get();
                user.name = newValue;
                User.set(user);
            }
        } else {
            showToast('Error saving changes');
        }
    } catch (err) {
        showToast('Error saving changes');
    }
};

async function logout() {
    if (confirm("Logout from QuickMsg?")) {
        await API.post('/api/logout', {});
        User.clear();
        window.location.href = '/index.html';
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.replace('opacity-0', 'opacity-100');
    toast.classList.replace('translate-y-5', 'translate-y-0');
    setTimeout(() => {
        toast.classList.replace('opacity-100', 'opacity-0');
        toast.classList.replace('translate-y-0', 'translate-y-5');
    }, 3000);
}

// Initial Load
loadProfile();
