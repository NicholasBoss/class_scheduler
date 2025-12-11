-- ============================================================
-- DATABASE MIGRATION: Add Semester Calendars Support
-- ============================================================
-- 
-- This migration adds support for storing separate Google 
-- Calendars per semester for each user account.
--
-- Run this migration on existing databases to enable the
-- separate calendar per semester feature.
-- ============================================================

-- Create the semester_calendars table
CREATE TABLE IF NOT EXISTS semester_calendars (
    calendar_id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    semester_name CHARACTER VARYING NOT NULL,
    google_calendar_id CHARACTER VARYING NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to account table
    CONSTRAINT semester_calendars_fk 
        FOREIGN KEY (account_id) 
        REFERENCES account(account_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    -- Ensure one calendar per semester per user
    CONSTRAINT semester_calendars_unique 
        UNIQUE (account_id, semester_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_semester_calendars_account_id 
    ON semester_calendars(account_id);

CREATE INDEX IF NOT EXISTS idx_semester_calendars_account_semester 
    ON semester_calendars(account_id, semester_name);

-- ============================================================
-- Verification Queries
-- ============================================================
-- 
-- Run these queries to verify the migration was successful:
--
-- 1. Check if table exists:
--    SELECT EXISTS (
--        SELECT 1 FROM information_schema.tables 
--        WHERE table_name = 'semester_calendars'
--    );
--
-- 2. Check table structure:
--    \d semester_calendars;
--    (or: DESC semester_calendars; depending on your client)
--
-- 3. Check indexes:
--    SELECT * FROM pg_indexes 
--    WHERE tablename = 'semester_calendars';
--
-- ============================================================

-- Migration completed!
