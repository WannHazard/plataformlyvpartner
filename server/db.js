const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT CHECK(role IN ('admin', 'worker'))
    )`);

        // Work Locations table
        db.run(`CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      latitude REAL,
      longitude REAL,
      radius REAL
    )`);

        // Time Logs table
        db.run(`CREATE TABLE IF NOT EXISTS time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      clock_in_time DATETIME,
      clock_out_time DATETIME,
      clock_in_lat REAL,
      clock_in_lon REAL,
      clock_out_lat REAL,
      clock_out_lon REAL,
      report_text TEXT,
      photo_path TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

        // Worker Assignments table
        db.run(`CREATE TABLE IF NOT EXISTS worker_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      location_id INTEGER,
      assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'finished')),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(location_id) REFERENCES locations(id)
    )`);

        // Seed Admin User
        db.get("SELECT * FROM users WHERE username = 'admin'", async (err, row) => {
            if (!row) {
                const hashedPassword = await bcrypt.hash('admin123', 10);
                db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', hashedPassword, 'admin']);
                console.log("Seeded admin user");
            }
        });

        // Seed Worker User
        db.get("SELECT * FROM users WHERE username = 'worker'", async (err, row) => {
            if (!row) {
                const hashedPassword = await bcrypt.hash('worker123', 10);
                db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['worker', hashedPassword, 'worker']);
                console.log("Seeded worker user");
            }
        });

        // Migración: Añadir columna status si no existe
        db.all("PRAGMA table_info(worker_assignments)", (err, columns) => {
            if (err) {
                console.error("Error checking table schema:", err);
                return;
            }

            const hasStatusColumn = columns.some(col => col.name === 'status');

            if (!hasStatusColumn) {
                console.log("Adding status column to worker_assignments...");
                db.run("ALTER TABLE worker_assignments ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'finished'))", (err) => {
                    if (err) {
                        console.error("Error adding status column:", err);
                    } else {
                        console.log("Status column added successfully");
                        // Actualizar registros existentes
                        db.run("UPDATE worker_assignments SET status = 'active' WHERE status IS NULL", (err) => {
                            if (err) console.error("Error updating existing records:", err);
                            else console.log("Updated existing assignments to 'active'");
                        });
                    }
                });
            } else {
                console.log("Status column already exists");
            }
        });
    });
}

module.exports = db;
