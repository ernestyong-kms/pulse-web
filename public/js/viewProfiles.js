// js/viewProfiles.js
window.ViewProfilesModule = (() => {

  async function fetchConnections(username) {
    try {
      const res = await fetch(`/connections?scanner_username=${username}`);
      return await res.json(); 
    } catch (err) { console.error(err); return []; }
  }

  function prepareProfileData(conn, currentUser) {
      const otherUsername = (conn.scanner_username === currentUser.username) 
          ? conn.scanned_username 
          : conn.scanner_username;

      return {
          ...conn,
          username: otherUsername,
          name: conn.name || "Unknown",
          company: conn.company || "",
          position: conn.position || "",
          email: conn.email || "",
          photo: conn.photo || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
          skills: conn.skills || "-",
          specialInterests: conn.specialInterests || "-",
          qualifications: conn.qualifications || "-"
      };
  }

  function getJobDisplayHTML(profile) {
      const pPos = profile.position || '';
      const pComp = profile.company || '';
      const hasCompany = pComp && pComp.toLowerCase() !== 'n/a' && pComp.trim() !== '';
      const hasPos = pPos && pPos.toLowerCase() !== 'n/a' && pPos.trim() !== '';

      if (hasPos && hasCompany) return `${pPos} <span style="opacity:0.6">@</span> ${pComp}`;
      else if (hasPos) return pPos;
      else if (hasCompany) return pComp;
      else return `<span style="font-style:italic; opacity:0.8; font-weight:400;">Open to Opportunities</span>`;
  }

  function openProfileModal(profile, currentUser) {
      const modal = document.getElementById("scannedProfileModal");
      if(!modal) return;

      const photoEl = document.getElementById("scanPhoto");
      if(photoEl) photoEl.src = profile.photo;
      const nameEl = document.getElementById("scanName");
      if(nameEl) nameEl.textContent = profile.name;
      const jobEl = document.getElementById("scanJob");
      if(jobEl) jobEl.innerHTML = getJobDisplayHTML(profile);

      const detailsEl = document.getElementById("scanDetails");
      if(detailsEl) {
          detailsEl.innerHTML = `
              <div style="margin-bottom:12px; text-align:left;">
                  <strong style="color:#d90429; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Qualifications</strong><br>
                  <span style="color:#333; font-size:14px;">${profile.qualifications}</span>
              </div>
              <div style="margin-bottom:12px; text-align:left;">
                  <strong style="color:#d90429; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Skills</strong><br>
                  <span style="color:#333; font-size:14px;">${profile.skills}</span>
              </div>
              <div style="text-align:left;">
                  <strong style="color:#d90429; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Interests</strong><br>
                  <span style="color:#333; font-size:14px;">${profile.specialInterests}</span>
              </div>
          `;
      }

      // DELETE BUTTON LOGIC
      const closeBtn = document.getElementById("closeScannedModal");
      const existingDel = document.getElementById("modalDeleteBtn");
      if(existingDel) existingDel.remove();

      const deleteBtn = document.createElement("button");
      deleteBtn.id = "modalDeleteBtn";
      deleteBtn.textContent = "Remove Connection";
      deleteBtn.style.cssText = "width: 100%; margin-top: 10px; background: transparent; color: #dc2626; border: 1px solid #dc2626; padding: 12px; border-radius: 12px; font-weight: 600; cursor: pointer; opacity: 0.8; transition: opacity 0.2s;";
      deleteBtn.onmouseover = () => deleteBtn.style.opacity = "1";
      deleteBtn.onmouseout = () => deleteBtn.style.opacity = "0.8";
      
      if(closeBtn) {
          closeBtn.parentNode.insertBefore(deleteBtn, closeBtn.nextSibling);
      }

      deleteBtn.onclick = async () => {
          if(!confirm(`Are you sure you want to remove ${profile.name} from your network?`)) return;
          deleteBtn.textContent = "Removing...";
          try {
              const res = await fetch(`/connection?user1=${currentUser.username}&user2=${profile.username}`, { method: 'DELETE' });
              const result = await res.json();
              if(result.success) {
                  modal.style.display = "none";
                  loadNetworkPage(currentUser); 
              } else {
                  alert("Error removing connection.");
              }
          } catch(err) { console.error(err); alert("Server error."); }
      };

      const msgEl = document.getElementById("connectionMessage");
      if(msgEl) msgEl.style.display = "none";
      modal.style.display = "flex";
      if(closeBtn) closeBtn.onclick = () => { modal.style.display = "none"; };
      modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
  }

  // 🚀 MAIN LOGIC: Network Page
  async function loadNetworkPage(currentUser) {
    const container = document.getElementById("networkContainer");
    const searchInput = document.getElementById("networkSearchInput");
    const eventFilter = document.getElementById("eventFilter");

    if (!container) return;
    container.innerHTML = '<p>Loading network...</p>';
    
    // Fetch Only Connections (No Inbox needed here anymore)
    const allConnections = await fetchConnections(currentUser.username);

    if(eventFilter) {
        const events = [...new Set(allConnections.map(c => c.event_name || "Unknown Event"))];
        eventFilter.innerHTML = '<option value="all">All Events</option>';
        events.forEach(evt => {
            const opt = document.createElement("option");
            opt.value = evt;
            opt.textContent = evt;
            eventFilter.appendChild(opt);
        });
    }

    function render(connections) {
        if (!connections.length) {
            container.innerHTML = "<p style='color:#888; grid-column:1/-1; text-align:center;'>No matches found.</p>";
            return;
        }
        container.innerHTML = "";

        connections.forEach(conn => {
            const card = document.createElement("div");
            card.className = "network-card";
            const profile = prepareProfileData(conn, currentUser);
            
            let isIncoming = false;
            if (conn.connectionType) isIncoming = conn.connectionType === 'incoming';
            else isIncoming = conn.scanner_username !== currentUser.username;
            
            const cardBg = isIncoming ? 'linear-gradient(145deg, #eff6ff 0%, #ffffff 100%)' : 'linear-gradient(145deg, #fef2f2 0%, #ffffff 100%)';
            const metaBg = isIncoming ? '#dbeafe' : '#fee2e2'; 
            const themeColor = isIncoming ? '#2563eb' : '#dc2626'; 
            const borderColor = isIncoming ? '#93c5fd' : '#fca5a5';
            const shadowColor = isIncoming ? 'rgba(37, 99, 235, 0.1)' : 'rgba(220, 38, 38, 0.1)';
            const badgeText = isIncoming ? 'Scanned You' : 'You Scanned';

            card.style.cssText = `background: ${cardBg}; border: 1px solid ${borderColor}; border-radius: 16px; padding: 25px; box-shadow: 0 8px 25px ${shadowColor}; display: flex; flex-direction: column; gap: 15px; transition: transform 0.2s; position: relative;`;

            const jobDisplayHTML = getJobDisplayHTML(profile);
            const noteText = conn.note || "";
            const hasNote = noteText.trim() !== "";
            const noteDisplayHtml = hasNote ? `<div class="note-display" style="color: #333; font-style: normal; margin-bottom:5px;">${noteText}</div>` : `<div class="note-display" style="color: #888; font-style: italic; font-size: 13px;">No notes added...</div>`;

            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px;">
                    <img src="${profile.photo}" style="width: 50px; height: 50px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); object-fit: cover;">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <h3 style="margin:0; font-size:16px; color:#1a1a1a;">${profile.name}</h3>
                            <span style="font-size:10px; font-weight:700; background:${themeColor}; color:white; padding:3px 8px; border-radius:6px; text-transform:uppercase; letter-spacing:0.5px;">${badgeText}</span>
                        </div>
                        <p style="margin:2px 0 0; font-size:12px; color:#4b5563; font-weight: 500;">${jobDisplayHTML}</p>
                    </div>
                </div>
                <div class="network-meta-box" style="background: ${metaBg} !important; padding: 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.03);">
                    <div class="network-meta-label" style="font-size: 11px; text-transform: uppercase; color: #555; font-weight: 700;">Met At</div>
                    <div style="color: #111; font-weight: 600; font-size: 13px;">${conn.event_name || "Unknown Event"}</div>
                </div>
                <div style="font-size: 13px; background: rgba(255,255,255,0.7); padding: 12px; border-radius: 10px; border: 1px dashed ${borderColor};">
                    <div class="network-meta-label" style="font-size: 11px; text-transform: uppercase; color: #555; font-weight: 700; margin-bottom: 4px;">My Note</div>
                    ${noteDisplayHtml}
                </div>
                <div style="display:flex; flex-direction:column; gap:8px; margin-top:auto;">
                    <div style="display:flex; gap:10px;">
                        <button class="btn-profile" style="flex:1; padding:10px; border:1px solid #fff; background:white; color:#333; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">Profile</button>
                        <button class="btn-msg" style="flex:1; padding:10px; border:none; background:${themeColor}; color:white; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px; box-shadow: 0 4px 10px ${shadowColor};">Message</button>
                    </div>
                    <button class="editNoteBtn" style="width:100%; padding:8px; border:none; background:rgba(255,255,255,0.9); color:#333; border-radius:8px; cursor:pointer; font-weight:600; font-size:12px; transition: background 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.05);"
                        data-scanner="${currentUser.username}" data-scanned="${profile.username || profile.scanned_username || profile.scanner_username}" data-event="${conn.event_id}" data-note="${noteText}">
                        ${hasNote ? '✎ Edit Note' : '+ Add Note'}
                    </button>
                </div>
            `;
            
            card.querySelector(".btn-profile").onclick = () => { openProfileModal(profile, currentUser); };
            
            // 🔥 REDIRECT TO MESSAGES PAGE
            card.querySelector(".btn-msg").onclick = () => {
                window.location.href = `/messages.html?chatWith=${profile.username}`;
            };

            container.appendChild(card);
        });
    }

    function applyFilters() {
        const query = searchInput ? searchInput.value.toLowerCase() : "";
        const eventVal = eventFilter ? eventFilter.value : "all";

        const filtered = allConnections.filter(conn => {
            const name = (conn.name || "").toLowerCase();
            const company = (conn.company || "").toLowerCase();
            const eventName = (conn.event_name || "").toLowerCase();
            
            const matchesSearch = name.includes(query) || company.includes(query);
            const matchesEvent = eventVal === "all" || eventName === eventVal.toLowerCase();

            return matchesSearch && matchesEvent;
        });
        render(filtered);
    }

    if(searchInput) searchInput.addEventListener("input", applyFilters);
    if(eventFilter) eventFilter.addEventListener("change", applyFilters);

    render(allConnections);
  }

  // (Remaining functions loadRecentActivity etc. kept same)
  async function loadRecentActivity(currentUser) {
    const container = document.getElementById("recentActivityList");
    if (!container) return;
    container.innerHTML = '<p style="color:#999; font-size:14px;">Loading activity...</p>';
    const connections = await fetchConnections(currentUser.username);
    if (!connections.length) { container.innerHTML = `<p style="color:#999; font-size:13px;">No recent connections.</p>`; return; }
    container.innerHTML = "";
    connections.slice(0, 3).forEach(conn => {
      const row = document.createElement("div");
      row.className = "activity-row";
      row.style.cssText = `display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0; cursor: pointer;`;
      const profile = prepareProfileData(conn, currentUser);
      row.innerHTML = `<img src="${profile.photo}" style="width:35px; height:35px; border-radius:50%; margin-right:12px; object-fit: cover;"><div><div style="font-weight:600; font-size:13px;">${profile.name}</div><div style="font-size:11px; color:#888;">${profile.company}</div></div>`;
      row.onclick = () => { openProfileModal(profile, currentUser); };
      container.appendChild(row);
    });
  }

  document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("editNoteBtn")) return;
    const btn = e.target;
    const popup = document.getElementById("noteModal");
    const noteInput = document.getElementById("noteText");
    const saveBtn = document.getElementById("saveNoteBtn");
    const cancelBtn = document.getElementById("cancelNoteBtn");
    if(!popup) return;
    noteInput.value = btn.dataset.note;
    popup.style.display = "flex";
    saveBtn.onclick = async () => { 
        const newNote = noteInput.value.trim(); 
        saveBtn.textContent = "Saving..."; 
        await fetch(`/connections/updateNote`, { 
            method: "PUT", headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ scanner_username: btn.dataset.scanner, scanned_username: btn.dataset.scanned, event_id: btn.dataset.event, note: newNote }) 
        }); 
        popup.style.display = "none"; 
        saveBtn.textContent = "Save"; 
        const user = JSON.parse(localStorage.getItem("loggedInUser")); 
        if(document.getElementById("networkContainer")) loadNetworkPage(user); 
        if(document.getElementById("recentActivityList")) loadRecentActivity(user); 
    };
    cancelBtn.onclick = () => { popup.style.display = "none"; };
  });

  return { loadRecentActivity, loadNetworkPage, openProfileModal };

})();