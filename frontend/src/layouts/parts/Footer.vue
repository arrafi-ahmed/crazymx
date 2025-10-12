<script setup>
  import { appInfo } from '@/utils'
</script>
<template>
  <v-footer class="flex-grow-0 footer bg-gradient">
    <v-row
      class="justify-center align-center"
      no-gutters
    >
      <v-col cols="auto">
        <p class="text-white mb-0">
          © {{ new Date().getFullYear() }} {{ appInfo.name }}.
        </p>
      </v-col>
    </v-row>
  </v-footer>
</template>

<style scoped>
.footer-container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
}
</style>
