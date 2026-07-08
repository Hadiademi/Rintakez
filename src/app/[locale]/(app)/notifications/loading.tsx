import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the notifications history list (icon + two text lines + time) so the
 *  page settles without a shape jump when data arrives. */
export default function NotificationsLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="divide-y divide-line border-y border-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-3 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
