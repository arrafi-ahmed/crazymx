// Composables
import { createRouter, createWebHistory } from 'vue-router'
import store from '@/store'

const routes = [
  {
    path: '/',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '',
        name: 'landing',
        component: () => import('@/views/Homepage.vue'),
        meta: {
          title: 'Homepage',
        },
      },
      {
        path: 'register',
        name: 'register',
        component: () => import('@/views/Register.vue'),
        meta: {
          requiresNoAuth: true,
          title: 'Register',
        },
      },
      {
        path: 'signin',
        name: 'signin',
        component: () => import('@/views/Signin.vue'),
        meta: {
          requiresNoAuth: true,
          title: 'Signin',
        },
      },
      {
        path: 'signout',
        name: 'signout',
        component: () => import('@/views/Signout.vue'),
        meta: {
          requiresAuth: true,
          title: 'Signout',
        },
      },
      {
        path: 'dashboard/sudo',
        name: 'dashboard-sudo',
        component: () => import('@/views/DashboardSudo.vue'),
        meta: {
          requiresSudo: true,
          title: 'Dashboard Sudo',
        },
      },
      {
        path: 'dashboard/admin',
        name: 'dashboard-admin',
        component: () => import('@/views/DashboardAdmin.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Dashboard Admin',
        },
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        redirect: () =>
          store.getters['auth/isSudo']
            ? { name: 'dashboard-sudo' }
            : store.getters['auth/isAdmin']
              ? { name: 'dashboard-admin' }
              : { name: 'not-found' },
        meta: {
          requiresAuth: true,
        },
      },
      {
        path: 'club/add',
        name: 'club-add',
        component: () => import('@/views/ClubAdd.vue'),
        meta: {
          requiresSudo: true,
          title: 'Add Club',
        },
      },
      {
        path: 'club/edit/:clubId?',
        name: 'club-edit',
        component: () => import('@/views/ClubEdit.vue'),
        meta: {
          requiresAuth: true,
          title: 'Edit Club',
        },
      },
      {
        path: 'club/:clubId/credential',
        name: 'credential-generate',
        component: () => import('@/views/Credentials.vue'),
        meta: {
          requiresSudo: true,
          title: 'Credentials',
        },
      },
      {
        path: 'event/add',
        name: 'event-add',
        component: () => import('@/views/EventAdd.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Add Event',
        },
      },
      {
        path: 'event/edit/:eventId?',
        name: 'event-edit',
        component: () => import('@/views/EventEdit.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Edit Event',
        },
      },
      {
        path: 'event/:eventId/config',
        name: 'event-config',
        component: () => import('@/views/EventConfig.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Event Configuration',
        },
      },
      {
        path: 'event/:eventId/landing-config',
        name: 'event-landing-config',
        component: () => import('@/views/EventLandingConfig.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Landing Page Configuration',
        },
      },
      {
        path: 'event/:eventId/tickets',
        name: 'event-tickets',
        component: () => import('@/views/EventTickets.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Event Tickets',
        },
      },
      {
        path: 'event/:eventId/extras',
        name: 'event-extras',
        component: () => import('@/views/EventExtras.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Event Extras',
        },
      },
      {
        path: 'event/:eventId/sponsorships',
        name: 'event-sponsorships',
        component: () => import('@/views/EventSponsorships.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Event Sponsorships',
        },
      },
      {
        path: 'event/:eventId/sponsorship-packages',
        name: 'event-sponsorship-packages',
        component: () => import('@/views/EventSponsorshipPackages.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Event Sponsorship Packages',
        },
      },
      {
        path: 'event/:eventId/donation',
        name: 'event-donation',
        component: () => import('@/views/EventDonation.vue'),
        meta: {
          title: 'Support Event',
        },
      },
      {
        path: 'event/:eventId/attendees',
        name: 'event-attendees',
        component: () => import('@/views/EventAttendees.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Event Attendees',
        },
      },
      {
        path: 'event/:eventId/statistics',
        name: 'event-statistics',
        component: () => import('@/views/Statistics.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Event Statistics',
        },
      },
      {
        path: 'event/:eventId/checkin',
        name: 'event-checkin',
        component: () => import('@/views/Scanner.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Event Check-in',
        },
      },
      {
        path: 'event/:eventId/qr/:registrationId/:attendeeId/:qrUuid',
        name: 'qr-viewer',
        component: () => import('@/views/QrViewer.vue'),
        meta: {
          title: 'QR Code',
        },
      },
      {
        path: 'form-builder',
        name: 'form-builder',
        component: () => import('@/views/FormBuilder.vue'),
        meta: {
          requiresAdmin: true,
          title: 'Form Builder',
        },
      },
      {
        path: "event/:eventId/import",
        name: "import",
        component: () => import("@/views/Import.vue"),
        meta: {
          requiresAuth: true,
          title: "Import Attendees",
        },
      },
      {
        path: ':slug/tickets',
        name: 'tickets-slug',
        component: () => import('@/views/Tickets.vue'),
        meta: {
          title: 'Tickets',
        },
      },
      {
        path: ':slug/attendee-form',
        name: 'attendee-form-slug',
        component: () => import('@/views/TicketAttendeeForm.vue'),
        meta: {
          title: 'Attendee Information',
        },
      },
      {
        path: ':slug/checkout',
        name: 'checkout-slug',
        component: () => import('@/views/Checkout.vue'),
        meta: {
          title: 'Checkout',
        },
      },
      {
        path: ':slug/success',
        name: 'event-register-success-slug',
        component: () => import('@/views/EventRegisterSuccess.vue'),
        meta: {
          title: 'Registration Successful',
        },
      },
      {
        path: 'pricing',
        name: 'pricing',
        component: () => import('@/views/Pricing.vue'),
        meta: {
          title: 'Donation Page',
        },
      },
      {
        path: ':slug',
        name: 'event-landing-slug',
        component: () => import('@/views/EventLanding.vue'),
        meta: {
          title: 'Event Registration',
        },
      },
    ],
  },
  {
    path: '/',
    component: () => import('@/layouts/headerless/Headerless.vue'),
    children: [
      {
        path: 'club/:clubId/event',
        name: 'club-single',
        component: () => import('@/views/ClubSingle.vue'),
        meta: {
          title: 'Club',
        },
      },
    ],
  },
  {
    path: '/not-found/:status?/:message?',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
    props: (route) => ({
      status: route.params.status || 404,
      message: route.params.message || "Looks like you're lost!",
    }),
    meta: {},
  },
  {
    path: '/:catchAll(.*)',
    redirect: {
      name: 'not-found',
      params: { status: 404, message: "Looks like you're lost!" },
    },
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})

export default router
