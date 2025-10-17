<script setup>
  import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'

  import { QrcodeStream } from 'vue-qrcode-reader'
  import { useRoute, useRouter } from 'vue-router'

  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { formatDateTime } from '@/utils'

  definePage({
    name: 'event-checkin',
    meta: {
      layout: 'default',
      title: 'Event Check-in',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const store = useStore()
  const route = useRoute()
  const router = useRouter()

  const isPaused = ref(false)
  const isScanning = ref(false)
  const scanSuccess = ref(false)
  const scanError = ref(false)
  const showScanner = ref(true)
  const scanCount = ref(0)
  const lastScanTime = ref(null)
  const cameraError = ref(false)
  const cameraLoading = ref(true)
  const cameraRetryCount = ref(0)
  const maxRetries = 3

  const event = computed(() => store.state.event.event)
  const result = reactive({})
  const hasResult = ref(false)

  // Auto-hide success/error messages
  let successTimer = null
  let errorTimer = null

  function resetScanState () {
    scanSuccess.value = false
    scanError.value = false
    if (successTimer) clearTimeout(successTimer)
    if (errorTimer) clearTimeout(errorTimer)
  }

  function showSuccessMessage (message) {
    scanSuccess.value = true
    store.commit('addSnackbar', { text: message, color: 'success' })
    successTimer = setTimeout(() => {
      scanSuccess.value = false
    }, 3000)
  }

  function showErrorMessage (message) {
    scanError.value = true
    store.commit('addSnackbar', { text: message, color: 'error' })
    errorTimer = setTimeout(() => {
      scanError.value = false
    }, 3000)
  }

  async function handleScan ([decodedString]) {
    isPaused.value = true
    isScanning.value = true

    await store
      .dispatch('checkin/scanByRegistrationId', {
        qrCodeData: decodedString.rawValue,
        eventId: route.params.eventId,
      })
      .then(res => {
        // 'res' is already the payload from the store action
        Object.assign(result, { ...res })
        hasResult.value = true
        scanCount.value++
        lastScanTime.value = new Date()
      })
      .finally(() => {
        isPaused.value = false
        isScanning.value = false
      })
  }

  const scannerVariant = computed(() => route.params.variant)
  const variantLabel = computed(() => {
    return scannerVariant.value === 'main' ? 'Attendee Check-in' : 'Voucher Scanner'
  })

  function switchScanner () {
    const nextVariant = scannerVariant.value === 'main' ? 'voucher' : 'main'
    router
      .push({
        name: 'event-checkin',
        params: {
          eventId: route.params.eventId,
          variant: nextVariant,
        },
      })
      .finally(() => {
        for (const key of Object.keys(result)) delete result[key]
        hasResult.value = false
        resetScanState()
      })
  }

  function toggleScanner () {
    showScanner.value = !showScanner.value
    if (showScanner.value) {
      resetScanState()
      // Reset camera state when showing scanner
      cameraError.value = false
      cameraLoading.value = true
      cameraRetryCount.value = 0
    }
  }

  function clearResults () {
    for (const key of Object.keys(result)) delete result[key]
    hasResult.value = false
    resetScanState()
  }

  function onError (err) {
    console.error('Scanner error:', err)
    cameraError.value = true
    cameraLoading.value = false

    // Auto-retry camera initialization
    if (cameraRetryCount.value < maxRetries) {
      setTimeout(() => {
        retryCamera()
      }, 1000)
    } else {
      showErrorMessage('Camera failed to initialize. Please refresh the page.')
    }
  }

  function onInit () {
    cameraLoading.value = false
    cameraError.value = false
    cameraRetryCount.value = 0
  }

  function retryCamera () {
    cameraRetryCount.value++
    cameraLoading.value = true
    cameraError.value = false

    // Force re-render of QR stream component with longer delay for mobile
    showScanner.value = false
    setTimeout(() => {
      showScanner.value = true
      // Additional delay for mobile browsers to properly reinitialize
      setTimeout(() => {
        if (cameraLoading.value) {
          cameraLoading.value = false
        }
      }, 2000)
    }, 300)
  }

  function forceCameraRefresh () {
    // Complete camera reset for stubborn mobile browsers
    showScanner.value = false
    cameraLoading.value = true
    cameraError.value = false
    cameraRetryCount.value = 0

    setTimeout(() => {
      showScanner.value = true
    }, 500)
  }

  onMounted(async () => {
    try {
      await store.dispatch('event/setEvent', { eventId: route.params.eventId })
      // Check if we're on a mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      )

      // Request camera permission on mount with mobile-optimized constraints
      const stream = await navigator.mediaDevices?.getUserMedia({
        video: {
          facingMode: isMobile ? 'environment' : 'user', // Back camera on mobile, front on desktop
          width: { ideal: isMobile ? 640 : 1280 },
          height: { ideal: isMobile ? 480 : 720 },
          aspectRatio: { ideal: 4 / 3 },
        },
      })

      // Stop the stream immediately after getting permission
      if (stream) {
        for (const track of stream.getTracks()) track.stop()
      }

      cameraLoading.value = false

      // Set a timeout to prevent indefinite loading state
      setTimeout(() => {
        if (cameraLoading.value) {
          retryCamera()
        }
      }, 10_000) // 10 second timeout
    } catch {
      showErrorMessage('Camera access is required for scanning')
      cameraError.value = true
      cameraLoading.value = false
    }
  })

  onUnmounted(() => {
    if (successTimer) clearTimeout(successTimer)
    if (errorTimer) clearTimeout(errorTimer)
  })
</script>

<template>
  <v-container
    class="scanner-container"
  >
    <!-- Header Section -->
    <v-row class="mb-4">
      <v-col cols="12">
        <PageTitle
          :subtitle="event?.name"
          title="Scanner"
        >
          <template #actions>
            <v-btn
              :disabled="!hasResult"
              icon="mdi-refresh"
              size="small"
              title="Clear Results"
              variant="text"
              @click="clearResults"
            />
            <v-btn
              v-if="cameraError || cameraRetryCount.value >= maxRetries"
              color="warning"
              icon="mdi-camera-refresh"
              size="small"
              title="Force Camera Refresh"
              variant="text"
              @click="forceCameraRefresh"
            />
            <v-btn
              :icon="showScanner ? 'mdi-eye-off' : 'mdi-eye'"
              size="small"
              title="Toggle Scanner"
              variant="text"
              @click="toggleScanner"
            />
          </template>

          <template #mobile-actions>
            <v-btn
              :disabled="!hasResult"
              icon="mdi-refresh"
              size="small"
              title="Clear Results"
              variant="text"
              @click="clearResults"
            />
            <v-btn
              v-if="cameraError || cameraRetryCount.value >= maxRetries"
              color="warning"
              icon="mdi-camera-refresh"
              size="small"
              title="Force Camera Refresh"
              variant="text"
              @click="forceCameraRefresh"
            />
            <v-btn
              :icon="showScanner ? 'mdi-eye-off' : 'mdi-eye'"
              size="small"
              title="Toggle Scanner"
              variant="text"
              @click="toggleScanner"
            />
          </template>
        </PageTitle>
      </v-col>
    </v-row>

    <!-- Scanner Section -->
    <v-row
      v-if="showScanner"
      class="mb-6"
    >
      <v-col
        class="mx-auto"
        cols="12"
        lg="8"
        md="10"
      >
        <v-card
          class="scanner-card"
          elevation="8"
        >
          <v-card-title class="d-flex align-center justify-space-between pa-4">
            <div class="d-flex align-center">
              <v-icon
                class="mr-2"
                :color="scannerVariant === 'main' ? 'primary' : 'secondary'"
                :icon="scannerVariant === 'main' ? 'mdi-account-check' : 'mdi-ticket-confirmation'"
                size="24"
              />
              <span class="text-h6">QR Scanner</span>
            </div>
            <div class="d-flex align-center gap-2">
              <v-chip
                :color="
                  cameraError
                    ? 'error'
                    : cameraLoading
                      ? 'warning'
                      : isScanning
                        ? 'warning'
                        : 'success'
                "
                size="small"
                variant="flat"
              >
                {{
                  cameraError
                    ? 'Camera Error'
                    : cameraLoading
                      ? 'Initializing...'
                      : isScanning
                        ? 'Scanning...'
                        : 'Ready'
                }}
              </v-chip>
              <v-btn
                v-if="cameraError"
                color="error"
                icon="mdi-refresh"
                size="x-small"
                title="Retry Camera"
                variant="text"
                @click="retryCamera"
              />
            </div>
          </v-card-title>

          <v-card-text class="pa-0">
            <div class="scanner-viewport">
              <!-- Camera Loading State -->
              <div
                v-if="cameraLoading"
                class="camera-loading"
              >
                <v-progress-circular
                  color="primary"
                  indeterminate
                  size="64"
                />
                <p class="text-body-1 mt-3 text-medium-emphasis">
                  Initializing camera...
                </p>
              </div>

              <!-- Camera Error State -->
              <div
                v-else-if="cameraError"
                class="camera-error"
              >
                <v-icon
                  color="error"
                  icon="mdi-camera-off"
                  size="64"
                />
                <p class="text-body-1 mt-3 text-error">
                  Camera failed to initialize
                </p>
                <v-btn
                  color="primary"
                  size="small"
                  variant="outlined"
                  @click="retryCamera"
                >
                  Retry Camera
                </v-btn>
              </div>

              <!-- QR Scanner Stream -->
              <qrcode-stream
                v-else
                class="scanner-video"
                :paused="isPaused"
                @detect="handleScan"
                @error="onError"
                @init="onInit"
              />

              <!-- Scanner Overlay (only when camera is working) -->
              <div v-if="!cameraLoading && !cameraError">
                <div class="scanner-overlay">
                  <div class="scanner-frame">
                    <div class="corner top-left" />
                    <div class="corner top-right" />
                    <div class="corner bottom-left" />
                    <div class="corner bottom-right" />
                  </div>
                  <div class="scanner-instructions">
                    <v-icon
                      class="mr-1"
                      color="white"
                      icon="mdi-qrcode-scan"
                      size="24"
                    />
                    <span class="text-white text-caption">Position QR code within frame</span>
                  </div>
                </div>
              </div>

              <!-- Removed in-camera popup overlays; feedback handled via toasts and results below -->
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Results Section -->
    <v-row v-if="hasResult">
      <v-col
        class="mx-auto"
        cols="12"
        lg="8"
        md="10"
      >
        <!-- Voucher Details -->
        <v-card
          v-if="scannerVariant === 'voucher' && result.extrasData?.length > 0"
          class="mb-4"
        >
          <v-card-title class="d-flex align-center pa-4">
            <v-icon
              class="mr-2"
              color="secondary"
              icon="mdi-ticket-confirmation"
              size="24"
            />
            <span>Voucher Details</span>
            <v-spacer />
            <v-chip
              :color="result.status === true ? 'success' : 'warning'"
              size="small"
              variant="flat"
            >
              {{ result.status === true ? 'Redeemed' : 'Not Redeemed' }}
            </v-chip>
          </v-card-title>

          <v-card-text class="pa-4">
            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <div class="info-item">
                  <label class="text-caption text-medium-emphasis">Redeemed At</label>
                  <p class="text-body-1 font-weight-medium">
                    {{ result.scannedAt ? formatDateTime({input: result.scannedAt}) : 'Pending' }}
                  </p>
                </div>
              </v-col>
            </v-row>

            <v-divider class="my-4" />
            <h4 class="text-subtitle-1 font-weight-medium mb-3">
              Voucher Items
            </h4>
            <v-list class="bg-transparent">
              <v-list-item
                v-for="(item, index) in result.extrasData"
                :key="index"
                class="px-0"
                density="comfortable"
              >
                <template #prepend>
                  <v-icon
                    color="secondary"
                    icon="mdi-package-variant"
                  />
                </template>
                <v-list-item-title class="font-weight-medium">
                  {{ item.name }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  <div
                    v-for="(contentItem, contentIndex) in item.content"
                    :key="contentIndex"
                  >
                    {{ contentItem.name }} × {{ contentItem.quantity }}
                  </div>
                </v-list-item-subtitle>
                <template #append>
                  <v-chip
                    color="secondary"
                    size="small"
                    variant="outlined"
                  >
                    {{ item.content.length }} items
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Attendee Details Table -->
        <v-card
          v-else
          class="mb-4"
        >
          <v-card-title class="d-flex align-center pa-4">
            <v-icon
              class="mr-2"
              color="primary"
              icon="mdi-account-details"
              size="24"
            />
            <span>Attendee Details</span>
            <v-spacer />
            <v-chip
              :color="(result.registrationStatus ?? result.status) === true ? 'success' : 'warning'"
              size="small"
              variant="flat"
            >
              {{ (result.registrationStatus ?? result.status) === true ? 'Checked In' : 'Not Checked In' }}
            </v-chip>
          </v-card-title>

          <v-card-text class="pa-0">
            <!-- Attendee Information Table -->
            <v-table>
              <tbody>
                <tr>
                  <td class="text-caption text-medium-emphasis font-weight-medium pa-4" style="width: 30%">
                    Name
                  </td>
                  <td class="pa-4">
                    {{
                      [result.firstName, result.lastName].filter(Boolean).join(' ') || result.registrationData?.name || 'N/A'
                    }}
                  </td>
                </tr>
                <tr>
                  <td class="text-caption text-medium-emphasis font-weight-medium pa-4">
                    Email
                  </td>
                  <td class="pa-4">
                    {{ result.email || result.registrationData?.email || 'N/A' }}
                  </td>
                </tr>
                <tr>
                  <td class="text-caption text-medium-emphasis font-weight-medium pa-4">
                    Phone
                  </td>
                  <td class="pa-4">
                    {{ result.phone || result.registrationData?.phone || 'N/A' }}
                  </td>
                </tr>
                <tr>
                  <td class="text-caption text-medium-emphasis font-weight-medium pa-4">
                    Check-in Time
                  </td>
                  <td class="pa-4">
                    {{ result.checkinTime ? formatDateTime({input: result.checkinTime}) : 'Pending' }}
                  </td>
                </tr>
              </tbody>
            </v-table>

            <!-- Tickets Information Table -->
            <v-expand-transition>
              <div v-if="!event.config.saveAllAttendeesDetails && result.items">
                <v-divider />
                <div class="pa-4">
                  <h4 class="text-subtitle-1 font-weight-medium mb-3">
                    Tickets Information
                  </h4>

                  <!-- Group tickets table -->
                  <v-table v-if="result.items && Array.isArray(result.items)">
                    <thead>
                      <tr>
                        <th class="text-left">Ticket Type</th>
                        <th class="text-center">Quantity</th>
                        <th class="text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(item, index) in result.items"
                        :key="index"
                      >
                        <td class="pa-3">{{ item.title || 'Ticket' }}</td>
                        <td class="text-center pa-3">{{ item.quantity || 1 }}</td>
                        <td class="text-right pa-3">
                          <v-chip
                            v-if="item.unitPrice && item.unitPrice > 0"
                            color="primary"
                            size="small"
                            variant="outlined"
                          >
                            {{ formatPrice(item.unitPrice) }}
                          </v-chip>
                          <v-chip
                            v-else-if="item.unitPrice === 0"
                            color="success"
                            size="small"
                            variant="outlined"
                          >
                            Free
                          </v-chip>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>

                  <!-- Individual ticket table -->
                  <v-table v-else>
                    <thead>
                      <tr>
                        <th class="text-left">Ticket Type</th>
                        <th class="text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td class="pa-3">{{ result.ticketTitle || 'N/A' }}</td>
                        <td class="text-right pa-3">
                          <v-chip
                            v-if="result.ticketPrice && result.ticketPrice > 0"
                            color="primary"
                            size="small"
                            variant="outlined"
                          >
                            {{ formatPrice(result.ticketPrice) }}
                          </v-chip>
                          <v-chip
                            v-else-if="result.ticketPrice === 0"
                            color="success"
                            size="small"
                            variant="outlined"
                          >
                            Free
                          </v-chip>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>
              </div>
            </v-expand-transition>

            <!-- Additional Fields Table -->
            <v-expand-transition>
              <div
                v-if="
                  result.registrationData?.others &&
                    Object.keys(result.registrationData.others).length > 0
                "
              >
                <v-divider />
                <div class="pa-4">
                  <h4 class="text-subtitle-1 font-weight-medium mb-3">
                    Additional Information
                  </h4>
                  <v-table>
                    <tbody>
                      <tr
                        v-for="(value, key) in result.registrationData.others"
                        :key="key"
                      >
                        <td class="text-caption text-medium-emphasis font-weight-medium pa-3" style="width: 30%">
                          {{ key }}
                        </td>
                        <td class="pa-3">
                          {{ value }}
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>
              </div>
            </v-expand-transition>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Empty State -->
    <v-row v-else-if="!showScanner">
      <v-col
        class="mx-auto"
        cols="12"
        lg="8"
        md="10"
      >
        <v-card
          class="scanner-card"
          elevation="8"
        >
          <div class="scanner-viewport d-flex align-center justify-center">
            <div class="text-center">
              <v-icon
                class="mb-2"
                color="grey-lighten-1"
                icon="mdi-qrcode-scan"
                size="48"
              />
              <h3 class="text-h6 mb-1">
                Scanner Hidden
              </h3>
              <p class="text-caption text-medium-emphasis mb-3">
                Click the eye icon to show scanner
              </p>
              <v-btn
                color="primary"
                size="small"
                variant="outlined"
                @click="toggleScanner"
              >
                Show Scanner
              </v-btn>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Stats Footer -->
    <v-row
      v-if="scanCount > 0"
      class="mt-6"
    >
      <v-col
        class="mx-auto"
        cols="12"
        lg="8"
        md="10"
      >
        <v-card
          class="text-center pa-4"
          variant="outlined"
        >
          <div class="d-flex justify-space-around align-center">
            <div class="text-center">
              <div class="text-h6 font-weight-bold text-primary">
                {{ scanCount }}
              </div>
              <div class="text-caption text-medium-emphasis">
                Total Scans
              </div>
            </div>
            <v-divider vertical />
            <div class="text-center">
              <div class="text-h6 font-weight-bold text-secondary">
                {{ lastScanTime ? formatDateTime({input: lastScanTime}) : 'N/A' }}
              </div>
              <div class="text-caption text-medium-emphasis">
                Last Scan
              </div>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.scanner-container {
  min-height: 100vh;
  padding: 24px;
}

.scanner-card {
  border-radius: 16px;
  overflow: hidden;
}

.scanner-viewport {
  position: relative;
  width: 100%;
  max-width: 400px;
  height: 400px;
  overflow: hidden;
  border-radius: 12px;
  margin: 0 auto;
}

.scanner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-loading,
.camera-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  z-index: 10;
}

.camera-error {
  background: rgba(255, 255, 255, 0.98);
}

.scanner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}

.scanner-frame {
  position: relative;
  width: 250px;
  height: 250px;
}

.corner {
  position: absolute;
  width: 30px;
  height: 30px;
  border: 3px solid #fff;
}

.top-left {
  top: 0;
  left: 0;
  border-right: none;
  border-bottom: none;
}

.top-right {
  top: 0;
  right: 0;
  border-left: none;
  border-bottom: none;
}

.bottom-left {
  bottom: 0;
  left: 0;
  border-right: none;
  border-top: none;
}

.bottom-right {
  bottom: 0;
  right: 0;
  border-left: none;
  border-top: none;
}

.scanner-instructions {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  background: rgba(0, 0, 0, 0.7);
  padding: 6px 12px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.scan-feedback {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: feedbackPulse 0.6s ease-out;
}

@keyframes feedbackPulse {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.1);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.info-item {
  margin-bottom: 16px;
}

.info-item label {
  display: block;
  margin-bottom: 4px;
}

.info-item p {
  margin: 0;
  word-break: break-word;
}

/* Responsive Design */
@media (max-width: 768px) {
  .scanner-container {
    padding: 16px;
  }

  .scanner-viewport {
    height: 300px;
  }

  .scanner-frame {
    width: 200px;
    height: 200px;
  }

  .corner {
    width: 25px;
    height: 25px;
  }
}

@media (max-width: 480px) {
  .scanner-viewport {
    height: 250px;
  }

  .scanner-frame {
    width: 180px;
    height: 180px;
  }

  .corner {
    width: 20px;
    height: 20px;
  }
}
</style>
