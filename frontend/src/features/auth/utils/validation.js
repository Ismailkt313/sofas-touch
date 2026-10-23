const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

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

export function validatePassword(password) {
  if (!password || password.length === 0) {
    return 'Please enter your password.'
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
