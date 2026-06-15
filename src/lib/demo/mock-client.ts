import { mockAuth } from "./auth";
import { from } from "./query-builder";
import { rpc } from "./rpc";
import { mockStorage } from "./storage";

// Assembles the pieces into an object shaped like the parts of the supabase-js
// client the app touches: `from`, `rpc`, `auth`, `storage`. Returned by every
// Supabase factory when demo mode is on.
export function createMockClient() {
  return {
    from,
    rpc,
    auth: mockAuth,
    storage: mockStorage(),
  } as any;
}
