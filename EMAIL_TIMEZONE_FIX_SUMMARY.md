# Email Timezone and Content Fix - Implementation Summary

## Problem Statement

Customer reported incorrect ticket details in confirmation emails:

**Before (Incorrect):**
```
🗓️ Date: 10/10/2025 04:01 - 10/21/2025 03:59
📍 Location: NYC
🎫 Ticket Type: free
🔢 Quantity: 0
⏰ Registration time: 14/10/2025 3:31
```

**Issues:**
1. ❌ Wrong date format (server timezone instead of user timezone)
2. ❌ Ticket quantity showing 0
3. ❌ Registration time in wrong timezone
4. ❌ No order details (how many tickets purchased)
5. ❌ Missing group ticket messaging when `saveAllAttendeesDetails = false`
6. ❌ No timezone information in footer

## Solution Strategy

Instead of relying on server timezone, we now:
1. **Capture user timezone** during registration (using browser's `Intl` API)
2. **Store timezone** with registration data
3. **Convert all dates** to user's timezone when displaying in emails
4. **Show order details** from orders table
5. **Properly handle** `saveAllAttendeesDetails` configuration

## Changes Made

### 1. Frontend - Timezone Capture (`frontend/src/pages/[slug]/index.vue`)

**Added timezone detection during registration:**

```javascript
async function submitRegistration () {
  // Capture user timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  
  registration.additionalFields = {
    ...registration.additionalFields,
    userTimezone,  // e.g., "America/Phoenix"
    timezoneOffset: new Date().getTimezoneOffset(),  // e.g., 420
  }
  // ... save registration
}
```

**Stored Data Example:**
```json
{
  "additionalFields": {
    "userTimezone": "America/Phoenix",
    "timezoneOffset": 420
  }
}
```

### 2. Backend - Timezone-Aware Date Utilities (`backend/src/others/dateUtils.js`)

**New utility functions using `Intl.DateTimeFormat`:**

- `formatInTimezone(utcDate, timezone, options)` - Format date in specific timezone
- `formatLongDate(utcDate, timezone)` - Human-friendly format: "Saturday, November 19, 2025 at 6:30 PM MST"
- `formatDateOnly(utcDate, timezone)` - Date only: "11/19/2025"
- `formatTimeOnly(utcDate, timezone)` - Time only: "6:30 PM"
- `formatEventDateTimeRange(start, end, timezone, config)` - Smart event date formatting
- `getTimezoneAbbreviation(timezone)` - Get abbreviation: "MST", "PST", etc.

**How it works:**
```javascript
// Database stores: "2025-11-20T01:30:00.000Z" (UTC)
// User timezone: "America/Phoenix" (MST, UTC-7)
// Output: "Wednesday, November 19, 2025 at 6:30 PM MST"

const formatted = formatLongDate(
  "2025-11-20T01:30:00.000Z",
  "America/Phoenix"
);
// Result: "Wednesday, November 19, 2025 at 6:30 PM MST"
```

### 3. Backend - Email Service Updates (`backend/src/service/email.js`)

#### A. Enhanced Data Collection

**Now queries order table for ticket details:**
```javascript
// Get order details with total tickets
const orderSql = `
  SELECT o.*, 
         jsonb_agg(...) AS items_detail,
         COALESCE(SUM((item->>'quantity')::int), 0) AS total_tickets
  FROM orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
  WHERE o.registration_id = $1
  GROUP BY o.id
`;
```

#### B. Timezone Conversion

**Extract user timezone from registration:**
```javascript
const userTimezone = registration.additionalFields?.userTimezone || 'UTC';
const timezoneAbbr = getTimezoneAbbreviation(userTimezone);

// Format all dates using user timezone
const eventDateDisplay = formatEventDateTimeRange(
  event.startDate,
  event.endDate,
  userTimezone,
  event.config || {}
);

const registrationTime = formatLongDate(registration.createdAt, userTimezone);
```

#### C. Proper `saveAllAttendeesDetails` Handling

**If `false` (group ticket - default):**
- Send **one email** to primary attendee only
- Show **total tickets** in quantity
- Display **group message**: "This QR code is valid for X tickets (entire group)"
- Include **all order items**

```javascript
if (!saveAll) {
  const html = compileTicketTemplate({
    quantity: totalTickets,  // All tickets
    isGroupTicket: true,
    groupMessage: `This QR code is valid for ${totalTickets} tickets (entire group).`,
    orderItems,  // Full order breakdown
    // ...
  });
}
```

**If `true` (individual tickets):**
- Send **separate emails** to each attendee
- Show **quantity = 1** per email
- Each gets **their own QR code**

```javascript
// For each attendee
const html = compileTicketTemplate({
  quantity: 1,  // Individual ticket
  isGroupTicket: false,
  totalTicketsInOrder: totalTickets,  // Show total for context
  // ...
});
```

### 4. Email Template Updates (`backend/src/templates/eventTicketEmail.html`)

#### A. Enhanced Layout

**Event Information Section:**
```html
<table style="background: #f9f9f9; ...">
  <tr>
    <td>
      <h3>📅 Event Information</h3>
    </td>
  </tr>
  <tr>
    <td>
      <div>🗓️ <strong>Date & Time:</strong> {{eventDateDisplay}}</div>
      <div>📍 <strong>Location:</strong> {{location}}</div>
    </td>
  </tr>
</table>
```

**Ticket Details Section:**
```html
<table style="background: #e8f5e9; ...">
  <tr>
    <td>
      <h3>🎫 Your Ticket Details</h3>
    </td>
  </tr>
  <tr>
    <td>
      <div>🎫 <strong>Ticket Type:</strong> {{ticketType}}</div>
      <div>🔢 <strong>Quantity:</strong> {{quantity}}</div>
      
      <!-- Order Summary (if available) -->
      {{#if orderItems}}
      <div>
        <strong>Order Summary:</strong>
        <ul>
          {{#each orderItems}}
          <li>{{this.ticketTitle}}: {{this.quantity}} × ${{this.unitPrice}}</li>
          {{/each}}
        </ul>
      </div>
      {{/if}}
      
      <div>⏰ <strong>Registration Time:</strong> {{registrationTime}}</div>
    </td>
  </tr>
</table>
```

#### B. Group Ticket Warning

```html
{{#if isGroupTicket}}
<div style="background: #fff3e0; border-left: 4px solid #ff9800; ...">
  <p>⚠️ Important: {{groupMessage}}</p>
</div>
{{/if}}
```

#### C. Timezone Footer

```html
<div style="background: #f0f4f8; ...">
  <p><strong>📍 Timezone Information:</strong></p>
  <p>
    All dates and times are shown in your local timezone: 
    <strong>{{userTimezone}}</strong> ({{timezoneAbbr}})
  </p>
  <p style="font-size: 11px; color: #777;">
    This timezone was detected during your registration.
  </p>
</div>
```

## Expected Email Output (After Fix)

### Example 1: Group Ticket (saveAllAttendeesDetails = false)

**To:** john@example.com (primary attendee only)

```
Your Annual Concert Tickets

Hello John Doe,

Thank you for registering for Annual Concert! We're excited to see you there.

📅 Event Information
🗓️ Date & Time: 10/10/2025 9:01 AM - 10/21/2025 8:59 AM
📍 Location: NYC

🎫 Your Ticket Details
🎫 Ticket Type: General Admission
🔢 Quantity: 3 (Group Ticket)

Order Summary:
• VIP Ticket: 1 × $50
• General Admission: 2 × $25

⏰ Registration Time: Wednesday, October 14, 2025 at 10:31 AM MST

⚠️ Important: This QR code is valid for 3 tickets (entire group).

[QR CODE]

📍 Timezone Information:
All dates and times are shown in your local timezone: America/Phoenix (MST)
This timezone was detected during your registration.
```

### Example 2: Individual Tickets (saveAllAttendeesDetails = true)

**To:** john@example.com, jane@example.com, bob@example.com (separate emails)

```
Your Annual Concert Ticket

Hello John Doe,

Thank you for registering for Annual Concert! We're excited to see you there.

📅 Event Information
🗓️ Date & Time: 10/10/2025 9:01 AM - 10/21/2025 8:59 AM
📍 Location: NYC

🎫 Your Ticket Details
🎫 Ticket Type: General Admission
🔢 Quantity: 1

Order Summary:
• General Admission: 3 × $25

⏰ Registration Time: Wednesday, October 14, 2025 at 10:31 AM MST

[QR CODE - Individual]

📍 Timezone Information:
All dates and times are shown in your local timezone: America/Phoenix (MST)
This timezone was detected during your registration.
```

## Database Schema

**No migration needed!** Timezone is stored in existing `registration.additional_fields` JSONB column:

```sql
-- registration table already has:
additional_fields JSONB

-- Stores:
{
  "userTimezone": "America/Phoenix",
  "timezoneOffset": 420,
  "organization": "...",
  "sector": "...",
  ...
}
```

## Testing Checklist

- [ ] **Timezone Detection**: Verify user timezone is captured during registration
- [ ] **Date Formatting**: Check event dates show in user's timezone
- [ ] **Registration Time**: Verify registration timestamp shows in user's timezone
- [ ] **Order Details**: Confirm ticket quantities and prices are correct
- [ ] **Group Tickets**: Test `saveAllAttendeesDetails = false`
  - [ ] Only primary attendee receives email
  - [ ] Total quantity shown correctly
  - [ ] Group message appears
  - [ ] Single QR code for entire group
- [ ] **Individual Tickets**: Test `saveAllAttendeesDetails = true`
  - [ ] Each attendee receives separate email
  - [ ] Each email shows quantity = 1
  - [ ] Each has unique QR code
- [ ] **Timezone Footer**: Verify timezone info appears in footer
- [ ] **Multi-timezone**: Test users from different timezones
  - [ ] PST user sees PST times
  - [ ] EST user sees EST times
  - [ ] UTC user sees UTC times

## Files Modified

1. ✅ `frontend/src/pages/[slug]/index.vue` - Added timezone capture
2. ✅ `backend/src/others/dateUtils.js` - New timezone utilities (created)
3. ✅ `backend/src/service/email.js` - Updated email logic with timezone conversion and order details
4. ✅ `backend/src/templates/eventTicketEmail.html` - Enhanced template with new layout and footer

## Benefits

✅ **Accurate Dates**: Users see dates/times in their local timezone  
✅ **Clear Ticket Info**: Quantity and order details always correct  
✅ **Group Clarity**: Clear messaging when QR covers multiple tickets  
✅ **Transparency**: Timezone info displayed in footer  
✅ **Better UX**: Professional, well-formatted emails  
✅ **No Server Dependency**: Works regardless of server timezone  

## Backward Compatibility

- **Old registrations** (without timezone): Fall back to UTC
- **Existing data**: No migration needed
- **Email templates**: Handlebars gracefully handles missing variables

## Future Enhancements (Optional)

1. **Manual timezone selection**: Allow users to override detected timezone
2. **Timezone in event config**: Store preferred display timezone per event
3. **iCal attachment**: Generate calendar file with correct timezone
4. **PDF tickets**: Generate PDF with QR code and timezone-aware dates

---

**Implementation Date**: January 2025  
**Status**: ✅ Complete - Ready for testing  
**Migration Required**: None (uses existing JSONB field)

