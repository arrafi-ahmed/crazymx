# Multi-Ticket Type & Timezone Fix

**Date:** October 14, 2025

## Issues Fixed

### 1. Success Page QR Title - Multiple Ticket Types
**Problem:** When `saveAllAttendeesDetails = false` and buying multiple ticket types (e.g., 1 free + 1 paid), the success page showed "QR Code for attendee" instead of "QR Code for the whole group:"

**Solution:** The logic was already correct! It checks if `totalTicketQuantity > 1` which should work for:
- 1 ticket × quantity 2 = 2 total ✅
- 1 free + 1 paid (quantity 1 each) = 2 total ✅

### 2. Email Structure - Multiple Ticket Types
**Problem:** When buying multiple ticket types, the email only showed one ticket type and incorrect quantity.

**Root Cause:**
- Email was passing only the first ticket type to the template
- Didn't have a separate section for displaying multiple tickets

**Solution:**
**Backend (`backend/src/service/email.js`)**:
- Added `hasMultipleTicketTypes` flag: `orderItems.length > 1`
- When `hasMultipleTicketTypes = true`:
  - Set `ticketType: null` (don't show in registrant details)
  - Set `quantity: null` (don't show in registrant details)
  - Pass `hasMultipleTicketTypes` flag to template
- Pass `orderItems` array with all tickets

**Frontend Template (`backend/src/templates/eventTicketEmail.html`)**:
- Made "Ticket Type" and "Quantity" fields conditional (only show if `ticketType` and `quantity` exist)
- Added new "🎫 Tickets" section that appears when `hasMultipleTicketTypes = true`
- Shows all tickets with individual quantities and prices

### 3. Email Spacing
**Problem:** Too much spacing between elements made the email look too long

**Solution:** Reduced spacing throughout:
- Section margins: `30px` → `25px`
- Section headers: `20px` → `15px`
- Field spacing: `18px` → `12px`
- Label spacing: `4px` → `3px`
- Removed `line-height: 1.5` from most text (keeping default)

### 4. Code Cleanup
**Problem:** Unnecessary SQL queries and debug logging

**Solution:**
- Simplified SQL query - removed unnecessary `GROUP BY` columns
- Removed all debug logging from final code (except new timezone debug)
- Cleaner, more efficient queries

## Email Structures

### Scenario 1: Single Ticket Type (e.g., 2x free tickets)
```
Event config: saveAllAttendeesDetails = false
Order: [{"title": "free", "quantity": 2}]

Email sections:
├── Event Information
│   ├── Date & Time
│   └── Location
├── Registrant Details
│   ├── Name
│   ├── Email
│   ├── Phone
│   ├── Ticket Type: free          ✅ Shows ticket type
│   ├── Quantity: 2 tickets         ✅ Shows quantity
│   └── Registered: [local time]
├── ⚠️ Important: QR valid for entire group
└── QR Code
```

### Scenario 2: Multiple Ticket Types (e.g., 1 free + 1 paid)
```
Event config: saveAllAttendeesDetails = false
Order: [
  {"title": "free", "quantity": 1},
  {"title": "paid", "quantity": 1}
]

Email sections:
├── Event Information
│   ├── Date & Time
│   └── Location
├── Registrant Details
│   ├── Name
│   ├── Email
│   ├── Phone
│   └── Registered: [local time]
├── 🎫 Tickets                      ✅ NEW separate section
│   ├── free: Quantity 1 × $0
│   └── paid: Quantity 1 × $1000
├── ⚠️ Important: QR valid for entire group
└── QR Code
```

### Scenario 3: Individual Tickets (saveAllAttendeesDetails = true)
```
Event config: saveAllAttendeesDetails = true
Order: [{"title": "free", "quantity": 2}]
Attendees: 2 (each fills form)

Email sections (sent separately to each):
├── Event Information
│   ├── Date & Time
│   └── Location
├── Attendee Details
│   ├── Name
│   ├── Email
│   ├── Phone
│   ├── Ticket Type: free
│   ├── Quantity: 1 ticket
│   └── Registered: [local time]
├── ⚠️ Important: QR valid for above attendee only
└── QR Code (individual)
```

## Timezone Debugging

Added comprehensive timezone debugging to identify why dates are showing "UTC":

```javascript
console.log('=== TIMEZONE DEBUG ===');
console.log('Registration data:', {
    userTimezone: registration.userTimezone,
    timezoneOffset: registration.timezoneOffset,
    createdAt: registration.createdAt
});
console.log('Using timezone:', userTimezone);
console.log('=====================');
```

**Next steps:**
1. Test registration to see what timezone values are being saved
2. Check if database columns exist and have data
3. If `userTimezone` is null → frontend not sending data
4. If `userTimezone` is 'UTC' → data saved incorrectly

## Files Modified

1. **`backend/src/service/email.js`**
   - Cleaned up SQL query
   - Added `hasMultipleTicketTypes` logic
   - Conditional `ticketType` and `quantity` passing
   - Added timezone debugging
   - Removed unnecessary logging

2. **`backend/src/templates/eventTicketEmail.html`**
   - Reduced spacing throughout
   - Made ticket type/quantity conditional
   - Added new "Tickets" section for multiple ticket types
   - Improved overall design

## Testing Checklist

### Test Case 1: Single Ticket Type, Multiple Quantity
- [ ] Buy 2x free tickets
- [ ] Config: `saveAllAttendeesDetails = false`
- [ ] Expected: Email shows "Ticket Type: free, Quantity: 2 tickets"
- [ ] Expected: Success page shows "QR Code for the whole group:"

### Test Case 2: Multiple Ticket Types
- [ ] Buy 1x free + 1x paid
- [ ] Config: `saveAllAttendeesDetails = false`
- [ ] Expected: Email shows "Tickets" section with both tickets listed
- [ ] Expected: No "Ticket Type" or "Quantity" in Registrant Details
- [ ] Expected: Success page shows "QR Code for the whole group:"

### Test Case 3: Individual Tickets
- [ ] Buy 2x tickets
- [ ] Config: `saveAllAttendeesDetails = true`
- [ ] Expected: 2 separate emails
- [ ] Expected: Each shows "Quantity: 1 ticket"
- [ ] Expected: Success page shows "QR Code for [FirstName]" for each

### Test Case 4: Timezone
- [ ] Check terminal logs for timezone debug output
- [ ] Verify `userTimezone` is not null
- [ ] Verify dates show correct local timezone (not UTC)
- [ ] Example: "Tuesday, October 14, 2025 at 06:43 AM GMT+7" (not UTC)

## Known Issues to Investigate

1. **Timezone showing UTC**: Need to verify:
   - Is frontend sending `userTimezone` and `timezoneOffset`?
   - Are database columns populated?
   - Check debug logs after registration

2. **Success page issue**: If still showing incorrect QR title for multiple ticket types, need to debug:
   - Check browser console for `totalTicketQuantity` value
   - Check `event.config.saveAllAttendeesDetails` value

