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
    default:
      return null
  }
}
