<script setup>
  import { reactive, ref, watch } from 'vue'

  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { generateSlug, toLocalISOString } from '@/others/util'

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

  const newEventInit = {
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

  async function handleAddEvent () {
    await form.value.validate()
    if (!isFormValid.value) return

    // Auto-generate slug if empty
    if (!newEvent.slug || newEvent.slug.trim() === '') {
      newEvent.slug = generateSlug(newEvent.name)
    }

    const formData = new FormData()
    formData.append('name', newEvent.name)
    formData.append('description', newEvent.description)
    formData.append('location', newEvent.location)
    formData.append('startDate', toLocalISOString(newEvent.dateRange[0]).slice(0, 10))
    formData.append(
      'endDate',
      toLocalISOString(newEvent.dateRange.at(-1)).slice(0, 10),
    )
    formData.append('slug', newEvent.slug)
    formData.append('currency', newEvent.currency)
    formData.append('landingConfig', JSON.stringify(newEvent.landingConfig))

    if (newEvent.banner) formData.append('files', newEvent.banner)

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
</script>

<template>
  <v-container class="event-add-container">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <PageTitle
          subtitle="Set up your event details and configuration"
          title="Create New Event"
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
              <v-row
                class=" mb-4"
                no-gutters
              >
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
                    class="mb-2"
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
                class="mb-4"
                clearable
                density="compact"
                rounded
                show-size
                title="Event Banner"
                variant="solo"
                @update:model-value="handleEventBanner"
              />

              <v-divider class="my-6" />
              <div class="d-flex justify-end">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-plus"
                  rounded="xl"
                  size="large"
                  type="submit"
                  variant="elevated"
                >
                  Create
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
