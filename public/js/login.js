document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("login-btn");
  const errorMsg = document.getElementById("error-message");

  if(loginBtn) {
      loginBtn.addEventListener("click", async () => {
        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
          errorMsg.textContent = "Please enter both fields.";
          errorMsg.style.display = "block";
          return;
        }

        try {
          const response = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          const result = await response.json();

          if (result.success) {
            // Save User Data
            localStorage.setItem("loggedInUser", JSON.stringify(result.user));
            
            // 🔀 CONDITIONAL REDIRECT
            if (result.user.role === 'admin') {
                console.log("🚀 Redirecting to ADMIN Dashboard");
                window.location.href = "admin.html";
            } else {
                console.log("👋 Redirecting to USER Home");
                window.location.href = "home.html";
            }
            
          } else {
            errorMsg.textContent = result.message || "Invalid username or password.";
            errorMsg.style.display = "block";
          }
        } catch (err) {
          console.error("Error logging in:", err);
          errorMsg.textContent = "Server error. Please try again later.";
          errorMsg.style.display = "block";
        }
      });
  }
});