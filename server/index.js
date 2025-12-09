const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db-postgres');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://platform.lyvpartner.com',
  'https://www.platform.lyvpartner.com'
];

app.use(cors({
  origin: function (origin, callback) {
    console.log('Request Origin:', origin);
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      console.error('CORS blocked origin:', origin);
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'));
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// Health Check Route
app.get('/', (req, res) => {
  res.send('Server is running correctly. Time: ' + new Date().toISOString());
});

// Temporary endpoint to seed admin user (REMOVE IN PRODUCTION)
app.post('/api/seed-admin', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const result = await pool.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET password = $2 RETURNING id",
      ['admin', hashedPassword, 'admin']
    );
    res.json({ message: 'Admin user created successfully', userId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use('/uploads', express.static(uploadDir));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// --- ROUTES ---

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      res.json({ id: user.id, username: user.username, role: user.role });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register (Helper for initial setup, usually admin only)
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id',
      [username, hashedPassword, role]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clock In
app.post('/api/clock-in', async (req, res) => {
  try {
    const { userId, lat, lon } = req.body;

    // Verificar que el usuario tenga una asignación activa
    const assignmentResult = await pool.query(
      'SELECT * FROM worker_assignments WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(403).json({
        error: 'No hay asignación activa',
        message: 'Debes estar asignado a un lugar de trabajo para marcar entrada'
      });
    }

    const now = new Date().toISOString();
    const result = await pool.query(
      'INSERT INTO time_logs (user_id, clock_in_time, clock_in_lat, clock_in_lon) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, now, lat, lon]
    );

    res.json({ id: result.rows[0].id, message: 'Clocked in successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clock Out
app.post('/api/clock-out', async (req, res) => {
  try {
    const { userId, lat, lon } = req.body;

    // Verificar que el usuario tenga una asignación activa
    const assignmentResult = await pool.query(
      'SELECT * FROM worker_assignments WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(403).json({
        error: 'No hay asignación activa',
        message: 'Debes estar asignado a un lugar de trabajo para marcar salida'
      });
    }

    const now = new Date().toISOString();

    // Find the last active log for this user (where clock_out_time is null)
    const logResult = await pool.query(
      'SELECT id FROM time_logs WHERE user_id = $1 AND clock_out_time IS NULL ORDER BY id DESC LIMIT 1',
      [userId]
    );

    if (logResult.rows.length === 0) {
      return res.status(400).json({ error: 'No active clock-in found' });
    }

    await pool.query(
      'UPDATE time_logs SET clock_out_time = $1, clock_out_lat = $2, clock_out_lon = $3 WHERE id = $4',
      [now, lat, lon, logResult.rows[0].id]
    );

    res.json({ message: 'Clocked out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload Report (Photo + Text)
app.post('/api/report', upload.single('photo'), async (req, res) => {
  try {
    const { userId, text } = req.body;
    const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

    const logResult = await pool.query(
      'SELECT id FROM time_logs WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      [userId]
    );

    if (logResult.rows.length === 0) {
      return res.status(400).json({ error: 'No time log found to attach report' });
    }

    await pool.query(
      'UPDATE time_logs SET report_text = $1, photo_path = $2 WHERE id = $3',
      [text, photoPath, logResult.rows[0].id]
    );

    res.json({ message: 'Report submitted successfully', photoPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Logs (For Manager)
app.get('/api/logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.username 
      FROM time_logs t 
      JOIN users u ON t.user_id = u.id 
      ORDER BY t.clock_in_time DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Locations
app.get('/api/locations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locations');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Location
app.post('/api/locations', async (req, res) => {
  try {
    const { name, lat, lon, radius } = req.body;
    const result = await pool.query(
      'INSERT INTO locations (name, latitude, longitude, radius) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, lat, lon, radius]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Location
app.delete('/api/locations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM locations WHERE id = $1', [id]);
    res.json({ message: 'Ubicación eliminada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- User Management Routes ---

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id',
      [username, hashedPassword, role]
    );
    res.json({ id: result.rows[0].id, username, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const { id } = req.params;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE users SET username = $1, password = $2, role = $3 WHERE id = $4',
        [username, hashedPassword, role, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET username = $1, role = $2 WHERE id = $3',
        [username, role, id]
      );
    }
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Worker Assignments Routes ---

// Get all assignments
app.get('/api/assignments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.username, l.name as location_name 
      FROM worker_assignments a
      JOIN users u ON a.user_id = u.id
      JOIN locations l ON a.location_id = l.id
      ORDER BY a.status DESC, a.assigned_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign worker to location
app.post('/api/assignments', async (req, res) => {
  try {
    const { userId, locationId } = req.body;
    const result = await pool.query(
      'INSERT INTO worker_assignments (user_id, location_id) VALUES ($1, $2) RETURNING id',
      [userId, locationId]
    );
    res.json({ id: result.rows[0].id, message: 'Worker assigned successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete assignment
app.delete('/api/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM worker_assignments WHERE id = $1', [id]);
    res.json({ message: 'Assignment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update assignment status
app.patch('/api/assignments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'finished'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "active" or "finished"' });
    }

    await pool.query('UPDATE worker_assignments SET status = $1 WHERE id = $2', [status, id]);
    res.json({ message: 'Assignment status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get worker profile with monthly hours
app.get('/api/workers/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const userResult = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get monthly hours - PostgreSQL version
    const logsResult = await pool.query(`
      SELECT * FROM time_logs 
      WHERE user_id = $1 
      AND TO_CHAR(clock_in_time, 'YYYY-MM') = $2
      ORDER BY clock_in_time DESC
    `, [id, currentMonth]);

    // Calculate total hours
    let totalMinutes = 0;
    logsResult.rows.forEach(log => {
      if (log.clock_in_time && log.clock_out_time) {
        const start = new Date(log.clock_in_time);
        const end = new Date(log.clock_out_time);
        totalMinutes += (end - start) / 60000;
      }
    });

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.floor(totalMinutes % 60);

    // Get assignments
    const assignmentsResult = await pool.query(`
      SELECT l.name as location_name, a.assigned_date, a.status
      FROM worker_assignments a
      JOIN locations l ON a.location_id = l.id
      WHERE a.user_id = $1
      ORDER BY a.status ASC, a.assigned_date DESC
    `, [id]);

    res.json({
      ...user,
      monthlyHours: `${totalHours}h ${remainingMinutes}m`,
      totalMinutes,
      logs: logsResult.rows,
      assignments: assignmentsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
