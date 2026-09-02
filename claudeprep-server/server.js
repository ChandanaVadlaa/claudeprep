require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes     = require('./routes/auth');
const certRoutes     = require('./routes/certs');
const attemptRoutes  = require('./routes/attempts');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/certs',    certRoutes);
app.use('/api/attempts', attemptRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ─── Frontend (SPA) ───────────────────────────────────────────────────────────
// Serve the built frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

// All non-API routes fall through to the SPA
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ClaudePrep server running on http://localhost:${PORT}`);
  console.log(`  Database: ${process.env.DATABASE_URL ? '✓ connected' : '✗ DATABASE_URL missing'}`);
});
