# Registration Success Page - Group Ticket QR Title Update

**Date:** October 14, 2025

## Issue
The registration success page was showing "QR Code for [Name]" for all tickets, even when it's a group ticket where the QR code is valid for the entire group.

## Solution
Updated the success page to dynamically show:
- **"QR Code for the whole group:"** when ticket quantity > 1 AND `event.config.saveAllAttendeesDetails = false`
- **"QR Code for [FirstName]"** for individual tickets

## Files Modified

### Backend
**`backend/src/service/registration.js`**
- Updated `getFreeRegistrationConfirmation()` function to include event data with config in the response
- Added event object to the return data structure:
  ```javascript
  event: {
      id: event.id,
      name: event.name,
      config: event.config,
  }
  ```

### Frontend
**`frontend/src/pages/[slug]/success.vue`**

1. **Updated data structure** to store event data from API response:
   ```javascript
   tempRegistration.value = {
       attendees: validAttendees,
       selectedTickets: selectedTickets,
       orders: response.data.payload.order,
       registration: response.data.payload.registration,
       event: response.data.payload.event,  // Added
       eventId: response.data.payload.registration?.eventId,
   }
   ```

2. **Added computed properties**:
   ```javascript
   // Calculate total ticket quantity
   const totalTicketQuantity = computed(() => {
       return purchasedTickets.value.reduce((sum, ticket) => sum + ticket.quantity, 0)
   })

   // Check if this is a group ticket scenario
   const isGroupTicket = computed(() => {
       const saveAll = tempRegistration.value?.event?.config?.saveAllAttendeesDetails
       return totalTicketQuantity.value > 1 && (saveAll === false || saveAll === 'false')
   })
   ```

3. **Added helper function**:
   ```javascript
   function getQrTitle(attendee) {
       if (isGroupTicket.value) {
           return 'QR Code for the whole group:'
       }
       return `QR Code for ${attendee.firstName}`
   }
   ```

4. **Updated template** to use dynamic QR title:
   ```vue
   <h6 class="qr-title">
       {{ getQrTitle(attendee) }}
   </h6>
   ```

## How It Works

### Scenario 1: Group Ticket (2 tickets, 1 attendee, saveAllAttendeesDetails = false)
- **QR Title:** "QR Code for the whole group:"
- **Why:** Multiple tickets but only one attendee form was filled, so QR is for entire group

### Scenario 2: Individual Tickets (2 tickets, 2 attendees, saveAllAttendeesDetails = true)
- **QR Title:** "QR Code for John", "QR Code for Jane"
- **Why:** Each attendee has their own QR code

### Scenario 3: Single Ticket
- **QR Title:** "QR Code for John"
- **Why:** Only one ticket, individual QR code

## Logic Flow

```
IF totalTicketQuantity > 1 
   AND event.config.saveAllAttendeesDetails === false
THEN
   Show "QR Code for the whole group:"
ELSE
   Show "QR Code for [FirstName]"
```

## Testing

To verify the fix:

1. **Test Group Ticket:**
   - Create event with `saveAllAttendeesDetails = false`
   - Register with 2 free tickets
   - Complete registration
   - Success page should show: "QR Code for the whole group:"

2. **Test Individual Tickets:**
   - Create event with `saveAllAttendeesDetails = true`
   - Register with 2 free tickets (fill 2 attendee forms)
   - Complete registration
   - Success page should show: "QR Code for John", "QR Code for Jane"

3. **Test Single Ticket:**
   - Register with 1 ticket
   - Success page should show: "QR Code for [FirstName]"

## Notes

- The fix is consistent with the email logic that was previously implemented
- The backend now returns event config in the `getFreeRegistrationConfirmation` endpoint
- The frontend dynamically calculates whether it's a group ticket based on order quantity and event config
- No breaking changes to existing functionality

