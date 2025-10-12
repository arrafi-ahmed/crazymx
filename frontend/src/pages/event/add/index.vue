<script setup>
  import { reactive, ref, watch } from 'vue'

  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import TimePicker from '@/components/TimePicker.vue'
  import { Event } from '@/models/Event'
  import { EventConfig } from '@/models/EventConfig'
  import { generateSlug, mergeDateTime } from '@/utils'

  definePage({
    name: 'event-add',
    meta: {
      layout: 'default',
      title: 'Add Event',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const router = useRouter()
  const store = useStore()

  const newEventInit = reactive({
    ...new Event({}),
    dateRange: [new Date(), new Date()],
    startTime: '09:00',
    endTime: '17:00',
  })
  const newEvent = reactive({ ...newEventInit })

  const configDialog = ref(false)
  const config = reactive({ ...new EventConfig() })
  const form = ref(null)
  const isFormValid = ref(true)

  const dateFormatOptions = [
    { title: 'MM/DD/YYYY HH:mm (12/25/2024 14:30)', value: 'MM/DD/YYYY HH:mm' },
    { title: 'MM/DD/YYYY (12/25/2024)', value: 'MM/DD/YYYY' },
    { title: 'DD/MM/YYYY (25/12/2024)', value: 'DD/MM/YYYY' },
    { title: 'YYYY-MM-DD (2024-12-25)', value: 'YYYY-MM-DD' },
    { title: 'MMM DD, YYYY (Dec 25, 2024)', value: 'MMM DD, YYYY' },
    { title: 'MMMM DD, YYYY (December 25, 2024)', value: 'MMMM DD, YYYY' },
    { title: 'DD MMM YYYY (25 Dec 2024)', value: 'DD MMM YYYY' },
  ]

  function handleEventBanner (file) {
    newEvent.banner = file
  }

  // Watch for title changes and auto-generate slug if slug field is empty
  watch(
    () => newEvent.name,
    newTitle => {
      if (newTitle && !newEvent.slug) {
        newEvent.slug = generateSlug(newTitle)
      }
    },
  )

  // Watch for config changes to update the event config
  watch(
    () => config,
    newConfig => {
      newEvent.config = { ...newConfig }
    },
    { deep: true },
  )

  function openConfigDialog () {
    // Sync current config with dialog
    Object.assign(config, newEvent.config)
    configDialog.value = true
  }

  function saveConfig () {
    // Update event config with dialog values
    newEvent.config = { ...config }
    configDialog.value = false
  }

  async function handleAddEvent () {
    await form.value.validate()
    if (!isFormValid.value) return

    // Auto-generate slug if empty
    if (!newEvent.slug || newEvent.slug.trim() === '') {
      newEvent.slug = generateSlug(newEvent.name)
    }

    if (newEvent.config.isAllDay) {
      // For all-day events, use just the date part
      newEvent.startDatetime = mergeDateTime({ dateStr: newEvent.dateRange[0], timeStr: '00:01', isOutputUTC: true })
      newEvent.endDatetime = newEvent.config.isSingleDayEvent
        ? mergeDateTime({ dateStr: newEvent.dateRange[0], timeStr: '23:59', isOutputUTC: true })
        : mergeDateTime({ dateStr: newEvent.dateRange.at(-1), timeStr: '23:59', isOutputUTC: true })
    } else {
      // For timed events, combine date and time
      newEvent.startDatetime = mergeDateTime({
        dateStr: newEvent.dateRange[0],
        timeStr: newEvent.startTime,
        isOutputUTC: true,
      })
      newEvent.endDatetime = newEvent.config.isSingleDayEvent
        ? mergeDateTime({
          dateStr: newEvent.dateRange.at(0),
          timeStr: newEvent.endTime,
          isOutputUTC: true,
        })
        : mergeDateTime({
          dateStr: newEvent.dateRange.at(-1),
          timeStr: newEvent.endTime,
          isOutputUTC: true,
        })
    }

    const formData = new FormData()
    formData.append('name', newEvent.name)
    formData.append('description', newEvent.description)
    formData.append('location', newEvent.location)
    formData.append('startDatetime', newEvent.startDatetime)
    formData.append('endDatetime', newEvent.endDatetime || '')
    formData.append('config', JSON.stringify(newEvent.config))
    formData.append('slug', newEvent.slug)
    formData.append('currency', newEvent.currency)
    formData.append('taxType', newEvent.taxType)
    formData.append('taxAmount', newEvent.taxAmount)

    if (newEvent.banner) formData.append('files', newEvent.banner)

    store.dispatch('event/save', formData).then(result => {
      Object.assign(newEvent, {
        ...newEventInit,
      })
      router.push({
        name: 'dashboard-admin',
      })
    })
  }
</script>

<template>
  <v-container class="event-add-container">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <PageTitle
          title="Add Event"
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col
        cols="12"
        lg="8"
        xl="6"
      >
        <v-card
          class="form-card"
          elevation="4"
        >
          <v-card-text class="pa-6">
            <v-form
              ref="form"
              v-model="isFormValid"
              fast-fail
              @submit.prevent="handleAddEvent"
            >
              <v-text-field
                v-model="newEvent.name"
                class="mb-4"
                clearable
                density="comfortable"
                hide-details="auto"
                label="Event Name"
                prepend-inner-icon="mdi-format-title"
                required
                :rules="[(v) => !!v || 'Name is required!']"
                variant="solo"
              />

              <v-textarea
                v-model="newEvent.description"
                class="mb-4"
                clearable
                density="comfortable"
                hide-details="auto"
                label="Description (optional)"
                prepend-inner-icon="mdi-text-box"
                rows="3"
                variant="solo"
              />

              <v-text-field
                v-model="newEvent.location"
                class="mb-4"
                clearable
                density="comfortable"
                hide-details="auto"
                label="Location (optional)"
                prepend-inner-icon="mdi-map-marker"
                variant="solo"
              />

              <v-select
                v-model="newEvent.currency"
                class="mb-4"
                density="comfortable"
                hide-details="auto"
                item-title="text"
                item-value="value"
                :items="[
                  { value: 'USD', text: 'USD ($)' },
                  { value: 'EUR', text: 'EUR (€)' },
                  { value: 'GBP', text: 'GBP (£)' },
                ]"
                label="Currency"
                prepend-inner-icon="mdi-cash-multiple"
                variant="solo"
              />

              <v-text-field
                v-model="newEvent.slug"
                append-inner-icon="mdi-refresh"
                class="mb-4"
                clearable
                density="comfortable"
                :disabled="!newEvent.name"
                hide-details="auto"
                hint="Custom URL for your event (e.g., 'peaceism-conference-2024'). Leave empty to auto-generate from event name."
                label="URL Slug (optional)"
                persistent-hint
                prepend-inner-icon="mdi-link"
                variant="solo"
                @click:append-inner="newEvent.slug = generateSlug(newEvent.name)"
              />

              <v-date-input
                v-model="newEvent.dateRange"
                class="mb-4"
                color="primary"
                hide-details="auto"
                label="Event Date"
                multiple="range"
                prepend-icon=""
                prepend-inner-icon="mdi-calendar"
                :rules="[
                  (v) => !!v || 'Date range is required!',
                  (v) =>
                    (v && Array.isArray(v) && v.length >= 2) ||
                    'Please select both start and end dates',
                  (v) =>
                    (v && Array.isArray(v) && v.length >= 2 && v[0] <= v[v.length - 1]) ||
                    'Start date must be before end date',
                ]"
                show-adjacent-months
                variant="solo"
              />

              <v-date-input
                v-if="newEvent.config.isSingleDayEvent"
                v-model="newEvent.dateRange[0]"
                class="mb-4"
                color="primary"
                hide-details="auto"
                label="Event Date"
                prepend-icon=""
                prepend-inner-icon="mdi-calendar"
                :rules="[
                  (v) => !!v || 'Date is required!',
                ]"
                show-adjacent-months
                variant="solo"
              />

              <v-date-input
                v-else
                v-model="newEvent.dateRange"
                class="mb-4"
                color="primary"
                hide-details="auto"
                label="Event Date"
                multiple="range"
                prepend-icon=""
                prepend-inner-icon="mdi-calendar"
                :rules="[
                  (v) => !!v || 'Date range is required!',
                  (v) =>
                    (v && Array.isArray(v) && v.length >= 2) ||
                    'Please select both start and end dates',
                  (v) =>
                    (v && Array.isArray(v) && v.length >= 2 && v[0] <= v[v.length - 1]) ||
                    'Start date must be before end date',
                ]"
                show-adjacent-months
                variant="solo"
              />

              <!-- Time Pickers (only show when not all day) -->
              <v-row v-if="!newEvent.config.isAllDay" class="mb-2">
                <v-col cols="12" md="6">
                  <TimePicker
                    v-model="newEvent.startTime"
                    density="comfortable"
                    label="Start Time"
                    show-icon
                    variant="solo"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <TimePicker
                    v-model="newEvent.endTime"
                    density="comfortable"
                    label="End Time"
                    show-icon
                    variant="solo"
                  />
                </v-col>
              </v-row>
              <v-row class="mt-n4 mb-2">
                <v-col
                  cols="12"
                  md="6"
                >
                  <v-select
                    v-model="newEvent.taxType"
                    density="comfortable"
                    hide-details="auto"
                    item-title="text"
                    item-value="value"
                    :items="[
                      { value: 'percent', text: 'Percentage %' },
                      { value: 'fixed', text: 'Fixed amount' },
                    ]"
                    label="Tax Type"
                    prepend-inner-icon="mdi-percent"
                    variant="solo"
                  />
                </v-col>
                <v-col
                  cols="12"
                  md="6"
                >
                  <v-text-field
                    v-model.number="newEvent.taxAmount"
                    density="comfortable"
                    hide-details="auto"
                    label="Tax Amount"
                    prepend-inner-icon="mdi-currency-usd"
                    type="number"
                    variant="solo"
                  />
                </v-col>
              </v-row>
              <v-file-upload
                accept="image/*"
                class="mt-2 mt-md-4"
                clearable
                density="compact"
                rounded
                show-size
                title="Upload Banner"
                variant="solo"
                @update:model-value="handleEventBanner"
              />

              <div class="d-flex align-center mt-3 mt-md-4">
                <v-btn
                  color="secondary"
                  prepend-icon="mdi-cog"
                  rounded="xl"
                  :size="xs ? 'default' : 'large'"
                  variant="outlined"
                  @click="openConfigDialog"
                >
                  Configuration
                </v-btn>
                <v-spacer />
                <v-btn
                  color="primary"
                  rounded="xl"
                  :size="xs ? 'default' : 'large'"
                  type="submit"
                >
                  Create Event
                </v-btn>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Configuration Dialog -->
    <v-dialog
      v-model="configDialog"
      max-width="600"
      persistent
    >
      <v-card>
        <v-card-title class="text-h5 pa-6 pb-0">
          Event Configuration
        </v-card-title>

        <v-card-text class="pa-6">
          <v-form @submit.prevent="saveConfig">
            <v-number-input
              v-model.number="config.maxTicketsPerRegistration"
              control-variant="default"
              :hide-input="false"
              inset
              label="Max Ticket Purchase Per Registration"
              prepend-inner-icon="mdi-ticket"
              :reverse="false"
              :rules="[(v) => v > 0 || 'Must be greater than 0']"
              variant="solo"
            />

            <v-switch
              v-model="config.saveAllAttendeesDetails"
              class="mb-4"
              color="primary"
              glow
              hint="When enabled, details of all attendees will be saved. When disabled, only the primary attendee (form filler) details will be saved."
              inset
              label="Save Details of All Attendees"
              persistent-hint
            />

            <v-switch
              v-model="config.isAllDay"
              class="mb-4"
              color="primary"
              glow
              hint="Enable if this event lasts the entire day (no specific start or end time)."
              inset
              label="All Day Event"
              persistent-hint
            />

            <v-switch
              v-model="config.isSingleDayEvent"
              class="mb-4"
              color="primary"
              glow
              hint="Turn off if this event continues for multiple days."
              inset
              label="Single Day Event"
              persistent-hint
            />

            <v-select
              v-model="config.dateFormat"
              class="mb-4"
              hint="Choose how dates will be displayed on customer-facing pages"
              :items="dateFormatOptions"
              label="Date Format"
              persistent-hint
              prepend-inner-icon="mdi-calendar"
              variant="solo"
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-6 pt-0">
          <v-spacer />
          <v-btn
            color="secondary"
            rounded="lg"
            variant="outlined"
            @click="configDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            rounded="lg"
            variant="flat"
            @click="saveConfig"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.event-add-container {
  min-height: calc(100vh - 64px);
  padding: 24px;
}

.form-card {
  border-radius: 16px;
  overflow: hidden;
}

.flex-1 {
  flex: 1;
}

/* Responsive Design */
@media (max-width: 768px) {
  .event-add-container {
    padding: 16px;
  }

  .d-flex.gap-4 {
    flex-direction: column;
    gap: 16px !important;
  }
}
</style>
