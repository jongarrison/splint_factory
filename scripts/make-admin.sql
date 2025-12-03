-- Run this in Supabase SQL Editor to make jongarrison@gmail.com a SYSTEM_ADMIN

UPDATE "User" 
SET role = 'SYSTEM_ADMIN' 
WHERE email = 'jongarrison@gmail.com';

-- Verify it worked
SELECT id, name, email, role FROM "User" WHERE email = 'jongarrison@gmail.com';
