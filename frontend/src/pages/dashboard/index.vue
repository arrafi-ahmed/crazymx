<script setup>
  definePage({
    name: 'dashboard',
    meta: {
      layout: 'default',
      title: 'Dashboard',
      requiresAuth: true,
    },
  })
</script>

<template>
  <router-view />
</template>

<style scoped></style>
