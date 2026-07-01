import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the real my-shoots divided-row list (full width) so the page settles
 *  without a shape/width jump when data arrives. */
export default function MyShootsLoading() {
  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="divide-y divide-line border-y border-line">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-5">
            <Skeleton className="hidden h-16 w-24 shrink-0 sm:block" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
