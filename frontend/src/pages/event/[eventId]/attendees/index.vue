<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import NoItemsFound from '@/components/NoItemsFound.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import {
    checkinItems,
    clientBaseUrl,
    deepCopy,
    extrasItems,
    formatDateTime,
    formatPrice,
    padStr,
    sendToWhatsapp,
  } from '@/utils'

  definePage({
    name: 'event-attendees',
    meta: {
      layout: 'default',
      title: 'Event Attendees',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const store = useStore()
  const route = useRoute()
  const router = useRouter()
  const { xs } = useDisplay()

  const event = computed(() => store.state.event.event)
  const tickets = computed(() => store.state.ticket.tickets || [])
  const attendees = computed(() => store.state.registration.attendees)

  const itemsPerPage = ref(10)
  const totalCount = ref(0)
  const loading = ref(false)
  const headers = ref([
    {
      title: 'ID',
      align: 'start',
      key: 'registrationId',
    },
    {
      title: 'Name',
      align: 'start',
      key: 'name',
    },
  ])

  if (!xs.value) {
    headers.value.push({
      title: 'Email',
      align: 'start',
      key: 'email',
    }, {
      title: 'Registration Time',
      align: 'start',
      key: 'registrationCreatedAt',
    })
  }
  headers.value.push({
    title: 'Check-in Status',
    align: 'start',
    key: 'checkinStatus',
  }, {
    title: 'Registration Status',
    align: 'start',
    key: 'registrationStatus',
  }, {
    title: '',
    align: 'start',
    key: 'action',
  })
  const searchKeyword = ref(null)
  const currentSort = ref('registration')

  async function loadItems ({ page = 1, itemsPerPage = 10 } = {}) {
    loading.value = true
    try {
      if (event.value.id !== route.params.eventId) {
        await store.dispatch('event/setEvent', { eventId: route.params.eventId })
      }
      const { totalItems } = await store.dispatch('registration/setAttendees', {
        page,
        itemsPerPage,
        fetchTotalCount: !attendees.value?.items,
        event: { id: event.value.id, config: event.value.config },
        searchKeyword: searchKeyword.value,
        sortBy: currentSort.value,
      })
      totalCount.value = totalItems
    } finally {
      loading.value = false
    }
  }

  // Sort options for the select dropdown
  const sortOptions = [
    { title: 'Registration Date', value: 'registration', icon: 'mdi-calendar-clock' },
    { title: 'Check-in Status', value: 'checkin', icon: 'mdi-qrcode-scan' },
  ]

  // Get ticket price for individual tickets
  function getTicketPrice (ticketId) {
    const ticket = tickets.value.find(t => t.id === ticketId)
    return ticket ? ticket.price : null
  }

  const editingAttendeeInit = {
    registrationId: null,
    eventId: null,
    additionalFields: {},
    registrationStatus: false,
    registrationCreatedAt: null,
    registrationUpdatedAt: null,
    attendeeId: null,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    ticketId: null,
    ticketTitle: '',
    qrUuid: '',
    isPrimary: false,
    attendeeCreatedAt: null,
    attendeeUpdatedAt: null,
    checkinId: null,
    checkinTime: null,
  }

  const isExtraExists = computed(() => false) // Extras not implemented in flattened structure yet

  // Computed property to map checkinId to checkinItems value
  const currentCheckinStatus = computed({
    get: () => (editingAttendee.checkinId ? checkinItems[1].value : checkinItems[0].value),
    set: value => {
      // Update the checkinId based on selection
      editingAttendee.checkinId = value === checkinItems[1].value ? 'pending_save' : null
    },
  })

  const editingAttendee = reactive({ ...editingAttendeeInit })
  const attendeeDetailsDialog = ref(false)

  function openAttendeeDetailsDialog (attendeeId) {
    const attendee = attendees.value.find(item => item.attendeeId == attendeeId)
    if (!attendee) return

    Object.assign(editingAttendee, deepCopy(attendee)) // deep clone

    attendeeDetailsDialog.value = !attendeeDetailsDialog.value
  }

  async function updateCheckinStatus ({ attendeeId, registrationId }) {
    const attendee = attendees.value.find(item => item.attendeeId == attendeeId)

    // Check if status actually changed
    const wasCheckedIn = !!attendee.checkinId
    const willBeCheckedIn = !!editingAttendee.checkinId
    if (wasCheckedIn === willBeCheckedIn) return

    // If setting status to pending (no checkinId), delete the checkin record
    if (!editingAttendee.checkinId) {
      await store
        .dispatch('checkin/delete', {
          attendeeId,
          eventId: route.params.eventId,
        })
        .finally(() => {
          attendeeDetailsDialog.value = !attendeeDetailsDialog.value
          Object.assign(editingAttendee, editingAttendeeInit)
          // Refresh the attendee list to show updated status
        })
      return
    }

    // If setting status to checked in (has checkinId), create/update the checkin record
    const newCheckin = {}
    Object.assign(newCheckin, { attendeeId, registrationId })

    await store
      .dispatch('checkin/save', {
        ...newCheckin,
        eventId: route.params.eventId,
      })
      .finally(() => {
        attendeeDetailsDialog.value = !attendeeDetailsDialog.value
        Object.assign(editingAttendee, editingAttendeeInit)
        // Refresh the attendee list to show updated status
      })
  }

  function handleDownloadAttendees () {
    store.dispatch('registration/downloadAttendees', {
      eventId: route.params.eventId,
    })
  }

  function sendTicket (attendeeId) {
    store.dispatch('registration/sendTicketByAttendeeId', {
      attendeeId,
      eventId: route.params.eventId,
    })
  }

  function removeRegistration (registrationId) {
    store
      .dispatch('registration/removeRegistration', {
        registrationId,
        eventId: route.params.eventId,
      })
      .then(() => {
        // Refresh the data to ensure UI is in sync
        loadItems()
      })
      .catch(error => {
        console.error('Error deleting registration:', error)
      })
  }

  function deleteAttendee (attendee) {
    store
      .dispatch('registration/deleteAttendee', {
        attendeeId: attendee.attendeeId,
        registrationId: attendee.registrationId, // Add this missing field
        eventId: route.params.eventId,
      })
      .then(() => {
        // The store mutation will handle the UI update automatically
        // Refresh the data to ensure UI is in sync
        loadItems()
      })
      .catch(error => {
        console.error('Error deleting attendee:', error)
      })
  }

  function viewQr ({ registrationId, attendeeId, qrUuid }) {
    router.push({
      name: 'qr-viewer',
      params: { registrationId, attendeeId, qrUuid },
    })
  }

  function handleSortChange (sortValue) {
    currentSort.value = sortValue
    store.dispatch('registration/setAttendees', {
      event: { id: event.value.id, config: event.value.config },
      searchKeyword: searchKeyword.value,
      sortBy: sortValue,
    })
  }

  function handleSendToWhatsapp (attendee) {
    const phone = attendee.phone?.slice(1) || ''
    const message = `QR code download link: ${clientBaseUrl}/qr/${attendee.attendeeId}/${attendee.qrUuid}`
    sendToWhatsapp(phone, message)
  }

  // Helper functions to get attendee data from new structure
  function getAttendeeName (attendee) {
    return `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim() || 'N/A'
  }

  function handleSearch () {
    if (searchKeyword.value && searchKeyword.value.trim()) {
      loadItems()
    } else {
      // If search is empty, fetch all attendees
      loadItems()
    }
  }
</script>

<template>
  <v-container class="event-attendees-container">
    <!-- Header Section -->
    <PageTitle
      :subtitle="event?.name"
      title="Attendee List"
    >
      <template #actions>
        <!-- Download Button -->
        <v-btn
          v-if="xs"
          color="primary"
          icon="mdi-download"
          rounded
          variant="tonal"
          @click="handleDownloadAttendees"
        />
        <v-btn
          v-else
          color="primary"
          prepend-icon="mdi-download"
          rounded="xl"
          @click="handleDownloadAttendees"
        >
          Download
        </v-btn>
      </template>
    </PageTitle>

    <div class="mb-2 d-flex align-center justify-end">
      <v-chip
        :color="attendees.length > 0 ? 'primary' : 'grey'"
        variant="tonal"
      >
        <v-icon size="small" start>mdi-account-group</v-icon>
        Total Attendees: {{ totalCount }}
      </v-chip>
    </div>

    <!-- Search and Sort Section -->
    <div class="d-flex align-center justify-end my-2 my-md-4">
      <v-text-field
        v-model="searchKeyword"
        append-inner-icon="mdi-magnify"
        clearable
        density="compact"
        hide-details
        label="Search by name/email/phone"
        rounded="lg"
        single-line
        variant="solo"
        @click:append-inner="handleSearch"
        @keydown.enter="handleSearch"
      />
      <!-- Sort Menu -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            class="ml-2"
            icon="mdi-sort"
            rounded="lg"
          />
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="option in sortOptions"
            :key="option.value"
            :active="currentSort === option.value"
            @click="handleSortChange(option.value)"
          >
            <template #prepend>
              <v-icon
                :color="currentSort === option.value ? 'primary' : 'default'"
                size="small"
              >
                {{ option.icon }}
              </v-icon>
            </template>
            <v-list-item-title>{{ option.title }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <v-row>
      <v-col>
        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          density="comfortable"
          disable-sort
          :headers="headers"
          hover
          :items="attendees"
          :items-length="totalCount"
          :loading="loading"
          @click:row="(event, { item }) => openAttendeeDetailsDialog(item.attendeeId)"
          @update:options="loadItems"
        >
          <template #item.registrationId="{ item }">
            {{ padStr(item.registrationId, 5) }}
          </template>
          <template #item.name="{ item }">
            <div class="d-flex flex-column">
              <div class="font-weight-medium">
                {{ getAttendeeName(item) }}
              </div>
              <div
                v-if="item.isPrimary"
                class="text-caption text-grey"
              >
                Primary
              </div>
            </div>
          </template>
          <template #item.registrationCreatedAt="{ item }">
            {{ formatDateTime({input: item.registrationCreatedAt}) }}
          </template>
          <template #item.checkinStatus="{ item }">
            <v-chip
              v-if="item.checkinId"
              color="success"
              size="small"
              variant="flat"
            >
              {{ checkinItems[1].title }}
            </v-chip>
            <v-chip
              v-else
              color="yellow"
              size="small"
              variant="flat"
            >
              {{ checkinItems[0].title }}
            </v-chip>
          </template>
          <template #item.registrationStatus="{ item }">
            <v-chip
              v-if="item.registrationStatus"
              color="success"
              size="small"
              variant="flat"
            >
              Active
            </v-chip>
            <v-chip
              v-else
              color="error"
              size="small"
              variant="flat"
            >
              Inactive
            </v-chip>
          </template>
          <template #item.action="{ item }">
            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  class="ml-5"
                  icon="mdi-dots-vertical"
                  v-bind="props"
                  variant="text"
                />
              </template>
              <v-list density="comfortable">
                <v-list-item
                  density="compact"
                  prepend-icon="mdi-email-fast"
                  title="Email Ticket"
                  @click="sendTicket(item.attendeeId)"
                />
                <v-list-item
                  density="compact"
                  prepend-icon="mdi-email-fast"
                  title="WhatsApp Ticket"
                  @click="handleSendToWhatsapp(item)"
                />
                <v-list-item
                  density="compact"
                  prepend-icon="mdi-eye"
                  title="QR Code"
                  @click="viewQr(item)"
                />
                <!-- <v-list-item
density="compact"
prepend-icon="mdi-eye"
title="Voucher QR Code"
@click="viewQr(item.extras)"
/> -->
                <v-divider />
                <confirmation-dialog @confirm="deleteAttendee(item)">
                  <template #activator="{ onClick }">
                    <v-list-item
                      class="text-error"
                      prepend-icon="mdi-delete"
                      title="Delete Attendee"
                      @click.stop="onClick"
                    />
                  </template>
                </confirmation-dialog>
                <v-divider />
                <confirmation-dialog @confirm="removeRegistration(item.registrationId)">
                  <template #activator="{ onClick }">
                    <v-list-item
                      class="text-error"
                      prepend-icon="mdi-delete-forever"
                      title="Delete Registration"
                      @click.stop="onClick"
                    />
                  </template>
                </confirmation-dialog>
              </v-list>
            </v-menu>
          </template>
          <template #no-data>
            <no-items-found />
          </template>
        </v-data-table-server>
      </v-col>
    </v-row>
  </v-container>

  <v-dialog
    v-model="attendeeDetailsDialog"
    width="500"
  >
    <v-card>
      <v-card-title class="text-h5">
        Attendee Details
      </v-card-title>
      <v-card-text>
        <!-- Attendee Information -->
        <v-card rounded="lg">
          <v-card-title class="text-h6">
            Attendee Information
          </v-card-title>
          <v-table
            class="mb-4"
            density="compact"
          >
            <tbody>
              <tr>
                <td>
                  <strong>Name:</strong>
                </td>
                <td>
                  {{ editingAttendee.firstName }} {{ editingAttendee.lastName }}
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Email:</strong>
                </td>
                <td>
                  {{ editingAttendee.email }}
                </td>
              </tr>
              <tr>
                <td v-if="editingAttendee.phone">
                  <strong>Phone:</strong>
                </td>
                <td>
                  {{ editingAttendee.phone }}
                </td>
              </tr>
              <tr v-if="event.config.saveAllAttendeesDetails">
                <td>
                  <strong>Ticket:</strong>
                </td>
                <td>
                  {{ editingAttendee.ticketTitle || 'N/A' }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>

        <!-- Tickets Information -->
        <v-card v-if="!event.config.saveAllAttendeesDetails" class="mt-2" rounded="lg">
          <v-card-title class="text-h6">
            Tickets Information
          </v-card-title>
          <v-table
            class="mb-4"
            density="compact"
          >
            <tbody>
              <!-- Group tickets - show all tickets with quantities -->
              <template v-if="editingAttendee.items && Array.isArray(editingAttendee.items)">
                <tr v-for="(item, index) in editingAttendee.items" :key="index">
                  <td class="rowTitle font-weight-medium">
                    {{ item.title || 'Ticket' }}
                  </td>
                  <td>
                    <div class="d-flex align-center">
                      <span class="mr-2">Quantity: {{ item.quantity || 1 }}</span>
                      <v-chip
                        v-if="item.unitPrice && item.unitPrice > 0"
                        color="primary"
                        size="small"
                        variant="outlined"
                      >
                        {{ formatPrice(item.unitPrice) }}
                      </v-chip>
                      <v-chip
                        v-else-if="item.unitPrice === 0"
                        color="success"
                        size="small"
                        variant="outlined"
                      >
                        Free
                      </v-chip>
                    </div>
                  </td>
                </tr>
              </template>
              <!-- Individual ticket - show single ticket -->
              <template v-else>
                <tr>
                  <td class="rowTitle font-weight-medium">
                    Ticket Type
                  </td>
                  <td>
                    <div class="d-flex align-center">
                      <span>{{ editingAttendee.ticketTitle || 'N/A' }}</span>
                      <v-chip
                        v-if="editingAttendee.ticketId"
                        class="ml-2"
                        color="primary"
                        size="small"
                        variant="outlined"
                      >
                        Quantity: 1
                      </v-chip>
                      <v-chip
                        v-if="editingAttendee.ticketId && getTicketPrice(editingAttendee.ticketId) && getTicketPrice(editingAttendee.ticketId) > 0"
                        class="ml-2"
                        color="primary"
                        size="small"
                        variant="outlined"
                      >
                        {{ formatPrice(getTicketPrice(editingAttendee.ticketId)) }}
                      </v-chip>
                      <v-chip
                        v-else-if="editingAttendee.ticketId && getTicketPrice(editingAttendee.ticketId) === 0"
                        class="ml-2"
                        color="success"
                        size="small"
                        variant="outlined"
                      >
                        Free
                      </v-chip>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </v-table>
        </v-card>

        <!-- Check-in Information -->
        <v-card class="mt-2" rounded="lg">
          <v-card-title class="text-h6">
            Check-in Information
          </v-card-title>
          <v-table
            class="mb-4"
            density="comfortable"
          >
            <tbody>
              <tr>
                <td class="rowTitle font-weight-medium">
                  Check-in Status
                </td>
                <td>
                  <v-chip
                    v-if="editingAttendee.checkinId"
                    color="success"
                    size="small"
                    variant="flat"
                  >
                    Checked In
                  </v-chip>
                  <v-chip
                    v-else
                    color="yellow"
                    size="small"
                    variant="flat"
                  >
                    Pending
                  </v-chip>
                </td>
              </tr>
              <tr class="my-1">
                <td class="rowTitle font-weight-medium">
                  Update Status
                </td>
                <td>
                  <v-select
                    v-model="currentCheckinStatus"
                    class="text-capitalize"
                    density="compact"
                    hide-details="auto"
                    item-title="title"
                    item-value="value"
                    :items="checkinItems"
                    style="max-width: 160px;"
                    variant="solo"
                  />
                </td>
              </tr>
              <tr v-if="editingAttendee.checkinTime">
                <td class="rowTitle font-weight-medium">
                  Check-in Time
                </td>
                <td>{{ formatDateTime({input: editingAttendee.checkinTime}) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>

        <!-- Registration Information -->
        <v-card class="mt-2" rounded="lg">
          <v-card-title class="text-h6">
            Registration Information
          </v-card-title>
          <v-table
            class="mb-4"
            density="compact"
          >
            <tbody>
              <tr>
                <td class="rowTitle font-weight-medium">
                  Registration Status
                </td>
                <td>
                  <v-chip
                    v-if="editingAttendee.registrationStatus"
                    color="success"
                    size="small"
                    variant="flat"
                  >
                    Active
                  </v-chip>
                  <v-chip
                    v-else
                    color="error"
                    size="small"
                    variant="flat"
                  >
                    Inactive
                  </v-chip>
                </td>
              </tr>
              <tr>
                <td class="rowTitle font-weight-medium">
                  Registration Time
                </td>
                <td>{{ formatDateTime({input: editingAttendee.registrationCreatedAt}) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>

      </v-card-text>

      <div v-if="editingAttendee.extras?.id">
        <v-card-title>Purchased Extras</v-card-title>
        <v-card-text>
          <v-list v-if="editingAttendee.extras.extrasData?.length > 0">
            <v-list-item v-for="(item, index) in editingAttendee.extras.extrasData">
              <v-divider class="mb-1" />
              <v-list-item-title class="d-flex justify-space-between">
                <span>{{ item.name }}</span>
                <span>€ {{ item.price }}</span>
              </v-list-item-title>
              <v-list-item-subtitle v-for="(contentItem, contentIndex) in item.content">
                <span>{{ contentItem.name }}</span>
                X
                <span>{{ contentItem.quantity }}</span>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </div>

      <v-card-actions>
        <v-spacer />
        <v-btn
          color="primary"
          @click="updateCheckinStatus({
            attendeeId: editingAttendee.attendeeId,
            registrationId: editingAttendee.registrationId
          })"
        >
          Update
        </v-btn>
        <v-btn
          class="ml-2"
          color="grey"
          @click="attendeeDetailsDialog = false"
        >
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style>
.rowTitle {
  width: 152px;
}
</style>
