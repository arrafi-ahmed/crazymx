# Ticket Quantity and Registration Error Fix

**Date:** October 14, 2025

## Issues Fixed

### 1. Incorrect Ticket Quantity in Emails
**Problem:** Emails were showing "1 ticket" even when 2 tickets were purchased from the order.

**Root Cause:** The email service was hardcoding `quantity: 1` for individual attendee emails, instead of checking the actual quantity from the orders table.

**Solution:** Updated the email logic to:
- Fetch the total ticket quantity from the `orders.items` JSONB column
- Check if there's only 1 attendee but multiple tickets (group ticket scenario)
- Show the correct quantity based on this logic:
  - **1 attendee + 2+ tickets = Group ticket** → Show total quantity (e.g., "2 tickets") with message "This QR code is valid for entire group."
  - **Multiple attendees = Individual tickets** → Show quantity 1 per attendee with message "This QR code is valid for above attendee only."

**Files Modified:**
- `backend/src/service/email.js`
  - Updated `sendTicketByAttendeeId()` to fetch order details and calculate correct quantity
  - Updated `sendTicketsByRegistrationId()` to handle group ticket scenario properly
  - Both functions now correctly show ticket quantity from the order, not just attendee count

### 2. Registration Error
**Problem:** `CustomError: Failed to complete free registration` error during registration.

**Root Cause:** The database was missing the new `user_timezone` and `timezone_offset` columns that were added to the `registration` table schema.

**Solution:** 
- Created and ran the database migration script `migration-add-timezone-columns.sql`
- The migration added:
  - `user_timezone VARCHAR(100) DEFAULT 'UTC'`
  - `timezone_offset INT DEFAULT 0`
  - Index on `user_timezone` for better query performance
  - Migrated existing timezone data from `additional_fields` JSONB to dedicated columns

## How It Works Now

### Email Quantity Logic

```javascript
// Determine if this is a group ticket scenario
const isGroupTicket = totalTickets > 1 && attendeeCount === 1;

// Set the quantity
const attendeeQuantity = isGroupTicket ? totalTickets : 1;

// Set the message
const groupMsg = isGroupTicket 
    ? `This QR code is valid for entire group.`
    : `This QR code is valid for above attendee only.`;
```

### Example Scenarios

**Scenario 1: Buy 2 tickets, fill 1 attendee form (saveAllAttendeesDetails = false)**
- 1 attendee created
- 1 email sent showing: "2 tickets"
- Message: "This QR code is valid for entire group."
- Subject: "🎟️ Your Tickets for Annual concert"

**Scenario 2: Buy 2 tickets, fill 2 attendee forms (saveAllAttendeesDetails = true)**
- 2 attendees created
- 2 separate emails, each showing: "1 ticket"
- Message: "This QR code is valid for above attendee only."
- Subject: "🎟️ Your Ticket for Annual concert"

**Scenario 3: Buy 1 ticket**
- 1 attendee created
- 1 email showing: "1 ticket"
- Message: "This QR code is valid for above attendee only."
- Subject: "🎟️ Your Ticket for Annual concert"

## Database Changes

The `registration` table now has:
- `user_timezone`: Stores the user's timezone (e.g., "Asia/Jakarta", "America/New_York")
- `timezone_offset`: Stores the timezone offset in minutes (e.g., -420 for GMT+7)

These columns are populated during registration from the frontend's timezone detection:
```javascript
registration.userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
registration.timezoneOffset = new Date().getTimezoneOffset()
```

## Testing

To verify the fix:
1. **Test Group Ticket (1 attendee, 2 tickets):**
   - Register for a free event with 2 tickets
   - Fill only 1 attendee form
   - Check email shows "2 tickets" with group message

2. **Test Individual Tickets (2 attendees, 2 tickets):**
   - Register with saveAllAttendeesDetails enabled
   - Fill 2 attendee forms
   - Check each email shows "1 ticket" with individual message

3. **Verify Database:**
   ```sql
   SELECT id, user_timezone, timezone_offset FROM registration ORDER BY id DESC LIMIT 5;
   ```

## Notes

- The email subject is now dynamic: plural "Tickets" for multiple tickets, singular "Ticket" for one
- All date/time displays in emails use the user's captured timezone
- The Order Summary section in the email shows the breakdown from `orders.items`
- Migration is idempotent (safe to run multiple times) using `IF NOT EXISTS`

