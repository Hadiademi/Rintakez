import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the shoot detail layout (cover + heading + meta rows + brief) so the
 *  page settles without the generic three-gray-bars jump. */
export default function ShootDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <Skeleton className="aspect-[16/9] w-full" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-3/4" />
      </div>
      <div className="space-y-3 border-t border-line pt-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-line py-3"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
