// js/adminLoader.js
document.addEventListener("DOMContentLoaded", async () => {
    const placeholder = document.getElementById('navPlaceholder');

    if (placeholder) {
        try {
            // Fetch the ADMIN navigation
            const response = await fetch('admin-nav.html');
            const navHtml = await response.text();
            
            placeholder.innerHTML = navHtml;
            
            // Initialize toggle logic immediately
            if (window.initToggleLogic) {
                window.initToggleLogic();
            }
        } catch (error) {
            console.error("Failed to load admin nav:", error);
        }
    }
});