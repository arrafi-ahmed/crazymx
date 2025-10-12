import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  events: [],
  event: {},
  extras: [],
}

export const mutations = {
  setEvents (state, payload) {
    state.events = payload
  },
  setEvent (state, payload) {
    state.event = payload
  },
  saveEvent (state, payload) {
    const foundIndex = state.events.findIndex(item => item.id == payload.id)
    if (foundIndex === -1) {
      state.events.unshift(payload)
    } else {
      state.events[foundIndex] = payload
    }
  },
  saveExtras (state, payload) {
    const foundIndex = state.extras.findIndex(item => item.id == payload.id)
    if (foundIndex === -1) {
      state.extras.unshift(payload)
    } else {
      state.extras[foundIndex] = payload
    }
  },
  removeEvent (state, payload) {
    const foundIndex = state.events.findIndex(item => item.id == payload.eventId)
    if (foundIndex !== -1) {
      state.events.splice(foundIndex, 1)
    }
  },
  removeExtras (state, payload) {
    const foundIndex = state.extras.findIndex(item => item.id == payload.extrasId)
    if (foundIndex !== -1) {
      state.extras.splice(foundIndex, 1)
    }
  },
  setExtras (state, payload) {
    state.extras = payload
  },
  clearEvent (state) {
    state.event = {}
  },
  clearEvents (state) {
    state.events = []
  },
}

export const actions = {
  setEvents ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getAllEvents', { params: { clubId: request } })
        .then(response => {
          commit('setEvents', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setActiveEvents ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getAllActiveEvents', {
          params: {
            clubId: request.clubId,
            currentDate: request.currentDate,
          },
        })
        .then(response => {
          commit('setEvents', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setEvent ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getEvent', {
          params: { eventId: request.eventId },
        })
        .then(response => {
          commit('setEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setEventBySlug ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getEventBySlug', {
          params: { slug: request.slug },
        })
        .then(response => {
          commit('setEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  getFirstEvent ({ commit }) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getFirstEvent')
        .then(response => {
          commit('setEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setEventByEventIdnClubId ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getEventByEventIdnClubId', {
          params: { eventId: request.eventId, clubId: request.clubId },
        })
        .then(response => {
          commit('setEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  save ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/event/save', request)
        .then(response => {
          commit('saveEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  saveConfig ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/event/saveConfig', request)
        .then(response => {
          commit('saveEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  saveLandingConfig ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/event/saveLandingConfig', request)
        .then(response => {
          commit('saveEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  removeEvent ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/removeEvent', {
          params: request,
        })
        .then(response => {
          commit('removeEvent', request)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  removeExtras ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/removeExtras', {
          params: { extrasId: request.extrasId, eventId: request.eventId },
        })
        .then(response => {
          commit('removeExtras', request)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  saveExtras ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/event/saveExtras', request)
        .then(response => {
          commit('saveExtras', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setExtras ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getExtras', { params: { eventId: request } })
        .then(response => {
          commit('setExtras', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {
  getEventById: state => id => {
    return state.events.find(item => item.id == id)
  },
  isEventFree: () => {},
}
