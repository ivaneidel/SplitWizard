/** Shimmer placeholder block used while data hydrates from cache. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200 dark:bg-zinc-700 ${className}`}
    />
  )
}
