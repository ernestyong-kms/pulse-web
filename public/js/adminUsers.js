// js/adminUsers.js
document.addEventListener("DOMContentLoaded", async () => {
    
    // 1. Security Check
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!user || user.role !== 'admin') {
        window.location.href = "home.html";
        return;
    }

    const tableBody = document.getElementById("userTableBody");
    const countSpan = document.getElementById("totalUserCount");
    const searchInput = document.getElementById("searchInput");
    const companyFilter = document.getElementById("companyFilter");
    
    // Global Storage for Filtering
    let allUsersData = []; 
    let currentPage = 1;
    const rowsPerPage = 10;

    // 2. Load Users Function
    async function loadUsers() {
        try {
            const res = await fetch('/api/admin/users');
            const users = await res.json();
            
            allUsersData = users; // Save data
            
            populateCompanyFilter(users);
            renderTable(allUsersData); // Initial Render

        } catch (err) {
            console.error("Error loading users:", err);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Failed to load data.</td></tr>`;
        }
    }

    // Helper: Extract Unique Companies
    function populateCompanyFilter(users) {
        const companies = [...new Set(users.map(u => u.company).filter(c => c && c.trim() !== ""))].sort();
        companyFilter.innerHTML = '<option value="all">All Companies</option>';
        companies.forEach(comp => {
            const option = document.createElement("option");
            option.value = comp;
            option.textContent = comp;
            companyFilter.appendChild(option);
        });
    }

    // 3. Render Table Function (WITH PAGINATION)
    function renderTable(users) {
        countSpan.textContent = users.length;

        if (users.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px;">No users found matching your criteria.</td></tr>`;
            const existingNav = document.getElementById('userPagination');
            if(existingNav) existingNav.innerHTML = '';
            return;
        }

        // PAGINATION LOGIC
        const totalPages = Math.ceil(users.length / rowsPerPage);
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const pageUsers = users.slice(start, end);

        tableBody.innerHTML = pageUsers.map(u => `
            <tr>
                <td data-label="User">
                    <div style="text-align: left;">
                        <div style="font-weight: 700; color: #1a1a1a;">${u.fullname}</div>
                        <div style="font-size: 12px; color: #888;">@${u.username}</div>
                    </div>
                </td>
                <td data-label="Contact">
                    <div style="text-align: right;">
                        <div style="font-size: 13px;">${u.email}</div>
                        <div style="font-size: 12px; color: #888;">${u.phone_number || '-'}</div>
                    </div>
                </td>
                <td data-label="Role / Pts">
                    <div style="display:flex; flex-direction:column; align-items:flex-end;">
                        <span class="role-badge ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${u.role}</span>
                        <div style="font-size: 11px; color: #888; margin-top: 5px;">${u.networking_points || 0} pts</div>
                    </div>
                </td>
                <td data-label="Company">
                    <div style="text-align: right;">
                        <div style="font-weight: 600; font-size: 13px;">${u.company || 'Unemployed'}</div>
                        <div style="font-size: 12px; color: #666;">${u.position || '-'}</div>
                    </div>
                </td>
                <td data-label="Actions" style="justify-content: flex-end;">
                    <div style="display:flex; gap:5px; justify-content: flex-end;">
                        <button class="btn-view" onclick="viewUser(${u.userid})">Info</button>
                        <button class="btn-stats" onclick="window.location.href='admin-user-analytics.html?user=${u.username}'">Stats</button>
                        ${u.role !== 'admin' ? `<button class="btn-delete" onclick="deleteUser(${u.userid}, '${u.username}')">Delete</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        // RENDER PAGINATION BUTTONS
        let paginationDiv = document.getElementById("userPagination");
        if (!paginationDiv) {
            paginationDiv = document.createElement("div");
            paginationDiv.id = "userPagination";
            paginationDiv.className = "pagination-controls";
            document.querySelector(".user-table").parentNode.appendChild(paginationDiv);
        }
        
        paginationDiv.innerHTML = "";
        
        if (totalPages > 1) {
            // Prev Button
            const prev = document.createElement("button");
            prev.className = "page-btn";
            prev.innerHTML = "&laquo;";
            prev.disabled = currentPage === 1;
            prev.onclick = () => { currentPage--; renderTable(users); };
            paginationDiv.appendChild(prev);

            // Number Buttons
            for(let i=1; i<=totalPages; i++) {
                 if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                    const b = document.createElement("button");
                    b.className = `page-btn ${i === currentPage ? 'active' : ''}`;
                    b.textContent = i;
                    b.onclick = () => { currentPage = i; renderTable(users); };
                    paginationDiv.appendChild(b);
                 } else if ((i === currentPage - 2 && i > 1) || (i === currentPage + 2 && i < totalPages)) {
                    const dots = document.createElement("span");
                    dots.textContent = "...";
                    dots.style.color = "#999";
                    paginationDiv.appendChild(dots);
                 }
            }

            // Next Button
            const next = document.createElement("button");
            next.className = "page-btn";
            next.innerHTML = "&raquo;";
            next.disabled = currentPage === totalPages;
            next.onclick = () => { currentPage++; renderTable(users); };
            paginationDiv.appendChild(next);
        }
    }

    // 4. Filter Logic
    function filterUsers() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedCompany = companyFilter.value;
        
        currentPage = 1; // Reset to page 1

        const filtered = allUsersData.filter(user => {
            const matchesSearch = 
                user.fullname.toLowerCase().includes(searchTerm) || 
                user.username.toLowerCase().includes(searchTerm) || 
                user.email.toLowerCase().includes(searchTerm);
            const matchesCompany = selectedCompany === 'all' || (user.company === selectedCompany);
            return matchesSearch && matchesCompany;
        });

        renderTable(filtered);
    }

    // Event Listeners for Search/Filter
    searchInput.addEventListener("input", filterUsers);
    companyFilter.addEventListener("change", filterUsers);

    // 5. View User Function
    window.viewUser = (id) => {
        const u = allUsersData.find(user => user.userid === id);
        if (!u) return;

        document.getElementById("viewPhoto").src = u.photo_url || 'https://cdn-icons-png.flaticon.com/512/847/847969.png';
        document.getElementById("viewName").textContent = u.fullname;
        document.getElementById("viewUsername").textContent = `@${u.username}`;
        document.getElementById("viewEmail").textContent = u.email;
        document.getElementById("viewCompany").textContent = u.company || "Not specified";
        document.getElementById("viewPosition").textContent = u.position || "Not specified";

        const createTags = (str) => {
            if (!str) return '<span style="color:#ccc; font-style:italic;">None</span>';
            return str.split(',').map(s => `<span class="tag">${s.trim()}</span>`).join('');
        };

        document.getElementById("viewSkills").innerHTML = createTags(u.skills);
        document.getElementById("viewInterests").innerHTML = createTags(u.special_interests);
        document.getElementById("viewUserModal").style.display = "flex";
    };

    // 6. Delete Function
    window.deleteUser = async (id, username) => {
        if (!confirm(`Are you sure you want to delete user @${username}? This cannot be undone.`)) return;

        try {
            const res = await fetch(`/api/admin/user/${id}`, { method: 'DELETE' });
            const data = await res.json();
            
            if (data.success) {
                alert("User deleted successfully.");
                loadUsers(); // Refresh data
            } else {
                alert("Error: " + data.message);
            }
        } catch (err) {
            alert("Server error.");
        }
    };

    window.onclick = function(event) {
        const modal = document.getElementById("viewUserModal");
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    loadUsers();
});