import { Skeleton } from "@/components/ui/skeleton";

export function WeatherSkeleton() {
  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-8 sm:p-12">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-10 w-64" />
        <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4">
          <Skeleton className="h-24 w-40" />
          <Skeleton className="h-14 w-48" />
        </div>
        <Skeleton className="mt-6 h-3 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-24" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
