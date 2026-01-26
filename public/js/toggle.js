// js/toggle.js

// 1. MOBILE TOGGLE
window.toggleMobileMode = function() {
    const body = document.body;
    const toggleSwitch = document.getElementById('mobileToggle');
    
    // Toggle
    body.classList.toggle('mobile-view');
    
    // Save State
    const isMobile = body.classList.contains('mobile-view');
    localStorage.setItem('pulseMobileMode', isMobile);
    
    // Sync Switch
    if (toggleSwitch && toggleSwitch.checked !== isMobile) {
        toggleSwitch.checked = isMobile;
    }

    // Force Resize Charts (for Analytics)
    if (window.Chart) {
        Object.values(Chart.instances).forEach(chart => chart.resize());
    }
};

// 2. 🔥 DARK MODE TOGGLE (New)
window.toggleDarkMode = function() {
    const body = document.body;
    const toggleSwitch = document.getElementById('darkModeToggle');
    
    // Toggle
    body.classList.toggle('dark-mode');
    
    // Save State
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('pulseDarkMode', isDark);
    
    // Sync Switch
    if (toggleSwitch && toggleSwitch.checked !== isDark) {
        toggleSwitch.checked = isDark;
    }
};

// 3. GLOBAL SYNC (Called by NavLoader on page load)
window.syncState = function() {
    const body = document.body;

    // A. Sync Mobile Mode
    const isMobile = localStorage.getItem('pulseMobileMode') === 'true';
    if (isMobile) body.classList.add('mobile-view');
    const mobSwitch = document.getElementById('mobileToggle');
    if (mobSwitch) mobSwitch.checked = isMobile;

    // B. Sync Dark Mode
    const isDark = localStorage.getItem('pulseDarkMode') === 'true';
    if (isDark) body.classList.add('dark-mode');
    const darkSwitch = document.getElementById('darkModeToggle');
    if (darkSwitch) darkSwitch.checked = isDark;
};

// 4. HAMBURGER MENU
window.toggleDropdown = function() {
    const menu = document.getElementById('mobileMenu');
    if (menu) {
        menu.style.display = (menu.style.display === 'flex') ? 'none' : 'flex';
    }
};

// 5. AUTO-RUN (Prevent flashing)
(function() {
    const isMobile = localStorage.getItem('pulseMobileMode') === 'true';
    if (isMobile) document.body.classList.add('mobile-view');

    const isDark = localStorage.getItem('pulseDarkMode') === 'true';
    if (isDark) document.body.classList.add('dark-mode');
})();