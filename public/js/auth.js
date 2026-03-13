
import { auth, db, ref, set, get, serverTimestamp } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let isLogin = true;

const authForm = document.getElementById('auth-form');
const signupFields = document.getElementById('signup-fields');
const authSubtitle = document.getElementById('auth-subtitle');
const authBtn = document.getElementById('auth-btn');
const toggleAuthText = document.getElementById('toggle-auth');

window.toggleAuth = function() {
    isLogin = !isLogin;
    if (isLogin) {
        signupFields.classList.add('hidden');
        authSubtitle.innerText = 'Welcome back! Please login.';
        authBtn.innerText = 'Login';
        toggleAuthText.innerHTML = `Don't have an account? <span class="text-blue-600 font-semibold cursor-pointer" onclick="toggleAuth()">Sign up</span>`;
    } else {
        signupFields.classList.remove('hidden');
        authSubtitle.innerText = 'Create an account to get started.';
        authBtn.innerText = 'Sign Up';
        toggleAuthText.innerHTML = `Already have an account? <span class="text-blue-600 font-semibold cursor-pointer" onclick="toggleAuth()">Login</span>`;
    }
}

// Redirect if already logged in and data is fetched
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = ref(db, 'users/' + user.uid);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            localStorage.setItem('user', JSON.stringify({ ...snapshot.val(), id: user.uid }));
            window.location.href = '/home.html';
        } else {
            // Wait for DB write if it's a new user
            console.log("Waiting for user profile creation...");
        }
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('email');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const nameInput = document.getElementById('name');

    // Email fallback if only username provided
    const emailValue = emailInput.value || (usernameInput.value.includes('@') ? usernameInput.value : usernameInput.value + "@quickmsg.com");
    const password = passwordInput.value;

    authBtn.disabled = true;
    authBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, emailValue, password);
        } else {
            const name = nameInput.value;
            const username = usernameInput.value;
            const userCredential = await createUserWithEmailAndPassword(auth, emailValue, password);
            const user = userCredential.user;

            // Save user to 'users' node
            const userProfile = {
                id: user.uid,
                name: name,
                username: username,
                email: emailValue,
                avatar: 'default.png',
                about: 'Hey there! I am using QuickMsg.'
            };
            await set(ref(db, 'users/' + user.uid), userProfile);

            // Initialize 'status' node
            await set(ref(db, 'status/' + user.uid), {
                online: true,
                lastSeen: serverTimestamp()
            });

            localStorage.setItem('user', JSON.stringify(userProfile));
            window.location.href = '/home.html';
        }
    } catch (error) {
        console.error('Auth error:', error);
        alert(error.message);
        authBtn.disabled = false;
        authBtn.innerHTML = isLogin ? 'Login' : 'Sign Up';
    }
});
