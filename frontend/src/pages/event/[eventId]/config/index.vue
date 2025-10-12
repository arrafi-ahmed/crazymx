<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { EventConfig } from '@/models/EventConfig'

  definePage({
    name: 'event-config',
    meta: {
      layout: 'default',
      title: 'Event Configuration',
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

  const config = reactive({ ...new EventConfig() })

  const dateFormatOptions = [
    { title: 'MM/DD/YYYY HH:mm (12/25/2024 14:30)', value: 'MM/DD/YYYY HH:mm' },
    { title: 'MM/DD/YYYY (12/25/2024)', value: 'MM/DD/YYYY' },
    { title: 'DD/MM/YYYY (25/12/2024)', value: 'DD/MM/YYYY' },
    { title: 'YYYY-MM-DD (2024-12-25)', value: 'YYYY-MM-DD' },
    { title: 'MMM DD, YYYY (Dec 25, 2024)', value: 'MMM DD, YYYY' },
    { title: 'MMMM DD, YYYY (December 25, 2024)', value: 'MMMM DD, YYYY' },
    { title: 'DD MMM YYYY (25 Dec 2024)', value: 'DD MMM YYYY' },
  ]

  const form = ref(null)
  const isFormValid = ref(true)
  const isLoading = ref(true)
  const isSaving = ref(false)

  async function handleSubmitConfig () {
    await form.value.validate()
    if (!isFormValid.value) return

    isSaving.value = true

    try {
      // Save config including all fields
      await store.dispatch('event/saveConfig', { config: config, eventId: event.value.id })

      // Show success message or redirect
      router.push({
        name: 'event-edit',
        params: { eventId: route.params.eventId },
      })
    } catch (error) {
      console.error('Error saving configuration:', error)
    } finally {
      isSaving.value = false
    }
  }

  async function fetchData () {
    if (!event.value?.id) {
      try {
        await store.dispatch('event/setEvent', {
          eventId: route.params.eventId,
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

      if (event.value?.id) {
        Object.assign(config, new EventConfig({ ...event.value.config }))
      } else {
        console.error('Event not found:', route.params.eventId)
        router.push({ name: 'dashboard-admin' })
        return
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
  <v-container class="event-config-container">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <PageTitle
          :subtitle="event?.name"
          title="Event Configuration"
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
              Loading configuration...
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
              @submit.prevent="handleSubmitConfig"
            >
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

              <div class="d-flex align-center mt-3 mt-md-4">
                <v-spacer />
                <v-btn
                  color="primary"
                  :disabled="isSaving"
                  :loading="isSaving"
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
.event-config-container {
  max-width: 1200px;
}

.form-card {
  border-radius: 12px;
}
</style>
