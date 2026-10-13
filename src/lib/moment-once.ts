// "Show this celebration once" memory for moments that are triggered by a page
// view (a won shoot, a completed profile) rather than by the user's own click.
// Per device via localStorage: seeing a moment again on a second device is
// harmless, a migration for a UI nicety is not. Every read/write is guarded —
// private mode and blocked storage throw.

export type MomentStorage = Pick<Storage, "getItem" | "setItem">;

export function momentKey(id: string): string {
  return `framly:moment:${id}`;
}

/** Browser storage, or null on the server / when access itself throws. */
export function browserMomentStorage(): MomentStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Without working storage we can't remember a moment, so it would replay on
 * every visit — worse than not celebrating. Treat that case as already seen.
 */
export function hasSeenMoment(storage: MomentStorage | null, id: string): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(momentKey(id)) !== null;
  } catch {
    return true;
  }
}

export function markMomentSeen(storage: MomentStorage | null, id: string): void {
  try {
    storage?.setItem(momentKey(id), "1");
  } catch {
    // ignore — worst case the moment shows again
  }
}

/**
 * The profile-complete moment marks a transition, not a state: it fires when a
 * profile this device has seen incomplete reaches 100%, so founding
 * photographers whose profiles were complete long ago don't get a surprise
 * party. The caller marks `profile-complete:<userId>` seen once it shows.
 */
export function shouldCelebrateCompletion(
  storage: MomentStorage | null,
  userId: string,
  score: number
): boolean {
  if (!storage) return false;
  const wasIncomplete = `profile-incomplete:${userId}`;
  if (score < 100) {
    markMomentSeen(storage, wasIncomplete);
    return false;
  }
  try {
    if (storage.getItem(momentKey(wasIncomplete)) === null) return false;
  } catch {
    return false;
  }
  return !hasSeenMoment(storage, `profile-complete:${userId}`);
}
