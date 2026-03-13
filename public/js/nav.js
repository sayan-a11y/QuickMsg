const searchContainer = document.getElementById('search-container');
const searchBtn = document.getElementById('search-btn');

if (searchBtn && searchContainer) {
    searchBtn.addEventListener('click', () => {
        searchContainer.classList.toggle('hidden');
        if (!searchContainer.classList.contains('hidden')) {
            searchContainer.querySelector('input').focus();
        }
    });
}

function toggleSearch() {
    if (searchContainer) {
        searchContainer.classList.toggle('hidden');
        if (!searchContainer.classList.contains('hidden')) {
            searchContainer.querySelector('input').focus();
        }
    }
}

function go(path) {
    window.location.href = path;
}

// Navbar Loading
document.addEventListener("DOMContentLoaded", () => {
    const bottomNavContainer = document.getElementById('bottom-nav');
    if (bottomNavContainer) {
        fetch("navbar.html")
            .then(r => r.text())
            .then(html => {
                bottomNavContainer.innerHTML = html;
                highlightActiveTab();
            });
    }
});

function highlightActiveTab() {
    const path = window.location.pathname;
    const page = path.split("/").pop();

    let activeId = "";
    if (page === "home.html" || page === "" || page === "index.html") activeId = "nav-chats";
    else if (page === "status.html") activeId = "nav-status";
    else if (page === "call.html" || page === "calls.html") activeId = "nav-calls";

    if (activeId) {
        const activeLink = document.getElementById(activeId);
        if (activeLink) {
            activeLink.classList.remove("text-gray-400");
            activeLink.classList.add("text-blue-600");
        }
    }
}
