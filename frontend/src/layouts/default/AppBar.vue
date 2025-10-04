<script setup>
import Logo from '@/components/Logo.vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { getClientPublicImageUrl, getToLink } from '@/others/util'
import { useDisplay } from 'vuetify'

const store = useStore()
const router = useRouter()
const route = useRoute()
const { smAndUp } = useDisplay()

const signedin = computed(() => store.getters['auth/signedin'])
const currentUser = computed(() => store.getters['auth/getCurrentUser'])
const calcHome = computed(() => store.getters['auth/calcHome'])

const isRequiresNoAuth = computed(() =>
  store.state.routeInfo.to.matched.some((record) => record.meta.requiresNoAuth),
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

// Scroll detection
const handleScroll = () => {
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
    case 'tickets-slug':
      return 'Back to Landing'
    case 'checkout':
    case 'checkout-slug':
      return 'Back to Tickets'
    case 'attendee-form':
    case 'attendee-form-slug':
      return 'Back to Tickets'
    case 'event-register-success':
    case 'event-register-success-slug':
    case 'success':
      return 'Back to Event'
    default:
      return 'Back'
  }
})

const handleLogoClick = () => {
  router.push({ name: 'landing' })
}

const goBack = () => {
  if (props.backRoute) {
    if (typeof props.backRoute === 'string') {
      router.push(props.backRoute)
    } else {
      router.push(props.backRoute)
    }
  } else {
    // Route-based navigation for purchase flow
    switch (route.name) {
      case 'tickets-slug':
        router.push({ name: 'event-landing-slug', params: { slug: route.params.slug } })
        break
      case 'checkout-slug':
        router.push({ name: 'tickets-slug', params: { slug: route.params.slug } })
        break
      case 'attendee-form-slug':
        router.push({ name: 'tickets-slug', params: { slug: route.params.slug } })
        break
      case 'event-register-success-slug':
        router.push({ name: 'event-landing-slug', params: { slug: route.params.slug } })
        break
      case 'success':
        router.push({ name: 'landing' })
        break
      default:
        router.back()
    }
  }
}
</script>

<template>
  <v-app-bar
    :order="1"
    class="modern-app-bar bg-transparent"
    color="transparent"
    height="130"
    elevation="0"
  >
    <div class="app-bar-container bg-transparent justify-center">
      <!-- User Menu -->
      <v-btn
        v-if="signedin"
        size="large"
        icon="mdi-menu"
        style="z-index: 9999999 !important"
        color="white"
        class="bg-accent"
        @click="drawer = !drawer"
      />

      <!-- Logo Section -->
      <v-spacer />
      <div
        class="logo-container rounded-lg"
        :class="{'bg-accent': !isScrolled}"
        style="z-index: 1 !important"
        @click="handleLogoClick"
      >
        <!--          :title="appInfo.name"-->
        <Logo
          :img-src="getClientPublicImageUrl('logo.webp')"
          class="app-logo"
          :class="{ 'logo-compact': isScrolled }"
          width="180"
        />
      </div>
      <v-spacer />

      <!-- Back Button -->
      <v-btn
        v-if="shouldShowBackButton"
        class="back-button"
        size="large"
        variant="text"
        @click="goBack"
      >
        <v-icon
          class="mr-1"
          size="20"
        >
          mdi-arrow-left
        </v-icon>
        <span class="back-text">{{ getBackButtonText }}</span>
      </v-btn>
    </div>
  </v-app-bar>

  <!-- Navigation Drawer -->
  <v-navigation-drawer
    v-if="signedin"
    v-model="drawer"
    :width="280"
    class="modern-drawer"
    location="start"
    temporary
  >
    <div class="drawer-header">
      <div class="user-profile">
        <v-avatar
          class="profile-avatar"
          size="56"
        >
          <v-icon
            color="white"
            size="28"
          >
            mdi-account
          </v-icon>
        </v-avatar>
        <div class="user-info">
          <h3 class="user-full-name">
            {{ currentUser.fullName || 'User' }}
          </h3>
          <p class="user-role">
            {{ isSudo ? 'Super Admin' : isAdmin ? 'Admin' : 'User' }}
          </p>
        </div>
      </div>
    </div>

    <v-list
      class="drawer-menu"
      density="compact"
      nav
    >
      <v-list-item
        v-for="(item, index) in menuItems"
        :key="index"
        :to="getToLink(item)"
        class="menu-item"
        rounded="lg"
      >
        <template #prepend>
          <div class="menu-icon">
            <v-icon
              color="primary"
              size="20"
            >
              {{ item.icon }}
            </v-icon>
          </div>
        </template>
        <template #title>
          <span class="menu-title">{{ item.title }}</span>
        </template>
      </v-list-item>
    </v-list>

    <template #append>
      <div class="drawer-footer">
        <v-btn
          :to="{ name: 'signout' }"
          block
          class="logout-button"
          color="error"
          prepend-icon="mdi-logout"
          size="large"
          variant="outlined"
        >
          Sign Out
        </v-btn>
      </div>
    </template>
  </v-navigation-drawer>
</template>

<style scoped>
/* Modern App Bar */
.modern-app-bar {
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  z-index: var(--z-sticky);
}

.app-bar-container {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 100%;
}

/* Logo Section */
.logo-container {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.app-logo {
  height: auto;
}

/* Back Button */
.back-button {
  color: rgba(0, 0, 0, 0.9) !important;
  font-weight: 500 !important;
  text-transform: none !important;
  border-radius: 8px !important;
  padding: 8px 12px !important;
  transition: all 0.2s ease !important;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  color: rgb(144, 144, 144) !important;
}

.back-text {
  font-size: 14px;
}

/* User Menu Button */
.user-menu-button {
  color: rgba(255, 255, 255, 0.9) !important;
  background: #ffffff78;
  font-weight: 500 !important;
  text-transform: none !important;
  border-radius: 8px !important;
  padding: 8px 12px !important;
  transition: all 0.2s ease !important;
}

.user-menu-button:hover {
  background: rgba(245, 242, 242, 0.1) !important;
  color: rgb(110, 107, 107) !important;
}

.user-avatar {
  background: rgba(var(--v-theme-primary), 0.1) !important;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.7);
}

/* Navigation Drawer */
.modern-drawer {
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  z-index: var(--z-modal) !important;
}

.drawer-header {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  );
  padding: 32px 24px;
  color: white;
}

.v-toolbar--collapse {
  max-width: 260px;
}

.v-toolbar--collapse img{
  display: none;
  max-width: 0;
  max-height: 0;
}

/* Logo hide animation on scroll */
.logo-compact {
  opacity: 80;
  transform: scale(0.8);
  transition: all 0.3s ease;
  pointer-events: none;
  max-width: auto;
  height: 80px;
}

.logo-container {
  transition: all 0.3s ease;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-avatar {
  background: rgba(255, 255, 255, 0.2) !important;
  backdrop-filter: blur(10px);
}

.user-info {
  flex: 1;
}

.user-full-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: white;
}

.user-role {
  font-size: 14px;
  margin: 4px 0 0 0;
  color: rgba(255, 255, 255, 0.8);
}

/* Drawer Menu */
.drawer-menu {
  padding: 16px;
}

.menu-item {
  border-radius: 12px !important;
  margin-bottom: 4px !important;
  transition: all 0.2s ease !important;
}

.menu-item:hover {
  background: rgba(var(--v-theme-primary), 0.08) !important;
}

.menu-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.menu-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.8);
}

/* Drawer Footer */
.drawer-footer {
  padding: 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.logout-button {
  border-radius: 12px !important;
  text-transform: none !important;
  font-weight: 500 !important;
  font-size: 14px !important;
}

/* Responsive Design */
@media (max-width: 768px) {
  .app-bar-container {
    padding: 0 16px;
  }

  .app-logo {
    height: auto;
  }

  .user-name {
    display: none;
  }

  .back-text {
    display: none;
  }

  .back-button {
    padding: 8px !important;
  }

  .user-menu-button {
    padding: 8px !important;
  }
}

/* Smooth transitions */
* {
  transition: all 0.2s ease;
}
</style>
