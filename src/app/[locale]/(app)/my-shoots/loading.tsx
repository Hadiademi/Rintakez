import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the real my-shoots shape (header + 4-KPI stats grid + tabs + rich
 *  rows) so the page settles without a layout jump when data arrives. */
export default function MyShootsLoading() {
  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36 shrink-0" />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 bg-paper p-5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-6 border-b border-line pb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-16" />
          ))}
        </div>
        <div className="divide-y divide-line">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <Skeleton className="h-16 w-20 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
