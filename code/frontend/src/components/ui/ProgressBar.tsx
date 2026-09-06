interface ProgressBarProps {
  percent: number
  label?: string
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  )
}
