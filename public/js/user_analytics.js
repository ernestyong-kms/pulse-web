// js/user_analytics.js

let currentLbPage = 1;
let largeGrowthChartInstance = null;
let fullGrowthData = [];
let largeImpactChartInstance = null;
let fullImpactData = [];
let largeSkillChartInstance = null;
let largeCategoryChartInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!user) return window.location.href = "index.html";

    // Global Chart Defaults
    Chart.defaults.font.family = "'Poppins', sans-serif";
    Chart.defaults.color = '#666';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    Chart.defaults.plugins.tooltip.titleColor = '#1a1a1a';
    Chart.defaults.plugins.tooltip.bodyColor = '#4b5563';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(0,0,0,0.05)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 12;
    Chart.defaults.plugins.tooltip.displayColors = true;
    Chart.defaults.plugins.tooltip.boxPadding = 6;

    // Load Charts & Data
    loadKPIs(user.username);
    loadGrowthChart(user.username);
    loadSkillChart(user.username); 
    loadCategoryChart(user.username);
    loadImpactChart(user.username);
    
    // Setup Clicks (Leaderboard, Modals, etc.)
    setupInteractions(user);
});

// --- 1. KPI LOGIC ---
async function loadKPIs(username) {
    try {
        const res = await fetch(`/api/stats/summary/${username}`);
        const data = await res.json();
        const rankRes = await fetch(`/api/stats/rank/${username}`);
        const rankData = await rankRes.json();

        animateValue("kpiPoints", 0, data.points, 1000);
        animateValue("kpiConnections", 0, data.connections, 1000);
        animateValue("kpiEvents", 0, data.events_attended, 1000); 
        
        const upcomingEl = document.getElementById("kpiUpcoming");
        if(upcomingEl) animateValue("kpiUpcoming", 0, data.events_upcoming, 1000);
        
        const rankEl = document.getElementById("kpiRank");
        if (rankEl) {
            let rankText = "Rising Star";
            if (rankData.percentile >= 90) rankText = `Top ${100 - rankData.percentile}%`;
            else if (rankData.percentile >= 50) rankText = `Top ${100 - rankData.percentile}%`;
            
            rankEl.textContent = rankText;
            rankEl.dataset.rawRank = rankData.rank; 
        }
    } catch(e) { console.error("KPI Error:", e); }
}

// --- 2. INTERACTIONS ---
function setupInteractions(user) {
    const openGrowthBtn = document.getElementById("openGrowthModalBtn");
    if (openGrowthBtn) openGrowthBtn.onclick = () => {
        document.getElementById("growthModal").style.display = "flex";
        loadLargeGrowthChart(user.username); 
    };
    
    const applyGrowth = document.getElementById("applyGrowthFilter");
    if (applyGrowth) applyGrowth.onclick = () => filterGrowthChart(document.getElementById("growthStart").value, document.getElementById("growthEnd").value);
    
    const resetGrowth = document.getElementById("resetGrowthFilter");
    if (resetGrowth) resetGrowth.onclick = () => {
        document.getElementById("growthStart").value = "";
        document.getElementById("growthEnd").value = "";
        loadLargeGrowthChart(user.username);
    };

    const openImpactBtn = document.getElementById("openImpactModalBtn");
    if (openImpactBtn) openImpactBtn.onclick = () => {
        document.getElementById("impactModal").style.display = "flex";
        loadLargeImpactChart(user.username); 
    };

    const openSkillBtn = document.getElementById("openSkillModalBtn");
    if (openSkillBtn) openSkillBtn.onclick = () => {
        document.getElementById("skillModal").style.display = "flex";
        loadLargeSkillChart(user.username);
    };

    const openInterestBtn = document.getElementById("openInterestModalBtn");
    if (openInterestBtn) openInterestBtn.onclick = () => {
        document.getElementById("interestModal").style.display = "flex";
        loadLargeCategoryChart(user.username);
    };

    const cardPoints = document.getElementById("cardPoints");
    if (cardPoints) {
        cardPoints.style.cursor = "pointer";
        cardPoints.onclick = async () => {
            document.getElementById("leaderboardModal").style.display = "flex";
            loadLeaderboard(user.username);
        };
    }
    const filterSelect = document.getElementById("leaderboardFilter");
    if(filterSelect) {
        filterSelect.onchange = (e) => {
            currentLbPage = parseInt(e.target.value);
            loadLeaderboard(user.username);
        };
    }

    const cardConn = document.getElementById("cardConnections");
    if (cardConn) cardConn.onclick = () => { window.location.href = "network.html"; };

    const cardUpcoming = document.getElementById("cardUpcoming");
    if (cardUpcoming) {
        cardUpcoming.onclick = () => {
            document.getElementById("upcomingModal").style.display = "flex";
            document.getElementById("upcomingEventsList").innerHTML = `<p style="text-align:center; padding:20px;">Check the Events page for your schedule!</p>`;
        };
    }

    document.querySelectorAll(".close-modal").forEach(btn => {
        btn.onclick = (e) => { e.target.closest(".modal-overlay").style.display = "none"; };
    });
    window.onclick = (e) => {
        if (e.target.classList.contains("modal-overlay")) e.target.style.display = "none";
    };
}

// --- 3. SMALL CHARTS (Dashboard View) ---

async function loadSkillChart(username) {
    const ctx = document.getElementById('skillChart');
    if(!ctx) return; 

    try {
        const res = await fetch(`/connections?scanner_username=${username}`);
        const connections = await res.json();
        const skillCounts = {};
        connections.forEach(conn => {
            if (conn.skills && conn.skills !== "-") {
                const skillsArray = conn.skills.split(',').map(s => s.trim());
                skillsArray.forEach(skill => { if(skill) skillCounts[skill] = (skillCounts[skill] || 0) + 1; });
            }
        });
        const sortedSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const labels = sortedSkills.map(item => item[0]);
        const data = sortedSkills.map(item => item[1]);

        new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'People',
                    data: data,
                    backgroundColor: ['#d90429', '#ef233c', '#ff5c6a', '#ff8fa3', '#ffc2d1'],
                    borderRadius: 6,
                    barPercentage: 0.6 
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, grid: { display: false } }, y: { grid: { display: false } } }
            }
        });
    } catch (err) { console.error("Skill Chart Error:", err); }
}

async function loadGrowthChart(username) {
    const ctx = document.getElementById('growthChart');
    if(!ctx) return;
    try {
        const res = await fetch(`/api/stats/growth/${username}`);
        let data = await res.json();
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        data = data.filter(d => new Date(d.date) <= today);
        if (data.length > 30) data = data.slice(data.length - 30);
        
        const labels = data.map(d => new Date(d.date).toLocaleDateString(undefined, {month:'short', day:'numeric'}));
        const values = data.map(d => d.daily_count);
        
        const context = ctx.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(217, 4, 41, 0.6)'); 
        gradient.addColorStop(0.5, 'rgba(217, 4, 41, 0.1)'); 
        gradient.addColorStop(1, 'rgba(217, 4, 41, 0.0)'); 

        new Chart(context, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ 
                    label: 'New Connections', 
                    data: values, 
                    borderColor: '#d90429', 
                    borderWidth: 3, 
                    backgroundColor: gradient, 
                    fill: true, 
                    tension: 0.4, 
                    cubicInterpolationMode: 'monotone',
                    pointRadius: 4 
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { weight: '600' }, color: '#999' } },
                    y: { border: { display: false }, grid: { color: '#f0f0f0', borderDash: [5, 5] }, beginAtZero: true }
                }
            }
        });
    } catch(e) { console.error(e); }
}

// 🔥 UPDATE: FIX MISALIGNMENT ON MOBILE
async function loadImpactChart(username) {
    try {
        const res = await fetch(`/api/stats/event-impact/${username}`);
        let data = await res.json();
        if (data.length > 5) data = data.slice(data.length - 5);
        if (data.length === 0) return;

        const ctx = document.getElementById('impactChart').getContext('2d');
        const scaleFactor = 6; 
        const uniqueLabels = data.map(d => `${d.name}::${d.date}`); 
        const crowdData = data.map((d, index) => ({ x: index, y: d.my_connections, r: (Math.sqrt(d.total_attendees) * scaleFactor) + 6, eventName: d.name, type: 'Crowd Size', val: d.total_attendees }));
        const myData = data.map((d, index) => ({ x: index, y: d.my_connections, r: Math.max(4, Math.sqrt(d.my_connections) * scaleFactor), eventName: d.name, type: 'My Connections', val: d.my_connections }));

        new Chart(ctx, {
            type: 'bubble',
            data: { labels: uniqueLabels, datasets: [{ label: 'You', data: myData, backgroundColor: '#d90429', borderColor: '#fff', borderWidth: 1, order: 1 }, { label: 'Crowd', data: crowdData, backgroundColor: '#e5e7eb', borderColor: '#d1d5db', borderWidth: 1, order: 2 }] },
            options: {
                responsive: true, maintainAspectRatio: false, layout: { padding: { left: 10, right: 10 } },
                plugins: { legend: { display: false }, tooltip: { callbacks: { title: (ctx) => { const raw = ctx[0].label || ""; return "📍 " + raw.split('::')[0]; }, label: (ctx) => { const raw = ctx.raw; return `${raw.type === 'Crowd Size' ? '👥' : '👤'} ${raw.type}: ${raw.val}`; } } } },
                scales: {
                    x: { 
                        type: 'category', 
                        offset: true, 
                        ticks: { 
                            autoSkip: false, 
                            maxRotation: 90, // 🔥 FIX: Allow vertical labels (aligns better than 45deg)
                            minRotation: 0, 
                            color: '#444', 
                            font: { weight: '600', size: 10 }, 
                            callback: function(val) { 
                                let label = this.getLabelForValue(val); 
                                if (!label) return '';
                                label = label.split('::')[0];
                                
                                // 🔥 FIX: Truncate long names so they don't look messy on mobile
                                if (label.length > 12) {
                                    return label.substring(0, 10) + '..';
                                }
                                return label; 
                            } 
                        }, 
                        grid: { display: false } 
                    },
                    y: { title: { display: true, text: 'Connections Made', color: '#d90429', font: {size: 11, weight:'bold'} }, grid: { color: '#f3f4f6', borderDash: [5, 5] }, beginAtZero: true, suggestedMax: Math.max(...data.map(d => d.my_connections)) + 2 }
                }
            }
        });
    } catch(e) { console.error("Impact Chart Error:", e); }
}

async function loadCategoryChart(username) {
    try {
        const res = await fetch(`/api/stats/radar/${username}`);
        const data = await res.json();
        const ctx = document.getElementById('categoryChart').getContext('2d');
        
        const userTotal = data.userValues.reduce((a, b) => a + b, 0) || 1;
        const globalTotal = data.globalValues.reduce((a, b) => a + b, 0) || 1;
        
        const combined = data.categories.map((c, i) => ({ 
            category: c, 
            youPct: parseFloat(((data.userValues[i] / userTotal) * 100).toFixed(1)), 
            avgPct: parseFloat(((data.globalValues[i] / globalTotal) * 100).toFixed(1)) 
        }));
        
        combined.sort((a, b) => b.youPct - a.youPct);
        const top5 = combined.slice(0, 5);

        const solidColors = ['#d90429', '#3a86ff', '#8338ec', '#ff006e', '#fb5607'];
        const lightColors = [
            'rgba(217, 4, 41, 0.2)',   
            'rgba(58, 134, 255, 0.2)', 
            'rgba(131, 56, 236, 0.2)', 
            'rgba(255, 0, 110, 0.2)',  
            'rgba(251, 86, 7, 0.2)'    
        ];

        new Chart(ctx, {
            type: 'doughnut',
            data: { 
                labels: top5.map(d => d.category), 
                datasets: [
                    { 
                        label: 'You', 
                        data: top5.map(d => d.youPct), 
                        backgroundColor: solidColors, 
                        borderWidth: 0, 
                        borderRadius: 20, 
                        spacing: 3, 
                        hoverOffset: 10 
                    }, 
                    { 
                        label: 'Avg', 
                        data: top5.map(d => d.avgPct), 
                        backgroundColor: lightColors, 
                        borderWidth: 0, 
                        borderRadius: 10, 
                        spacing: 3, 
                        hoverOffset: 0 
                    }
                ] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, cutout: '55%',
                plugins: { legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true, font: { size: 12 } } } },
                layout: { padding: 10 }
            }
        });
    } catch(e) { console.error(e); }
}

// --- 4. LARGE CHARTS (Detailed Modal Views) ---

async function loadLargeSkillChart(username) {
    const ctx = document.getElementById('skillChartLarge').getContext('2d');
    if(largeSkillChartInstance) largeSkillChartInstance.destroy();

    try {
        const res = await fetch(`/connections?scanner_username=${username}`);
        const connections = await res.json();
        const skillCounts = {};
        connections.forEach(conn => {
            if (conn.skills && conn.skills !== "-") {
                const skillsArray = conn.skills.split(',').map(s => s.trim());
                skillsArray.forEach(skill => { if(skill) skillCounts[skill] = (skillCounts[skill] || 0) + 1; });
            }
        });
        const sortedSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 20); 

        largeSkillChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedSkills.map(item => item[0]),
                datasets: [{
                    label: 'People in your network',
                    data: sortedSkills.map(item => item[1]),
                    backgroundColor: '#d90429',
                    borderRadius: 4,
                    barPercentage: 1.0, 
                    categoryPercentage: 0.5 
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { beginAtZero: true }, y: { ticks: { autoSkip: false } } }
            }
        });
    } catch (err) { console.error(err); }
}

async function loadLargeCategoryChart(username) {
    const ctx = document.getElementById('categoryChartLarge').getContext('2d');
    if(largeCategoryChartInstance) largeCategoryChartInstance.destroy();

    try {
        const res = await fetch(`/api/stats/radar/${username}`);
        const data = await res.json();
        const userTotal = data.userValues.reduce((a, b) => a + b, 0) || 1;
        const globalTotal = data.globalValues.reduce((a, b) => a + b, 0) || 1;
        const combined = data.categories.map((c, i) => ({ 
            category: c, 
            youPct: parseFloat(((data.userValues[i] / userTotal) * 100).toFixed(1)), 
            avgPct: parseFloat(((data.globalValues[i] / globalTotal) * 100).toFixed(1)) 
        }));
        combined.sort((a, b) => b.youPct - a.youPct);

        largeCategoryChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: combined.map(d => d.category), 
                datasets: [
                    { label: 'You (%)', data: combined.map(d => d.youPct), backgroundColor: '#d90429', barPercentage: 1.0, categoryPercentage: 0.5 }, 
                    { label: 'Average (%)', data: combined.map(d => d.avgPct), backgroundColor: '#e5e7eb', barPercentage: 1.0, categoryPercentage: 0.5 }
                ] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                scales: { x: { ticks: { autoSkip: false } }, y: { beginAtZero: true } }
            }
        });
    } catch(e) { console.error(e); }
}

async function loadLargeGrowthChart(username) {
    const ctx = document.getElementById('growthChartLarge').getContext('2d');
    if(largeGrowthChartInstance) largeGrowthChartInstance.destroy();
    try {
        const res = await fetch(`/api/stats/growth/${username}`);
        let data = await res.json();
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        data = data.filter(d => new Date(d.date) <= today);
        fullGrowthData = data; 
        
        largeGrowthChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{ label: 'Connections', data: data.map(d => d.daily_count), borderColor: '#d90429', borderWidth: 2, tension: 0.4, cubicInterpolationMode: 'monotone', fill: true, backgroundColor: 'rgba(217, 4, 41, 0.1)' }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    } catch(e) { console.error(e); }
}

async function loadLargeImpactChart(username) {
    const ctx = document.getElementById('impactChartLarge').getContext('2d');
    if(largeImpactChartInstance) largeImpactChartInstance.destroy();
    try {
        const res = await fetch(`/api/stats/event-impact/${username}`);
        const data = await res.json();
        fullImpactData = data;

        largeImpactChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.name),
                datasets: [
                    { label: 'Your Connections', data: data.map(d => d.my_connections), backgroundColor: '#d90429', barPercentage: 0.6, categoryPercentage: 0.6 },
                    { label: 'Total Attendees', data: data.map(d => d.total_attendees), backgroundColor: '#e5e7eb', barPercentage: 0.6, categoryPercentage: 0.6 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    } catch(e) { console.error(e); }
}

async function loadLeaderboard(currentUsername) {
    const container = document.getElementById("leaderboardList");
    const filterSelect = document.getElementById("leaderboardFilter");
    container.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Loading...</div>';
    
    try {
        const res = await fetch(`/api/leaderboard?page=${currentLbPage}`);
        const responseData = await res.json();
        const users = responseData.users || responseData; 
        const totalUsers = responseData.total || 100;
        const startRank = (currentLbPage - 1) * 20 + 1;

        if (users.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No data available.</div>';
            return;
        }

        container.innerHTML = users.map((u, i) => {
            const rank = startRank + i;
            const isMe = u.username === currentUsername;
            const highlightStyle = isMe ? `background: #fff1f2; border-left: 4px solid #d90429;` : `border-bottom: 1px solid #eee;`;
            const nameStyle = isMe ? `font-weight: 800; color: #d90429;` : `font-weight: 700; color: #1a1a1a;`;
            
            let rankColor = "#666";
            if(rank === 1) rankColor = "#d90429"; 
            if(rank === 2) rankColor = "#1a1a1a"; 
            if(rank === 3) rankColor = "#1a1a1a"; 
            let rankDisplay = `<div style="width:30px; text-align:center; color:${rankColor}; font-weight:800; font-size:14px;">#${rank}</div>`;

            return `
            <div style="display:flex; align-items:center; padding:12px 15px; gap:15px; ${highlightStyle}">
                ${rankDisplay}
                <img src="${u.photo_url || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:1px solid #eee;">
                <div style="flex:1;">
                    <div style="${nameStyle}">${u.fullname} ${isMe ? '<span style="font-size:10px; background:#d90429; color:white; padding:2px 6px; border-radius:10px; margin-left:5px;">YOU</span>' : ''}</div>
                    <div style="font-size:12px; color:#888;">${u.points} pts</div>
                </div>
            </div>`;
        }).join('');

        if(filterSelect && filterSelect.options.length <= 1) {
            filterSelect.innerHTML = "";
            const totalPages = Math.ceil(totalUsers / 20);
            for(let i = 1; i <= totalPages; i++) {
                const rangeStart = (i - 1) * 20 + 1;
                const rangeEnd = Math.min(i * 20, totalUsers);
                const option = document.createElement("option");
                option.value = i;
                option.text = `${rangeStart} - ${rangeEnd}`;
                if(i === currentLbPage) option.selected = true;
                filterSelect.appendChild(option);
            }
        } else if (filterSelect) {
            filterSelect.value = currentLbPage;
        }

    } catch(e) { 
        console.error(e);
        container.innerHTML = '<p style="padding:20px; text-align:center;">Error loading data.</p>'; 
    }
}
function filterGrowthChart(start, end) {
    if(!largeGrowthChartInstance || !fullGrowthData.length) return;
    const startDate = start ? new Date(start) : new Date('2000-01-01');
    const endDate = end ? new Date(end) : new Date();
    endDate.setHours(23,59,59);
    
    const filtered = fullGrowthData.filter(d => {
        const date = new Date(d.date);
        return date >= startDate && date <= endDate;
    });

    largeGrowthChartInstance.data.labels = filtered.map(d => new Date(d.date).toLocaleDateString());
    largeGrowthChartInstance.data.datasets[0].data = filtered.map(d => d.daily_count);
    largeGrowthChartInstance.update();
}
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if(!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}