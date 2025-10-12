<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import NoItemsFound from '@/components/NoItemsFound.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { checkinItems, clientBaseUrl, deepCopy, extrasItems, formatDateTime, padStr, sendToWhatsapp } from '@/utils'

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

  const event = computed(() => store.getters['event/getEventById'](route.params.eventId))
  const attendees = computed(() => store.state.registration.attendees)
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
      if (value === checkinItems[1].value) {
        // Setting to checked in - checkinId will be set when save is called
        editingAttendee.checkinId = 'pending_save'
      } else {
        // Setting to pending - clear checkinId
        editingAttendee.checkinId = null
      }
    },
  })

  const editingAttendee = reactive({ ...editingAttendeeInit })
  const attendeeDetailsDialog = ref(false)

  function openAtendeeDetailsDialog (attendeeId) {
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
          fetchData()
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
        fetchData()
      })
  }

  const searchKeyword = ref(null)
  const currentSort = ref('registration') // Track current sort column

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
        fetchData()
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
        fetchData()
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

  function sortByCheckin () {
    currentSort.value = 'checkin'
    store.dispatch('registration/setAttendees', {
      eventId: route.params.eventId,
      searchKeyword: searchKeyword.value,
      sortBy: 'checkin',
    })
  }

  function sortByRegistration () {
    currentSort.value = 'status'
    store.dispatch('registration/setAttendees', {
      eventId: route.params.eventId,
      searchKeyword: searchKeyword.value,
      sortBy: 'status',
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

  function getAttendeePhone (attendee) {
    return attendee?.phone || 'N/A'
  }

  function getAttendeeEmail (attendee) {
    return attendee?.email || 'N/A'
  }

  function fetchData () {
    currentSort.value = 'registration'
    store.dispatch('registration/setAttendees', {
      eventId: route.params.eventId,
      searchKeyword: searchKeyword.value,
    })
  }

  function handleSearch () {
    if (searchKeyword.value && searchKeyword.value.trim()) {
      fetchData()
    } else {
      // If search is empty, fetch all attendees
      fetchData()
    }
  }

  onMounted(() => {
    fetchData()
  })
</script>

<template>
  <v-container class="event-attendees-container">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <PageTitle
          :subtitle="event?.name"
          title="Attendee List"
        />
      </v-col>
    </v-row>

    <div class="d-flex align-center justify-end my-2 my-md-4">
      <v-text-field
        v-model="searchKeyword"
        append-inner-icon="mdi-magnify"
        density="compact"
        hide-details
        label="Search by name/email/phone"
        rounded="lg"
        single-line
        variant="solo"
        @click:append-inner="handleSearch"
        @keydown.enter="handleSearch"
      />
      <!--            download btn for mobile-->
      <v-btn
        v-if="xs"
        class="ml-2"
        color="primary"
        icon="mdi-download"
        rounded
        variant="tonal"
        @click="handleDownloadAttendees"
      />
      <!--            download btn for desktop-->
      <v-btn
        v-else
        class="ml-2"
        color="primary"
        prepend-icon="mdi-download"
        rounded="xl"
        @click="handleDownloadAttendees"
      >
        Download
      </v-btn>
    </div>

    <v-row v-if="attendees.length > 0">
      <v-col>
        <v-table
          density="comfortable"
          hover
        >
          <thead>
            <tr>
              <th class="text-start">
                ID
              </th>
              <th class="text-start">
                Name
              </th>
              <th
                v-if="!xs"
                class="text-start"
              >
                Email
              </th>
              <th
                v-if="!xs"
                class="text-start v-label--clickable"
                @click="sortByRegistration"
              >
                Registration Time
                <v-icon
                  v-if="currentSort === 'status'"
                  class="ml-1"
                  size="small"
                >
                  mdi-arrow-up
                </v-icon>
              </th>
              <th
                class="text-start v-label--clickable"
                @click="sortByCheckin"
              >
                Check-in Status
                <v-icon
                  v-if="currentSort === 'checkin'"
                  class="ml-1"
                  size="small"
                >
                  mdi-arrow-up
                </v-icon>
              </th>
              <th
                class="text-start v-label--clickable"
                @click="sortByRegistration"
              >
                Registration Status
                <v-icon
                  v-if="currentSort === 'status'"
                  class="ml-1"
                  size="small"
                >
                  mdi-arrow-up
                </v-icon>
              </th>

              <th
                v-if="isExtraExists"
                class="text-start"
              >
                Voucher
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in attendees"
              :key="'attendee-' + item.attendeeId"
              class="clickable"
              @click="openAtendeeDetailsDialog(item.attendeeId)"
            >
              <td>{{ padStr(item.registrationId, 5) }}</td>
              <td>
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
              </td>
              <td v-if="!xs">
                {{ getAttendeeEmail(item) }}
              </td>
              <td v-if="!xs">
                {{ formatDateTime({input: item.registrationCreatedAt}) }}
              </td>
              <td class="text-capitalize">
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
              </td>
              <td class="text-capitalize">
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
              </td>

              <td
                v-if="isExtraExists"
                class="text-capitalize"
              >
                <v-chip
                  v-if="item.extras?.status === true"
                  color="success"
                  variant="flat"
                >
                  {{ extrasItems[2].title }}
                </v-chip>
                <v-chip
                  v-else-if="item.extras?.status === false"
                  color="yellow"
                  variant="flat"
                >
                  {{ extrasItems[1].title }}
                </v-chip>
                <div v-else>
                  {{ extrasItems[0].title }}
                </div>
              </td>
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
            </tr>
          </tbody>
        </v-table>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col>
        <no-items-found
          message="No attendees have registered for this event yet."
          title="No attendees found"
        />
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
        <v-card-title class="text-h6 pa-0 mb-3">
          Attendee Information
        </v-card-title>
        <v-table
          class="mb-4"
          density="compact"
        >
          <tbody>
            <tr>
              <td>
                <div>
                  <div>
                    <strong>Name:</strong>
                    {{ editingAttendee.firstName }} {{ editingAttendee.lastName }}
                  </div>
                  <div>
                    <strong>Email:</strong>
                    {{ editingAttendee.email }}
                  </div>
                  <div v-if="editingAttendee.phone">
                    <strong>Phone:</strong>
                    {{ editingAttendee.phone }}
                  </div>
                  <div>
                    <strong>Ticket:</strong>
                    {{ editingAttendee.ticketTitle || 'N/A' }}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </v-table>

        <!-- Registration Information -->
        <v-card-title class="text-h6 pa-0 mb-3">
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

        <!-- Check-in Information -->
        <v-card-title class="text-h6 pa-0 mb-3">
          Check-in Information
        </v-card-title>
        <v-table
          class="mb-4"
          density="compact"
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
            <!--            <tr>-->
            <!--              <td class="rowTitle font-weight-medium">-->
            <!--                Update Status-->
            <!--              </td>-->
            <!--              <td>-->
            <!--                <v-select-->
            <!--                  v-model="currentCheckinStatus"-->
            <!--                  :items="checkinItems"-->
            <!--                  class="text-capitalize"-->
            <!--                  density="compact"-->
            <!--                  hide-details="auto"-->
            <!--                  item-title="title"-->
            <!--                  item-value="value"-->
            <!--                  variant="text"-->
            <!--                />-->
            <!--              </td>-->
            <!--            </tr>-->
            <tr v-if="editingAttendee.checkinTime">
              <td class="rowTitle font-weight-medium">
                Check-in Time
              </td>
              <td>{{ formatDateTime({input: editingAttendee.checkinTime}) }}</td>
            </tr>
          </tbody>
        </v-table>

        <!--        &lt;!&ndash; Additional Fields &ndash;&gt;-->
        <!--        <v-card-title-->
        <!--          v-if="-->
        <!--            editingAttendee.additionalFields &&-->
        <!--            Object.keys(editingAttendee.additionalFields).length > 0-->
        <!--          "-->
        <!--          class="text-h6 pa-0 mb-3"-->
        <!--        >-->
        <!--          Additional Information-->
        <!--        </v-card-title>-->
        <!--        <v-table-->
        <!--          v-if="-->
        <!--            editingAttendee.additionalFields &&-->
        <!--            Object.keys(editingAttendee.additionalFields).length > 0-->
        <!--          "-->
        <!--          density="compact"-->
        <!--        >-->
        <!--          <tbody>-->
        <!--            <tr v-for="(value, key) in editingAttendee.additionalFields" :key="key">-->
        <!--              <td class="rowTitle font-weight-medium text-capitalize">-->
        <!--                {{ key }}-->
        <!--              </td>-->
        <!--              <td>{{ value }}</td>-->
        <!--            </tr>-->
        <!--          </tbody>-->
        <!--        </v-table>-->
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
          class="mr-3"
          color="error"
          @click="attendeeDetailsDialog = false"
        >
          Close
        </v-btn>
        <!--        <v-btn-->
        <!--          color="primary"-->
        <!--          @click="updateCheckinStatus({-->
        <!--            attendeeId:editingAttendee.attendeeId,-->
        <!--            registrationId:editingAttendee.registrationId})"-->
        <!--        >-->
        <!--          Update-->
        <!--        </v-btn>-->
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style>
.rowTitle {
  width: 152px;
}
</style>
