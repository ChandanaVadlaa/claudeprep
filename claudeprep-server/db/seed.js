/**
 * ClaudePrep seed script
 * Usage: node db/seed.js
 * Requires DATABASE_URL in environment (or .env file)
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Run schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✓ Schema applied');

    // Load question data
    const banks = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'cert_banks.json'), 'utf8')
    );

    // Upsert certs
    for (const [key, cert] of Object.entries(banks)) {
      await client.query(
        `INSERT INTO certs(key,code,name,mins,pass)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(key) DO UPDATE SET code=$2,name=$3,mins=$4,pass=$5`,
        [key, cert.code, cert.name, cert.mins, cert.pass]
      );
    }
    console.log('✓ Certs upserted');

    // Upsert questions (match by cert_key + question text to avoid dupes)
    let qCount = 0;
    for (const [key, cert] of Object.entries(banks)) {
      for (const q of cert.qs) {
        await client.query(
          `INSERT INTO questions(cert_key,domain_num,domain_name,question,options,answer_idx,explanation)
           VALUES($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT DO NOTHING`,
          [key, q.d, q.dn, q.q, JSON.stringify(q.opts), q.a, q.ex || null]
        );
        qCount++;
      }
    }
    console.log(`✓ ${qCount} questions seeded`);

    // Seed initial admin user (EWGCS team member)
    const hash = await bcrypt.hash('Letmein', 12);
    await client.query(
      `INSERT INTO users(email,password_hash,name,role)
       VALUES($1,$2,$3,'admin')
       ON CONFLICT(email) DO UPDATE SET password_hash=$2`,
      ['chandana.vadla@ewgcs.com', hash, 'Chandana Vadla']
    );
    console.log('✓ Initial user seeded (chandana.vadla@ewgcs.com)');

    await client.query('COMMIT');
    console.log('\n✅ Database seeded successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
