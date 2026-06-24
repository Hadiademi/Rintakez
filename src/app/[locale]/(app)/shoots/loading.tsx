import { Skeleton, ShootGridSkeleton } from "@/components/ui/skeleton";

/** Skeleton matching the real browse layout (sidebar + cover-image grid) so the
 *  page settles without a shape/size jump when data arrives. */
export default function ShootsLoading() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-9 w-56" />
      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-14">
        <aside className="mb-8 hidden lg:block">
          <Skeleton className="h-72 w-full" />
        </aside>
        <ShootGridSkeleton count={6} />
      </div>
    </div>
  );
}
