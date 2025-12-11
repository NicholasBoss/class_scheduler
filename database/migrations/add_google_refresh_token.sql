-- Add google_refresh_token column to account table
ALTER TABLE account ADD COLUMN IF NOT EXISTS google_refresh_token VARCHAR;
