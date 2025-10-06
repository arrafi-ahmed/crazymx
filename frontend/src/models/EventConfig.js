export class EventConfig {
  constructor(data = {}) {
    this.maxTicketsPerRegistration = data.maxTicketsPerRegistration ?? 10
    this.saveAllAttendeesDetails = data.saveAllAttendeesDetails ?? false
    this.isSingleDayEvent = data.isSingleDayEvent ?? false
  }

  toJSON() {
    return {
      maxTicketsPerRegistration: this.maxTicketsPerRegistration,
      saveAllAttendeesDetails: this.saveAllAttendeesDetails,
      isSingleDayEvent: this.isSingleDayEvent,
    }
  }
}


