const express = require('express');
const mysql = require('mysql');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware to parse JSON data sent from index.html
app.use(express.json());

// Backup JSON file path (Used automatically if MySQL service is stopped on the lab PC)
const BACKUP_FILE = path.join(__dirname, 'data_backup.json');
let isMySQLConnected = true;

// =========================================================================
// 1. MYSQL DATABASE CONNECTION & AUTO-SETUP
// =========================================================================
// [REMOVE BEFORE FINAL PRESENTATION]: Check your lab PC's MySQL password (usually "" on XAMPP or "root")
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: ''
});

db.connect((err) => {
  if (err) {
    // [REMOVE BEFORE FINAL PRESENTATION]: Failsafe! If MySQL isn't working, your app won't crash.
    console.log("MySQL not detected. Running in JSON File Database mode so your UI still works 100%!");
    isMySQLConnected = false;
    if (!fs.existsSync(BACKUP_FILE)) {
      fs.writeFileSync(BACKUP_FILE, JSON.stringify([], null, 2));
    }
    return;
  }

  console.log("Connected to MySQL Server!");

  // Step 1: Create Database automatically
  db.query("CREATE DATABASE IF NOT EXISTS exam_db", (err) => {
    if (err) throw err;

    // Step 2: Switch to the newly created database
    db.changeUser({ database: 'exam_db' }, (err) => {
      if (err) throw err;

      // Step 3: Create Table automatically
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL,
          category VARCHAR(50),
          details VARCHAR(255)
        )`;
      db.query(createTableSQL, (err) => {
        if (err) throw err;
        console.log("MySQL Database 'exam_db' and Table 'records' are ready!");
      });
    });
  });
});

// Helper functions for reading/writing the local JSON file fallback
function readBackupJSON() {
  if (!fs.existsSync(BACKUP_FILE)) return [];
  return JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
}
function writeBackupJSON(data) {
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2));
}

// =========================================================================
// 2. USER-DEFINED MYSQL FUNCTIONS (Covers Practical 8.I & 8.II Requirements)
// =========================================================================

// User-Defined Function 1: SELECT ALL records
function getAllRecordsFromDB(callback) {
  db.query("SELECT * FROM records ORDER BY id DESC", callback);
}

// User-Defined Function 2: SELECT UNIQUE (DISTINCT) categories
function getUniqueCategoriesFromDB(callback) {
  db.query("SELECT DISTINCT category FROM records", callback);
}

// User-Defined Function 3: INSERT a new record
function insertRecordIntoDB(data, callback) {
  const sql = "INSERT INTO records (name, email, category, details) VALUES (?, ?, ?, ?)";
  db.query(sql, [data.name, data.email, data.category, data.details], callback);
}

// User-Defined Function 4: UPDATE an existing record by ID
function updateRecordInDB(id, data, callback) {
  const sql = "UPDATE records SET name = ?, email = ?, category = ?, details = ? WHERE id = ?";
  db.query(sql, [data.name, data.email, data.category, data.details, id], callback);
}

// User-Defined Function 5: DELETE a record by ID
function deleteRecordFromDB(id, callback) {
  db.query("DELETE FROM records WHERE id = ?", [id], callback);
}

// User-Defined Function 6: DROP TABLE (Ready if the examiner asks you to demonstrate Drop Table)
function dropRecordsTable(callback) {
  db.query("DROP TABLE IF EXISTS records", callback);
}

// =========================================================================
// 3. EXPRESS API ROUTES (Connects index.html to server.js)
// =========================================================================

// Serve index.html on the home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// READ: Get all records (GET /api/records)
app.get('/api/records', (req, res) => {
  if (isMySQLConnected) {
    getAllRecordsFromDB((err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    res.json(readBackupJSON());
  }
});

// READ UNIQUE: Get unique categories (GET /api/records/unique)
app.get('/api/records/unique', (req, res) => {
  if (isMySQLConnected) {
    getUniqueCategoriesFromDB((err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => r.category));
    });
  } else {
    const categories = [...new Set(readBackupJSON().map(r => r.category))];
    res.json(categories);
  }
});

// CREATE: Add a new record (POST /api/records)
app.post('/api/records', (req, res) => {
  const { name, email, category, details } = req.body;
  if (isMySQLConnected) {
    insertRecordIntoDB({ name, email, category, details }, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId, name, email, category, details });
    });
  } else {
    const list = readBackupJSON();
    const newItem = { id: Date.now(), name, email, category, details };
    list.unshift(newItem);
    writeBackupJSON(list);
    res.json(newItem);
  }
});

// UPDATE: Edit an existing record (PUT /api/records/:id)
app.put('/api/records/:id', (req, res) => {
  const recordId = Number(req.params.id);
  const { name, email, category, details } = req.body;
  if (isMySQLConnected) {
    updateRecordInDB(recordId, { name, email, category, details }, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Record updated successfully" });
    });
  } else {
    const updatedList = readBackupJSON().map(item =>
      item.id === recordId ? { id: recordId, name, email, category, details } : item
    );
    writeBackupJSON(updatedList);
    res.json({ message: "Record updated in JSON" });
  }
});

// DELETE: Remove a record (DELETE /api/records/:id)
app.delete('/api/records/:id', (req, res) => {
  const recordId = Number(req.params.id);
  if (isMySQLConnected) {
    deleteRecordFromDB(recordId, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Record deleted successfully" });
    });
  } else {
    const filteredList = readBackupJSON().filter(item => item.id !== recordId);
    writeBackupJSON(filteredList);
    res.json({ message: "Record deleted from JSON" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server started! Open http://localhost:${PORT} in your browser.`);
});
