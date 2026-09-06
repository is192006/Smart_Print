import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  heading: string
  subheading: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ heading, subheading, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__visual">
        <span className="auth-layout__blob" style={{ width: 320, height: 320, top: -100, left: -100 }} />
        <span className="auth-layout__blob" style={{ width: 220, height: 220, bottom: -40, right: -60 }} />
        <Link to="/" className="auth-layout__visual-brand">
          <span className="auth-layout__brand-mark auth-layout__brand-mark--on-dark">SP</span>
          <span className="auth-layout__brand-name auth-layout__brand-name--on-dark">SmartPrint</span>
        </Link>
        <div className="auth-layout__visual-inner">
          <PrintQueueIllustration />
          <h2 className="auth-layout__visual-title">
            Class in 10 minutes.
            <br />
            Still in the print queue?
          </h2>
          <p className="auth-layout__visual-desc">Let SmartPrint handle it.</p>
        </div>
      </div>
      <div className="auth-layout__form-side">
        <div className="auth-layout__form">
          <div className="auth-layout__brand auth-layout__brand--mobile-only">
            <span className="auth-layout__brand-mark">SP</span>
            <span className="auth-layout__brand-name">SmartPrint</span>
          </div>
          <h1 className="auth-layout__heading">{heading}</h1>
          <p className="auth-layout__subheading">{subheading}</p>
          {children}
          {footer && <div className="auth-layout__form-footer">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

function PrintQueueIllustration() {
  return (
    <svg
      className="auth-layout__illustration"
      width="220"
      height="140"
      viewBox="0 0 220 140"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="24" y="16" width="120" height="86" rx="10" fill="rgba(255,255,255,0.10)" />
      <rect x="24" y="16" width="120" height="86" rx="10" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
      <rect x="40" y="34" width="88" height="7" rx="3.5" fill="rgba(255,255,255,0.42)" />
      <rect x="40" y="50" width="64" height="7" rx="3.5" fill="rgba(255,255,255,0.28)" />
      <rect x="40" y="66" width="72" height="7" rx="3.5" fill="rgba(255,255,255,0.28)" />

      <rect x="118" y="52" width="78" height="60" rx="12" fill="#fff" />
      <rect x="118" y="52" width="78" height="60" rx="12" stroke="rgba(67,56,255,0.15)" strokeWidth="1.5" />
      <rect x="134" y="68" width="46" height="6" rx="3" fill="var(--color-primary)" opacity="0.85" />
      <rect x="134" y="82" width="30" height="6" rx="3" fill="var(--color-primary)" opacity="0.4" />
      <circle cx="181" cy="94" r="7" fill="var(--color-success)" />
      <path d="M177.5 94.3 180 96.8 185 91.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
