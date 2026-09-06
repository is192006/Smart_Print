import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  padded?: boolean
}

export function Card({ interactive, padded = true, className = '', ...rest }: CardProps) {
  const classes = ['card', padded ? 'card--pad' : '', interactive ? 'card--interactive' : '', className]
    .filter(Boolean)
    .join(' ')
  return <div className={classes} {...rest} />
}
