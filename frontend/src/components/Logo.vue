<script setup>
  import { useDisplay } from 'vuetify'
  import { appInfo } from '@/utils'

  const { xs } = useDisplay()
  const { imgSrc, title, imgClass, containerClass, maxWidth, width } = defineProps([
    'imgSrc',
    'title',
    'imgClass',
    'containerClass',
    'maxWidth',
    'width',
  ])

  const emit = defineEmits(['click'])

  function handleClick () {
    emit('click')
  }
</script>

<template>
  <div
    :class="`d-flex align-center ${containerClass}`"
    @click="handleClick"
  >
    <v-img
      v-if="imgSrc"
      :class="` ${imgClass}`"
      :max-width="maxWidth"
      :src="imgSrc"
      :width="width"
    />

    <div
      v-if="title"
      class="pl-2"
    >
      <component :is="xs ? 'h3' : 'h2'">
        <span class="logo-text">{{ appInfo.name }}</span>
      </component>
    </div>
  </div>
</template>

<style scoped>
.logo-text {
  color: rgb(var(--v-theme-secondary)) !important;
  font-weight: var(--font-weight-semibold);
}
</style>
