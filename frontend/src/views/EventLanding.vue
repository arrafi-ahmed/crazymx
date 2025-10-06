<script setup>
import { getApiPublicImageUrl, getClientPublicImageUrl, formatDate, formatDateTime } from '@/others/util'
import { computed, onMounted, reactive, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Attendee, Registration } from '@/models/index.js'

const { xs } = useDisplay()
const store = useStore()
const router = useRouter()
const route = useRoute()

// Event and Club data - using computed properties for reactive state
const isLoading = ref(true)
const event = computed(() => store.state.event.event)

// Get event ID or slug from route
const eventSlug = computed(() => route.params.slug || null)

// Hero background style with event banner or fallback
const heroBackgroundStyle = computed(() => {
  if (event.value?.banner) {
    return {
      background: `url('${getApiPublicImageUrl(event.value.banner, 'event-banner')}') center/cover no-repeat`,
    }
  }
  return {
    background: `url('${getClientPublicImageUrl('default-event2.jpeg')}') center/cover no-repeat`,
  }
})

// Hero subtitle: "{{datetime}} — at {{location}}."
const eventDateSubtitle = computed(() => {
  const start = event.value?.startDate
  const end = event.value?.endDate
  const loc = event.value?.location || 'TBA'
  const isSingleDay = event.value?.config?.isSingleDayEvent === true

  if (start && end) {
    if (isSingleDay) return `${formatDate(start)} — at ${loc}.`
    const sameDay = new Date(start).toDateString() === new Date(end).toDateString()
    const datePart = sameDay ? `${formatDate(start)}` : `${formatDate(start)} - ${formatDate(end)}`
    return `${datePart} — at ${loc}.`
  }
  if (start) {
    return `${formatDate(start)} — at ${loc}.`
  }
  return `Date TBA — at ${loc}.`
})

const attendeeInit = ref({
  firstName: null,
  lastName: null,
  email: null,
  phone: null,
  isPrimary: true,
})
const registrationInit = ref({
  organization: null,
  sector: null,
  expectation: null,
})

const attendee = reactive({
  ...new Attendee({ ...attendeeInit.value }),
})

const registration = reactive({
  ...new Registration({ additionalFields: { ...registrationInit.value } }),
})

const isProcessingPayment = ref(false)

const submitRegistration = async () => {
  isProcessingPayment.value = true

  try {
    // Ensure we have event and club data, use defaults if not available
    registration.eventId = event.value?.id || 1
    localStorage.setItem('registrationData', JSON.stringify(registration))
    localStorage.setItem('attendeesData', JSON.stringify([attendee]))

    // Redirect to tickets page using Vue Router
    // Only slug-based routing
    if (event.value?.slug) {
      router.push({
        name: 'tickets-slug',
        params: {
          slug: event.value.slug || eventSlug.value,
        },
      })
    } else {
      // No slug available, redirect to homepage
      toast.error('Event information not available. Please try again.')
    }
  } catch (error) {
    toast.error('Registration failed. Please try again.')
  } finally {
    isProcessingPayment.value = false
  }
}

// Fetch event and club data
const fetchEventData = async () => {
  try {
    isLoading.value = true

    // Try to fetch by slug first if available
    if (eventSlug.value) {
      try {
        await store.dispatch('event/setEventBySlug', { slug: eventSlug.value })
        // Check if event was found
        if (!event.value || !event.value.id) {
          router.push({
            name: 'not-found',
            params: { status: 404, message: 'Event not found!' },
          })
          return
        }
      } catch (slugError) {
        console.warn('Failed to fetch event by slug:', slugError)
        router.push({
          name: 'not-found',
          params: { status: 404, message: 'Event not found!' },
        })
        return
      }
    }
  } catch (error) {
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchEventData()
})
</script>

<template>
  <div class="event-landing">
    <!-- Compact Hero Section -->
    <section class="hero-section">
      <div
        :style="heroBackgroundStyle"
        class="hero-bg"
      >
        <div class="hero-overlay" />
        <div class="hero-content">
          <div class="hero-text">
            <h1 class="hero-title">
              {{ event?.name || 'Event Registration' }}
            </h1>
            <p class="hero-subtitle">
              {{ eventDateSubtitle }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Registration Form Section -->
    <section class="registration-section">
      <v-container class="py-8">
        <div class="form-container">
          <div class="form-header">
            <h2 class="form-title">
              Complete Your Registration
            </h2>
            <p class="form-subtitle">
              Enter your details to proceed to ticket selection
            </p>
          </div>

          <v-card
            class="registration-form"
            elevation="2"
          >
            <v-card-text class="pa-6">
              <v-form @submit.prevent="submitRegistration">
                <v-row no-gutters>
                  <v-col
                    cols="12"
                    md="6"
                  >
                    <v-text-field
                      v-model="attendee.firstName"
                      class="mb-4"
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
                      v-model="attendee.lastName"
                      class="mb-4"
                      hide-details="auto"
                      label="Last Name"
                      required
                      variant="solo"
                    />
                  </v-col>
                </v-row>

                <v-text-field
                  v-model="attendee.email"
                  class="mb-4"
                  hide-details="auto"
                  label="Email"
                  required
                  type="email"
                  variant="solo"
                />

                <v-text-field
                  v-model="attendee.phone"
                  class="mb-6"
                  hide-details="auto"
                  label="Phone Number"
                  required
                  variant="solo"
                />

                <v-alert
                  v-if="isLoading"
                  class="mb-4"
                  type="info"
                  variant="tonal"
                >
                  Loading event information...
                </v-alert>

                <div class="form-actions">
                  <v-btn
                    :disabled="isLoading"
                    :loading="isProcessingPayment"
                    block
                    class="submit-btn"
                    color="primary"
                    size="large"
                    type="submit"
                  >
                    {{ isProcessingPayment ? 'Processing...' : 'Continue' }}
                  </v-btn>
                </div>
              </v-form>
            </v-card-text>
          </v-card>
        </div>
      </v-container>
    </section>
  </div>
</template>

<style scoped>
.event-landing {
  min-height: 100vh;
  background: #f8f9fa;
}

/* Hero Section - Reduced Height */
.hero-section {
  position: relative;
  height: 250px;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
}

.hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
  z-index: 2;
}

.hero-content {
  position: relative;
  z-index: 3;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 24px;
}

.hero-text {
  max-width: 800px;
}

.hero-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: white;
  margin-bottom: 16px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  line-height: 1.2;
}

.hero-subtitle {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

/* Registration Section */
.registration-section {
  background: white;
  position: relative;
  z-index: 4;
}

.form-container {
  max-width: 600px;
  margin: 0 auto;
}

.form-header {
  text-align: center;
  margin-bottom: 32px;
}

.form-title {
  font-size: 2rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 12px;
}

.form-subtitle {
  font-size: 1.1rem;
  color: #6c757d;
  margin: 0;
}

.registration-form {
  border-radius: 16px;
  border: 1px solid #e9ecef;
  background: white;
}

.submit-btn {
  height: 48px;
  font-weight: 600;
  text-transform: none;
  font-size: 1rem;
  border-radius: 8px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .hero-section {
    height: 300px;
  }

  .hero-title {
    font-size: 2rem;
  }

  .hero-subtitle {
    font-size: 1rem;
  }

  .form-title {
    font-size: 1.75rem;
  }

  .registration-form {
    margin: 0 16px;
  }
}

@media (max-width: 480px) {
  .hero-section {
    height: 250px;
  }

  .hero-title {
    font-size: 1.75rem;
  }

  .form-title {
    font-size: 1.5rem;
  }
}
</style>
