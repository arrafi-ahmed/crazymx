<script setup>
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { useRoute, useRouter } from 'vue-router'

// Props
const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
  showBackButton: {
    type: Boolean,
    default: true,
  },
})

// Computed
const { mobile } = useDisplay()
const isMobile = computed(() => mobile.value)

// Router
const route = useRoute()
const router = useRouter()

const handleBack = () => {
  const name = route.name?.toString() || ''
  // If on admin event child routes, go to admin dashboard
  const adminEventChildren = [
    'event-edit',
    'event-config',
    'event-attendees',
    'event-tickets',
    'event-extras',
    'event-sponsorships',
    'event-sponsorship-packages',
    'import',
    'statistics',
    'form-builder',
  ]
  if (adminEventChildren.includes(name)) {
    router.push({ name: 'dashboard-admin' })
    return
  }
  // Default: browser back
  router.back()
}
</script>

<template>
  <div class="page-title-container">
    <!-- Row 1: Back Button + Page Title + Action Buttons -->
    <div class="d-flex align-center justify-space-between gap-4 mb-2">
      <!-- Left Side: Back Button + Page Title -->
      <div class="d-flex align-center gap-3 flex-grow-1 min-width-0">
        <div class="flex-grow-1">
          <!-- Mobile back text on its own row -->
          <div
            v-if="showBackButton && isMobile"
            class="mb-1"
          >
            <v-btn
              variant="text"
              size="small"
              prepend-icon="mdi-chevron-left"
              class="px-1"
              flat
              @click="handleBack"
            >
              Back
            </v-btn>
          </div>
          <!-- Desktop back icon inline -->
          <div class="d-flex align-center gap-2">
            <v-btn
              v-if="showBackButton && !isMobile"
              icon="mdi-arrow-left"
              size="large"
              variant="text"
              @click="handleBack"
            />
            <div>
              <h1 class="text-h3 font-weight-bold mb-0">
                {{ title }}
              </h1>
              <p class="text-body-1 text-medium-emphasis mb-0">
                {{ subtitle }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Side: Action Buttons -->
      <div class="d-flex flex-shrink-0 gap-2">
        <!-- Desktop: Full buttons -->
        <template v-if="!isMobile">
          <slot name="actions" />
        </template>

        <!-- Mobile: Icon buttons -->
        <template v-else>
          <slot name="mobile-actions" />
        </template>
      </div>
    </div>

    <!-- Row 2: Event Name/Description -->
    <div
      v-if="subtitle"
      class="d-flex align-center gap-3"
    />
  </div>
</template>

<style scoped>
.page-title-container {
  width: 100%;
}

.min-width-0 {
  min-width: 0 !important;
}

.flex-shrink-0 {
  flex-shrink: 0 !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .page-title-container h1 {
    font-size: 1.5rem !important;
    line-height: 1.2 !important;
  }
}
</style>
