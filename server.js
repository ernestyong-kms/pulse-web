// server.js

const Sentiment = require('sentiment');
const sentiment = new Sentiment();
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const { v4: uuidv4 } = require("uuid"); 
const multer = require("multer"); 
const path = require("path");
const fs = require("fs");

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const PORT = 3000;

// --- MYSQL CONNECTION POOL ---
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Nonosquare69420",
  database: process.env.DB_NAME || "mp",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  supportBigNumbers: true,
  bigNumberStrings: true
});

// --- MULTER SETUP ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/'); 
    },
    filename: (req, file, cb) => {
        const prefix = file.fieldname === 'eventPhoto' ? 'event_' : 'user_';
        cb(null, prefix + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });


// ==========================================
//                AUTH & USERS
// ==========================================

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE username = ? AND password = ?",
      [username, password]
    );
    if (rows.length > 0) return res.json({ success: true, user: rows[0] });
    else return res.json({ success: false, message: "Invalid username or password." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Database error." });
  }
});

app.post("/createUser", async (req, res) => {
  const { username, password, fullname, email, phone_number, adminCode } = req.body;
  
  if (!username || !password || !fullname || !email)
    return res.json({ success: false, message: "Please fill all required fields." });

  let role = "attendee";
  if (adminCode === "BANANASHAKIRA") {
    role = "admin";
  }

  try {
    const [result] = await pool.execute(
      "INSERT INTO users (username, password, fullname, email, phone_number, role) VALUES (?, ?, ?, ?, ?, ?)",
      [username, password, fullname, email, phone_number || null, role]
    );
    res.json({ success: true, message: "User created successfully!", userid: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create user. Username may already exist." });
  }
});


// ==========================================
//      🔥 PROFILE API
// ==========================================

app.get('/api/user/profile', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Username required" });

    try {
        const [users] = await pool.execute(`
            SELECT u.userid, u.fullname as name, u.email, u.phone_number, u.linkedin_url, 
                   COALESCE(mo.name, u.company) as company, 
                   u.position, 
                   u.qualifications,  
                   CASE WHEN LENGTH(u.photo_url) > 2000 THEN NULL ELSE u.photo_url END as profile_pic,
                   u.skills, u.special_interests 
            FROM users u 
            LEFT JOIN master_organizations mo ON u.organization_id = mo.id
            WHERE u.username = ?`, [username]);
            
        if (users.length === 0) return res.status(404).json({ error: "User not found" });
        const user = users[0];

        if (!user.skills) {
            const [skillRows] = await pool.execute(`SELECT ms.name FROM master_skills ms JOIN user_skills us ON ms.id = us.skill_id WHERE us.user_id = ?`, [user.userid]);
            user.skills = skillRows.map(r => r.name).join(', ');
        }
        
        if (!user.special_interests) {
            const [interestRows] = await pool.execute(`SELECT mi.name FROM master_interests mi JOIN user_interests ui ON mi.id = ui.interest_id WHERE ui.user_id = ?`, [user.userid]);
            user.special_interests = interestRows.map(r => r.name).join(', ');
        }

        res.json(user);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/api/user/update-profile', upload.single('profile_pic'), async (req, res) => {
    const username = req.body.username;
    const name = req.body.name || req.body.fullname;
    const email = req.body.email;
    const phone = req.body.phone_number || req.body.phone;
    const linkedin = req.body.linkedin_url || req.body.linkedin;
    const company = req.body.company;
    const position = req.body.position;
    const qualifications = req.body.qualifications;
    const skills = req.body.skills;
    const interests = req.body.special_interests || req.body.specialInterests;

    if (!username) return res.status(401).json({ error: "Username missing" });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [uRows] = await connection.execute("SELECT userid FROM users WHERE username = ?", [username]);
        if (uRows.length === 0) throw new Error("User not found");
        const userId = uRows[0].userid;

        let orgId = null;
        if (company && company.trim() !== "") {
            orgId = await findOrCreateOrganization(connection, company.trim());
        }

        const clean = (val) => (val === undefined || val === "") ? null : val;
        let photoSql = "";
        let params = [
            clean(name), clean(email), clean(phone), clean(linkedin), 
            orgId, clean(company), clean(position), clean(qualifications), 
            clean(skills), clean(interests), 
            username
        ];

        if (req.file) {
            photoSql = ", photo_url=?";
            params.splice(10, 0, '/uploads/' + req.file.filename); 
        }

        await connection.execute(`
            UPDATE users SET 
            fullname=?, email=?, phone_number=?, linkedin_url=?, 
            organization_id=?, company=?, position=?, qualifications=?, 
            skills=?, special_interests=? ${photoSql}
            WHERE username=?`, params);

        await updateTags(connection, userId, skills, 'master_skills', 'user_skills', 'skill_id');
        await updateTags(connection, userId, interests, 'master_interests', 'user_interests', 'interest_id');

        await connection.commit();
        res.json({ success: true, message: "Profile updated successfully!" });

    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: "Update failed: " + err.message });
    } finally {
        connection.release();
    }
});

async function updateTags(connection, userId, tagString, masterTable, junctionTable, fkCol) {
    await connection.execute(`DELETE FROM ${junctionTable} WHERE user_id = ?`, [userId]);
    if (!tagString || !tagString.trim()) return;
    const tags = tagString.split(',').map(t => t.trim()).filter(t => t.length > 0);
    for (const tag of tags) {
        const [rows] = await connection.execute(`SELECT id FROM ${masterTable} WHERE name = ?`, [tag]);
        let tagId;
        if (rows.length > 0) {
            tagId = rows[0].id;
        } else {
            const [res] = await connection.execute(`INSERT INTO ${masterTable} (name) VALUES (?)`, [tag]);
            tagId = res.insertId;
        }
        await connection.execute(`INSERT IGNORE INTO ${junctionTable} (user_id, ${fkCol}) VALUES (?, ?)`, [userId, tagId]);
    }
}

async function findOrCreateOrganization(connection, orgName) {
    if (!orgName) return null;
    const [rows] = await connection.execute("SELECT id FROM master_organizations WHERE name = ?", [orgName]);
    if (rows.length > 0) return rows[0].id;
    const [res] = await connection.execute("INSERT INTO master_organizations (name, type) VALUES (?, 'Other')", [orgName]);
    return res.insertId;
}


// ==========================================
//                EVENTS
// ==========================================

app.get("/getEvents", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM events");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Database error." });
  }
});

app.post("/createEvent", upload.single('eventPhoto'), async (req, res) => {
  const { name, date, time, end_time, location, description, category } = req.body;
  if (!name || !date || !location || !description)
    return res.json({ success: false, message: "Please fill all required fields." });

  const id = Date.now();
  let photoUrl = "";
  if (req.file) { photoUrl = '/uploads/' + req.file.filename; }

  try {
    const formattedDate = date.split("T")[0];
    await pool.execute(
      "INSERT INTO events (id, name, date, time, end_time, location, description, category, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, name, formattedDate, time || 'Time TBD', end_time || '', location, description, category || 'General', photoUrl]
    );
    res.json({ success: true, message: "Event created successfully!", id });
  } catch (err) {
    console.error("MySQL error:", err);
    res.status(500).json({ success: false, message: "Failed to create event." });
  }
});

// [Add this after your /createEvent endpoint]

// 🔥 NEW: Update Event
app.post("/updateEvent", upload.single('eventPhoto'), async (req, res) => {
  const { id, name, date, time, end_time, location, description, category } = req.body;
  
  if (!id) return res.json({ success: false, message: "Event ID missing." });

  let photoSql = "";
  let params = [name, date, time, end_time, location, description, category];

  if (req.file) {
      photoSql = ", photo_url = ?";
      params.push('/uploads/' + req.file.filename);
  }
  
  params.push(id); // Add ID at the end for WHERE clause

  try {
    await pool.execute(
      `UPDATE events SET name=?, date=?, time=?, end_time=?, location=?, description=?, category=? ${photoSql} WHERE id=?`,
      params
    );
    res.json({ success: true, message: "Event updated!" });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ success: false, message: "Database error." });
  }
});

// 🔥 NEW: Kick/Remove Attendee
app.delete("/api/registration/:id", async (req, res) => {
    const { id } = req.params; // Registration ID
    try {
        await pool.execute("DELETE FROM qr_codes WHERE user_id = (SELECT userid FROM users WHERE username = (SELECT username FROM registrations WHERE id = ?)) AND event_id = (SELECT eventId FROM registrations WHERE id = ?)", [id, id]);
        await pool.execute("DELETE FROM registrations WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "DB Error" });
    }
});

app.delete("/deleteEvent/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute("DELETE FROM qr_codes WHERE event_id = ?", [id]);
    await pool.execute("DELETE FROM registrations WHERE eventId = ?", [id]);
    const [result] = await pool.execute("DELETE FROM events WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.json({ success: false, message: "Event not found." });
    res.json({ success: true, message: "Event deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Database error." });
  }
});

// ==========================================
//      REGISTRATIONS
// ==========================================

app.post("/registerEvent", async (req, res) => {
  const { eventId, username, role } = req.body;
  if (!eventId || !username) return res.json({ success: false, message: "Incomplete data." });

  const id = Date.now();
  const registeredAt = new Date();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    await connection.execute(
      `INSERT INTO registrations (id, eventId, username, role, registeredAt)
      VALUES (?, ?, ?, ?, ?)`,
      [id, eventId, username, role || "Attendee", registeredAt]
    );

    const qrToken = uuidv4();
    const [userRows] = await connection.execute("SELECT userid FROM users WHERE username = ?", [username]);
    if (userRows.length === 0) { await connection.rollback(); return res.json({ success: false, message: "User not found." }); }
    const userId = userRows[0].userid;

    const [existing] = await connection.execute("SELECT qr_id FROM qr_codes WHERE user_id = ? AND event_id = ?", [userId, eventId]);
    if (existing.length > 0) {
      await connection.execute("UPDATE qr_codes SET qr_token = ?, created_at = NOW(), expires_at = NULL WHERE qr_id = ?", [qrToken, existing[0].qr_id]);
    } else {
      await connection.execute("INSERT INTO qr_codes (user_id, event_id, qr_token, created_at, expires_at) VALUES (?, ?, ?, NOW(), NULL)", [userId, eventId, qrToken]);
    }
    
    await connection.commit();
    res.json({ success: true, message: "Registration successful.", qrToken });
  } catch (err) {
    await connection.rollback();
    console.error("MySQL error:", err);
    res.status(500).json({ success: false, message: "Failed to register." });
  } finally {
    connection.release();
  }
});

app.get("/getAttendees/:eventId", async (req, res) => {
  const { eventId } = req.params;
  try {
    const [rows] = await pool.execute(`
        SELECT r.*, u.fullname as name, 
        CASE WHEN LENGTH(u.photo_url) > 2000 THEN NULL ELSE u.photo_url END as photo,
        u.position, u.company 
        FROM registrations r 
        JOIN users u ON r.username = u.username 
        WHERE r.eventId = ?`, [eventId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Database error." });
  }
});

app.get("/getUserRegistrations/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const [rows] = await pool.execute("SELECT eventId FROM registrations WHERE username = ?", [username]);
    const ids = rows.map(r => r.eventId);
    res.json(ids);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

app.get("/getRegistration/:username/:eventId", async (req, res) => {
  const { username, eventId } = req.params;
  try {
    const [rows] = await pool.execute(`
        SELECT r.*, u.fullname as name, u.photo_url as photo, u.position, u.company, u.email, u.phone_number 
        FROM registrations r 
        JOIN users u ON r.username = u.username 
        WHERE r.username = ? AND r.eventId = ?`, 
        [username, eventId]);
        
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const registration = rows[0];
    
    const [uRows] = await pool.execute("SELECT userid FROM users WHERE username = ?", [username]);
    if (uRows.length > 0) {
        const userId = uRows[0].userid;
        const [qrRows] = await pool.execute("SELECT qr_token FROM qr_codes WHERE user_id = ? AND event_id = ?", [userId, eventId]);
        if (qrRows.length > 0) { registration.qrToken = qrRows[0].qr_token; }
    }
    res.json(registration);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Database error." });
  }
});

app.get("/qr/resolve/:token", async (req, res) => {
  const { token } = req.params;
  try {
    const [rows] = await pool.execute(
      `SELECT u.username, q.event_id FROM qr_codes q JOIN users u ON u.userid = q.user_id WHERE q.qr_token = ? AND (q.expires_at IS NULL OR q.expires_at > NOW()) LIMIT 1`,
      [token]
    );
    if (rows.length === 0) return res.json({ success: false, message: "Invalid or expired QR token." });
    res.json({ success: true, username: rows[0].username, eventId: rows[0].event_id });
  } catch (err) {
    console.error("MySQL error:", err);
    res.status(500).json({ success: false, message: "Database error." });
  }
});


// ==========================================
//      CONNECTIONS (SMART RE-SCANNING LOGIC)
// ==========================================
app.post("/connections", async (req, res) => {
  const { scanner_username, scanned_username, event_id, note } = req.body;
  
  if (!scanner_username || !scanned_username || !event_id) {
    return res.json({ success: false, message: "Missing data." });
  }

  const eid = parseInt(event_id); 

  try {
      // 1. SECURITY: Check if Event is Open & Users are Registered
      const [scannerReg] = await pool.execute("SELECT id FROM registrations WHERE username = ? AND eventId = ?", [scanner_username, eid]);
      if (scannerReg.length === 0) return res.status(403).json({ success: false, message: "You are not registered for this event." });

      const [evt] = await pool.execute("SELECT date FROM events WHERE id = ?", [eid]);
      if (evt.length > 0) {
          const eventDate = new Date(evt[0].date);
          const now = new Date();
          const diffHours = Math.ceil(Math.abs(now - eventDate) / (1000 * 60 * 60)); 
          if (diffHours > 72) return res.json({ success: false, message: "This event has ended." });
      }
  } catch (err) {
      console.error("Security Check Error:", err);
      return res.status(500).json({ success: false, message: "Verification failed." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 2. CHECK FOR EXISTING CONNECTION *AT THIS EVENT* (Scenario 1 & 3)
    const [sameEventDup] = await connection.execute(
        `SELECT id FROM connections 
         WHERE ((scanner_username = ? AND scanned_username = ?) OR (scanner_username = ? AND scanned_username = ?))
         AND event_id = ? LIMIT 1`, 
        [scanner_username, scanned_username, scanned_username, scanner_username, eid]
    );

    // Helper: Get Profile for Popup
    const [profileRows] = await connection.execute(`
        SELECT u.fullname as name, u.position, COALESCE(mo.name, u.company) as company, u.photo_url as photo, u.email, u.linkedin_url as linkedin
        FROM users u LEFT JOIN master_organizations mo ON u.organization_id = mo.id WHERE u.username = ?
    `, [scanned_username]);
    const scannedProfile = profileRows[0] || null;

    // --- CASE: DUPLICATE AT SAME EVENT ---
    if (sameEventDup.length > 0) {
        await connection.rollback();
        // Return success: true so the popup shows the profile, but with a different message
        return res.json({ 
            success: true, 
            message: "Already connected at this event.", 
            user: scannedProfile,
            isDuplicate: true 
        });
    }

    // 3. CHECK FOR PAST CONNECTIONS (Scenario 2)
    const [pastHistory] = await connection.execute(
        `SELECT COUNT(*) as count FROM connections 
         WHERE (scanner_username = ? AND scanned_username = ?) OR (scanner_username = ? AND scanned_username = ?)`,
        [scanner_username, scanned_username, scanned_username, scanner_username]
    );
    
    const encounterCount = pastHistory[0].count; // 0 = New, >0 = Reconnection

    // 4. CREATE NEW CONNECTION (Event-Scoped)
    await connection.execute(
        "INSERT INTO connections (scanner_username, scanned_username, event_id, scanner_note, scanned_note) VALUES (?, ?, ?, ?, ?)", 
        [scanner_username, scanned_username, eid, note || "", ""]
    );
    
    // 5. AWARD POINTS
    // Bonus: If it's a reconnection, maybe give fewer points? For now, we give full points to encourage streaks.
    await connection.execute("UPDATE users SET networking_points = COALESCE(networking_points, 0) + 10 WHERE username = ?", [scanner_username]);
    await connection.execute("UPDATE users SET networking_points = COALESCE(networking_points, 0) + 5 WHERE username = ?", [scanned_username]);

    // 6. AUTO-MESSAGE (Context Aware)
    const [eventRows] = await connection.execute("SELECT name FROM events WHERE id = ?", [eid]);
    const eventName = eventRows.length > 0 ? eventRows[0].name : "an event";
    
    let autoMsg = "";
    let successMsg = "";

    if (encounterCount > 0) {
        // Reconnection Logic
        autoMsg = `👋 Great to see you again at ${eventName}! (Interaction #${encounterCount + 1})`;
        successMsg = `Strengthened Connection! 🤝 (+10 pts)`; // Scenario 2 Message
    } else {
        // First Time Logic
        autoMsg = `👋 Connected at ${eventName}`;
        successMsg = `Connection Saved! 🎉 (+10 pts)`;
    }
    
    await connection.execute(
        "INSERT INTO messages (sender_username, receiver_username, message_text, timestamp) VALUES (?, ?, ?, NOW())", 
        [scanned_username, scanner_username, autoMsg]
    );

    await connection.commit();
    res.json({ success: true, message: successMsg, user: scannedProfile });

  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: "Database error" });
  } finally {
    connection.release();
  }
});

app.get("/connections", async (req, res) => {
    const { scanner_username } = req.query; // This is the person logged in
    if (!scanner_username) return res.json([]);

    try {
        const sql = `
            SELECT 
                c.id, c.scanner_username, c.scanned_username, c.event_id, c.created_at,
                e.name AS event_name,
                -- Logic: Only pull the note written by the person asking
                CASE 
                    WHEN c.scanner_username = ? THEN c.scanner_note 
                    WHEN c.scanned_username = ? THEN c.scanned_note 
                    ELSE '' 
                END as note,
                u.fullname as name,
                COALESCE(mo.name, u.company) as company,
                u.position,
                CASE WHEN LENGTH(u.photo_url) > 2000 THEN NULL ELSE u.photo_url END as photo,
                u.email,
                u.phone_number as number,
                u.linkedin_url as linkedin,
                u.skills,
                u.special_interests as specialInterests,
                COALESCE(r.role, 'Attendee') as role
            FROM connections c
            LEFT JOIN events e ON e.id = c.event_id
            LEFT JOIN users u ON u.username = (CASE WHEN c.scanner_username = ? THEN c.scanned_username ELSE c.scanner_username END)
            LEFT JOIN master_organizations mo ON u.organization_id = mo.id
            LEFT JOIN registrations r ON r.username = u.username AND r.eventId = c.event_id
            WHERE c.scanner_username = ? OR c.scanned_username = ?
            ORDER BY c.id DESC`;

        const [rows] = await pool.execute(sql, [scanner_username, scanner_username, scanner_username, scanner_username, scanner_username]);

        // Deduplication logic to ensure only one card per person
        const connectionsMap = new Map();
        for (const row of rows) {
            const otherPerson = row.scanner_username === scanner_username ? row.scanned_username : row.scanner_username;
            if (!connectionsMap.has(otherPerson)) {
                connectionsMap.set(otherPerson, row);
            }
        }
        res.json(Array.from(connectionsMap.values()));
    } catch (err) {
        console.error("Connections Fetch Error:", err);
        res.status(500).json({ error: "Database error" });
    }
});

app.put("/connections/updateNote", async (req, res) => {
  const { scanner_username, scanned_username, note } = req.body;
  // Note: scanner_username here is the person currently writing the note
  try {
    // 1. Find the shared connection row
    const [rows] = await pool.execute(
      "SELECT id, scanner_username FROM connections WHERE (scanner_username = ? AND scanned_username = ?) OR (scanner_username = ? AND scanned_username = ?) LIMIT 1",
      [scanner_username, scanned_username, scanned_username, scanner_username]
    );

    if (rows.length > 0) {
      const conn = rows[0];
      // 2. Identify if the writer is the original scanner or the recipient
      const columnToUpdate = (scanner_username === conn.scanner_username) ? "scanner_note" : "scanned_note";
      
      await pool.execute(`UPDATE connections SET ${columnToUpdate} = ? WHERE id = ?`, [note, conn.id]);
      res.json({ success: true, message: "Private note updated!" });
    } else {
      res.status(404).json({ success: false, message: "Connection not found." });
    }
  } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Database error." });
  }
});

app.delete("/clearConnections", async (req, res) => {
  const { scanner_username } = req.query; 
  if (!scanner_username) return res.json({ success: false, message: "Missing username" });
  try {
    await pool.execute("DELETE FROM connections WHERE scanner_username = ? OR scanned_username = ?", [scanner_username, scanner_username]);
    res.json({ success: true, message: "Network cleared." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Database error." });
  }
});

// ==========================================
//      ADMIN ANALYTICS: SMART KPIs
// ==========================================
app.get('/api/admin/stats', async (req, res) => {
    try {
        // 1. Helper function to calculate growth (Current 30 Days vs Previous 30 Days)
        async function getGrowthStats(table) {
            const [rows] = await pool.execute(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL 30 DAY THEN 1 END) as recent,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL 60 DAY AND created_at < NOW() - INTERVAL 30 DAY THEN 1 END) as previous
                FROM ${table}
            `);
            
            const { total, recent, previous } = rows[0];
            
            // Calculate Percentage Change
            let percentChange = 0;
            if (previous > 0) {
                percentChange = ((recent - previous) / previous) * 100;
            } else if (recent > 0) {
                percentChange = 100; // 100% growth if previous was 0
            }

            return { count: total, pct: Math.round(percentChange) };
        }

        // 2. Fetch Data
        const usersStats = await getGrowthStats('users');
        const connectionsStats = await getGrowthStats('connections');
        
        // 3. Events (Total Only for now)
        const [eventRows] = await pool.execute("SELECT COUNT(*) AS count FROM events");
        
        // 4. Send the new structure
        res.json({
            users: usersStats,             // { count: 142, pct: 12 }
            connections: connectionsStats, // { count: 890, pct: 8 }
            eventsCount: eventRows[0].count
        });

    } catch (err) {
        console.error("Smart Stats Error:", err);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

app.get('/api/admin/activity', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT u.fullname as name, u.photo_url as photo, r.registeredAt, e.name as eventName 
            FROM registrations r 
            JOIN events e ON r.eventId = e.id 
            JOIN users u ON r.username = u.username
            ORDER BY r.registeredAt DESC LIMIT 5`);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// server.js - /api/admin/event-stats
app.get('/api/admin/event-stats', async (req, res) => {
    try {
        const { days, limit } = req.query;
        const params = [];

        // 1. Base Query
        let sql = `
            SELECT 
                e.id, 
                e.name, 
                e.date,
                (SELECT COUNT(*) FROM registrations r WHERE r.eventId = e.id) as registration_count,
                (SELECT COUNT(*) FROM event_checkins ec WHERE ec.event_id = e.id) as attendee_count,
                (SELECT COALESCE(AVG(rating), 0) FROM event_feedback ef WHERE ef.event_id = e.id) as avg_rating
            FROM events e 
        `;

        // 2. Date Filter (Optional)
        if (days && days !== '0') {
            sql += ` WHERE e.date >= NOW() - INTERVAL ? DAY `;
            params.push(parseInt(days));
        }

        // 3. 🔥 THE FIX: Hide Empty Events & Sort by Date
        // HAVING: Only show events that have at least 1 registration OR 1 check-in.
        sql += ` HAVING registration_count > 0 OR attendee_count > 0 `;
        
        // ORDER BY: Prioritize Event Date (so Design Cup shows up), then ID.
        sql += ` ORDER BY e.date DESC, e.id DESC `; 

        // 4. Limit
        if (limit) {
            const limitVal = parseInt(limit);
            if (!isNaN(limitVal)) {
                sql += ` LIMIT ${limitVal} `;
            }
        }

        // Execute Query
        const [events] = await pool.execute(sql, params);

        // 5. AI Vibe Check (Keep this exactly as is)
        for (let event of events) {
            if (!event.id) continue;
            const [feedback] = await pool.execute(`
                SELECT comment as text FROM event_feedback WHERE event_id = ?
                UNION ALL
                SELECT scanner_note as text FROM connections WHERE event_id = ?
            `, [event.id, event.id]);

            let totalScore = 0; let count = 0;
            feedback.forEach(row => {
                if (row.text && row.text.trim().length > 2) {
                    const result = sentiment.analyze(row.text);
                    totalScore += result.score;
                    count++;
                }
            });
            const avgScore = count > 0 ? (totalScore / count) : 0;
            
            if (avgScore >= 2) event.vibe = "Electric";
            else if (avgScore >= 0.5) event.vibe = "Positive";
            else if (avgScore >= -0.5) event.vibe = "Neutral";
            else event.vibe = "Cold";
            
            event.vibeScore = avgScore.toFixed(1);
        }

        res.json(events);

    } catch (err) {
        console.error("Event Stats API Error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

app.post("/unregisterEvent", async (req, res) => {
  const { eventId, username } = req.body;
  if (!eventId || !username) return res.json({ success: false, message: "Missing data." });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [userRows] = await connection.execute("SELECT userid FROM users WHERE username = ?", [username]);
    if (userRows.length > 0) {
        const userId = userRows[0].userid;
        await connection.execute("DELETE FROM qr_codes WHERE user_id = ? AND event_id = ?", [userId, eventId]);
    }
    const [result] = await connection.execute("DELETE FROM registrations WHERE username = ? AND eventId = ?", [username, eventId]);
    await connection.commit();
    if (result.affectedRows > 0) res.json({ success: true, message: "Unregistered successfully." });
    else res.json({ success: false, message: "Registration not found." });
  } catch (err) {
    await connection.rollback();
    console.error("Unregister error:", err);
    res.status(500).json({ success: false, message: "Database error." });
  } finally {
    connection.release();
  }
});

app.post("/sendMessage", async (req, res) => {
  const { sender, receiver, text } = req.body;
  if (!sender || !receiver || !text) return res.json({ success: false });
  try {
    await pool.execute("INSERT INTO messages (sender_username, receiver_username, message_text) VALUES (?, ?, ?)", [sender, receiver, text]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.get("/getMessages", async (req, res) => {
  const { user1, user2 } = req.query;
  try {
    const [rows] = await pool.execute(`SELECT * FROM messages WHERE (sender_username = ? AND receiver_username = ?) OR (sender_username = ? AND receiver_username = ?) ORDER BY timestamp ASC`, [user1, user2, user2, user1]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ==========================================
//      INBOX: CONNECTIONS + UNREAD COUNT
// ==========================================
app.get("/api/conversations", async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json([]);

    try {
        // 1. Get all connections
        const [connections] = await pool.execute(
            "SELECT scanner_username, scanned_username FROM connections WHERE scanner_username = ? OR scanned_username = ?",
            [username, username]
        );

        const contactUsernames = new Set();
        connections.forEach(c => {
            const other = (c.scanner_username === username) ? c.scanned_username : c.scanner_username;
            contactUsernames.add(other);
        });

        const inboxList = [];

        // 2. Build List with Unread Counts
        for (const contact of contactUsernames) {
            const [users] = await pool.execute(
                "SELECT username, fullname as name, photo_url as photo FROM users WHERE username = ?", 
                [contact]
            );
            if (users.length === 0) continue;
            const userProfile = users[0];

            // Get Latest Message
            const [msgs] = await pool.execute(`
                SELECT message_text, timestamp 
                FROM messages 
                WHERE (sender_username = ? AND receiver_username = ?) 
                   OR (sender_username = ? AND receiver_username = ?) 
                ORDER BY timestamp DESC LIMIT 1`,
                [username, contact, contact, username]
            );

            // 🔥 COUNT UNREAD MESSAGES (Where I am the receiver AND is_read is 0)
            const [unread] = await pool.execute(`
                SELECT COUNT(*) as count 
                FROM messages 
                WHERE sender_username = ? AND receiver_username = ? AND is_read = 0`,
                [contact, username]
            );

            const lastMsg = msgs.length > 0 ? msgs[0] : null;
            
            inboxList.push({
                username: userProfile.username,
                name: userProfile.name,
                photo: userProfile.photo,
                lastMessage: lastMsg ? lastMsg.message_text : "Start a conversation 👋",
                timestamp: lastMsg ? lastMsg.timestamp : "1970-01-01T00:00:00Z",
                unreadCount: unread[0].count // <--- NEW FIELD
            });
        }

        // Sort: Unread first, then newest
        inboxList.sort((a, b) => {
            if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        res.json(inboxList);

    } catch (err) {
        console.error("Inbox Error:", err);
        res.json([]);
    }
});

app.get('/api/organizations/search', async (req, res) => {
    const { q } = req.query;
    const searchTerm = q ? `%${q}%` : '%'; 
    try {
        const [rows] = await pool.execute("SELECT name FROM master_organizations WHERE name LIKE ? ORDER BY name ASC LIMIT 50", [searchTerm]);
        res.json(rows.map(r => r.name));
    } catch (err) {
        console.error(err);
        res.json([]);
    }
});

app.post('/api/checkin', async (req, res) => {
    const { username, event_id } = req.body;
    try {
        await pool.execute("INSERT IGNORE INTO event_checkins (username, event_id) VALUES (?, ?)", [username, event_id]);
        res.json({ success: true, message: "Checked in successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get('/api/checkin/status/:username/:eventId', async (req, res) => {
    const { username, eventId } = req.params;
    try {
        const [rows] = await pool.execute("SELECT * FROM event_checkins WHERE username = ? AND event_id = ?", [username, eventId]);
        res.json({ checkedIn: rows.length > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/api/feedback', async (req, res) => {
    const { event_id, username, rating, comment } = req.body;
    if (!event_id || !username || !rating) return res.status(400).json({ success: false, message: "Missing fields" });
    try {
        await pool.execute("INSERT INTO event_feedback (event_id, username, rating, comment) VALUES (?, ?, ?, ?)", [event_id, username, rating, comment]);
        res.json({ success: true, message: "Feedback submitted!" });
    } catch (err) {
        console.error("Feedback Error:", err);
        res.status(500).json({ success: false, message: "Database error" });
    }
});

app.get('/api/feedback/status/:username/:eventId', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM event_feedback WHERE username = ? AND event_id = ?", [req.params.username, req.params.eventId]);
        res.json({ submitted: rows.length > 0 });
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
});

app.delete("/connection", async (req, res) => {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) return res.json({ success: false, message: "Missing data" });
    try {
        await pool.execute(
            "DELETE FROM connections WHERE (scanner_username = ? AND scanned_username = ?) OR (scanner_username = ? AND scanned_username = ?)",
            [user1, user2, user2, user1]
        );
        res.json({ success: true, message: "Connection removed." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "DB Error" });
    }
});

// ==========================================
//           ANALYTICS DASHBOARD API
// ==========================================

// 1. Data for Sankey Diagram
app.get('/api/analytics/flow', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM view_sankey_flow");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "DB Error" });
    }
});

// 2. Data for Network Graph
app.get('/api/analytics/network', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM view_network_graph");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "DB Error" });
    }
});

// 3. Top Skills
app.get('/api/analytics/skills', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT ms.name, COUNT(us.user_id) as count 
            FROM master_skills ms
            JOIN user_skills us ON ms.id = us.skill_id
            GROUP BY ms.name
            ORDER BY count DESC
            LIMIT 10
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "DB Error" });
    }
});

// ==========================================
//      🆕 USER ANALYTICS
// ==========================================

// ==========================================
//      DEBUGGED RADAR ANALYTICS API
// ==========================================
app.get('/api/stats/radar/:username', async (req, res) => {
    const { username } = req.params;
    try {
        console.log(`\n--- 🔍 DEBUG RADAR FOR: ${username} ---`);

        // 1. Get ALL Categories (Cleaned)
        const [cats] = await pool.execute("SELECT DISTINCT category FROM events WHERE category IS NOT NULL AND category != ''");
        // Normalize categories: Trim whitespace
        const categories = cats.map(c => c.category.trim());
        console.log("👉 Categories found in DB:", categories);

        // 2. Get User's Counts (Cleaned)
        // We trim the category from the DB to ensure matching works
        const [userStats] = await pool.execute(`
            SELECT TRIM(e.category) as category, COUNT(*) as count 
            FROM registrations r 
            JOIN events e ON r.eventId = e.id 
            WHERE r.username = ? AND e.category IS NOT NULL AND e.category != ''
            GROUP BY TRIM(e.category)`, [username]);
        
        console.log("👉 User Stats Raw:", userStats);

        // 3. Get Global Averages (Cleaned)
        const [globalStats] = await pool.execute(`
            SELECT TRIM(e.category) as category, COUNT(r.id) / (SELECT COUNT(*) FROM users) as avg_count
            FROM registrations r 
            JOIN events e ON r.eventId = e.id 
            WHERE e.category IS NOT NULL AND e.category != ''
            GROUP BY TRIM(e.category)`);

        // 4. Map Data (Case-Insensitive Matching)
        const userMap = {}; 
        userStats.forEach(r => userMap[r.category.toLowerCase()] = parseInt(r.count)); // 🔥 FORCE INTEGER

        const globalMap = {}; 
        globalStats.forEach(r => globalMap[r.category.toLowerCase()] = parseFloat(r.avg_count));

        // Build final arrays using the Master Category List
        const userValues = categories.map(c => userMap[c.toLowerCase()] || 0);
        const globalValues = categories.map(c => globalMap[c.toLowerCase()] || 0);

        console.log("✅ Final User Values sent to Chart:", userValues);
        
        if (userValues.every(v => v === 0)) {
            console.warn("⚠️ WARNING: User values are all 0. The outer ring will be invisible.");
        }

        res.json({ categories, userValues, globalValues });

    } catch (err) {
        console.error("Radar Stats Error:", err);
        res.status(500).json({ error: "DB Error" });
    }
});

app.get('/api/stats/timeline/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [rows] = await pool.execute(`
            SELECT e.name, e.date, 'Registered' as status 
            FROM registrations r 
            JOIN events e ON r.eventId = e.id 
            WHERE r.username = ? 
            ORDER BY e.date ASC`, [username]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "DB Error" });
    }
});

app.get('/api/stats/points/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [rows] = await pool.execute("SELECT networking_points FROM users WHERE username = ?", [username]);
        if (rows.length === 0) return res.json({ points: 0 });
        res.json({ points: rows[0].networking_points || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "DB Error" });
    }
});

// 🔥 UPDATED: SPLIT EVENTS into PAST vs UPCOMING
app.get('/api/stats/summary/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [uRows] = await pool.execute("SELECT networking_points FROM users WHERE username = ?", [username]);
        
        const [cRows] = await pool.execute(`
            SELECT COUNT(DISTINCT 
                CASE WHEN scanner_username = ? THEN scanned_username 
                     ELSE scanner_username 
                END) as count 
            FROM connections 
            WHERE scanner_username = ? OR scanned_username = ?`, 
            [username, username, username]
        );
        
        // 1. Count PAST events (Attended)
        const [attendedRows] = await pool.execute(`
            SELECT COUNT(*) as count 
            FROM registrations r 
            JOIN events e ON r.eventId = e.id 
            WHERE r.username = ? AND e.date < CURDATE()`, 
            [username]
        );

        // 2. Count FUTURE events (Upcoming)
        const [upcomingRows] = await pool.execute(`
            SELECT COUNT(*) as count 
            FROM registrations r 
            JOIN events e ON r.eventId = e.id 
            WHERE r.username = ? AND e.date >= CURDATE()`, 
            [username]
        );

        res.json({
            points: uRows[0]?.networking_points || 0,
            connections: cRows[0]?.count || 0,
            events_attended: attendedRows[0]?.count || 0,
            events_upcoming: upcomingRows[0]?.count || 0
        });
    } catch (err) { console.error(err); res.status(500).json({ error: "DB Error" }); }
});

app.get('/api/stats/growth/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [rows] = await pool.execute(`
            SELECT 
                DATE(earliest_interaction) as date, 
                COUNT(*) as daily_count 
            FROM (
                SELECT 
                    CASE 
                        WHEN scanner_username = ? THEN scanned_username 
                        ELSE scanner_username 
                    END as other_person,
                    MIN(created_at) as earliest_interaction
                FROM connections 
                WHERE scanner_username = ? OR scanned_username = ?
                GROUP BY other_person
            ) as unique_connections
            GROUP BY DATE(earliest_interaction) 
            ORDER BY date ASC`, 
            [username, username, username]
        );
        res.json(rows);
    } catch (err) { 
        console.error("Growth Chart Error:", err); 
        res.status(500).json({ error: "DB Error" }); 
    }
});

app.get('/api/stats/demographics/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [rows] = await pool.execute(`
            SELECT 
                COALESCE(u.position, 'Unknown') as role, 
                COUNT(*) as count
            FROM connections c
            JOIN users u ON u.username = (CASE WHEN c.scanner_username = ? THEN c.scanned_username ELSE c.scanner_username END)
            WHERE c.scanner_username = ? OR c.scanned_username = ?
            GROUP BY u.position
            LIMIT 6`, 
            [username, username, username]
        );
        res.json(rows);
    } catch (err) { 
        console.error("Demographics Error:", err); 
        res.status(500).json({ error: "DB Error" }); 
    }
});

app.get('/api/stats/rank/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [userRows] = await pool.execute(
            "SELECT networking_points FROM users WHERE username = ?", 
            [username]
        );
        if (userRows.length === 0) return res.json({ percentile: 0, rank: 0 });
        const myPoints = userRows[0].networking_points;

        const [rankRows] = await pool.execute(
            "SELECT COUNT(*) as count FROM users WHERE networking_points > ?", 
            [myPoints]
        );
        const rank = rankRows[0].count + 1; 

        const [totalRows] = await pool.execute("SELECT COUNT(*) as count FROM users");
        const totalUsers = totalRows[0].count;
        const percentile = totalUsers > 1 
            ? Math.round(((totalUsers - rank) / totalUsers) * 100) 
            : 100;

        res.json({ rank, percentile });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "DB Error" });
    }
});

app.get('/api/stats/productive-events/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [rows] = await pool.execute(`
            SELECT e.name, COUNT(*) as count
            FROM connections c
            JOIN events e ON c.event_id = e.id
            WHERE c.scanner_username = ? OR c.scanned_username = ?
            GROUP BY e.id, e.name
            ORDER BY count DESC
            LIMIT 5`, 
            [username, username]
        );
        res.json(rows);
    } catch (err) { 
        console.error("Productive Events Error:", err); 
        res.status(500).json({ error: "DB Error" }); 
    }
});

app.get('/api/stats/event-impact/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [rows] = await pool.execute(`
            SELECT 
                e.name, 
                e.date, 
                (SELECT COUNT(DISTINCT 
                    CASE WHEN c.scanner_username = ? THEN c.scanned_username 
                         ELSE c.scanner_username 
                    END)
                 FROM connections c 
                 WHERE c.event_id = e.id 
                 AND (c.scanner_username = ? OR c.scanned_username = ?)) 
                as my_connections,
                (SELECT COUNT(*) FROM registrations r 
                 WHERE r.eventId = e.id) 
                as total_attendees
            FROM events e
            WHERE e.id IN (
                SELECT event_id FROM connections 
                WHERE scanner_username = ? OR scanned_username = ?
            )
            ORDER BY e.date ASC`, 
            [username, username, username, username, username]
        );
        res.json(rows);
    } catch (err) { 
        console.error("Event Impact Error:", err); 
        res.status(500).json({ error: "DB Error" }); 
    }
});

app.get('/api/stats/roles/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [rows] = await pool.execute(`
            SELECT 
                CASE 
                    WHEN u.position LIKE '%Student%' OR u.position LIKE '%Intern%' THEN 'Student'
                    WHEN u.position LIKE '%Founder%' OR u.position LIKE '%CEO%' OR u.position LIKE '%Owner%' OR u.position LIKE '%Director%' THEN 'Founder / Exec'
                    WHEN u.position LIKE '%Engineer%' OR u.position LIKE '%Developer%' THEN 'Engineer / Dev'
                    WHEN u.position LIKE '%Manager%' OR u.position LIKE '%Lead%' THEN 'Manager'
                    WHEN u.position LIKE '%Designer%' OR u.position LIKE '%Creative%' THEN 'Creative'
                    ELSE COALESCE(u.position, 'Unknown')
                END as role_group, 
                COUNT(*) as count
            FROM connections c
            JOIN users u ON u.username = (
                CASE WHEN c.scanner_username = ? THEN c.scanned_username 
                     ELSE c.scanner_username 
                END
            )
            WHERE c.scanner_username = ? OR c.scanned_username = ?
            GROUP BY role_group
            ORDER BY count DESC
            LIMIT 5`, 
            [username, username, username]
        );
        res.json(rows);
    } catch (err) { 
        console.error("Roles Stats Error:", err); 
        res.status(500).json({ error: "DB Error" }); 
    }
});

app.get('/api/leaderboard', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    try {
        const [totalRows] = await pool.execute("SELECT COUNT(*) as count FROM users");
        const totalUsers = totalRows[0].count;

        const [rows] = await pool.execute(`
            SELECT 
                username, 
                fullname, 
                networking_points AS points, 
                photo_url 
            FROM users 
            ORDER BY networking_points DESC 
            LIMIT ${limit} OFFSET ${offset}` 
        );
        
        res.json({ users: rows, total: totalUsers });

    } catch (err) {
        console.error("Leaderboard Error:", err);
        res.status(500).json({ error: "DB Error" });
    }
});

app.get('/api/events/attended/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [rows] = await pool.execute(`
            SELECT e.name, e.date, e.location
            FROM registrations r
            JOIN events e ON r.eventId = e.id
            WHERE r.username = ?
            ORDER BY e.date DESC`, 
            [username]
        );
        res.json(rows);
    } catch (err) {
        console.error("Attended Events Error:", err);
        res.status(500).json({ error: "DB Error" });
    }
});

// ==========================================
//      🛠️ DEBUG: SYNC NETWORK TO MESSAGES
// ==========================================
app.get('/api/debug/sync-messages', async (req, res) => {
    try {
        // 1. Get ALL existing connections
        const [connections] = await pool.execute("SELECT scanner_username, scanned_username, event_id FROM connections");
        let count = 0;

        for (const conn of connections) {
            // 2. Check if a conversation ALREADY exists
            const [msgs] = await pool.execute(
                `SELECT id FROM messages 
                 WHERE (sender_username = ? AND receiver_username = ?) 
                    OR (sender_username = ? AND receiver_username = ?) 
                 LIMIT 1`,
                [conn.scanner_username, conn.scanned_username, conn.scanned_username, conn.scanner_username]
            );

            if (msgs.length === 0) {
                // 3. If missing, create the starter message
                // We make the 'scanned' person send the message to the 'scanner'
                
                // Get Event Name for context (Optional)
                const [events] = await pool.execute("SELECT name FROM events WHERE id = ?", [conn.event_id]);
                const eventName = events.length > 0 ? events[0].name : "Networking Event";

                const autoMsg = `👋 Connected at ${eventName}`;

                await pool.execute(
                    "INSERT INTO messages (sender_username, receiver_username, message_text, timestamp) VALUES (?, ?, ?, NOW())",
                    [conn.scanned_username, conn.scanner_username, autoMsg]
                );
                count++;
            }
        }

        res.json({ success: true, message: `Synced! Created ${count} new conversations from existing connections.` });

    } catch (err) {
        console.error("Sync Error:", err);
        res.status(500).json({ error: "Sync failed." });
    }
});

// ==========================================
//      MARK MESSAGES AS READ (DEBUGGED)
// ==========================================
app.post("/api/messages/markRead", async (req, res) => {
    const { me, other } = req.body;

    console.log(`\n👀 READ REQUEST: '${me}' is reading messages from '${other}'`);

    if (!me || !other) {
        console.error("❌ MISSING DATA: 'me' or 'other' is undefined.");
        return res.json({ success: false });
    }

    try {
        const [result] = await pool.execute(
            "UPDATE messages SET is_read = 1 WHERE sender_username = ? AND receiver_username = ?",
            [other, me] // Mark messages SENT by 'other' TO 'me'
        );

        console.log(`✅ Updated ${result.affectedRows} messages to READ.`);
        res.json({ success: true, updated: result.affectedRows });

    } catch (err) {
        console.error("❌ DB UPDATE ERROR:", err);
        res.status(500).json({ error: "DB Error" });
    }
});


// server.js (Update this existing endpoint)
app.get('/api/admin/users', async (req, res) => {
    try {
        // Updated query to include photo, skills, and interests
        const [rows] = await pool.execute(
            "SELECT userid, username, fullname, email, phone_number, role, company, position, networking_points, photo_url, skills, special_interests FROM users ORDER BY userid DESC"
        );
        res.json(rows);
    } catch (err) {
        console.error("Fetch Users Error:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// server.js - Updated Delete Logic

app.delete('/api/admin/user/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Get username first (needed for some tables that use username instead of ID)
        const [uRows] = await pool.execute("SELECT username FROM users WHERE userid = ?", [id]);
        if (uRows.length === 0) return res.json({ success: false, message: "User not found" });
        const username = uRows[0].username;

        // 2. Delete from tables using USERNAME (Feedback, Connections, Registrations)
        await pool.execute("DELETE FROM event_feedback WHERE username = ?", [username]);
        await pool.execute("DELETE FROM event_checkins WHERE username = ?", [username]);
        await pool.execute("DELETE FROM connections WHERE scanner_username = ? OR scanned_username = ?", [username, username]);
        await pool.execute("DELETE FROM registrations WHERE username = ?", [username]);

        // 3. Delete from tables using USER ID (QR Codes, Skills, Interests)
        await pool.execute("DELETE FROM qr_codes WHERE user_id = ?", [id]);
        // Note: user_skills and user_interests usually have ON DELETE CASCADE in SQL, 
        // but we can run this to be safe:
        await pool.execute("DELETE FROM user_skills WHERE user_id = ?", [id]);
        await pool.execute("DELETE FROM user_interests WHERE user_id = ?", [id]);

        // 4. FINALLY: Delete the User
        await pool.execute("DELETE FROM users WHERE userid = ?", [id]);
        
        res.json({ success: true, message: "User and all related data deleted." });
    } catch (err) {
        console.error("Delete User Error:", err);
        res.status(500).json({ success: false, message: "Database error: " + err.message });
    }
});

// ==========================================
//      🔥 FIXED: SMART ROLE MATRIX
// ==========================================

// REPLACES ALL PREVIOUS '/api/admin/roles' ENDPOINTS
app.get('/api/admin/roles', async (req, res) => {
    const { eventId } = req.query;
    try {
        let sql, params;

        if (eventId && eventId !== "undefined" && eventId !== "") {
            // 🔥 CASE 1: Filter by Event (Active Attendees)
            sql = `
                SELECT 
                    COALESCE(u.position, 'Unknown') as position, 
                    COUNT(*) as count 
                FROM registrations r
                JOIN users u ON r.username = u.username
                WHERE r.eventId = ?
                AND u.position IS NOT NULL AND u.position != ''
                GROUP BY position
                ORDER BY count DESC
            `;
            params = [eventId];
        } else {
            // 🔥 CASE 2: All Time (Total Userbase)
            sql = `
                SELECT 
                    COALESCE(position, 'Unknown') as position, 
                    COUNT(*) as count 
                FROM users 
                WHERE position IS NOT NULL AND position != ''
                GROUP BY position
                ORDER BY count DESC
            `;
            params = [];
        }

        const [rows] = await pool.execute(sql, params);
        res.json(rows);
    } catch (err) {
        console.error("Roles API Error:", err);
        res.status(500).json([]);
    }
});


// 3. ADMIN EVENT PERFORMANCE (Table Data)
// Note: This endpoint actually already exists as '/api/admin/event-stats' in your code!
// We just need to wire it up in the next step.
// ==========================================
//      ADMIN ANALYTICS (MISSING ENDPOINTS)
// ==========================================

// 1. GROWTH CHART: Group connections by date
app.get('/api/admin/growth', async (req, res) => {
    try {
        // Uses 'created_at' from your 'connections' table
        const [rows] = await pool.execute(`
            SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, COUNT(*) as count 
            FROM connections 
            GROUP BY date 
            ORDER BY date ASC LIMIT 30
        `);
        res.json(rows);
    } catch (err) {
        console.error("Growth API Error:", err);
        res.status(500).json([]);
    }
});

app.get('/api/admin/topics', async (req, res) => {
    try {
        // 1. Fetch non-empty notes from BOTH scanner and scanned columns
        const [rows] = await pool.execute(`
            SELECT scanner_note as note FROM connections WHERE scanner_note IS NOT NULL AND scanner_note != ''
            UNION ALL
            SELECT scanned_note as note FROM connections WHERE scanned_note IS NOT NULL AND scanned_note != ''
        `);
        
        // 2. Combine all text into one string and normalize to lowercase
        const text = rows.map(r => r.note).join(' ').toLowerCase();
        
        // 3. Define stopWords to filter out common/unhelpful language
        const stopWords = [
            'the', 'and', 'is', 'to', 'in', 'at', 'of', 'for', 'with', 'a', 'i', 
            'very', 'good', 'nice', 'was', 'this', 'that', 'via', 'scanned', 'from'
        ];
        
        // 4. Split by non-word characters and filter
        const words = text.split(/[\s,.]+/).filter(w => 
            w.length > 2 &&             // Ignore very short words
            !stopWords.includes(w) &&   // Ignore stopWords
            isNaN(w)                    // Ignore pure numbers
        );
        
        // 5. Calculate frequency
        const freq = {};
        words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

        // 6. Sort by most frequent and take the top 10
        const sorted = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([text, count]) => ({ text, count }));

        res.json(sorted);
    } catch (err) {
        console.error("Topics API Error (Dual-Note System):", err);
        res.status(500).json([]);
    }
});

// server.js

app.get('/api/admin/all-connections', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                c.created_at,
                c.scanner_note,
                c.scanned_note,
                c.scanner_username,
                u1.fullname as scanner_name,
                c.scanned_username,
                u2.fullname as scanned_name,
                e.name as event_name
            FROM connections c
            JOIN users u1 ON c.scanner_username = u1.username
            JOIN users u2 ON c.scanned_username = u2.username
            JOIN events e ON c.event_id = e.id
            ORDER BY c.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error("Fetch All Connections Error:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// server.js - Find the '/api/admin/density-history' endpoint and REPLACE it

app.get('/api/admin/density-history', async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    try {
        // 🔥 FIX: We match connections to events using the ID, ignoring Date differences
        const [rows] = await pool.execute(`
            SELECT 
                d.date,
                (SELECT COUNT(*) FROM connections c WHERE DATE(c.created_at) <= d.date) as L,
                (SELECT COUNT(*) FROM users u WHERE role != 'admin' AND DATE(u.created_at) <= d.date) as N,
                
                -- 🔥 LOOKUP BY ID (This fixes the "25 Jan" bug)
                (SELECT GROUP_CONCAT(DISTINCT e.name SEPARATOR ', ') 
                 FROM connections c2 JOIN events e ON c2.event_id = e.id 
                 WHERE DATE(c2.created_at) = d.date) as event_names,

                (SELECT GROUP_CONCAT(DISTINCT e.category SEPARATOR ', ') 
                 FROM connections c2 JOIN events e ON c2.event_id = e.id 
                 WHERE DATE(c2.created_at) = d.date) as categories

            FROM (
                SELECT DISTINCT DATE(created_at) as date 
                FROM connections
                WHERE created_at >= NOW() - INTERVAL ? DAY
                AND created_at <= NOW()
            ) as d
            ORDER BY d.date ASC
        `, [days]);

        const history = rows.map(row => {
            const possible = (row.N * (row.N - 1)) / 2;
            const density = possible > 0 ? (row.L / possible) * 100 : 0;
            return {
                date: row.date,
                density: parseFloat(density.toFixed(2)),
                // If the name is found, show it. Otherwise, fallback to "No Event"
                events: row.event_names || "No Event",
                category: row.categories || "N/A"
            };
        });
        res.json(history);
    } catch (err) { 
        console.error("Density History Error:", err);
        res.status(500).json([]); 
    }
});

// ==========================================
//      🔥 MISSING ENDPOINT FOR INSPECTOR
// ==========================================
app.get('/api/admin/event-feedback/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Fetch Official Feedback (Direct comments)
        const [feedbackRows] = await pool.execute(
            "SELECT comment as text, rating FROM event_feedback WHERE event_id = ?",
            [id]
        );

        // 2. Fetch Connection Notes (Hidden networking chatter)
        // We look at 'scanner_note' as it acts as a private thought bubble
        const [noteRows] = await pool.execute(
            "SELECT scanner_note as text FROM connections WHERE event_id = ? AND scanner_note IS NOT NULL AND scanner_note != ''",
            [id]
        );

        const comments = [];

        // 3. Process & Sentiment Analyze Official Feedback
        feedbackRows.forEach(row => {
            if (row.text && row.text.trim().length > 0) {
                const result = sentiment.analyze(row.text);
                comments.push({
                    text: row.text,
                    score: result.score,
                    source: `Feedback (Rated ${row.rating}/5)`
                });
            }
        });

        // 4. Process & Sentiment Analyze Networking Notes
        noteRows.forEach(row => {
            if (row.text && row.text.trim().length > 0) {
                const result = sentiment.analyze(row.text);
                comments.push({
                    text: row.text,
                    score: result.score,
                    source: 'Networking Note'
                });
            }
        });

        // 5. Send combined list
        res.json({ comments });

    } catch (err) {
        console.error("Feedback Inspector Error:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// 🔥 SMART MATCH: SKILLS & INTERESTS (FIXED)
app.get('/api/event/:eventId/smart-matches', async (req, res) => {
    const { eventId } = req.params;
    const { username } = req.query;

    try {
        // 1. Get MY profile
        // 🔴 FIX 1: Changed 'interests' to 'special_interests' here
        const [me] = await pool.execute(
            'SELECT skills, special_interests FROM users WHERE username = ?', 
            [username]
        );
        
        if (me.length === 0) return res.json([]);

        // Parse my tags (using special_interests)
        const mySkills = me[0].skills ? me[0].skills.split(',').map(s => s.trim().toLowerCase()) : [];
        const myInterests = me[0].special_interests ? me[0].special_interests.split(',').map(s => s.trim().toLowerCase()) : [];

        // 2. Get OTHER attendees
        // 🔴 FIX 2: Changed 'u.interests' to 'u.special_interests' here
        const [attendees] = await pool.execute(`
            SELECT u.username, u.fullname, u.position, u.company, u.photo_url, u.skills, u.special_interests
            FROM registrations r
            JOIN users u ON r.username = u.username
            WHERE r.eventId = ? AND r.username != ?`, 
            [eventId, username]
        );

        // 3. Calculate Score
        const scoredAttendees = attendees.map(p => {
            const theirSkills = p.skills ? p.skills.split(',').map(s => s.trim().toLowerCase()) : [];
            // 🔴 FIX 3: Read from 'p.special_interests'
            const theirInterests = p.special_interests ? p.special_interests.split(',').map(s => s.trim().toLowerCase()) : [];

            const commonSkills = mySkills.filter(s => theirSkills.includes(s));
            const commonInterests = myInterests.filter(i => theirInterests.includes(i));
            
            const score = (commonSkills.length * 10) + (commonInterests.length * 5);

            return { 
                ...p, 
                match_score: score,
                common_tags: [...commonSkills, ...commonInterests]
            };
        });

        // 4. Sort by highest score and take top 3
        const topMatches = scoredAttendees
            .filter(p => p.match_score > 0)
            .sort((a, b) => b.match_score - a.match_score)
            .slice(0, 3);

        res.json(topMatches);

    } catch (err) {
        console.error("Smart Match Error:", err);
        res.status(500).json({ error: "Database error" });
    }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));