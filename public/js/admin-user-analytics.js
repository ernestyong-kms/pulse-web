document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUser = urlParams.get('user');

    if (!targetUser) {
        window.location.href = 'admin-connections.html';
        return;
    }

    // ==========================================
    //      1. SYNCE STYLING WITH U ANALYTICS
    // ==========================================
    Chart.defaults.font.family = "'Poppins', sans-serif";
    Chart.defaults.color = '#666';

    // ==========================================
    //      2. LOAD DASHBOARD
    // ==========================================
    loadKPIs(targetUser);
    loadGrowthChart(targetUser);
    loadSkillChart(targetUser); 
    loadCategoryChart(targetUser);
    loadImpactChart(targetUser);
});

// KPI LOGIC
async function loadKPIs(username) {
    try {
        const res = await fetch(`/api/stats/summary/${username}`);
        const data = await res.json();
        const rankRes = await fetch(`/api/stats/rank/${username}`);
        const rankData = await rankRes.json();

        
        document.getElementById("kpiPoints").textContent = data.points;
        document.getElementById("kpiConnections").textContent = data.connections;
        document.getElementById("kpiEvents").textContent = data.events_attended;
        document.getElementById("kpiUpcoming").textContent = data.events_upcoming;

        const rankEl = document.getElementById("kpiRank");
        if (rankEl) {
            let rankText = "Rising Star";
            if (rankData.percentile >= 90) rankText = `Top ${100 - rankData.percentile}%`;
            else if (rankData.percentile >= 50) rankText = `Top ${100 - rankData.percentile}%`;
            rankEl.textContent = rankText;
        }
    } catch(e) { console.error("KPI Error:", e); }
}

// GROWTH CHART
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
        gradient.addColorStop(0, 'rgba(217, 4, 41, 0.4)'); 
        gradient.addColorStop(1, 'rgba(217, 4, 41, 0.0)'); 

        new Chart(context, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ 
                    label: 'Connections', 
                    data: values, 
                    borderColor: '#d90429', 
                    backgroundColor: gradient, 
                    fill: true, 
                    tension: 0.4, 
                    pointRadius: 4 
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: '#f0f0f0', borderDash: [5, 5] } }
                }
            }
        });
    } catch(e) { console.error(e); }
}

// EVENT IMPACT MATRIX
async function loadImpactChart(username) {
    try {
        const res = await fetch(`/api/stats/event-impact/${username}`);
        let data = await res.json();
        if (data.length > 5) data = data.slice(data.length - 5);
        if (data.length === 0) return;

        const ctx = document.getElementById('impactChart').getContext('2d');
        const scaleFactor = 6; 
        
        const myData = data.map((d, index) => ({ x: index, y: d.my_connections, r: Math.max(4, Math.sqrt(d.my_connections) * scaleFactor), eventName: d.name }));
        const crowdData = data.map((d, index) => ({ x: index, y: d.my_connections, r: (Math.sqrt(d.total_attendees) * scaleFactor) + 6, eventName: d.name }));

        new Chart(ctx, {
            type: 'bubble',
            data: { 
                labels: data.map(d => d.name),
                datasets: [
                    { label: 'You', data: myData, backgroundColor: '#d90429', order: 1 }, 
                    { label: 'Crowd', data: crowdData, backgroundColor: '#e5e7eb', order: 2 }
                ] 
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { 
                        type: 'category', 
                        labels: data.map(d => d.name.length > 12 ? d.name.substring(0, 10) + '..' : d.name),
                        grid: { display: false } 
                    },
                    y: { title: { display: true, text: 'Connections Made' }, beginAtZero: true }
                }
            }
        });
    } catch(e) { console.error(e); }
}

// INTEREST PROFIle
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

        new Chart(ctx, {
            type: 'doughnut',
            data: { 
                labels: top5.map(d => d.category), 
                datasets: [
                    { 
                        label: 'You', 
                        data: top5.map(d => d.youPct), 
                        backgroundColor: ['#d90429', '#3a86ff', '#8338ec', '#ff006e', '#fb5607'], 
                        borderRadius: 20, 
                        spacing: 3, 
                        weight: 2 
                    }, 
                    { 
                        label: 'Avg', 
                        data: top5.map(d => d.avgPct), 
                        backgroundColor: ['rgba(217,4,41,0.2)', 'rgba(58,134,255,0.2)', 'rgba(131,56,236,0.2)', 'rgba(255,0,110,0.2)', 'rgba(251,86,7,0.2)'], 
                        borderRadius: 10, 
                        weight: 1 
                    }
                ] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, cutout: '55%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } }
            }
        });
    } catch(e) { console.error(e); }
}

// NETWORK EXPERTISE
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

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedSkills.map(i => i[0]),
                datasets: [{ label: 'People', data: sortedSkills.map(i => i[1]), backgroundColor: '#d90429', borderRadius: 6 }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    } catch (err) { console.error(err); }
}