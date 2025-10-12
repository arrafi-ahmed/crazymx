<script setup>
  import { computed, onMounted, reactive, ref, watch } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import ImageManager from '@/components/ImageManager.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import TimePicker from '@/components/TimePicker.vue'
  import { generateSlug, getEventImageUrl, mergeDateTime, splitDateTime } from '@/utils'

  definePage({
    name: 'event-edit',
    meta: {
      layout: 'default',
      title: 'Edit Event',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const route = useRoute()
  const router = useRouter()
  const store = useStore()

  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const prefetchedEvent = computed(() => store.getters['event/getEventById'](route.params.eventId))
  const event = computed(() =>
    prefetchedEvent.value?.id ? prefetchedEvent.value : store.state.event.event,
  )

  const newEventInit = reactive({
    ...new Event({}),
    dateRange: [new Date(), new Date()],
    startTime: '00:01',
    endTime: '23:59',
  })
  const newEvent = reactive({ ...newEventInit })

  const newUpload = ref('')
  const form = ref(null)
  const isFormValid = ref(true)
  const isLoading = ref(true)

  function handleBannerUpdate (file) {
    newUpload.value = file
  }

  function handleBannerDelete () {
    newEvent.banner = null
    // Get the current banner from either event.value or the store
    const currentBanner = event.value?.banner || store.state.event.event?.banner

    newEvent.rmImage = currentBanner
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

  async function handleSubmitEditEvent () {
    await form.value.validate()
    if (!isFormValid.value) return

    // Auto-generate slug if empty
    if (!newEvent.slug || newEvent.slug.trim() === '') {
      newEvent.slug = generateSlug(newEvent.name)
    }

    if (newEvent.config.isAllDay) {
      // For all-day events, use just the date part
      // todo: if all day/no time, set start datetime to startdate + 00.01
      newEvent.startDatetime = mergeDateTime({ dateStr: newEvent.dateRange[0], timeStr: '00:01', isOutputUTC: true })
      newEvent.endDatetime = newEvent.config.isSingleDayEvent
        ? mergeDateTime({ dateStr: newEvent.dateRange[0], timeStr: '23:59', isOutputUTC: true })
        : mergeDateTime({ dateStr: newEvent.dateRange.at(-1), timeStr: '23:59', isOutputUTC: true })
    } else {
      // For timed events, combine date and time
      newEvent.startDatetime
        = mergeDateTime({
          dateStr: newEvent.dateRange[0], timeStr: newEvent.startTime,
          isOutputUTC:
            true,
        })
      newEvent.endDatetime
        = newEvent.config.isSingleDayEvent
          ? mergeDateTime({
            dateStr: newEvent.dateRange.at(0), timeStr: newEvent.endTime, isOutputUTC:
              true,
          })
          : mergeDateTime({
            dateStr: newEvent.dateRange.at(-1), timeStr: newEvent.endTime, isOutputUTC:
              true,
          })
    }

    const formData = new FormData()
    formData.append('id', newEvent.id)
    formData.append('name', newEvent.name)
    formData.append('description', newEvent.description)
    formData.append('location', newEvent.location)
    formData.append('startDatetime', newEvent.startDatetime)
    formData.append('endDatetime', newEvent.endDatetime || '')
    formData.append('config', JSON.stringify(newEvent.config))
    formData.append('slug', newEvent.slug)
    formData.append('currency', newEvent.currency)
    formData.append('taxType', newEvent.taxType || 'percent')
    formData.append('taxAmount', newEvent.taxAmount || 0)

    if (newEvent.banner
    )
      formData.append('banner', newEvent.banner)
    if (newEvent.rmImage) formData.append('rmImage', newEvent.rmImage)
    if (newUpload.value) formData.append('files', newUpload.value)

    store.dispatch('event/save', formData).then(result => {
      // newEvent = {...newEvent, ...newEventInit}
      Object.assign(newEvent, {
        ...newEventInit,
      })
      router.push({
        name: 'dashboard-admin',
      })
    })
  }

  async function fetchData () {
    if (!event.value?.id && route.params.eventId) {
      try {
        await store.dispatch('event/setEvent', {
          eventId: route.params.eventId,
          clubId: currentUser.value?.clubId,
        })
      } catch (error) {
        console.error('Error fetching event data:', error)
        throw error
      }
    }
  }

  onMounted(async () => {
    try {
      await fetchData()

      // Wait for event data to be available
      if (event.value) {
        Object.assign(newEvent, {
          ...event.value,
        })
        const startDateTime = splitDateTime({ inputDate: event.value.startDatetime })
        const endDateTime = splitDateTime({ inputDate: event.value.endDatetime })
        newEvent.dateRange[0] = startDateTime.dateStr
        newEvent.dateRange[1] = endDateTime?.dateStr || startDateTime.dateStr
        newEvent.startTime = startDateTime.timeStr.slice(0, 5)
        newEvent.endTime = endDateTime?.timeStr.slice(0, 5) || '23:59'
      }
    } catch (error) {
      console.error('Error loading event:', error)
    // return router.push({ name: 'dashboard-admin' })
    } finally {
      isLoading.value = false
    }
  })
</script>

<template>
  <v-container class="event-edit-container">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <PageTitle
          :subtitle="event?.name"
          title="Edit Event"
        />
      </v-col>
    </v-row>

    <v-row v-if="isLoading">
      <v-col
        cols="12"
        lg="8"
        xl="6"
      >
        <v-card
          class="form-card"
          elevation="4"
        >
          <v-card-text class="pa-6 text-center">
            <v-progress-circular
              color="primary"
              indeterminate
              size="64"
            />
            <p class="mt-4 text-body-1">
              Loading event data...
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else>
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
              @submit.prevent="handleSubmitEditEvent"
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
                hint="Custom URL for your event (e.g., 'conference-2024'). Leave empty to auto-generate from event name."
                label="URL Slug (optional)"
                persistent-hint
                prepend-inner-icon="mdi-link"
                variant="solo"
                @click:append-inner="newEvent.slug = generateSlug(newEvent.name)"
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

              <ImageManager
                v-if="event?.banner && event.banner !== 'null' && event.banner.trim() !== ''"
                class="mt-2 mt-md-4"
                :src="getEventImageUrl(event.banner, 'Event')"
                @delete="handleBannerDelete"
              />

              <v-file-upload
                accept="image/*"
                class="mt-2 mt-md-4"
                clearable
                density="compact"
                rounded
                show-size
                title="Update Banner"
                variant="solo"
                @update:model-value="handleBannerUpdate"
              />

              <!-- Landing Page Configuration -->
              <!--              <v-expansion-panels class="mb-6">-->
              <!--                <v-expansion-panel>-->
              <!--                  <v-expansion-panel-title>-->
              <!--                    <v-icon class="me-2">mdi-web</v-icon>-->
              <!--                    Landing Page Configuration-->
              <!--                  </v-expansion-panel-title>-->
              <!--                  <v-expansion-panel-text>-->
              <!--                    <v-switch-->
              <!--                      v-model="newEvent.landingConfig.enableLandingPage"-->
              <!--                      color="primary"-->
              <!--                      hide-details-->
              <!--                      label="Enable Landing Page"-->
              <!--                    />-->

              <!--                    <v-text-field-->
              <!--                      v-model="newEvent.landingConfig.heroTitle"-->
              <!--                      class="mt-4"-->
              <!--                      density="comfortable"-->
              <!--                      hide-details="auto"-->
              <!--                      label="Hero Title"-->
              <!--                      variant="solo"-->
              <!--                    />-->

              <!--                    <v-textarea-->
              <!--                      v-model="newEvent.landingConfig.heroSubtitle"-->
              <!--                      class="mt-4"-->
              <!--                      density="comfortable"-->
              <!--                      hide-details="auto"-->
              <!--                      label="Hero Subtitle"-->
              <!--                      rows="2"-->
              <!--                      variant="solo"-->
              <!--                    />-->

              <!--                    <v-text-field-->
              <!--                      v-model="newEvent.landingConfig.overviewTitle"-->
              <!--                      class="mt-4"-->
              <!--                      density="comfortable"-->
              <!--                      hide-details="auto"-->
              <!--                      label="Overview Section Title"-->
              <!--                      variant="solo"-->
              <!--                    />-->

              <!--                    <v-textarea-->
              <!--                      v-model="newEvent.landingConfig.overviewDescription"-->
              <!--                      class="mt-4"-->
              <!--                      density="comfortable"-->
              <!--                      hide-details="auto"-->
              <!--                      label="Overview Description"-->
              <!--                      rows="3"-->
              <!--                      variant="solo"-->
              <!--                    />-->
              <!--                  </v-expansion-panel-text>-->
              <!--                </v-expansion-panel>-->
              <!--              </v-expansion-panels>-->

              <div class="d-flex align-center mt-3 mt-md-4">
                <v-btn
                  color="secondary"
                  prepend-icon="mdi-cog"
                  rounded="xl"
                  :size="xs ? 'default' : 'large'"
                  :to="{ name: 'event-config', params: { eventId: newEvent.id } }"
                  variant="outlined"
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
                  Save
                </v-btn>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.v-avatar {
  border-radius: 0;
}

.v-avatar.v-avatar--density-default {
  width: calc(var(--v-avatar-height) + 80px);
}
</style>
