-- Migration script to make end_datetime nullable for single day events
-- Run this script to update the database schema

-- Step 1: Make end_datetime nullable
ALTER TABLE event ALTER COLUMN end_datetime DROP NOT NULL;

-- Step 2: Update existing single day events to have null end_datetime
-- This assumes you have already migrated the isSingleDayEvent field to config
UPDATE event 
SET end_datetime = NULL 
WHERE config->>'isSingleDayEvent' = 'true' 
  AND end_datetime IS NOT NULL;

-- Verify the migration
SELECT 
    id, 
    name, 
    start_datetime,
    end_datetime,
    config->>'isSingleDayEvent' as is_single_day_event,
    config->>'isAllDay' as is_all_day
FROM event 
ORDER BY id 
LIMIT 10;
