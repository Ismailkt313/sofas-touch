export function BrandShowcase() {
  return (
    <div className="auth-brand">
      <div className="auth-brand__badge" aria-hidden="true">
        <svg
          className="auth-brand__emblem"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 13.5C7 10.4624 9.46243 8 12.5 8H19.5C22.5376 8 25 10.4624 25 13.5V16H7V13.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M4.5 16.5C4.5 15.3954 5.39543 14.5 6.5 14.5C7.60457 14.5 8.5 15.3954 8.5 16.5V19.5H23.5V16.5C23.5 15.3954 24.3954 14.5 25.5 14.5C26.6046 14.5 27.5 15.3954 27.5 16.5V21C27.5 21.8284 26.8284 22.5 26 22.5H6C5.17157 22.5 4.5 21.8284 4.5 21V16.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 22.5V24.5M24.5 22.5V24.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="auth-brand__kicker">Bespoke Sofas &amp; Curtains</span>
      </div>

      <h1 className="auth-brand__title">Soft Touch Sofas</h1>
      <p className="auth-brand__tagline">Comfort, crafted around you.</p>
    </div>
  )
}
