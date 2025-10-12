# End DateTime Nullable Migration Summary

## Overview
Updated the database schema and application logic to make `end_datetime` nullable for single day events, allowing for more flexible event scheduling.

## Changes Made

### Database Schema
- **File**: `backend/schema-pg.sql`
- **Changes**: Made `end_datetime` column nullable (removed NOT NULL constraint)
- **Migration**: Created `backend/migration-make-end-datetime-nullable.sql` to update existing database

### Backend Changes

#### Event Service (`backend/src/service/event.js`)
- **INSERT Query**: Updated to handle null `endDatetime` values
- **UPDATE Query**: Updated to handle null `endDatetime` values  
- **getAllActiveEvents Query**: Updated logic to handle null `end_datetime`:
  - For events with `end_datetime`: Check if current date is before end date
  - For events without `end_datetime` (single day): Check if current date is on or after start date

#### Email Service (`backend/src/service/email.js`)
- Fixed remaining reference to use `event?.config?.isSingleDayEvent` instead of `event?.isSingleDayEvent`
- Existing date display logic already handles null `endDate` properly

### Frontend Changes

#### Event Edit Page (`frontend/src/pages/event/[eventId]/edit/index.vue`)
- **Form Submission**: Updated to send empty string for null `endDatetime` values
- **Logic**: Already updated to set `endDatetime` to null for single day events

#### Event Display Components
- **Event Landing** (`frontend/src/pages/[slug]/index.vue`): Already handles null `endDate`
- **Main Index** (`frontend/src/pages/index.vue`): Already handles null `endDate` 
- **Admin Dashboard** (`frontend/src/pages/dashboard/admin/index.vue`): Already handles null `endDate`

## Database Migration Steps

1. **Backup your database** before running the migration
2. Run the migration script: `psql -d your_database -f backend/migration-make-end-datetime-nullable.sql`
3. Verify the migration by checking that single day events have null `end_datetime`
4. Test the application to ensure all functionality works correctly

## Logic for Single Day Events

### Backend Logic
- When `config.isSingleDayEvent` is true, `endDatetime` is set to null
- Database queries handle null `end_datetime` appropriately
- Event activity checks use start date for single day events

### Frontend Logic
- Single day events show only the start date
- Date range pickers are hidden for single day events
- All display components gracefully handle null end dates

## Benefits

1. **Cleaner Data Model**: Single day events don't need artificial end dates
2. **Better User Experience**: Clearer distinction between single and multi-day events
3. **Flexible Scheduling**: Supports events that don't have a defined end time
4. **Consistent Logic**: All date handling is now consistent across the application

## Testing Checklist

- [ ] Create single day event - should have null end_datetime
- [ ] Create multi-day event - should have both start and end datetime
- [ ] Edit single day event - should preserve null end_datetime
- [ ] Event display shows correct dates for both types
- [ ] Email templates handle both event types correctly
- [ ] Admin dashboard displays events correctly
- [ ] Event queries work for both active single and multi-day events
