<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import { generateSlug, getEventImageUrl, toLocalISOString } from '@/others/util'
import { useDisplay } from 'vuetify'
import PageTitle from '@/components/PageTitle.vue'
import ImageManager from '@/components/ImageManager.vue'

const { xs } = useDisplay()
const route = useRoute()
const router = useRouter()
const store = useStore()

const currentUser = computed(() => store.getters['auth/getCurrentUser'])
const prefetchedEvent = computed(() => store.getters['event/getEventById'](route.params.eventId))
const event = computed(() =>
  prefetchedEvent.value?.id ? prefetchedEvent.value : store.state.event.event,
)

const newEventInit = {
  id: null,
  name: '',
  description: '',
  location: '',
  dateRange: [new Date(), new Date()],
  banner: '',
  slug: '',
  currency: '',
  clubId: '',
  createdBy: '',
  landingConfig: {},
  taxType: 'percent',
  taxAmount: 0,
}
const newEvent = reactive({ ...newEventInit })

const form = ref(null)
const isFormValid = ref(true)
const isLoading = ref(true)

const handleBannerUpdate = (file) => {
  newEvent.banner = file
}

const handleBannerDelete = () => {
  newEvent.banner = null
  // Get the current banner from either event.value or the store
  const currentBanner = event.value?.banner || store.state.event.event?.banner

  newEvent.rmImage = currentBanner
}

// Watch for title changes and auto-generate slug if slug field is empty
watch(
  () => newEvent.name,
  (newTitle) => {
    if (newTitle && !newEvent.slug) {
      newEvent.slug = generateSlug(newTitle)
    }
  },
)

const handleSubmitEditEvent = async () => {
  await form.value.validate()
  if (!isFormValid.value) return

  // Auto-generate slug if empty
  if (!newEvent.slug || newEvent.slug.trim() === '') {
    newEvent.slug = generateSlug(newEvent.name)
  }

  const formData = new FormData()
  formData.append('id', newEvent.id)
  formData.append('name', newEvent.name)
  formData.append('description', newEvent.description)
  formData.append('location', newEvent.location)
  formData.append('startDate', toLocalISOString(newEvent.dateRange[0]).slice(0, 10))
  formData.append(
    'endDate',
    toLocalISOString(newEvent.dateRange[newEvent.dateRange.length - 1]).slice(0, 10),
  )
  formData.append('slug', newEvent.slug)
  formData.append('currency', newEvent.currency)
  formData.append('landingConfig', JSON.stringify(newEvent.landingConfig))

  if (newEvent.banner) formData.append('files', newEvent.banner)
  if (newEvent.rmImage) formData.append('rmImage', newEvent.rmImage)

  store.dispatch('event/save', formData).then((result) => {
    // newEvent = {...newEvent, ...newEventInit}
    Object.assign(newEvent, {
      ...newEventInit,
    })
    router.push({
      name: 'dashboard-admin',
    })
  })
}
const fetchData = async () => {
  if (!event.value?.id && route.params.eventId) {
    try {
      await store.dispatch('event/setEventByEventIdnClubId', {
        eventId: route.params.eventId,
        clubId: currentUser.value?.clubId,
      })
    } catch (error) {
      console.error('Error fetching event data:', error)
      throw error
    }
  }
}
// Helper function to safely parse dates
const parseDate = (dateValue) => {
  if (!dateValue) return new Date()

  try {
    const date = new Date(dateValue)
    return isNaN(date.getTime()) ? new Date() : date
  } catch (error) {
    return new Date()
  }
}

onMounted(async () => {
  try {
    await fetchData()

    // Wait for event data to be available
    if (event.value && event.value.id) {
      Object.assign(newEvent, {
        ...event.value,
        dateRange: [parseDate(event.value.startDate), parseDate(event.value.endDate)],
      })
    } else {
      // If event data is not available, try to fetch it once more
      await store.dispatch('event/setEvent', {
        eventId: route.params.eventId,
      })

      if (store.state.event.event && store.state.event.event.id) {
        Object.assign(newEvent, {
          ...store.state.event.event,
          dateRange: [
            parseDate(store.state.event.event.startDate),
            parseDate(store.state.event.event.endDate),
          ],
        })
      } else {
        // If still no event found, redirect to dashboard
        console.error('Event not found:', route.params.eventId)
        router.push({ name: 'dashboard-admin' })
        return
      }
    }
  } catch (error) {
    console.error('Error loading event:', error)
    router.push({ name: 'dashboard-admin' })
    return
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
          subtitle="Update your event details and configuration"
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
                :rules="[(v) => !!v || 'Name is required!']"
                class="mb-4"
                clearable
                density="comfortable"
                hide-details="auto"
                label="Event Name"
                prepend-inner-icon="mdi-format-title"
                required
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
                :items="[
                  { value: 'USD', text: 'USD ($)' },
                  { value: 'EUR', text: 'EUR (€)' },
                  { value: 'GBP', text: 'GBP (£)' },
                ]"
                class="mb-4"
                density="comfortable"
                hide-details="auto"
                item-title="text"
                item-value="value"
                label="Currency"
                prepend-inner-icon="mdi-cash-multiple"
                variant="solo"
              />

              <v-text-field
                v-model="newEvent.slug"
                :disabled="!newEvent.name"
                append-inner-icon="mdi-refresh"
                class="mb-4"
                clearable
                density="comfortable"
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
                :rules="[
                  (v) => !!v || 'Date range is required!',
                  (v) =>
                    (v && Array.isArray(v) && v.length >= 2) ||
                    'Please select both start and end dates',
                  (v) =>
                    (v && Array.isArray(v) && v.length >= 2 && v[0] <= v[v.length - 1]) ||
                    'Start date must be before end date',
                ]"
                class="mb-4"
                color="primary"
                label="Event Date"
                multiple="range"
                prepend-icon=""
                prepend-inner-icon="mdi-calendar"
                show-adjacent-months
                variant="solo"
              />

              <v-row class="mt-n8 mb-2">
                <v-col
                  cols="12"
                  md="6"
                >
                  <v-select
                    v-model="newEvent.taxType"
                    :items="[
                      { value: 'percent', text: 'Percentage %' },
                      { value: 'fixed', text: 'Fixed amount' },
                    ]"
                    density="comfortable"
                    hide-details="auto"
                    item-title="text"
                    item-value="value"
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
                :src="getEventImageUrl(event.banner, 'Event')"
                class="mt-2 mt-md-4"
                @delete="handleBannerDelete"
              />

              <v-file-upload
                accept="image/*"
                class="mt-2 mt-md-4"
                density="compact"
                rounded
                show-size
                title="Update Banner"
                variant="solo"
                clearable
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
                <v-spacer />
                <v-btn
                  :size="xs ? 'default' : 'large'"
                  color="primary"
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
