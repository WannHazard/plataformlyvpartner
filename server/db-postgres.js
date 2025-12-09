const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Create connection pool using individual parameters to avoid URL encoding issues
const pool = new Pool({
  host: process.env.DB_HOST || '35.214.221.252',
  port: process.env.DB_PORT || 443,
  database: process.env.DB_NAME || 'dbolsqtjszs2bl',
  user: process.env.DB_USER || 'usr1wx4ig8ekg',
  password: process.env.DB_PASSWORD || 'z#>B(#d12^d{',
  ssl: {
    rejectUnauthorized: false  // Required for cloud PostgreSQL providers
  },
  // Additional connection options
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Initialize database tables and seed data
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'worker')) NOT NULL
      )
    `);

    // Work Locations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        radius REAL
      )
    `);

    // Time Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS time_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        clock_in_time TIMESTAMP,
        clock_out_time TIMESTAMP,
        clock_in_lat REAL,
        clock_in_lon REAL,
        clock_out_lat REAL,
        clock_out_lon REAL,
        report_text TEXT,
        photo_path TEXT
      )
    `);

    // Worker Assignments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS worker_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
        assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'finished'))
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON time_logs(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_time_logs_clock_in ON time_logs(clock_in_time)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_worker_assignments_user_id ON worker_assignments(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_worker_assignments_status ON worker_assignments(status)');

    // Seed Admin User
    const adminCheck = await client.query("SELECT * FROM users WHERE username = 'admin'");
    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
        ['admin', hashedPassword, 'admin']
      );
      console.log("Seeded admin user");
    }

    // Seed Worker User
    const workerCheck = await client.query("SELECT * FROM users WHERE username = 'worker'");
    if (workerCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('worker123', 10);
      await client.query(
        "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
        ['worker', hashedPassword, 'worker']
      );
      console.log("Seeded worker user");
    }

    await client.query('COMMIT');
    console.log('Database initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Initialize on module load
initDb().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = pool;
