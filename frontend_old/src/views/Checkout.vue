<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { loadStripe } from '@stripe/stripe-js/pure'
import { toast } from 'vue-sonner'
import { stripePublic, formatPrice } from '@/others/util'
import $axios from '@/plugins/axios'

definePage({
  name: 'signin', // Set the route name to 'signin'
  meta: {
    layout: 'default',
    title: 'Signin',
    requiresNoAuth: true,
  },
})

const route = useRoute()
const router = useRouter()
const store = useStore()

// Data
const stripe = ref(null)
const elements = ref(null)
const paymentElement = ref(null)
const isProcessingPayment = ref(false)
const clientSecret = ref('')
const sessionId = ref('')

const attendees = computed(() => JSON.parse(localStorage.getItem('attendeesData')))
const selectedTickets = computed(() => JSON.parse(localStorage.getItem('selectedTickets')))
const registration = computed(() => JSON.parse(localStorage.getItem('registrationData')))

// Get event from store
const fetchedEvent = computed(() => store.state.event.event)

// Get currency from event
const eventCurrency = computed(() => {
  // Check if event has currency field, otherwise default to USD
  const currency = fetchedEvent.value?.currency
  if (currency && typeof currency === 'string' && currency.length === 3) {
    return currency.toUpperCase()
  }
  return 'USD'
})

const isFreeOrder = computed(() => {
  return selectedTickets.value && selectedTickets.value.every((item) => item.unitPrice === 0)
})
// Computed properties for order summary
const subtotalAmount = computed(() => {
  return (selectedTickets.value || []).reduce((total, item) => {
    return total + (item.unitPrice || 0) * (item.quantity || 1)
  }, 0)
})

const taxConfig = computed(() => {
  const cfg = fetchedEvent.value?.landingConfig?.tax || fetchedEvent.value?.landing_config?.tax
  if (!cfg || typeof cfg !== 'object') return { type: 'percent', amount: 0 }
  return { type: (cfg.type || 'percent').toLowerCase(), amount: Number(cfg.amount || 0) }
})

const taxAmount = computed(() => {
  const { type, amount } = taxConfig.value
  if (!amount || amount <= 0) return 0
  if (type === 'percent') {
    return Math.round((subtotalAmount.value * amount) / 100)
  }
  // fixed amount in cents
  return Math.round(amount)
})

const totalAmount = computed(() => subtotalAmount.value + taxAmount.value)



// Initialize Stripe
const initializeStripe = async () => {
  try {
    stripe.value = await loadStripe(stripePublic)
  } catch (error) {
    toast.error('Failed to initialize payment system')
  }
}

// Function to get event data by slug
const getEventBySlug = async (slug) => {
  try {
    const response = await $axios.get(`/event/getEventBySlug?slug=${slug}`)
    if (response.data.payload) {
      return response.data.payload
    }
    return null
  } catch (error) {
    return null
  }
}

// Initialize checkout process
const initializeCheckout = async () => {
  try {
    isProcessingPayment.value = true

    // Load order data from localStorage
    const storedAttendees = localStorage.getItem('attendeesData')
    if (!storedAttendees) {
      toast.error('Order data not found. Please try again.')
      return router.push({ name: 'landing' })
    }

    Object.assign(attendees, JSON.parse(storedAttendees))

    // Check if this is a free order
    if (isFreeOrder.value) {
      return // Don't initialize Stripe for free orders
    }

    // Initialize Stripe for paid orders
    if (!stripe.value) {
      await initializeStripe()
    }
    // Validate attendee data
    if (!attendees.value || !Array.isArray(attendees.value) || attendees.value.length === 0) {
      toast.error('No attendee data found. Please complete attendee forms first.')
      return
    }

    // Validate ticket data
    if (
      !selectedTickets.value ||
      !Array.isArray(selectedTickets.value) ||
      selectedTickets.value.length === 0
    ) {
      toast.error('No ticket data found. Please go back to the tickets page.')
      return
    }

    const requestData = {
      attendees: attendees.value,
      selectedTickets: selectedTickets.value,
      registration: registration.value,
    }

    const response = await $axios.post('/stripe/create-secure-payment-intent', requestData)

    clientSecret.value = response.data.payload.clientSecret
    sessionId.value = response.data.payload.sessionId

    // Store sessionId in localStorage as backup
    localStorage.setItem('tempSessionId', sessionId.value)

    // Create payment element
    if (!stripe.value) {
      throw new Error('Stripe failed to initialize')
    }

    const options = {
      clientSecret: clientSecret.value,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#1976d2',
        },
      },
    }

    elements.value = stripe.value.elements(options)
    paymentElement.value = elements.value.create('payment')
    paymentElement.value.mount('#payment-element')
  } catch (error) {
  } finally {
    isProcessingPayment.value = false
  }
}

const handleFreeRegistration = async () => {
  try {
    isProcessingPayment.value = true

    // Verify this is actually a free order
    if (!isFreeOrder.value) {
      toast.error('This order requires payment. Please use the payment button.')
      return
    }

    // Validate required data
    if (!attendees.value || !Array.isArray(attendees.value) || attendees.value.length === 0) {
      toast.error('No attendee data found. Please complete attendee forms first.')
      return
    }

    if (
      !selectedTickets.value ||
      !Array.isArray(selectedTickets.value) ||
      selectedTickets.value.length === 0
    ) {
      toast.error('No tickets selected. Please select tickets first.')
      return
    }

    if (!registration.value) {
      toast.error('No registration data found. Please complete the registration form first.')
      return
    }

    // Get event data for registration
    const event = await getEventBySlug(route.params.slug)
    if (!event) {
      toast.error('Event not found. Please try again.')
      return
    }

    // Prepare registration data
    const registrationData = {
      attendees: attendees.value,
      selectedTickets: selectedTickets.value,
      registration: registration.value,
      eventId: event.id,
    }

    // Call backend to process free registration
    const response = await $axios.post(
      '/registration/complete-free-registration',
      registrationData,
      {},
    )

    if (response.data.payload && response.data.payload.registrationId) {
      // Clear localStorage
      localStorage.removeItem('attendeesData')
      localStorage.removeItem('registrationData')
      localStorage.removeItem('selectedTickets')

      // Redirect to success page with registration ID and attendee data for free registrations
      // For multiple attendees, we need to pass all attendee information
      const attendeesData = response.data.payload.attendees || []
      const attendeeIds = attendeesData.map((a) => a.id).join(',')
      const qrUuids = attendeesData.map((a) => a.qrUuid).join(',')

      if (route.params.slug) {
        router.push(
          `/${route.params.slug}/success?registration_id=${response.data.payload.registrationId}&attendee_ids=${attendeeIds}&qr_uuids=${qrUuids}`,
        )
      } else {
        router.push(
          `/success?registration_id=${response.data.payload.registrationId}&attendee_ids=${attendeeIds}&qr_uuids=${qrUuids}`,
        )
      }
    }
  } catch (error) {
    // toast.error(error.response?.data?.message || 'Free registration failed. Please try again.')
  } finally {
    isProcessingPayment.value = false
  }
}

// Handle payment submission
const handlePayment = async () => {
  if (!stripe.value || !elements.value) {
    toast.error('Stripe not initialized')
    return
  }

  isProcessingPayment.value = true

  try {
    // Ensure sessionId is available
    if (!sessionId.value) {
      throw new Error('Session ID unavailable. Please try again.')
    }

    // Build success URL using our session ID
    let successUrl
    if (route.params.slug) {
      successUrl = `${window.location.origin}/${route.params.slug}/success?session_id=${sessionId.value}`
    } else {
      // No slug available, use generic success URL
      successUrl = `${window.location.origin}/success?session_id=${sessionId.value}`
    }

    const { error } = await stripe.value.confirmPayment({
      elements: elements.value,
      confirmParams: {
        return_url: successUrl,
      },
    })

    if (error) {
      toast.error(error.message || 'Payment failed')
    }
  } catch (error) {
    toast.error('Payment failed. Please try again.')
  } finally {
    isProcessingPayment.value = false
  }
}

const retryCheckout = () => {
  initializeCheckout()
}

onMounted(async () => {
  // Load event data if not already in store
  const slug = route.params.slug
  if (slug && (!fetchedEvent.value || !fetchedEvent.value.id)) {
    try {
      await store.dispatch('event/setEventBySlug', { slug })
    } catch (error) {
      console.warn('Failed to fetch event by slug:', error)
    }
  }

  await initializeCheckout()
})
</script>
<template>
  <v-container class="checkout-container">
    <v-row justify="center">
      <v-col
        cols="12"
        lg="10"
      >
        <!--              {{registration}}-->
        <v-row>
          <!-- Order Summary -->
          <v-col
            class="order-summary-col"
            cols="12"
            md="5"
          >
            <v-card
              class="order-summary-card"
              elevation="4"
            >
              <v-card-title class="text-h5 pa-4">
                <v-icon left>
                  mdi-cart
                </v-icon>
                Order Summary
              </v-card-title>

              <v-card-text class="pa-4">
                <!-- Order Items -->
                <div
                  v-if="selectedTickets && selectedTickets.length > 0"
                  class="mb-4"
                >
                  <div
                    v-for="item in selectedTickets"
                    :key="item.ticketId"
                    class="order-item"
                  >
                    <div class="d-flex justify-space-between align-center">
                      <div>
                        <div class="text-subtitle-2 font-weight-medium">
                          {{ item.title }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          Quantity: {{ item.quantity }}
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="text-subtitle-2 font-weight-medium">
                          {{ formatPrice(item.unitPrice * item.quantity, eventCurrency) }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          {{ formatPrice(item.unitPrice, eventCurrency) }} each
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Total -->
                <v-divider class="my-4" />
                <div class="d-flex justify-space-between align-center">
                  <div class="font-weight-bold">
                    Subtotal
                  </div>
                  <div class="font-weight-bold">
                    {{ formatPrice(subtotalAmount, eventCurrency) }}
                  </div>
                </div>
                <div
                  v-if="taxAmount > 0"
                  class="d-flex justify-space-between align-center mt-2"
                >
                  <div class="text-body-2">
                    Tax
                  </div>
                  <div class="text-body-2">
                    {{ formatPrice(taxAmount, eventCurrency) }}
                  </div>
                </div>
                <v-divider class="my-3" />
                <div class="d-flex justify-space-between align-center">
                  <div class="text-h6 font-weight-bold">
                    Total
                  </div>
                  <div class="text-h6 font-weight-bold">
                    {{ formatPrice(totalAmount, eventCurrency) }}
                  </div>
                </div>

                <!-- Attendee Info -->
                <div
                  v-if="attendees?.length > 0"
                  class="mt-3"
                >
                  <v-divider class="mb-3" />
                  <div class="text-subtitle-2 font-weight-medium mb-3">
                    Attendees:
                  </div>
                  <div class="attendee-info">
                    <div
                      v-for="(attendee, index) in attendees"
                      :key="index"
                      class="mb-2"
                    >
                      <div class="text-body-2">
                        <strong>Attendee {{ index + 1 }}:</strong>
                        {{ attendee.firstName }} {{ attendee.lastName }}
                      </div>
                      <div
                        v-if="attendee.email"
                        class="text-body-2 text-medium-emphasis"
                      >
                        <strong>Email:</strong>
                        {{ attendee.email }}
                      </div>
                      <div
                        v-if="attendee.ticketTitle"
                        class="text-body-2 text-primary"
                      >
                        <strong>Ticket:</strong>
                        {{ attendee.ticketTitle }}
                      </div>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Payment Form -->
          <v-col
            class="payment-form-col"
            cols="12"
            md="7"
          >
            <v-card
              class="checkout-card"
              elevation="4"
            >
              <v-card-title class="text-h4 text-center pa-6">
                {{ fetchedEvent?.name || 'Registration' }}
              </v-card-title>

              <v-card-text class="pa-6">
                <!-- Payment Form (only show for paid orders) -->
                <div
                  v-if="!isFreeOrder"
                  id="payment-element"
                  class="mb-6"
                />

                <!-- Free Registration Message -->
                <div
                  v-if="isFreeOrder"
                  class="text-center mb-6"
                >
                  <v-icon
                    class="mb-4"
                    color="primary"
                    size="64"
                  >
                    mdi-ticket-confirmation
                  </v-icon>
                  <h3 class="text-h5 mb-2">
                    Free Registration
                  </h3>
                  <p class="text-body-1 text-medium-emphasis">
                    No payment is required. Click the button below to complete your registration.
                  </p>
                </div>

                <!-- Payment Button (only show for paid orders) -->
                <v-btn
                  v-if="!isFreeOrder"
                  :disabled="isProcessingPayment"
                  :loading="isProcessingPayment"
                  block
                  class="payment-btn"
                  color="primary"
                  size="large"
                  @click="handlePayment"
                >
                  <v-icon left>
                    mdi-credit-card
                  </v-icon>
                  {{ isProcessingPayment ? 'Processing...' : 'Pay Now' }}
                </v-btn>

                <!-- Free Order Button (if applicable) -->
                <v-btn
                  v-if="isFreeOrder"
                  :disabled="isProcessingPayment"
                  :loading="isProcessingPayment"
                  block
                  class="payment-btn"
                  color="primary"
                  size="large"
                  @click="handleFreeRegistration"
                >
                  <v-icon left>
                    mdi-ticket-confirmation
                  </v-icon>
                  Complete Free Registration
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.checkout-container {
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  padding: 24px;
}

.checkout-card {
  border-radius: 16px;
  overflow: hidden;
}

.order-summary-card {
  border-radius: 16px;
  overflow: hidden;
  height: fit-content;
  position: sticky;
  top: 24px;
}

.order-item {
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.order-item:last-child {
  border-bottom: none;
}

.registration-info {
  background: rgba(0, 0, 0, 0.02);
  padding: 12px;
  border-radius: 8px;
}

.registration-info .text-body-2 {
  margin-bottom: 4px;
}

.registration-info .text-body-2:last-child {
  margin-bottom: 0;
}

.payment-btn {
  border-radius: 12px;
  text-transform: none;
  font-weight: 500;
  height: 56px;
}

#payment-element {
  margin-bottom: 24px;
}

/* Stripe Payment Element Responsiveness */
#payment-element {
  width: 100%;
  min-height: 200px;
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .checkout-container {
    padding: 16px;
    align-items: flex-start;
    min-height: auto;
  }

  .order-summary-col {
    order: 1;
  }

  .payment-form-col {
    order: 2;
  }

  .order-summary-card {
    position: static;
    margin-bottom: 24px;
  }

  .checkout-card .v-card-title {
    font-size: 1.5rem !important;
    padding: 16px !important;
  }

  .checkout-card .v-card-text {
    padding: 16px !important;
  }

  .order-summary-card .v-card-title {
    font-size: 1.25rem !important;
    padding: 16px !important;
  }

  .order-summary-card .v-card-text {
    padding: 16px !important;
  }

  .payment-btn {
    height: 48px !important;
    font-size: 0.875rem !important;
  }

  #payment-element {
    min-height: 180px;
    margin-bottom: 20px;
  }

  /* Improve touch targets */
  .order-item {
    padding: 16px 0;
  }

  .attendee-info .text-body-2 {
    padding: 4px 0;
  }
}

@media (max-width: 480px) {
  .checkout-container {
    padding: 12px;
  }

  .checkout-card .v-card-title {
    font-size: 1.25rem !important;
    padding: 12px !important;
  }

  .checkout-card .v-card-text {
    padding: 12px !important;
  }

  .order-summary-card .v-card-title {
    font-size: 1.125rem !important;
    padding: 12px !important;
  }

  .order-summary-card .v-card-text {
    padding: 12px !important;
  }

  .order-item {
    padding: 8px 0;
  }

  .text-h6 {
    font-size: 1.125rem !important;
  }

  .text-subtitle-2 {
    font-size: 0.875rem !important;
  }

  .text-body-2 {
    font-size: 0.875rem !important;
  }

  .payment-btn {
    height: 44px !important;
    font-size: 0.8125rem !important;
  }

  .attendee-info .text-body-2 {
    font-size: 0.8125rem !important;
    line-height: 1.4;
  }

  #payment-element {
    min-height: 160px;
    margin-bottom: 16px;
  }

  /* Ensure minimum touch target size */
  .payment-btn {
    min-height: 44px !important;
  }

  .order-item {
    min-height: 44px !important;
    display: flex !important;
    align-items: center !important;
  }
}
</style>
