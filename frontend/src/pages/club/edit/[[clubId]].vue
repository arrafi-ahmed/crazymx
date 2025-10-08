<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import ImageManager from '@/components/ImageManager.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { getClubImageUrl, isValidImage } from '@/others/util'

  definePage({
    name: 'club-edit',
    meta: {
      layout: 'default',
      title: 'Edit Club',
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const route = useRoute()
  const router = useRouter()
  const store = useStore()

  const currentUser = computed(() => store.state.auth.currentUser)
  const targetClubId = computed(() =>
    store.getters['auth/isSudo']
      ? route.params.clubId
      : (store.getters['auth/isAdmin']
        ? currentUser.value.clubId
        : null),
  )
  const prefetchedClub = computed(() => store.getters['club/getClubById'](targetClubId.value))
  const club = computed(() =>
    prefetchedClub.value?.id ? prefetchedClub.value : store.state.club.club,
  )

  const newClubInit = {
    id: null,
    name: null,
    location: null,
    logo: null,
    rmImage: null,
  }
  const newClub = reactive({ ...newClubInit })

  const form = ref(null)
  const isFormValid = ref(true)

  function handleLogoUpdate (file) {
    newClub.logo = file
    if (club.value.logo) newClub.rmImage = club.value.logo
  }

  function handleLogoDelete () {
    newClub.logo = null
    newClub.rmImage = club.value.logo
  }

  const redirectDestination = computed(() =>
    store.getters['auth/isSudo']
      ? 'dashboard-sudo'
      : (store.getters['auth/isAdmin']
        ? 'dashboard-admin'
        : null),
  )

  async function handleEditClub () {
    await form.value.validate()
    if (!isFormValid.value) return

    const formData = new FormData()
    formData.append('id', newClub.id)
    formData.append('name', newClub.name)
    formData.append('location', newClub.location ?? '')

    if (newClub.logo) formData.append('files', newClub.logo)
    if (newClub.rmImage) formData.append('rmImage', newClub.rmImage)

    await store.dispatch('club/save', formData).then(result => {
      // newClub = {...newClub, ...newClubInit}
      Object.assign(newClub, {
        ...newClubInit,
      })
      router.push({
        name: redirectDestination.value,
      })
    })
  }
  async function fetchData () {
    if (!club.value?.id) {
      await store.dispatch('club/setClub', targetClubId.value)
    }
  }
  onMounted(async () => {
    await fetchData()
    Object.assign(newClub, {
      ...club.value,
    })
  })
</script>

<template>
  <v-container class="club-edit-container">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <PageTitle
          subtitle="Update your club details and configuration"
          title="Edit Club"
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col
        cols="12"
        lg="8"
        xl="6"
      >
        <v-card
          class="form-card"
          elevation="4"
        >
          <v-card-text class="pa-6">
            <v-form
              ref="form"
              v-model="isFormValid"
              fast-fail
              @submit.prevent="handleEditClub"
            >
              <v-text-field
                v-model="newClub.name"
                class="mb-4"
                clearable
                density="comfortable"
                hide-details="auto"
                label="Club Name"
                prepend-inner-icon="mdi-account"
                required
                :rules="[(v) => !!v || 'Name is required!']"
                variant="solo"
              />

              <v-text-field
                v-model="newClub.location"
                class="mb-4"
                clearable
                density="comfortable"
                hide-details="auto"
                label="Location"
                prepend-inner-icon="mdi-map-marker"
                required
                variant="solo"
              />

              <!-- Current Image Preview -->
              <ImageManager
                v-if="club.logo && club.logo !== 'null' && club.logo.trim() !== ''"
                :src="getClubImageUrl(club.logo)"
                @delete="handleLogoDelete"
              />

              <!-- Upload Component -->
              <v-file-upload
                accept="image/*"
                class="mb-4"
                clearable
                density="compact"
                rounded
                :rules="[
                  (v) =>
                    !v ||
                    (Array.isArray(v) ? v : [v]).every((file) => isValidImage(file)) ||
                    'Only jpg/jpeg/png allowed!',
                ]"
                show-size
                title="Update Logo"
                variant="solo"
                @update:model-value="handleLogoUpdate"
              />

              <div class="d-flex align-center mt-3 mt-md-4">
                <v-spacer />
                <v-btn
                  color="primary"
                  :size="xs ? 'default' : 'large'"
                  type="submit"
                  rounded="xl"
                >
                  Save
                </v-btn>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
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
