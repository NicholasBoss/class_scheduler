-- Add color columns to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7);

-- Add color column to semester_calendars table  
-- Use Graphite (#616161) as default - a neutral gray that won't interfere with event colors
ALTER TABLE semester_calendars 
ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7) DEFAULT '#616161';
