import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the real my-bids divided-row list (full width) so the page settles
 *  without a shape/width jump when data arrives. */
export default function MyBidsLoading() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-8 w-32" />
      <div className="divide-y divide-line border-y border-line">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-5">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-52" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
