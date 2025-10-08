<script setup>
  import { defineEmits, defineProps, ref, watch } from 'vue'
  import { useDisplay } from 'vuetify'
  import { formatDate } from '@/others/util'

  const model = defineModel()
  const { width, height, xs } = useDisplay()
  const emit = defineEmits(['update:modelValue', 'updateDate'])

  const { label, color, customClass, rules, variant } = defineProps({
    label: { type: String },
    color: { type: String },
    customClass: { type: String },
    rules: { type: Object },
    variant: { type: String },
  })
  const selectedDate = ref()
  const menu = ref(false)

  function handleDateChange (newDate) {
    emit('update:modelValue', new Date(newDate))
    emit('updateDate', new Date(newDate))
  }
  watch(
    () => model.value,
    newVal => {
      selectedDate.value = new Date(newVal)
      selectedDate.value = newVal ? formatDate(newVal) : ''
    },
  )
  watch(
    () => model.value,
    () => {
      menu.value = false
    },
  )
</script>

<template v-if="selectedDate">
  <v-menu
    v-model="menu"
    :close-on-content-click="false"
  >
    <template #activator="{ props }">
      <v-text-field
        v-model="selectedDate"
        :class="customClass"
        hide-details="auto"
        :label="label"
        prepend-inner-icon="mdi-calendar"
        readonly
        :rules="rules"
        :variant="variant"
        v-bind="props"
        @click:clear="selectedDate = null"
      />
    </template>
    <v-date-picker
      v-model="model"
      :color="color"
      :height="xs ? height : 'auto'"
      show-adjacent-months
      title=""
      :width="xs ? width : 'auto'"
      @update:model-value="handleDateChange"
    />
  </v-menu>
</template>
<style>
.v-overlay__content:has(> .v-date-picker) {
  min-width: auto !important;
}

.v-picker-title {
  padding: 0 !important;
}

@media only screen and (max-width: 600px) {
  .v-overlay__content:has(> .v-date-picker) {
    left: 0 !important;
  }
}
</style>
