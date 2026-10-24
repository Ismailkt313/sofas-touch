import { useState } from 'react'
import { getUserInitials } from '../services/userManagementService'

export function UserAvatar({ name, image, size = 'md', isAdmin = false }) {
  const [failedImageUrl, setFailedImageUrl] = useState('')
  const trimmedUrl = (image || '').trim()
  const showImage = Boolean(trimmedUrl && trimmedUrl !== failedImageUrl)
  const initials = getUserInitials(name)

  return (
    <span
      className={`user-avatar user-avatar--${size}${
        isAdmin ? ' user-avatar--admin' : ''
      }`}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={trimmedUrl}
          alt=""
          onError={() => setFailedImageUrl(trimmedUrl)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  )
}
