/** Minimal row shape needed to decide "unread" — a subset of the columns
 *  selected by both getConversations and getUnreadConversationCount
 *  (src/lib/actions/messages.ts). */
export type UnreadCheckRow = {
  client_id: string;
  photographer_id: string;
  last_message_at: string;
  client_last_read_at: string | null;
  photographer_last_read_at: string | null;
};

/**
 * Whether a conversation counts as unread for `userId`. Extracted as a pure,
 * standalone predicate (not exported from messages.ts, a "use server" file
 * that may only export async functions) so getConversations (full summaries)
 * and getUnreadConversationCount (lean nav-badge count) share ONE
 * definition — the two must never drift apart, since a mismatch would show a
 * badge count that disagrees with the inbox.
 *
 * Unread iff my own last-read marker (client_last_read_at if I'm the client,
 * else photographer_last_read_at) is null (never read) OR older than
 * last_message_at. Note: this does NOT special-case "I sent the last
 * message" — that mirrors the existing behavior exactly (a conversation I
 * just sent into shows unread again until I next mark it read, e.g. by
 * reopening the thread).
 */
export function isConversationUnread(
  c: UnreadCheckRow,
  userId: string
): boolean {
  const myReadAt =
    c.client_id === userId ? c.client_last_read_at : c.photographer_last_read_at;
  return !myReadAt || c.last_message_at > myReadAt;
}
