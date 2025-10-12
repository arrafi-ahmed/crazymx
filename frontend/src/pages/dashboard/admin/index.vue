<script setup>
  import { computed, onMounted } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { formatEventDateDisplay, getEventImageUrl } from '@/utils'

  definePage({
    name: 'dashboard-admin',
    meta: {
      layout: 'default',
      title: 'Dashboard Admin',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const {xs} = useDisplay)
  const store = useStore()
  const route = useRoute()
  const router = useRouter()

  const events = computed(() => store.state.event.events)
  const currentUser = computed(() => store.getters['auth/getCurrentUser'])

  function deleteEvent (eventId) {
    store.dispatch('event/removeEvent', { eventId, clubId: currentUser.value.clubId })
  }

  async function fetchData () {
    await store.dispatch('event/setEvents', currentUser.value.clubId)
  }

  onMounted(async () => {
    await fetchData()
  })

  function formatEventDates (item) {
    return formatEventDateDisplay({ event: item, eventConfig: item.config })
  }
</script>

<template>
  <v-container class="admin-dashboard">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <PageTitle
          :show-back-button="false"
          subtitle="Manage your event settings"
          title="Admin Dashboard"
        >
          <template #actions>
            <v-btn
              v-if="xs"
              color="secondary"
              prepend-icon="mdi-plus"
              rounded="xl"
              size="large"
              :to="{ name: 'event-add' }"
              variant="outlined"
            >
               Event
            </v-btn>
            <v-btn
              v-if="xs"
              color="secondary"
              prepend-icon="mdi-plus"
              rounded="xl"
              size="large"
              :to="{ name: 'event-add' }"
              variant="outlined"
            >
              Add Event
            </v-btn>
          </template>

          <template #mobile-actions>
            <v-btn
              color="secondary"
              icon="mdi-plus"
              size="large"
              :to="{ name: 'event-add' }"
              variant="outlined"
            />
          </template>
        </PageTitle>
      </v-col>
    </v-row>

    <!-- Events Grid -->
    <v-row v-if="events.length > 0">
      <v-col
        v-for="(item, index) in events"
        :key="index"
        cols="12"
        lg="4"
        md="6"
      >
        <v-card
          class="event-card"
          elevation="4"
          rounded="xl"
        >
          <!-- Event Image -->
          <v-img
            :aspect-ratio="16 / 9"
            class="event-image"
            cover
            :src="getEventImageUrl(item.banner, item.name)"
          >
            <template #placeholder>
              <div class="d-flex align-center justify-center fill-height">
                <v-icon
                  color="grey-lighten-1"
                  size="64"
                >
                  mdi-calendar
                </v-icon>
              </div>
            </template>
          </v-img>

          <!-- Event Content -->
          <v-card-text class="pa-6">
            <h3 class="text-h5 font-weight-bold mb-3">
              {{ item.name }}
            </h3>

            <div class="event-details mb-4">
              <div class="d-flex align-center mb-2">
                <v-icon
                  class="mr-2"
                  color="primary"
                  size="23"
                >
                  mdi-calendar
                </v-icon>
                <span class="text-body-2">
                  {{ formatEventDates(item) }}
                </span>
              </div>
              <div class="d-flex align-center">
                <v-icon
                  class="mr-2"
                  color="primary"
                  size="23"
                >
                  mdi-map-marker
                </v-icon>
                <span class="text-body-2">{{ item.location }}</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="d-flex flex-wrap gap-3 mb-4">
              <v-btn
                class="px-2"
                color="primary"
                density="comfortable"
                prepend-icon="mdi-pencil"
                rounded="lg"
                :to="{ name: 'event-edit', params: { eventId: item.id } }"
                variant="tonal"
              >
                Edit
              </v-btn>
              <v-btn
                class="px-2 ml-1"
                color="success"
                density="comfortable"
                prepend-icon="mdi-account-multiple"
                rounded="lg"
                :to="{ name: 'event-attendees', params: { eventId: item.id } }"
                variant="tonal"
              >
                Attendees
              </v-btn>
              <v-btn
                class="px-2 ml-1"
                color="info"
                density="comfortable"
                prepend-icon="mdi-ticket"
                rounded="lg"
                :to="{ name: 'event-tickets', params: { eventId: item.id } }"
                variant="tonal"
              >
                Tickets
              </v-btn>
            </div>

            <!-- Quick Actions Menu -->
            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  block
                  class="px-6"
                  color="primary"
                  prepend-icon="mdi-dots-horizontal"
                  rounded="lg"
                  v-bind="props"
                  variant="outlined"
                >
                  More Actions
                </v-btn>
              </template>
              <v-list
                density="compact"
                width="300"
              >
                <v-list-item
                  prepend-icon="mdi-qrcode"
                  title="Scanner"
                  @click="
                    router.push({
                      name: 'event-checkin',
                      params: { eventId: item.id, variant: 'main' },
                    })
                  "
                />
                <v-list-item
                  prepend-icon="mdi-web"
                  title="Registration Page"
                  @click="
                    router.push({
                      name: 'event-landing-slug',
                      params: { slug: item.slug },
                    })
                  "
                />
                <v-list-item
                  prepend-icon="mdi-plus"
                  title="Import Attendees"
                  @click="
                    router.push({ name: 'import', params: { eventId: item.id, variant: 'main' } })
                  "
                />
                <v-list-item
                  prepend-icon="mdi-cog"
                  title="Event Configuration"
                  @click="
                    router.push({ name: 'event-config', params: { eventId: item.id } })
                  "
                />
                <!--                <v-list-item-->
                <!--                  prepend-icon="mdi-form-select"-->
                <!--                  title="Form Builder"-->
                <!--                  @click="router.push({ name: 'form-builder', params: { eventId: item.id } })"-->
                <!--                />-->
                <!--                <v-list-item-->
                <!--                  prepend-icon="mdi-qrcode"-->
                <!--                  title="Voucher Scanner"-->
                <!--                  @click="-->
                <!--                    router.push({-->
                <!--                      name: 'event-checkin',-->
                <!--                      params: { eventId: item.id, variant: 'voucher' },-->
                <!--                    })-->
                <!--                  "-->
                <!--                />-->
                <!--                <v-list-item-->
                <!--                  prepend-icon="mdi-counter"-->
                <!--                  title="Statistics"-->
                <!--                  @click="router.push({ name: 'statistics', params: { eventId: item.id } })"-->
                <!--                />-->
                <!--                                <v-list-item-->
                <!--                                  prepend-icon="mdi-puzzle"-->
                <!--                                  title="Vouchers"-->
                <!--                                  @click="router.push({ name: 'event-extras', params: { eventId: item.id } })"-->
                <!--                                />-->
                <!--                <v-list-item-->
                <!--                  prepend-icon="mdi-ticket"-->
                <!--                  title="Manage Tickets"-->
                <!--                  @click="router.push({ name: 'event-tickets', params: { eventId: item.id } })"-->
                <!--                />-->
                <!--                <v-list-item-->
                <!--                  prepend-icon="mdi-handshake"-->
                <!--                  title="View Sponsorships"-->
                <!--                  @click="router.push({ name: 'event-sponsorships', params: { eventId: item.id } })"-->
                <!--                />-->
                <!--                <v-list-item-->
                <!--                  prepend-icon="mdi-package-variant"-->
                <!--                  title="Sponsorship Packages"-->
                <!--                  @click="-->
                <!--                    router.push({-->
                <!--                      name: 'event-sponsorship-packages',-->
                <!--                      params: { eventId: item.id },-->
                <!--                    })-->
                <!--                  "-->
                <!--                />-->
                <v-divider class="my-2" />
                <confirmation-dialog @confirm="deleteEvent(item.id)">
                  <template #activator="{ onClick }">
                    <v-list-item
                      class="text-error"
                      prepend-icon="mdi-delete"
                      title="Delete Event"
                      @click.stop="onClick"
                    />
                  </template>
                </confirmation-dialog>
              </v-list>
            </v-menu>
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
              mdi-calendar-plus
            </v-icon>
            <h3 class="text-h5 mb-3">
              No Events Found
            </h3>
            <!--            <p class="text-body-1 text-medium-emphasis mb-6">-->
            <!--              Create your first event to get started! Events help you organize and manage-->
            <!--              registrations for your activities.-->
            <!--            </p>-->
            <!--            <v-btn-->
            <!--              :to="{ name: 'event-add' }"-->
            <!--              color="primary"-->
            <!--              prepend-icon="mdi-plus"-->
            <!--              size="large"-->
            <!--              variant="elevated"-->
            <!--            >-->
            <!--              Create Your First Event-->
            <!--            </v-btn>-->
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.admin-dashboard {
  padding: 24px;
}

.event-card {
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.event-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
}

.event-image {
  position: relative;
}

.event-details {
  color: rgb(var(--v-theme-onSurfaceVariant));
}

.empty-state-card {
  border-radius: 16px;
  max-width: 500px;
  margin: 0 auto;
}

/* Responsive Design */
@media (max-width: 768px) {
  .admin-dashboard {
    padding: 16px;
  }

  .d-flex.gap-3 {
    flex-direction: column;
    gap: 12px !important;
  }
}
</style>
