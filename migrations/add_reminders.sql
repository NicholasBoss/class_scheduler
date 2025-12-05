-- Add reminders column to events table
-- Stores an array of reminder times in minutes before event start
-- Default is [15] (15-minute reminder)
ALTER TABLE events 
ADD COLUMN reminders INTEGER[] DEFAULT ARRAY[15]::INTEGER[];

-- Create index on reminders for potential future queries
CREATE INDEX idx_events_reminders ON events USING GIN (reminders);
