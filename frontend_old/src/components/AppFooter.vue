<template>
  <v-footer
    class="app-footer"
    color="surface"
    elevation="0"
  >
    <v-container>
      <v-row class="py-8">
        <v-col
          cols="12"
          md="4"
        >
          <div class="mb-4">
            <h3 class="text-h6 font-weight-bold text-primary mb-3">
              Event Management Platform
            </h3>
            <p class="text-body-2 text-medium-emphasis">
              Professional event management solution for clubs and organizations. Streamline
              registrations, manage attendees, and create memorable experiences.
            </p>
          </div>
        </v-col>

        <v-col
          cols="12"
          md="4"
        >
          <div class="mb-4">
            <h4 class="text-h6 font-weight-semibold mb-3 text-surface">
              Quick Links
            </h4>
            <v-list class="bg-transparent pa-0">
              <v-list-item
                v-for="link in quickLinks"
                :key="link.name"
                :href="link.href"
                class="px-0 py-1"
                density="compact"
              >
                <template #prepend>
                  <v-icon
                    color="primary"
                    size="16"
                  >
                    {{ link.icon }}
                  </v-icon>
                </template>
                <v-list-item-title class="text-body-2">
                  {{ link.name }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </div>
        </v-col>

        <v-col
          cols="12"
          md="4"
        >
          <div class="mb-4">
            <h4 class="text-h6 font-weight-semibold mb-3 text-surface">
              Support Events
            </h4>
            <p class="text-body-2 text-medium-emphasis mb-4">
              Help make events extraordinary by becoming a sponsor. Your support enables better
              experiences for all attendees.
            </p>
          </div>
        </v-col>
      </v-row>

      <v-divider class="mb-4" />

      <v-row class="align-center">
        <v-col
          cols="12"
          md="6"
        >
          <p class="text-body-2 text-medium-emphasis mb-0">
            © {{ new Date().getFullYear() }} Event Management Platform. All rights reserved.
          </p>
        </v-col>
        <v-col
          class="text-md-right"
          cols="12"
          md="6"
        >
          <div class="d-flex gap-2 justify-md-end">
            <v-btn
              v-if="currentEvent"
              :to="`/event/${currentEvent.id}/sponsor`"
              color="primary"
              prepend-icon="mdi-heart"
              size="small"
              variant="elevated"
            >
              Become a Sponsor
            </v-btn>
            <v-btn
              v-else
              color="primary"
              disabled
              prepend-icon="mdi-heart"
              size="small"
              variant="elevated"
            >
              Become a Sponsor
            </v-btn>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </v-footer>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from 'vuex'

const route = useRoute()
const store = useStore()

const currentEvent = computed(() => {
  if (route.params.eventId) {
    return store.getters['event/getEventById'](route.params.eventId)
  }
  return null
})

const quickLinks = [
  {
    name: 'Home',
    href: '/',
    icon: 'mdi-home',
  },
  {
    name: 'Events',
    href: '/events',
    icon: 'mdi-calendar',
  },
  {
    name: 'About',
    href: '/about',
    icon: 'mdi-information',
  },
  {
    name: 'Contact',
    href: '/contact',
    icon: 'mdi-email',
  },
]
</script>

<style scoped>
.app-footer {
  border-top: 1px solid rgba(var(--v-theme-outline), 0.12);
}

.app-footer .v-list-item {
  min-height: 32px;
}

.app-footer .v-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
  border-radius: 4px;
}
</style>
