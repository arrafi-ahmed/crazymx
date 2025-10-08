import { countries } from '@/others/country-list'
import $axios from '@/plugins/axios'

export const appInfo = { name: 'Tucson Cathedral Concerts', version: 1 }
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
export const clientBaseUrl = import.meta.env.VITE_BASE_URL
export const stripePublic = import.meta.env.VITE_STRIPE_PUBLIC
export const isProd = import.meta.env.PROD

export function sendToWhatsapp (phone, message) {
  const encodedMessage = encodeURIComponent(message)
  const whatsappShareLink = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`
  window.open(whatsappShareLink, '_blank')
}

// Interpret 'YYYY-MM-DD' as a local date to avoid timezone shifts
function parseAsLocalDate (input) {
  if (!input) {
    return null
  }
  if (typeof input === 'string') {
    const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) {
      const y = Number(m[1])
      const mo = Number(m[2]) - 1
      const d = Number(m[3])
      return new Date(y, mo, d)
    }
  }
  return new Date(input)
}

export function formatDate (inputDate) {
  const date = parseAsLocalDate(inputDate)
  if (!(date instanceof Date) || isNaN(date)) {
    return ''
  }
  const day = `0${date.getDate()}`.slice(-2)
  const month = `0${date.getMonth() + 1}`.slice(-2)
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// get iso datetime offset with timezone
export function toLocalISOString (inputDate) {
  const date = new Date(inputDate)
  const tzoffset = date.getTimezoneOffset() * 60_000 // offset in milliseconds
  const localISOTime = new Date(date - tzoffset).toISOString().slice(0, -1)
  return localISOTime
}

export function formatDateTime (inputDateTime) {
  const date = parseAsLocalDate(inputDateTime)
  if (!(date instanceof Date) || isNaN(date)) {
    return ''
  }
  const formattedDate = formatDate(date)
  const hours = `0${date.getHours()}`.slice(-2)
  const minutes = `0${date.getMinutes()}`.slice(-2)
  return `${formattedDate} ${hours}:${minutes}`
}

export const getClientPublicImageUrl = imageName => (imageName ? `/img/${imageName}` : null)

export const getApiPublicImageUrl = (imageName, type) => `${apiBaseUrl}/${type}/${imageName}`

export function getUserImageUrl (imageName) {
  return imageName === 'null' || !imageName
    ? getClientPublicImageUrl('default-user.jpg')
    : getApiPublicImageUrl(imageName, 'user')
}

export function getClubImageUrl (imageName) {
  return imageName === 'null' || !imageName
    ? getClientPublicImageUrl('default-user.jpg')
    : getApiPublicImageUrl(imageName, 'club-logo')
}

export function getEventImageUrl (imageName, eventName = null) {
  if (imageName === 'null' || !imageName) {
    // Create a data URL for the default placeholder
    const svgData = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1976d2;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#42a5f5;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="overlay" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(0,0,0,0.2);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgba(0,0,0,0.05);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#grad)"/>
      <rect width="400" height="200" fill="url(#overlay)"/>

      <!-- Cool event icon -->
      <g transform="translate(200, 100)">
        <!-- Main circle -->
        <circle cx="0" cy="0" r="35" fill="white" opacity="0.95"/>

        <!-- Calendar base -->
        <rect x="-25" y="-20" width="50" height="40" rx="4" fill="#1976d2"/>
        <rect x="-22" y="-17" width="44" height="8" fill="#1565c0"/>

        <!-- Calendar header dots -->
        <circle cx="-15" cy="-13" r="1.5" fill="white"/>
        <circle cx="-5" cy="-13" r="1.5" fill="white"/>
        <circle cx="5" cy="-13" r="1.5" fill="white"/>
        <circle cx="15" cy="-13" r="1.5" fill="white"/>

        <!-- Calendar grid -->
        <rect x="-18" y="-8" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="-12" y="-8" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="-6" y="-8" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="0" y="-8" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="6" y="-8" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="12" y="-8" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="18" y="-8" width="3" height="3" rx="0.5" fill="#1976d2"/>

        <rect x="-18" y="-4" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="-12" y="-4" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="-6" y="-4" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="0" y="-4" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="6" y="-4" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="12" y="-4" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="18" y="-4" width="3" height="3" rx="0.5" fill="#1976d2"/>

        <rect x="-18" y="0" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="-12" y="0" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="-6" y="0" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="0" y="0" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="6" y="0" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="12" y="0" width="3" height="3" rx="0.5" fill="#1976d2"/>
        <rect x="18" y="0" width="3" height="3" rx="0.5" fill="#1976d2"/>

        <!-- Highlight current day -->
        <rect x="0" y="0" width="3" height="3" rx="0.5" fill="#ffeb3b"/>
      </g>
    </svg>`

    return `data:image/svg+xml;base64,${btoa(svgData)}`
  }
  return getApiPublicImageUrl(imageName, 'event-banner')
}

export const padStr = (str, num) => String(str).padStart(num, '0')

export function getToLink (item) {
  if (item.to.params) {
    const paramKey = Object.keys(item.to.params)[0]
    const paramVal = item.to.params[paramKey]
    return {
      name: item.to.name,
      params: { [paramKey]: paramVal },
    }
  }
  return item.to
}

export const checkinItems = [
  { title: 'Pending', value: false },
  { title: 'Checked-in', value: true },
]

export const extrasItems = [
  { title: '', value: null },
  { title: 'Not Redeemed', value: false },
  { title: 'Redeemed', value: true },
]

export function getQueryParam (param) {
  const queryParams = new URLSearchParams(window.location.search)
  return queryParams.get(param)
}

export function removeQueryParams (url, paramsToRemove) {
  const parsedUrl = new URL(url)

  // Create a URLSearchParams object from the URL's search parameters
  const searchParams = new URLSearchParams(parsedUrl.search)

  // Remove the specified query parameters
  for (const param of paramsToRemove) {
    searchParams.delete(param)
  }

  // Construct the new URL with the updated search parameters
  parsedUrl.search = searchParams.toString()

  // Return the updated URL as a string
  return parsedUrl.toString()
}

export function isValidEmail (email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidImage (file) {
  if (!file || typeof file !== 'object') {
    return false
  }
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
  return allowedTypes.includes(file.type)
}

export function generateQrData ({ registrationId, attendeeId, qrUuid }) {
  const qrData = {
    r: registrationId,
    a: attendeeId,
    q: qrUuid,
  }
  return JSON.stringify(qrData)
}

export function deepCopy (aObject) {
  // Prevent undefined objects
  if (!aObject) {
    return aObject
  }
  const bObject = Array.isArray(aObject) ? [] : {}
  let value
  for (const key in aObject) {
    // Prevent self-references to parent object
    if (Object.is(aObject[key], aObject)) {
      continue
    }
    value = aObject[key]
    bObject[key] = typeof value === 'object' ? deepCopy(value) : value
  }
  return bObject
}

export function deepMerge (target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {}
      }
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

export const isValidPass = [
  v => !!v || 'Password is required!',
  v => v.length >= 8 || 'Password must be 8 or more characters!',
  v => /\d/.test(v) || 'Password must include at least one number!',
]

export function showApiQueryMsg (color = 'blue') {
  if (localStorage.hasOwnProperty('apiQueryMsg')) {
    toast(localStorage.getItem('apiQueryMsg'), {
      cardProps: { color },
      action: {
        label: 'Close',
        buttonProps: {
          color: 'white',
        },
        onClick () {},
      },
    })
    localStorage.removeItem('apiQueryMsg')
  }
}

export const input_fields = [
  { id: 0, title: 'Short answer' },
  { id: 1, title: 'Paragraph' },
  { id: 2, title: 'Multiple choice' },
  { id: 3, title: 'Checkboxes' },
  { id: 4, title: 'Dropdown' },
]

export function getInputType (typeId) {
  return input_fields.find(item => item.id == typeId)
}

export function getCountryList (filterName) {
  if (filterName === 'all') {
    return countries
  }
  return countries.map(item => item[filterName])
}

export function getCurrencySymbol ({ code, type }) {
  const codeLower = code.toString().toLowerCase()
  const currencyMap = {
    usd: { icon: 'mdi-currency-usd', symbol: '$', value: 'usd' },
    gbp: { icon: 'mdi-currency-gbp', symbol: '£', value: 'gbp' },
    eur: { icon: 'mdi-currency-eur', symbol: '€', value: 'eur' },
    thb: { icon: 'mdi-currency-thb', symbol: '฿', value: 'thb' },
  }
  const currencyData = currencyMap[codeLower]
  if (!currencyData) {
    return null // Or undefined, or throw an error, depending on your desired behavior
  }
  if (type === undefined) {
    return currencyData
  }
  return currencyData[type]
}

export const defaultCurrency = getCurrencySymbol({ code: 'usd' })

/**
 * Format price for display - converts cents to currency units
 * @param {number} price - Price in cents
 * @param {string} currency - Currency code (USD, EUR, GBP, etc.)
 * @param {object} options - Formatting options
 * @returns {string} Formatted price string
 */
export function formatPrice (price, currency = 'USD', options = {}) {
  if (!price && price !== 0) {
    return ''
  }

  // Convert cents to currency units (prices are always stored in cents)
  const amount = price / 100

  const defaultOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }

  const formatOptions = { ...defaultOptions, ...options }

  return new Intl.NumberFormat('en-US', formatOptions).format(amount)
}

/**
 * Format price in compact form (e.g., $1.2k, $100, $1.50)
 * @param {number} price - Price in cents
 * @param {string} currency - Currency code
 * @returns {string} Compact formatted price string
 */
export function formatPriceCompact (price, currency = 'USD') {
  if (!price && price !== 0) {
    return ''
  }

  // Convert cents to currency units (prices are always stored in cents)
  const amount = price / 100
  const symbol = getCurrencySymbol({ code: currency, type: 'symbol' }) || '$'

  if (amount >= 1000) {
    return `${symbol}${(amount / 1000).toFixed(1)}k`
  } else if (amount >= 100) {
    return `${symbol}${Math.round(amount)}`
  } else {
    return `${symbol}${amount.toFixed(2)}`
  }
}

export function handleRedirect ({ param, hardRedirect = true }) {
  const paramValue = getQueryParam({ param })
  if (paramValue) {
    const newUrl = paramValue

    if (hardRedirect) {
      window.location.replace(newUrl)
    } else {
      window.history.replaceState({}, document.title, newUrl)
    } // Corrected: Use .replace() as a method
    return true // Indicates a redirect happened
  }
  return false
}

export function handleRemoveQueriesNRedirect ({
  params = [], // Array of param names to check/remove
  saveToLocalStorage = true,
  hardRedirect = true,
}) {
  let found = false
  const queryParamsToRemove = []

  for (const paramName of params) {
    const paramValue = getQueryParam({ param: paramName })

    if (paramValue) {
      found = true
      queryParamsToRemove.push(paramName)

      if (saveToLocalStorage) {
        localStorage.setItem(paramName, paramValue)
      }
    }
  }

  if (found) {
    const newUrl = removeQueryParams({ paramsToRemove: queryParamsToRemove })

    if (hardRedirect) {
      window.location.replace(newUrl)
    } else {
      window.history.replaceState({}, document.title, newUrl)
    }
    return true
  }
  return false
}

export const ifSudo = ({ role }) => role === 10
export const ifAdmin = ({ role }) => role === 20

export function generatePassword (length = 8) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/()-*&^%$#@!'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

// Generate a URL-friendly slug from a title
export function generateSlug (title) {
  if (!title) {
    return ''
  }

  return (
    title
      .toLowerCase()
      .trim()
      // Replace spaces and special characters with hyphens
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      // Remove multiple consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading and trailing hyphens
      .replace(/^-+|-+$/g, '')
  )
}

// Utility function to make API calls with suppressed toasts
export const apiCall = {
  // Regular API call (shows toasts)
  async get (url, config = {}) {
    return await $axios.get(url, config)
  },

  async post (url, data, config = {}) {
    return await $axios.post(url, data, config)
  },

  async put (url, data, config = {}) {
    return await $axios.put(url, data, config)
  },

  async delete (url, config = {}) {
    return await $axios.delete(url, config)
  },

  // API calls with suppressed toasts
  async getSilent (url, config = {}) {
    return await $axios.get(url, {
      ...config,
      headers: {
        ...config.headers,
        'X-Suppress-Toast': 'true',
      },
    })
  },

  async postSilent (url, data, config = {}) {
    return await $axios.post(url, data, {
      ...config,
      headers: {
        ...config.headers,
        'X-Suppress-Toast': 'true',
      },
    })
  },

  async putSilent (url, data, config = {}) {
    return await $axios.put(url, data, {
      ...config,
      headers: {
        ...config.headers,
        'X-Suppress-Toast': 'true',
      },
    })
  },

  async deleteSilent (url, config = {}) {
    return await $axios.delete(url, {
      ...config,
      headers: {
        ...config.headers,
        'X-Suppress-Toast': 'true',
      },
    })
  },
}
