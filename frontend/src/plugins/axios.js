import axios from 'axios'
import store from '@/store'
import { toast } from 'vue-sonner'
import router from '@/router'
import { HTTP_STATUS } from '@/others/constants'

const $axios = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

// List of public routes that don't require authentication
const publicRoutes = [
  '/event/getEventBySlug',
  '/event/getEvent',
  '/event/getAllEvents',
  '/club/getClub',
  '/registration/initRegistration',
  '/registration/save',
  '/registration/getRegistrationByEmail',
  '/stripe/create-payment-intent',
  '/stripe/confirm-payment',
  '/stripe/get-registration-from-payment',
  '/ticket/getTicketsByEventId',
  '/ticket/getTicketById',
  '/order/createOrder',
  '/extras/purchaseExtras',
  '/extras/getExtrasByEventId',
  '/extras/getExtrasByIds',
  '/sponsorship-package/getPackagesByEventId',
  '/info',
]

$axios.interceptors.request.use((config) => {
  store.commit('setProgress', true)

  // Check if this is a public route
  const isPublicRoute = publicRoutes.some((route) => config.url === route)

  // Only add Authorization header for non-public routes
  if (!isPublicRoute) {
    const token = store.getters['auth/getToken']
    if (token) {
      config.headers['Authorization'] = token
    }
  }

  return config
})

$axios.interceptors.response.use(
  (response) => {
    store.commit('setProgress', false)

    // Check if toast should be suppressed
    const suppressToast = response.config.headers['X-Suppress-Toast'] === 'true'

    let action = 'info'
    if (response.data?.msg && !suppressToast) {
      if (response.status >= 200 && response.status <= 299) {
        action = 'success'
      } else if (response.status >= 400 && response.status <= 499) {
        action = 'error'
      }
      toast[action](response.data.msg)
    }
    return response
  },
  (err) => {
    store.commit('setProgress', false)

    // Check if toast should be suppressed
    const suppressToast = err.config?.headers['X-Suppress-Toast'] === 'true'

    // Handle token expiry specifically (440 status code)
    if (err.response?.status === HTTP_STATUS.TOKEN_EXPIRED) {
      // Show the error message
      if (err.response?.data?.msg && !suppressToast) {
        toast.error(err.response?.data?.msg)
      }
      
      // Auto-logout the user and redirect
      store.dispatch('auth/signout').then(() => {
        // Redirect to signin page using Vue Router
        if (router.currentRoute.value.name !== 'signin') {
          router.push({ name: 'signin' })
        }
      })
      
      // Don't reject the promise for token expiry to prevent double redirects
      // The user is already being logged out and redirected
      return Promise.resolve()
    }

    // Handle other errors normally
    if (err.response?.data?.msg && !suppressToast) {
      toast.error(err.response?.data?.msg)
    }
    return Promise.reject(err)
  },
)

export default $axios
