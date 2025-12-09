-- Schema for Time Tracking Application - PostgreSQL
-- Drop existing tables if needed (uncomment for fresh start)
-- DROP TABLE IF EXISTS worker_assignments CASCADE;
-- DROP TABLE IF EXISTS time_logs CASCADE;
-- DROP TABLE IF EXISTS locations CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'worker')) NOT NULL
);

-- Work Locations table
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  radius REAL
);

-- Time Logs table
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
);

-- Worker Assignments table
CREATE TABLE IF NOT EXISTS worker_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
  assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'finished'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_clock_in ON time_logs(clock_in_time);
CREATE INDEX IF NOT EXISTS idx_worker_assignments_user_id ON worker_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_assignments_status ON worker_assignments(status);
