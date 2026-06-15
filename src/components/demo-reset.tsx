import { resetDemoAction } from "@/lib/actions/demo";
import { isDemo } from "@/lib/demo/flag";

// A small fixed control, shown only in demo mode, that restores the seeded
// fixtures. Uses a plain form action so it works without client JS.
export function DemoReset() {
  if (!isDemo()) return null;
  return (
    <form
      action={resetDemoAction}
      className="fixed bottom-4 right-4 z-50"
    >
      <button
        type="submit"
        className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-mute shadow-sm hover:text-ink transition-colors"
        title="Demo-Daten zurücksetzen"
      >
        ↺ Demo zurücksetzen
      </button>
    </form>
  );
}
