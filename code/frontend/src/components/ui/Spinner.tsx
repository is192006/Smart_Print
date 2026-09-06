interface SpinnerProps {
  size?: number
  inverted?: boolean
}

export function Spinner({ size = 20, inverted }: SpinnerProps) {
  return (
    <span
      className="spinner"
      role="status"
      aria-label="Loading"
      style={{
        width: size,
        height: size,
        borderColor: inverted ? 'rgba(255,255,255,0.35)' : undefined,
        borderTopColor: inverted ? '#fff' : undefined,
      }}
    />
  )
}
