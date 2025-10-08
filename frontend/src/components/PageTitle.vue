<script setup>
  import { computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'

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

  // Router
  const route = useRoute()
  const router = useRouter()

  function handleBack () {
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
  <div>
    <div class="d-flex align-center justify-space-between mb-2">
      <div class="d-flex align-center">
        <v-btn
          v-if="showBackButton"
          density="comfortable"
          icon="mdi-arrow-left"
          variant="text"
          @click="handleBack"
        />
        <div class="ml-2">
          <div class="text-h4 font-weight-bold">{{ title }}</div>
          <div v-if="subtitle" class="text-body-2 text-medium-emphasis">{{ subtitle }}</div>
        </div>
      </div>
      <div class="d-flex align-center">
        <slot name="actions" />
      </div>
    </div>
  </div>

</template>

<style scoped>
</style>
