const express = require('express');
const mysql = require('mysql');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());

const BACKUP_FILE = path.join(__dirname, 'data_backup.json');
let isMySQLConnected = true;

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: ''
});

db.connect((err) => {
  if (err) {
    console.log('MySQL not detected. Using JSON file database mode.');
    isMySQLConnected = false;

    if (!fs.existsSync(BACKUP_FILE)) {
      fs.writeFileSync(BACKUP_FILE, JSON.stringify([], null, 2));
    }

    return;
  }

  console.log('Connected to MySQL Server!');

  db.query('CREATE DATABASE IF NOT EXISTS exam_db', (err) => {
    if (err) {
      console.error(err.message);
      return;
    }

    db.changeUser({ database: 'exam_db' }, (err) => {
      if (err) {
        console.error(err.message);
        return;
      }

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL,
          category VARCHAR(50),
          details VARCHAR(255)
        )
      `;

      db.query(createTableSQL, (err) => {
        if (err) {
          console.error(err.message);
          return;
        }

        console.log("Database 'exam_db' and table 'records' are ready!");
      });
    });
  });
});

function readBackupJSON() {
  if (!fs.existsSync(BACKUP_FILE)) return [];
  return JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
}

function writeBackupJSON(data) {
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2));
}

function getAllRecordsFromDB(callback) {
  db.query('SELECT * FROM records ORDER BY id DESC', callback);
}

function getUniqueCategoriesFromDB(callback) {
  db.query('SELECT DISTINCT category FROM records', callback);
}

function insertRecordIntoDB(data, callback) {
  const sql = `
    INSERT INTO records (name, email, category, details)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    sql,
    [data.name, data.email, data.category, data.details],
    callback
  );
}

function updateRecordInDB(id, data, callback) {
  const sql = `
    UPDATE records
    SET name = ?, email = ?, category = ?, details = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [data.name, data.email, data.category, data.details, id],
    callback
  );
}

function deleteRecordFromDB(id, callback) {
  db.query('DELETE FROM records WHERE id = ?', [id], callback);
}

function dropRecordsTable(callback) {
  db.query('DROP TABLE IF EXISTS records', callback);
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/records', (req, res) => {
  if (isMySQLConnected) {
    getAllRecordsFromDB((err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json(rows);
    });
  } else {
    res.json(readBackupJSON());
  }
});

app.get('/api/records/unique', (req, res) => {
  if (isMySQLConnected) {
    getUniqueCategoriesFromDB((err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json(rows.map((row) => row.category));
    });
  } else {
    const categories = [
      ...new Set(readBackupJSON().map((item) => item.category))
    ];

    res.json(categories);
  }
});

app.post('/api/records', (req, res) => {
  const { name, email, category, details } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: 'Name and email are required.'
    });
  }

  if (isMySQLConnected) {
    insertRecordIntoDB(
      { name, email, category, details },
      (err, result) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        res.json({
          id: result.insertId,
          name,
          email,
          category,
          details
        });
      }
    );
  } else {
    const list = readBackupJSON();

    const newItem = {
      id: Date.now(),
      name,
      email,
      category,
      details
    };

    list.unshift(newItem);
    writeBackupJSON(list);

    res.json(newItem);
  }
});

app.put('/api/records/:id', (req, res) => {
  const recordId = Number(req.params.id);
  const { name, email, category, details } = req.body;

  if (isMySQLConnected) {
    updateRecordInDB(
      recordId,
      { name, email, category, details },
      (err, result) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Record not found.' });
        }

        res.json({ message: 'Record updated successfully.' });
      }
    );
  } else {
    const list = readBackupJSON();
    const exists = list.some((item) => item.id === recordId);

    if (!exists) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    const updatedList = list.map((item) =>
      item.id === recordId
        ? { id: recordId, name, email, category, details }
        : item
    );

    writeBackupJSON(updatedList);

    res.json({ message: 'Record updated in JSON.' });
  }
});

app.delete('/api/records/:id', (req, res) => {
  const recordId = Number(req.params.id);

  if (isMySQLConnected) {
    deleteRecordFromDB(recordId, (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Record not found.' });
      }

      res.json({ message: 'Record deleted successfully.' });
    });
  } else {
    const list = readBackupJSON();
    const filteredList = list.filter((item) => item.id !== recordId);

    if (filteredList.length === list.length) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    writeBackupJSON(filteredList);

    res.json({ message: 'Record deleted from JSON.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server started! Open http://localhost:${PORT}`);
});
