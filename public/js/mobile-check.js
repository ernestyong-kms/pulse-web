// mobile-check.js
(function() {
    function checkMobile() {
        // If screen is 768px or less, force mobile view
        if (window.innerWidth <= 768) {
            document.body.classList.add('mobile-view');
        } else {
            // Optional: Remove if resized back to desktop
            // document.body.classList.remove('mobile-view');
        }
    }

    // Run immediately
    checkMobile();
    
    // Check on resize (optional, but good for testing)
    window.addEventListener('resize', checkMobile);
})();