<template>
  <v-container class="event-donation-container">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <div class="text-center">
          <h1 class="text-h3 font-weight-bold mb-3 text-primary">
            Support Our Event
          </h1>
          <p class="text-h6 text-medium-emphasis mb-4">
            Choose a donation package and help make this event extraordinary
          </p>
          <v-chip
            class="mb-2"
            color="primary"
            size="large"
            variant="tonal"
          >
            <v-icon start>
              mdi-heart
            </v-icon>
            Your support makes a difference
          </v-chip>
        </div>
      </v-col>
    </v-row>

    <!-- Donation Packages -->
    <v-row
      v-if="!isLoading && packages.length > 0"
      class="mb-8"
    >
      <v-col
        v-for="pkg in packages"
        :key="pkg.id"
        cols="12"
        lg="4"
        md="6"
      >
        <v-card
          :class="{ 'selected-package': selectedPackage?.id === pkg.id }"
          class="donation-package-card h-100"
          variant="outlined"
        >
          <v-card-title class="text-center py-6 bg-primary text-white">
            <h3 class="text-h5 font-weight-bold">
              {{ pkg.name }}
            </h3>
          </v-card-title>

          <v-card-text class="pa-6">
            <div class="text-center mb-4">
              <div class="text-h4 font-weight-bold text-primary mb-2">
                {{ formatPrice(pkg.price, pkg.currency) }}
              </div>
              <p class="text-body-1 text-medium-emphasis">
                {{ pkg.description }}
              </p>
            </div>

            <!-- Features List -->
            <v-list class="bg-transparent pa-0">
              <v-list-item
                v-for="feature in pkg.features"
                :key="feature.text"
                :class="{ 'text-disabled': !feature.included }"
                class="px-0 py-2"
              >
                <template #prepend>
                  <v-icon
                    :color="feature.included ? 'success' : 'disabled'"
                    :icon="feature.included ? 'mdi-check-circle' : 'mdi-circle-outline'"
                  />
                </template>
                <v-list-item-title
                  :class="feature.included ? 'text-body-1' : 'text-body-2 text-disabled'"
                >
                  {{ feature.text }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>

          <v-card-actions class="pa-6 pt-0">
            <v-btn
              :loading="isProcessing && selectedPackage?.id === pkg.id"
              block
              color="primary"
              size="large"
              variant="elevated"
              @click="selectPackage(pkg)"
            >
              <v-icon start>
                mdi-gift
              </v-icon>
              Choose This Package
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Loading State -->
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
        <p class="text-body-1 text-medium-emphasis mt-4">
          Loading donation packages...
        </p>
      </v-col>
    </v-row>

    <!-- No Packages Found -->
    <v-row v-if="!isLoading && packages.length === 0">
      <v-col
        class="text-center"
        cols="12"
      >
        <v-icon
          class="mb-4"
          color="disabled"
          size="64"
        >
          mdi-package-variant-closed
        </v-icon>
        <h3 class="text-h5 font-weight-bold mb-2">
          No Donation Packages Available
        </h3>
        <p class="text-body-1 text-medium-emphasis">
          Check back later for sponsorship opportunities.
        </p>
      </v-col>
    </v-row>

    <!-- Sponsorship Form Dialog -->
    <v-dialog
      v-model="showSponsorshipDialog"
      max-width="600"
      persistent
    >
      <v-card>
        <v-card-title
          class="d-flex align-center justify-space-between py-6 px-6 bg-primary text-white"
        >
          <div class="d-flex align-center">
            <v-icon
              class="mr-3"
              size="28"
            >
              mdi-gift
            </v-icon>
            <span class="text-h5 font-weight-medium">Complete Sponsorship</span>
          </div>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            @click="closeSponsorshipDialog"
          />
        </v-card-title>

        <v-card-text class="pa-6">
          <!-- Package Summary -->
          <v-card
            class="mb-6"
            color="primary"
            variant="tonal"
          >
            <v-card-text class="pa-4">
              <div class="d-flex align-center justify-space-between">
                <div>
                  <h4 class="text-h6 font-weight-semibold text-primary mb-1">
                    {{ selectedPackage?.name }}
                  </h4>
                  <p class="text-body-2 text-primary">
                    {{ selectedPackage?.description }}
                  </p>
                </div>
                <div class="text-right">
                  <div class="text-h5 font-weight-bold text-primary">
                    {{ formatPrice(selectedPackage?.price, selectedPackage?.currency) }}
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>

          <!-- Sponsor Information Form -->
          <v-form
            ref="sponsorshipForm"
            v-model="isFormValid"
          >
            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="sponsorForm.firstName"
                  :rules="[(v) => !!v || 'First name is required']"
                  density="compact"
                  hide-details="auto"
                  label="First Name"
                  required
                  variant="solo"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="sponsorForm.lastName"
                  :rules="[(v) => !!v || 'Last name is required']"
                  density="compact"
                  hide-details="auto"
                  label="Last Name"
                  required
                  variant="solo"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="sponsorForm.email"
                  :rules="[
                    (v) => !!v || 'Email is required',
                    (v) => /.+@.+\..+/.test(v) || 'Email must be valid',
                  ]"
                  density="compact"
                  hide-details="auto"
                  label="Email"
                  required
                  type="email"
                  variant="solo"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="sponsorForm.phone"
                  density="compact"
                  hide-details="auto"
                  label="Phone (Optional)"
                  variant="solo"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="sponsorForm.organization"
                  density="compact"
                  hide-details="auto"
                  label="Organization (Optional)"
                  variant="solo"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12">
                <v-textarea
                  v-model="sponsorForm.message"
                  density="compact"
                  hide-details="auto"
                  label="Message (Optional)"
                  placeholder="Share why you're supporting this event..."
                  rows="3"
                  variant="solo"
                />
              </v-col>
            </v-row>
          </v-form>

          <!-- Payment Section -->
          <v-divider class="my-6" />

          <div class="mb-4">
            <h4 class="text-h6 font-weight-semibold mb-3">
              Payment Information
            </h4>
            <div
              id="card-element"
              class="payment-element-container"
            />
            <div
              id="card-errors"
              class="text-error text-body-2 mt-2"
              role="alert"
            />
          </div>

          <!-- Terms and Conditions -->
          <v-checkbox
            v-model="acceptedTerms"
            :rules="[(v) => !!v || 'You must accept the terms and conditions']"
            class="mb-4"
            label="I agree to the terms and conditions"
            required
          />
        </v-card-text>

        <v-card-actions class="pa-6 pt-0">
          <v-btn
            :disabled="!isFormValid || !acceptedTerms || isProcessing"
            :loading="isProcessing"
            block
            color="primary"
            size="large"
            variant="elevated"
            @click="processSponsorship"
          >
            <v-icon start>
              mdi-credit-card
            </v-icon>
            Complete Sponsorship -
            {{ formatPrice(selectedPackage?.price, selectedPackage?.currency) }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Success Dialog -->
    <v-dialog
      v-model="showSuccessDialog"
      max-width="500"
      persistent
    >
      <v-card>
        <v-card-text class="text-center pa-6">
          <v-icon
            class="mb-4"
            color="success"
            size="64"
          >
            mdi-check-circle
          </v-icon>
          <h3 class="text-h5 font-weight-bold mb-2 text-success">
            Sponsorship Successful!
          </h3>
          <p class="text-body-1 text-medium-emphasis mb-4">
            Thank you for your generous support! You will receive a confirmation email shortly.
          </p>
          <v-btn
            color="primary"
            size="large"
            variant="elevated"
            @click="closeSuccessDialog"
          >
            Continue
          </v-btn>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

const store = useStore()
const route = useRoute()
const router = useRouter()

const event = computed(() => store.state.event.event)
const packages = computed(() => store.state.sponsorshipPackage.packages)

// State
const isLoading = ref(false)
const isProcessing = ref(false)
const showSponsorshipDialog = ref(false)
const showSuccessDialog = ref(false)
const selectedPackage = ref(null)
const isFormValid = ref(false)
const acceptedTerms = ref(false)

// Form data
const sponsorForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  organization: '',
  message: '',
})

// Stripe elements
let stripe = null
let elements = null
let cardElement = null

const fetchData = async () => {
  try {
    isLoading.value = true
    if (event.value.id) {
      await store.dispatch('sponsorshipPackage/setPackages', route.params.eventId)
    } else {
      await Promise.all([
        store.dispatch('event/setEvent', { eventId: route.params.eventId }),
        store.dispatch('sponsorshipPackage/setPackages', route.params.eventId),
      ])
    }
  } catch (error) {
    toast.error('Failed to fetch data!')
  } finally {
    isLoading.value = false
  }
}

const formatPrice = (price, currency) => {
  if (!price) return ''
  // Convert cents to currency units (prices are always stored in cents)
  const amount = price / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount)
}

const selectPackage = (pkg) => {
  selectedPackage.value = pkg
  showSponsorshipDialog.value = true
  // Initialize Stripe after dialog opens
  setTimeout(() => {
    initializeStripe()
  }, 100)
}

const closeSponsorshipDialog = () => {
  showSponsorshipDialog.value = false
  selectedPackage.value = null
  resetForm()
  if (cardElement) {
    cardElement.destroy()
    cardElement = null
  }
}

const closeSuccessDialog = () => {
  showSuccessDialog.value = false
  router.push({ name: 'landing' })
}

const resetForm = () => {
  sponsorForm.value = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    organization: '',
    message: '',
  }
  acceptedTerms.value = false
  isFormValid.value = false
}

const initializeStripe = async () => {
  try {
    // Load Stripe
    if (!window.Stripe) {
      const script = document.createElement('script')
      script.src = 'https://js.stripe.com/v3/'
      script.onload = () => setupStripe()
      document.head.appendChild(script)
    } else {
      setupStripe()
    }
  } catch (error) {
    toast.error('Failed to initialize payment system')
  }
}

const setupStripe = () => {
  try {
    // Initialize Stripe with your publishable key
    stripe = window.Stripe(import.meta.env.VITE_STRIPE_PUBLIC)
    elements = stripe.elements()

    // Create card element
    cardElement = elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#424770',
          '::placeholder': {
            color: '#aab7c4',
          },
        },
        invalid: {
          color: '#9e2146',
        },
      },
    })

    cardElement.mount('#card-element')

    // Handle validation errors
    cardElement.on('change', ({ error }) => {
      const displayError = document.getElementById('card-errors')
      if (error) {
        displayError.textContent = error.message
      } else {
        displayError.textContent = ''
      }
    })
  } catch (error) {
    toast.error('Failed to set up payment form')
  }
}

const processSponsorship = async () => {
  if (!stripe || !cardElement) {
    toast.error('Payment system not ready')
    return
  }

  try {
    isProcessing.value = true

    // Create payment intent
    const response = await store.dispatch('sponsorship/createSponsorshipPaymentIntent', {
      packageId: selectedPackage.value.id,
      amount: selectedPackage.value.price,
      currency: selectedPackage.value.currency,
      sponsorEmail: sponsorForm.value.email,
      eventId: route.params.eventId,
    })

    const { clientSecret } = response.data.payload

    // Confirm payment
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: `${sponsorForm.value.firstName} ${sponsorForm.value.lastName}`,
          email: sponsorForm.value.email,
          phone: sponsorForm.value.phone || undefined,
        },
      },
    })

    if (error) {
      toast.error(error.message || 'Payment failed')
      return
    }

    if (paymentIntent.status === 'succeeded') {
      // Create sponsorship record
      await store.dispatch('sponsorship/createSponsorship', {
        sponsorData: {
          firstName: sponsorForm.value.firstName,
          lastName: sponsorForm.value.lastName,
          email: sponsorForm.value.email,
          phone: sponsorForm.value.phone,
          organization: sponsorForm.value.organization,
          message: sponsorForm.value.message,
        },
        packageType: selectedPackage.value.name,
        amount: selectedPackage.value.price,
        currency: selectedPackage.value.currency,
        eventId: route.params.eventId,
        clubId: event.value.clubId,
        paymentStatus: 'paid',
        stripePaymentIntentId: paymentIntent.id,
      })

      closeSponsorshipDialog()
      showSuccessDialog.value = true
    }
  } catch (error) {
    toast.error('Failed to process sponsorship')
  } finally {
    isProcessing.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.event-sponsorship-container {
  max-width: 1200px;
  margin: 0 auto;
}

.sponsorship-package-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.sponsorship-package-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.selected-package {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 1px rgb(var(--v-theme-primary));
}

.payment-element-container {
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 8px;
  padding: 16px;
  background: rgb(var(--v-theme-surface));
}

.text-disabled {
  color: rgb(var(--v-theme-disabled)) !important;
}

.h-100 {
  height: 100%;
}
</style>
