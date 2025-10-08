<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
import PageTitle from '@/components/PageTitle.vue'

const { xs } = useDisplay()
const store = useStore()
const route = useRoute()
const router = useRouter()

const event = computed(() => store.getters['event/getEventById'](route.params.eventId))

const tickets = computed(() => store.state.ticket.tickets)
const isLoading = ref(false)

// Ticket form data
const ticketDialog = ref(false)
const isEditing = ref(false)
const form = ref(null)
const isFormValid = ref(true)

const ticketInit = {
  id: null,
  title: '',
  description: '',
  price: 0,
  currentStock: 100,
  maxStock: 100,
  eventId: route.params.eventId,
}

const ticket = reactive({ ...ticketInit })



const openAddDialog = () => {
  isEditing.value = false
  Object.assign(ticket, {
    ...ticketInit,
    eventId: route.params.eventId,
    currentStock: 100,
    maxStock: 100,
  })
  ticketDialog.value = true
}

const openEditDialog = (selectedTicket) => {
  isEditing.value = true
  // Convert cents back to dollars for editing
  const ticketData = {
    ...selectedTicket,
    price: selectedTicket.price / 100, // Convert cents to dollars
  }
  Object.assign(ticket, ticketData)
  ticketDialog.value = true
}

const closeDialog = () => {
  ticketDialog.value = false
  Object.assign(ticket, { ...ticketInit })
}

const handleSubmitTicket = async () => {
  await form.value.validate()
  if (!isFormValid.value) return

  try {
    isLoading.value = true

    // Convert dollars to cents for storage
    const ticketData = {
      ...ticket,
      price: Math.round(ticket.price * 100), // Convert dollars to cents
    }

    const result = await store.dispatch('ticket/saveTicket', ticketData)

    closeDialog()
    // No need to fetchTickets() since the store already updates the local state
  } catch (error) {
    // Backend already sends error message via ApiResponse
  } finally {
    isLoading.value = false
  }
}

const deleteTicket = async (ticketId) => {
  try {
    await store.dispatch('ticket/removeTicket', {
      ticketId,
      eventId: route.params.eventId,
    })
    // No need to fetchTickets() since the store already updates the local state
  } catch (error) {
  }
}

const fetchTickets = async () => {
  try {
    await store.dispatch('ticket/setTickets', route.params.eventId)
  } catch (error) {
    // Backend already sends error message via ApiResponse
  }
}

const formatPrice = (price) => {
  // Get currency from event with validation
  const currency = event.value?.currency
  const validCurrency = (currency && typeof currency === 'string' && currency.length === 3)
    ? currency.toUpperCase()
    : 'USD'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: validCurrency,
  }).format(price / 100) // Convert cents to dollars
}

onMounted(() => {
  fetchTickets()
})
</script>

<template>
  <v-container class="tickets-container">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <PageTitle
          :subtitle="event?.name"
          title="Manage Tickets"
        >
          <template #actions>
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              size="large"
              variant="elevated"
              @click="openAddDialog"
            >
              Add Ticket
            </v-btn>
          </template>

          <template #mobile-actions>
            <v-btn
              color="primary"
              icon="mdi-plus"
              size="large"
              variant="elevated"
              @click="openAddDialog"
            />
          </template>
        </PageTitle>
      </v-col>
    </v-row>

    <!-- Tickets Grid -->
    <v-row v-if="tickets.length > 0">
      <v-col
        v-for="ticket in tickets"
        :key="ticket.id"
        cols="12"
        lg="4"
        md="6"
      >
        <v-card
          class="ticket-card"
          elevation="4"
        >
          <v-card-text class="pa-6">
            <div class="d-flex justify-space-between align-start mb-4">
              <h3 class="text-h5 font-weight-bold">
                {{ ticket.title }}
              </h3>
              <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    icon="mdi-dots-vertical"
                    size="small"
                    v-bind="props"
                    variant="text"
                  />
                </template>
                <v-list
                  density="compact"
                  width="250"
                >
                  <v-list-item
                    prepend-icon="mdi-pencil"
                    title="Edit"
                    @click="openEditDialog(ticket)"
                  />
                  <v-divider />
                  <confirmation-dialog @confirm="deleteTicket(ticket.id)">
                    <template #activator="{ onClick }">
                      <v-list-item
                        class="text-error"
                        prepend-icon="mdi-delete"
                        title="Delete"
                        @click.stop="onClick"
                      />
                    </template>
                  </confirmation-dialog>
                </v-list>
              </v-menu>
            </div>

            <p class="text-body-2 mb-4 text-medium-emphasis">
              {{ ticket.description }}
            </p>

            <div class="ticket-details">
              <div class="d-flex justify-space-between align-center mb-3">
                <div>
                  <div class="text-h4 font-weight-bold text-primary">
                    {{ formatPrice(ticket.price) }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Stock: {{ ticket.currentStock || 0 }}/{{ ticket.maxStock || 0 }}
                  </div>
                </div>
                <v-chip
                  :color="ticket.currentStock > 0 ? 'success' : 'error'"
                  size="small"
                  variant="elevated"
                >
                  {{ ticket.currentStock > 0 ? 'Available' : 'Sold Out' }}
                </v-chip>
              </div>

              <!-- Stock Progress Bar -->
              <v-progress-linear
                :color="ticket.currentStock > 0 ? 'success' : 'error'"
                :model-value="
                  ticket.maxStock > 0 ? (ticket.currentStock / ticket.maxStock) * 100 : 0
                "
                class="mb-2"
                height="8"
                rounded
              />
              <div class="text-caption text-medium-emphasis text-center">
                {{
                  ticket.maxStock > 0
                    ? Math.round((ticket.currentStock / ticket.maxStock) * 100)
                    : 0
                }}% remaining
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Empty State -->
    <v-row v-else>
      <v-col cols="12">
        <v-card
          class="empty-state-card"
          elevation="2"
        >
          <v-card-text class="text-center pa-8">
            <v-icon
              class="mb-4"
              color="grey-lighten-1"
              size="64"
            >
              mdi-ticket
            </v-icon>
            <h3 class="text-h5 mb-3">
              No Tickets Found
            </h3>
            <p class="text-body-1 text-medium-emphasis mb-6">
              Create tickets for your event to start accepting registrations. You can offer free or
              paid tickets.
            </p>
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              size="large"
              variant="elevated"
              @click="openAddDialog"
            >
              Create Your First Ticket
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Ticket Dialog -->
    <v-dialog
      v-model="ticketDialog"
      max-width="600"
      persistent
    >
      <v-card
        class="form-card"
        elevation="4"
      >
        <v-card-text class="pa-6">
          <div class="text-center mb-6">
            <h2 class="text-h4 font-weight-bold mb-2">
              {{ isEditing ? 'Edit Ticket' : 'Add New Ticket' }}
            </h2>
            <p class="text-body-1 text-medium-emphasis">
              {{
                isEditing
                  ? 'Update ticket details and pricing'
                  : 'Create a new ticket for your event'
              }}
            </p>
          </div>

          <v-form
            ref="form"
            v-model="isFormValid"
            fast-fail
          >
            <v-text-field
              v-model="ticket.title"
              :rules="[(v) => !!v || 'Title is required!']"
              class="mb-4"
              density="comfortable"
              hide-details="auto"
              label="Ticket Title"
              prepend-inner-icon="mdi-ticket"
              required
              variant="solo"
            />

            <v-textarea
              v-model="ticket.description"
              class="mb-4"
              density="comfortable"
              hide-details="auto"
              label="Description (optional)"
              prepend-inner-icon="mdi-text-box"
              rows="3"
              variant="solo"
            />

            <div class="d-flex gap-4 mb-4">
              <v-text-field
                v-model.number="ticket.price"
                :rules="[(v) => v >= 0 || 'Price must be non-negative']"
                class="flex-1"
                density="comfortable"
                hide-details="auto"
                label="Price"
                min="0"
                step="0.01"
                type="number"
                variant="solo"
              />
            </div>

            <div class="d-flex gap-4 mb-6">
              <v-text-field
                v-model.number="ticket.currentStock"
                :rules="[(v) => v >= 0 || 'Current stock must be non-negative']"
                class="flex-1"
                density="comfortable"
                hide-details="auto"
                label="Current Stock"
                min="0"
                prepend-inner-icon="mdi-package-variant"
                type="number"
                variant="solo"
              />
              <v-text-field
                v-model.number="ticket.maxStock"
                :rules="[
                  (v) => !!v || 'Max stock is required!',
                  (v) => v >= 0 || 'Max stock must be non-negative',
                  (v) => v >= ticket.currentStock || 'Max stock must be >= current stock',
                ]"
                class="flex-1"
                density="comfortable"
                hide-details="auto"
                label="Max Stock"
                min="0"
                prepend-inner-icon="mdi-package-variant-closed"
                required
                type="number"
                variant="solo"
              />
            </div>

            <v-alert
              v-if="ticket.price > 0"
              class="mb-4"
              density="comfortable"
              type="info"
              variant="tonal"
            >
              <template #prepend>
                <v-icon>mdi-credit-card</v-icon>
              </template>
              This ticket will be processed through Stripe for payments.
            </v-alert>
            <v-alert
              v-else
              class="mb-4"
              density="comfortable"
              type="success"
              variant="tonal"
            >
              <template #prepend>
                <v-icon>mdi-check-circle</v-icon>
              </template>
              This is a free ticket - no payment required.
            </v-alert>

            <div class="d-flex align-center mt-6">
              <v-spacer />
              <v-btn
                :disabled="isLoading"
                :size="xs ? 'default' : 'large'"
                class="mr-3"
                color="grey"
                variant="outlined"
                @click="closeDialog"
              >
                Cancel
              </v-btn>
              <v-btn
                :disabled="!isFormValid"
                :loading="isLoading"
                :size="xs ? 'default' : 'large'"
                color="primary"
                variant="elevated"
                @click="handleSubmitTicket"
              >
                {{ isEditing ? 'Update Ticket' : 'Create Ticket' }}
              </v-btn>
            </div>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.tickets-container {
  min-height: calc(100vh - 64px);
  padding: 24px;
}

.ticket-card {
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.ticket-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
}

.ticket-details {
  background: rgb(var(--v-theme-surfaceVariant));
  border-radius: 12px;
  padding: 16px;
}

.empty-state-card {
  border-radius: 16px;
  max-width: 500px;
  margin: 0 auto;
}

.dialog-card {
  border-radius: 16px;
  overflow: hidden;
}

.flex-1 {
  flex: 1;
}

.flex-2 {
  flex: 2;
}

/* Responsive Design */
@media (max-width: 768px) {
  .tickets-container {
    padding: 16px;
  }

  .d-flex.gap-3 {
    flex-direction: column;
    gap: 12px !important;
  }

  .d-flex.gap-4 {
    flex-direction: column;
    gap: 16px !important;
  }
}
</style>
