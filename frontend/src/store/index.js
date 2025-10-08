import { createStore } from 'vuex'
import * as appUser from './modules/appUser'
import * as auth from './modules/auth'
import * as checkin from './modules/checkin'
import * as club from './modules/club'
import * as event from './modules/event'
import * as extras from './modules/extras'
import * as form from './modules/form'
import * as order from './modules/order'
import * as registration from './modules/registration'
import * as sponsorship from './modules/sponsorship'
import * as sponsorshipPackage from './modules/sponsorshipPackage'
import * as ticket from './modules/ticket'

const store = createStore({
  modules: {
    appUser,
    auth,
    club,
    event,
    registration,
    checkin,
    form,
    ticket,
    order,
    sponsorship,
    sponsorshipPackage,
    extras,
  },
  state: () => ({
    progress: null,
    routeInfo: {},
    snackbars: [],
  }),
  mutations: {
    setProgress (state, payload) {
      state.progress = payload
    },
    setRouteInfo (state, payload) {
      state.routeInfo = payload
    },
    addSnackbar (state, payload) {
      // payload: { text, color, timeout }
      const item = {
        text: payload?.text || '',
        color: payload?.color || 'info',
        timeout: Number.isFinite(payload?.timeout) ? payload.timeout : 4000,
      }
      state.snackbars = [...state.snackbars, item]
    },
    setSnackbars (state, payload) {
      // payload is full list used by v-snackbar-queue two-way binding
      state.snackbars = Array.isArray(payload) ? payload : []
    },
  },
  actions: {},
})

export default store
