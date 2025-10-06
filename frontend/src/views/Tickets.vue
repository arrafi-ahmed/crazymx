<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useStore } from 'vuex'
import { toast } from 'vue-sonner'
import { formatPrice, formatPriceCompact } from '@/others/util'

const { xs } = useDisplay()
const route = useRoute()
const router = useRouter()
const store = useStore()

const selectedTickets = ref([])
const isLoading = ref(true)
const isProcessingPayment = ref(false)
const showCartDialog = ref(false)


const storedReg = localStorage.getItem('registrationData')
const storedEventId = storedReg ? JSON.parse(storedReg).eventId : null
const fetchedEvent = computed(() => store.state.event.event)
const eventId = computed(() => storedEventId || fetchedEvent.value.id)
const tickets = computed(() => store.state.ticket.tickets)

// Max tickets per registration from event config
const maxTicketsPerRegistration = computed(() => {
  const val = Number(fetchedEvent.value?.config?.maxTicketsPerRegistration)
  return Number.isFinite(val) && val > 0 ? val : Infinity
})

// Total selected tickets across all ticket types
const totalSelectedTickets = computed(() =>
  selectedTickets.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
)

const isAtSelectionLimit = computed(() => totalSelectedTickets.value >= maxTicketsPerRegistration.value)

const getTicketById = (ticketId) => tickets.value.find((t) => t.id === ticketId)

// Get currency from event
const eventCurrency = computed(() => {
  // Check if event has currency field, otherwise default to USD
  const currency = fetchedEvent.value?.currency
  if (currency && typeof currency === 'string' && currency.length === 3) {
    return currency.toUpperCase()
  }
  return 'USD'
})

const fetchTickets = async () => {
  try {
    isLoading.value = true

    const slug = route.params.slug

    // Try to fetch by slug first if available and event is not in store
    if (!storedEventId && slug && (!fetchedEvent.value || !fetchedEvent.value.id)) {
      try {
        await store.dispatch('event/setEventBySlug', { slug })
      } catch (slugError) {
      }
    }

    if (eventId.value) {
      // Fetch tickets for this event using store action
      try {
        await store.dispatch('ticket/setTickets', eventId.value)
      } catch (ticketError) {
        tickets.value = []
      }
    } else {
      tickets.value = []
    }
  } catch (error) {
    tickets.value = []
  } finally {
    isLoading.value = false
  }
}

const selectTicket = (ticket, quantityChange = 1) => {
  const existingIndex = selectedTickets.value.findIndex((item) => item.ticketId === ticket.id)

  if (existingIndex >= 0) {
    // Update existing selection
    const currentQuantity = selectedTickets.value[existingIndex].quantity
    const newQuantity = currentQuantity + quantityChange
    // Enforce global per-registration limit
    if (quantityChange > 0) {
      const prospectiveTotal = totalSelectedTickets.value + quantityChange
      if (prospectiveTotal > maxTicketsPerRegistration.value) {
        toast.error(`You can select up to ${
          maxTicketsPerRegistration.value === Infinity ? 0 : maxTicketsPerRegistration.value
        } tickets per registration`)
        return
      }
    }

    if (newQuantity <= 0) {
      // Remove from cart if quantity becomes 0 or negative
      selectedTickets.value.splice(existingIndex, 1)
    } else if (newQuantity <= ticket.currentStock) {
      // Update quantity if within stock limits
      selectedTickets.value[existingIndex].quantity = newQuantity
    }
    // If newQuantity > currentStock, do nothing (button will be disabled)
  } else {
    // Add new selection (only if quantityChange is positive)
    if (quantityChange > 0 && quantityChange <= ticket.currentStock) {
      // Enforce global per-registration limit
      const prospectiveTotal = totalSelectedTickets.value + quantityChange
      if (prospectiveTotal > maxTicketsPerRegistration.value) {
        toast.error(`You can select up to ${
          maxTicketsPerRegistration.value === Infinity ? 0 : maxTicketsPerRegistration.value
        } tickets per registration`)
        return
      }
      selectedTickets.value.push({
        ticketId: ticket.id,
        title: ticket.title,
        unitPrice: ticket.price,
        currency: eventCurrency.value,
        quantity: quantityChange,
      })
    }
  }
}

const removeTicket = (ticketId) => {
  const index = selectedTickets.value.findIndex((item) => item.ticketId === ticketId)
  if (index >= 0) {
    selectedTickets.value.splice(index, 1)
  }
}

const updateQuantity = (ticketId, newQuantity) => {
  const ticket = tickets.value.find((t) => t.id === ticketId)
  if (!ticket) return

  if (newQuantity <= ticket.currentStock) {
    const index = selectedTickets.value.findIndex((item) => item.ticketId === ticketId)
    if (index >= 0) {
      selectedTickets.value[index].quantity = newQuantity
    }
  }
}

const isTicketInCart = (ticketId) => {
  return selectedTickets.value.some((item) => item.ticketId === ticketId)
}

const getButtonText = (ticket) => {
  if (ticket.currentStock === 0) {
    return 'Sold Out'
  } else if (isTicketInCart(ticket.id)) {
    return 'In Cart'
  } else {
    return 'Add to Cart'
  }
}

const getSubtotalAmount = () => {
  return selectedTickets.value.reduce((total, item) => {
    return total + item.unitPrice * item.quantity
  }, 0)
}

const getTaxConfig = () => {
  const cfg = fetchedEvent.value?.landingConfig?.tax || fetchedEvent.value?.landing_config?.tax
  if (!cfg || typeof cfg !== 'object') return { type: 'percent', amount: 0 }
  return { type: (cfg.type || 'percent').toLowerCase(), amount: Number(cfg.amount || 0) }
}

const getTaxAmount = () => {
  const { type, amount } = getTaxConfig()
  if (!amount || amount <= 0) return 0
  if (type === 'percent') {
    return Math.round((getSubtotalAmount() * amount) / 100)
  }
  // fixed amount in cents
  return Math.round(amount)
}

const getTotalAmount = () => {
  return getSubtotalAmount() + getTaxAmount()
}

const proceedToForm = async () => {
  isProcessingPayment.value = true

  try {
    // Load registration data from localStorage
    const storedData = localStorage.getItem('registrationData')
    if (!storedData) {
      toast.error('Please complete the registration form first')
      return
    }

    let registrationData
    try {
      registrationData = JSON.parse(storedData)
    } catch (error) {
      toast.error('Invalid registration data. Please complete the registration form again.')
      return
    }

    // Validate registration data
    if (!registrationData.eventId) {
      toast.error('Please complete the registration form first')
      return
    }

    // Transform selected tickets to the correct format for attendee forms
    const transformedItems = selectedTickets.value.map((ticket) => {
      return {
        ticketId: ticket.ticketId,
        title: ticket.title,
        unitPrice: Number(ticket.unitPrice || ticket.price || 0),
        quantity: Number(ticket.quantity || 1),
      }
    })

    // Store tickets in localStorage for attendee forms
    localStorage.setItem('selectedTickets', JSON.stringify(transformedItems))

    // Redirect to attendee form page - only slug-based routing
    router.push({
      name: 'attendee-form-slug',
      params: {
        slug: route.params.slug,
      },
    })
  } catch (error) {
    toast.error('Failed to proceed to attendee forms. Please try again.')
  } finally {
    isProcessingPayment.value = false
  }
}

const goBack = () => {
  // Only slug-based routing
  router.push({
    name: 'event-landing-slug',
    params: { slug: route.params.slug },
  })
}

onMounted(async () => {
  // Ensure selectedTickets is always an array
  if (!selectedTickets.value || !Array.isArray(selectedTickets.value)) {
    selectedTickets.value = []
  }

  // Fetch event and tickets first
  await fetchTickets()
})
</script>

<template>
  <!-- Tickets Section -->
  <section class="section section-fade">
    <v-container>
      <v-row>
        <v-col
          cols="12"
          md="8"
        >
          <h2 class="text-h4 font-weight-bold mb-4">
            {{ fetchedEvent?.name || 'Available Tickets' }}
          </h2>
        </v-col>
      </v-row>

      <!-- Instructions -->
      <!--      <div-->
      <!--        v-if="tickets.length > 0"-->
      <!--        class="text-center mb-6"-->
      <!--      >-->
      <!--        <v-alert-->
      <!--          color="primary"-->
      <!--          variant="tonal"-->
      <!--          class="mx-auto"-->
      <!--          max-width="600"-->
      <!--          density="compact"-->
      <!--        >-->
      <!--          <template #prepend>-->
      <!--            <v-icon>mdi-information</v-icon>-->
      <!--          </template>-->
      <!--          <div class="text-body-2">-->
      <!--            <strong>How to reserve:</strong> Click "Add to Cart" on your desired ticket, then use the button below to proceed to registration.-->
      <!--          </div>-->
      <!--        </v-alert>-->
      <!--      </div>-->

      <v-row v-if="isLoading">
        <v-col
          class="text-center"
          cols="12"
        >
          <v-progress-circular
            color="primary"
            indeterminate
            size="64"
          />
          <p class="mt-4">
            Loading tickets...
          </p>
        </v-col>
      </v-row>

      <v-row v-else-if="tickets.length === 0">
        <v-col
          class="text-center"
          cols="12"
        >
          <v-card
            class="mx-auto"
            elevation="4"
            max-width="500"
          >
            <v-card-text class="pa-6">
              <v-icon
                class="mb-4"
                color="info"
                size="64"
              >
                mdi-ticket-outline
              </v-icon>
              <h3 class="text-h5 mb-4">
                No Tickets Available Yet
              </h3>
              <p class="text-body-1 mb-4">
                Tickets for this event have not been created by the organizer yet. Please check back later or contact the event organizer for more information.
              </p>
              <v-btn
                class="mt-4"
                color="primary"
                @click="goBack"
              >
                Back to Event
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>


      <v-row v-else>
        <v-col
          v-for="ticket in tickets"
          :key="ticket.id"
          class="mb-4"
          cols="12"
          md="4"
          sm="6"
        >
          <v-card
            :class="{ 'ticket-selected': isTicketInCart(ticket.id) }"
            class="ticket-card"
            elevation="6"
          >
            <v-card-title class="text-center py-3 bg-gradient-primary text-white">
              <div class="w-100">
                <div class="d-flex justify-space-between align-center mb-2">
                  <v-icon class="text-white">
                    mdi-ticket
                  </v-icon>
                  <v-chip
                    v-if="isTicketInCart(ticket.id)"
                    color="white"
                    size="small"
                    text-color="primary"
                  >
                    In Cart
                  </v-chip>
                </div>
                <h3 class="text-h5 font-weight-bold">
                  {{ ticket.title }}
                </h3>
                <div class="text-h6 font-weight-bold mt-2 opacity-90">
                  {{ formatPrice(ticket.price, eventCurrency) }}
                </div>
              </div>
            </v-card-title>
            <v-card-text class="pa-3">
              <p class="text-body-2 mb-3 text-grey-darken-1">
                {{ ticket.description }}
              </p>

              <div class="ticket-details mb-3">
                <div class="d-flex justify-space-between align-center">
                  <span class="text-caption font-weight-medium">Availability:</span>
                  <v-chip
                    :color="ticket.currentStock > 0 ? 'success' : 'error'"
                    size="small"
                    variant="outlined"
                  >
                    <v-icon
                      class="mr-1"
                      size="16"
                    >
                      {{ ticket.currentStock > 0 ? 'mdi-check-circle' : 'mdi-close-circle' }}
                    </v-icon>
                    {{ ticket.currentStock || 0 }} available
                  </v-chip>
                </div>
              </div>

              <!-- Quantity Selection -->
              <div class="mb-3">
                <div class="d-flex justify-space-between align-center mb-2">
                  <span class="text-caption font-weight-medium">Quantity:</span>
                  <span class="text-caption text-medium-emphasis">
                    Max: {{ ticket.currentStock || 0 }}
                  </span>
                </div>

                <div class="d-flex align-center justify-center gap-2">
                  <v-btn
                    :disabled="!ticket.currentStock || ticket.currentStock <= 0"
                    class="quantity-btn"
                    color="grey-darken-1"
                    icon
                    size="small"
                    variant="outlined"
                    @click="selectTicket(ticket, -1)"
                  >
                    <v-icon size="16">
                      mdi-minus
                    </v-icon>
                  </v-btn>

                  <div class="quantity-display">
                    {{ isTicketInCart(ticket.id) ? selectedTickets.find(item => item.ticketId === ticket.id)?.quantity || 0 : 0 }}
                  </div>

                  <v-btn
                    :disabled="
                      !ticket.currentStock ||
                        ticket.currentStock <= 0 ||
                        isAtSelectionLimit ||
                        (isTicketInCart(ticket.id) && selectedTickets.find(item => item.ticketId === ticket.id)?.quantity >= ticket.currentStock)
                    "
                    class="quantity-btn"
                    color="grey-darken-1"
                    icon
                    size="small"
                    variant="outlined"
                    @click="selectTicket(ticket, 1)"
                  >
                    <v-icon size="16">
                      mdi-plus
                    </v-icon>
                  </v-btn>
                </div>
              </div>

              <!-- Action Button -->
              <div class="text-center">
                <v-btn
                  v-if="!isTicketInCart(ticket.id)"
                  :disabled="!ticket.currentStock || ticket.currentStock <= 0"
                  class="w-100"
                  color="primary"
                  elevation="4"
                  size="default"
                  @click="selectTicket(ticket, 1)"
                >
                  <v-icon class="mr-2">
                    mdi-cart-plus
                  </v-icon>
                  Add to Cart
                </v-btn>

                <v-btn
                  v-else
                  :disabled="!ticket.currentStock || ticket.currentStock <= 0"
                  class="w-100"
                  color="success"
                  variant="outlined"
                  size="default"
                  @click="removeTicket(ticket.id)"
                >
                  <v-icon class="mr-2">
                    mdi-cart-remove
                  </v-icon>
                  Remove from Cart
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </section>



  <!-- Quick Continue Button - Fixed Bottom Bar -->
  <v-fade-transition>
    <div
      v-show="totalSelectedTickets > 0"
      class="quick-continue-bar"
    >
      <v-container>
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center">
            <v-icon
              class="mr-2"
              color="white"
              size="20"
            >
              mdi-check-circle
            </v-icon>
            <div>
              <div class="text-subtitle-2 font-weight-bold text-white">
                {{ totalSelectedTickets }} ticket{{ totalSelectedTickets !== 1 ? 's' : '' }} selected
              </div>
              <div class="text-caption text-white">
                Total: {{ formatPrice(getTotalAmount(), eventCurrency) }}
              </div>
            </div>
          </div>
          <div class="d-flex align-center gap-2">
            <v-btn
              class="review-btn"
              color="white"
              size="small"
              variant="outlined"
              @click="showCartDialog = true"
            >
              <v-icon
                class="mr-1"
                size="16"
              >
                mdi-cart
              </v-icon>
              Cart
            </v-btn>
            <v-btn
              :disabled="totalSelectedTickets === 0"
              :loading="isProcessingPayment"
              class="continue-btn"
              color="white"
              elevation="0"
              size="default"
              @click="proceedToForm"
            >
              <v-icon
                class="mr-2"
                size="18"
              >
                mdi-arrow-right
              </v-icon>
              Continue to Registration
            </v-btn>
          </div>
        </div>
      </v-container>
    </div>
  </v-fade-transition>

  <!-- Modern Cart Dialog -->
  <v-dialog
    v-model="showCartDialog"
    max-width="380"
    persistent
    transition="dialog-bottom-transition"
  >
    <v-card
      class="modern-cart-dialog rounded-lg"
      elevation="0"
    >
      <!-- Sleek Header -->
      <div class="cart-header">
        <div class="d-flex justify-space-between align-center pa-4">
          <div class="d-flex align-center">
            <div class="cart-icon-wrapper">
              <v-icon
                color="white"
                size="18"
              >
                mdi-shopping
              </v-icon>
            </div>
            <div class="ml-3">
              <div class="text-h6 font-weight-bold text-white">
                Cart
              </div>
              <div class="text-caption text-white">
                {{ totalSelectedTickets }} item{{ totalSelectedTickets !== 1 ? 's' : '' }}
              </div>
            </div>
          </div>
          <v-btn
            class="close-btn"
            color="white"
            icon
            size="small"
            variant="text"
            @click="showCartDialog = false"
          >
            <v-icon size="16">
              mdi-close
            </v-icon>
          </v-btn>
        </div>
      </div>

      <!-- Content -->
      <v-card-text class="pa-0">
        <div
          v-if="totalSelectedTickets === 0"
          class="text-center py-12"
        >
          <div class="empty-cart-icon">
            <v-icon
              color="grey-lighten-2"
              size="40"
            >
              mdi-shopping-outline
            </v-icon>
          </div>
          <h3 class="text-h6 text-grey-darken-1 mb-2 mt-4">
            Your cart is empty
          </h3>
          <p class="text-body-2 text-grey-lighten-1 mb-6">
            Select tickets to get started
          </p>
          <v-btn
            class="continue-btn"
            color="primary"
            size="small"
            variant="outlined"
            @click="showCartDialog = false"
          >
            Continue Shopping
          </v-btn>
        </div>

        <div
          v-else
          class="cart-content"
        >
          <!-- Items List -->
          <div class="cart-items-list pa-4">
            <div
              v-for="(item, index) in selectedTickets"
              :key="item.ticketId"
              class="cart-item-modern"
            >
              <div class="cart-item-content">
                <div class="item-info">
                  <h6 class="item-title">
                    {{ item.title }}
                  </h6>
                  <div class="item-price">
                    {{ formatPrice(item.unitPrice, eventCurrency) }} each
                  </div>
                </div>

                <div class="item-controls">
                  <div class="quantity-controls">
                    <v-btn
                      :disabled="item.quantity <= 1"
                      class="quantity-btn"
                      color="grey-darken-1"
                      icon
                      size="x-small"
                      variant="text"
                      @click="updateQuantity(item.ticketId, item.quantity - 1)"
                    >
                      <v-icon size="14">
                        mdi-minus
                      </v-icon>
                    </v-btn>
                    <span class="quantity-text">{{ item.quantity }}</span>
                    <v-btn
                      :disabled="
                        isAtSelectionLimit ||
                          (getTicketById(item.ticketId)?.currentStock ?? 0) <= item.quantity
                      "
                      class="quantity-btn"
                      color="grey-darken-1"
                      icon
                      size="x-small"
                      variant="text"
                      @click="updateQuantity(item.ticketId, item.quantity + 1)"
                    >
                      <v-icon size="14">
                        mdi-plus
                      </v-icon>
                    </v-btn>
                  </div>

                  <div class="item-total">
                    {{ formatPrice(item.unitPrice * item.quantity, eventCurrency) }}
                  </div>

                  <v-btn
                    class="remove-btn"
                    color="grey-lighten-1"
                    icon
                    size="x-small"
                    variant="text"
                    @click="removeTicket(item.ticketId)"
                  >
                    <v-icon size="14">
                      mdi-close
                    </v-icon>
                  </v-btn>
                </div>
              </div>

              <!-- Subtle divider -->
              <div
                v-if="index < selectedTickets.length - 1"
                class="item-divider"
              />
            </div>
          </div>

          <!-- Summary Section -->
          <div class="cart-summary">
            <div class="summary-line">
              <span class="summary-label">Subtotal</span>
              <span class="summary-amount">{{ formatPrice(getSubtotalAmount(), eventCurrency) }}</span>
            </div>
            <div
              v-if="getTaxAmount() > 0"
              class="summary-line"
            >
              <span class="summary-label">Tax</span>
              <span class="summary-amount">{{ formatPrice(getTaxAmount(), eventCurrency) }}</span>
            </div>
            <v-divider class="my-2" />
            <div class="summary-line summary-total">
              <span class="summary-label">Total</span>
              <span class="summary-amount">{{ formatPrice(getTotalAmount(), eventCurrency) }}</span>
            </div>

            <v-btn
              :disabled="totalSelectedTickets === 0"
              :loading="isProcessingPayment"
              block
              class="checkout-btn"
              color="primary"
              elevation="0"
              height="48"
              size="large"
              @click="proceedToForm"
            >
              <v-icon
                class="mr-2"
                size="18"
              >
                mdi-credit-card-outline
              </v-icon>
              <span class="font-weight-medium">
                {{ isProcessingPayment ? 'Processing...' : 'Checkout' }}
              </span>
            </v-btn>

            <div class="text-center mt-4">
              <v-btn
                class="continue-shopping-btn"
                color="grey-darken-1"
                size="small"
                variant="text"
                @click="showCartDialog = false"
              >
                Continue Shopping
              </v-btn>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.hero-section {
  position: relative;
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    120deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  );
  z-index: 1;
}

.hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(30, 60, 114, 0.35);
  z-index: 2;
}

.hero-section .v-container {
  position: relative;
  z-index: 3;
  min-height: 60vh;
}



/* Quick Continue Bar Styles */
.quick-continue-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, rgb(var(--v-theme-accent)) 100%);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  z-index: 999;
  padding: 16px 0;
  backdrop-filter: blur(10px);
}

.quick-continue-bar .v-container {
  padding-top: 8px;
  padding-bottom: 8px;
}

.continue-btn {
  font-weight: 600 !important;
  text-transform: none !important;
  border-radius: 8px !important;
  min-width: 180px !important;
}

.review-btn {
  font-weight: 500 !important;
  text-transform: none !important;
  border-radius: 6px !important;
  min-width: 80px !important;
}

.gap-2 {
  gap: 8px;
}

.modern-cart-dialog {
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

/* Cart Header */
.cart-header {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  );
  position: relative;
  overflow: hidden;
}

.cart-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/><circle cx="10" cy="60" r="0.5" fill="white" opacity="0.1"/><circle cx="90" cy="40" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
  opacity: 0.3;
}

.cart-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.close-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(10px);
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

/* Empty Cart */
.empty-cart-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-surfaceVariant)) 0%,
    rgb(var(--v-theme-outline)) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.continue-btn {
  border-radius: 12px !important;
  text-transform: none !important;
  font-weight: 500 !important;
}

/* Cart Items */
.cart-items-list {
  background: rgb(var(--v-theme-surface));
}

.cart-item-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--v-theme-onSurface));
  margin-bottom: 4px;
  line-height: 1.3;
}

.item-price {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-onSurfaceVariant));
  font-weight: 400;
}

.item-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quantity-controls {
  display: flex;
  align-items: center;
  background: rgb(var(--v-theme-surfaceVariant));
  border-radius: 12px;
  padding: 4px;
  border: 1px solid rgb(var(--v-theme-outline));
}

.quantity-btn {
  width: 24px !important;
  height: 24px !important;
  min-width: 24px !important;
  border-radius: 12px !important;
}

.quantity-btn:hover {
  background: rgba(0, 0, 0, 0.05) !important;
}

.quantity-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--v-theme-onSurface));
  min-width: 20px;
  text-align: center;
}

.item-total {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--v-theme-onSurface));
  min-width: 60px;
  text-align: right;
}

.remove-btn {
  width: 24px !important;
  height: 24px !important;
  min-width: 24px !important;
  border-radius: 12px !important;
  opacity: 0.6;
}

.remove-btn:hover {
  opacity: 1;
  background: rgba(244, 67, 54, 0.1) !important;
  color: #f44336 !important;
}

.item-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgb(var(--v-theme-outline)) 50%,
    transparent 100%
  );
  margin: 0;
}

/* Cart Summary */
.cart-summary {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-surfaceVariant)) 0%,
    rgb(var(--v-theme-surface)) 100%
  );
  border-top: 1px solid rgb(var(--v-theme-outline));
  padding: 20px;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.summary-label {
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--v-theme-onSurface));
}

.summary-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: rgb(var(--v-theme-onSurface));
}

.checkout-btn {
  border-radius: 12px !important;
  text-transform: none !important;
  font-weight: 500 !important;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
}

.checkout-btn:hover {
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4) !important;
  transform: translateY(-1px);
}

.continue-shopping-btn {
  text-transform: none !important;
  font-weight: 500 !important;
  border-radius: 12px !important;
}

.continue-shopping-btn:hover {
  background: rgba(0, 0, 0, 0.05) !important;
}

/* Ticket Card Styles */
.ticket-card {
  transition:
    transform 0.3s cubic-bezier(0.4, 2, 0.6, 1),
    box-shadow 0.3s;
  border-radius: 12px;
  min-height: 180px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.ticket-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(212, 175, 55, 0.15);
}

.ticket-card .v-card-text {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.ticket-card .v-card-text .text-center {
  margin-top: auto;
}

.ticket-selected {
  border-color: rgb(var(--v-theme-success));
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-surfaceVariant)) 0%,
    rgb(var(--v-theme-surface)) 100%
  );
}

.ticket-details {
  background: rgb(var(--v-theme-surfaceVariant));
  border-radius: 6px;
  padding: 12px;
  border: 1px solid rgb(var(--v-theme-outline));
}

/* Gradient Background */
.bg-gradient-primary {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  ) !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .sticky-cart {
    position: static;
    margin-top: 20px;
  }

  .cart-items {
    max-height: 200px;
  }

  .ticket-card {
    min-height: 160px;
  }
}

.text-shadow {
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.section {
  padding: 40px 0 40px 0;
  position: relative;
}

.cart-card {
  position: sticky;
  top: 100px;
  border-radius: 12px;
}

.section-fade {
  animation: fadeIn 1.2s cubic-bezier(0.4, 2, 0.6, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(40px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.hero-content-vertical-center {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* Quantity Controls Styling */
.quantity-btn {
  min-width: 32px !important;
  width: 32px !important;
  height: 32px !important;
}

.quantity-display {
  min-width: 40px;
  text-align: center;
  font-weight: 600;
  font-size: 1rem;
  color: var(--v-theme-on-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.gap-2 {
  gap: 8px;
}

/* Cart Summary Styling */
.summary-total {
  font-weight: 600;
  font-size: 1.1rem;
}

.summary-total .summary-label {
  font-weight: 700;
}

.summary-total .summary-amount {
  font-weight: 700;
  color: var(--v-theme-primary);
}
</style>
