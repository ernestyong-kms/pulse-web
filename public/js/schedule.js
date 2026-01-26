// js/schedule.js

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let globalEvents = []; 

document.addEventListener("DOMContentLoaded", () => {
    loadScheduleData();
    
    document.getElementById("prevMonthBtn").onclick = () => changeMonth(-1);
    document.getElementById("nextMonthBtn").onclick = () => changeMonth(1);
});

async function loadScheduleData() {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!user) return; // Stop if not logged in

    try {
        const [eventsRes, regRes] = await Promise.all([
            fetch('/getEvents'),
            fetch(`/getUserRegistrations/${user.username}`)
        ]);

        if (!eventsRes.ok || !regRes.ok) throw new Error("Failed to fetch data");
        
        const allEvents = await eventsRes.json();
        const myRegistrationIds = await regRes.json(); 

        globalEvents = allEvents.map(e => {
            const isRegistered = myRegistrationIds.includes(e.id);
            return {
                id: e.id,
                title: e.name, 
                date: new Date(e.date), 
                time: e.time || "TBD",
                isRegistered: isRegistered 
            };
        });

        renderCalendar(currentMonth, currentYear);
        // Removed renderAgendaList call

    } catch (err) {
        console.error("Schedule Error:", err);
    }
}

function renderCalendar(month, year) {
    const grid = document.getElementById("calGrid");
    const monthTitle = document.getElementById("calMonthYear");
    if (!grid || !monthTitle) return;

    grid.innerHTML = "";
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthTitle.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 1. Empty Padding
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement("div");
        cell.className = "cal-day-cell is-padding";
        grid.appendChild(cell);
    }

    // 2. Render Days
    const today = new Date();
    today.setHours(0,0,0,0);
    
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement("div");
        cell.className = "cal-day-cell";
        
        const num = document.createElement("div");
        num.className = "cal-day-number";
        num.innerText = day;
        cell.appendChild(num);

        const cellDate = new Date(year, month, day);
        cellDate.setHours(0,0,0,0);

        const dayEvents = globalEvents
            .filter(e => e.date.toDateString() === cellDate.toDateString())
            .sort((a, b) => b.isRegistered - a.isRegistered);

        if (cellDate.getTime() === today.getTime()) {
            cell.classList.add("is-today");
        }

        if (dayEvents.length > 0) {
            const hasRegistered = dayEvents.some(e => e.isRegistered);
            const isPast = cellDate < today;

            if (isPast) {
                if (hasRegistered) cell.classList.add("has-event-attended"); // Teal
                else cell.classList.add("has-event-missed");   // Grey
            } else {
                if (hasRegistered) cell.classList.add("has-event-registered"); // Red
                else cell.classList.add("has-event-unregistered"); // Orange
            }

            dayEvents.slice(0, 2).forEach(evt => {
                const label = document.createElement("div");
                label.className = "cal-event-label";
                label.innerText = evt.title;
                cell.appendChild(label);
            });
            
            // Interaction: Could open a modal or navigate to event detail
            cell.onclick = () => {
                // Optional: Logic to show day details
            };
        }

        grid.appendChild(cell);
    }
}

function changeMonth(step) {
    currentMonth += step;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar(currentMonth, currentYear);
}