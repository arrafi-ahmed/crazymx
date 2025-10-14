# Success Page Event Config Fix

**Date:** October 14, 2025

## Issue
When `saveAllAttendeesDetails = false` and buying multiple ticket types (e.g., 1 free + 1 paid), the success page showed:
- ❌ "QR Code for attendee" 
- ✅ Should show: "QR Code for the whole group:"

## Root Cause
The success page has two different data retrieval paths:

### Path 1: Free Registration (registrationId)
```javascript
GET /registration/getFreeRegistrationConfirmation?registrationId=123
```
✅ **This path was working** - Already included event config

### Path 2: Paid Registration (sessionId)
```javascript
GET /temp-registration/success/:sessionId
```
❌ **This path was broken** - Did NOT include event config

The `getTempRegistrationWAttendees` function returned:
- ✅ `tr.*` (temp_registration data)
- ✅ `attendees` (attendee list)
- ❌ NO event config

Without event config, the frontend couldn't check `event.config.saveAllAttendeesDetails` to determine if it's a group ticket.

## Solution

### Backend Fix
**File:** `backend/src/service/tempRegistration.js`

Updated `getTempRegistrationWAttendees` to JOIN with event table and include config:

```sql
SELECT tr.*,
       jsonb_build_object(
           'id', e.id,
           'name', e.name,
           'config', e.config          -- ✅ Added event config
       ) AS event,
       COALESCE(...) AS attendees
FROM temp_registration tr
     JOIN event e ON tr.event_id = e.id  -- ✅ Added JOIN
     LEFT JOIN attendees a ON tr.session_id = a.session_id
WHERE tr.session_id = $1
GROUP BY tr.session_id, tr.event_id, tr.registration, 
         tr.selected_tickets, tr.orders, 
         e.id, e.name, e.config;  -- ✅ Added to GROUP BY
```

### Frontend Fix
**File:** `frontend/src/pages/[slug]/success.vue`

Ensured event data is properly assigned:

```javascript
const response = await $axios.get(`/temp-registration/success/${sessionId.value}`)
tempRegistration.value = {
  ...response.data.payload,
  event: response.data.payload.event || null,  // ✅ Explicitly include event
}
```

## How It Works Now

### Success Page Logic
```javascript
// Calculate total ticket quantity from order
const totalTicketQuantity = computed(() => {
  return purchasedTickets.value.reduce((sum, ticket) => sum + ticket.quantity, 0)
})

// Check if this is a group ticket scenario
const isGroupTicket = computed(() => {
  const saveAll = tempRegistration.value?.event?.config?.saveAllAttendeesDetails
  return totalTicketQuantity.value > 1 && (saveAll === false || saveAll === 'false')
})

// Get QR code title
function getQrTitle(attendee) {
  if (isGroupTicket.value) {
    return 'QR Code for the whole group:'  // ✅ Now works!
  }
  return `QR Code for ${attendee.firstName}`
}
```

### Test Cases

**Scenario 1: Single ticket type, quantity 2**
```javascript
saveAllAttendeesDetails: false
orders.items: [{"title": "free", "quantity": 2}]
totalTicketQuantity: 2
isGroupTicket: true (2 > 1 && false)
Result: "QR Code for the whole group:" ✅
```

**Scenario 2: Multiple ticket types, quantity 1 each**
```javascript
saveAllAttendeesDetails: false
orders.items: [
  {"title": "free", "quantity": 1},
  {"title": "paid", "quantity": 1}
]
totalTicketQuantity: 2 (1 + 1)
isGroupTicket: true (2 > 1 && false)
Result: "QR Code for the whole group:" ✅
```

**Scenario 3: Individual tickets**
```javascript
saveAllAttendeesDetails: true
orders.items: [{"title": "free", "quantity": 2}]
totalTicketQuantity: 2
isGroupTicket: false (2 > 1 && true = false)
Result: "QR Code for John" ✅
```

**Scenario 4: Single ticket**
```javascript
saveAllAttendeesDetails: false
orders.items: [{"title": "free", "quantity": 1}]
totalTicketQuantity: 1
isGroupTicket: false (1 > 1 = false)
Result: "QR Code for John" ✅
```

## Files Modified

1. **`backend/src/service/tempRegistration.js`**
   - Updated `getTempRegistrationWAttendees()` query
   - Added JOIN with event table
   - Included event config in response

2. **`frontend/src/pages/[slug]/success.vue`**
   - Explicitly assign event data from response
   - Ensures event config is available for both paths

## Testing

### Test for Free Registration
1. Create event with `saveAllAttendeesDetails = false`
2. Buy 1 free + 1 paid ticket (or 2x any ticket)
3. Complete FREE registration
4. Success page should show: **"QR Code for the whole group:"** ✅

### Test for Paid Registration
1. Create event with `saveAllAttendeesDetails = false`
2. Buy 1 free + 1 paid ticket (or 2x any ticket)
3. Complete PAID registration (with Stripe)
4. Success page should show: **"QR Code for the whole group:"** ✅

### Verification
Open browser console and check:
```javascript
console.log(tempRegistration.value?.event?.config)
// Should show: { saveAllAttendeesDetails: false, ... }

console.log(totalTicketQuantity.value)
// Should show: 2

console.log(isGroupTicket.value)
// Should show: true
```

## Related Changes
This fix complements the earlier email fixes:
- ✅ Email correctly shows multiple ticket types
- ✅ Email shows correct quantities
- ✅ Email uses user's local timezone
- ✅ Success page now shows correct QR title

All components now work consistently! 🎉

