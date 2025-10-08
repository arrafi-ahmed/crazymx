<script setup>
  import QRCodeVue3 from 'qrcode-vue3'

  import { computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useTheme } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { generateQrData } from '@/others/util.js'

  definePage({
    name: 'qr-viewer',
    meta: {
      layout: 'default',
      title: 'QR Code',
      requiresAdmin: true,
    },
  })

  const store = useStore()
  const route = useRoute()
  const router = useRouter()
  const theme = useTheme()

  const registrationId = computed(() => route.params.registrationId)
  const attendeeId = computed(() => route.params.attendeeId)
  const qrUuid = computed(() => route.params.qrUuid)

  const qrOptions = {
    type: 'dot',
    color: theme.global.current.value.colors.primary,
  }

  const isSignedin = computed(() => store.getters['auth/signedin'])
</script>
<template>
  <v-container class="qr-viewer-container">
    <!-- Header Section -->
    <v-row
      v-if="isSignedin"
      class="mb-6"
    >
      <v-col cols="12">
        <PageTitle
          subtitle="View and download QR codes for scanning"
          title="QR Code Viewer"
        />
      </v-col>
    </v-row>

    <v-row
      align="center"
      justify="center"
    >
      <v-col cols="auto mt-5">
        <QRCodeVue3
          v-if="attendeeId && qrUuid"
          :corners-square-options="qrOptions"
          :dots-options="qrOptions"
          :download="true"
          download-button="v-btn v-theme--light v-btn--block bg-primary v-btn--density-default v-btn--size-small v-btn--variant-flat mt-2"
          :height="200"
          :value="
            generateQrData({
              registrationId,
              attendeeId,
              qrUuid,
            })
          "
          :width="200"
        />
        <v-alert
          v-else
          border="start"
          closable
          density="compact"
        >
          No data available!
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>

<style></style>
