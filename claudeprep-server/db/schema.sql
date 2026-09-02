-- ClaudePrep Database Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name        TEXT,
  role        TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cert metadata
CREATE TABLE IF NOT EXISTS certs (
  key         TEXT PRIMARY KEY,  -- cca, ccd, ccar, ccarp
  code        TEXT NOT NULL,     -- CCA-F etc.
  name        TEXT NOT NULL,
  mins        INTEGER NOT NULL,
  pass        INTEGER NOT NULL   -- passing score /1000
);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
  id          SERIAL PRIMARY KEY,
  cert_key    TEXT NOT NULL REFERENCES certs(key),
  domain_num  INTEGER NOT NULL,
  domain_name TEXT NOT NULL,
  question    TEXT NOT NULL,
  options     JSONB NOT NULL,    -- array of strings
  answer_idx  INTEGER NOT NULL,  -- 0-based index into options
  explanation TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_cert ON questions(cert_key);

-- Exam attempts
CREATE TABLE IF NOT EXISTS exam_attempts (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cert_key     TEXT NOT NULL REFERENCES certs(key),
  score        INTEGER NOT NULL,          -- raw score /1000 (scaled)
  correct      INTEGER NOT NULL,
  total        INTEGER NOT NULL,
  time_taken   INTEGER,                   -- seconds
  answers      JSONB NOT NULL,            -- [{question_id, chosen_idx, correct}]
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_cert ON exam_attempts(cert_key);

-- Per-question stats (aggregated per user)
CREATE TABLE IF NOT EXISTS question_stats (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id  INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  correct_cnt  INTEGER NOT NULL DEFAULT 0,
  incorrect_cnt INTEGER NOT NULL DEFAULT 0,
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_qstats_user ON question_stats(user_id);
