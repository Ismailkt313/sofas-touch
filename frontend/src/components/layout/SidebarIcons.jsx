export function BrandEmblemIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M7 13.5C7 10.4624 9.46243 8 12.5 8H19.5C22.5376 8 25 10.4624 25 13.5V16H7V13.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 16.5C4.5 15.3954 5.39543 14.5 6.5 14.5C7.60457 14.5 8.5 15.3954 8.5 16.5V19.5H23.5V16.5C23.5 15.3954 24.3954 14.5 25.5 14.5C26.6046 14.5 27.5 15.3954 27.5 16.5V21C27.5 21.8284 26.8284 22.5 26 22.5H6C5.17157 22.5 4.5 21.8284 4.5 21V16.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 22.5V24.5M24.5 22.5V24.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function NotificationBellIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 2.75C7.37665 2.75 5.25 4.87665 5.25 7.5V10.6C5.25 11.32 4.97 12.01 4.47 12.53L3.55 13.48C3.15 13.89 3.44 14.58 4.01 14.58H15.99C16.56 14.58 16.85 13.89 16.45 13.48L15.53 12.53C15.03 12.01 14.75 11.32 14.75 10.6V7.5C14.75 4.87665 12.6234 2.75 10 2.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8.15 15.25C8.48 16.25 9.18 17 10 17C10.82 17 11.52 16.25 11.85 15.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SidebarNavIcon({ id, className = '' }) {
  switch (id) {
    case 'dashboard':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2.75" y="2.75" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11.25" y="2.75" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="2.75" y="11.25" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11.25" y="11.25" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    case 'users':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="7.5" cy="6.75" r="2.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2.75 15.75C3.25 13.3 5.15 11.75 7.5 11.75C9.85 11.75 11.75 13.3 12.25 15.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12.75 4.35C13.95 4.7 14.85 5.8 14.85 7.1C14.85 8.4 13.95 9.5 12.75 9.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14.25 12.05C15.75 12.55 16.85 13.85 17.25 15.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'user-approvals':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="7.5" cy="6.75" r="2.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2.75 15.75C3.25 13.3 5.15 11.75 7.5 11.75C9.05 11.75 10.42 12.42 11.28 13.55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12.5 11.75L14.35 13.6L17.5 10.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'projects':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M2.75 6.25C2.75 5.14543 3.64543 4.25 4.75 4.25H7.6L9.1 6H15.25C16.3546 6 17.25 6.89543 17.25 8V14.25C17.25 15.3546 16.3546 16.25 15.25 16.25H4.75C3.64543 16.25 2.75 15.3546 2.75 14.25V6.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M6.5 11.25H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'raw-materials':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 2.75L17 6.5L10 10.25L3 6.5L10 2.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M3 10.25L10 14L17 10.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 13.75L10 17.25L17 13.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'expense-heads':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3.25 9.6V4.75C3.25 3.92157 3.92157 3.25 4.75 3.25H9.6C9.99782 3.25 10.3794 3.40804 10.6607 3.68934L16.3107 9.33934C16.8964 9.92513 16.8964 10.8749 16.3107 11.4607L11.4607 16.3107C10.8749 16.8964 9.92513 16.8964 9.33934 16.3107L3.68934 10.6607C3.40804 10.3794 3.25 9.99782 3.25 9.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="6.75" cy="6.75" r="1.15" fill="currentColor" />
        </svg>
      )
    case 'purchases':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4.25 6.5H15.75L14.95 15.4C14.86 16.31 14.1 17 13.18 17H6.82C5.9 17 5.14 16.31 5.05 15.4L4.25 6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7.25 6.5V5.5C7.25 3.98122 8.48122 2.75 10 2.75C11.5188 2.75 12.75 3.98122 12.75 5.5V6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'expenses':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4.25 3.5C4.25 2.94772 4.69772 2.5 5.25 2.5H14.75C15.3023 2.5 15.75 2.94772 15.75 3.5V17L13.45 15.55L11.15 17L8.85 15.55L6.55 17L4.25 15.55V3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7.25 7H12.75M7.25 10.25H11.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'reports':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3.25 16.75H16.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="4.75" y="9.75" width="2.5" height="4.75" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8.75" y="6.25" width="2.5" height="8.25" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
          <rect x="12.75" y="3.75" width="2.5" height="10.75" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    case 'activity':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="6.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6.25V10.15L12.65 11.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'permissions':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 2.75L16.25 5.25V9.85C16.25 13.55 13.62 16.55 10 17.5C6.38 16.55 3.75 13.55 3.75 9.85V5.25L10 2.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7.65 10.1L9.25 11.7L12.6 8.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'settings':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 3.25V4.85M10 15.15V16.75M3.25 10H4.85M15.15 10H16.75M5.22 5.22L6.35 6.35M13.65 13.65L14.78 14.78M14.78 5.22L13.65 6.35M6.35 13.65L5.22 14.78" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'profile':
      return (
        <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="6.75" r="3.1" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4.25 16.25C4.85 13.6 7.15 12 10 12C12.85 12 15.15 13.6 15.75 16.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}
