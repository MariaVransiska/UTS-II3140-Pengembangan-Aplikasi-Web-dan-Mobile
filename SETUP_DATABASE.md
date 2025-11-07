# 🗄️ Database Setup Guide

## Prerequisites
- ✅ Supabase account created
- ✅ Project created: `https://lbslcllhpyetvsbpcvqp.supabase.co`
- ✅ Environment variables set in `.env`

## Step 1: Create Tables

1. Go to Supabase SQL Editor: [SQL Editor](https://app.supabase.com/project/lbslcllhpyetvsbpcvqp/sql)
2. Copy and paste the SQL script below
3. Click **RUN** or press `Ctrl+Enter`

```sql
-- ============================================
-- VIRTUAL LAB AGAMA KRISTEN - DATABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  
  -- Profile data
  name VARCHAR(255),
  nim VARCHAR(50) UNIQUE,
  kelas VARCHAR(50),
  gender VARCHAR(10),
  
  -- Progress tracking (JSONB untuk flexibility)
  progress JSONB DEFAULT '{
    "quizScores": [],
    "assignments": [],
    "journalEntries": [],
    "materialsViewed": [],
    "videosWatched": []
  }'::jsonb,
  
  -- Statistics
  statistics JSONB DEFAULT '{
    "totalQuizAttempts": 0,
    "averageQuizScore": 0,
    "totalStudyTime": 0,
    "streakDays": 0,
    "lastLoginDate": null
  }'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- INDEXES untuk performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_nim ON users(nim);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- GIN index untuk JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_progress ON users USING GIN(progress);
CREATE INDEX IF NOT EXISTS idx_users_statistics ON users USING GIN(statistics);

-- ============================================
-- AUTO UPDATE timestamp function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk auto-update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Anyone can register" ON users;

-- Policy: Users can only view their own data
CREATE POLICY "Users can view own profile" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

-- Policy: Users can update their own data
CREATE POLICY "Users can update own profile" 
  ON users FOR UPDATE 
  USING (auth.uid() = id);

-- Policy: Anyone can insert (for registration)
CREATE POLICY "Anyone can register" 
  ON users FOR INSERT 
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function untuk add quiz score
CREATE OR REPLACE FUNCTION add_quiz_score(
  user_id UUID,
  score INTEGER,
  max_score INTEGER,
  quiz_id VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  new_entry JSONB;
  updated_progress JSONB;
BEGIN
  -- Create new quiz entry
  new_entry := jsonb_build_object(
    'quizId', COALESCE(quiz_id, gen_random_uuid()::text),
    'score', score,
    'maxScore', max_score,
    'percentage', ROUND((score::decimal / max_score::decimal * 100)::numeric, 2),
    'date', NOW()
  );
  
  -- Append to quizScores array
  UPDATE users 
  SET progress = jsonb_set(
    progress,
    '{quizScores}',
    COALESCE(progress->'quizScores', '[]'::jsonb) || new_entry
  )
  WHERE id = user_id;
  
  -- Update statistics
  UPDATE users
  SET statistics = jsonb_set(
    jsonb_set(
      statistics,
      '{totalQuizAttempts}',
      to_jsonb((COALESCE((statistics->>'totalQuizAttempts')::int, 0) + 1))
    ),
    '{averageQuizScore}',
    to_jsonb(
      ROUND(
        (SELECT AVG((value->>'score')::int) 
         FROM jsonb_array_elements(progress->'quizScores') value)::numeric, 
        2
      )
    )
  )
  WHERE id = user_id;
  
  RETURN new_entry;
END;
$$ LANGUAGE plpgsql;

-- Function untuk add assignment
CREATE OR REPLACE FUNCTION add_assignment(
  user_id UUID,
  title VARCHAR,
  file_name VARCHAR,
  file_data TEXT
)
RETURNS JSONB AS $$
DECLARE
  new_entry JSONB;
BEGIN
  new_entry := jsonb_build_object(
    'assignmentId', gen_random_uuid()::text,
    'title', title,
    'fileName', file_name,
    'fileData', file_data,
    'submittedAt', NOW()
  );
  
  UPDATE users 
  SET progress = jsonb_set(
    progress,
    '{assignments}',
    COALESCE(progress->'assignments', '[]'::jsonb) || new_entry
  )
  WHERE id = user_id;
  
  RETURN new_entry;
END;
$$ LANGUAGE plpgsql;

-- Function untuk add journal entry
CREATE OR REPLACE FUNCTION add_journal_entry(
  user_id UUID,
  title VARCHAR,
  content TEXT
)
RETURNS JSONB AS $$
DECLARE
  new_entry JSONB;
BEGIN
  new_entry := jsonb_build_object(
    'entryId', gen_random_uuid()::text,
    'title', title,
    'content', content,
    'date', NOW()
  );
  
  UPDATE users 
  SET progress = jsonb_set(
    progress,
    '{journalEntries}',
    COALESCE(progress->'journalEntries', '[]'::jsonb) || new_entry
  )
  WHERE id = user_id;
  
  RETURN new_entry;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFY SETUP
-- ============================================
SELECT 'Database setup complete! ✅' AS status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
```

## Step 2: Verify Installation

Run this query to check if table is created:

```sql
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

You should see columns:
- `id` (uuid)
- `email` (character varying)
- `password_hash` (character varying)
- `name`, `nim`, `kelas`, `gender`
- `progress` (jsonb)
- `statistics` (jsonb)
- `created_at`, `updated_at`, `last_login` (timestamp)

## Step 3: Test with Sample Data (Optional)

```sql
-- Insert test user (password: test123)
INSERT INTO users (email, password_hash, name, nim, kelas, gender)
VALUES (
  'test@student.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5qdUzO/6mc.5W',
  'Test Student',
  '13520001',
  'K01',
  'Laki-laki'
);

-- Verify
SELECT id, email, name, nim FROM users WHERE email = 'test@student.com';
```

## Step 4: Set Environment Variables in Netlify

1. Go to: [Netlify Dashboard](https://app.netlify.com)
2. Select your project
3. **Site Settings** → **Environment Variables**
4. Add these variables:

```
SUPABASE_URL=https://lbslcllhpyetvsbpcvqp.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxic2xjbGxocHlldHZzYnBjdnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MDE2NDAsImV4cCI6MjA3ODA3NzY0MH0.pHdVMVqFwCBJtjgl0GzSNPc6zlofX3E5M1POAU4TPiY
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxic2xjbGxocHlldHZzYnBjdnFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUwMTY0MCwiZXhwIjoyMDc4MDc3NjQwfQ.Xj8viwxqEZ1aEc7W2mXNloTkELA3KmNQ7yjbaUczYHk
JWT_SECRET=Ldw8fj4xbE
```

5. Click **Save**
6. Redeploy your site

## ✅ Done!

Your database is now ready to use! 🎉

## Troubleshooting

### Error: "relation 'users' does not exist"
- Run the SQL script in Step 1 again

### Error: "permission denied for table users"
- Check RLS policies are created
- Make sure you're using `SUPABASE_SERVICE_KEY` in backend

### Error: "duplicate key value violates unique constraint"
- Email or NIM already exists in database
- Check existing users: `SELECT email, nim FROM users;`

## Next Steps

- Test registration endpoint: `POST /.netlify/functions/server/api/auth/register`
- Test login endpoint: `POST /.netlify/functions/server/api/auth/login`
- Monitor logs in Supabase Dashboard → Logs
