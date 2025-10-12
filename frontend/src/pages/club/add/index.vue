<script setup>
  import { reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { isValidImage } from '@/utils'

  definePage({
    name: 'club-add',
    meta: {
      layout: 'default',
      title: 'Add Club',
      requiresSudo: true,
      requiresAuth: true,
    },
  })

  const { mobile } = useDisplay()
  const router = useRouter()
  const store = useStore()

  const newClubInit = {
    name: null,
    location: null,
    logo: null,
  }
  const newClub = reactive({ ...newClubInit })

  const form = ref(null)
  const isFormValid = ref(true)

  function handleClubLogo (file) {
    newClub.logo = file
  }

  async function handleAddClub () {
    await form.value.validate()
    if (!isFormValid.value) return

    const formData = new FormData()
    formData.append('name', newClub.name)
    formData.append('location', newClub.location)

    if (newClub.logo) formData.append('files', newClub.logo)

    await store.dispatch('club/save', formData).then(result => {
      // newClub = {...newClub, ...newClubInit}
      Object.assign(newClub, {
        ...newClubInit,
      })
      router.push({
        name: 'dashboard-sudo',
      })
    })
  }
</script>

<template>
  <v-container class="club-add-container">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <PageTitle
          subtitle="Create a new club and set up its details"
          title="Add Club"
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col>
        <v-form
          ref="form"
          v-model="isFormValid"
          fast-fail
          @submit.prevent="handleAddClub"
        >
          <v-text-field
            v-model="newClub.name"
            class="mt-2 mt-md-4"
            clearable
            density="compact"
            hide-details="auto"
            label="Name"
            prepend-inner-icon="mdi-account"
            required
            :rules="[(v) => !!v || 'Name is required!']"
            variant="solo"
          />

          <v-text-field
            v-model="newClub.location"
            class="mt-2 mt-md-4"
            clearable
            density="compact"
            hide-details="auto"
            label="Location (optional)"
            prepend-inner-icon="mdi-map-marker"
            variant="solo"
          />

          <v-file-upload
            accept="image/*"
            class="mt-2 mt-md-4"
            density="compact"
            hide-details="auto"
            label="Logo"
            prepend-icon=""
            prepend-inner-icon="mdi-camera"
            :rules="[
              (v) =>
                (Array.isArray(v) ? v : [v]).every((file) => isValidImage(file)) ||
                'Only jpg/jpeg/png allowed!',
            ]"
            show-size
            variant="outlined"
            @update:model-value="handleClubLogo"
          />

          <div class="d-flex align-center mt-3 mt-md-4">
            <v-spacer />
            <v-btn
              color="primary"
              :density="mobile ? 'comfortable' : 'default'"
              type="submit"
            >
              Add
            </v-btn>
          </div>
        </v-form>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.v-avatar {
  border-radius: 0;
}

.v-avatar.v-avatar--density-default {
  width: calc(var(--v-avatar-height) + 80px);
}
</style>
