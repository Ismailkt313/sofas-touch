import { useRef, useState } from 'react'
import { registerAccount } from '../services/authService'
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validatePhone,
  validateSignupFields,
  validateSignupPassword,
} from '../utils/validation'

export function useSignupForm({ onSignupSuccess } = {}) {
  const [values, setValues] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })

  const [fieldErrors, setFieldErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const fullNameInputRef = useRef(null)
  const emailInputRef = useRef(null)
  const phoneInputRef = useRef(null)
  const passwordInputRef = useRef(null)
  const confirmPasswordInputRef = useRef(null)

  const validateSingleField = (name, value, currentValues) => {
    switch (name) {
      case 'fullName':
        return validateFullName(value)
      case 'email':
        return validateEmail(value)
      case 'phone':
        return validatePhone(value)
      case 'password':
        return validateSignupPassword(value)
      case 'confirmPassword':
        return validateConfirmPassword(value, currentValues.password)
      default:
        return ''
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    const nextValues = {
      ...values,
      [name]: value,
    }
    setValues(nextValues)

    if (authError) {
      setAuthError('')
    }

    setFieldErrors((prev) => {
      const updated = { ...prev }

      if (touched[name] || prev[name]) {
        updated[name] = validateSingleField(name, value, nextValues)
      }

      if (
        name === 'password' &&
        (touched.confirmPassword || prev.confirmPassword)
      ) {
        updated.confirmPassword = validateConfirmPassword(
          nextValues.confirmPassword,
          value,
        )
      }

      return updated
    })
  }

  const handleBlur = (event) => {
    const { name, value } = event.target

    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }))

    const error = validateSingleField(name, value, values)
    setFieldErrors((prev) => ({
      ...prev,
      [name]: error,
    }))
  }

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev)
  }

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev)
  }

  const focusFirstInvalidField = (errors) => {
    if (errors.fullName && fullNameInputRef.current) {
      fullNameInputRef.current.focus()
    } else if (errors.email && emailInputRef.current) {
      emailInputRef.current.focus()
    } else if (errors.phone && phoneInputRef.current) {
      phoneInputRef.current.focus()
    } else if (errors.password && passwordInputRef.current) {
      passwordInputRef.current.focus()
    } else if (errors.confirmPassword && confirmPasswordInputRef.current) {
      confirmPasswordInputRef.current.focus()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    setAuthError('')
    setTouched({
      fullName: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
    })

    const errors = validateSignupFields(values)
    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(errors)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await registerAccount(values)
      if (typeof onSignupSuccess === 'function') {
        onSignupSuccess(result)
      }
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Unable to create your account right now. Please try again.',
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
    showConfirmPassword,
    fullNameInputRef,
    emailInputRef,
    phoneInputRef,
    passwordInputRef,
    confirmPasswordInputRef,
    handleChange,
    handleBlur,
    togglePasswordVisibility,
    toggleConfirmPasswordVisibility,
    handleSubmit,
  }
}
