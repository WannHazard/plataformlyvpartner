const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');

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
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'));
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

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
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (match) {
      res.json({ id: user.id, username: user.username, role: user.role });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  });
});

// Register (Helper for initial setup, usually admin only)
app.post('/api/register', async (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// Clock In
app.post('/api/clock-in', (req, res) => {
  const { userId, lat, lon } = req.body;

  // Verificar que el usuario tenga una asignación activa
  db.get('SELECT * FROM worker_assignments WHERE user_id = ? AND status = ?', [userId, 'active'], (err, assignment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!assignment) {
      return res.status(403).json({
        error: 'No hay asignación activa',
        message: 'Debes estar asignado a un lugar de trabajo para marcar entrada'
      });
    }

    const now = new Date().toISOString();
    db.run('INSERT INTO time_logs (user_id, clock_in_time, clock_in_lat, clock_in_lon) VALUES (?, ?, ?, ?)',
      [userId, now, lat, lon],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: 'Clocked in successfully' });
      }
    );
  });
});

// Clock Out
app.post('/api/clock-out', (req, res) => {
  const { userId, lat, lon } = req.body;

  // Verificar que el usuario tenga una asignación activa
  db.get('SELECT * FROM worker_assignments WHERE user_id = ? AND status = ?', [userId, 'active'], (err, assignment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!assignment) {
      return res.status(403).json({
        error: 'No hay asignación activa',
        message: 'Debes estar asignado a un lugar de trabajo para marcar salida'
      });
    }

    const now = new Date().toISOString();
    // Find the last active log for this user (where clock_out_time is null)
    db.get('SELECT id FROM time_logs WHERE user_id = ? AND clock_out_time IS NULL ORDER BY id DESC LIMIT 1', [userId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(400).json({ error: 'No active clock-in found' });

      db.run('UPDATE time_logs SET clock_out_time = ?, clock_out_lat = ?, clock_out_lon = ? WHERE id = ?',
        [now, lat, lon, row.id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Clocked out successfully' });
        }
      );
    });
  });
});

// Upload Report (Photo + Text)
app.post('/api/report', upload.single('photo'), (req, res) => {
  const { userId, text } = req.body;
  const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

  // We attach the report to the current active session OR just the last session. 
  // Let's assume we update the last session or create a standalone report?
  // Requirement says "opcion de subir foto y hacer informe".
  // Let's update the latest log entry for simplicity, or we could have a separate reports table.
  // Given the schema in db.js has report_text and photo_path in time_logs, we'll update the latest log.

  db.get('SELECT id FROM time_logs WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(400).json({ error: 'No time log found to attach report' });

    db.run('UPDATE time_logs SET report_text = ?, photo_path = ? WHERE id = ?',
      [text, photoPath, row.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Report submitted successfully', photoPath });
      }
    );
  });
});

// Get Logs (For Manager)
app.get('/api/logs', (req, res) => {
  db.all(`
    SELECT t.*, u.username 
    FROM time_logs t 
    JOIN users u ON t.user_id = u.id 
    ORDER BY t.clock_in_time DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Get Locations
app.get('/api/locations', (req, res) => {
  db.all('SELECT * FROM locations', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add Location
app.post('/api/locations', (req, res) => {
  const { name, lat, lon, radius } = req.body;
  db.run('INSERT INTO locations (name, latitude, longitude, radius) VALUES (?, ?, ?, ?)',
    [name, lat, lon, radius],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Delete Location
app.delete('/api/locations/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM locations WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Ubicación eliminada exitosamente' });
  });
});

// --- User Management Routes ---

// Get all users
app.get('/api/users', (req, res) => {
  db.all('SELECT id, username, role FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Create user
app.post('/api/users', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, username, role });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  const { username, password, role } = req.body;
  const { id } = req.params;

  try {
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run('UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?',
        [username, hashedPassword, role, id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'User updated successfully' });
        }
      );
    } else {
      db.run('UPDATE users SET username = ?, role = ? WHERE id = ?',
        [username, role, id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'User updated successfully' });
        }
      );
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'User deleted successfully' });
  });
});

// --- Worker Assignments Routes ---

// Get all assignments
app.get('/api/assignments', (req, res) => {
  db.all(`
    SELECT a.*, u.username, l.name as location_name 
    FROM worker_assignments a
    JOIN users u ON a.user_id = u.id
    JOIN locations l ON a.location_id = l.id
    ORDER BY a.status DESC, a.assigned_date DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Assign worker to location
app.post('/api/assignments', (req, res) => {
  const { userId, locationId } = req.body;
  db.run('INSERT INTO worker_assignments (user_id, location_id) VALUES (?, ?)',
    [userId, locationId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Worker assigned successfully' });
    }
  );
});

// Delete assignment
app.delete('/api/assignments/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM worker_assignments WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Assignment deleted successfully' });
  });
});

// Update assignment status
app.patch('/api/assignments/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['active', 'finished'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be "active" or "finished"' });
  }

  db.run('UPDATE worker_assignments SET status = ? WHERE id = ?', [status, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Assignment status updated successfully' });
  });
});

// Get worker profile with monthly hours
app.get('/api/workers/:id/profile', (req, res) => {
  const { id } = req.params;
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  db.get('SELECT id, username, role FROM users WHERE id = ?', [id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get monthly hours
    db.all(`
      SELECT * FROM time_logs 
      WHERE user_id = ? 
      AND strftime('%Y-%m', clock_in_time) = ?
      ORDER BY clock_in_time DESC
    `, [id, currentMonth], (err, logs) => {
      if (err) return res.status(500).json({ error: err.message });

      // Calculate total hours
      let totalMinutes = 0;
      logs.forEach(log => {
        if (log.clock_in_time && log.clock_out_time) {
          const start = new Date(log.clock_in_time);
          const end = new Date(log.clock_out_time);
          totalMinutes += (end - start) / 60000;
        }
      });

      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = Math.floor(totalMinutes % 60);

      // Get assignments
      db.all(`
        SELECT l.name as location_name, a.assigned_date, a.status
        FROM worker_assignments a
        JOIN locations l ON a.location_id = l.id
        WHERE a.user_id = ?
        ORDER BY a.status ASC, a.assigned_date DESC
      `, [id], (err, assignments) => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
          ...user,
          monthlyHours: `${totalHours}h ${remainingMinutes}m`,
          totalMinutes,
          logs,
          assignments
        });
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
