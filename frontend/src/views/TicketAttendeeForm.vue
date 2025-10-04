<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { toast } from 'vue-sonner'
import { Attendee } from '@/models/index.js'

const route = useRoute()
const router = useRouter()
const store = useStore()

const currentStep = ref(0)
const isLoading = ref(false)
const isDataReady = ref(false)
const attendeeForm = ref(null)
const isFormValid = ref(true)

const tickets = computed(() => store.state.ticket.tickets || [])
const selectedTickets = computed(() => JSON.parse(localStorage.getItem('selectedTickets')) || [])
const attendees = ref()
const totalAttendees = computed(() => {
  return selectedTickets.value.reduce((sum, ticket) => {
    const quantity = ticket.quantity || 1

    return sum + quantity
  }, 0)
})

// Quick lookup for title by id (display-only)
const ticketsById = computed(() => {
  const map = new Map()
  ;(selectedTickets.value || []).forEach((t) => map.set(t.ticketId, t))
  return map
})
const ticketTitleById = (id) => ticketsById.value.get(id)?.title ?? ''

// Count how many times a ticketId is already used by previous attendees
function usedCountBeforeIndex(ticketId, attendees, index) {
  let count = 0
  for (let i = 0; i < index; i++) {
    if (attendees[i]?.ticketId === ticketId) count++
  }
  return count
}

// Available options for the current attendee (respecting quantities)
function getAvailableTicketsForAttendee(attendees, selectedTickets, currentIndex) {
  const options = []
  const currentAttendee = attendees[currentIndex]
  
  for (const sel of selectedTickets || []) {
    const used = usedCountBeforeIndex(sel.ticketId, attendees, currentIndex)
    const remaining = (sel.quantity || 1) - used
    
    // Always include the ticket if it's already assigned to this attendee
    const isCurrentAttendeeTicket = currentAttendee && currentAttendee.ticketId === sel.ticketId
    
    if (remaining > 0 || isCurrentAttendeeTicket) {
      options.push({
        value: sel.ticketId,
        title: sel.title,
      })
    }
  }
  return options.map((o) => ({ value: o.value, title: o.title }))
}

function handleSelectTicket(ticketId) {
  const attendee = attendees.value[currentStep.value]
  if (!attendee) return
  attendee.ticketId = ticketId
  attendee.title = ticketTitleById(ticketId)
}

const nextStep = async () => {
  if (attendeeForm.value) {
    await attendeeForm.value.validate()
    if (!isFormValid.value) {
      return
    }
  }

  if (currentStep.value < totalAttendees.value - 1) {
    currentStep.value++
    attendees.value[currentStep.value] = new Attendee({ ...attendees.value[currentStep.value] })
  } else {
    proceedToCheckout()
  }
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const proceedToCheckout = async () => {
  try {
    isLoading.value = true

    // Prepare attendee data for checkout
    let formattedAttendees = attendees.value.map((attendee) => ({
      firstName: attendee.firstName,
      lastName: attendee.lastName,
      email: attendee.email,
      phone: attendee.phone,
      ticketId: attendee.ticketId,
      isPrimary: attendee.isPrimary,
    }))

    if (!selectedTickets.value.length) {
      toast.error('No ticket data found. Please return to tickets page.')
      return
    }

    // Redirect to checkout page
    localStorage.setItem('attendeesData', JSON.stringify(formattedAttendees))
    router.push({
      name: 'checkout-slug',
      params: { slug: route.params.slug },
    })
  } catch (error) {
    toast.error('Failed to proceed to checkout. Please try again.')
  } finally {
    isLoading.value = false
  }
}

const goBack = () => {
  localStorage.removeItem('selectedTickets.value')

  router.push({
    name: 'tickets-slug',
    params: { slug: route.params.slug },
  })
}

// Initialize data and forms when component mounts
const initializeData = async () => {
  // Get route params - only slug-based routing
  if (!route.params.slug) {
    return router.push({ name: 'homepage' })
  }

  if (!selectedTickets.value.length) {
    toast.error('No ticket data found. Please return to tickets page.')
    return router.push({
      name: 'tickets-slug',
      params: { slug: route.params.slug },
    })
  }
  attendees.value = [...JSON.parse(localStorage.getItem('attendeesData'))].map((i) => ({
    ...i,
    title: null,
  }))

  isDataReady.value = true
}

// Initialize when component mounts
onMounted(async () => {
  await initializeData()
})
</script>

<template>
  <section class="section">
    <v-container>
      <!-- Loading State -->
      <div
        v-if="!isDataReady"
        class="text-center py-16"
      >
        <v-progress-circular
          color="primary"
          indeterminate
          size="64"
          width="4"
        />
        <h3 class="text-h5 mt-6 mb-3">
          Loading attendee forms...
        </h3>
        <p class="text-body-1 text-medium-emphasis">
          Please wait while we prepare your registration forms.
        </p>
      </div>

      <!-- Main Content -->
      <div v-else>
        <v-row justify="center">
          <v-col
            cols="12"
            md="8"
          >
            <!-- Progress Indicator -->
            <v-card
              class="mb-6"
              elevation="2"
            >
              <v-card-text class="pa-4">
                <div class="d-flex align-center justify-space-between">
                  <span class="text-body-1">
                    Attendee {{ currentStep + 1 }} of {{ totalAttendees }}
                  </span>
                  <v-progress-linear
                    :model-value="((currentStep + 1) / totalAttendees) * 100"
                    color="primary"
                    height="8"
                    rounded
                  />
                </div>
              </v-card-text>
            </v-card>

            <!-- Attendee Form -->
            <v-card elevation="4">
              <v-card-title class="bg-primary text-white py-4">
                <h3 class="text-h5 font-weight-bold">
                  Attendee {{ currentStep + 1 }}:
                  {{ ticketTitleById(attendees[currentStep].ticketId) || 'Select Ticket Type' }}
                </h3>
              </v-card-title>

              <v-card-text class="pa-6">
                <v-form
                  ref="attendeeForm"
                  v-model="isFormValid"
                  @submit.prevent="nextStep"
                >
                  <v-row>
                    <v-col cols="12">
                      <v-select
                        v-model="attendees[currentStep].ticketId"
                        :items="
                          getAvailableTicketsForAttendee(attendees, selectedTickets, currentStep)
                        "
                        :rules="[(v) => !!v || 'Ticket type is required']"
                        density="comfortable"
                        item-title="title"
                        item-value="value"
                        label="Ticket Type *"
                        required
                        variant="solo"
                        hide-details="auto"
                        @update:model-value="handleSelectTicket"
                      />
                    </v-col>
                  </v-row>

                  <v-row>
                    <v-col
                      cols="12"
                      sm="6"
                    >
                      <v-text-field
                        v-model="attendees[currentStep].firstName"
                        :rules="[
                          (v) => !!v || 'First name is required',
                          (v) => (v && v.length <= 50) || 'Must not exceed 50 characters',
                        ]"
                        density="comfortable"
                        hide-details="auto"
                        label="First Name *"
                        required
                        variant="solo"
                      />
                    </v-col>
                    <v-col
                      cols="12"
                      sm="6"
                    >
                      <v-text-field
                        v-model="attendees[currentStep].lastName"
                        :rules="[
                          (v) => !!v || 'Last name is required',
                          (v) => (v && v.length <= 50) || 'Must not exceed 50 characters',
                        ]"
                        density="comfortable"
                        hide-details="auto"
                        label="Last Name *"
                        required
                        variant="solo"
                      />
                    </v-col>
                  </v-row>

                  <v-row>
                    <v-col
                      cols="12"
                      sm="6"
                    >
                      <v-text-field
                        v-model="attendees[currentStep].email"
                        :rules="[
                          (v) => !!v || 'Email is required',
                          (v) => /.+@.+\..+/.test(v) || 'Email must be valid',
                        ]"
                        density="comfortable"
                        hide-details="auto"
                        label="Email *"
                        required
                        type="email"
                        variant="solo"
                      />
                    </v-col>
                    <v-col
                      cols="12"
                      sm="6"
                    >
                      <v-text-field
                        v-model="attendees[currentStep].phone"
                        :rules="[
                          (v) => !!v || 'Phone is required',
                          (v) => (v && v.length >= 4) || 'Phone must be at least 4 digits',
                        ]"
                        density="comfortable"
                        hide-details="auto"
                        label="Phone *"
                        required
                        variant="solo"
                      />
                    </v-col>
                  </v-row>

                  <!-- Removed organization, sector, expectation fields - only essential fields needed -->
                </v-form>
              </v-card-text>

              <v-card-actions class="pa-6 pt-0">
                <v-spacer />
                <v-btn
                  v-if="currentStep > 0"
                  class="mr-4"
                  variant="outlined"
                  @click="prevStep"
                >
                  Previous
                </v-btn>
                <v-btn
                  :disabled="isLoading"
                  :loading="isLoading"
                  color="primary"
                  size="large"
                  variant="flat"
                  @click="nextStep"
                >
                  {{ currentStep < totalAttendees - 1 ? 'Next Attendee' : 'Complete Registration' }}
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </v-container>
  </section>
</template>

<style scoped>
.section {
  padding: 40px 0;
  background: linear-gradient(
    180deg,
    rgb(var(--v-theme-surfaceVariant)) 0%,
    rgb(var(--v-theme-surface)) 100%
  );
  min-height: calc(100vh - 64px);
}
</style>
