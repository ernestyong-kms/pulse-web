// js/home.js

// 1. GLOBAL FUNCTION (Must be outside to work with onclick="")
window.openFeedbackModal = function(eventId) {
    console.log("Opening feedback for event:", eventId);
    const modal = document.getElementById('feedbackModal');
    if(modal) {
        document.getElementById('feedbackEventId').value = eventId;
        modal.style.display = 'flex';
    } else {
        console.error("Feedback modal not found!");
    }
};

document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user) return window.location.href = "index.html";

  // ============================================================
  // 0. SAFETY CLEANUP
  // ============================================================
  function forceUnlockScreen() {
      const blockerIds = ['scannedProfileModal', 'noteModal', 'feedbackModal'];
      blockerIds.forEach(id => {
          const el = document.getElementById(id);
          if (el && el.style.display !== 'none') el.style.display = 'none';
      });
      document.body.style.pointerEvents = "auto";
      document.body.style.overflow = "auto";
  }
  forceUnlockScreen();

  // ============================================================
  // 1. SETUP PAGE ELEMENTS
  // ============================================================
  const adminQuickHub = document.getElementById("adminQuickHub"); 
  const adminSnapshot = document.getElementById("adminSnapshotBar"); 
  const adminActivity = document.getElementById("adminActivitySection");
  const adminHeader = document.getElementById("adminHeaderContainer");
  
  const userWrapper = document.getElementById("userDashboardWrapper");
  const userWelcomeBanner = document.getElementById("userWelcomeBanner");
  const heroNameEl = document.getElementById("heroUserName");

  if (heroNameEl) heroNameEl.textContent = user.fullname; 

  // ============================================================
  // 2. DATA LOADING
  // ============================================================
  
  if (window.EventsModule) await EventsModule.loadEvents(user);
  
  // Load User Specifics
  updateHeroSection();
  initTodaysEvent(user); // 🔥 Updated "Happening Today" Logic
  
  if (window.QRModule) QRModule.initQR(user);
  if (window.ViewProfilesModule) await ViewProfilesModule.loadRecentActivity(user);

  // Admin View Logic
  if (user.role === 'admin') {
      if (adminHeader) {
          adminHeader.innerHTML = `
              <h1 style="font-size: 32px; font-weight: 700; color: #1a1a1a; margin: 0 0 5px 0;">Admin Command Center</h1>
              <p style="font-size: 16px; color: #666; margin: 0; font-weight: 500;">Control platform events, users, and networking logs.</p>
          `;
          adminHeader.style.marginBottom = "30px";
      }

      loadAdminDashboard(); 
      loadAdminActivity();

      const updateDashboardView = () => {
          const isUserView = document.body.classList.contains('participant-view');
          
          const displayAdmin = isUserView ? "none" : "block";
          const displayGrid = isUserView ? "none" : "grid";
          const displayUser = isUserView ? "block" : "none";

          if(adminQuickHub) adminQuickHub.style.display = displayGrid;
          if(adminSnapshot) adminSnapshot.style.display = displayGrid;
          if(adminActivity) adminActivity.style.display = displayAdmin;
          if(adminHeader) adminHeader.style.display = displayAdmin;

          if(userWrapper) userWrapper.style.display = displayUser;
          if(userWelcomeBanner) userWelcomeBanner.style.display = isUserView ? "flex" : "none";
      };

      updateDashboardView();
      window.addEventListener('viewModeChanged', updateDashboardView);
  } else {
      if(userWrapper) userWrapper.style.display = "block";
      if(userWelcomeBanner) userWelcomeBanner.style.display = "flex";
  }

  // ============================================================
  // ADMIN HELPER FUNCTIONS
  // ============================================================

  async function loadAdminDashboard() {
      try {
          const res = await fetch('/api/admin/stats');
          const data = await res.json();
          
          if(document.getElementById("snapUsers")) document.getElementById("snapUsers").textContent = data.users.count || 0;
          if(document.getElementById("snapEvents")) document.getElementById("snapEvents").textContent = data.eventsCount || 0;
          if(document.getElementById("snapScans")) document.getElementById("snapScans").textContent = data.connections.count || 0;
          if(document.getElementById("snapGrowth")) document.getElementById("snapGrowth").textContent = `+${data.users.pct || 0}%`;
      } catch (e) { console.error("Dashboard Stats Error:", e); }
  }

  async function loadAdminActivity() {
      const container = document.getElementById("adminActivityList");
      if(!container) return;
      try {
          const res = await fetch('/api/admin/activity');
          const data = await res.json();
          if(data.length === 0) {
              container.innerHTML = '<p style="padding:25px; color:#999; text-align:center;">No recent activity.</p>';
              return;
          }
          container.innerHTML = data.map(item => `
              <div style="display:flex; align-items:center; padding: 15px 25px; border-bottom: 1px solid #f0f0f0;">
                  <img src="${item.photo || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'}" style="width:35px; height:35px; border-radius:50%; margin-right:15px; object-fit:cover;">
                  <div style="flex:1;">
                      <div style="font-size:13px; font-weight:600; color:#333;">${item.name} registered for ${item.eventName}</div>
                  </div>
              </div>`).join('');
      } catch (e) { container.innerHTML = '<p style="padding:25px; color:red;">Failed to load activity.</p>'; }
  }

  // ============================================================
  // PARTICIPANT HELPER FUNCTIONS
  // ============================================================
    async function updateHeroSection() {
        try {
            const statsRes = await fetch(`/api/stats/summary/${user.username}`);
            const stats = await statsRes.json();
            // ... (points logic remains the same)

            const res = await fetch("/getEvents");
            const events = await res.json();
            
            const now = new Date();
            // Create a Date object for tomorrow at 00:00:00
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

            const upcomingEvents = events.filter(e => {
                if (!e.date) return false;
                const eventDate = new Date(e.date);
                // Show events happening tomorrow or further in the future
                return eventDate >= tomorrow;
            });

            // Sort by date so the very next one is at index 0
            upcomingEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

            const heroTitle = document.getElementById("heroEventName");
            const heroDesc = document.getElementById("heroEventDetails");
            const heroDate = document.getElementById("heroEventDate");
            const heroLoc = document.getElementById("heroEventLoc");
            
            if (upcomingEvents.length > 0) {
                const nextEvent = upcomingEvents[0];
                if(heroTitle) heroTitle.textContent = nextEvent.name;
                if(heroDesc) heroDesc.textContent = nextEvent.description ? nextEvent.description.substring(0, 60) + "..." : "No details";
                if(heroDate) heroDate.textContent = new Date(nextEvent.date).toLocaleDateString();
                if(heroLoc) heroLoc.textContent = nextEvent.location;
            } else {
                if(heroTitle) heroTitle.textContent = "No Upcoming Events";
                if(heroDesc) heroDesc.textContent = "You're all caught up!";
            }
        } catch (err) { console.error(err); }
    }

  // --- TODAY'S EVENT LOGIC (UPDATED VISUALS & LOGIC) ---
  async function initTodaysEvent(user) {
    try {
        const [eventsRes, regRes] = await Promise.all([
            fetch('/getEvents'),
            fetch(`/getUserRegistrations/${user.username}`)
        ]);

        const events = await eventsRes.json();
        const userRegistrations = await regRes.json(); 
        
        const now = new Date();
        const todayStr = now.toLocaleDateString();

        const activeEvents = events.filter(e => {
            const eventDate = new Date(e.date);
            const timeDiff = now - eventDate;
            const hoursSince = timeDiff / (1000 * 60 * 60);
            const isToday = eventDate.toLocaleDateString() === todayStr;
            const isRecent = hoursSince > 0 && hoursSince < 48; 
            return isToday || isRecent;
        });

        const section = document.getElementById('todaysEventSection');
        if (!section) return;

        if (activeEvents.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        section.style.display = 'grid'; 
        section.style.gap = '20px';
        section.innerHTML = '';

        for (const event of activeEvents) {
            const isRegistered = userRegistrations.includes(event.id);
            
            // Check In & Rating Status
            let isCheckedIn = false;
            let hasRated = false;

            if (isRegistered) {
                const [checkRes, rateRes] = await Promise.all([
                    fetch(`/api/checkin/status/${user.username}/${event.id}`),
                    fetch(`/api/feedback/status/${user.username}/${event.id}`)
                ]);
                const checkData = await checkRes.json();
                const rateData = await rateRes.json();
                isCheckedIn = checkData.checkedIn;
                hasRated = rateData.submitted;
            }

            const eventDate = new Date(event.date);
            const hoursSince = (now - eventDate) / (1000 * 60 * 60);
            const isEventOver = hoursSince > 0;
            const eventImg = event.photo_url || '/uploads/default_event.jpg';

            // --- BUILD ACTION BUTTONS ---
            let actionHTML = '';

            // Clean SVGs
            const iconCheck = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            const iconMap = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`; 
            const iconQR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;
            const iconStar = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
            const iconClock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

            if (!isRegistered) {
                // Not Registered -> Register Button
                actionHTML = `
                    <button onclick="window.location.href='events.html'" class="btn-checkin" style="background: white; color: black; box-shadow:none;">
                        Register Now
                    </button>`;
            } 
            else if (!isEventOver || hoursSince < 48) { 
                if (!isCheckedIn) {
                    // Registered, Not Checked In -> Check In Button
                    actionHTML = `
                        <button id="btnCheckIn_${event.id}" class="btn-checkin">
                            ${iconMap}
                            <span>Check In</span>
                        </button>`;
                } else {
                    // Checked In -> View QR + Status
                    actionHTML = `
                        <button id="btnViewQR_${event.id}" class="btn-qr-view">
                            ${iconQR}
                            <span>View QR</span>
                        </button>
                        <div class="status-checked">
                            ${iconCheck} Checked In
                        </div>`;
                }
            }

            // Rating Button (Only if checked in & not rated)
            // Note: We use window.openFeedbackModal explicitly
            if (isCheckedIn && !hasRated) {
                actionHTML += `
                    <button onclick="window.openFeedbackModal(${event.id})" class="btn-rate">
                        ${iconStar} Rate
                    </button>`;
            }

            // --- HTML STRUCTURE (Cinematic) ---
            const card = document.createElement('div');
            card.className = 'todays-event-card';

            card.innerHTML = `
                <div class="t-card-bg" style="background-image: url('${eventImg}');"></div>
                <div class="t-card-overlay"></div>
                
                <div class="live-badge">
                    <div class="live-dot"></div> happening today                </div>

                <div class="t-card-content">
                    <div class="t-event-info">
                        <h3 class="t-event-title">${event.name}</h3>
                        <div class="t-event-meta">
                            <div class="t-meta-item">
                                ${iconClock}
                                <span>${event.time}</span>
                            </div>
                            <div class="t-meta-item">
                                ${iconMap}
                                <span>${event.location}</span>
                            </div>
                        </div>
                    </div>

                    <div class="t-card-actions">
                        ${actionHTML}
                    </div>
                </div>
            `;

            section.appendChild(card);

            // --- BIND CLICKS ---
            const checkInBtn = document.getElementById(`btnCheckIn_${event.id}`);
            if (checkInBtn) {
                checkInBtn.onclick = async () => {
                    const originalHTML = checkInBtn.innerHTML;
                    checkInBtn.innerHTML = "<span>Processing...</span>";
                    checkInBtn.style.opacity = "0.7";
                    try {
                        const res = await fetch('/api/checkin', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: user.username, event_id: event.id })
                        });
                        const data = await res.json();
                        if (data.success) initTodaysEvent(user);
                        else { alert(data.message); checkInBtn.innerHTML = originalHTML; checkInBtn.style.opacity = "1"; }
                    } catch (e) { console.error(e); }
                };
            }

            const qrBtn = document.getElementById(`btnViewQR_${event.id}`);
            if (qrBtn) {
                qrBtn.onclick = async () => {
                    try {
                        const res = await fetch(`/getRegistration/${user.username}/${event.id}`);
                        const data = await res.json();
                        if (data.qrToken && window.RegistrationModule) {
                            window.RegistrationModule.showQRModal(data.qrToken);
                        }
                    } catch(e) {}
                };
            }
        }

    } catch (e) { console.error("Todays Event Error:", e); }
  }

  // Feedback Submission
  const submitFeedbackBtn = document.getElementById("submitFeedbackBtn");
  if(submitFeedbackBtn) {
      submitFeedbackBtn.onclick = async () => {
          const eventId = document.getElementById('feedbackEventId').value;
          const rating = document.getElementById('selectedRating').value;
          const comment = document.getElementById('feedbackComment').value;
          if(rating === "0") return alert("Please select a star rating.");
          
          try {
              const res = await fetch('/api/feedback', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ event_id: eventId, username: user.username, rating, comment })
              });
              const data = await res.json();
              if(data.success) {
                  document.getElementById('feedbackModal').style.display = 'none';
                  alert("Thanks for your feedback!");
                  initTodaysEvent(user); // Reload to hide button
              }
          } catch(e) { alert("Error submitting feedback."); }
      };
  }
});