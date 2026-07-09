import { describe, expect, it } from "vitest";
import { isConversationUnread, type UnreadCheckRow } from "./conversation-unread";

const CLIENT = "client-1";
const PHOTOGRAPHER = "photog-1";

function conv(overrides: Partial<UnreadCheckRow> = {}): UnreadCheckRow {
  return {
    client_id: CLIENT,
    photographer_id: PHOTOGRAPHER,
    last_message_at: "2026-07-08T12:00:00.000Z",
    client_last_read_at: null,
    photographer_last_read_at: null,
    ...overrides,
  };
}

describe("isConversationUnread", () => {
  it("never read (null marker) with an incoming message → unread", () => {
    const c = conv({ client_last_read_at: null });
    expect(isConversationUnread(c, CLIENT)).toBe(true);
  });

  it("my read marker older than the last message → unread", () => {
    const c = conv({
      last_message_at: "2026-07-08T12:00:00.000Z",
      client_last_read_at: "2026-07-08T11:00:00.000Z",
    });
    expect(isConversationUnread(c, CLIENT)).toBe(true);
  });

  it("my read marker at or after the last message → not unread", () => {
    const c = conv({
      last_message_at: "2026-07-08T12:00:00.000Z",
      client_last_read_at: "2026-07-08T12:00:00.000Z",
    });
    expect(isConversationUnread(c, CLIENT)).toBe(false);

    const cAfter = conv({
      last_message_at: "2026-07-08T12:00:00.000Z",
      client_last_read_at: "2026-07-08T13:00:00.000Z",
    });
    expect(isConversationUnread(cAfter, CLIENT)).toBe(false);
  });

  it("picks client_last_read_at when I'm the client", () => {
    const c = conv({
      last_message_at: "2026-07-08T12:00:00.000Z",
      client_last_read_at: "2026-07-08T13:00:00.000Z", // read, not unread
      photographer_last_read_at: null, // irrelevant to the client's own view
    });
    expect(isConversationUnread(c, CLIENT)).toBe(false);
  });

  it("picks photographer_last_read_at when I'm the photographer", () => {
    const c = conv({
      last_message_at: "2026-07-08T12:00:00.000Z",
      client_last_read_at: null, // irrelevant to the photographer's own view
      photographer_last_read_at: "2026-07-08T13:00:00.000Z", // read
    });
    expect(isConversationUnread(c, PHOTOGRAPHER)).toBe(false);
  });

  it("same conversation can be unread for one side and read for the other", () => {
    const c = conv({
      last_message_at: "2026-07-08T12:00:00.000Z",
      client_last_read_at: "2026-07-08T13:00:00.000Z", // client has read
      photographer_last_read_at: "2026-07-08T10:00:00.000Z", // photographer hasn't
    });
    expect(isConversationUnread(c, CLIENT)).toBe(false);
    expect(isConversationUnread(c, PHOTOGRAPHER)).toBe(true);
  });

  it(
    "does NOT special-case 'I sent the last message' — mirrors the exact " +
      "existing getConversations behavior, where a stale read marker still " +
      "counts as unread even for the conversation's own last sender",
    () => {
      // Regression guard for the rewrite: the lean query must reproduce
      // getConversations' predicate exactly, including this non-obvious
      // case, not the "last sender is me -> never unread" behavior a naive
      // rewrite might assume.
      const c = conv({
        last_message_at: "2026-07-08T12:00:00.000Z",
        client_last_read_at: "2026-07-08T11:00:00.000Z", // stale: before the message
      });
      expect(isConversationUnread(c, CLIENT)).toBe(true);
    }
  );
});
