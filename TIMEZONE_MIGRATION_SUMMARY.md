# Timezone Data Migration Summary

## Changes Made

### 1. ✅ **Database Schema Update**

**Added dedicated timezone columns to `registration` table:**

```sql
ALTER TABLE registration
ADD COLUMN user_timezone VARCHAR(100) DEFAULT 'UTC',
ADD COLUMN timezone_offset INT DEFAULT 0;
```

**Why:** 
- `additional_fields` is meant for registration form data (organization, sector, etc.)
- Timezone is system metadata, not user input
- Dedicated columns are easier to query and index

---

### 2. ✅ **Frontend Changes**

**File:** `frontend/src/pages/[slug]/index.vue`

**Before:**
```javascript
registration.additionalFields = {
    ...registration.additionalFields,
    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
}
```

**After:**
```javascript
registration.userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
registration.timezoneOffset = new Date().getTimezoneOffset()
```

**Result:** Timezone data sent as separate fields, not in `additionalFields` object.

---

### 3. ✅ **Backend Service Updates**

#### A. Registration Service (`backend/src/service/registration.js`)

**1. Updated `save()` function:**
```javascript
// Before
exports.save = async ({eventId, additionalFields, status = false})

// After  
exports.save = async ({eventId, additionalFields, status = false, userTimezone, timezoneOffset})
```

**2. Updated INSERT query:**
```sql
-- Before
INSERT INTO registration (event_id, additional_fields, status)
VALUES ($1, $2, $3)

-- After
INSERT INTO registration (event_id, additional_fields, user_timezone, timezone_offset, status)
VALUES ($1, $2, $3, $4, $5)
```

**3. Updated `getRegistrationWEventWExtrasPurchase()` to include timezone:**
```javascript
'userTimezone', r.user_timezone,
'timezoneOffset', r.timezone_offset,
```

**4. Updated `defaultSave()` to pass timezone:**
```javascript
const result = await exports.save({
    eventId: payload.eventId,
    additionalFields: payload.additionalFields,
    status: payload.status,
    userTimezone: payload.userTimezone,        // ← New
    timezoneOffset: payload.timezoneOffset,    // ← New
});
```

**5. Updated `completeFreeRegistration()` to pass timezone:**
```javascript
const savedRegistration = await exports.save({
    eventId,
    status: true,
    additionalFields: registration?.additionalFields || {},
    userTimezone: registration?.userTimezone,        // ← New
    timezoneOffset: registration?.timezoneOffset,    // ← New
});
```

#### B. Email Service (`backend/src/service/email.js`)

**Before:**
```javascript
const userTimezone = registration.additionalFields?.userTimezone || 'UTC';
```

**After:**
```javascript
const userTimezone = registration.userTimezone || 'UTC';
```

**All three email functions updated:**
- `sendTicketByAttendeeId()`
- `sendTicketsByRegistrationId()` (group tickets)
- `sendTicketsByRegistrationId()` (individual tickets)

---

### 4. ✅ **Migration File Created**

**File:** `backend/migration-add-timezone-columns.sql`

**What it does:**
1. Adds `user_timezone` and `timezone_offset` columns
2. Migrates existing data from `additional_fields` JSONB to new columns
3. Cleans up old timezone data from `additional_fields`
4. Creates index for better query performance
5. Verifies migration with count query

**To run migration:**
```bash
psql $DATABASE_URL -f backend/migration-add-timezone-columns.sql
```

---

## Data Flow

### Registration Process

```
1. Frontend captures timezone:
   Intl.DateTimeFormat().resolvedOptions().timeZone
   → "Asia/Jakarta"

2. Frontend sends to backend:
   {
     userTimezone: "Asia/Jakarta",
     timezoneOffset: -420,
     additionalFields: { organization: "...", sector: "..." }
   }

3. Backend saves to database:
   INSERT INTO registration (
     user_timezone,      ← Dedicated column
     timezone_offset,    ← Dedicated column  
     additional_fields   ← Only form data
   )

4. Email service reads:
   registration.userTimezone  ← From column
   → Formats dates in user's timezone
```

---

## Benefits

### ✅ **Clean Separation**
- `additional_fields` = User form data (organization, sector, etc.)
- `user_timezone` / `timezone_offset` = System metadata

### ✅ **Better Performance**
- Indexed column for faster queries
- No JSONB extraction overhead

### ✅ **Type Safety**
- `VARCHAR(100)` enforces data type
- `INT` for offset ensures numeric values

### ✅ **Easier Queries**
```sql
-- Before (slow)
SELECT * FROM registration 
WHERE additional_fields->>'userTimezone' = 'Asia/Jakarta'

-- After (fast with index)
SELECT * FROM registration 
WHERE user_timezone = 'Asia/Jakarta'
```

---

## Testing Checklist

- [ ] **Run migration SQL file**
- [ ] **Test new registration:**
  - [ ] Verify `user_timezone` and `timezone_offset` saved correctly
  - [ ] Verify `additional_fields` doesn't contain timezone data
- [ ] **Test email generation:**
  - [ ] Dates show in correct user timezone
  - [ ] Registration time shows in user timezone
  - [ ] Event dates show in user timezone
- [ ] **Test with different timezones:**
  - [ ] PST (America/Los_Angeles)
  - [ ] EST (America/New_York)
  - [ ] GMT+7 (Asia/Jakarta)
  - [ ] GMT+8 (Asia/Manila)
- [ ] **Verify old registrations:**
  - [ ] Migration moved data from `additional_fields` to dedicated columns
  - [ ] Old emails still work with migrated data

---

## Files Modified

1. ✅ `backend/schema-pg.sql` - Added columns to CREATE TABLE
2. ✅ `backend/migration-add-timezone-columns.sql` - Migration script (NEW)
3. ✅ `frontend/src/pages/[slug]/index.vue` - Save to dedicated fields
4. ✅ `backend/src/service/registration.js` - Updated save() and queries
5. ✅ `backend/src/service/email.js` - Read from dedicated columns

---

## Rollback Plan (if needed)

```sql
-- 1. Copy data back to additional_fields
UPDATE registration
SET additional_fields = additional_fields || 
    jsonb_build_object(
        'userTimezone', user_timezone,
        'timezoneOffset', timezone_offset
    )
WHERE user_timezone IS NOT NULL;

-- 2. Drop columns
ALTER TABLE registration
DROP COLUMN user_timezone,
DROP COLUMN timezone_offset;
```

---

**Status:** ✅ Complete - Ready for testing  
**Date:** January 2025  
**Breaking Changes:** None (backward compatible with defaults)

