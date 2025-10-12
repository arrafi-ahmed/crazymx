<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import { useDisplay } from 'vuetify'
  import { formatEventDateDisplay, getApiPublicImageUrl, getClientPublicImageUrl } from '@/utils'

  definePage({
    name: 'homepage',
    meta: {
      layout: 'default',
      title: 'Home',
    },
  })

  const router = useRouter()
  const store = useStore()

  // Reactive data
  const isLoading = ref(true)
  const upcomingEvents = ref([])

  // Computed properties
  const events = computed(() => store.state.event.events)
  const currentUser = computed(() => store.getters['auth/getCurrentUser'])

  // Format event data for display
  function formatEventData (events) {
    if (!events || !Array.isArray(events)) {
      return []
    }
    return events
      .map(event => ({
        id: event.id,
        title: event.name,
        date: formatEventDateDisplay({ event, eventConfig: event.config }),
        time: event.startTime || null, // Only show time if it's set in DB
        location: event.location,
        description: event.description === 'null' ? '' : event.description,
        banner: event.banner
          ? getApiPublicImageUrl(event.banner, 'event-banner')
          : getClientPublicImageUrl('default-event2.jpeg'),
        slug: event.slug,
        registrationCount: event.registrationCount,
        startDate: event.startDatetime || event.start_datetime || event.startDate,
        endDate: event.endDatetime || event.end_datetime || event.endDate,
        eventStatus: getEventStatus(event),
      }))
      .sort((a, b) => {
        // Sort chronologically by start datetime (earliest first)
        const dateA = new Date(a.startDate)
        const dateB = new Date(b.startDate)
        return dateA - dateB
      })
  }

  // Get event status based on date
  function getEventStatus (event) {
    if (!event.startDate) {
      // Show event type or other useful info when date is not available
      if (event.config?.isAllDay) {
        return 'All Day Event'
      } else if (event.config?.isSingleDayEvent) {
        return 'Single Day'
      } else {
        return 'Multi Day Event'
      }
    }

    const now = new Date()
    const eventDate = new Date(event.startDate)
    const diffTime = eventDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return 'Past Event'
    } else if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Tomorrow'
    } else if (diffDays <= 7) {
      return 'This Week'
    } else if (diffDays <= 14) {
      return 'Next Week'
    } else if (diffDays <= 30) {
      return 'This Month'
    } else {
      return 'Upcoming'
    }
  }

  // Get CSS class for badge based on status
  function getBadgeClass (status) {
    switch (status) {
      case 'Today': {
        return 'badge-today'
      }
      case 'Tomorrow': {
        return 'badge-tomorrow'
      }
      case 'This Week': {
        return 'badge-this-week'
      }
      case 'Next Week': {
        return 'badge-next-week'
      }
      case 'This Month': {
        return 'badge-this-month'
      }
      case 'Upcoming': {
        return 'badge-upcoming'
      }
      case 'Past Event': {
        return 'badge-past'
      }
      case 'All Day Event': {
        return 'badge-all-day'
      }
      case 'Single Day': {
        return 'badge-single-day'
      }
      case 'Multi Day Event': {
        return 'badge-multi-day'
      }
      default: {
        return 'badge-default'
      }
    }
  }

  // Fetch events
  async function fetchEvents () {
    try {
      isLoading.value = true

      // Get club ID from current user or use default
      const clubId = currentUser.value?.clubId || 1
      // Fetch events from store
      await store.dispatch('event/setEvents', clubId)

      // Format and set upcoming events
      upcomingEvents.value = formatEventData(events.value)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      isLoading.value = false
    }
  }

  function navigateToEvent (event) {
    if (event.slug) {
      router.push({ name: 'event-landing-slug', params: { slug: event.slug } })
    } else {
      router.push({ name: 'event-landing', params: { eventId: event.id } })
    }
  }

  onMounted(() => {
    fetchEvents()
  })
</script>

<template>
  <div class="homepage">
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-content">
        <h1 class="hero-title">
          Cathedral Concerts
        </h1>
        <p class="hero-subtitle">
          Music that inspires, unites, and transforms
        </p>
        <div class="hero-notice">
          <p class="text--secondary">
            Tickets are free, but reservations are required
          </p>
        </div>
      </div>
    </section>

    <!-- Upcoming Events Section -->
    <section class="events-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">
            Upcoming Events
          </h2>
          <p class="section-subtitle">
            Join us for these inspiring musical experiences
          </p>
        </div>

        <!-- Loading State -->
        <div
          v-if="isLoading"
          class="loading-container"
        >
          <v-progress-circular
            color="primary"
            indeterminate
            size="64"
          />
          <p class="loading-text">
            Loading events...
          </p>
        </div>

        <!-- Events Grid -->
        <v-row
          v-else
          justify="center"
        >
          <v-col
            v-for="event in upcomingEvents"
            :key="event.id"
            class="event-col"
            cols="12"
            md="4"
            sm="12"
          >
            <div
              class="event-card"
              @click="navigateToEvent(event)"
            >
              <div class="event-image">
                <img
                  :alt="event.title"
                  :src="event.banner"
                >
                <div
                  class="event-badge"
                  :class="getBadgeClass(event.eventStatus)"
                >
                  {{ event.eventStatus }}
                </div>
              </div>
              <div class="event-content">
                <h3 class="event-title">
                  {{ event.title }}
                </h3>
                <div class="event-meta">
                  <div class="event-date">
                    <v-icon
                      color="primary"
                      size="16"
                    >
                      mdi-calendar
                    </v-icon>
                    <span>{{ event.date }}</span>
                  </div>
                  <div
                    v-if="event.time"
                    class="event-time"
                  >
                    <v-icon
                      color="primary"
                      size="16"
                    >
                      mdi-clock
                    </v-icon>
                    <span>{{ event.time }}</span>
                  </div>
                  <div
                    v-if="event.location && event.location.trim()"
                    class="event-location"
                  >
                    <v-icon
                      color="primary"
                      size="16"
                    >
                      mdi-map-marker
                    </v-icon>
                    <span>{{ event.location }}</span>
                  </div>
                </div>
                <p class="event-description">
                  {{ event.description }}
                </p>
                <div class="event-actions">
                  <v-btn
                    class="event-btn"
                    color="secondary"
                    variant="flat"
                  >
                    Reserve Now
                  </v-btn>
                </div>
              </div>
            </div>
          </v-col>
        </v-row>

        <!-- No Events State -->
        <div
          v-if="!isLoading && upcomingEvents.length === 0"
          class="no-events"
        >
          <v-icon
            color="primary"
            size="64"
          >
            mdi-calendar-outline
          </v-icon>
          <h3>No upcoming events</h3>
          <p>Check back soon for new events and concerts.</p>
        </div>
      </div>
    </section>

    <!-- Sponsors Section -->
    <section class="sponsors-section">
      <div class="container">
        <div class="sponsors-content">
          <h2 class="sponsors-title">
            SPONSORS
          </h2>
          <p class="sponsors-subtitle">
            Supporting our musical mission
          </p>
          <div class="sponsors-grid">
            <div class="sponsor-item">
              <div class="sponsor-placeholder">
                <v-icon
                  color="primary"
                  size="48"
                >
                  mdi-heart
                </v-icon>
                <span>Community Sponsor</span>
              </div>
            </div>
            <div class="sponsor-item">
              <div class="sponsor-placeholder">
                <v-icon
                  color="primary"
                  size="48"
                >
                  mdi-music
                </v-icon>
                <span>Music Foundation</span>
              </div>
            </div>
            <div class="sponsor-item">
              <div class="sponsor-placeholder">
                <v-icon
                  color="primary"
                  size="48"
                >
                  mdi-church
                </v-icon>
                <span>Cathedral Support</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.homepage {
  min-height: 100vh;
  background: #fefefe;
}

/* Hero Section */
.hero {
  position: relative;
  height: 70vh;
  min-height: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: linear-gradient(135deg, rgba(212, 184, 150, 0.85) 0%, rgba(210, 180, 140, 0.75) 100%),
  url('/img/hero.webp') center/cover;
  color: #2c3e50;
}

.hero-content {
  max-width: 800px;
  padding: 0 24px;
  z-index: 2;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  line-height: 1.2;
  color: #2c3e50;
}

.hero-subtitle {
  font-size: 1.5rem;
  margin-bottom: 2rem;
  color: #2c3e50;
  opacity: 0.9;
  line-height: 1.4;
  font-weight: 400;
}

.hero-notice {
  background: rgba(253, 85, 73, 0.1);
  border: 2px solid #fd5549;
  border-radius: 12px;
  padding: 16px 24px;
  display: inline-block;
  margin-top: 2rem;
}

.notice-text {
  font-size: 1.1rem;
  font-weight: 600;
  color: #fd5549;
  margin: 0;
}

/* Events Section */
.events-section {
  padding: 80px 0;
  background: white;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.section-header {
  text-align: center;
  margin-bottom: 60px;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 16px;
}

.section-subtitle {
  font-size: 1.2rem;
  color: #7f8c8d;
  margin: 0;
}

.event-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  cursor: pointer;
  border: 1px solid #e9ecef;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.event-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.event-image {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.event-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.event-card:hover .event-image img {
  transform: scale(1.05);
}

.event-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  background: #fd5549;
  color: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

/* Badge color variations */
.badge-today {
  background: #ff4444;
  color: white;
}

.badge-tomorrow {
  background: #ff8800;
  color: white;
}

.badge-this-week {
  background: #ffaa00;
  color: white;
}

.badge-next-week {
  background: #88cc00;
  color: white;
}

.badge-this-month {
  background: #00aa88;
  color: white;
}

.badge-upcoming {
  background: #0088cc;
  color: white;
}

.badge-past {
  background: #666666;
  color: white;
}

.badge-all-day {
  background: #9c27b0;
  color: white;
}

.badge-single-day {
  background: #673ab7;
  color: white;
}

.badge-multi-day {
  background: #3f51b5;
  color: white;
}

.badge-default {
  background: #fd5549;
  color: white;
}

.event-content {
  padding: 24px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.event-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 16px;
  line-height: 1.3;
}

.event-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.event-date,
.event-time,
.event-location {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #7f8c8d;
}

.event-description {
  color: #6c757d;
  line-height: 1.6;
  margin-bottom: 20px;
  font-size: 0.95rem;
}

.event-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
}

.event-btn {
  text-transform: none;
  font-weight: 600;
  border-radius: 8px;
}

/* About Section */
.about-section {
  padding: 80px 0;
  background: #f8f7f5;
}

.about-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.about-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 24px;
}

.about-description {
  font-size: 1.1rem;
  color: #6c757d;
  line-height: 1.7;
  margin-bottom: 32px;
}

.about-features {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1rem;
  color: #2c3e50;
  font-weight: 500;
}

.about-image {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.about-image img {
  width: 100%;
  height: 400px;
  object-fit: cover;
}

/* Loading State */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  gap: 24px;
}

.loading-text {
  font-size: 1.1rem;
  color: #7f8c8d;
  margin: 0;
}

/* No Events State */
.no-events {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  text-align: center;
  gap: 16px;
}

.no-events h3 {
  font-size: 1.5rem;
  color: #2c3e50;
  margin: 0;
}

.no-events p {
  font-size: 1rem;
  color: #7f8c8d;
  margin: 0;
}

/* Sponsors Section */
.sponsors-section {
  padding: 80px 0;
  background: #f8f7f5;
}

.sponsors-content {
  text-align: center;
}

.sponsors-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 16px;
  letter-spacing: 2px;
}

.sponsors-subtitle {
  font-size: 1.2rem;
  color: #7f8c8d;
  margin-bottom: 60px;
}

.sponsors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 40px;
  max-width: 800px;
  margin: 0 auto;
}

.sponsor-item {
  display: flex;
  justify-content: center;
}

.sponsor-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 24px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  min-height: 140px;
  justify-content: center;
}

.sponsor-placeholder:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.sponsor-placeholder span {
  font-size: 0.9rem;
  color: #2c3e50;
  font-weight: 500;
  text-align: center;
}

/* Responsive Design */
@media (max-width: 768px) {
  .hero {
    height: 60vh;
    min-height: 500px;
  }

  .hero-title {
    font-size: 2.5rem;
  }

  .hero-subtitle {
    font-size: 1.2rem;
  }

  .section-title,
  .about-title,
  .sponsors-title {
    font-size: 2rem;
  }

  .events-grid {
    gap: 24px;
  }

  .about-content {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .sponsors-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

@media (max-width: 480px) {
  .hero {
    height: 50vh;
    min-height: 400px;
  }

  .hero-title {
    font-size: 2rem;
  }

  .hero-subtitle {
    font-size: 1.1rem;
  }

  .container {
    padding: 0 16px;
  }

  .events-section,
  .about-section,
  .sponsors-section {
    padding: 60px 0;
  }

  .sponsors-title {
    font-size: 1.75rem;
  }
}
</style>
