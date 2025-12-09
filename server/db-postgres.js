const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const url = require('url');
require('dotenv').config();

// Configuration builder
const buildConfig = (sslConfig) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const dbUrl = process.env.DATABASE_URL;

  let config = {
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10,
    ssl: sslConfig
  };

  if (dbUrl) {
    try {
      const parsedUrl = new url.URL(dbUrl);
      config.user = parsedUrl.username;
      config.password = parsedUrl.password;
      config.host = parsedUrl.hostname;
      config.port = parsedUrl.port || 5432;
      config.database = parsedUrl.pathname.split('/')[1]; // remove leading slash

      console.log(`[DB Config] Parsed Host: ${config.host}`);
      console.log(`[DB Config] Parsed Port: ${config.port}`);
      console.log(`[DB Config] Parsed DB: ${config.database}`);
    } catch (e) {
      console.error('[DB Config] Error parsing DATABASE_URL:', e);
      // Fallback if parsing fails (shouldn't happen with valid URL)
    }
  } else {
    // Local / Manual fallback path
    config.host = process.env.DB_HOST || '35.214.221.252';
    config.port = parseInt(process.env.DB_PORT) || 443;
    config.database = process.env.DB_NAME || 'dbolsqtjszs2bl';
    config.user = process.env.DB_USER || 'usr1wx4ig8ekg';
    config.password = process.env.DB_PASSWORD || 'z#>B(#d12^d{';
  }

  return config;
};

// Global active pool reference
let activePool = null;

// Helper to test a connection configuration
async function tryConnect(config, description) {
  console.log(`[DB Init] Attempting connection via ${description} to ${config.host}:${config.port}...`);
  const pool = new Pool(config);
  try {
    const client = await pool.connect();
    console.log(`[DB Init] Connection SUCCESS via ${description}`);
    client.release();
    return pool;
  } catch (err) {
    console.warn(`[DB Init] Connection FAILED via ${description}: ${err.message}`);
    await pool.end(); // Clean up failed pool
    return null;
  }
}

// Initialization Logic
async function initializePool() {
  if (activePool) return activePool;

  // Strategy 1: Try NO SSL (Standard for Render Internal)
  const noSSLConfig = buildConfig(false);
  activePool = await tryConnect(noSSLConfig, 'No SSL');

  // Strategy 2: If failed, Try with SSL (Standard for Render External / Remote)
  if (!activePool) {
    const sslConfig = buildConfig({ rejectUnauthorized: false });
    activePool = await tryConnect(sslConfig, 'SSL');
  }

  // Strategy 3: PORT AUTO-CORRECTION (Try Port 5432 if not already used)
  // The logs showed the app connecting to port 443, which is wrong.
  if (!activePool && noSSLConfig.port !== 5432) {
    console.log('[DB Init] Configured port failed. Attempting Port 5432 Override...');

    const noSSLConfig5432 = { ...noSSLConfig, port: 5432 };
    activePool = await tryConnect(noSSLConfig5432, 'No SSL (Port 5432 Override)');

    if (!activePool) {
      const sslConfig5432 = { ...buildConfig({ rejectUnauthorized: false }), port: 5432 };
      activePool = await tryConnect(sslConfig5432, 'SSL (Port 5432 Override)');
    }
  }

  if (!activePool) {
    console.error('[DB Init] CRITICAL: Could not establish database connection with any configuration.');
    process.exit(1);
  }

  // Set up error handler on the winning pool
  activePool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  // Run Schema Init
  await initDb(activePool);

  return activePool;
}

// Initialize database tables and seed data
async function initDb(pool) {
  console.log('[DB Init] Initializing Schema...');
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

// Start initialization immediately
const poolPromise = initializePool().catch(err => {
  console.error('Failed to initialize pool:', err);
  process.exit(1);
});

// Export a proxy that delegates to the active pool
// This ensures that 'require' returns an object immediately,
// but methods wait for initialization.
module.exports = {
  query: async (text, params) => {
    const pool = await poolPromise;
    return pool.query(text, params);
  },
  connect: async () => {
    const pool = await poolPromise;
    return pool.connect();
  }
};
