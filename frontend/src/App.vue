<script setup>
  import { computed, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useStore } from 'vuex'
  import ProgressLoader from '@/components/ProgressLoader.vue'
  import { appInfo } from '@/others/util'

  const route = useRoute()
  const store = useStore()

  const snackbars = computed(() => store.state.snackbars)

  // Handle Vuetify's update
  function setSnackbars (val) {
    store.commit('setSnackbars', val)
  }

  watch(route, to => {
    document.title = (to.meta.title && to.meta.title + ' | ' + appInfo.name) || appInfo.name
  })
</script>
<template>
  <progress-loader />
  <v-snackbar-queue
    closable
    location="bottom start"
    :model-value="snackbars"
    :timeout="4000"
    timer
    @update:model-value="setSnackbars"
  />
  <router-view />
</template>
<style>
.bg-gradient {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  )!important;
}
</style>
