import { isDemo } from "@/lib/demo/flag";
import { DEMO_PERSONAS } from "@/lib/demo/personas";

const ROLE_LABEL: Record<string, string> = {
  photographer: "Fotograf",
  client: "Klient",
};

// Shown on the login screen in demo mode so a visitor knows which credentials
// to enter. Renders nothing outside demo mode.
export function DemoBanner() {
  if (!isDemo()) return null;
  return (
    <div className="rounded-md border border-dashed border-accent/60 bg-surface px-4 py-3 text-[13px] text-ink">
      <p className="label mb-1 text-accent">Demo-Modus</p>
      <p className="mb-2 text-mute">
        Backend-freie Vorschau. Melden Sie sich mit einem dieser Konten an:
      </p>
      <ul className="space-y-1">
        {DEMO_PERSONAS.map((p) => (
          <li key={p.email}>
            <span className="text-mute">{ROLE_LABEL[p.role] ?? p.role}: </span>
            <code className="text-ink">{p.email}</code>
            <span className="text-mute"> / </span>
            <code className="text-ink">{p.password}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
