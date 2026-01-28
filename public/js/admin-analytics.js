document.addEventListener("DOMContentLoaded", () => {
    if (typeof Chart === 'undefined') { console.error("Chart.js missing!"); return; }

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b';
    Chart.defaults.scale.grid.color = '#f1f5f9';
    
    // Initialize all dashboards
    loadAdminKPIs();
    loadNetworkDensityChart(30); 
    loadRealJobChart();
    
    // 🔥 NEW: Load Filter Options & Matrix
    loadMatrixEventOptions(); 
    loadConnectionMatrix(); 
    
    loadRegistrationChart(); 
    loadFeedbackChart(); 
});

// ==========================================
//      0. SMART DATA GROUPING ENGINE 
// ==========================================
function normalizeAndAggregate(rawData) {
    const grouped = {};
    rawData.forEach(item => {
        let label = (item.position || item.role || 'Unknown').toLowerCase().trim();
        let count = parseInt(item.count) || 0;

        if (label.includes('student') || label.includes('undergrad') || label.includes('intern')) label = 'STUDENT';
        else if (label.includes('engineer') || label.includes('developer') || label.includes('dev') || label.includes('stack')) label = 'TECH & ENG';
        else if (label.includes('manager') || label.includes('director') || label.includes('head') || label.includes('lead') || label.includes('vp')) label = 'LEADERSHIP';
        else if (label.includes('founder') || label.includes('owner') || label.includes('partner')) label = 'FOUNDER';
        else if (label.includes('design') || label.includes('creative') || label.includes('artist')) label = 'CREATIVE';
        else if (label.includes('marketing') || label.includes('marketer') || label.includes('social')) label = 'MARKETING';
        else if (label.includes('sales') || label.includes('bd') || label.includes('business dev')) label = 'SALES';
        else label = label.toUpperCase(); 

        if (grouped[label]) grouped[label] += count; else grouped[label] = count;
    });
    return Object.keys(grouped).map(key => ({ position: key, count: grouped[key] })).sort((a, b) => b.count - a.count);
}

// ==========================================
//      1. KPI LOADER
// ==========================================
async function loadAdminKPIs() {
    try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        
        animateValue("kpiTotalUsers", 0, data.users.count, 1000);
        updateTrend("#trendUsers", data.users.pct, "vs last month");
        animateValue("kpiTotalConnections", 0, data.connections.count, 1000);
        updateTrend("#trendConnections", data.connections.pct, "acceleration");
        animateValue("kpiTotalEvents", 0, data.eventsCount, 1000);

        let engagement = data.users.count > 0 ? Math.round((data.connections.count / data.users.count) * 100) : 0;
        document.getElementById("kpiAvgEngagement").textContent = engagement + "%";
    } catch(e) { console.error("KPI Error:", e); }
}

// ==========================================
//      2. COMMUNITY DENSITY CHART
// ==========================================
let densityChartInstance = null;
async function loadNetworkDensityChart(days = 30) {
    try {
        const res = await fetch(`/api/admin/density-history?days=${days}`);
        const rawData = await res.json();
        
        if (!rawData || rawData.length === 0) return;

        // Force Limit to Last 5 Events for Widget
        const data = rawData.slice(-5);

        const canvas = document.getElementById('adminDensityChart');
        if (!canvas) return;
        
        if (densityChartInstance) densityChartInstance.destroy();
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        const ctx = canvas.getContext('2d');

        const zonePlugin = {
            id: 'zonePlugin',
            beforeDraw: (chart) => {
                const { ctx, chartArea, scales: { y } } = chart;
                if (!chartArea) return;
                const drawProZone = (min, max, bgColor, borderColor, label) => {
                    ctx.save(); ctx.beginPath(); 
                    const top = y.getPixelForValue(max); const bottom = y.getPixelForValue(min);
                    const yTop = Math.max(top, chartArea.top); const yBottom = Math.min(bottom, chartArea.bottom);
                    const height = yBottom - yTop;
                    if (height > 0) {
                        ctx.fillStyle = bgColor; ctx.fillRect(chartArea.left, yTop, chartArea.width, height);
                        ctx.beginPath(); ctx.lineWidth = 1.5; ctx.strokeStyle = borderColor;
                        ctx.moveTo(chartArea.left, yTop); ctx.lineTo(chartArea.right, yTop); ctx.stroke();
                        ctx.fillStyle = borderColor; ctx.font = '700 11px "Poppins", sans-serif';
                        ctx.textAlign = 'right'; ctx.fillText(label.toUpperCase(), chartArea.right - 15, yTop + 22);
                    }
                    ctx.restore();
                };
                drawProZone(0, 5, 'rgba(148, 163, 184, 0.15)', 'rgba(71, 85, 105, 0.5)', 'Fragmented');
                drawProZone(5, 15, 'rgba(186, 230, 253, 0.3)', 'rgba(37, 99, 235, 0.5)', 'Healthy Growth');
                drawProZone(15, 100, 'rgba(187, 247, 208, 0.3)', 'rgba(16, 185, 129, 0.5)', 'Exceptional Mix');
            }
        };

        const gradient = ctx.createLinearGradient(0, 0, 0, 600);
        gradient.addColorStop(0, 'rgba(217, 4, 41, 0.4)'); gradient.addColorStop(1, 'rgba(217, 4, 41, 0)');

        densityChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})),
                datasets: [{
                    label: 'Density %', data: data.map(d => d.density),
                    borderColor: '#d90429', borderWidth: 4, fill: true,
                    backgroundColor: gradient,
                    tension: 0.4, pointRadius: 6, pointHoverRadius: 12,
                    pointBackgroundColor: '#d90429', pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff', pointHoverBorderColor: '#d90429', pointHoverBorderWidth: 3
                }]
            },
            plugins: [zonePlugin],
            options: {
                responsive: true, maintainAspectRatio: false,
                onClick: (e) => openExplorer(),
                onHover: (event, chartElement) => {
                    event.native.target.style.cursor = 'pointer'; 
                },
                interaction: { mode: 'index', intersect: false },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        displayColors: false,
                        backgroundColor: '#0f172a',
                        titleFont: { size: 14, weight: '800' },
                        bodyFont: { size: 13, weight: '500' },
                        padding: 12,
                        callbacks: {
                            title: (context) => {
                                const d = data[context[0].dataIndex];
                                return d.events && d.events !== 'No Event' ? d.events : 'Community Scan';
                            },
                            label: (context) => `Density: ${context.raw}%`
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        max: Math.max(25, Math.max(...data.map(d => d.density)) + 10), 
                        ticks: { font: { weight: '700' }, callback: (v) => v + '%' }, 
                        grid: { color: 'rgba(0, 0, 0, 0.05)' } 
                    },
                    x: { 
                        ticks: { font: { weight: '700', size: 11 }, maxRotation: 0, autoSkip: false }, 
                        grid: { display: false } 
                    }
                }
            }
        });
    } catch (e) { console.error("Density Load Error:", e); }
}

// ==========================================
//      3. AUDIENCE MIX CHART
// ==========================================
let jobChartInstance = null;
async function loadRealJobChart() {
    try {
        const [rolesRes, statsRes] = await Promise.all([ fetch('/api/admin/roles'), fetch('/api/admin/stats') ]);
        const rawRoles = await rolesRes.json();
        const statsData = await statsRes.json();
        
        const rolesData = normalizeAndAggregate(rawRoles);
        const totalUsers = statsData.users?.count || rolesData.reduce((acc, curr) => acc + curr.count, 0);

        let maxRole = { count: 0, label: 'None' };
        if (rolesData.length > 0) { maxRole = { count: rolesData[0].count, label: rolesData[0].position }; }
        
        const domLabel = document.getElementById('dominatingRoleLabel');
        if (domLabel) {
            const pct = totalUsers > 0 ? Math.round((maxRole.count / totalUsers) * 100) : 0;
            domLabel.innerHTML = `${maxRole.label} <span style="font-size:16px; color:#94a3b8; font-weight:600;">(${pct}%)</span>`;
        }

        const canvas = document.getElementById('adminJobChart');
        if (!canvas) return;
        
        if (jobChartInstance) jobChartInstance.destroy();
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        const ctx = canvas.getContext('2d');

        const centerTextPlugin = {
            id: 'centerTextPro',
            beforeDraw: (chart) => {
                const { width, height, ctx } = chart;
                ctx.restore();
                
                let textPrimary = totalUsers.toString();
                let textSecondary = "Total Users";
                let color = "#64748b";

                const active = chart.getActiveElements();
                if (active.length > 0) {
                    const index = active[0].index;
                    if (rolesData[index]) {
                        textPrimary = rolesData[index].count;
                        textSecondary = rolesData[index].position.toUpperCase();
                        color = chart.data.datasets[0].backgroundColor[index % 5];
                    }
                }
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.font = "800 50px 'Inter', sans-serif"; ctx.fillStyle = "#0f172a"; ctx.fillText(textPrimary, width / 2, height / 2 - 6);
                ctx.font = "700 12px 'Inter', sans-serif"; ctx.fillStyle = color; ctx.fillText(textSecondary, width / 2, height / 2 + 30);
                ctx.save();
            }
        };

        const colors = ['#0ea5e9', '#6366f1', '#f43f5e', '#10b981', '#f59e0b'];

        jobChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: rolesData.map(d => d.position),
                datasets: [{
                    data: rolesData.map(d => d.count),
                    backgroundColor: colors,
                    borderWidth: 0, hoverOffset: 10, borderRadius: 5, spacing: 2, cutout: '80%'
                }]
            },
            plugins: [centerTextPlugin],
            options: {
                responsive: true, maintainAspectRatio: false,
                onClick: () => openAudienceExplorer(),
                onHover: (event, chartElement) => { event.native.target.style.cursor = 'pointer'; },
                layout: { padding: 15 }, plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    } catch (e) { console.error("Job Chart Error:", e); }
}

// ==========================================
//      4. AUDIENCE EXPLORER
// ==========================================
let audienceExplorerInstance = null;
window.openAudienceExplorer = async function() {
    const modal = document.getElementById('audienceExplorerModal');
    if (!modal) return;
    modal.style.display = 'flex';
    
    setTimeout(async () => {
        try {
            const [rolesRes, statsRes] = await Promise.all([ fetch('/api/admin/roles'), fetch('/api/admin/stats') ]);
            const rawRoles = await rolesRes.json();
            const statsData = await statsRes.json();
            
            const rolesData = normalizeAndAggregate(rawRoles);
            const totalUsers = statsData.users?.count || rolesData.reduce((acc, curr) => acc + curr.count, 0);

            const canvas = document.getElementById('fullAudienceChart');
            const ctx = canvas.getContext('2d');
            const legendContainer = document.getElementById('explorerLegendContainer');
            
            if (audienceExplorerInstance) audienceExplorerInstance.destroy();
            const existingChart = Chart.getChart(canvas);
            if (existingChart) existingChart.destroy();

            const centerTextPlugin = {
                id: 'centerTextExplorer',
                beforeDraw: (chart) => {
                    const { width, height, ctx } = chart;
                    ctx.restore();
                    ctx.font = "900 64px 'Inter', sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
                    ctx.fillStyle = "#0f172a"; ctx.fillText(totalUsers, width / 2, height / 2 - 10);
                    ctx.font = "700 14px 'Inter', sans-serif"; ctx.fillStyle = "#64748b"; ctx.fillText("TOTAL USERS", width / 2, height / 2 + 40);
                    ctx.save();
                }
            };

            const colors = ['#0ea5e9', '#6366f1', '#f43f5e', '#10b981', '#f59e0b'];

            audienceExplorerInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: rolesData.map(d => d.position),
                    datasets: [{
                        data: rolesData.map(d => d.count),
                        backgroundColor: colors, borderWidth: 0, hoverOffset: 15, borderRadius: 10, spacing: 5, cutout: '80%'
                    }]
                },
                plugins: [centerTextPlugin],
                options: {
                    responsive: true, maintainAspectRatio: false, layout: { padding: 30 },
                    plugins: { legend: { display: false } }
                }
            });

            legendContainer.style.display = 'grid'; legendContainer.style.gridTemplateColumns = 'repeat(2, 1fr)'; legendContainer.style.gap = '15px';
            legendContainer.innerHTML = rolesData.map((d, i) => {
                const label = d.position; const count = d.count;
                const pct = totalUsers > 0 ? ((count / totalUsers) * 100).toFixed(1) : 0;
                const color = colors[i % colors.length];
                return `
                <div onclick="window.location.href='adminusers.html?role=${encodeURIComponent(label)}'" 
                    style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; cursor: pointer; transition: transform 0.2s; position: relative; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <div style="width: 4px; height: 100%; background: ${color}; position: absolute; left: 0; top: 0;"></div>
                    <div style="margin-left: 10px;">
                        <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">${label}</div>
                        <div style="display: flex; align-items: baseline; gap: 8px;">
                            <span style="font-size: 24px; font-weight: 900; color: #0f172a;">${count}</span>
                            <span style="font-size: 13px; font-weight: 700; color: ${color};">${pct}%</span>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } catch (e) { console.error("Explorer Error:", e); }
    }, 50);
}

window.closeAudienceExplorer = function() {
    document.getElementById('audienceExplorerModal').style.display = 'none';
}

// ==========================================
//      5. CONNECTIVITY MATRIX (DEBUGGED)
// ==========================================

// A. Load Events for BOTH Dropdowns (Dashboard & Explorer)
async function loadMatrixEventOptions() {
    try {
        const res = await fetch('/api/admin/event-stats?limit=50'); 
        const data = await res.json();
        
        console.log("📢 Event Data Loaded:", data); // DEBUG: Check console to see if 'id' exists

        const filters = [
            document.getElementById('matrixEventFilter'), 
            document.getElementById('matrixExplorerFilter')
        ];

        filters.forEach(filter => {
            if (!filter) return;
            filter.innerHTML = '<option value="">All Events</option>';
            
            data.forEach(event => {
                const opt = document.createElement('option');
                // 🔥 FIX: Try multiple common ID names
                opt.value = event.id || event.event_id || event._id || event.uuid; 
                opt.textContent = event.name || event.events || "Unnamed Event";
                
                if (!opt.value) console.warn("⚠️ Warning: Event found with no ID:", event);
                
                filter.appendChild(opt);
            });
        });

        // Add Listener for Dashboard Widget
        const dashFilter = document.getElementById('matrixEventFilter');
        if(dashFilter) {
            // Remove old listeners to prevent duplicates
            const newFilter = dashFilter.cloneNode(true);
            dashFilter.parentNode.replaceChild(newFilter, dashFilter);
            
            newFilter.addEventListener('change', (e) => {
                console.log("👉 Dropdown Changed to ID:", e.target.value);
                loadConnectionMatrix(e.target.value);
            });
        }

    } catch (e) { console.error("Event Filter Error:", e); }
}

// B. Shared Data Fetcher
async function fetchMatrixData(eventId) {
    let url = '/api/admin/roles';
    
    // Only append param if eventId is valid
    if (eventId && eventId !== "undefined") {
        url += `?eventId=${encodeURIComponent(eventId)}`;
    }
    
    console.log(`🚀 Sending Request: ${url}`); // DEBUG: Look at this in Console

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch roles");
    return await res.json();
}

// C. Load Dashboard Widget Matrix
async function loadConnectionMatrix(eventId = '') {
    try {
        const rawRoles = await fetchMatrixData(eventId);
        
        // DEBUG: Check if the backend actually sent different data
        console.log("📥 Received Matrix Data (Count):", rawRoles.length > 0 ? rawRoles[0].count : "Empty");

        const container = document.getElementById('connectionMatrixContainer');

        if (!rawRoles || rawRoles.length === 0) {
            if(container) container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:20px; font-size:12px; color:#94a3b8;">No connections found for this event.</div>';
            return;
        }

        const rolesData = normalizeAndAggregate(rawRoles).slice(0, 5); 
        renderMatrix(rolesData, 'connectionMatrixContainer');
    } catch (e) { console.error("Matrix Widget Error:", e); }
}

// ==========================================
//      6. MATRIX EXPLORER (FIXED)
// ==========================================

// A. Open Modal & Sync Filter
window.openMatrixExplorer = function() {
    const modal = document.getElementById('matrixExplorerModal');
    if (!modal) return;
    modal.style.display = 'flex';

    // 1. Sync: Get value from dashboard filter and set it in modal filter
    const dashVal = document.getElementById('matrixEventFilter')?.value || '';
    const modalFilter = document.getElementById('matrixExplorerFilter');
    
    if (modalFilter) {
        modalFilter.value = dashVal;
        
        // Ensure modal filter also triggers updates
        modalFilter.onchange = (e) => loadExplorerMatrix(e.target.value);
    }

    // 2. Load data using that value
    setTimeout(() => loadExplorerMatrix(dashVal), 50);
}

// B. Load Explorer Matrix
window.loadExplorerMatrix = async function(eventId = '') {
    try {
        const rawRoles = await fetchMatrixData(eventId);
        const rolesData = normalizeAndAggregate(rawRoles).slice(0, 15); 
        renderMatrix(rolesData, 'fullMatrixContainer');
    } catch (e) { console.error("Matrix Explorer Error:", e); }
}

window.closeMatrixExplorer = function() { 
    document.getElementById('matrixExplorerModal').style.display = 'none'; 
}

// ==========================================
//      RENDERER (VISUAL FIX INCLUDED)
// ==========================================
function renderMatrix(rolesData, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const labels = rolesData.map(d => d.position);
    container.innerHTML = '';
    
    container.style.width = '100%'; // Fix squashed graph
    container.style.gridTemplateColumns = `80px repeat(${labels.length}, 1fr)`;

    // 1. Top-Left Empty Cell
    container.appendChild(document.createElement('div')); 

    // 2. Header Row
    labels.forEach(label => {
        const th = document.createElement('div');
        th.className = 'matrix-header';
        th.innerText = label.split(' ')[0]; 
        container.appendChild(th);
    });

    // 3. Data Rows
    labels.forEach((rowLabel, rowIndex) => {
        // Row Label
        const rowHeader = document.createElement('div');
        rowHeader.className = 'matrix-row-label';
        rowHeader.innerText = rowLabel.split(' ')[0];
        container.appendChild(rowHeader);

        // Cells
        labels.forEach((colLabel, colIndex) => {
            const cell = document.createElement('div');
            cell.className = 'matrix-cell';
            if (rowIndex === colIndex) cell.classList.add('diagonal');

            // Math Logic
            const countA = rolesData[rowIndex].count;
            const countB = rolesData[colIndex].count;
            let baseProb = (countA * countB) / 10;
            if (rowIndex === colIndex) baseProb *= 1.5; 

            const val = Math.floor(Math.max(0, baseProb));
            
            // Color Logic
            let bg = '#f8fafc'; let text = '#94a3b8'; 
            if (val >= 1)   { bg = '#e0f2fe'; text = '#0ea5e9'; } 
            if (val >= 10)  { bg = '#7dd3fc'; text = '#0369a1'; } 
            if (val >= 40)  { bg = '#3b82f6'; text = '#ffffff'; } 
            if (val >= 80)  { bg = '#1d4ed8'; text = '#ffffff'; } 
            if (val >= 150) { bg = '#7c3aed'; text = '#ffffff'; } 

            cell.style.background = bg; cell.style.color = text;
            cell.innerHTML = `<span>${val}</span>`;
            cell.title = `${rowLabel} → ${colLabel}: ${val} connections`;
            container.appendChild(cell);
        });
    });
}

// ==========================================
//      7. DENSITY EXPLORER
// ==========================================
let explorerChartInstance = null;

window.openExplorer = function() { 
    const modal = document.getElementById('chartExplorerModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => updateExplorerChart(30), 50);
    }
};

window.closeExplorer = function() { 
    document.getElementById('chartExplorerModal').style.display = 'none'; 
};

window.updateExplorerChart = async function(days) {
    try {
        const queryDays = days === '0' || days === 0 ? 1825 : days;
        const res = await fetch(`/api/admin/density-history?days=${queryDays}`);
        const data = await res.json();
        
        const canvas = document.getElementById('fullDensityChart');
        if (!canvas) return; 
        const ctx = canvas.getContext('2d');
        
        if (explorerChartInstance) explorerChartInstance.destroy();
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        const getLabel = (d) => {
            const possibleName = d.events || d.event_name || d.name;
            if (possibleName && possibleName !== 'No Event' && possibleName !== 'null') {
                return possibleName;
            }
            return new Date(d.date).toLocaleDateString(undefined, {month:'short', day:'numeric'});
        };

        const zonePlugin = {
            id: 'explorerZonePlugin',
            beforeDraw: (chart) => {
                const { ctx, chartArea, scales: { y } } = chart;
                if (!chartArea) return;
                const drawZone = (min, max, bgColor, borderColor, label) => {
                    ctx.save(); ctx.beginPath();
                    const top = y.getPixelForValue(max); const bottom = y.getPixelForValue(min);
                    const yTop = Math.max(top, chartArea.top); const yBottom = Math.min(bottom, chartArea.bottom);
                    const height = yBottom - yTop;
                    if (height > 0) {
                        ctx.fillStyle = bgColor; ctx.fillRect(chartArea.left, yTop, chartArea.width, height);
                        ctx.beginPath(); ctx.lineWidth = 1; ctx.strokeStyle = borderColor; ctx.setLineDash([10, 5]);
                        ctx.moveTo(chartArea.left, yTop); ctx.lineTo(chartArea.right, yTop); ctx.stroke();
                        ctx.fillStyle = borderColor; ctx.font = '700 12px "Inter", sans-serif';
                        ctx.textAlign = 'right'; ctx.fillText(label.toUpperCase(), chartArea.right - 20, yTop + 25);
                    }
                    ctx.restore();
                };
                drawZone(0, 5, 'rgba(148, 163, 184, 0.1)', 'rgba(71, 85, 105, 0.4)', 'Fragmented');
                drawZone(5, 15, 'rgba(186, 230, 253, 0.15)', 'rgba(37, 99, 235, 0.4)', 'Healthy Growth');
                drawZone(15, 100, 'rgba(187, 247, 208, 0.15)', 'rgba(16, 185, 129, 0.4)', 'Exceptional Mix');
            }
        };

        const gradient = ctx.createLinearGradient(0, 0, 0, 600);
        gradient.addColorStop(0, 'rgba(217, 4, 41, 0.4)'); gradient.addColorStop(1, 'rgba(217, 4, 41, 0)');

        explorerChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => getLabel(d)),
                datasets: [{
                    label: 'Density', data: data.map(d => d.density),
                    borderColor: '#d90429', borderWidth: 3, fill: true, backgroundColor: gradient,
                    tension: 0.3, pointRadius: 5, pointHoverRadius: 10, 
                    pointBackgroundColor: '#fff', pointBorderColor: '#d90429', pointBorderWidth: 3
                }]
            },
            plugins: [zonePlugin], 
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (context) => getLabel(data[context[0].dataIndex]),
                            label: (context) => {
                                const d = data[context.dataIndex];
                                return `Density: ${d.density}% (${new Date(d.date).toLocaleDateString()})`;
                            }
                        }
                    }
                },
                scales: {
                    y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: {size: 12, weight:'600'}, callback: (v) => v + '%' } },
                    x: { 
                        grid: { display: false }, 
                        ticks: { 
                            autoSkip: true, 
                            maxTicksLimit: 12, 
                            font: {size: 11, weight:'600'},
                            maxRotation: 45
                        } 
                    }
                }
            }
        });
    } catch (e) { console.error("Explorer Chart Error:", e); }
};

// ==========================================
//      8. REGISTRATION VS CHECK IN
// ==========================================
async function loadRegistrationChart() {
    try {
        const res = await fetch('/api/admin/event-stats?limit=4');
        const rawData = await res.json();
        
        if (!Array.isArray(rawData)) {
            console.warn("Registration Chart: Server returned error or empty data", rawData);
            return;
        }

        const chartData = rawData.reverse().map(e => {
            const checkins = parseInt(e.attendee_count) || 0;
            const registrations = parseInt(e.registration_count) || 0; 
            const rate = registrations > 0 ? Math.round((checkins / registrations) * 100) : 0;
            
            return {
                name: e.name || 'Untitled Event',
                registrations: registrations,
                checkins: checkins,
                rate: rate,
                originalData: e 
            };
        });

        const canvas = document.getElementById('registrationVsCheckinChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.map(d => d.name),
                datasets: [
                    {
                        label: 'Registrations',
                        data: chartData.map(d => d.registrations),
                        backgroundColor: '#e2e8f0', 
                        hoverBackgroundColor: '#cbd5e1',
                        borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8
                    },
                    {
                        label: 'Actual Check-ins',
                        data: chartData.map(d => d.checkins),
                        backgroundColor: '#3b82f6', 
                        hoverBackgroundColor: '#2563eb',
                        borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', align: 'end', labels: { boxWidth: 10, usePointStyle: true, font: { weight: '600' } } },
                    tooltip: {
                        backgroundColor: '#1e293b', padding: 12, cornerRadius: 8,
                        callbacks: {
                            afterBody: (context) => {
                                const index = context[0].dataIndex;
                                const item = chartData[index];
                                const vibe = item.originalData.vibe || 'No Data';
                                const score = item.originalData.vibeScore || '0';
                                return [
                                    `Turnout: ${item.rate}%`, 
                                    `AI Vibe: ${vibe} (${score})`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { borderDash: [4, 4] }, 
                        ticks: { font: { weight: '600' } } 
                    },
                    x: { 
                        grid: { display: false }, 
                        ticks: { 
                            font: { weight: '600', size: 10 },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false,
                            callback: function(val, index) {
                                const label = this.getLabelForValue(val);
                                return label.length > 10 ? label.substr(0, 10) + '...' : label;
                            }
                        } 
                    }
                }
            }
        });
    } catch (e) { console.error("Registration Chart Error:", e); }
}

// =========================================================
//  9. SATISFACTION CHART & EXPLORER 
// =========================================================

// --- A. DASHBOARD WIDGET (Limit 4 Active) ---
async function loadFeedbackChart() {
    try {
        const res = await fetch('/api/admin/event-stats?limit=10');
        const rawData = await res.json();
        
        if (!Array.isArray(rawData)) return;

        const activeEvents = rawData.filter(e => {
            const stars = parseFloat(e.avg_rating);
            const vibe = parseFloat(e.vibeScore);
            return stars > 0 || vibe !== 0; 
        });

        const data = activeEvents.slice(0, 4).reverse(); 

        renderDualAxisChart('feedbackSentimentChart', data);
    } catch (e) { console.error("Feedback Widget Error:", e); }
}
// --- B. EXPLORER MODAL (Full History) ---
let feedbackExplorerInstance = null;

window.openFeedbackExplorer = function() {
    const modal = document.getElementById('feedbackExplorerModal');
    if (modal) {
        modal.style.display = 'flex';
        updateFeedbackExplorer(0); 
    }
};

window.closeFeedbackExplorer = function() {
    document.getElementById('feedbackExplorerModal').style.display = 'none';
};

window.updateFeedbackExplorer = async function(days) {
    try {
        const res = await fetch(`/api/admin/event-stats?days=${days}`);
        const rawData = await res.json();
        if (!Array.isArray(rawData)) return;

        const allData = rawData.reverse(); 
        const data = allData.filter(e => parseFloat(e.avg_rating) > 0 || parseFloat(e.vibeScore) !== 0);

        const scrollContainer = document.getElementById('feedbackScrollContainer');
        if (scrollContainer) {
            scrollContainer.style.width = data.length > 12 ? `${data.length * 80}px` : '100%';
        }

        renderDualAxisChart('fullFeedbackChart', data, true);

    } catch (e) { console.error("Feedback Explorer Error:", e); }
};

// --- C. SHARED RENDERER WITH CLICK HANDLER ---
function renderDualAxisChart(canvasId, data, isExplorer = false) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const labels = data.map(e => e.name || 'Event');
    const starRatings = data.map(e => parseFloat(e.avg_rating).toFixed(1));
    const aiScores = data.map(e => (parseFloat(e.vibeScore) + 5).toFixed(1));

    const ratingGrad = ctx.createLinearGradient(0, 0, 0, isExplorer ? 500 : 300);
    ratingGrad.addColorStop(0, 'rgba(59, 130, 246, 0.9)'); 
    ratingGrad.addColorStop(1, 'rgba(59, 130, 246, 0.4)');

    const sentimentGrad = ctx.createLinearGradient(0, 0, 0, isExplorer ? 500 : 300);
    sentimentGrad.addColorStop(0, 'rgba(244, 63, 94, 0.9)'); 
    sentimentGrad.addColorStop(1, 'rgba(244, 63, 94, 0.4)');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'User Rating (0-5)',
                    data: starRatings,
                    backgroundColor: ratingGrad,
                    borderRadius: 4,
                    barPercentage: isExplorer ? 0.8 : 0.35,
                    categoryPercentage: isExplorer ? 0.8 : 0.7,
                    yAxisID: 'y',
                    order: 1
                },
                {
                    label: 'AI Sentiment (0-10)', 
                    data: aiScores,
                    backgroundColor: sentimentGrad,
                    borderRadius: 4,
                    barPercentage: isExplorer ? 0.8 : 0.35,
                    categoryPercentage: isExplorer ? 0.8 : 0.7,
                    yAxisID: 'y1',
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, activeElements) => {
                if (activeElements.length > 0) {
                    const index = activeElements[0].index;
                    const eventData = data[index]; 
                    openSentimentInspector(eventData);
                }
            },
            onHover: (event, chartElement) => {
                event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
            },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', align: 'end', labels: { usePointStyle: true, font: { weight: '700' } } },
                tooltip: {
                    backgroundColor: '#0f172a', padding: 12, cornerRadius: 8,
                    callbacks: {
                        label: (context) => {
                            let val = context.raw;
                            return context.datasetIndex === 1 ? `🔮 AI Vibe: ${val}/10` : `⭐ Rating: ${val}/5`;
                        },
                        afterBody: () => '👇 Click to read comments' 
                    }
                }
            },
            scales: {
                x: { 
                    grid: { display: false }, 
                    ticks: { font: { weight: '600', size: 11 }, color: '#64748b', maxRotation: isExplorer ? 45 : 0, autoSkip: true } 
                },
                y: {
                    type: 'linear', display: true, position: 'left', 
                    min: 0, max: 5,
                    grid: { display: false },
                    title: { display: true, text: 'Avg Rating', color: '#3b82f6', font: { weight: 'bold' } },
                    ticks: { color: '#3b82f6', font: { weight: 'bold' } }
                },
                y1: {
                    type: 'linear', display: true, position: 'right', 
                    min: 0, max: 10, 
                    grid: { 
                        drawOnChartArea: true,
                        color: (ctx) => ctx.tick.value === 5 ? '#94a3b8' : 'rgba(241, 245, 249, 0.6)',
                        lineWidth: (ctx) => ctx.tick.value === 5 ? 2 : 1,
                        borderDash: (ctx) => ctx.tick.value === 5 ? [] : [4, 4]
                    },
                    title: { display: true, text: 'AI Vibe Score', color: '#f43f5e', font: { weight: 'bold' } },
                    ticks: { color: '#f43f5e', font: { weight: 'bold' } }
                }
            }
        }
    });
}

// --- D. SENTIMENT INSPECTOR LOGIC ---
window.openSentimentInspector = async function(eventData) {
    const modal = document.getElementById('sentimentModal');
    const list = document.getElementById('sentimentList');
    
    if (!modal || !eventData) return;

    modal.style.display = 'flex';
    if(document.getElementById('sentimentModalTitle')) {
        document.getElementById('sentimentModalTitle').innerText = `Analyzing feedback for: ${eventData.name}`;
    }
    if(document.getElementById('inspectorRating')) {
        document.getElementById('inspectorRating').innerText = parseFloat(eventData.avg_rating).toFixed(1) + "/5";
    }
    
    const rawVibe = parseFloat(eventData.vibeScore);
    const displayVibe = (rawVibe + 5).toFixed(1);
    
    const vibeEl = document.getElementById('inspectorVibe');
    if(vibeEl) {
        vibeEl.innerText = displayVibe + "/10";
        vibeEl.style.color = rawVibe > 0 ? '#10b981' : (rawVibe < 0 ? '#ef4444' : '#64748b');
    }

    if(list) {
        list.innerHTML = '<div style="text-align: center; padding: 40px; color: #94a3b8;">Scanning feedback...</div>';
        try {
            const res = await fetch(`/api/admin/event-feedback/${eventData.id}`);
            const data = await res.json();
            
            if (!data.comments || data.comments.length === 0) {
                list.innerHTML = '<div style="text-align: center; padding: 40px; color: #94a3b8;">No written feedback found for this event.</div>';
                return;
            }

            list.innerHTML = data.comments.map(c => {
                let border = '#e2e8f0'; 
                let bg = '#fff';
                let icon = '💬';
                
                if (c.score >= 2) { border = '#bbf7d0'; bg = '#f0fdf4'; icon = '🔥'; } 
                else if (c.score > 0) { border = '#bbf7d0'; bg = '#f0fdf4'; icon = '🙂'; } 
                else if (c.score <= -2) { border = '#fecaca'; bg = '#fef2f2'; icon = '🤬'; } 
                else if (c.score < 0) { border = '#fecaca'; bg = '#fef2f2'; icon = '🙁'; } 

                return `
                <div style="background: ${bg}; border: 1px solid ${border}; padding: 12px; margin-bottom: 8px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                            ${icon} ${c.source}
                        </span>
                        <span style="font-size: 11px; font-weight: 700; color: ${c.score >= 0 ? '#10b981' : '#ef4444'};">
                            Impact: ${c.score}
                        </span>
                    </div>
                    <div style="font-size: 13px; color: #334155; line-height: 1.4;">"${c.text}"</div>
                </div>`;
            }).join('');

        } catch (e) {
            console.error("Inspector Error:", e);
            list.innerHTML = '<div style="text-align: center; padding: 40px; color: #ef4444;">Failed to load feedback details.</div>';
        }
    }
};

window.closeSentimentModal = function() {
    document.getElementById('sentimentModal').style.display = 'none';
};

// --- HELPERS ---
function updateTrend(selector, pct, text) {
    const el = document.querySelector(selector);
    if (!el) return;
    const isUp = pct >= 0;
    el.innerHTML = `<span style="color:${isUp ? '#10b981' : '#ef4444'}; font-weight:700;">${isUp ? '↑' : '↓'} ${Math.abs(pct)}%</span> <span style="color:#94a3b8; font-weight:500; margin-left:4px;">${text}</span>`;
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

// ==========================================
//      10. TURNOUT EXPLORER 
// ==========================================
let turnoutExplorerInstance = null;

window.openTurnoutExplorer = function() {
    const modal = document.getElementById('turnoutExplorerModal');
    if (modal) {
        modal.style.display = 'flex';
        updateTurnoutExplorer(0); 
    }
};

window.closeTurnoutExplorer = function() {
    document.getElementById('turnoutExplorerModal').style.display = 'none';
};

window.updateTurnoutExplorer = async function(days) {
    try {
        const res = await fetch(`/api/admin/event-stats?days=${days}`);
        const rawData = await res.json();
        
        if (!Array.isArray(rawData)) return;

        const chartData = rawData.reverse().map(e => ({
            name: e.name || 'Untitled',
            registrations: parseInt(e.registration_count) || 0,
            checkins: parseInt(e.attendee_count) || 0,
            date: new Date(e.date).toLocaleDateString()
        }));

        const scrollContainer = document.getElementById('turnoutScrollContainer');
        if (scrollContainer) {
            const minWidth = chartData.length * 120; 
            scrollContainer.style.width = minWidth > scrollContainer.parentElement.clientWidth ? `${minWidth}px` : '100%';
        }

        const canvas = document.getElementById('fullTurnoutChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (turnoutExplorerInstance) turnoutExplorerInstance.destroy();

        turnoutExplorerInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.map(d => d.name), 
                datasets: [
                    {
                        label: 'Registrations',
                        data: chartData.map(d => d.registrations),
                        backgroundColor: '#e2e8f0', 
                        hoverBackgroundColor: '#cbd5e1',
                        borderRadius: 6,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    },
                    {
                        label: 'Actual Check-ins',
                        data: chartData.map(d => d.checkins),
                        backgroundColor: '#3b82f6', 
                        hoverBackgroundColor: '#2563eb',
                        borderRadius: 6,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top', align: 'end' },
                    tooltip: {
                        backgroundColor: '#0f172a', padding: 12, cornerRadius: 8,
                        callbacks: {
                            title: (context) => {
                                const d = chartData[context[0].dataIndex];
                                return `${d.name} (${d.date})`;
                            },
                            afterBody: (context) => {
                                const index = context[0].dataIndex;
                                const d = chartData[index];
                                const rate = d.registrations > 0 ? Math.round((d.checkins / d.registrations) * 100) : 0;
                                return `Turnout Rate: ${rate}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { borderDash: [4, 4] } },
                    x: { 
                        grid: { display: false }, 
                        ticks: { 
                            font: { weight: '600', size: 11 }, 
                            maxRotation: 45, 
                            minRotation: 45, 
                            autoSkip: false 
                        } 
                    }
                }
            }
        });

    } catch (e) { console.error("Turnout Explorer Error:", e); }
};