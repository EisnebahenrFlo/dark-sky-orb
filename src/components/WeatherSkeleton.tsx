export function WeatherSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="glass rounded-3xl p-8 sm:p-12">
        <div className="h-16 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="mt-4 h-5 w-24 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* 2x2 Karten-Grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>

      {/* Stündlich: 5 Zeilen */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-20 animate-pulse rounded-lg bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
