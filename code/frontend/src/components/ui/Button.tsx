import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  isLoading?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  isLoading,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'sm' ? 'btn--sm' : size === 'lg' ? 'btn--lg' : size === 'icon' ? 'btn--icon' : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} disabled={disabled || isLoading} {...rest}>
      {isLoading && <Spinner size={15} inverted={variant === 'primary'} />}
      {children}
    </button>
  )
}
