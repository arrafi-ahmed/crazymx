<script setup>
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import Logo from '@/components/Logo.vue'
  import { getClientPublicImageUrl, getToLink } from '@/utils'

  const store = useStore()
  const router = useRouter()
  const route = useRoute()

  const signedin = computed(() => store.getters['auth/signedin'])
  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const calcHome = computed(() => store.getters['auth/calcHome'])

  const isRequiresNoAuth = computed(() =>
    store.state.routeInfo.to.matched.some(record => record.meta.requiresNoAuth),
  )

  const isSudo = computed(() => store.getters['auth/isSudo'])
  const isAdmin = computed(() => store.getters['auth/isAdmin'])

  const menuItemsSudo = [
    {
      title: 'Dashboard',
      to: { name: 'dashboard-sudo' },
      icon: 'mdi-view-dashboard',
    },
    {
      title: 'Add Club',
      to: { name: 'club-add' },
      icon: 'mdi-plus',
    },
  ]
  const menuItemsAdmin = [
    {
      title: 'Dashboard',
      to: { name: 'dashboard-admin' },
      icon: 'mdi-view-dashboard',
    },
    {
      title: 'Add Event',
      to: { name: 'event-add' },
      icon: 'mdi-plus',
    },
    {
      title: 'Edit Club',
      to: { name: 'club-edit' },
      icon: 'mdi-pencil',
    },
  ]

  const menuItems = computed(() => {
    let items = []
    if (isSudo.value) {
      items = items.concat(menuItemsSudo)
    } else if (isAdmin.value) {
      items = items.concat(menuItemsAdmin)
    // .concat({
    //   title: 'View Club',
    //   to: {name: 'club-single', params: {clubId: currentUser.value.clubId}},
    //   icon: 'mdi-eye',
    // })
    } else {
      // Add menu items for regular users
      items = items.concat([
        {
          title: 'Profile',
          to: { name: 'dashboard-admin' },
          icon: 'mdi-account',
        },
      // {
      //   title: 'View Club',
      //   to: {name: 'club-single', params: {clubId: currentUser.value.clubId}},
      //   icon: 'mdi-eye',
      // }
      ])
    }

    return items
  })

  const drawer = ref(false)
  const isScrolled = ref(false)

  function handleScroll () {
    isScrolled.value = window.scrollY > 50
  }

  onMounted(() => {
    window.addEventListener('scroll', handleScroll)
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
  })

  // Props for back button functionality
  const props = defineProps({
    showBackButton: {
      type: Boolean,
      default: false,
    },
    backButtonText: {
      type: String,
      default: 'Back',
    },
    backRoute: {
      type: [String, Object],
      default: null,
    },
  })

  // Determine if we should show back button based on route
  const shouldShowBackButton = computed(() => {
    // Show back button for purchase flow pages
    const purchaseFlowRoutes = [
      'tickets',
      'tickets-slug',
      'checkout',
      'checkout-slug',
      'attendee-form',
      'attendee-form-slug',
      'event-register-success',
      'event-register-success-slug',
      'success',
    ]
    return props.showBackButton || purchaseFlowRoutes.includes(route.name)
  })

  // Get back button text based on route
  const getBackButtonText = computed(() => {
    if (props.backButtonText) return props.backButtonText

    // Default back button text based on route
    switch (route.name) {
      case 'tickets':
      case 'tickets-slug': {
        return 'Back to Landing'
      }
      case 'checkout':
      case 'checkout-slug': {
        return 'Back to Tickets'
      }
      case 'attendee-form':
      case 'attendee-form-slug': {
        return 'Back to Tickets'
      }
      case 'event-register-success':
      case 'event-register-success-slug':
      case 'success': {
        return 'Back to Event'
      }
      default: {
        return 'Back'
      }
    }
  })

  function handleLogoClick () {
    router.push({ name: 'homepage' })
  }

  const getFirstName = computed(() => (currentUser.value?.fullName || '').split(' ')[0] || '')
  const getGreetings = computed(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  })

  function goBack () {
    if (props.backRoute) {
      if (typeof props.backRoute === 'string') {
        router.push(props.backRoute)
      } else {
        router.push(props.backRoute)
      }
    } else {
      // Route-based navigation for purchase flow
      switch (route.name) {
        case 'tickets-slug': {
          router.push({ name: 'event-landing-slug', params: { slug: route.params.slug } })
          break
        }
        case 'checkout-slug': {
          router.push({ name: 'tickets-slug', params: { slug: route.params.slug } })
          break
        }
        case 'attendee-form-slug': {
          router.push({ name: 'tickets-slug', params: { slug: route.params.slug } })
          break
        }
        case 'event-register-success-slug': {
          router.push({ name: 'event-landing-slug', params: { slug: route.params.slug } })
          break
        }
        case 'success': {
          router.push({ name: 'landing' })
          break
        }
        default: {
          router.back()
        }
      }
    }
  }
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <v-app-bar
          class="px-4 px-md-8 pt-2"
          color="transparent"
          density="comfortable"
          flat
          height="140"
          :order="1"
          :style="isScrolled ? {
            backdropFilter: 'saturate(180%) blur(14px)',
            WebkitBackdropFilter: 'saturate(180%) blur(14px)',
            backgroundColor: 'rgba(255,255,255,0.35)'
          } : {}"
        >
          <div
            class="d-flex align-center justify-center w-100"
            :style="{
              transform: isScrolled ? 'scale(0.78)' : 'scale(1)',
              transformOrigin: 'top center',
              transition: 'transform .22s ease'
            }"
          >
            <Logo
              :container-class="`rounded-lg pa-2 ${isScrolled ? 'bg-transparent' : 'bg-gradient'}`"
              :img-src="getClientPublicImageUrl('logo.webp')"
              :style="{ opacity: 1, cursor: 'pointer' }"
              :width="180"
              @click="handleLogoClick"
            />
          </div>

          <template #append>
            <v-btn
              v-if="signedin"
              icon="mdi-menu"
              rounded="xl"
              :size="isScrolled ? 'default' : 'large'"
              variant="outlined"
              @click="drawer = !drawer"
            />
          </template>
        </v-app-bar>
      </v-col>
    </v-row>
  </v-container>

  <!-- Navigation Drawer -->
  <v-navigation-drawer
    v-if="signedin"
    v-model="drawer"
    location="end"
    temporary
    :width="250"
  >
    <v-list nav>
      <v-list-item class="bg-gradient text-white py-4 rounded-lg">
        <div class="d-flex justify-start align-center">
          <v-avatar :size="40">
            <v-icon>mdi-account</v-icon>
          </v-avatar>
          <div class="ml-3">
            <small>{{ getGreetings }}</small>
            <div>{{ getFirstName }}</div>
          </div>
        </div>
      </v-list-item>
      <v-divider class="mt-2 mb-2" />
      <v-list-item
        v-for="(item, index) in menuItems"
        :key="index"
        :prepend-icon="item.icon"
        rounded
        :to="getToLink(item)"
      >
        <v-list-item-title>{{ item.title }}</v-list-item-title>
      </v-list-item>
    </v-list>
    <template #append>
      <div class="ma-5">
        <v-btn
          block
          color="primary"
          prepend-icon="mdi-exit-to-app"
          rounded="xl"
          :to="{ name: 'signout' }"
        >Signout
        </v-btn>
      </div>
    </template>
  </v-navigation-drawer>
</template>
<style>

</style>
