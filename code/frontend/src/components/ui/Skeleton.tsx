interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: string
  className?: string
}

export function Skeleton({ width = '100%', height = 16, radius, className = '' }: SkeletonProps) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ display: 'block', width, height, borderRadius: radius }}
    />
  )
}

export function SkeletonCardList({ count = 3, height = 120 }: { count?: number; height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} radius="18px" />
      ))}
    </div>
  )
}
