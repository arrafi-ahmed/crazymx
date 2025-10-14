<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import { formatEventDateDisplay, getApiPublicImageUrl, getClientPublicImageUrl } from '@/utils'

  definePage({
    name: 'event-landing-slug',
    meta: {
      layout: 'default',
      title: 'Event Registration',
    },
  })

  const { xs } = useDisplay()
  const store = useStore()
  const router = useRouter()
  const route = useRoute()

  // Event and Club data - using computed properties for reactive state
  const isLoading = ref(true)
  const event = computed(() => store.state.event.event)

  // Get event ID or slug from route
  const eventSlug = computed(() => route.params.slug || null)

  // Banner URL for responsive image rendering
  const heroBannerUrl = computed(() =>
    event.value?.banner
      ? getApiPublicImageUrl(event.value.banner, 'event-banner')
      : getClientPublicImageUrl('default-event2.jpeg'),
  )

  // Hero subtitle: "{{datetime}} — at {{location}}."
  const eventDateSubtitle = computed(() => {
    const loc = event.value?.location || 'TBA'
    const formattedDate = formatEventDateDisplay({ event: event.value, eventConfig: event.value?.config })
    return `${formattedDate} @ ${loc}.`
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

  const attendee = reactive({ ...attendeeInit.value })

  const registration = reactive({ additionalFields: { ...registrationInit.value } })

  const isProcessingPayment = ref(false)

  async function submitRegistration () {
    isProcessingPayment.value = true

    try {
      // Capture user timezone - store in dedicated fields
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const timezoneOffset = new Date().getTimezoneOffset()
      
      registration.userTimezone = userTimezone
      registration.timezoneOffset = timezoneOffset
      
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
        store.commit('addSnackbar', { text: 'Event information not available. Please try again.', color: 'error' })
      }
    } catch {
      store.commit('addSnackbar', { text: 'Registration failed. Please try again.', color: 'error' })
    } finally {
      isProcessingPayment.value = false
    }
  }

  // Fetch event and club data
  async function fetchEventData () {
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
    } catch {} finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    fetchEventData()
  })
</script>

<template>
  <div class="event-landing">
    <!-- Hero Section with fully visible banner -->
    <section class="hero-section">
      <v-container class="py-0">
        <div class="hero-wrap">
          <div class="hero-media">
            <v-img
              alt="Event Banner"
              class="hero-img rounded"
              :cover="true"
              eager
              :src="heroBannerUrl"
            />
            <div class="hero-overlay-grad" />
            <div class="hero-text-overlay">
              <div class="hero-text-chip">
                <h1 class="hero-title text-center">
                  {{ event?.name || 'Event Registration' }}
                </h1>
                <p class="hero-subtitle text-center">
                  {{ eventDateSubtitle }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </v-container>
    </section>

    <!-- Registration Form Section -->
    <section class="registration-section">
      <v-container class="py-8">
        <div class="form-container maxw-narrow">
          <div class="form-header text-center mb-4">
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
                    block
                    class="submit-btn"
                    color="primary"
                    :disabled="isLoading"
                    :loading="isProcessingPayment"
                    rounded="xl"
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
/* Layout constraints */
.maxw-narrow {
  max-width: 600px;
  margin: 0 auto;
}

/* Hero adjustments */
.hero-section {
  background: rgb(var(--v-theme-surface));
}

.hero-wrap {
  max-width: 1100px;
  margin: 0 auto;
}

.hero-media {
  position: relative;
}

.hero-img {
  width: 100%;
  height: 320px;
  object-fit: contain;
  background: rgb(var(--v-theme-surfaceVariant));
}

.hero-overlay-grad {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.15) 40%, rgba(0, 0, 0, 0) 100%);
  pointer-events: none;
}

.hero-text-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 18px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.hero-title {
  margin: 0;
  font-weight: 700;
}

.hero-subtitle {
  margin: 6px 0 0 0;
  opacity: 0.9;
}

.hero-text-chip {
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 12px 16px;
  border-radius: 14px;
  max-width: 860px;
  margin: 0 auto;
}

.hero-text-chip .hero-title,
.hero-text-chip .hero-subtitle {
  color: white;
}
</style>
