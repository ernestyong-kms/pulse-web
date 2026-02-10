// js/events.js

window.EventsModule = {
    allEvents: [],
    userRegistrations: [],
    
    // Pagination State
    adminCurrentPage: 1,
    rowsPerPage: 10,

    init: async function(user) {
        console.log("EventsModule: Initializing...");
        try {
            const [eventsRes, regRes] = await Promise.all([
                fetch('/getEvents'),
                fetch(`/getUserRegistrations/${user.username}`)
            ]);

            if (eventsRes.ok) this.allEvents = await eventsRes.json();
            if (regRes.ok) this.userRegistrations = await regRes.json();

            // Handle UI Views
            if (document.getElementById("eventsGridContainer")) {
                this.loadEventsGrid(user);
                this.loadPastEventsGrid(user);
            } else if (document.getElementById("eventContainer")) {
                this.loadDashboardEvents(user);
            }

        } catch (err) {
            console.error("EventsModule Error:", err);
            const grid = document.getElementById("eventsGridContainer") || document.getElementById("eventContainer");
            if (grid) grid.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Error connecting to platform services.</p>`;
        }
    },

    loadEvents: async function(user) { await this.init(user); },

    // --- 2. SMART MATCH (PER-EVENT POPUP) ---
    loadSmartMatches: async function(event, user) {
        const popup = document.getElementById("smartMatchPopup");
        const list = document.getElementById("smartMatchList");
        if (!popup || !list) return;

        list.innerHTML = '<div style="padding:40px; text-align:center;"><div class="loader-pulse"></div><p style="color:#999; margin-top:10px; font-size:13px;">Analyzing network compatibility...</p></div>';
        popup.style.display = "flex";

        try {
            const res = await fetch(`/api/event/${event.id}/smart-matches?username=${user.username}`);
            const matches = await res.json();

            if (matches.length === 0) {
                list.innerHTML = `
                    <div style="padding:30px; text-align:center; background:#f8f9fa; border-radius:20px;">
                        <div style="font-size:30px; margin-bottom:10px;">🤖</div>
                        <p style="font-size:14px; font-weight:700; color:#333; margin-bottom:5px;">Scanning for matches...</p>
                        <p style="font-size:12px; color:#666; line-height:1.4;">No direct compatibility found yet. Try adding more skills to your profile to improve AI detection!</p>
                    </div>`;
                return;
            }

            list.innerHTML = matches.map(p => {
                const tags = p.common_tags || [];
                const tagsDisplay = tags.slice(0, 2).map(t => `<span class="match-tag" style="background:#fff0f3; color:#d90429; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:700; text-transform:capitalize;">${t}</span>`).join(' ');
                
                return `
                    <div class="match-item" style="display:flex; align-items:center; background:white; padding:15px; border-radius:18px; gap:15px; border:1px solid #f0f0f0; transition:0.2s;">
                        <img src="${p.photo_url || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                        <div style="flex:1;">
                            <div style="font-size:14px; font-weight:800; color:#1a1a1a;">${p.fullname}</div>
                            <div style="font-size:11px; color:#666; margin-bottom:6px;">${p.position || 'Attendee'}</div>
                            <div style="display:flex; gap:5px; flex-wrap:wrap;">${tagsDisplay}${tags.length > 2 ? `<span style="font-size:10px; color:#999; font-weight:600;">+${tags.length - 2}</span>` : ''}</div>
                        </div>
                    </div>`;
            }).join('');
        } catch (e) { list.innerHTML = `<p style="color:#d90429; font-size:13px; text-align:center;">AI Matcher encountered a temporary error.</p>`; }
    },

    // --- 3. CORE EVENT ENGINE ---
    loadEventsGrid: function(user, categoryFilter = 'All events', searchTerm = '') {
        const container = document.getElementById("eventsGridContainer");
        if (!container) return;

        if (this.shouldShowAdminUI(user)) {
            this.renderAdminView(container, user, categoryFilter, searchTerm);
            return;
        }

        container.classList.add('events-grid');
        let upcoming = this.allEvents.filter(e => !this.isEventPast(e));
        if (categoryFilter !== "All events") upcoming = upcoming.filter(e => e.category === categoryFilter);
        if (searchTerm) upcoming = upcoming.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
        upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

        container.innerHTML = "";
        if (upcoming.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #888;">No upcoming events found.</div>`;
        } else {
            upcoming.forEach(event => {
                this.renderUserCard(container, event, user, () => this.init(user), true, false);
            });
        }
    },

    loadPastEventsGrid: function(user) {
        const container = document.getElementById("pastEventsGridContainer");
        if (!container || this.shouldShowAdminUI(user)) {
             if(container && container.parentElement) container.parentElement.style.display = 'none';
             return;
        }
        let past = this.allEvents.filter(e => this.isEventPast(e));
        past.sort((a, b) => new Date(b.date) - new Date(a.date));
        container.innerHTML = "";
        if (past.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; color: #999; font-style:italic;">No past events found.</p>';
            return;
        }
        container.classList.add('events-grid'); 
        past.forEach(event => this.renderUserCard(container, event, user, null, true, true));
    },

    loadDashboardEvents: function(user) {
        const container = document.getElementById("eventContainer");
        if(!container) return;
        
        if (this.shouldShowAdminUI(user)) {
            this.renderAdminView(container, user);
            return;
        }

        let upcoming = this.allEvents.filter(e => !this.isEventPast(e));
        upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
        container.innerHTML = "";

        if (upcoming.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#888;">No upcoming events.</div>`;
            return;
        }
        upcoming.forEach(event => this.renderUserCard(container, event, user, () => this.init(user), false, false));
    },

    renderUserCard: function(container, event, user, reloadCallback, isGrid, isPast) {
        const card = document.createElement("div");
        card.classList.add(isGrid ? "grid-event-card" : "event-card");
        if (isPast) { 
            card.style.opacity = "0.7"; 
            card.style.filter = "grayscale(100%)"; 
        } 

        const isRegistered = this.userRegistrations.includes(event.id);
        const d = new Date(event.date);
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const timeStr = event.time || d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let badgeHtml = isRegistered 
            ? `<div class="badge-registered">Registered</div>` 
            : (isPast ? `<div class="badge-registered" style="background:#64748b;">Ended</div>` : '');

        const imageHtml = event.photo_url 
            ? `<img src="${event.photo_url}" class="card-main-img">` 
            : `<div class="card-image-placeholder" style="background:#f8fafc; display:flex; align-items:center; justify-content:center; color:#cbd5e1; font-weight:700;">No Image</div>`;

        if (isGrid) {
           card.innerHTML = `
              <div class="card-image-placeholder">
                  ${imageHtml}
                  ${badgeHtml}
                  <div class="card-date-badge">${dateStr}</div>
              </div>
              
              <div class="card-content">
                  <div class="card-title" style="margin-bottom: 5px;">${event.name}</div>
                  
                  <div class="card-meta-row">
                      <div class="card-meta-item">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                          <span>${timeStr}</span>
                      </div>
                      <div class="card-meta-item">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                          <span>${event.location}</span>
                      </div>
                  </div>

                  <p class="card-desc" style="color:#64748b; font-size:13px; line-height:1.5;">${event.description || ''}</p>
                  
                  <div class="action-area" style="margin-top:auto; padding-top:10px;"></div>
              </div>`;
        } else {
           card.className = "minimal-event-card"; 
           const imgHtml = event.photo_url ? `<img src="${event.photo_url}" class="minimal-card-img">` : `<div class="minimal-card-img-placeholder"></div>`;
           card.innerHTML = `${imgHtml}<div class="minimal-card-content"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="minimal-date">${dateStr}</div>${isRegistered ? '<span class="status-badge-mini">GOING</span>' : ''}</div><h3 class="minimal-title">${event.name}</h3><p class="minimal-desc">${event.description || ''}</p></div>`;
        }

        card.onclick = (e) => { if (!e.target.closest('.action-area')) this.showEventDetails(event); };
        
        const actionArea = card.querySelector(".action-area");
        if (actionArea) {
            if (isPast) {
                actionArea.innerHTML = `<button disabled class="btn-ended" style="width:100%; padding:10px; background:#f1f5f9; color:#94a3b8; border:none; border-radius:8px; font-weight:600;">Event Ended</button>`;
            } else if (window.RegistrationModule) {
                RegistrationModule.appendRegistrationButtons(actionArea, event, isRegistered, user, reloadCallback);
                if (isRegistered) {
                    const matchBtn = document.createElement("button");
                    matchBtn.innerHTML = `<span>Suggested Connections</span><span class="ai-sparkle">✨</span>`;
                    matchBtn.className = "btn-ai-match";
                    matchBtn.onclick = (e) => { e.stopPropagation(); this.loadSmartMatches(event, user); };
                    actionArea.appendChild(matchBtn);
                }
            }
        }
        container.appendChild(card);
    },

    // --- 4. UTILS & ADMIN TABLE (WITH PAGINATION) ---
    renderAdminView: function(container, user, catFilter='All events', search='') {
        // 1. Create a shallow copy so we don't mess up the global order
        let filtered = [...this.allEvents];

        // 2. Apply Filters
        if (catFilter !== "All events") filtered = filtered.filter(e => e.category === catFilter);
        if (search) filtered = filtered.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
        
        // 🔥 FIX: Sort by Date DESCENDING (Newest/Future First)
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Reset to page 1 if filter changes drastically reduce count
        const maxPage = Math.ceil(filtered.length / this.rowsPerPage) || 1;
        if (this.adminCurrentPage > maxPage) this.adminCurrentPage = 1;

        container.classList.remove('events-grid');
        container.style.display = 'block'; 
        this.renderAdminTable(container, filtered, user);
    },

    renderAdminTable: function(container, events, user) {
        if (!events.length) { container.innerHTML = `<div style="text-align:center; padding:40px; color:#888;">No events found.</div>`; return; }
        
        // PAGINATION LOGIC
        const totalPages = Math.ceil(events.length / this.rowsPerPage);
        const start = (this.adminCurrentPage - 1) * this.rowsPerPage;
        const end = start + this.rowsPerPage;
        const paginatedEvents = events.slice(start, end);

        const table = document.createElement("table"); 
        table.className = "admin-table";
        table.innerHTML = `<thead><tr><th>Event Details</th><th>Date</th><th>Category</th><th>Status</th><th style="text-align: right;">Actions</th></tr></thead><tbody id="adminTableBody"></tbody>`;
        const tbody = table.querySelector("#adminTableBody");
        
        paginatedEvents.forEach(event => {
            const tr = document.createElement("tr");
            const isPast = this.isEventPast(event);
            tr.innerHTML = `
            <td>
                <div class="event-title-text">${event.name}</div>
                <div class="event-loc-text">${event.location}</div>
            </td>
            <td>${new Date(event.date).toLocaleDateString()}</td>
            <td><span class="admin-cat-pill">${event.category || 'General'}</span></td>
            <td><span class="status-pill ${isPast ? 'past' : 'upcoming'}">${isPast ? 'Past' : 'Upcoming'}</span></td>
            <td style="text-align:right;">
                <button class="action-btn" onclick="window.openAttendees(${event.id}, '${event.name.replace(/'/g, "\\'")}')">Users</button>
                <button class="action-btn" onclick="window.editEvent(${event.id})">Edit</button>
                <button class="action-btn" style="color: #ef4444;" onclick="window.deleteEvent(${event.id})">Delete</button>
            </td>`;
            tbody.appendChild(tr);
        });
        
        container.innerHTML = '';
        container.appendChild(table);

        // RENDER PAGINATION CONTROLS
        if (totalPages > 1) {
            const paginationDiv = document.createElement("div");
            paginationDiv.className = "pagination-controls";

            // Prev Button
            const prevBtn = document.createElement("button");
            prevBtn.className = "page-btn";
            prevBtn.innerHTML = "&laquo; Prev";
            prevBtn.disabled = this.adminCurrentPage === 1;
            prevBtn.onclick = () => {
                this.adminCurrentPage--;
                this.renderAdminTable(container, events, user);
            };
            paginationDiv.appendChild(prevBtn);

            // Number Buttons
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= this.adminCurrentPage - 1 && i <= this.adminCurrentPage + 1)) {
                    const btn = document.createElement("button");
                    btn.className = `page-btn ${i === this.adminCurrentPage ? 'active' : ''}`;
                    btn.textContent = i;
                    btn.onclick = () => {
                        this.adminCurrentPage = i;
                        this.renderAdminTable(container, events, user);
                    };
                    paginationDiv.appendChild(btn);
                } else if ((i === this.adminCurrentPage - 2 && i > 1) || (i === this.adminCurrentPage + 2 && i < totalPages)) {
                    const dots = document.createElement("span");
                    dots.textContent = "...";
                    dots.style.color = "#999";
                    paginationDiv.appendChild(dots);
                }
            }

            // Next Button
            const nextBtn = document.createElement("button");
            nextBtn.className = "page-btn";
            nextBtn.innerHTML = "Next &raquo;";
            nextBtn.disabled = this.adminCurrentPage === totalPages;
            nextBtn.onclick = () => {
                this.adminCurrentPage++;
                this.renderAdminTable(container, events, user);
            };
            paginationDiv.appendChild(nextBtn);

            container.appendChild(paginationDiv);
        }
    },

    showEventDetails: function(event) {
        let overlay = document.getElementById("eventDetailsPopup");
        if(!overlay) { overlay = document.createElement("div"); overlay.id = "eventDetailsPopup"; overlay.classList.add("modal"); document.body.appendChild(overlay); }
        const d = new Date(event.date); 
        overlay.innerHTML = `<div class="details-card"><div style="padding:25px; overflow-y:auto;"><h2>${event.name}</h2><p style="color: #666; font-size:14px; margin-top:5px;">${d.toDateString()}</p><p style="margin-top: 20px; line-height: 1.6; color:#333;">${event.description || 'No additional details available.'}</p></div><button onclick="document.getElementById('eventDetailsPopup').style.display='none'" class="btn-close-modal">Close</button></div>`;
        overlay.style.display = "flex";
    },

    isEventPast: function(event) {
        const now = new Date();
        const eventDate = new Date(event.date);
        eventDate.setHours(23, 59, 59); // End of the event day
        return now > eventDate;
    },

    shouldShowAdminUI: function(user) {
        return user.role === 'admin' && !document.body.classList.contains('participant-view');
    }
};

// DELETE EVENT FUNCTION
window.deleteEvent = async function(id) {
    if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;

    try {
        const res = await fetch(`/deleteEvent/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            alert("Event deleted successfully.");
            const user = JSON.parse(localStorage.getItem("loggedInUser"));
            if (window.EventsModule && user) {
                window.EventsModule.init(user);
            } else {
                location.reload();
            }
        } else {
            alert("Failed to delete event: " + data.message);
        }
    } catch (e) {
        console.error("Delete Error:", e);
        alert("An error occurred while deleting the event.");
    }
};