// js/profile.js
document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!user) return window.location.href = "index.html";

    // 1. LOAD PROFILE DATA
    loadProfile(user.username);
    
    // 2. SETUP DYNAMIC AUTOCOMPLETE
    const companyInput = document.getElementById("company");
    if (companyInput) {
        companyInput.addEventListener("input", function() {
            const query = this.value.trim();
            if (query.length > 0) {
                loadOrganizationSuggestions(query);
            } else {
                const dataList = document.getElementById('org-suggestions');
                if (dataList) dataList.innerHTML = '';
            }
        });
    }

    // 3. HANDLE FORM SUBMIT
    const form = document.getElementById("profileForm");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.querySelector(".save-btn");
        const originalText = btn.innerHTML;
        btn.innerHTML = "Saving...";
        btn.disabled = true;

        const formData = new FormData();
        formData.append("username", user.username);
        formData.append("name", document.getElementById("name").value);
        formData.append("email", document.getElementById("email").value);
        formData.append("phone_number", document.getElementById("phone").value);
        formData.append("linkedin_url", document.getElementById("linkedin").value);
        
        const isUnemployed = document.getElementById("unemployedCheck")?.checked;
        if (isUnemployed) {
            formData.append("company", "");
            formData.append("position", "");
        } else {
            formData.append("company", document.getElementById("company").value);
            formData.append("position", document.getElementById("position").value);
        }

        formData.append("qualifications", document.getElementById("qualifications").value);
        formData.append("skills", document.getElementById("skills").value);
        formData.append("special_interests", document.getElementById("interests").value);

        const fileInput = document.getElementById("profile_pic");
        if (fileInput.files[0]) {
            formData.append("profile_pic", fileInput.files[0]);
        }

        try {
            const res = await fetch("/api/user/update-profile", {
                method: "POST",
                body: formData 
            });
            const result = await res.json();
            
            if (result.success) {
                alert("Profile saved successfully!");
                
                // 🛑 FIX: Update local storage with all new data
                user.fullname = document.getElementById("name").value;
                user.skills = document.getElementById("skills").value;
                user.special_interests = document.getElementById("interests").value;
                localStorage.setItem("loggedInUser", JSON.stringify(user));
                
                loadProfile(user.username);
            } else {
                alert("Error: " + result.error);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to save profile.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
});

async function loadProfile(username) {
    try {
        const res = await fetch(`/api/user/profile?username=${username}`);
        const data = await res.json();

        if (data.error) return;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || "";
        };

        setVal("name", data.name);
        setVal("email", data.email);
        setVal("phone", data.phone_number);
        setVal("linkedin", data.linkedin_url);
        
        setVal("company", data.company);
        setVal("position", data.position);
        setVal("qualifications", data.qualifications);
        setVal("skills", data.skills);
        setVal("interests", data.special_interests);

        const preview = document.getElementById("photoPreview");
        if (data.profile_pic && preview) {
            preview.src = data.profile_pic;
        }
        
        const check = document.getElementById("unemployedCheck");
        const companyInput = document.getElementById("company");
        const positionInput = document.getElementById("position");
        
        if (check) {
            const isUnemployed = (!data.company && !data.position);
            check.checked = isUnemployed;
            
            if (isUnemployed) {
                companyInput.disabled = true;
                positionInput.disabled = true;
                companyInput.style.backgroundColor = "#f0f0f0";
                positionInput.style.backgroundColor = "#f0f0f0";
                companyInput.placeholder = "Not Applicable";
                positionInput.placeholder = "Not Applicable";
            }
        }

    } catch (err) {
        console.error("Load Profile Error:", err);
    }
}

async function loadOrganizationSuggestions(query) {
    try {
        const res = await fetch(`/api/organizations/search?q=${encodeURIComponent(query)}`); 
        const orgs = await res.json();
        
        const dataList = document.getElementById('org-suggestions');
        if (dataList) {
            dataList.innerHTML = '';
            
            orgs.forEach(orgName => {
                const option = document.createElement('option');
                option.value = orgName;
                dataList.appendChild(option);
            });
        }
    } catch (err) {
        console.error("Failed to load org suggestions", err);
    }
}

window.previewImage = function(event) {
    const reader = new FileReader();
    reader.onload = function() {
        const output = document.getElementById('photoPreview');
        output.src = reader.result;
    };
    reader.readAsDataURL(event.target.files[0]);
};