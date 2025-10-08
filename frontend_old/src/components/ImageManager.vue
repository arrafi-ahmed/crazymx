<script setup>
import { computed, ref } from 'vue'
import ConfirmationDialog from '@/components/ConfirmationDialog.vue'

const {
  src,
  maxHeight = '200px',
  aspectRatio = '16/9',
} = defineProps({
  src: {
    type: String,
    default: null,
  },
  maxHeight: {
    type: String,
    default: '200px',
  },
  aspectRatio: {
    type: String,
    default: '16/9',
  },
})

const emit = defineEmits(['delete'])

const isDeleted = ref(false)
const imageDimensions = ref({ width: 0, height: 0 })

const hasImage = computed(() => {
  return src && src !== 'null' && src.trim() !== '' && !isDeleted.value
})

const imageStyle = computed(() => {
  const { width, height } = imageDimensions.value

  if (width === 0 || height === 0) {
    // Default size if dimensions not loaded yet
    return {
      width: '300px',
      height: '225px',
    }
  }

  const aspectRatio = width / height
  let containerWidth, containerHeight

  if (aspectRatio > 1.5) {
    // Wide/horizontal image
    containerWidth = '350px'
    containerHeight = '200px'
  } else if (aspectRatio < 0.7) {
    // Tall/vertical image
    containerWidth = '250px'
    containerHeight = '350px'
  } else {
    // Square-ish image
    containerWidth = '300px'
    containerHeight = '225px'
  }

  return {
    width: containerWidth,
    height: containerHeight,
  }
})

const placeholderStyle = computed(() => {
  const { width, height } = imageStyle.value
  return {
    width,
    height,
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
  }
})

const handleDelete = () => {
  isDeleted.value = true
  emit('delete')
}

const onImageLoad = (event) => {
  const { naturalWidth, naturalHeight } = event.target
  imageDimensions.value = { width: naturalWidth, height: naturalHeight }
}

const onImageError = (error) => {
  console.error('Image failed to load:', error)
}
</script>

<template>
  <div
    v-if="hasImage"
    class="image-preview-container mb-4"
  >
    <div class="image-preview border border-4 rounded-lg">
      <v-img
        :src="src"
        :style="imageStyle"
        alt="Preview"
        class="rounded-lg preview-image"
        cover
        @error="onImageError"
        @load="onImageLoad"
      />

      <!-- Delete Button -->
      <confirmation-dialog @confirm="handleDelete">
        <template #activator="{ onClick }">
          <v-btn
            class="delete-btn"
            color="error"
            size="small"
            title="Delete Image"
            variant="flat"
            @click.stop="onClick"
          >
            <v-icon size="20">
              mdi-delete
            </v-icon>
          </v-btn>
        </template>
      </confirmation-dialog>
    </div>
  </div>

  <!-- Deleted State Placeholder -->
  <div
    v-else-if="isDeleted"
    class="image-preview-container mb-4"
  >
    <div
      :style="placeholderStyle"
      class="image-preview border border-4 rounded-lg"
    >
      <div class="placeholder-content">
        <v-icon
          color="grey-lighten-1"
          size="48"
        >
          mdi-image-off
        </v-icon>
        <p class="text-body-2 text-grey-lighten-1 mt-2">
          Image deleted
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-preview-container {
  position: relative;
}

.image-preview {
  position: relative;
  display: inline-block;
}

.delete-btn {
  position: absolute !important;
  top: 8px !important;
  right: 8px !important;
  z-index: 2 !important;
  backdrop-filter: blur(4px);
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.2s ease;
  opacity: 0.9;
}

.preview-image {
  border-radius: 8px;
}

.placeholder-content {
  text-align: center;
}
</style>
