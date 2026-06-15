import { DEMO_PERSONAS, personaById } from "./personas";
import { from } from "./query-builder";
import { mockStorage } from "./storage";

// Browser-safe mock client. The real browser client is only ever used for auth
// (getSession/getUser/OAuth/password-reset) — realtime uses a separate raw
// client — so this implements auth from the (non-httpOnly) demo cookie plus a
// no-op realtime channel. It must NOT import server-only modules (next/headers).

function currentId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)demo_user=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function userFor(id: string | null) {
  if (!id) return null;
  const persona = personaById(id);
  return {
    id,
    email: persona?.email ?? `${id}@demo.ch`,
    aud: "authenticated",
    user_metadata: persona ? { role: persona.role } : {},
  };
}

const browserAuth = {
  async getUser() {
    return { data: { user: userFor(currentId()) }, error: null };
  },
  async getSession() {
    const user = userFor(currentId());
    return { data: { session: user ? { user, access_token: "demo-token" } : null }, error: null };
  },
  async signOut() {
    if (typeof document !== "undefined")
      document.cookie = "demo_user=; Max-Age=0; path=/";
    return { error: null };
  },
  async signInWithOAuth() {
    return { data: { provider: "google", url: "/" }, error: null };
  },
  async resetPasswordForEmail() {
    return { data: {}, error: null };
  },
  async updateUser() {
    return { data: { user: userFor(currentId()) }, error: null };
  },
  onAuthStateChange() {
    return { data: { subscription: { unsubscribe() {} } } };
  },
};

export function createBrowserMockClient() {
  const channel = () => {
    const ch: any = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} };
    return ch;
  };
  return {
    from,
    rpc: async () => ({ data: null, error: null }),
    auth: browserAuth,
    storage: mockStorage(),
    channel,
    removeChannel: () => {},
    getChannels: () => [],
  } as any;
}

export { DEMO_PERSONAS };
