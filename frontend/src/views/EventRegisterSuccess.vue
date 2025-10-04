<script setup>
import $axios from '@/plugins/axios'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import QRCodeVue3 from 'qrcode-vue3'
import { toast } from 'vue-sonner'
import { generateQrData } from '@/others/util.js'
import { formatPrice } from '@/others/util'

const route = useRoute()
const router = useRouter()
const theme = useTheme()

const isLoading = ref(true)
const error = ref(null)
const tempRegistration = ref(null)

// QR Code options
const qrOptions = computed(() => ({
  type: 'dot',
  color: theme.global.current.value.colors.primary,
}))

const sessionId = computed(() => route.query.session_id)
const registrationId = computed(() => route.query.registration_id)

const clearRegistrationLocalStorage = () => {
  try {
    // Clear all registration-related data
    localStorage.removeItem('attendeesData')
    localStorage.removeItem('registrationData')
    localStorage.removeItem('selectedTickets')
    localStorage.removeItem('tempSessionId')
  } catch (error) {
  }
}

// Get ticket information for a specific attendee
const getAttendeeTicket = (attendee) => {
  if (!tempRegistration.value?.selectedTickets || !attendee.ticketId) {
    return null
  }

  // Find the ticket that matches this attendee's ticketId
  return tempRegistration.value.selectedTickets.find(
    (ticket) => ticket.ticketId === attendee.ticketId,
  )
}

const fetchTempRegistration = async () => {
  try {
    isLoading.value = true
    error.value = null

    // Handle free registration (registration_id + attendee_ids + qr_uuids) or paid registration (session_id)
    if (registrationId.value) {
      const attendeeIds = route.query.attendee_ids?.split(',') || []
      const qrUuids = route.query.qr_uuids?.split(',') || []

      // For free registrations with multiple attendees, we need to validate each attendee
      if (attendeeIds.length > 0 && qrUuids.length > 0) {
        // Fetch complete free registration data using the new endpoint
        const response = await $axios.get(`/registration/getFreeRegistrationConfirmation`, {
          params: {
            registrationId: registrationId.value,
          },
          headers: { 'X-Suppress-Toast': 'true' },
        })

        if (response.data.payload) {
          // Validate that all attendees exist and have matching QR UUIDs
          const attendees = response.data.payload.attendees || []
          const validAttendees = attendees.filter(
            (attendee) =>
              attendeeIds.includes(attendee.id.toString()) && qrUuids.includes(attendee.qrUuid),
          )

          if (validAttendees.length === attendeeIds.length) {
            // Transform the data to match the expected format
            const selectedTickets = validAttendees.map((attendee) => ({
              ticketId: attendee.ticketId,
              title: attendee.ticketTitle || 'Unknown Ticket',
              unitPrice: attendee.unitPrice || 0, // Use real price from backend
              quantity: 1,
            }))

            // Use the complete data structure from the new endpoint
            tempRegistration.value = {
              attendees: validAttendees,
              selectedTickets: selectedTickets,
              orders: response.data.payload.order,
              registration: response.data.payload.registration,
              eventId: response.data.payload.registration?.eventId,
            }
          } else {
            toast.error(
              `QR UUID validation failed. Expected ${attendeeIds.length} attendees, found ${validAttendees.length} valid.`,
            )
          }
        }
      } else {
        toast.error('Invalid registration data. Please contact support.')
      }
    } else if (sessionId.value) {
      // Fallback: check localStorage if session_id not in URL
      if (!sessionId.value) {
        const storedSessionId = localStorage.getItem('tempSessionId')
        if (storedSessionId) {
          sessionId.value = storedSessionId
        }
      }

      if (!sessionId.value) {
        error.value = 'No session ID provided. Please ensure you completed the payment process.'
        return
      }

      const response = await $axios.get(`/temp-registration/success/${sessionId.value}`, {
        headers: { 'X-Suppress-Toast': 'true' },
      })
      tempRegistration.value = response.data.payload
    } else {
      error.value =
        'No registration information provided. Please ensure you completed the registration process.'
      return
    }

    // Clear registration-related localStorage after successful fetch
    clearRegistrationLocalStorage()
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load registration details'
  } finally {
    isLoading.value = false
  }
}

const retryFetch = () => {
  fetchTempRegistration()
}

const goToHome = () => {
  router.push('/')
}

onMounted(() => {
  fetchTempRegistration()
})
</script>

<template>
  <v-container class="success-container">
    <v-row justify="center">
      <v-col
        cols="12"
        lg="6"
        md="8"
      >
        <!-- Loading State -->
        <div
          v-if="isLoading"
          class="text-center py-16"
        >
          <v-progress-circular
            :color="theme.global.current.value.colors.primary"
            indeterminate
            size="64"
            width="4"
          />
          <h3 class="text-h5 mt-6 mb-3">
            Processing your registration
          </h3>
          <p class="text-body-1 text-medium-emphasis">
            Please wait while we confirm your details...
          </p>
        </div>

        <!-- Error State -->
        <div
          v-else-if="error"
          class="text-center py-16"
        >
          <v-card
            class="modern-card"
            elevation="0"
          >
            <v-card-text class="pa-8">
              <v-icon
                :color="theme.global.current.value.colors.error"
                class="mb-6"
                size="64"
              >
                mdi-alert-circle-outline
              </v-icon>
              <h3 class="text-h5 mb-4">
                Registration Status Uncertain
              </h3>
              <p class="text-body-1 mb-8">
                {{ error }}
              </p>
              <v-btn
                color="primary"
                @click="retryFetch"
              >
                Retry
              </v-btn>
            </v-card-text>
          </v-card>
        </div>

        <!-- Success State -->
        <div
          v-else-if="tempRegistration"
          class="py-8"
        >
          <v-card
            class="modern-card"
            elevation="0"
          >
            <!-- Success Header -->
            <div class="success-header">
              <div class="success-icon">
                <v-icon
                  color="white"
                  size="32"
                >
                  mdi-check-circle
                </v-icon>
              </div>
              <h2 class="success-title">
                {{ route.query.registration_id ? 'Free Registration' : 'Payment' }} Successful!
              </h2>
              <!--              <p v-if="route.query.registration_id" class="success-subtitle">-->
              <!--                Registration ID: {{ route.query.registration_id }} | Attendees:-->
              <!--                {{ route.query.attendee_ids?.split(',').length || 0 }}-->
              <!--              </p>-->
              <p class="success-subtitle">
                Welcome to the event
              </p>
            </div>

            <v-card-text class="pa-8">
              <p class="text-body-1 text-center mb-8">
                Your registration has been confirmed. Please save your QR code for event check-in.
              </p>

              <!-- Order Summary -->
              <div
                v-if="tempRegistration.orders"
                class="mb-6"
              >
                <h4 class="text-h6 mb-4 text-center">
                  Order Summary
                </h4>
                <v-card
                  class="pa-4"
                  variant="outlined"
                >
                  <p>
                    <strong>Order Number:</strong>
                    {{ tempRegistration.orders.orderNumber }}
                  </p>
                  <p>
                    <strong>Total Amount:</strong>
                    {{ formatPrice(tempRegistration.orders.totalAmount, tempRegistration.orders.currency) }}
                  </p>
                  <p>
                    <strong>Status:</strong>
                    <span
                      :class="
                        tempRegistration.orders.paymentStatus === 'free'
                          ? 'text-info'
                          : 'text-success'
                      "
                    >
                      {{
                        tempRegistration.orders.paymentStatus === 'free'
                          ? 'Free Registration'
                          : 'Paid'
                      }}
                    </span>
                  </p>
                </v-card>
              </div>

              <!-- Attendees List -->
              <div
                v-if="tempRegistration?.attendees?.length > 0"
                class="mb-6"
              >
                <h4 class="text-h6 mb-6 text-center">
                  Registered Attendees
                </h4>
                <div class="attendees-container">
                  <div
                    v-for="(attendee, index) in tempRegistration.attendees"
                    :key="index"
                    class="attendee-card"
                  >
                    <div class="attendee-info">
                      <div class="attendee-name">
                        <strong>{{ attendee.firstName }} {{ attendee.lastName }}</strong>
                      </div>
                      <div class="attendee-details">
                        <span class="attendee-email">{{ attendee.email }}</span>
                        <span
                          v-if="attendee.phone"
                          class="attendee-phone"
                        >
                          {{ attendee.phone }}
                        </span>
                      </div>

                      <!-- Ticket Information for this attendee -->
                      <div
                        v-if="getAttendeeTicket(attendee)"
                        class="ticket-info"
                      >
                        <div class="ticket-badge">
                          <v-icon
                            class="mr-2"
                            color="primary"
                            size="16"
                          >
                            mdi-ticket
                          </v-icon>
                          <span class="ticket-name">{{ getAttendeeTicket(attendee).title }}</span>
                        </div>
                        <div class="ticket-details">
                          <span class="ticket-price">
                            {{ formatPrice(getAttendeeTicket(attendee).unitPrice, tempRegistration.orders.currency) }}
                          </span>
                          <!--                          <span class="ticket-type">{{ getAttendeeTicket(attendee).type || 'Standard' }}</span>-->
                        </div>
                      </div>
                    </div>

                    <!-- Individual QR Code for each attendee -->
                    <div class="qr-container">
                      <h6 class="qr-title">
                        QR Code for {{ attendee.firstName }}
                      </h6>
                      <p class="qr-security-note">
                        <v-icon
                          class="mr-1"
                          color="success"
                          size="16"
                        >
                          mdi-shield-check
                        </v-icon>
                        Secure QR Code
                      </p>
                      <QRCodeVue3
                        :corners-square-options="qrOptions"
                        :dots-options="qrOptions"
                        :download="true"
                        :height="200"
                        :value="
                          generateQrData({
                            registrationId: registrationId || attendee.registrationId,
                            attendeeId: attendee.id,
                            qrUuid: attendee.qrUuid,
                          })
                        "
                        :width="200"
                        download-button="download-qr-btn"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </div>

        <!-- Fallback State -->
        <div
          v-else
          class="text-center py-16"
        >
          <v-card
            class="modern-card"
            elevation="0"
          >
            <v-card-text class="pa-8">
              <v-icon
                :color="theme.global.current.value.colors.info"
                class="mb-6"
                size="64"
              >
                mdi-information
              </v-icon>
              <h3 class="text-h5 mb-4">
                Payment Completed
              </h3>
              <p class="text-body-1 mb-8">
                Your payment was processed successfully. Your registration details are being finalized. You will receive a confirmation email shortly.
              </p>
            </v-card-text>
          </v-card>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.success-container {
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
}

.modern-card {
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  background: rgb(var(--v-theme-surface));
}

.success-header {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  );
  padding: 40px 24px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.success-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/><circle cx="10" cy="60" r="0.5" fill="white" opacity="0.1"/><circle cx="90" cy="40" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
  opacity: 0.3;
}

.success-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 1;
}

.success-title {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin-bottom: 8px;
  position: relative;
  z-index: 1;
}

.success-subtitle {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  position: relative;
  z-index: 1;
}

.attendees-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.attendee-card {
  background: rgb(var(--v-theme-surface));
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

.attendee-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.attendee-info {
  margin-bottom: 20px;
}

.attendee-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgb(var(--v-theme-onSurface));
  margin-bottom: 8px;
}

.attendee-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.attendee-email {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-onSurfaceVariant));
}

.attendee-phone {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}

.ticket-info {
  margin-top: 16px;
  padding: 12px;
  background: rgba(var(--v-theme-primary), 0.08);
  border-radius: 12px;
  border-left: 4px solid rgb(var(--v-theme-primary));
}

.ticket-badge {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.ticket-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ticket-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ticket-price {
  font-size: 0.875rem;
  font-weight: 700;
  color: rgb(var(--v-theme-success));
  background: rgba(var(--v-theme-success), 0.1);
  padding: 4px 8px;
  border-radius: 6px;
}

.ticket-type {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-onSurfaceVariant));
  font-weight: 500;
  text-transform: capitalize;
}

.ticket-summary-item {
  padding: 12px 0;
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.2);
}

.ticket-summary-item:last-child {
  border-bottom: none;
}

.ticket-summary-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ticket-summary-name {
  display: flex;
  align-items: center;
  font-size: 1rem;
}

.ticket-summary-details {
  display: flex;
  gap: 16px;
  align-items: center;
}

.ticket-summary-price {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.ticket-summary-qty {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-onSurfaceVariant));
  background: rgba(var(--v-theme-primary), 0.1);
  padding: 4px 8px;
  border-radius: 6px;
}

.ticket-summary-total {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-success));
  font-weight: 700;
  background: rgba(var(--v-theme-success), 0.1);
  padding: 4px 8px;
  border-radius: 6px;
}

.qr-container {
  text-align: center;
}

.qr-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--v-theme-onSurface));
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.qr-security-note {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-success));
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
}

/* QR Download Button Styling */
:deep(.download-qr-btn) {
  border-radius: 12px !important;
  text-transform: none !important;
  font-weight: 500 !important;
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  ) !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  margin-top: 16px !important;
  padding: 12px 24px !important;
  font-size: 0.875rem !important;
}

:deep(.download-qr-btn:hover) {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2) !important;
  transform: translateY(-1px);
}

/* Responsive Design */
@media (max-width: 768px) {
  .success-container {
    min-height: calc(100vh - 56px);
    padding: 16px;
  }

  .success-header {
    padding: 32px 16px;
  }

  .success-title {
    font-size: 1.75rem;
  }

  .attendee-card {
    padding: 20px;
  }
}
</style>
