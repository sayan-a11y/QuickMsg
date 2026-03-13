let isLogin = true;

const authForm = document.getElementById('auth-form');
const signupFields = document.getElementById('signup-fields');
const authSubtitle = document.getElementById('auth-subtitle');
const authBtn = document.getElementById('auth-btn');
const toggleAuthText = document.getElementById('toggle-auth');

function toggleAuth() {
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

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('name') ? document.getElementById('name').value : null;
    const email = document.getElementById('email') ? document.getElementById('email').value : null;

    const url = isLogin ? '/api/login' : '/api/signup';
    const body = isLogin ? { username, password } : { name, username, email, password };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = '/home.html';
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (err) {
        console.error('Auth error:', err);
        alert('An error occurred. Check browser console.');
    }
});

// Check if already logged in
async function checkLoggedIn() {
    const res = await fetch('/api/me');
    if (res.ok) {
        const data = await res.json();
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/home.html';
    }
}

checkLoggedIn();
