/**
 * plugins/vuetify.js
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import '@mdi/font/css/materialdesignicons.css'
import '@fortawesome/fontawesome-free/css/all.css'
import 'vuetify/styles'
import { VFileUpload } from 'vuetify/labs/VFileUpload'
import { VDateInput } from 'vuetify/labs/VDateInput'
// Composables
import { createVuetify } from 'vuetify'

// Icon sets
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import { fa } from 'vuetify/iconsets/fa'

const light = {
  dark: false,
  colors: {
    background: '#faf9f7',      // soft warm white, less sterile
    surface: '#ffffff',         // pure white for cards
    'surface-variant': '#f3f1ed', // warmer off-white for sections
    header: '#ffffff',

    primary: '#fd5549',       // warmer golden beige (more cathedral stone)
    'on-primary': '#eaeaea',  // deep charcoal for readability

    secondary: '#c8a979',     // muted cathedral red
    'on-secondary': '#ffffff',

    accent: '#2f4858',        // deep slate blue
    'on-accent': '#ffffff',

    tertiary: '#8c8577',      // warm stone grey
    'on-tertiary': '#ffffff',

    success: '#3a7d44',   // rich green, not too neon
    'on-success': '#ffffff',
    error: '#b23a48',     // muted crimson
    'on-error': '#ffffff',
    warning: '#d48a1f',   // warm amber
    'on-warning': '#2d2d2d',
    info: '#3a6ea5',      // classical deep blue
    'on-info': '#ffffff',

    'on-background': '#2d2d2d',       // deep charcoal (less harsh than black)
    'on-surface': '#2d2d2d',
    'on-surface-variant': '#6b6b6b',  // muted grey for secondary text

    outline: '#e2ddd5',         // soft parchment-like
    'outline-variant': '#bfb8aa', // muted stone beige
  },
}

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  components: {
    VFileUpload,
    VDateInput,
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
      fa,
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light,
    },
  },
})
