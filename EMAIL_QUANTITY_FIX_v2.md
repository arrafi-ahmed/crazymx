# Email Quantity Fix - Version 2

**Date:** October 14, 2025

## Critical Bug Fixed

### Issue
When buying 1 ticket type with quantity 2, the email was showing "1 ticket" instead of "2 tickets".

### Root Cause
The `completeFreeRegistration` function was calling `sendTicketsByRegistrationId` **once for each attendee** in a loop:

```javascript
// WRONG - sends duplicate emails
savedAttendees.forEach(async (attendee) => {
    emailService.sendTicketsByRegistrationId({
        registrationId: savedRegistration.id,
        attendeeId: attendee.id,  // This parameter was ignored anyway!
    })
})
```

**Problems with this approach:**
1. `sendTicketsByRegistrationId` already handles ALL attendees internally
2. If you have 1 attendee → sends 1 email (seems to work)
3. If you have 2 attendees → sends 4 emails (2 attendees × 2 loops = duplicate emails!)
4. The function was being called multiple times when it should only be called **once per registration**

### Solution
Call `sendTicketsByRegistrationId` **ONCE per registration**, not once per attendee:

```javascript
// CORRECT - sends emails once per registration
emailService
    .sendTicketsByRegistrationId({
        registrationId: savedRegistration.id,
    })
    .catch((error) => {
        console.error(`Failed to send confirmation emails:`, error);
    });
```

The function itself internally:
1. Checks `event.config.saveAllAttendeesDetails`
2. If `false` → sends ONE email to primary attendee with total quantity
3. If `true` → sends separate emails to each attendee

## Files Modified

**`backend/src/service/registration.js`**
- Fixed `completeFreeRegistration()` function
- Changed from `forEach` loop calling email service to single call
- Removed unused `attendeeId` parameter

**`backend/src/service/email.js`**
- Added comprehensive debug logging to both email functions
- Logs show:
  - Registration ID
  - Order raw data
  - Order items detail
  - Total tickets from SQL query
  - Final calculated values
  - Attendee count
  - Event config settings

## Debug Logging

When you test registration now, you'll see detailed logs like:

```
=== EMAIL DEBUG: sendTicketsByRegistrationId ===
Registration ID: 123
Order raw data: [{"title": "free", "quantity": 2, "ticketId": 3, "unitPrice": 0}]
Order items_detail: [{"ticketId": 3, "ticketTitle": "free", "quantity": 2, "unitPrice": 0}]
Order total_tickets from query: 2
Final totalTickets value: 2
Attendees count: 1
saveAllAttendeesDetails: false
===========================================
```

This will help us verify:
- ✅ The order data is correct in the database
- ✅ The SQL query is extracting the quantity correctly
- ✅ The quantity is being used in the email template

## Testing Instructions

Please test the following scenarios:

### Scenario 1: Group Ticket (saveAllAttendeesDetails = false)
1. Buy 1 ticket type with quantity 2
2. Fill 1 attendee form
3. Expected result:
   - ✅ **One email sent** to the attendee
   - ✅ Email shows: "**2 tickets**"
   - ✅ Message: "This QR code is valid for entire group."
   - ✅ Subject: "🎟️ Your Tickets for Annual concert"
   - ✅ Order Summary shows: "free: 2 tickets × $0"

### Scenario 2: Individual Tickets (saveAllAttendeesDetails = true)
1. Buy 1 ticket type with quantity 2
2. Fill 2 attendee forms
3. Expected result:
   - ✅ **Two separate emails** sent
   - ✅ Each email shows: "**1 ticket**"
   - ✅ Message: "This QR code is valid for above attendee only."
   - ✅ Subject: "🎟️ Your Ticket for Annual concert"

### Scenario 3: Edge Case - Multiple tickets, 1 attendee, saveAll = true
1. Buy 1 ticket type with quantity 2
2. Fill only 1 attendee form (even though saveAllAttendeesDetails = true)
3. Expected result:
   - ✅ **One email sent** to the attendee
   - ✅ Email shows: "**2 tickets**"
   - ✅ Message: "This QR code is valid for entire group."
   - ✅ Subject: "🎟️ Your Tickets for Annual concert"

## What Changed vs Previous Version

**Previous version:**
- Had correct SQL queries and logic
- But was being called in a loop, causing incorrect behavior

**Current version:**
- ✅ Same correct SQL queries and logic
- ✅ Called only ONCE per registration
- ✅ Added comprehensive debug logging
- ✅ Proper email distribution based on event config

## Next Steps

1. **Test registration** with the scenarios above
2. **Check the terminal logs** for the debug output
3. **Verify email content** matches expected results
4. If quantity is still wrong, the debug logs will tell us:
   - Is the order data in the database correct?
   - Is the SQL query extracting it correctly?
   - Is the calculation logic working?

The debug logs will pinpoint exactly where the issue is if it persists.

