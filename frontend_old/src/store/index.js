import { createStore } from 'vuex'
import * as appUser from './modules/appUser'
import * as auth from './modules/auth'
import * as club from './modules/club'
import * as event from './modules/event'
import * as registration from './modules/registration'
import * as checkin from './modules/checkin'
import * as form from './modules/form'
import * as ticket from './modules/ticket'
import * as order from './modules/order'
import * as sponsorship from './modules/sponsorship'
import * as sponsorshipPackage from './modules/sponsorshipPackage'
import * as extras from './modules/extras'

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
  }),
  mutations: {
    setProgress(state, payload) {
      state.progress = payload
    },
    setRouteInfo(state, payload) {
      state.routeInfo = payload
    },
  },
  actions: {},
})

export default store
