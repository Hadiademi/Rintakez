// Tiny wrapper around the Plausible custom-event API (see
// src/components/analytics.tsx — the `plausible` global only exists once the
// script has loaded, which itself only happens when NEXT_PUBLIC_PLAUSIBLE_DOMAIN
// is set). Calling `track()` anywhere it isn't loaded (local dev, tests, SSR)
// is a silent no-op.
export function track(event: string, props?: Record<string, string | number>) {
  if (typeof window !== "undefined" && (window as unknown as { plausible?: (e: string, o?: { props: Record<string, string | number> }) => void }).plausible) {
    (window as unknown as { plausible: (e: string, o?: { props: Record<string, string | number> }) => void }).plausible(
      event,
      props ? { props } : undefined
    );
  }
}
