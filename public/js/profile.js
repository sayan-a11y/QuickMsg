const currentUser = User.get();
if (!currentUser) window.location.href = '/index.html';
const userId = currentUser.id;

let currentEditingField = '';

async function loadUser() {
    try {
        const response = await API.get(`/api/user/${userId}`);
        const user = response.user;
        const cacheBuster = `?t=${Date.now()}`;
        
        // Update local storage to keep it in sync across pages
        User.set(user);

        document.getElementById('name').innerText = user.name || 'Not set';
        document.getElementById('about').innerText = user.about || 'Hey there! I am using QuickMsg.';
        document.getElementById('phone').innerText = user.phone || 'Add phone number';
        document.getElementById('links').innerText = user.links || 'No links added';
        
        if (user.avatar) {
            // DB stores filename. Handle both cases (filename only or full path) for migration safety
            const avatarUrl = user.avatar.includes('/') ? user.avatar : "/uploads/" + user.avatar;
            document.getElementById('avatar').src = avatarUrl + cacheBuster;
        } else {
            document.getElementById('avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&size=200`;
        }
    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

// Avatar upload
document.getElementById('editPhoto').onclick = () => document.getElementById('avatar-input').click();

document.getElementById('avatar-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('id', currentUser.id); // Add ID to formData

    try {
        showToast('Uploading photo...');
        const data = await API.post('/api/avatar', formData, true);
        
        if (data.ok) {
            showToast('Avatar updated!');
            loadUser(); // Force reload
        } else {
            showToast('Failed to update avatar');
        }
    } catch (err) {
        console.error("Upload error:", err);
        showToast('Failed to upload image');
    }
};

// Modal Logic
function editField(field) {
    currentEditingField = field;
    const modal = document.getElementById('editModal');
    const title = document.getElementById('modalTitle');
    const input = document.getElementById('modalInput');
    const currentValue = document.getElementById(field).innerText;

    title.innerText = `Edit ${field.charAt(0).toUpperCase() + field.slice(1)}`;
    input.value = (currentValue === 'Not set' || currentValue === 'Add phone number' || currentValue === 'No links added' || currentValue === 'Loading...') ? '' : currentValue;
    
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
        // Send both ID and the field value as requested
        const res = await API.post(endpoint, { 
            id: currentUser.id, 
            [currentEditingField]: newValue 
        });

        if (res.ok) {
            showToast('Profile updated');
            closeModal();
            loadUser(); // Force reload

            // Sync with local storage if name changed
            if (currentEditingField === 'name') {
                const user = User.get();
                user.name = newValue;
                User.set(user);
            }
        } else {
            showToast('Error saving changes');
        }
    } catch (err) {
        console.error("Update error:", err);
        showToast('Error saving changes');
    }
};

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.replace('opacity-0', 'opacity-100');
    setTimeout(() => {
        toast.classList.replace('opacity-100', 'opacity-0');
    }, 3000);
}

// Close modal on escape
window.onkeydown = (e) => {
    if (e.key === 'Escape') closeModal();
};

// Initialize
loadUser();
