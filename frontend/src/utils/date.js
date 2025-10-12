export function parseAsLocalDate ({ input, midday = false } = {}) {
  if (!input) {
    return null
  }

  if (typeof input === 'string') {
    // Handle pure date string "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const [y, m, d] = input.split('-').map(Number)
      return new Date(y, m - 1, d, midday ? 12 : 0)
    }
    // ISO string or timestamp
    return new Date(input)
  }

  // If already a Date object
  return new Date(input)
}

export function toUTCISOString ({ inputDate } = {}) {
  const date = new Date(inputDate)
  const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60_000)
  const result = utcDate.toISOString()
  return result
}

export function fromUTCToLocal ({ utcString } = {}) {
  return new Date(utcString)
}

export function splitDateTime ({ inputDate, isOutputUTC = false }) {
  if (!inputDate) {
    return { dateStr: '', timeStr: '' }
  }

  const date = new Date(inputDate)

  const year = isOutputUTC ? date.getUTCFullYear() : date.getFullYear()
  const month = (isOutputUTC ? date.getUTCMonth() : date.getMonth()) + 1
  const day = isOutputUTC ? date.getUTCDate() : date.getDate()
  const hours = isOutputUTC ? date.getUTCHours() : date.getHours()
  const minutes = isOutputUTC ? date.getUTCMinutes() : date.getMinutes()
  const seconds = isOutputUTC ? date.getUTCSeconds() : date.getSeconds()

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return { dateStr, timeStr }
}

export function mergeDateTime ({ dateStr, timeStr = '12:00', isOutputUTC = false } = {}) {
  if (!dateStr) {
    return null
  }

  // If dateStr is in YYYY-MM-DD, treat it as LOCAL date (not UTC)
  let d
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [Y, M, D] = dateStr.split('-').map(Number)
    d = new Date(Y, M - 1, D) // <-- Local date constructor
  } else {
    d = new Date(dateStr)
  }

  if (Number.isNaN(d)) {
    return null
  }

  const [H, M, S = 0] = timeStr.split(':').map(Number)
  d.setHours(H, M, S, 0)

  return isOutputUTC ? d.toISOString() : d
}

export function formatDate ({ input, format = 'MM/DD/YYYY', midday = false } = {}) {
  const date = parseAsLocalDate({ input, midday })
  if (!date || Number.isNaN(date)) {
    return ''
  }

  const pad = n => String(n).padStart(2, '0')
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const monthNamesShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  const map = {
    YYYY: date.getFullYear(),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    MMM: monthNamesShort[date.getMonth()],
    MMMM: monthNames[date.getMonth()],
  }

  return format.replace(/YYYY|MM|DD|HH|mm|ss|MMM|MMMM/g, t => map[t])
}

export function formatDateTime ({ input } = {}) {
  if (!input) {
    return 'N/A'
  }
  return new Date(input).toLocaleString()
}

export function formatEventDate ({ input, eventConfig = {}, midday = false } = {}) {
  const dateFormat = eventConfig?.dateFormat || 'MM/DD/YYYY HH:mm'
  return formatDate({ input, format: dateFormat, midday })
}

export function formatTimeRange ({ start, end, eventConfig = {} } = {}) {
  if (!start || !end) {
    return ''
  }

  const dateFormat = eventConfig?.dateFormat || 'MM/DD/YYYY HH:mm'
  // Extract time format from the date format
  const timeFormat = dateFormat.includes('HH:mm') ? 'HH:mm' : 'HH:mm'

  const startTime = formatDate({ input: start, format: timeFormat })
  const endTime = formatDate({ input: end, format: timeFormat })

  return `${startTime} - ${endTime}`
}

export function formatEventDateDisplay ({ event, eventConfig = {} } = {}) {
  if (!event) {
    return 'Date TBA'
  }

  const start = event.startDatetime || event.startDate || event.start_datetime
  const end = event.endDatetime || event.endDate || event.end_datetime
  const isAllDay = eventConfig?.isAllDay || event?.config?.isAllDay
  const isSingleDay = eventConfig?.isSingleDayEvent || event?.config?.isSingleDayEvent

  if (!start && !end) {
    return 'Date TBA'
  }

  // Special case: Single day event but NOT all-day (show date + time range)
  if (isSingleDay && !isAllDay && start && end) {
    const dateFormat = eventConfig?.dateFormat || event?.config?.dateFormat || 'MM/DD/YYYY HH:mm'
    // Remove time part from format for the date
    const dateOnlyFormat = dateFormat.replace(/ HH:mm|HH:mm/g, '')

    const formattedDate = formatDate({ input: start, format: dateOnlyFormat })
    const timeRange = formatTimeRange({ start, end, eventConfig })

    return `${formattedDate} ${timeRange}`
  }

  // If it's an all-day event, only show the date part
  if (isAllDay) {
    const dateFormat = eventConfig?.dateFormat || event?.config?.dateFormat || 'MM/DD/YYYY'
    // Remove time part from format for all-day events
    const dateOnlyFormat = dateFormat.replace(/ HH:mm|HH:mm/g, '')

    if (start && (!end || isSingleDay)) {
      return formatDate({ input: start, format: dateOnlyFormat })
    }

    if (start && end) {
      const sameDay = new Date(start).toDateString() === new Date(end).toDateString()
      if (sameDay || isSingleDay) {
        return formatDate({ input: start, format: dateOnlyFormat })
      }
      return `${formatDate({ input: start, format: dateOnlyFormat })} - ${formatDate({
        input: end,
        format: dateOnlyFormat,
      })}`
    }

    return formatDate({ input: start, format: dateOnlyFormat })
  }

  // For timed events, show the full format
  if (start && (!end || isSingleDay)) {
    return formatEventDate({ input: start, eventConfig })
  }

  if (start && end) {
    const sameDay = new Date(start).toDateString() === new Date(end).toDateString()
    if (sameDay || isSingleDay) {
      return formatEventDate({ input: start, eventConfig })
    }
    return `${formatEventDate({ input: start, eventConfig })} - ${formatEventDate({ input: end, eventConfig })}`
  }

  return formatEventDate({ input: start, eventConfig })
}
