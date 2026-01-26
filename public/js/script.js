document.addEventListener("DOMContentLoaded", () => {
  const loginPage = document.getElementById("loginPage");
  const home = document.getElementById("home");
  const loginBtn = document.getElementById("loginBtn");
  const profileBtn = document.getElementById("profileBtn");
  const adminControls = document.getElementById("adminControls");
  const createEventBtn = document.getElementById("createEventBtn");
  const eventsContainer = document.getElementById("eventsContainer");

  loginBtn?.addEventListener("click", async () => {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem("user", JSON.stringify(data.user));
      showHomePage(data.user);
    } else {
      alert("Invalid login");
    }
  });

  profileBtn?.addEventListener("click", () => {
    window.location.href = "profile.html";
  });

  createEventBtn?.addEventListener("click", async () => {
    const name = document.getElementById("eventName").value;
    const desc = document.getElementById("eventDesc").value;
    if (!name || !desc) return alert("Please fill all fields");

    const res = await fetch("/createEvent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, desc })
    });

    const data = await res.json();
    if (data.success) {
      alert("Event created!");
      loadEvents();
    }
  });

  function showHomePage(user) {
    loginPage.classList.add("hidden");
    home.classList.remove("hidden");

    if (user.role === "admin") {
      adminControls.classList.remove("hidden");
    } else {
      adminControls.classList.add("hidden");
    }

    loadEvents();
  }

  async function loadEvents() {
    const res = await fetch("/events");
    const events = await res.json();

    eventsContainer.innerHTML = "";
    events.forEach(ev => {
      const div = document.createElement("div");
      div.classList.add("event-card");
      div.innerHTML = `
        <h3>${ev.name}</h3>
        <p>${ev.desc}</p>
        <button onclick="registerEvent('${ev.name}')">Register</button>
      `;
      eventsContainer.appendChild(div);
    });
  }

  window.registerEvent = async (eventName) => {
    const user = JSON.parse(sessionStorage.getItem("user"));
    const res = await fetch("/registerEvent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username, eventName })
    });
    const data = await res.json();
    alert(data.message);
  };

  const user = JSON.parse(sessionStorage.getItem("user"));
  if (user) showHomePage(user);
});
