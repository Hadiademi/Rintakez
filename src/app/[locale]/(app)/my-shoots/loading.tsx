export default function MyShootsLoading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="w-40 h-5 rounded bg-chip animate-pulse mb-6" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border border-line rounded p-4 flex flex-col gap-3 animate-pulse"
          >
            <div className="h-4 rounded bg-chip w-3/4" />
            <div className="h-3 rounded bg-chip w-1/2" />
            <div className="h-3 rounded bg-chip w-2/3" />
          </div>
        ))}
      </div>
    </main>
  );
}
