import { useRef, useState } from 'react'
import { getRememberedEmail, loginAdmin } from '../services/authService'
import {
  validateEmail,
  validateLoginFields,
  validatePassword,
} from '../utils/validation'

export function useLoginForm({ onLoginSuccess } = {}) {
  const [values, setValues] = useState(() => {
    const savedEmail = getRememberedEmail()
    return {
      email: savedEmail,
      password: '',
      rememberMe: Boolean(savedEmail),
    }
  })

  const [fieldErrors, setFieldErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)

  const validateSingleField = (name, value) => {
    if (name === 'email') {
      return validateEmail(value)
    }
    if (name === 'password') {
      return validatePassword(value)
    }
    return ''
  }

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    const nextValue = type === 'checkbox' ? checked : value

    setValues((prev) => ({
      ...prev,
      [name]: nextValue,
    }))

    if (authError && name !== 'rememberMe') {
      setAuthError('')
    }

    if (touched[name] || fieldErrors[name]) {
      const nextError = validateSingleField(name, nextValue)
      setFieldErrors((prev) => ({
        ...prev,
        [name]: nextError,
      }))
    }
  }

  const handleBlur = (event) => {
    const { name, value } = event.target
    if (name !== 'email' && name !== 'password') {
      return
    }

    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }))

    const error = validateSingleField(name, value)
    setFieldErrors((prev) => ({
      ...prev,
      [name]: error,
    }))
  }

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    setAuthError('')
    setTouched({ email: true, password: true })

    const errors = validateLoginFields(values)
    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      if (errors.email && emailInputRef.current) {
        emailInputRef.current.focus()
      } else if (errors.password && passwordInputRef.current) {
        passwordInputRef.current.focus()
      }
      return
    }

    setIsSubmitting(true)
    try {
      const session = await loginAdmin(values)
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(session)
      }
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Unable to sign in right now. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    values,
    fieldErrors,
    authError,
    isSubmitting,
    showPassword,
    emailInputRef,
    passwordInputRef,
    handleChange,
    handleBlur,
    togglePasswordVisibility,
    handleSubmit,
  }
}
