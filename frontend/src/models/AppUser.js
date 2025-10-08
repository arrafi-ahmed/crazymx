/**
 * AppUser model class
 */
export class AppUser {
  constructor (data = {}) {
    this.id = data.id || null
    this.fullName = data.fullName || ''
    this.email = data.email || ''
    this.password = data.password || ''
    this.role = data.role || null
    this.clubId = data.clubId || null
    this.createdAt = data.createdAt || null
  }

  /**
   * Role constants
   */
  static get ROLES () {
    return {
      SUDO: 10,
      ADMIN: 20,
    }
  }

  /**
   * Check if user is sudo (super admin)
   */
  isSudo () {
    return this.role === AppUser.ROLES.SUDO
  }

  /**
   * Check if user is admin
   */
  isAdmin () {
    return this.role === AppUser.ROLES.ADMIN
  }

  /**
   * Get role name as string
   */
  getRoleName () {
    switch (this.role) {
      case AppUser.ROLES.SUDO: {
        return 'Super Admin'
      }
      case AppUser.ROLES.ADMIN: {
        return 'Admin'
      }
      default: {
        return 'Unknown'
      }
    }
  }

  /**
   * Check if user has admin privileges
   */
  hasAdminPrivileges () {
    return this.isSudo() || this.isAdmin()
  }

  /**
   * Validates the user data
   */
  validate () {
    const errors = []

    if (!this.email || this.email.trim().length === 0) {
      errors.push('Email is required')
    }

    if (this.email && !this.isValidEmail(this.email)) {
      errors.push('Invalid email format')
    }

    if (this.email && this.email.length > 255) {
      errors.push('Email must be 255 characters or less')
    }

    if (this.fullName && this.fullName.length > 255) {
      errors.push('Full name must be 255 characters or less')
    }

    if (this.password && this.password.length > 255) {
      errors.push('Password must be 255 characters or less')
    }

    if (this.role && ![AppUser.ROLES.SUDO, AppUser.ROLES.ADMIN].includes(this.role)) {
      errors.push('Invalid role')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Simple email validation
   */
  isValidEmail (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Returns a plain object (for API requests/responses)
   */
  toJSON () {
    return {
      id: this.id,
      fullName: this.fullName,
      email: this.email,
      role: this.role,
      clubId: this.clubId,
      createdAt: this.createdAt,
    }
  }
}
