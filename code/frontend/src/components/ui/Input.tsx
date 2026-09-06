import { useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

import { Icon } from './Icon'

interface FieldWrapProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  children: (id: string) => ReactNode
}

function FieldWrap({ label, hint, error, required, children }: FieldWrapProps) {
  const id = useId()
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && (
            <span className="field__required" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      {children(id)}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export function Input({ label, hint, error, required, className = '', type, ...rest }: InputProps) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword ? (visible ? 'text' : 'password') : type

  return (
    <FieldWrap label={label} hint={hint} error={error} required={required}>
      {(id) => (
        <div className="input-wrap">
          <input
            id={id}
            type={resolvedType}
            className={`input ${isPassword ? 'input--with-icon-right' : ''} ${error ? 'input--error' : ''} ${className}`}
            aria-invalid={!!error}
            required={required}
            {...rest}
          />
          {isPassword && (
            <button
              type="button"
              className="input-icon-btn"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-pressed={visible}
              tabIndex={-1}
            >
              <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
            </button>
          )}
        </div>
      )}
    </FieldWrap>
  )
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export function TextArea({ label, hint, error, required, className = '', ...rest }: TextAreaProps) {
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required}>
      {(id) => (
        <textarea
          id={id}
          className={`input ${error ? 'input--error' : ''} ${className}`}
          aria-invalid={!!error}
          required={required}
          {...rest}
        />
      )}
    </FieldWrap>
  )
}
