import { cookies } from "next/headers";

// Demo auth state lives in a single cookie holding the logged-in persona id.
// Read by the mock auth layer on the server; set on login, cleared on sign-out.

const COOKIE = "demo_user";

export async function setDemoUser(id: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getDemoUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export async function clearDemoUser(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
