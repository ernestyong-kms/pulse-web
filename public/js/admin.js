// js/admin.js
document.addEventListener("DOMContentLoaded", async () => {
  
  // 1. SECURITY CHECK
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
  const popupTitle = createEventPopup.querySelector("h3");
  const submitBtn = createEventPopup.querySelector("button[type='submit']");
  
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
                  document.querySelector("#eventPhotoPreview span").style.display = "none"; 
              };
              reader.readAsDataURL(file);
          }
      });
  }

  // 4. OPEN / CLOSE MODAL
  if(openCreateEvent) {
      openCreateEvent.addEventListener("click", () => {
        resetForm();
        createEventPopup.style.display = "flex";
      });
  }

  if(cancelEvent) {
      cancelEvent.addEventListener("click", () => {
        createEventPopup.style.display = "none";
        resetForm();
      });
  }

  function resetForm() {
      createEventForm.reset();
      editModeId = null;
      popupTitle.textContent = "Create New Event";
      submitBtn.textContent = "Create Event";
      previewImg.style.display = "none";
      document.querySelector("#eventPhotoPreview span").style.display = "block";
  }

  // 5. 🔥 EXPOSE EDIT FUNCTION
  window.editEvent = function(id) {
      const event = window.EventsModule.allEvents.find(e => e.id === id);
      if (!event) return;

      editModeId = id;
      popupTitle.textContent = "Edit Event";
      submitBtn.textContent = "Save Changes";

      document.getElementById("eventName").value = event.name;
      document.getElementById("eventDate").value = event.date.split('T')[0];
      
      // Parse Time (Convert "2:30 PM" -> "14:30") for input[type=time]
      const convertTo24 = (timeStr) => {
          if(!timeStr) return "";
          const [time, modifier] = timeStr.split(' ');
          let [hours, minutes] = time.split(':');
          if (hours === '12') hours = '00';
          if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
          return `${hours}:${minutes}`;
      };

      if(event.time) document.getElementById("eventTime").value = convertTo24(event.time);
      if(event.end_time) document.getElementById("eventEndTime").value = convertTo24(event.end_time);

      document.getElementById("eventLocation").value = event.location;
      document.getElementById("eventDescription").value = event.description;
      document.getElementById("eventCategory").value = event.category;

      if (event.photo_url) {
          previewImg.src = event.photo_url;
          previewImg.style.display = "block";
          document.querySelector("#eventPhotoPreview span").style.display = "none";
      }

      createEventPopup.style.display = "flex";
  };

  // 6. 🔥 HANDLE SUBMIT (CREATE OR UPDATE)
  if(createEventForm) {
      createEventForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData();
        if (editModeId) formData.append("id", editModeId); // ID required for update

        formData.append("name", document.getElementById("eventName").value);
        formData.append("date", document.getElementById("eventDate").value);
        
        // Format Time Back to "2:30 PM"
        const formatTime = (raw) => {
            if(!raw) return "";
            const [h, m] = raw.split(':');
            const hours = parseInt(h);
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const h12 = hours % 12 || 12;
            return `${h12}:${m} ${ampm}`;
        };

        formData.append("time", formatTime(document.getElementById("eventTime").value)); 
        formData.append("end_time", formatTime(document.getElementById("eventEndTime").value)); 
        
        formData.append("location", document.getElementById("eventLocation").value);
        formData.append("description", document.getElementById("eventDescription").value);
        formData.append("category", document.getElementById("eventCategory").value);

        const file = document.getElementById("eventPhotoInput").files[0];
        if (file) formData.append("eventPhoto", file);

        // DECIDE URL: Create or Update?
        const url = editModeId ? "/updateEvent" : "/createEvent";

        try {
            const res = await fetch(url, { method: "POST", body: formData });
            const data = await res.json();

            if (data.success) {
              alert(editModeId ? "✅ Event updated!" : "✅ Event created!");
              createEventPopup.style.display = "none";
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

  // 7. 🔥 ATTENDEE MANAGEMENT
  window.openAttendees = async function(eventId, eventName) {
      const popup = document.getElementById("attendeesPopup");
      const list = document.getElementById("attendeeList");
      const title = popup.querySelector("h2");
      
      title.textContent = `Attendees: ${eventName}`;
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

  // Close Button Logic
  document.getElementById("closeAttendees").onclick = () => {
      document.getElementById("attendeesPopup").style.display = "none";
  };

  // Remove Attendee Function
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