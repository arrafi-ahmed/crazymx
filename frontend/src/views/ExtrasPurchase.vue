<script setup>
import PageTitle from '@/components/PageTitle.vue'
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useDisplay } from 'vuetify'
import { loadStripe } from '@stripe/stripe-js/pure'
import { stripePublic } from '@/others/util'
import NoItemsFound from '@/components/NoItemsFound.vue'

const { xs } = useDisplay()
const store = useStore()
const route = useRoute()
const router = useRouter()

const event = computed(() => store.getters['event/getEventById'](route.params.eventId))

const extras = computed(() => store.state.extras.extras)
const isLoading = ref(false)
const isProcessingPayment = ref(false)
const showPaymentForm = ref(false)
const paymentClientSecret = ref('')

// Selected extras
const selectedExtras = ref([])

// Registration data
const registrationData = ref(null)

const fetchExtras = async () => {
  try {
    isLoading.value = true
    await store.dispatch('extras/setExtras', route.params.eventId)
  } catch (error) {
    toast.error('Failed to load extras.')
  } finally {
    isLoading.value = false
  }
}

const toggleExtrasSelection = (extrasId) => {
  const index = selectedExtras.value.indexOf(extrasId)
  if (index > -1) {
    selectedExtras.value.splice(index, 1)
  } else {
    selectedExtras.value.push(extrasId)
  }
}

const isExtrasSelected = (extrasId) => {
  return selectedExtras.value.includes(extrasId)
}

const getTotalPrice = () => {
  return selectedExtras.value.reduce((total, extrasId) => {
    const extra = extras.value.find((e) => e.id === extrasId)
    return total + (extra ? extra.price : 0)
  }, 0)
}

const processPayment = async () => {
  if (selectedExtras.value.length === 0) {
    toast.error('Please select at least one voucher.')
    return
  }

  if (!registrationData.value) {
    toast.error('Registration data not found. Please register first.')
    return
  }

  isProcessingPayment.value = true

  try {
    const response = await store.dispatch('extras/purchaseExtras', {
      extrasIds: selectedExtras.value,
      registrationId: registrationData.value.id,
      customerEmail: registrationData.value.registrationData.email,
      eventId: route.params.eventId,
    })

    const result = response.data

    if (result.payload?.clientSecret && result.payload.clientSecret !== 'no-stripe') {
      // Initialize Stripe Elements for payment
      const stripe = await loadStripe(stripePublic)

      // Create payment element
      const elements = stripe.elements({
        clientSecret: result.payload.clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#1976d2',
          },
        },
      })

      const paymentElement = elements.create('payment')

      // Show payment form
      showPaymentForm.value = true
      paymentClientSecret.value = result.payload.clientSecret
    } else {
      // Free extras or no Stripe needed
      toast.success(
        'Vouchers purchased successfully! You will receive a confirmation email shortly.',
      )

      // Redirect to success page
      router.push({
        name: 'event-register-success-slug',
        params: {
          slug: route.params.slug,
        },
      })
    }
  } catch (error) {
    toast.error(`Purchase failed: ${error.message}. Please try again.`)
  } finally {
    isProcessingPayment.value = false
  }
}

const formatPrice = (price) => {
  // Convert cents to currency units (prices are always stored in cents)
  const amount = price / 100
  // Get currency from event with validation
  const currency = event.value?.currency
  const validCurrency = (currency && typeof currency === 'string' && currency.length === 3)
    ? currency.toUpperCase()
    : 'USD'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: validCurrency,
  }).format(amount)
}

onMounted(async () => {
  await fetchExtras()

  // Try to get registration data from localStorage as fallback
  const storedData = localStorage.getItem('registrationData')
  if (storedData) {
    try {
      const parsedData = JSON.parse(storedData)
      registrationData.value = parsedData

      // If we have event data, try to fetch registration from database
      if (event.value?.id && parsedData.email) {
        try {
          const dbRegistration = await store.dispatch('registration/getRegistrationByEmail', {
            email: parsedData.email,
            eventId: event.value.id,
          })

          if (dbRegistration) {
            // Use database registration data instead of localStorage
            const regData = dbRegistration.registration_data || {}
            registrationData.value = {
              firstName: regData.name?.split(' ')[0] || parsedData.firstName,
              lastName: regData.name?.split(' ').slice(1).join(' ') || parsedData.lastName,
              email: regData.email || parsedData.email,
              phone: regData.phone || parsedData.phone,
              organization: regData.organization || parsedData.organization,
              sector: regData.sector || parsedData.sector,
              expectation: regData.expectation || parsedData.expectation,
            }
          }
        } catch (error) {}
      }
    } catch (error) {
      registrationData.value = {}
    }
  } else {
    toast.error('No registration data found. Please register first.')
    // Try to get slug from registration data first, then from store
    const registrationData = JSON.parse(localStorage.getItem('registrationData') || '{}')
    const eventData = store.state.event.event

    if (registrationData.slug) {
      router.push({
        name: 'event-landing-slug',
        params: {
          slug: registrationData.slug,
        },
      })
    } else if (eventData && eventData.slug) {
      router.push({
        name: 'event-landing-slug',
        params: {
          slug: eventData.slug,
        },
      })
    } else {
      router.push({
        name: 'event-landing-slug',
        params: {
          slug: route.params.slug,
        },
      })
    }
  }
})
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <page-title
          :sub-title="event?.name"
          justify="space-between"
          title="Purchase Vouchers"
        >
          <v-btn
            icon="mdi-arrow-left"
            variant="text"
            @click="$router.back()"
          />
        </page-title>
      </v-col>
    </v-row>

    <v-row>
      <v-col>
        <v-card>
          <v-card-title>Available Vouchers</v-card-title>
          <v-card-text>
            <div v-if="extras.length > 0">
              <v-row>
                <v-col
                  v-for="extra in extras"
                  :key="extra.id"
                  cols="12"
                  lg="4"
                  md="6"
                >
                  <v-card
                    :class="{ selected: isExtrasSelected(extra.id) }"
                    class="extras-card"
                    elevation="2"
                    @click="toggleExtrasSelection(extra.id)"
                  >
                    <v-card-title class="d-flex justify-space-between">
                      <span>{{ extra.name }}</span>
                      <v-chip color="primary">
                        {{ formatPrice(extra.price) }}
                      </v-chip>
                    </v-card-title>

                    <v-card-text>
                      <p class="text-body-2 mb-4">
                        {{ extra.description }}
                      </p>

                      <div v-if="extra.content && extra.content.length > 0">
                        <div class="text-caption font-weight-medium mb-2">
                          Contents:
                        </div>
                        <v-list density="compact">
                          <v-list-item
                            v-for="(item, index) in extra.content"
                            :key="index"
                            class="pa-0"
                          >
                            <template #prepend>
                              <v-chip
                                density="comfortable"
                                size="small"
                              >
                                {{ item.quantity }}x
                              </v-chip>
                            </template>
                            <v-list-item-title class="text-body-2">
                              {{ item.name }}
                            </v-list-item-title>
                          </v-list-item>
                        </v-list>
                      </div>
                    </v-card-text>

                    <v-card-actions>
                      <v-spacer />
                      <v-icon
                        :color="isExtrasSelected(extra.id) ? 'primary' : 'grey'"
                        :icon="
                          isExtrasSelected(extra.id) ? 'mdi-check-circle' : 'mdi-circle-outline'
                        "
                      />
                    </v-card-actions>
                  </v-card>
                </v-col>
              </v-row>

              <!-- Total and Purchase Button -->
              <div class="text-center mt-8">
                <div class="text-h5 mb-4">
                  Total: {{ formatPrice(getTotalPrice()) }}
                </div>
                <v-btn
                  :disabled="selectedExtras.length === 0"
                  :loading="isProcessingPayment"
                  class="elevation-10"
                  color="primary"
                  size="x-large"
                  @click="processPayment"
                >
                  {{
                    isProcessingPayment
                      ? 'Processing Payment...'
                      : `Purchase Vouchers - ${formatPrice(getTotalPrice())}`
                  }}
                </v-btn>
              </div>
            </div>

            <no-items-found
              v-else
              message="No vouchers are currently available for this event."
              title="No vouchers available"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Payment Form Dialog -->
    <v-dialog
      v-model="showPaymentForm"
      max-width="500"
      persistent
    >
      <v-card>
        <v-card-title>Complete Payment</v-card-title>
        <v-card-text>
          <div id="payment-element" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="grey"
            variant="text"
            @click="showPaymentForm = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="confirmPayment"
          >
            Pay {{ formatPrice(getTotalPrice()) }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.extras-card {
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  border: 2px solid transparent;
}

.extras-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.extras-card.selected {
  border-color: #1976d2;
  background-color: #f3f8ff;
}

#payment-element {
  margin: 20px 0;
}
</style>
