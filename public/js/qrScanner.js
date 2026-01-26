// js/qrScanner.js
window.QRModule = (() => {

  let qrScanner = null;

  function initQR(user) {
    console.log("QR Module Initializing...");

    const scanBtn = document.getElementById("scanQRBtn");
    const uploadBtn = document.getElementById("uploadQRBtn");
    const container = document.getElementById("qr-reader-container");
    const stopBtn = document.getElementById("stopScanBtn");
    const uploadQRInput = document.getElementById("uploadQRInput");

    // 1. Upload Button
    if (uploadBtn && uploadQRInput) {
        uploadBtn.addEventListener("click", () => uploadQRInput.click());
        uploadQRInput.addEventListener("change", async (e) => {
            if (e.target.files.length === 0) return;
            const html5QrCode = new Html5Qrcode("qr-reader-container");
            try {
                const decodedText = await html5QrCode.scanFile(e.target.files[0], true);
                await handleQRDetected(decodedText, user);
            } catch (err) {
                showErrorPopup("Could not read QR code from image.");
            }
        });
    }

    // 2. Camera Button
    if (scanBtn) {
        scanBtn.addEventListener("click", async () => {
          if (container.style.display === "block") return;
          container.style.display = "block";
          if (stopBtn) stopBtn.style.display = "inline-block";

          if (!qrScanner) qrScanner = new Html5Qrcode("qr-reader-container");

          try {
            await qrScanner.start(
              { facingMode: "environment" },
              { fps: 10, qrbox: 250 },
              async (decodedText) => {
                await stopScanning(); 
                await handleQRDetected(decodedText, user);
              }
            );
          } catch (err) {
            console.error(err);
            showErrorPopup("Camera failed to start. Please check permissions.");
            container.style.display = "none";
          }
        });
    }

    // 3. Stop Button
    if (stopBtn) {
        stopBtn.addEventListener("click", stopScanning);
    }
    
    async function stopScanning() {
        if (qrScanner) {
            try { await qrScanner.stop(); qrScanner.clear(); } catch (e) {}
        }
        container.style.display = "none";
        if (stopBtn) stopBtn.style.display = "none";
    }
  }

  // --- UNIVERSAL HANDLER ---
  async function handleQRDetected(token, user) {
    try {
      console.log("Processing Token:", token);

      let scannedUsername = "";
      let scannedEventId = 1; 

      // 1. Try to Parse JSON
      try {
          const json = JSON.parse(token);
          if(json.username) {
              scannedUsername = json.username;
              scannedEventId = json.eventId || 1;
          }
      } catch (e) {}

      // 2. Resolve Token
      if (!scannedUsername) {
          try {
              const resolveRes = await fetch(`/qr/resolve/${token}`);
              const resolveData = await resolveRes.json();
              if (resolveData.success) {
                  scannedUsername = resolveData.username;
                  scannedEventId = resolveData.eventId;
              } else {
                  scannedUsername = token.trim();
              }
          } catch (err) {
              scannedUsername = token.trim();
          }
      }

      if (!scannedUsername) {
          showErrorPopup("Invalid QR Code content.");
          return;
      }

      // 3. Attempt Connection
      const connRes = await fetch("/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanner_username: user.username,
          scanned_username: scannedUsername,
          event_id: scannedEventId,
          note: "" 
        })
      });
      
      const connData = await connRes.json();

      // 🛑 ERROR POPUP: If Server Blocks Connection
      if (!connData.success) {
          showErrorPopup(connData.message || "Connection failed.");
          return; 
      }

      // 4. Success! Get Profile Data
      let profile = connData.user;
      
      if (!profile) {
          try {
              const pRes = await fetch(`/api/user/profile?username=${scannedUsername}`);
              profile = await pRes.json();
          } catch(e) {}
      }

      if (!profile || profile.error) {
          profile = { 
              name: scannedUsername, 
              position: "Attendee", 
              company: "",
              photo: "/uploads/default_avatar.png"
          };
      }

      // 5. Show Success Popup (PASSING FULL SERVER RESPONSE NOW)
      showProfilePopup(profile, user, connData);

    } catch (err) {
      console.error("QR Handler Error:", err);
      showErrorPopup("System Error. Please try again.");
    }
  }

  // --- 🔴 ERROR POPUP ---
  function showErrorPopup(message) {
    const modal = document.getElementById("scannedProfileModal");
    if (!modal) { alert(message); return; } 
    
    const contentBox = modal.querySelector(".popup-content");

    contentBox.style.cssText = `
        width: 90%; max-width: 380px; 
        background: white; border-radius: 24px; 
        padding: 0; overflow: hidden; 
        box-shadow: 0 40px 80px rgba(0,0,0,0.4);
        animation: shake 0.4s ease-in-out;
        display: flex; flex-direction: column;
    `;

    contentBox.innerHTML = `
        <style>
            @keyframes shake { 0% { transform: translateX(0); } 25% { transform: translateX(-5px); } 50% { transform: translateX(5px); } 75% { transform: translateX(-5px); } 100% { transform: translateX(0); } }
        </style>
        
        <div style="background: linear-gradient(135deg, #ef4444, #b91c1c); padding: 30px 20px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 5px;">🚫</div>
            <h3 style="margin: 0; color: white; font-size: 20px; font-weight: 800;">Connection Failed</h3>
        </div>

        <div style="padding: 30px 25px; text-align: center;">
            <p style="color: #4b5563; font-size: 16px; font-weight: 500; margin: 0 0 25px; line-height: 1.5;">
                ${message}
            </p>

            <button id="btnCloseError" style="width: 100%; padding: 14px; border: none; background: #f3f4f6; color: #374151; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px; transition: background 0.2s;">
                Close
            </button>
        </div>
    `;

    modal.style.display = "flex";
    document.getElementById("btnCloseError").onclick = () => { modal.style.display = "none"; };
  }

  // --- ✅ SUCCESS POPUP (UPDATED Logic) ---
  function showProfilePopup(p, currentUser, serverData) {
    const modal = document.getElementById("scannedProfileModal");
    const contentBox = modal.querySelector(".popup-content");
    
    const name = p.fullname || p.name || "Unknown";
    const role = p.position || "Attendee";
    const company = p.company || "";
    const photo = p.photo_url || p.profile_pic || p.photo || "/uploads/default_avatar.png";
    const linkedin = p.linkedin_url || p.linkedin;

    // 🔥 DYNAMIC TEXT LOGIC
    let titleText = "Connected!";
    let subText = "You earned +10 Points";
    let icon = "🎉";
    let bgGradient = "linear-gradient(135deg, #d90429, #8d0801)"; // Default Red

    if (serverData) {
        if (serverData.isDuplicate) {
            // SCENARIO 1: SAME EVENT DUPLICATE
            titleText = "Already Connected";
            subText = "You have already scanned this person here.";
            icon = "🤝"; // Handshake
            bgGradient = "linear-gradient(135deg, #6366f1, #4f46e5)"; // Purple/Blue for info
        } else if (serverData.message.includes("Strengthened")) {
            // SCENARIO 2: RE-CONNECTION
            titleText = "Reconnected!";
            subText = "Connection Strengthened (+10 pts)";
            icon = "🔥"; // Fire for streak
        }
    }

    contentBox.style.cssText = `
        width: 95%; max-width: 420px; 
        background: white; border-radius: 30px; 
        padding: 0; overflow: hidden; 
        box-shadow: 0 40px 80px rgba(0,0,0,0.4);
        animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        display: flex; flex-direction: column;
    `;

    contentBox.innerHTML = `
        <style>
            @keyframes popIn { from { transform: scale(0.8) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
            .confetti-bg {
                background-image: radial-gradient(white 15%, transparent 16%), radial-gradient(white 15%, transparent 16%);
                background-size: 20px 20px;
                background-position: 0 0, 10px 10px;
                opacity: 0.1; position: absolute; top:0; left:0; width:100%; height:100%;
            }
        </style>
        
        <div style="background: ${bgGradient}; padding: 40px 20px 60px; text-align: center; position: relative;">
            <div class="confetti-bg"></div>
            <div style="font-size: 40px; margin-bottom: 10px; position: relative; z-index: 2;">${icon}</div>
            <h3 style="margin: 0; color: white; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; position: relative; z-index: 2;">${titleText}</h3>
            <p style="margin: 5px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500; position: relative; z-index: 2;">${subText}</p>
        </div>

        <div style="margin-top: -55px; display: flex; justify-content: center; position: relative; z-index: 10;">
            <img src="${photo}" style="width: 110px; height: 110px; border-radius: 50%; border: 5px solid white; object-fit: cover; box-shadow: 0 10px 25px rgba(0,0,0,0.15); background: white;">
        </div>

        <div style="padding: 20px 30px 40px; text-align: center; display: flex; flex-direction: column; align-items: center;">
            <h2 style="margin: 15px 0 5px; color: #1a1a1a; font-size: 26px; font-weight: 800; line-height: 1.2;">${name}</h2>
            
            <div style="color: #666; font-size: 16px; font-weight: 500; margin-bottom: 25px; display: flex; align-items: center; gap: 8px; justify-content: center;">
                <span>${role}</span>
                ${company ? `<span style="width: 4px; height: 4px; background: #ccc; border-radius: 50%;"></span> <span>${company}</span>` : ''}
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                ${linkedin ? `<a href="${linkedin}" target="_blank" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 10px; background: #0077b5; color: white; padding: 16px; border-radius: 16px; font-weight: 700; font-size: 15px; box-shadow: 0 5px 15px rgba(0, 119, 181, 0.25);">LinkedIn</a>` : ''}
                <button id="btnDone" style="width: 100%; padding: 16px; border: none; background: linear-gradient(135deg, #d90429, #ef233c); color: white; border-radius: 16px; font-weight: 700; cursor: pointer; font-size: 15px; box-shadow: 0 8px 20px rgba(217, 4, 41, 0.25);">Done</button>
            </div>
        </div>
    `;

    modal.style.display = "flex";

    document.getElementById("btnDone").onclick = () => {
        modal.style.display = "none";
        if (window.ViewProfilesModule && window.ViewProfilesModule.loadRecentActivity) {
            window.ViewProfilesModule.loadRecentActivity(currentUser);
        }
    };
  }

  return { initQR: initQR }; 
})();