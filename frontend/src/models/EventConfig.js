export class EventConfig {
  constructor (data = {}) {
    this.isAllDay = data.isAllDay ?? false
    this.isSingleDayEvent = data.isSingleDayEvent ?? true
    this.maxTicketsPerRegistration = data.maxTicketsPerRegistration ?? 2
    this.saveAllAttendeesDetails = data.saveAllAttendeesDetails ?? false
    this.dateFormat = data.dateFormat ?? 'MM/DD/YYYY HH:mm'
    this.showEndTime = data.showEndTime ?? false
  }

  toJSON () {
    return {
      isAllDay: this.isAllDay,
      isSingleDayEvent: this.isSingleDayEvent,
      maxTicketsPerRegistration: this.maxTicketsPerRegistration,
      saveAllAttendeesDetails: this.saveAllAttendeesDetails,
      dateFormat: this.dateFormat,
      showEndTime: this.showEndTime,
    }
  }
}
