// js/admin-schedule.js

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let globalEvents = []; 

document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!user || user.role !== 'admin') {
        window.location.href = "home.html";
        return;
    }

    loadScheduleData();
    
    document.getElementById("prevMonthBtn").onclick = () => changeMonth(-1);
    document.getElementById("nextMonthBtn").onclick = () => changeMonth(1);
});

async function loadScheduleData() {
    try {
        const res = await fetch('/getEvents');
        if (!res.ok) throw new Error("Failed to fetch events");
        
        const allEvents = await res.json();

        globalEvents = allEvents.map(e => ({
            id: e.id,
            title: e.name, 
            date: new Date(e.date), 
            time: e.time || "TBD"
        }));

        renderCalendar(currentMonth, currentYear);

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

    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement("div");
        cell.className = "cal-day-cell is-padding";
        grid.appendChild(cell);
    }

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

        const dayEvents = globalEvents.filter(e => e.date.toDateString() === cellDate.toDateString());

        if (cellDate.getTime() === today.getTime()) {
            cell.classList.add("is-today");
        }

        if (dayEvents.length > 0) {
            const isPast = cellDate < today;

            if (isPast) cell.classList.add("has-event-attended"); // Teal for Past
            else cell.classList.add("has-event-registered"); // Red for Upcoming

            dayEvents.slice(0, 2).forEach(evt => {
                const label = document.createElement("div");
                label.className = "cal-event-label";
                label.innerText = evt.title;
                cell.appendChild(label);
            });
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