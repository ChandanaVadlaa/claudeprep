const express = require('express');
const { pool } = require('../db/pool');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// GET /api/certs  — list all cert metadata
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows: certs } = await pool.query(
      'SELECT key,code,name,mins,pass FROM certs ORDER BY key'
    );
    // Attach question count per cert
    const { rows: counts } = await pool.query(
      'SELECT cert_key, COUNT(*) as cnt FROM questions GROUP BY cert_key'
    );
    const countMap = Object.fromEntries(counts.map(r => [r.cert_key, parseInt(r.cnt)]));
    res.json(certs.map(c => ({ ...c, question_count: countMap[c.key] || 0 })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/certs/:key  — cert detail + domain breakdown
router.get('/:key', requireAuth, async (req, res) => {
  try {
    const { rows: certs } = await pool.query(
      'SELECT * FROM certs WHERE key=$1', [req.params.key]
    );
    if (!certs[0]) return res.status(404).json({ error: 'Cert not found' });

    const { rows: domains } = await pool.query(
      `SELECT domain_num, domain_name, COUNT(*) as cnt
       FROM questions WHERE cert_key=$1
       GROUP BY domain_num, domain_name ORDER BY domain_num`,
      [req.params.key]
    );
    res.json({ ...certs[0], domains });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/certs/:key/questions?count=30&domain=&shuffle=true
router.get('/:key/questions', requireAuth, async (req, res) => {
  const { key } = req.params;
  const count = Math.min(parseInt(req.query.count) || 30, 100);
  const shuffle = req.query.shuffle !== 'false';
  const domain = req.query.domain ? parseInt(req.query.domain) : null;

  try {
    let q, params;
    if (domain) {
      q = `SELECT id,domain_num,domain_name,question,options,answer_idx,explanation
           FROM questions WHERE cert_key=$1 AND domain_num=$2
           ${shuffle ? 'ORDER BY RANDOM()' : 'ORDER BY id'}
           LIMIT $3`;
      params = [key, domain, count];
    } else {
      q = `SELECT id,domain_num,domain_name,question,options,answer_idx,explanation
           FROM questions WHERE cert_key=$1
           ${shuffle ? 'ORDER BY RANDOM()' : 'ORDER BY id'}
           LIMIT $2`;
      params = [key, count];
    }
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
