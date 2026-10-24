const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_ALLOWED_PATTERN = /^[+]?[\d\s()-]+$/

export function validateFullName(fullName) {
  const trimmed = (fullName || '').trim()

  if (!trimmed) {
    return 'Please enter your full name.'
  }

  if (trimmed.length < 2) {
    return 'Full name must be at least 2 characters.'
  }

  if (trimmed.length > 100) {
    return 'Full name must be 100 characters or fewer.'
  }

  return ''
}

export function validateEmail(email) {
  const trimmed = (email || '').trim()

  if (!trimmed) {
    return 'Please enter your email address.'
  }

  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'Please enter a valid email address.'
  }

  return ''
}

export function validatePhone(phone) {
  const trimmed = (phone || '').trim()

  if (!trimmed) {
    return 'Please enter your phone number.'
  }

  if (!PHONE_ALLOWED_PATTERN.test(trimmed)) {
    return 'Please enter a valid phone number.'
  }

  const digitsOnly = trimmed.replace(/\D/g, '')
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return 'Please enter a valid phone number (7–15 digits).'
  }

  return ''
}

export function validatePassword(password) {
  if (!password || password.length === 0) {
    return 'Please enter your password.'
  }

  return ''
}

export function validateSignupPassword(password) {
  if (!password || password.length === 0) {
    return 'Please create a password.'
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters long.'
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must include at least one letter and one number.'
  }

  return ''
}

export function validateConfirmPassword(confirmPassword, password) {
  if (!confirmPassword || confirmPassword.length === 0) {
    return 'Please confirm your password.'
  }

  if (confirmPassword !== password) {
    return 'Passwords do not match.'
  }

  return ''
}

export function validateLoginFields({ email, password }) {
  const errors = {}

  const emailError = validateEmail(email)
  if (emailError) {
    errors.email = emailError
  }

  const passwordError = validatePassword(password)
  if (passwordError) {
    errors.password = passwordError
  }

  return errors
}

export function validateSignupFields({
  fullName,
  email,
  phone,
  password,
  confirmPassword,
}) {
  const errors = {}

  const fullNameError = validateFullName(fullName)
  if (fullNameError) {
    errors.fullName = fullNameError
  }

  const emailError = validateEmail(email)
  if (emailError) {
    errors.email = emailError
  }

  const phoneError = validatePhone(phone)
  if (phoneError) {
    errors.phone = phoneError
  }

  const passwordError = validateSignupPassword(password)
  if (passwordError) {
    errors.password = passwordError
  }

  const confirmPasswordError = validateConfirmPassword(
    confirmPassword,
    password,
  )
  if (confirmPasswordError) {
    errors.confirmPassword = confirmPasswordError
  }

  return errors
}
