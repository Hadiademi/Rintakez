// Precondition: run `npx supabase db reset` for clean seed state (CI e2e job does this).
//
// Seeded conversation used here: the "Standesamtliche Trauung Zürich" shoot
// (lena@example.ch as client, marko@example.ch as the accepted photographer)
// is inserted `open`, then flipped to `assigned` in supabase/seed.sql — that
// open→assigned transition fires create_conversation_on_assign (see
// supabase/migrations/20260613070000_messaging.sql), so a conversation
// between Lena and Marko already exists with zero messages after a fresh
// `db reset`. No UI shoot/bid setup is needed to reach a real two-party
// thread.
//
// Two browser CONTEXTS (not just two logins in sequence) represent the two
// participants so both can hold an authenticated session at the same time —
// this does not fight the single-worker/no-concurrent-same-user-login
// constraint in playwright.config.ts, since each context logs in as a
// DIFFERENT seed user (no refresh-token rotation collision).
import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

const CLIENT = {
  email: "lena@example.ch",
  password: "password123",
  name: "Lena & Tobias K.",
};
const PHOTOGRAPHER = {
  email: "marko@example.ch",
  password: "password123",
  name: "Marko Brunner",
};

/** The message-list region (role="log") — scoping assertions to it avoids
 *  matching the same text in the always-visible desktop sidebar preview
 *  (ConversationList shows the last message body too). */
function threadLog(page: Page) {
  return page.getByRole("log");
}

/**
 * Find the seeded Lena↔Marko conversation ("Standesamtliche Trauung Zürich")
 * in the inbox list by the OTHER party's name — excluding "Hochzeit in
 * Zermatt", the other Lena↔Marko conversation that client-flow.spec.ts's
 * "accept a bid" test creates (accepting a bid flips that shoot to assigned,
 * which fires create_conversation_on_assign). When the full e2e suite runs
 * together in one worker against one `db reset`, both conversations can
 * exist by the time this spec runs, so filtering on name alone is ambiguous.
 */
function findConversationRow(page: Page, otherName: string) {
  return page
    .getByTestId("conversation-row")
    .filter({ hasText: otherName })
    .filter({ hasNotText: "Hochzeit in Zermatt" });
}

/**
 * Type + send a message, waiting for the actual sendMessage Server Action
 * round-trip (not just the optimistic bubble) before returning — onSend()
 * shows the bubble synchronously, well before the `await sendMessage(...)`
 * network call resolves, so a plain click+assert can race a same-page insert
 * that hasn't committed yet. Then reload to prove the row is genuinely
 * persisted (getThread() is force-dynamic, so a reload re-fetches from the
 * DB) rather than trusting client-side state alone — this is also what lets
 * the OTHER participant's later reload reliably see it.
 */
async function sendAndConfirm(page: Page, text: string): Promise<void> {
  await page.getByTestId("message-input").fill(text);
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url() === page.url() &&
        res.status() === 200
    ),
    page.getByTestId("message-send").click(),
  ]);
  await response.finished();
  await expect(threadLog(page).getByText(text).first()).toBeVisible({
    timeout: 20_000,
  });

  await page.reload();
  await expect(threadLog(page).getByText(text).first()).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("messaging", () => {
  // Two logins, two thread opens each, several round-trips — give this one
  // plenty of room (mirrors the 90s per-test budget other flows use, doubled
  // for the extra participant).
  test.setTimeout(150_000);

  test("two-party thread: send, receive, unread badge reflects and clears", async ({
    browser,
  }) => {
    const photographerContext = await browser.newContext();
    const clientContext = await browser.newContext();
    const photographerPage = await photographerContext.newPage();
    const clientPage = await clientContext.newPage();

    try {
      await login(photographerPage, PHOTOGRAPHER.email, PHOTOGRAPHER.password);
      await login(clientPage, CLIENT.email, CLIENT.password);

      // ── Photographer opens the seeded thread via the inbox list ─────────
      await photographerPage.goto("/de/messages");
      const photographerConvRow = findConversationRow(
        photographerPage,
        CLIENT.name
      );
      await expect(photographerConvRow).toBeVisible({ timeout: 20_000 });
      await photographerConvRow.click();
      await expect(photographerPage).toHaveURL(
        /\/de\/messages\/[0-9a-f-]{36}/,
        { timeout: 20_000 }
      );
      await expect(
        photographerPage.getByText(CLIENT.name, { exact: true }).first()
      ).toBeVisible({ timeout: 20_000 });

      // Reused for every later direct navigation to the same thread instead
      // of re-finding the inbox row each time.
      const threadPath = new URL(photographerPage.url()).pathname;

      // ── Photographer sends the first message (persistence-confirmed) ────
      const firstMessage = `E2E ping ${Date.now()}`;
      await sendAndConfirm(photographerPage, firstMessage);

      // ── Client: unread badge reflects the new message before opening ────
      // Nav badge: at least one conversation is unread (visible regardless
      // of how many — other e2e specs run earlier in the same worker can
      // create/leave unrelated conversations of their own, e.g. accepting a
      // bid opens a second, separate Lena↔Marko conversation with its own
      // unread state — so a plain "visible" check here is intentionally
      // count-agnostic).
      await clientPage.goto("/de/home");
      await expect(clientPage.getByTestId("nav-messages-badge")).toBeVisible({
        timeout: 20_000,
      });
      // The inbox row for THIS conversation specifically also shows its own
      // unread dot — the precise, per-conversation signal.
      await clientPage.goto("/de/messages");
      const clientConvRow = findConversationRow(clientPage, PHOTOGRAPHER.name);
      await expect(clientConvRow).toBeVisible({ timeout: 20_000 });
      await expect(
        clientConvRow.getByTestId("conversation-unread-dot")
      ).toBeVisible({ timeout: 20_000 });

      // ── Client opens the thread via the inbox list, sees the message ────
      await clientConvRow.click();
      await expect(clientPage).toHaveURL(/\/de\/messages\/[0-9a-f-]{36}/, {
        timeout: 20_000,
      });
      await expect(
        threadLog(clientPage).getByText(firstMessage).first()
      ).toBeVisible({ timeout: 20_000 });

      // ── This conversation's own unread dot clears once opened (mark-read
      //    on mount) — checked on the row itself, not the aggregate nav
      //    count, for the same reason as above. ───────────────────────────
      await clientPage.goto("/de/messages");
      await expect(
        findConversationRow(clientPage, PHOTOGRAPHER.name).getByTestId(
          "conversation-unread-dot"
        )
      ).toHaveCount(0, { timeout: 20_000 });

      // ── Client replies (persistence-confirmed); photographer sees it
      //    after a reload (avoids racing the realtime socket — assert the
      //    persisted state instead of the live channel). ───────────────────
      await clientPage.goto(threadPath);
      const replyMessage = `E2E reply ${Date.now()}`;
      await sendAndConfirm(clientPage, replyMessage);

      await photographerPage.reload();
      await expect(
        threadLog(photographerPage).getByText(replyMessage).first()
      ).toBeVisible({ timeout: 20_000 });
    } finally {
      await photographerContext.close();
      await clientContext.close();
    }
  });

  // ── Block/unblock — KNOWN, PRE-EXISTING BUG ────────────────────────────
  // blockUser()/unblockUser() (src/lib/actions/messages.ts) call
  // `supabase.from("user_blocks").upsert({...}, { onConflict: "blocker_id,
  // blocked_id" })`. PostgREST compiles that to `INSERT ... ON CONFLICT (...)
  // DO UPDATE SET ...`, which requires UPDATE privilege on the table even
  // when no conflict actually occurs (Postgres checks the privilege needed
  // to plan the ON CONFLICT DO UPDATE clause, not just the branch taken).
  // supabase/migrations/20260622030000_blocks.sql:17 only grants
  //   `select, insert, delete` to `authenticated` — UPDATE was never granted.
  // Reproduced directly against local Postgres (bypassing the app/PostgREST
  // entirely):
  //   set local role authenticated;
  //   set local request.jwt.claims to '{"sub":"<marko>","role":"authenticated"}';
  //   insert into public.user_blocks (blocker_id, blocked_id)
  //     values ('<marko>', '<lena>')
  //     on conflict (blocker_id, blocked_id) do update set
  //       blocker_id = excluded.blocker_id, blocked_id = excluded.blocked_id;
  //   -- ERROR:  permission denied for table user_blocks
  //   -- HINT:  Grant the required privileges to the current role with:
  //   --        GRANT UPDATE ON public.user_blocks TO authenticated;
  // Net effect: clicking "Blockieren" in the UI always fails silently (the
  // action returns { ok: false }, and onToggleBlock only flips local state
  // when ok — see message-thread.tsx's onToggleBlock) — the composer never
  // actually disables. The safety feature is a no-op end to end.
  //
  // This is a genuine product bug this new e2e coverage found — exactly the
  // class of gap WI-5 exists to catch — but WI-5 is scoped to TESTS ONLY, so
  // it is deliberately not fixed here (that's a one-line migration:
  // `grant update on public.user_blocks to authenticated;` or the tighter
  // `grant update (blocker_id, blocked_id) on public.user_blocks to
  // authenticated;`). test.fail() below encodes "this is expected to fail
  // right now" so the suite stays green — and the moment someone applies
  // that grant, this test will start passing, which Playwright reports as an
  // unexpected pass (a build-breaking signal to remove the test.fail()
  // annotation and confirm the rest of the flow — unblock, composer
  // re-enable — for real).
  test("block disables the composer for both sides; unblock re-enables it", async ({
    browser,
  }) => {
    test.fail(
      true,
      "blockUser() cannot actually write a block row — user_blocks lacks an " +
        "UPDATE grant for `authenticated`, required by its upsert's ON " +
        "CONFLICT DO UPDATE clause (see the comment above this test). Fix: " +
        "grant update on public.user_blocks to authenticated; — once applied " +
        "this test starts passing and the test.fail() call must be removed."
    );

    const photographerContext = await browser.newContext();
    const clientContext = await browser.newContext();
    const photographerPage = await photographerContext.newPage();
    const clientPage = await clientContext.newPage();

    try {
      await login(photographerPage, PHOTOGRAPHER.email, PHOTOGRAPHER.password);
      await login(clientPage, CLIENT.email, CLIENT.password);

      await photographerPage.goto("/de/messages");
      const photographerConvRow = findConversationRow(
        photographerPage,
        CLIENT.name
      );
      await expect(photographerConvRow).toBeVisible({ timeout: 20_000 });
      await photographerConvRow.click();
      await expect(photographerPage).toHaveURL(
        /\/de\/messages\/[0-9a-f-]{36}/,
        { timeout: 20_000 }
      );
      const threadPath = new URL(photographerPage.url()).pathname;
      await expect(
        photographerPage.getByTestId("message-input")
      ).toBeVisible({ timeout: 20_000 });

      // ── Block: photographer blocks the client — composer should disable
      //    for both sides (their own "you blocked them" / "they blocked
      //    you" notice), verified after a reload on the client's side. ────
      await photographerPage.getByTestId("thread-block-toggle").click();
      await expect(
        photographerPage.getByTestId("message-input")
      ).toHaveCount(0, { timeout: 20_000 });
      await expect(
        photographerPage.getByText(
          "Du hast diese Person blockiert. Hebe die Blockierung auf, um zu schreiben.",
          { exact: true }
        )
      ).toBeVisible();

      await clientPage.goto(threadPath);
      await expect(clientPage.getByTestId("message-input")).toHaveCount(0, {
        timeout: 20_000,
      });
      await expect(
        clientPage.getByText(
          "Du kannst dieser Person keine Nachricht senden.",
          { exact: true }
        )
      ).toBeVisible();

      // ── Unblock: composer re-enabled again, a new message goes through ──
      await photographerPage.getByTestId("thread-block-toggle").click();
      await expect(
        photographerPage.getByTestId("message-input")
      ).toBeVisible({ timeout: 20_000 });

      const finalMessage = `E2E post-unblock ${Date.now()}`;
      await sendAndConfirm(photographerPage, finalMessage);

      await clientPage.goto(threadPath);
      await expect(clientPage.getByTestId("message-input")).toBeVisible({
        timeout: 20_000,
      });
      await expect(
        threadLog(clientPage).getByText(finalMessage).first()
      ).toBeVisible({ timeout: 20_000 });
    } finally {
      await photographerContext.close();
      await clientContext.close();
    }
  });
});

// Documented gap (see the WI-5 report): image-message send/receive is not
// covered here. Driving the canvas-downscale + file-picker path reliably in
// Playwright is a materially bigger lift than the text core this spec
// exercises, and sendImageMessage's server-side validation (MIME, size
// ceiling, storage upload/rollback) already has real-DB coverage in
// supabase/tests/database/message_images.test.sql.
