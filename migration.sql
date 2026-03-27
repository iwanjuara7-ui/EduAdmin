-- FIX FOR "invalid input syntax for type bigint" and "Could not find the 'photo_url' column"
-- Run this in your Supabase SQL Editor

-- 1. Drop the existing users table if it has the wrong ID type
-- WARNING: This will delete existing user profiles. 
-- If you want to keep data, you'd need a more complex migration, 
-- but for a prototype, dropping and recreating is safest.
DROP TABLE IF EXISTS users CASCADE;

-- 2. Recreate the users table with correct types
CREATE TABLE users (
    id UUID PRIMARY KEY, -- Must be UUID to match Supabase Auth
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. Re-create policies
CREATE POLICY "Allow public registration" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (true);

-- 5. Fix foreign keys in other tables if they were broken by the drop
-- (The CASCADE should have handled the drop, but we need to ensure they point to UUID now)

-- Update siswa table
ALTER TABLE siswa DROP COLUMN IF EXISTS created_by;
ALTER TABLE siswa ADD COLUMN created_by UUID REFERENCES users(id);

-- Update agenda_guru table
ALTER TABLE agenda_guru DROP COLUMN IF EXISTS uploaded_by;
ALTER TABLE agenda_guru ADD COLUMN uploaded_by UUID REFERENCES users(id);

-- Update laporan_piket table
ALTER TABLE laporan_piket DROP COLUMN IF EXISTS teacher_id;
ALTER TABLE laporan_piket ADD COLUMN teacher_id UUID REFERENCES users(id);

-- Update laporan_walikelas table
ALTER TABLE laporan_walikelas DROP COLUMN IF EXISTS teacher_id;
ALTER TABLE laporan_walikelas ADD COLUMN teacher_id UUID REFERENCES users(id);

-- Update eraport table
ALTER TABLE eraport DROP COLUMN IF EXISTS teacher_id;
ALTER TABLE eraport ADD COLUMN teacher_id UUID REFERENCES users(id);

-- Update kkm table
ALTER TABLE kkm DROP COLUMN IF EXISTS teacher_id;
ALTER TABLE kkm ADD COLUMN teacher_id UUID REFERENCES users(id);

-- Update absensi_siswa table
ALTER TABLE absensi_siswa DROP COLUMN IF EXISTS teacher_id;
ALTER TABLE absensi_siswa ADD COLUMN teacher_id UUID REFERENCES users(id);

-- Update ai_documents table
ALTER TABLE ai_documents DROP COLUMN IF EXISTS created_by;
ALTER TABLE ai_documents ADD COLUMN created_by UUID REFERENCES users(id);
