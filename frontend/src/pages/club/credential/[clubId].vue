<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute } from 'vue-router'
  import { useStore } from 'vuex'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { generatePassword } from '@/utils'

  definePage({
    name: 'credential-generate',
    meta: {
      layout: 'default',
      title: 'Credentials',
      requiresSudo: true,
      requiresAuth: true,
    },
  })

  const store = useStore()
  const route = useRoute()

  const admins = computed(() => store.state.appUser.admins)
  const club = computed(() => store.getters['club/getClubById'](route.params.clubId))

  const accordion = ref(['admins'])
  const addAdminDialog = ref(false)
  const editDialog = ref(false)
  const isEditDialogAdmin = ref(false)

  const form = ref(null)
  const isFormValid = ref(true)

  const userInit = {
    id: null,
    email: null,
    password: null,
    role: null,
    clubId: null,
  }
  const user = reactive({ ...userInit })

  function openEditDialog (selectedUser, type) {
    if (type === 'admin') {
      isEditDialogAdmin.value = true
    }
    const { name, ...rest } = selectedUser
    Object.assign(user, { ...rest }) // avoid 'name', 'aId' from submitting backend
    editDialog.value = !editDialog.value
  }

  async function openAddAdminDialog () {
    Object.assign(user, { ...userInit })
    addAdminDialog.value = !addAdminDialog.value
  }

  async function handleSubmitCredential (type) {
    await form.value.validate()
    if (!isFormValid.value) return

    type = type.toLowerCase()
    user.clubId = route.params.clubId
    if (!user.id) {
      user.password = generatePassword()
    }

    await store.dispatch('appUser/saveAppUser', { ...user, type }).then(() => {
      if (type === 'admin' && user.id) {
        editDialog.value = !editDialog.value
      } else if (type === 'admin' && !user.id) {
        addAdminDialog.value = !addAdminDialog.value
      }
      Object.assign(user, { ...userInit })
    })
  }

  function deleteAppUser (id, type) {
    store.dispatch('appUser/deleteAppUser', id)
  }

  const showGeneratedPassword = ref(false)

  function handleGeneratePassword () {
    user.password = generatePassword()
    showGeneratedPassword.value = !showGeneratedPassword.value
  }

  onMounted(() => {
    store.dispatch('appUser/setAdmins', route.params.clubId)
  })
</script>

<template>
  <v-container class="credentials-container">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <PageTitle
          :subtitle="club?.name"
          title="Credentials"
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col>
        <v-expansion-panels v-model="accordion">
          <v-expansion-panel value="admins">
            <v-expansion-panel-title>
              <span>Admins</span>
              <v-spacer />
              <v-btn
                class="me-5"
                color="primary"
                @click.stop="openAddAdminDialog"
              >
                Generate Credential
              </v-btn>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-table
                v-if="admins?.length > 0"
                density="comfortable"
                hover
              >
                <thead>
                  <tr>
                    <th class="text-start">
                      Email
                    </th>
                    <th class="text-start">
                      Password
                    </th>
                    <th class="text-end" />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, index) in admins"
                    :key="'e-' + index"
                  >
                    <td>{{ item.email }}</td>
                    <td class="text-start">
                      *********
                    </td>
                    <td class="text-start">
                      <v-menu>
                        <template #activator="{ props }">
                          <v-btn
                            icon="mdi-dots-vertical"
                            size="small"
                            v-bind="props"
                            variant="text"
                          />
                        </template>
                        <v-list density="compact">
                          <v-list-item
                            density="compact"
                            link
                            prepend-icon="mdi-pencil"
                            title="Edit"
                            @click="openEditDialog(item, 'admin')"
                          />
                          <v-divider />
                          <confirmation-dialog @confirm="deleteAppUser(item.id)">
                            <template #activator="{ onClick }">
                              <v-list-item
                                class="text-error"
                                link
                                prepend-icon="mdi-delete"
                                title="Delete"
                                @click.stop="onClick"
                              />
                            </template>
                          </confirmation-dialog>
                        </v-list>
                      </v-menu>
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <v-alert
                v-else
                border="start"
                closable
                density="compact"
              >
                No Data available!
              </v-alert>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
  </v-container>

  <v-dialog
    v-model="addAdminDialog"
    width="500"
  >
    <v-card>
      <v-card-title>Generate Credential - Admin</v-card-title>
      <v-card-text>
        <v-form
          ref="form"
          v-model="isFormValid"
          fast-fail
        >
          <v-text-field
            v-model="user.email"
            class="mt-2"
            clearable
            density="compact"
            hide-details="auto"
            label="Email"
            :rules="[(v) => !!v || 'Email is required!']"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="primary"
          @click="handleSubmitCredential('admin')"
        >
          Generate
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="editDialog"
    width="500"
  >
    <v-card>
      <v-card-title>
        Edit Credential -
        {{ isEditDialogAdmin ? 'Admin' : null }}
      </v-card-title>
      <v-card-text>
        <v-form
          ref="form"
          v-model="isFormValid"
          fast-fail
        >
          <v-text-field
            v-model="user.email"
            class="mt-2"
            clearable
            density="compact"
            hide-details="auto"
            label="Email"
            :rules="[(v) => !!v || 'Email is required!']"
          />
          <v-text-field
            v-if="showGeneratedPassword"
            v-model="user.password"
            class="mt-2"
            clearable
            density="compact"
            hide-details="auto"
            label="Password"
            :rules="[(v) => !!v || 'Password is required!']"
          />
          <v-btn
            class="mt-2"
            color="primary"
            prepend-icon="mdi-recycle"
            size="small"
            variant="tonal"
            @click="handleGeneratePassword"
          >
            Generate New Password
          </v-btn>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="primary"
          @click="handleSubmitCredential(isEditDialogAdmin ? 'Admin' : null)"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped></style>
