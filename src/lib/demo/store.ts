import { buildFixtures, type DemoData } from "./fixtures";

// In-memory demo store. A server-side module singleton: mutations made through
// the mock client persist across navigation within a warm instance, giving the
// "interactive in session" feel. reseed() restores the original fixtures (used
// by the Reset-demo control and by tests).

let store: DemoData | null = null;

export function getStore(): DemoData {
  if (!store) store = buildFixtures();
  return store;
}

export function reseed(): void {
  store = buildFixtures();
}
