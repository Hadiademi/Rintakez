import { DEMO_PERSONAS, findPersona, personaById } from "./personas";
import { clearDemoUser, getDemoUserId, setDemoUser } from "./session";

// Mock of the supabase-js `auth` surface the app uses. Backed by the demo
// session cookie + personas. Sign-in only accepts the two demo accounts;
// sign-up / OAuth / password-reset are benign no-ops.

function emailFor(id: string): string {
  return personaById(id)?.email ?? `${id}@demo.ch`;
}

function userFor(id: string | null) {
  if (!id) return null;
  const persona = personaById(id);
  return {
    id,
    email: emailFor(id),
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: persona ? { role: persona.role } : {},
    created_at: "2026-05-01T09:00:00.000Z",
  };
}

export const mockAuth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const persona = findPersona(email, password);
    if (!persona) {
      return {
        data: { user: null, session: null },
        error: { message: "Invalid login credentials", status: 400 },
      };
    }
    await setDemoUser(persona.id);
    const user = userFor(persona.id);
    return { data: { user, session: { user, access_token: "demo-token" } }, error: null };
  },

  async getUser() {
    const user = userFor(await getDemoUserId());
    return { data: { user }, error: null };
  },

  async getSession() {
    const user = userFor(await getDemoUserId());
    return {
      data: { session: user ? { user, access_token: "demo-token" } : null },
      error: null,
    };
  },

  async signOut() {
    await clearDemoUser();
    return { error: null };
  },

  async signUp() {
    // Demo has fixed accounts; pretend the sign-up succeeded with no live
    // session so the UI routes the visitor to the login screen.
    return { data: { user: null, session: null }, error: null };
  },

  async updateUser() {
    const user = userFor(await getDemoUserId());
    return { data: { user }, error: null };
  },

  async resetPasswordForEmail() {
    return { data: {}, error: null };
  },

  async signInWithOAuth() {
    return { data: { provider: "google", url: "/de" }, error: null };
  },

  async exchangeCodeForSession() {
    const user = userFor(await getDemoUserId());
    return { data: { session: user ? { user } : null, user }, error: null };
  },

  admin: {
    async getUserById(id: string) {
      return { data: { user: userFor(id) }, error: null };
    },
    async listUsers() {
      return {
        data: { users: DEMO_PERSONAS.map((p) => userFor(p.id)) },
        error: null,
      };
    },
  },
};
