// js/navLoader.js
document.addEventListener("DOMContentLoaded", async () => {
    const placeholder = document.getElementById("navPlaceholder");
    if (!placeholder) return;

    // 1. Check User Role & Saved View Preference
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    const savedViewMode = localStorage.getItem("adminViewMode") || "admin"; 

    // 2. Apply View Mode Class IMMEDIATELY (Prevents flickering)
    if (user && user.role === 'admin') {
        if (savedViewMode === 'user') {
            document.body.classList.add('participant-view');
            document.body.classList.remove('admin-mode');
        } else {
            document.body.classList.add('admin-mode');
            document.body.classList.remove('participant-view');
        }
    }

    // 3. Determine which Nav File to load
    let navFile = 'nav.html'; 
    if (user && user.role === 'admin') {
        navFile = 'admin-nav.html';
    }

    try {
        // 4. Fetch the correct HTML file
        const res = await fetch(navFile);
        if (res.ok) {
            const html = await res.text();
            placeholder.innerHTML = html;

            highlightCurrentLink();
            
            // Initialize toggle logic if available (for mobile menu)
            if (window.initToggleLogic) window.initToggleLogic();
            
            // Update the button text immediately based on state
            updateSwitchButtonText();

        } else {
            console.error(`Failed to load ${navFile}`);
        }
    } catch (err) {
        console.error("Navigation Error:", err);
    }
});

function highlightCurrentLink() {
    const currentPage = window.location.pathname.split("/").pop() || "home.html";
    const links = document.querySelectorAll("nav a");
    links.forEach(link => {
        link.classList.remove("active", "active-admin");
        const href = link.getAttribute("href");
        if (href === currentPage) {
            if (link.closest(".admin-theme")) {
                link.classList.add("active-admin");
            } else {
                link.classList.add("active");
            }
        }
    });
}

// 5. HELPER: Update Button Text/Color
function updateSwitchButtonText() {
    const btnDesktop = document.getElementById("roleSwitchBtn");
    const btnMobile = document.getElementById("roleSwitchBtnMobile");
    const isUserView = document.body.classList.contains('participant-view');
    
    const text = isUserView ? "Back to Admin" : "Switch to User";
    const color = isUserView ? "#d90429" : "#666"; 

    if (btnDesktop) {
        btnDesktop.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        ${text}`;
        btnDesktop.style.color = color;
    }
    if (btnMobile) {
        btnMobile.textContent = text;
    }
}

// 6. 🔥 GLOBAL CLICK LISTENER (Fixes button not working on Admin.html)
document.addEventListener('click', (e) => {
    // Check if clicked element is the Switch Button (Desktop or Mobile)
    const btn = e.target.closest('#roleSwitchBtn') || e.target.closest('#roleSwitchBtnMobile');
    
    if (btn) {
        e.preventDefault();
        
        // Toggle Logic
        if (document.body.classList.contains('participant-view')) {
            // Switching BACK TO ADMIN
            localStorage.setItem("adminViewMode", "admin");
            document.body.classList.remove('participant-view');
            document.body.classList.add('admin-mode');
        } else {
            // Switching TO USER
            localStorage.setItem("adminViewMode", "user");
            document.body.classList.add('participant-view');
            document.body.classList.remove('admin-mode');
        }

        updateSwitchButtonText();

        // 🔥 FORCE REDIRECT TO HOME
        // This ensures if you are on 'admin.html', you go to a valid user page
        window.location.href = "home.html";
    }
});

// Mobile Dropdown Helper
window.toggleDropdown = function() {
    const menu = document.getElementById("mobileMenu");
    if (menu) {
        menu.style.display = (menu.style.display === "flex") ? "none" : "flex";
    }
};