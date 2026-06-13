export default function Loading() {
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6">
      <div className="w-48 h-4 rounded bg-chip animate-pulse" />
      <div className="w-64 h-4 rounded bg-chip animate-pulse" />
      <div className="w-40 h-4 rounded bg-chip animate-pulse" />
    </main>
  );
}
