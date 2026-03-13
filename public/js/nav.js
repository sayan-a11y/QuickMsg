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
    if (page.includes("home") || page === "" || page.includes("index") || page === "/") activeId = "nav-chats";
    else if (page.includes("status")) activeId = "nav-status";
    else if (page.includes("call")) activeId = "nav-calls";

    if (activeId) {
        const activeLink = document.getElementById(activeId);
        if (activeLink) {
            activeLink.classList.remove("text-gray-400");
            activeLink.classList.add("text-blue-600");
        }
    }
}
