<script setup>
  import { computed, onMounted, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { getClubImageUrl } from '@/utils'

  definePage({
    name: 'dashboard-sudo',
    meta: {
      layout: 'default',
      title: 'Dashboard Sudo',
      requiresSudo: true,
      requiresAuth: true,
    },
  })

  const { mobile } = useDisplay()

  const route = useRoute()
  const router = useRouter()
  const store = useStore()

  const clubs = computed(() => store.state.club.clubs)

  const panel = ref(['clubList'])

  function handleClickCredential (club) {
    store.commit('appUser/setClub', club)
    router.push({
      name: 'credential-generate',
      params: {
        clubId: club.id,
      },
    })
  }

  function deleteClub (clubId) {
    store.dispatch('club/removeClub', { clubId })
  }

  function fetchData () {
    store.dispatch('club/setClubs')
  }

  onMounted(() => {
    fetchData()
  })
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <page-title
          justify="space-between"
          sub-title="Super Admin"
          title="Dashboard"
        >
          <v-row align="center">
            <v-divider
              class="mx-2"
              inset
              vertical
            />

            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  icon="mdi-dots-vertical"
                  v-bind="props"
                  variant="text"
                />
              </template>
              <v-list density="compact">
                <v-list-item
                  density="compact"
                  prepend-icon="mdi-plus"
                  title="Add Club"
                  :to="{
                    name: 'club-add',
                  }"
                />
              </v-list>
            </v-menu>
          </v-row>
        </page-title>
      </v-col>
    </v-row>

    <v-row justify="center">
      <v-col>
        <v-expansion-panels
          v-model="panel"
          multiple
        >
          <v-expansion-panel value="clubList">
            <v-expansion-panel-title>
              <v-icon size="x-large">
                mdi-list-box
              </v-icon>
              <span class="text-body-1 pl-2">All Clubs</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-list
                v-if="clubs.length > 0"
                density="default"
                lines="two"
              >
                <template v-for="(item, index) in clubs">
                  <v-list-item
                    v-if="item"
                    :key="index"
                    :title="item?.name"
                    @click="
                      router.push({
                        name: 'club-single',
                        params: {
                          clubId: item.id,
                        },
                      })
                    "
                  >
                    <template #prepend>
                      <v-avatar
                        :image="getClubImageUrl(item.logo)"
                        rounded="sm"
                        :size="80"
                      />
                    </template>

                    <template #append>
                      <v-menu>
                        <template #activator="{ props }">
                          <v-btn
                            class="ml-5"
                            icon="mdi-dots-vertical"
                            v-bind="props"
                            variant="text"
                          />
                        </template>
                        <v-list density="compact">
                          <v-list-item
                            density="compact"
                            prepend-icon="mdi-eye"
                            title="View Club"
                            @click="
                              router.push({
                                name: 'club-single',
                                params: {
                                  clubId: item.id,
                                },
                              })
                            "
                          />

                          <v-list-item
                            density="compact"
                            prepend-icon="mdi-lock"
                            title="Credentials"
                            @click="handleClickCredential(item)"
                          />

                          <v-list-item
                            prepend-icon="mdi-pencil"
                            title="Edit"
                            @click="
                              router.push({
                                name: 'club-edit',
                                params: { clubId: item.id },
                              })
                            "
                          />

                          <v-divider />

                          <confirmation-dialog @confirm="deleteClub(item.id)">
                            <template #activator="{ onClick }">
                              <v-list-item
                                class="text-error"
                                prepend-icon="mdi-delete"
                                title="Delete"
                                @click.stop="onClick"
                              />
                            </template>
                          </confirmation-dialog>
                        </v-list>
                      </v-menu>
                    </template>

                    <template #subtitle>
                      <div class="text-truncate">
                        {{ item?.description }}
                      </div>
                    </template>
                  </v-list-item>
                  <v-divider v-if="index !== clubs.length - 1" />
                </template>
              </v-list>
              <v-alert
                v-else
                border="start"
                closable
                density="compact"
              >
                No clubs found!
              </v-alert>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped></style>
