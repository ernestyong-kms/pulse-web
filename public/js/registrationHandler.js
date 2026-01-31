// js/registrationHandler.js
window.RegistrationModule = (() => {

  // ============================================================
  // 1. HELPER: Append Buttons (ON EVENT CARD)
  // ============================================================
  function appendRegistrationButtons(card, event, isRegistered, user, reloadCallback) {
    const btnContainer = document.createElement("div");
    Object.assign(btnContainer.style, { display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px", width: "100%" });

    if (isRegistered) {
      // --- REGISTERED STATE ---
      
      // VIEW INFO BUTTON
      const infoBtn = document.createElement("button");
      infoBtn.textContent = "View My Info";
      infoBtn.style.cssText = `width: 100%; background: #2b2d42; color: white; border: none; padding: 12px; border-radius: 12px; cursor: pointer; font-weight: 600; transition: transform 0.2s;`;
      infoBtn.onmouseover = () => infoBtn.style.transform = "scale(1.02)";
      infoBtn.onmouseout = () => infoBtn.style.transform = "scale(1)";
      
      infoBtn.onclick = async () => {
          infoBtn.textContent = "Loading...";
          try {
              // 🟢 FIX: Fetch Full Profile instead of just Registration data
              const res = await fetch(`/api/user/profile?username=${user.username}`);
              if (res.ok) {
                  const profile = await res.json();
                  // Map API fields to Popup fields
                  const displayData = {
                      name: profile.name || user.fullname,
                      photo: profile.profile_pic || user.photo_url,
                      position: profile.position || user.position,
                      company: profile.company || user.company,
                      qualifications: profile.qualifications,
                      skills: profile.skills,
                      specialInterests: profile.special_interests // Map snake_case to camelCase
                  };
                  showAttendeeInfo(displayData);
              } else {
                  alert("Error fetching your info.");
              }
          } catch(e) { console.error(e); alert("Network error"); }
          infoBtn.textContent = "View My Info";
      };
      
      // VIEW QR BUTTON
      const qrBtn = document.createElement("button");
      qrBtn.textContent = "View My QR";
      qrBtn.style.cssText = `width: 100%; background: linear-gradient(135deg, #d90429, #ef233c); color: white; border: none; padding: 12px; border-radius: 12px; cursor: pointer; font-weight: 600; transition: transform 0.2s;`;
      qrBtn.onmouseover = () => qrBtn.style.transform = "scale(1.02)";
      qrBtn.onmouseout = () => qrBtn.style.transform = "scale(1)";
      
      qrBtn.onclick = async () => {
          qrBtn.textContent = "Loading...";
          try {
              const res = await fetch(`/getRegistration/${user.username}/${event.id}`);
              if (res.ok) {
                  const data = await res.json();
                  if (data.qrToken) {
                      showQRModal(data.qrToken);
                  } else {
                      alert("QR Token missing. Try unregistering and registering again.");
                  }
              } else {
                  alert("Error fetching QR.");
              }
          } catch(e) { console.error(e); }
          qrBtn.textContent = "View My QR";
      };

      // UNREGISTER BUTTON
      const unregBtn = document.createElement("button");
      unregBtn.textContent = "Unregister";
      unregBtn.onclick = async () => {
          if(!confirm("Are you sure you want to unregister from " + event.name + "?")) return;
          try {
              const res = await fetch("/unregisterEvent", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ eventId: event.id, username: user.username })
              });
              const data = await res.json();
              if(data.success) {
                  // Clear legacy local storage
                  const dataKey = `registrationData_${user.username}`;
                  const registrationData = JSON.parse(localStorage.getItem(dataKey) || "{}");
                  delete registrationData[event.id];
                  localStorage.setItem(dataKey, JSON.stringify(registrationData));
                  
                  alert("Unregistered successfully.");
                  reloadCallback();
              } else {
                  alert(data.message);
              }
          } catch(e) { alert("Server error."); }
      };
      unregBtn.style.cssText = `width: 100%; background: transparent; color: #dc2626; border: 1px solid #dc2626; padding: 10px; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 13px; margin-top: 5px; opacity: 0.8; transition: opacity 0.2s;`;
      unregBtn.onmouseover = () => unregBtn.style.opacity = "1";
      unregBtn.onmouseout = () => unregBtn.style.opacity = "0.8";

      btnContainer.appendChild(infoBtn);
      btnContainer.appendChild(qrBtn);
      btnContainer.appendChild(unregBtn);

    } else {
      // --- NOT REGISTERED ---
      const registerBtn = document.createElement("button");
      registerBtn.textContent = "Register Now";
      registerBtn.onclick = () => showRegistrationForm(event, reloadCallback, user);
      registerBtn.style.cssText = `width: 100%; background: linear-gradient(135deg, #d90429, #ef233c); color: white; border: none; padding: 14px; border-radius: 12px; cursor: pointer; font-weight: 700; transition: transform 0.2s; box-shadow: 0 4px 15px rgba(217, 4, 41, 0.2);`;
      registerBtn.onmouseover = () => registerBtn.style.transform = "scale(1.02)";
      registerBtn.onmouseout = () => registerBtn.style.transform = "scale(1)";
      btnContainer.appendChild(registerBtn);
    }
    card.appendChild(btnContainer);
  }

  // ============================================================
  // 2. REGISTRATION FORM (With Success Modal Trigger)
  // ============================================================
  function showRegistrationForm(eventData, reloadCallback, user) {
    let overlay = document.getElementById("registerFormPopup");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "registerFormPopup";
      document.body.appendChild(overlay);
    }

    overlay.style.cssText = `display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(20, 20, 20, 0.8); backdrop-filter: blur(8px); justify-content: center; align-items: center; z-index: 2000; opacity: 1 !important; visibility: visible !important;`;

    // Inject Styles
    const modalStyles = `
        <style>
            .reg-input { width: 100%; padding: 14px 16px; border: 2px solid #f3f4f6; border-radius: 12px; background: #f9fafb; color: #333; font-size: 14px; font-weight: 500; outline: none; transition: all 0.3s; }
            .reg-input:focus { background: white; border-color: #d90429; box-shadow: 0 4px 12px rgba(217, 4, 41, 0.1); }
            .reg-label { font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin: 16px 0 6px 4px; display: block; }
            .reg-section-title { font-size: 13px; font-weight: 700; color: #d90429; margin: 25px 0 10px 0; padding-bottom: 8px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 8px; }
            .upload-circle { width: 90px; height: 90px; border-radius: 50%; background: #f3f4f6; margin: 0 auto; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px dashed #ccc; position: relative; overflow: hidden; }
        </style>
    `;

    overlay.innerHTML = `
        ${modalStyles}
        <div class="bomb-modal" style="width: 90%; max-width: 460px; background: white; border-radius: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.4); overflow: hidden; max-height: 90vh; display: flex; flex-direction: column;">
            
            <div style="background: linear-gradient(135deg, #d90429, #8d0801); padding: 25px; color: white; position: relative; flex-shrink: 0;">
                <button onclick="document.getElementById('registerFormPopup').style.display='none'" style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.2); border: none; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; color: white; font-size: 20px;">&times;</button>
                <div style="font-size: 11px; text-transform: uppercase; opacity: 0.9; font-weight: 600; margin-bottom: 5px;">Registering For</div>
                <h2 style="margin: 0; font-size: 22px; font-weight: 700;">${eventData.name}</h2>
            </div>

            <div style="padding: 0 30px 30px 30px; overflow-y: auto; background: white;">
                <form id="registerEventForm">
                    <div style="text-align: center; margin-top: 30px; margin-bottom: 10px;">
                        <div class="upload-circle" onclick="document.getElementById('regPhoto').click()">
                            <img id="avatarPreview" src="" style="width: 100%; height: 100%; object-fit: cover; display: none;">
                            <span class="upload-icon" style="font-size: 24px; color: #888;">📷</span>
                        </div>
                        <input type="file" id="regPhoto" accept="image/*" style="display: none;">
                    </div>

                    <div class="reg-section-title"><span>👤</span> Personal Details</div>
                    <label class="reg-label">Full Name</label>
                    <input type="text" id="regName" required class="reg-input">
                    <label class="reg-label">Email</label>
                    <input type="email" id="regEmail" required class="reg-input">
                    <label class="reg-label">Phone</label>
                    <input type="text" id="regNumber" class="reg-input">

                    <div id="profSection">
                        <div class="reg-section-title"><span>💼</span> Current Role</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div><label class="reg-label">Company</label><input type="text" id="regCompany" class="reg-input"></div>
                            <div><label class="reg-label">Position</label><input type="text" id="regPosition" class="reg-input"></div>
                        </div>
                    </div>

                    <div class="reg-section-title"><span>🎓</span> Background</div>
                    <label class="reg-label">Qualifications</label>
                    <input type="text" id="regQualifications" class="reg-input">
                    <label class="reg-label">LinkedIn</label>
                    <input type="text" id="regLinkedIn" class="reg-input">
                    <label class="reg-label">Skills</label>
                    <input type="text" id="regSkills" class="reg-input">
                    <label class="reg-label">Interests</label>
                    <input type="text" id="regSpecialInterests" class="reg-input">

                    <button type="submit" id="submitRegBtn" style="width: 100%; margin-top: 35px; padding: 16px; border: none; border-radius: 14px; background: linear-gradient(135deg, #d90429, #ef233c); color: white; cursor: pointer; font-weight: 700; font-size: 16px; box-shadow: 0 10px 25px rgba(217, 4, 41, 0.3);">Confirm Registration</button>
                </form>
            </div>
        </div>
    `;

    // --- SETUP PREVIEW ---
    const photoInput = document.getElementById("regPhoto");
    const avatarPreview = document.getElementById("avatarPreview");
    const uploadIcon = document.querySelector(".upload-icon");

    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                avatarPreview.src = ev.target.result;
                avatarPreview.style.display = "block";
                uploadIcon.style.display = "none";
            };
            reader.readAsDataURL(file);
        }
    });

    overlay.style.display = "flex"; 
    const form = document.getElementById("registerEventForm");
    const submitBtn = document.getElementById("submitRegBtn");
    form.reset();

    // --- AUTO FILL ---
    fetch(`/api/user/profile?username=${user.username}`)
      .then(res => res.json())
      .then(profile => {
        if (!profile) return;
        const safeVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ""; };
        
        safeVal("regName", profile.name);
        safeVal("regEmail", profile.email);
        safeVal("regNumber", profile.phone_number);
        
        const profSection = document.getElementById("profSection");
        if (!profile.company || profile.company.trim() === "") {
            profSection.style.display = "none";
            safeVal("regCompany", "");
            safeVal("regPosition", "");
        } else {
            profSection.style.display = "block";
            safeVal("regCompany", profile.company);
            safeVal("regPosition", profile.position);
        }

        safeVal("regLinkedIn", profile.linkedin_url);
        safeVal("regQualifications", profile.qualifications);
        safeVal("regSkills", profile.skills);
        safeVal("regSpecialInterests", profile.special_interests);
        
        if (profile.profile_pic) {
            avatarPreview.src = profile.profile_pic;
            avatarPreview.style.display = "block";
            uploadIcon.style.display = "none";
            avatarPreview.dataset.existingUrl = profile.profile_pic;
        }
      });

    // --- SUBMIT HANDLER ---
    form.onsubmit = async e => {
      e.preventDefault();
      
      const originalBtnText = submitBtn.innerText;
      submitBtn.innerText = "Processing...";
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.7";

      try {
          const file = photoInput.files[0];
          const existingUrl = avatarPreview.dataset.existingUrl;
          const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };

          const data = {
            eventId: eventData.id,
            username: user.username,
            name: getVal("regName"),
            email: getVal("regEmail"),
            number: getVal("regNumber"),
            linkedin: getVal("regLinkedIn"),
            company: getVal("regCompany"),
            position: getVal("regPosition"),
            qualifications: getVal("regQualifications"),
            skills: getVal("regSkills"),
            specialInterests: getVal("regSpecialInterests"),
            role: "Attendee", 
            portfolio: "", 
            photo: ""
          };

          const sendData = async () => {
            const res = await fetch("/registerEvent", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (result.success) {
                overlay.style.display = "none";
                reloadCallback();
                
                // 🟢 SHOW SUCCESS POPUP instead of alert
                showSuccessModal(eventData, result.qrToken, user); 
            } else {
                alert("Error: " + result.message);
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                submitBtn.style.opacity = "1";
            }
          };

          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { data.photo = reader.result; sendData(); };
            reader.readAsDataURL(file);
          } else if (existingUrl) {
            data.photo = existingUrl; sendData();
          } else {
            sendData();
          }

      } catch (err) {
          console.error("Submission Error:", err);
          alert("Something went wrong. Check console.");
          submitBtn.innerText = originalBtnText;
          submitBtn.disabled = false;
          submitBtn.style.opacity = "1";
      }
    };
  }

  // 3. SUCCESS MODAL (RESTORED)
  function showSuccessModal(event, qrToken, user) {
      let overlay = document.getElementById("registrationSuccessModal");
      if (!overlay) {
          overlay = document.createElement("div");
          overlay.id = "registrationSuccessModal";
          document.body.appendChild(overlay);
      }
      
      overlay.style.cssText = `display:flex; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(5px); justify-content:center; align-items:center; z-index:3000; opacity:1 !important; visibility: visible !important;`;
      
      overlay.innerHTML = `
          <div style="background:white; width:90%; max-width:400px; border-radius:24px; padding:40px 30px; text-align:center; box-shadow:0 30px 60px rgba(0,0,0,0.5); position:relative; overflow:hidden;">
              <div style="position:absolute; top:0; left:0; width:100%; height:8px; background:linear-gradient(90deg, #d90429, #ef233c);"></div>
              <div style="font-size:50px; margin-bottom:15px;">🎉</div>
              <h2 style="margin:0 0 10px; color:#1a1a1a; font-size:24px; font-weight:800;">You're In!</h2>
              <p style="color:#666; margin:0 0 25px;">Registered for <strong>${event.name}</strong></p>
              
              <div id="successQRCode" style="display:flex; justify-content:center; margin-bottom:25px;"></div>

              <div style="display:flex; gap:10px;">
                  <button id="successViewInfo" style="flex:1; padding:12px; border:2px solid #eee; background:transparent; color:#333; border-radius:12px; font-weight:700; cursor:pointer;">View My Info</button>
                  <button id="successClose" style="flex:1; padding:12px; border:none; background:#d90429; color:white; border-radius:12px; font-weight:700; cursor:pointer;">Awesome</button>
              </div>
          </div>
      `;

      // Render QR
      new QRCode(document.getElementById("successQRCode"), {
          text: qrToken,
          width: 160,
          height: 160,
          colorDark : "#1a1a1a",
          colorLight : "#ffffff",
          correctLevel : QRCode.CorrectLevel.H
      });

      // Bind Buttons
      document.getElementById("successClose").onclick = () => { overlay.style.display = "none"; };
      
      // "View My Info" from Success Modal
      document.getElementById("successViewInfo").onclick = async () => {
          overlay.style.display = "none";
          try {
              // Fetch Full Profile
              const res = await fetch(`/api/user/profile?username=${user.username}`);
              const profile = await res.json();
              showAttendeeInfo({
                  name: profile.name || user.fullname,
                  photo: profile.profile_pic || user.photo_url,
                  position: profile.position || user.position,
                  company: profile.company || user.company,
                  qualifications: profile.qualifications,
                  skills: profile.skills,
                  specialInterests: profile.special_interests
              });
          } catch(e) {
              alert("Error loading profile.");
          }
      };

      overlay.style.display = "flex";
  }

  // 4. ATTENDEE INFO POPUP (Fixed Alignment)
  function showAttendeeInfo(a) {
    let overlay = document.getElementById("attendeeInfoPopup");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "attendeeInfoPopup";
      document.body.appendChild(overlay);
    }
    
    overlay.style.cssText = `display:flex; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(5px); justify-content:center; align-items:center; z-index:3000; opacity:1 !important; visibility: visible !important;`;
    
    const roleText = (a.company && a.position) ? `${a.position} @ ${a.company}` : (a.position || 'Attendee');

    // 🟢 NEW LAYOUT: Overlapping Avatar Style (Like Success Popup)
    overlay.innerHTML = `
        <div class="popup-content" style="width:90%; max-width:380px; background:white; padding:0; border-radius:24px; overflow:hidden; box-shadow:0 30px 60px rgba(0,0,0,0.5); display:flex; flex-direction:column;">
          
          <div style="background:linear-gradient(135deg, #d90429, #8d0801); height:100px; width:100%; position:relative;">
             <button onclick="document.getElementById('attendeeInfoPopup').style.display='none'" style="position:absolute; top:15px; right:15px; background:rgba(0,0,0,0.2); border:none; width:32px; height:32px; border-radius:50%; color:white; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">&times;</button>
          </div>

          <div style="margin-top:-50px; display:flex; justify-content:center; position:relative; z-index:10;">
             <img src="${a.photo || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'}" style="width:100px; height:100px; border-radius:50%; border:5px solid white; object-fit:cover; background:white; box-shadow: 0 10px 20px rgba(0,0,0,0.15);">
          </div>

          <div style="padding:15px 30px 30px; text-align:center;">
             
             <h2 style="margin:10px 0 5px; font-size:22px; font-weight:800; color:#1a1a1a;">${a.name}</h2>
             <p style="margin:0 0 20px; font-size:13px; color:#666; font-weight:500;">${roleText}</p>

             <div style="background:#f9fafb; border-radius:16px; padding:20px; text-align:left; border:1px solid #f0f0f0;">
                
                <div style="margin-bottom:12px;">
                    <div style="font-size:10px; color:#999; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Qualifications</div>
                    <div style="font-size:13px; color:#333; font-weight:500; line-height:1.4;">${a.qualifications || 'N/A'}</div>
                </div>

                <div style="margin-bottom:12px;">
                    <div style="font-size:10px; color:#999; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Skills</div>
                    <div style="font-size:13px; color:#333; font-weight:500; line-height:1.4;">${a.skills || 'N/A'}</div>
                </div>

                <div>
                    <div style="font-size:10px; color:#999; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Interests</div>
                    <div style="font-size:13px; color:#333; font-weight:500; line-height:1.4;">${a.specialInterests || 'N/A'}</div>
                </div>

             </div>

             <button onclick="document.getElementById('attendeeInfoPopup').style.display='none'" style="width:100%; margin-top:20px; padding:14px; border:none; background:#1a1a1a; color:white; border-radius:14px; cursor:pointer; font-weight:700; font-size:14px; transition:transform 0.1s;">Close</button>
          </div>
        </div>
    `;
    overlay.style.display = "flex";
  }

  // 5. QR MODAL
  function showQRModal(token) {
    let overlay = document.getElementById("qrPopup");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "qrPopup";
      document.body.appendChild(overlay);
    }
    overlay.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); backdrop-filter:blur(5px); display:flex; justify-content:center; align-items:center; z-index:2000; opacity:1 !important; visibility: visible !important;`;

    overlay.innerHTML = `
        <div class="popup-content" style="background:white; padding:40px; border-radius:24px; width:90%; max-width:360px; text-align:center;">
          <h3 style="margin:0 0 5px 0; color:#1a1a1a; font-size:24px;">Your QR Code</h3>
          <p style="color:#666; font-size:14px; margin-bottom:25px;">Use this to connect with other attendees!</p>
          <div id="qrCode" style="display:flex; justify-content:center; margin-bottom:30px;"></div>
          <button onclick="document.getElementById('qrPopup').style.display='none'" id="closeQR" style="width:100%; padding:14px; border:none; background:linear-gradient(135deg, #d90429, #ef233c); color:white; border-radius:12px; cursor:pointer;">Close</button>
        </div>
    `;
    
    overlay.style.display = "flex";
    const qrDiv = document.getElementById("qrCode");
    qrDiv.innerHTML = "";
    new QRCode(qrDiv, { text: token, width: 220, height: 220 });
  }

  return { appendRegistrationButtons, showRegistrationForm, showAttendeeInfo, showQRModal };
})();