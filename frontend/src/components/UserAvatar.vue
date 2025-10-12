<script setup>
  import { getUserImageUrl } from '@/utils'

  const { imgSrc, clickable } = defineProps({
    imgSrc: {},
    clickable: { default: true },
  })
</script>

<template>
  <v-avatar
    :class="{ clickable }"
    color="primary"
    size="45"
    @click="clickable ? $emit('clickAvatar') : undefined"
  >
    <v-img
      alt="User Avatar"
      :aspect-ratio="1"
      cover
      :src="getUserImageUrl(imgSrc)"
    />
  </v-avatar>
</template>

<style scoped></style>
