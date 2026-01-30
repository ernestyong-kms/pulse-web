document.addEventListener("DOMContentLoaded", async () => {
  
  // ==========================================
  //      1. SECURITY CHECK
  // ==========================================
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || user.role !== 'admin') {
      alert("Access Denied.");
      window.location.href = "home.html";
      return;
  }

  // 2. INITIAL LOAD
  if (window.EventsModule) {
      await EventsModule.loadEvents(user);
  }

  // 3. UI ELEMENTS
  const openCreateEvent = document.getElementById("openCreateEvent");
  const createEventPopup = document.getElementById("createEventPopup");
  const createEventForm = document.getElementById("createEventForm");
  const cancelEvent = document.getElementById("cancelEvent");
  const popupTitle = createEventPopup ? createEventPopup.querySelector("h3") : null;
  const submitBtn = createEventPopup ? createEventPopup.querySelector("button[type='submit']") : null;
  
  // Hidden input for Edit Mode ID
  let editModeId = null; 

  // Image Preview Logic
  const photoInput = document.getElementById("eventPhotoInput");
  const previewImg = document.getElementById("previewImg");
  
  if (photoInput) {
      photoInput.addEventListener("change", (e) => {
          const file = e.target.files[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  previewImg.src = ev.target.result;
                  previewImg.style.display = "block";
                  const span = document.querySelector("#eventPhotoPreview span");
                  if(span) span.style.display = "none"; 
              };
              reader.readAsDataURL(file);
          }
      });
  }

  // 4. OPEN / CLOSE MODAL
  if(openCreateEvent) {
      openCreateEvent.addEventListener("click", () => {
        resetForm();
        if(createEventPopup) createEventPopup.style.display = "flex";
      });
  }

  if(cancelEvent) {
      cancelEvent.addEventListener("click", () => {
        if(createEventPopup) createEventPopup.style.display = "none";
        resetForm();
      });
  }

  function resetForm() {
      if(createEventForm) createEventForm.reset();
      editModeId = null;
      if(popupTitle) popupTitle.textContent = "Create New Event";
      if(submitBtn) submitBtn.textContent = "Create Event";
      if(previewImg) {
          previewImg.style.display = "none";
          previewImg.src = "";
      }
      const span = document.querySelector("#eventPhotoPreview span");
      if(span) span.style.display = "block";
  }

  // 5. 🔥 EXPOSE EDIT FUNCTION (ROBUST VERSION)
  window.editEvent = function(id) {
      console.log("Edit clicked for ID:", id); // Debug Log

      if (!window.EventsModule || !window.EventsModule.allEvents) {
          console.error("EventsModule not loaded");
          alert("Error: Events data not loaded.");
          return;
      }

      // Use loose equality (==) to handle string vs number ID mismatch
      const event = window.EventsModule.allEvents.find(e => e.id == id);
      
      if (!event) {
          console.error("Event not found for ID:", id);
          alert("Event not found.");
          return;
      }

      editModeId = id;
      if(popupTitle) popupTitle.textContent = "Edit Event";
      if(submitBtn) submitBtn.textContent = "Save Changes";

      // Safely set values helper
      const setVal = (domId, val) => {
          const el = document.getElementById(domId);
          if(el) el.value = val || "";
      };

      setVal("eventName", event.name);
      setVal("eventLocation", event.location);
      setVal("eventDescription", event.description);
      setVal("eventCategory", event.category);

      // 🔥 FIX: Handle Date Object properly for input[type=date]
      try {
          if (event.date) {
              const dateObj = new Date(event.date);
              // Check if date is valid
              if (!isNaN(dateObj.getTime())) {
                  const yyyyMmDd = dateObj.toISOString().split('T')[0];
                  setVal("eventDate", yyyyMmDd);
              } else {
                  console.warn("Invalid date format:", event.date);
                  setVal("eventDate", "");
              }
          }
      } catch (e) {
          console.error("Date parsing error:", e);
          setVal("eventDate", "");
      }
      
      // Parse Time
      const convertTo24 = (timeStr) => {
          if(!timeStr || timeStr === "Time TBD") return "";
          try {
              // Handle potential lack of space or weird formatting
              // Assume format "2:30 PM"
              const parts = timeStr.trim().split(' ');
              if(parts.length < 2) return timeStr; // Fallback
              
              const [time, modifier] = parts;
              let [hours, minutes] = time.split(':');
              
              if (hours === '12') hours = '00';
              if (modifier && (modifier.toLowerCase() === 'pm')) hours = parseInt(hours, 10) + 12;
              
              // Pad with 0 if needed (e.g. 9:30 -> 09:30)
              const hStr = hours.toString().padStart(2, '0');
              
              return `${hStr}:${minutes}`;
          } catch(e) {
              console.error("Time parse error", e);
              return ""; 
          }
      };

      setVal("eventTime", convertTo24(event.time));
      setVal("eventEndTime", convertTo24(event.end_time));

      // Handle Image Preview
      if (event.photo_url) {
          if(previewImg) {
              previewImg.src = event.photo_url;
              previewImg.style.display = "block";
          }
          const span = document.querySelector("#eventPhotoPreview span");
          if(span) span.style.display = "none";
      } else {
          if(previewImg) previewImg.style.display = "none";
          const span = document.querySelector("#eventPhotoPreview span");
          if(span) span.style.display = "block";
      }

      if(createEventPopup) createEventPopup.style.display = "flex";
  };

  // 6. 🔥 HANDLE SUBMIT (CREATE OR UPDATE)
  if(createEventForm) {
      createEventForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData();
        if (editModeId) formData.append("id", editModeId); 

        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : "";
        };

        formData.append("name", getVal("eventName"));
        formData.append("date", getVal("eventDate"));
        
        // Format Time Back to "2:30 PM"
        const formatTime = (raw) => {
            if(!raw) return "";
            const [h, m] = raw.split(':');
            const hours = parseInt(h);
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const h12 = hours % 12 || 12;
            return `${h12}:${m} ${ampm}`;
        };

        formData.append("time", formatTime(getVal("eventTime"))); 
        formData.append("end_time", formatTime(getVal("eventEndTime"))); 
        formData.append("location", getVal("eventLocation"));
        formData.append("description", getVal("eventDescription"));
        formData.append("category", getVal("eventCategory"));

        const photoInput = document.getElementById("eventPhotoInput");
        if (photoInput && photoInput.files[0]) {
            formData.append("eventPhoto", photoInput.files[0]);
        }

        const url = editModeId ? "/updateEvent" : "/createEvent";

        try {
            const res = await fetch(url, { method: "POST", body: formData });
            const data = await res.json();

            if (data.success) {
              alert(editModeId ? "✅ Event updated!" : "✅ Event created!");
              if(createEventPopup) createEventPopup.style.display = "none";
              resetForm();
              if (window.EventsModule) EventsModule.loadEvents(user);
            } else {
              alert("❌ Error: " + data.message);
            }
        } catch (err) {
            console.error(err);
            alert("Server connection failed.");
        }
      });
  }

  // 7. ATTENDEE MANAGEMENT
  window.openAttendees = async function(eventId, eventName) {
      const popup = document.getElementById("attendeesPopup");
      const list = document.getElementById("attendeeList");
      const title = popup ? popup.querySelector("h2") : null;
      
      if(!popup || !list) return;

      if(title) title.textContent = `Attendees: ${eventName}`;
      list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">Loading...</td></tr>`;
      popup.style.display = "flex";

      try {
          const res = await fetch(`/getAttendees/${eventId}`);
          const attendees = await res.json();

          list.innerHTML = "";
          if (attendees.length === 0) {
              list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:#999;">No registrations yet.</td></tr>`;
              return;
          }

          attendees.forEach(p => {
              const row = document.createElement("tr");
              row.innerHTML = `
                  <td style="padding:15px 25px; font-weight:600;">${p.name}</td>
                  <td style="padding:15px 25px; color:#666;">${p.role}</td>
                  <td style="padding:15px 25px; color:#666;">${p.company || '-'}</td>
                  <td style="padding:15px 25px;">
                      <button onclick="removeAttendee(${p.id}, this)" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; font-weight:600; cursor:pointer;">Remove</button>
                  </td>
              `;
              list.appendChild(row);
          });

      } catch (e) {
          console.error(e);
          list.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error loading data.</td></tr>`;
      }
  };

  const closeAtt = document.getElementById("closeAttendees");
  if(closeAtt) {
      closeAtt.onclick = () => {
          const popup = document.getElementById("attendeesPopup");
          if(popup) popup.style.display = "none";
      };
  }

  window.removeAttendee = async function(regId, btn) {
      if(!confirm("Remove this user from the event?")) return;
      btn.textContent = "...";
      try {
          const res = await fetch(`/api/registration/${regId}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
              btn.closest("tr").remove();
          } else {
              alert("Failed to remove.");
              btn.textContent = "Remove";
          }
      } catch (e) {
          alert("Server Error");
      }
  };

});