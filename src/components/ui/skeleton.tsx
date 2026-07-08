/** Low-contrast pulsing placeholder. Reserve the real element's footprint to
 *  avoid layout shift while data loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-chip ${className}`} />;
}

/** Placeholder matching ShootCard's footprint (cover + two text lines). */
export function ShootCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[16/10] w-full" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/4" />
    </div>
  );
}

/** A responsive grid of shoot-card skeletons for browse/list loading states. */
export function ShootGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ShootCardSkeleton key={i} />
      ))}
    </div>
  );
}
