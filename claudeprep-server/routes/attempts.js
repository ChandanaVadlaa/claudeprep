const express = require('express');
const { pool } = require('../db/pool');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// POST /api/attempts  — save a completed exam
router.post('/', requireAuth, async (req, res) => {
  const { cert_key, correct, total, time_taken, answers } = req.body || {};
  if (!cert_key || correct == null || !total || !answers)
    return res.status(400).json({ error: 'cert_key, correct, total, answers required' });

  // Scale score 0–1000 like Pearson
  const score = Math.round((correct / total) * 1000);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO exam_attempts(user_id,cert_key,score,correct,total,time_taken,answers)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, cert_key, score, correct, total, time_taken || null, JSON.stringify(answers)]
    );
    const attempt = rows[0];

    // Update per-question stats
    for (const ans of answers) {
      await client.query(
        `INSERT INTO question_stats(user_id,question_id,correct_cnt,incorrect_cnt,last_seen)
         VALUES($1,$2,$3,$4,NOW())
         ON CONFLICT(user_id,question_id) DO UPDATE
           SET correct_cnt   = question_stats.correct_cnt   + $3,
               incorrect_cnt = question_stats.incorrect_cnt + $4,
               last_seen     = NOW()`,
        [req.user.id, ans.question_id,
         ans.correct ? 1 : 0,
         ans.correct ? 0 : 1]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(attempt);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/attempts?cert=&limit=20  — list user's attempts
router.get('/', requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const cert = req.query.cert || null;

  try {
    let q, params;
    if (cert) {
      q = `SELECT a.id,a.cert_key,c.code,a.score,a.correct,a.total,a.time_taken,a.completed_at
           FROM exam_attempts a JOIN certs c ON c.key=a.cert_key
           WHERE a.user_id=$1 AND a.cert_key=$2
           ORDER BY a.completed_at DESC LIMIT $3`;
      params = [req.user.id, cert, limit];
    } else {
      q = `SELECT a.id,a.cert_key,c.code,a.score,a.correct,a.total,a.time_taken,a.completed_at
           FROM exam_attempts a JOIN certs c ON c.key=a.cert_key
           WHERE a.user_id=$1
           ORDER BY a.completed_at DESC LIMIT $2`;
      params = [req.user.id, limit];
    }
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/attempts/:id  — single attempt detail with answers
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*,c.code,c.name,c.pass
       FROM exam_attempts a JOIN certs c ON c.key=a.cert_key
       WHERE a.id=$1 AND a.user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/attempts/stats/summary  — overall user stats
router.get('/stats/summary', requireAuth, async (req, res) => {
  try {
    const { rows: certStats } = await pool.query(
      `SELECT a.cert_key, c.code,
              COUNT(*) as attempts,
              MAX(a.score) as best_score,
              ROUND(AVG(a.score)) as avg_score,
              MAX(a.completed_at) as last_attempt
       FROM exam_attempts a JOIN certs c ON c.key=a.cert_key
       WHERE a.user_id=$1
       GROUP BY a.cert_key, c.code ORDER BY a.cert_key`,
      [req.user.id]
    );

    const { rows: weakAreas } = await pool.query(
      `SELECT q.domain_name, q.cert_key,
              SUM(qs.correct_cnt) as correct,
              SUM(qs.incorrect_cnt) as incorrect,
              ROUND(100.0*SUM(qs.correct_cnt)/(NULLIF(SUM(qs.correct_cnt+qs.incorrect_cnt),0))) as pct
       FROM question_stats qs
       JOIN questions q ON q.id=qs.question_id
       WHERE qs.user_id=$1
       GROUP BY q.domain_name, q.cert_key
       ORDER BY pct ASC NULLS LAST LIMIT 5`,
      [req.user.id]
    );

    res.json({ by_cert: certStats, weak_areas: weakAreas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
