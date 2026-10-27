const express = require('express');
const mysql = require('mysql');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());

// Offline JSON Backup Files (Used automatically if MySQL is not running on the lab PC)
const USERS_FILE = path.join(__dirname, 'users_backup.json');
const RECORDS_FILE = path.join(__dirname, 'data_backup.json');
let isMySQLConnected = true;

// =========================================================================
// 1. MYSQL CONNECTION & AUTO TABLE CREATION (users + records)
// =========================================================================
// [REMOVE BEFORE FINAL PRESENTATION]: Set password to "" (XAMPP default) or "root" based on your lab PC
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: ''
});

db.connect((err) => {
  if (err) {
    // [REMOVE BEFORE FINAL PRESENTATION]: Failsafe so Login/Signup works even if MySQL is broken
    console.log("MySQL not detected. Running in JSON File Database mode for both Auth & CRUD!");
    isMySQLConnected = false;
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
    if (!fs.existsSync(RECORDS_FILE)) fs.writeFileSync(RECORDS_FILE, JSON.stringify([], null, 2));
    return;
  }

  console.log("Connected to MySQL Server!");

  db.query("CREATE DATABASE IF NOT EXISTS exam_db", (err) => {
    if (err) throw err;

    db.changeUser({ database: 'exam_db' }, (err) => {
      if (err) throw err;

      // Table 1: Users table for Signup & Login
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(100) NOT NULL,
          role VARCHAR(30) DEFAULT 'User'
        )`;
      db.query(createUsersTable, (err) => {
        if (err) throw err;
        console.log("MySQL Table 'users' ready!");
      });

      // Table 2: Records table for SPA CRUD operations
      const createRecordsTable = `
        CREATE TABLE IF NOT EXISTS records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL,
          category VARCHAR(50),
          details VARCHAR(255)
        )`;
      db.query(createRecordsTable, (err) => {
        if (err) throw err;
        console.log("MySQL Table 'records' ready!");
      });
    });
  });
});

// Helper functions for JSON file read/write
function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// =========================================================================
// 2. USER-DEFINED AUTHENTICATION FUNCTIONS (Signup & Login)
// =========================================================================

// User-Defined Function: Register a new user in MySQL
function registerUserInDB(user, callback) {
  const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";
  db.query(sql, [user.name, user.email, user.password, user.role], callback);
}

// User-Defined Function: Authenticate user email & password in MySQL
function authenticateUserInDB(email, password, callback) {
  const sql = "SELECT id, name, email, role FROM users WHERE email = ? AND password = ?";
  db.query(sql, [email, password], callback);
}

// =========================================================================
// 3. PAGE ROUTES (Serves auth.html and index.html)
// =========================================================================

// Visiting http://localhost:3000 opens the Login/Signup page first
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth.html'));
});

// Visiting http://localhost:3000/dashboard opens your main SPA website (index.html)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================================
// 4. AUTHENTICATION API ROUTES (/api/signup & /api/login)
// =========================================================================

// SIGNUP ROUTE: Creates a new user account
app.post('/api/signup', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required!" });
  }

  if (isMySQLConnected) {
    registerUserInDB({ name, email, password, role: role || 'User' }, (err, result) => {
      if (err) {
        // Handle duplicate email error in MySQL
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: "Email already exists! Please login." });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: "Signup successful!", userId: result.insertId });
    });
  } else {
    // Offline JSON Fallback for Signup
    const users = readJSON(USERS_FILE);
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: "Email already exists! Please login." });
    }
    const newUser = { id: Date.now(), name, email, password, role: role || 'User' };
    users.push(newUser);
    writeJSON(USERS_FILE, users);
    res.json({ message: "Signup successful (JSON mode)!", userId: newUser.id });
  }
});

// LOGIN ROUTE: Verifies user credentials
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (isMySQLConnected) {
    authenticateUserInDB(email, password, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password!" });
      }
      res.json({ message: "Login successful!", user: rows[0] });
    });
  } else {
    // Offline JSON Fallback for Login
    const users = readJSON(USERS_FILE);
    const foundUser = users.find(u => u.email === email && u.password === password);
    if (!foundUser) {
      return res.status(401).json({ error: "Invalid email or password!" });
    }
    const { id, name, role } = foundUser;
    res.json({ message: "Login successful!", user: { id, name, email, role } });
  }
});

// =========================================================================
// 5. SPA CRUD API ROUTES (/api/records) - Connects to index.html
// =========================================================================

// READ ALL
app.get('/api/records', (req, res) => {
  if (isMySQLConnected) {
    db.query("SELECT * FROM records ORDER BY id DESC", (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    res.json(readJSON(RECORDS_FILE));
  }
});

// READ UNIQUE CATEGORIES (SELECT DISTINCT)
app.get('/api/records/unique', (req, res) => {
  if (isMySQLConnected) {
    db.query("SELECT DISTINCT category FROM records", (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => r.category));
    });
  } else {
    const categories = [...new Set(readJSON(RECORDS_FILE).map(r => r.category))];
    res.json(categories);
  }
});

// CREATE RECORD
app.post('/api/records', (req, res) => {
  const { name, email, category, details } = req.body;
  if (isMySQLConnected) {
    const sql = "INSERT INTO records (name, email, category, details) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, email, category, details], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId, name, email, category, details });
    });
  } else {
    const list = readJSON(RECORDS_FILE);
    const newItem = { id: Date.now(), name, email, category, details };
    list.unshift(newItem);
    writeJSON(RECORDS_FILE, list);
    res.json(newItem);
  }
});

// UPDATE RECORD
app.put('/api/records/:id', (req, res) => {
  const recordId = Number(req.params.id);
  const { name, email, category, details } = req.body;
  if (isMySQLConnected) {
    const sql = "UPDATE records SET name = ?, email = ?, category = ?, details = ? WHERE id = ?";
    db.query(sql, [name, email, category, details, recordId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Updated" });
    });
  } else {
    const updated = readJSON(RECORDS_FILE).map(item =>
      item.id === recordId ? { id: recordId, name, email, category, details } : item
    );
    writeJSON(RECORDS_FILE, updated);
    res.json({ message: "Updated" });
  }
});

// DELETE RECORD
app.delete('/api/records/:id', (req, res) => {
  const recordId = Number(req.params.id);
  if (isMySQLConnected) {
    db.query("DELETE FROM records WHERE id = ?", [recordId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Deleted" });
    });
  } else {
    const filtered = readJSON(RECORDS_FILE).filter(item => item.id !== recordId);
    writeJSON(RECORDS_FILE, filtered);
    res.json({ message: "Deleted" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running! Start at Login Page: http://localhost:${PORT}`);
});