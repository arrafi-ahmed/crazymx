-- Migration: Add timezone columns to registration table
-- Date: 2025-01-15
-- Purpose: Move timezone data from additional_fields JSONB to dedicated columns

-- Add timezone columns to registration table
ALTER TABLE registration
ADD COLUMN IF NOT EXISTS user_timezone VARCHAR(100) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS timezone_offset INT DEFAULT 0;

-- Migrate existing data from additional_fields to new columns (if any exists)
UPDATE registration
SET user_timezone = COALESCE(additional_fields->>'userTimezone', 'UTC'),
    timezone_offset = COALESCE((additional_fields->>'timezoneOffset')::int, 0)
WHERE additional_fields IS NOT NULL 
  AND additional_fields->>'userTimezone' IS NOT NULL;

-- Optional: Remove timezone data from additional_fields to clean up
UPDATE registration
SET additional_fields = additional_fields - 'userTimezone' - 'timezoneOffset'
WHERE additional_fields IS NOT NULL
  AND (additional_fields ? 'userTimezone' OR additional_fields ? 'timezoneOffset');

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_registration_user_timezone ON registration(user_timezone);

-- Verify migration
SELECT 
    COUNT(*) as total_registrations,
    COUNT(user_timezone) as with_timezone,
    COUNT(DISTINCT user_timezone) as unique_timezones
FROM registration;

