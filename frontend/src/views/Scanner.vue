<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useStore } from 'vuex'
import { QrcodeStream } from 'vue-qrcode-reader'
import { useRoute, useRouter } from 'vue-router'
import { formatDateTime } from '@/others/util'
import { toast } from 'vue-sonner'
import PageTitle from '@/components/PageTitle.vue'

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

const event = computed(() => store.getters['event/getEventById'](route.params.eventId))
const result = reactive({})

// Auto-hide success/error messages
let successTimer = null
let errorTimer = null

const resetScanState = () => {
  scanSuccess.value = false
  scanError.value = false
  if (successTimer) clearTimeout(successTimer)
  if (errorTimer) clearTimeout(errorTimer)
}

const showSuccessMessage = (message) => {
  scanSuccess.value = true
  toast.success(message)
  successTimer = setTimeout(() => {
    scanSuccess.value = false
  }, 3000)
}

const showErrorMessage = (message) => {
  scanError.value = true
  toast.error(message)
  errorTimer = setTimeout(() => {
    scanError.value = false
  }, 3000)
}

const handleScan = async ([decodedString]) => {
  isPaused.value = true

  await store
    .dispatch('checkin/scanByRegistrationId', {
      qrCodeData: decodedString.rawValue,
      eventId: route.params.eventId,
    })
    .then((res) => {
      Object.assign(result, { ...res.data.payload })
      scanCount.value++
      lastScanTime.value = new Date()

      const statusMessage = result.registrationStatus
        ? 'Check-in successful!'
        : 'Already checked in'
      showSuccessMessage(statusMessage)
    })
    .catch((err) => {
    })
    .finally(() => {
      isPaused.value = false
    })
}

const scannerVariant = computed(() => route.params.variant)
const variantLabel = computed(() => {
  return scannerVariant.value === 'main' ? 'Attendee Check-in' : 'Voucher Scanner'
})

const switchScanner = () => {
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
      Object.keys(result).forEach((key) => delete result[key])
      resetScanState()
    })
}

const toggleScanner = () => {
  showScanner.value = !showScanner.value
  if (showScanner.value) {
    resetScanState()
    // Reset camera state when showing scanner
    cameraError.value = false
    cameraLoading.value = true
    cameraRetryCount.value = 0
  }
}

const clearResults = () => {
  Object.keys(result).forEach((key) => delete result[key])
  resetScanState()
}

const onError = (err) => {
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

const onInit = () => {
  cameraLoading.value = false
  cameraError.value = false
  cameraRetryCount.value = 0
}

const retryCamera = () => {
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

const forceCameraRefresh = () => {
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
      stream.getTracks().forEach((track) => track.stop())
    }

    cameraLoading.value = false

    // Set a timeout to prevent indefinite loading state
    setTimeout(() => {
      if (cameraLoading.value) {
        retryCamera()
      }
    }, 10000) // 10 second timeout
  } catch (err) {
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
    fluid
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
              :disabled="Object.keys(result).length === 0"
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
              :disabled="Object.keys(result).length === 0"
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
                :color="scannerVariant === 'main' ? 'primary' : 'secondary'"
                :icon="scannerVariant === 'main' ? 'mdi-account-check' : 'mdi-ticket-confirmation'"
                class="mr-2"
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
                :paused="isPaused"
                class="scanner-video"
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

              <!-- Success/Error Overlay -->
              <div
                v-if="scanSuccess"
                class="scan-feedback success"
              >
                <v-icon
                  color="success"
                  icon="mdi-check-circle"
                  size="64"
                />
                <p class="text-success text-h6 mt-2">
                  Success!
                </p>
              </div>

              <div
                v-if="scanError"
                class="scan-feedback error"
              >
                <v-icon
                  color="error"
                  icon="mdi-alert-circle"
                  size="64"
                />
                <p class="text-error text-h6 mt-2">
                  Error!
                </p>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Results Section -->
    <v-row v-if="Object.keys(result).length > 0">
      <v-col
        class="mx-auto"
        cols="12"
        lg="8"
        md="10"
      >
        <!-- Attendee Details -->
        <v-card
          v-if="scannerVariant === 'main' && result.registrationData"
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
              :color="result.status === true ? 'success' : 'warning'"
              size="small"
              variant="flat"
            >
              {{ result.status === true ? 'Checked In' : 'Not Checked In' }}
            </v-chip>
          </v-card-title>

          <v-card-text class="pa-4">
            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <div class="info-item">
                  <label class="text-caption text-medium-emphasis">Name</label>
                  <p class="text-body-1 font-weight-medium">
                    {{ result.registrationData?.name }}
                  </p>
                </div>
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <div class="info-item">
                  <label class="text-caption text-medium-emphasis">Email</label>
                  <p class="text-body-1 font-weight-medium">
                    {{ result.registrationData?.email }}
                  </p>
                </div>
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <div class="info-item">
                  <label class="text-caption text-medium-emphasis">Phone</label>
                  <p class="text-body-1 font-weight-medium">
                    {{ result.registrationData?.phone }}
                  </p>
                </div>
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <div class="info-item">
                  <label class="text-caption text-medium-emphasis">Registration Time</label>
                  <p class="text-body-1 font-weight-medium">
                    {{ formatDateTime(result.registrationTime) }}
                  </p>
                </div>
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <div class="info-item">
                  <label class="text-caption text-medium-emphasis">Check-in Time</label>
                  <p class="text-body-1 font-weight-medium">
                    {{ result.checkinTime ? formatDateTime(result.checkinTime) : 'Pending' }}
                  </p>
                </div>
              </v-col>
            </v-row>

            <!-- Additional Fields -->
            <v-expand-transition>
              <div
                v-if="
                  result.registrationData?.others &&
                    Object.keys(result.registrationData.others).length > 0
                "
              >
                <v-divider class="my-4" />
                <h4 class="text-subtitle-1 font-weight-medium mb-3">
                  Additional Information
                </h4>
                <v-row>
                  <v-col
                    v-for="(value, key) in result.registrationData.others"
                    :key="key"
                    cols="12"
                    md="6"
                  >
                    <div class="info-item">
                      <label class="text-caption text-medium-emphasis">{{ key }}</label>
                      <p class="text-body-1 font-weight-medium">
                        {{ value }}
                      </p>
                    </div>
                  </v-col>
                </v-row>
              </div>
            </v-expand-transition>
          </v-card-text>
        </v-card>

        <!-- Voucher Details -->
        <v-card
          v-else-if="scannerVariant === 'voucher' && result.extrasData?.length > 0"
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
                    {{ result.scannedAt ? formatDateTime(result.scannedAt) : 'Pending' }}
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
                {{ lastScanTime ? formatDateTime(lastScanTime) : 'N/A' }}
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
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
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
