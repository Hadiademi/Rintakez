# Mobile-Ready Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Rintakez backend callable by a future native (Expo/React Native) app without building the mobile UI or risking the web launch.

**Architecture:** Move the one remaining Next.js-coupled critical flow (`submit_bid`) into a Postgres RPC so any Supabase client can call it; extract the web business logic into a framework-agnostic `core/` layer so web and mobile share one implementation; verify RLS protects every table on a direct connection; prove the auth path end-to-end with a minimal Expo login screen against local Supabase.

**Tech Stack:** Next.js 16 + React 19 + TypeScript, Supabase (local Postgres, RLS, RPC), Vitest, pgTAP (`supabase test db`), Expo / React Native, `supabase-js`, `expo-secure-store`.

## Global Constraints

- **Billing stays web-only** — no subscription/purchase code enters `/mobile`. The Expo app only authenticates and reads; it never sells. (See spec + memory `billing-web-only`.)
- **Local Supabase only** — all DB work runs against `supabase start` / `supabase db reset`; no cloud project this phase.
- **No web regression** — `npm run test`, `npm run typecheck`, `npm run build` must stay green after every task.
- **Single repo** — the Expo app lives in `/mobile` at the repo root.
- **RPC safety** — new RPCs are `SECURITY INVOKER` so RLS still applies to the caller (mobile-safe); do not use `SECURITY DEFINER` for `submit_bid`.
- **Existing patterns** — pgTAP tests follow `supabase/tests/database/*.test.sql`; unit tests follow `src/**/*.test.ts`; migrations are timestamped `YYYYMMDDHHMMSS_name.sql` under `supabase/migrations/`.

---

### Task 1: `submit_bid` Postgres RPC

Moves the insert-or-revive-withdrawn logic (currently inline in `submitBidAction`) into a Postgres function so a native client can place a bid by calling `supabase.rpc("submit_bid", …)`. `SECURITY INVOKER` keeps the existing bids RLS/insert guards (photographer-only, no past-date) in force.

**Files:**
- Create: `supabase/migrations/20260701000000_submit_bid.sql`
- Test: `supabase/tests/database/submit_bid.test.sql`

**Interfaces:**
- Produces: SQL function `public.submit_bid(p_shoot_id uuid, p_amount_chf integer, p_message text) returns void`. Raises `already_bid` (errcode `P0001`) when a non-withdrawn bid already exists. Executable by `authenticated`, not `anon`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/submit_bid.test.sql`:

```sql
-- submit_bid RPC: a photographer can place a bid, a duplicate live bid is
-- rejected with 'already_bid', and a previously withdrawn bid is revived.
begin;
create extension if not exists pgtap;

select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sb-c@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"SB Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sb-p@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"SB Photographer"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1',
   'Bid target shoot', 'portrait', 'A brief long enough to pass.', 'Bern', 'BE',
   '2027-06-01', 2, 500, 900);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';

-- 1: first bid succeeds and creates a pending row
select lives_ok(
  $$select public.submit_bid('10000000-0000-0000-0000-0000000000d1', 700, 'My first bid, long enough.')$$,
  'photographer can submit a first bid'
);
select is(
  (select status::text from public.bids
   where shoot_id = '10000000-0000-0000-0000-0000000000d1'
     and photographer_id = '00000000-0000-0000-0000-0000000000d2'),
  'pending',
  'the submitted bid is pending'
);

-- 2: a second live bid on the same shoot is rejected
select throws_ok(
  $$select public.submit_bid('10000000-0000-0000-0000-0000000000d1', 800, 'A duplicate live bid here.')$$,
  'P0001',
  'already_bid',
  'a duplicate live bid is rejected with already_bid'
);

-- 3: withdrawing then resubmitting revives the bid at the new amount
update public.bids set status = 'withdrawn'
  where shoot_id = '10000000-0000-0000-0000-0000000000d1'
    and photographer_id = '00000000-0000-0000-0000-0000000000d2';
select public.submit_bid('10000000-0000-0000-0000-0000000000d1', 950, 'Reviving my earlier bid now.');
select is(
  (select amount_chf from public.bids
   where shoot_id = '10000000-0000-0000-0000-0000000000d1'
     and photographer_id = '00000000-0000-0000-0000-0000000000d2'),
  950,
  'a withdrawn bid is revived at the new amount'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run db:test` (alias for `supabase test db`)
Expected: FAIL — `function public.submit_bid(uuid, integer, text) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260701000000_submit_bid.sql`:

```sql
-- submit_bid: place or revive a photographer's bid in one round-trip so any
-- Supabase client (web today, native app later) shares the same logic. Runs
-- SECURITY INVOKER, so the existing bids RLS insert policy (photographer role,
-- not a past-date shoot) and the unique (shoot_id, photographer_id) constraint
-- still apply. Mirrors the insert-or-revive-withdrawn behaviour previously
-- inline in submitBidAction.
create or replace function public.submit_bid(
  p_shoot_id uuid,
  p_amount_chf integer,
  p_message text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated integer;
begin
  begin
    insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values (p_shoot_id, auth.uid(), p_amount_chf, p_message);
    return;
  exception when unique_violation then
    -- A bid row already exists for (shoot, photographer). Revive it only if it
    -- was withdrawn; a live bid means the photographer has already bid.
    update public.bids
      set amount_chf = p_amount_chf, message = p_message, status = 'pending'
    where shoot_id = p_shoot_id
      and photographer_id = auth.uid()
      and status = 'withdrawn';
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'already_bid' using errcode = 'P0001';
    end if;
  end;
end;
$$;

revoke execute on function public.submit_bid(uuid, integer, text) from public;
revoke execute on function public.submit_bid(uuid, integer, text) from anon;
grant execute on function public.submit_bid(uuid, integer, text) to authenticated;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run db:test`
Expected: PASS — `submit_bid.test.sql .. ok` (4 assertions).

- [ ] **Step 5: Regenerate DB types**

Run: `npm run db:types`
Expected: `src/lib/supabase/database.types.ts` now includes a `submit_bid` entry under `Functions`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260701000000_submit_bid.sql supabase/tests/database/submit_bid.test.sql src/lib/supabase/database.types.ts
git commit -m "feat(bids): submit_bid RPC for direct-client bidding"
```

---

### Task 2: Extract `core/bids.ts` and thin the server action

Establishes the reusable-core pattern: pure logic that takes a Supabase client and returns a typed result, with the `"use server"` action reduced to session/role resolution + side effects (rate limit, email, revalidate) wrapping a `core` call.

**Files:**
- Create: `src/lib/core/bids.ts`
- Create: `src/lib/core/bids.test.ts`
- Modify: `src/lib/actions/bids.ts` (`submitBidAction` only)

**Interfaces:**
- Consumes: `public.submit_bid` RPC from Task 1.
- Produces: `submitBid(supabase, input): Promise<{ ok: true } | { ok: false; error: string }>` where `input` is `{ shootId: string; amountChf: number; message: string }`. Error is `"already_bid"` for a duplicate live bid, otherwise the `dbError(error, "bids")` string.

- [ ] **Step 1: Write the failing test**

Create `src/lib/core/bids.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { submitBid } from "@/lib/core/bids";

function fakeSupabase(rpcResult: { error: { message: string } | null }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) } as never;
}

describe("submitBid", () => {
  it("calls the submit_bid RPC with mapped params and returns ok", async () => {
    const supabase = fakeSupabase({ error: null });
    const result = await submitBid(supabase, {
      shootId: "s1",
      amountChf: 700,
      message: "A long enough message.",
    });
    expect(result).toEqual({ ok: true });
  });

  it("maps an already_bid RPC error to the already_bid result", async () => {
    const supabase = fakeSupabase({ error: { message: "already_bid" } });
    const result = await submitBid(supabase, {
      shootId: "s1",
      amountChf: 700,
      message: "A long enough message.",
    });
    expect(result).toEqual({ ok: false, error: "already_bid" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/core/bids.test.ts`
Expected: FAIL — cannot resolve `@/lib/core/bids`.

- [ ] **Step 3: Write `core/bids.ts`**

Create `src/lib/core/bids.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "@/lib/action-error";

export type BidResult = { ok: true } | { ok: false; error: string };

export type SubmitBidInput = {
  shootId: string;
  amountChf: number;
  message: string;
};

/**
 * Places or revives a photographer's bid via the submit_bid RPC. Framework-
 * agnostic: the caller supplies an authenticated Supabase client, so the same
 * function serves the web server action today and a native client later.
 */
export async function submitBid(
  supabase: SupabaseClient,
  input: SubmitBidInput
): Promise<BidResult> {
  const { error } = await supabase.rpc("submit_bid", {
    p_shoot_id: input.shootId,
    p_amount_chf: input.amountChf,
    p_message: input.message,
  });
  if (error) {
    if (error.message.includes("already_bid")) {
      return { ok: false, error: "already_bid" };
    }
    return { ok: false, error: dbError(error, "bids") };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/core/bids.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Rewrite `submitBidAction` as a thin shell**

In `src/lib/actions/bids.ts`, replace the whole `submitBidAction` function body (keep the imports for `revalidatePath`, `createClient`, `getProfile`, `notifyEmail`, `rateLimit`, and the `createBidSchema` import; remove the now-unused `dbError` import only if no other function in the file uses it — `updateBidAction`/`withdrawBidAction` still use it, so keep it). Add `import { submitBid } from "@/lib/core/bids";` near the other imports. Replace the function with:

```ts
export async function submitBidAction(shootId: string, raw: unknown): Promise<Ok | ErrResult> {
  const parsed = createBidSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  // Only photographers may bid. RLS enforces this too; checking here returns a
  // clean "forbidden" instead of a raw DB error, matching sibling actions.
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "unauthorized" };
  if (profile.role !== "photographer") return { ok: false, error: "forbidden" };
  if (!(await rateLimit(`bid:${profile.id}`, 20, 3_600_000)))
    return { ok: false, error: "limit_reached" };

  const supabase = await createClient();
  const result = await submitBid(supabase, {
    shootId,
    amountChf: parsed.data.amountChf,
    message: parsed.data.message,
  });
  if (!result.ok) return result;

  // Email the shoot's client (best-effort; gated on RESEND_API_KEY). This side
  // effect stays in the web action for now; moving bid notifications to a DB
  // trigger so the native path also notifies is a documented follow-up.
  const { data: shoot } = await supabase
    .from("shoots")
    .select("client_id, title")
    .eq("id", shootId)
    .maybeSingle();
  if (shoot) {
    await notifyEmail({
      kind: "bid_received",
      recipientId: shoot.client_id,
      shootId,
      shootTitle: shoot.title,
    });
  }

  revalidateBidViews();
  return { ok: true };
}
```

- [ ] **Step 6: Verify no web regression**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: typecheck clean, all unit tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/core/bids.ts src/lib/core/bids.test.ts src/lib/actions/bids.ts
git commit -m "refactor(bids): extract core/bids submitBid, thin the action shell"
```

---

### Task 3: RLS direct-connection audit

Confirms every table is safe when a client connects straight to Supabase (as the native app will), and records the result so it is auditable. `submit_bid` opened the direct-write path for bids; this task proves the rest of the surface holds.

**Files:**
- Create: `supabase/tests/database/direct_connection_rls.test.sql`
- Create: `docs/mobile/rls-audit.md`

**Interfaces:**
- Consumes: existing RLS policies across the 17 public tables.
- Produces: a pgTAP test asserting cross-user denial on the highest-risk tables, and a checklist doc enumerating every table's direct-connection posture.

- [ ] **Step 1: Write the audit checklist doc**

Create `docs/mobile/rls-audit.md`:

```markdown
# RLS Direct-Connection Audit

Goal: every `public` table must be safe when a user connects directly to
Supabase with their JWT (the native-app path), not only through server actions.

Method: for each table, confirm `alter table … enable row level security` is
present and that SELECT/INSERT/UPDATE/DELETE policies scope rows to the actor.
Verified by `supabase/tests/database/direct_connection_rls.test.sql` plus the
pre-existing `rls.test.sql`, `messaging_reviews.test.sql`, and
`reliability.test.sql`.

| Table | RLS on | Read scoped | Write scoped | Notes |
|-------|--------|-------------|--------------|-------|
| profiles | ☐ | ☐ | ☐ | public read of display fields; self-write |
| photographer_details | ☐ | ☐ | ☐ | |
| portfolio_images | ☐ | ☐ | ☐ | |
| shoots | ☐ | ☐ | ☐ | open shoots browsable; owner-write |
| bids | ☐ | ☐ | ☐ | photographer-owned; submit_bid path |
| conversations | ☐ | ☐ | ☐ | participants only |
| messages | ☐ | ☐ | ☐ | participants only |
| notifications | ☐ | ☐ | ☐ | recipient only |
| reviews | ☐ | ☐ | ☐ | hired-client authorship |
| favorites | ☐ | ☐ | ☐ | owner only |
| photographer_unavailable | ☐ | ☐ | ☐ | owner only |
| reports | ☐ | ☐ | ☐ | reporter/admin |
| disputes | ☐ | ☐ | ☐ | party/admin |
| user_blocks | ☐ | ☐ | ☐ | owner only |
| audit_log | ☐ | ☐ | ☐ | service/admin only |
| email_outbox | ☐ | ☐ | ☐ | service-role only |
| shoot_images | ☐ | ☐ | ☐ | shoot owner |

Fill each box as verified. Any gap → add a policy migration + a failing→passing
pgTAP assertion before ticking it.
```

- [ ] **Step 2: Write the failing cross-user denial test**

Create `supabase/tests/database/direct_connection_rls.test.sql`:

```sql
-- Direct-connection RLS: a user connecting straight to Supabase (native path)
-- cannot read another user's private rows or write rows they do not own.
begin;
create extension if not exists pgtap;

select plan(3);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dc-c@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"DC Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dc-p1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"DC P1"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dc-p2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"DC P2"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1',
   'Audit shoot', 'portrait', 'A brief long enough to pass.', 'Bern', 'BE',
   '2027-07-01', 2, 500, 900);

-- P1 places a bid via the RPC (their own, legitimate).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select public.submit_bid('10000000-0000-0000-0000-0000000000e1', 700, 'P1 legitimate bid here.');

-- 1: P2 cannot see P1's bid amount by reading the bids table directly.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select is(
  (select count(*)::int from public.bids
   where shoot_id = '10000000-0000-0000-0000-0000000000e1'
     and photographer_id = '00000000-0000-0000-0000-0000000000e2'),
  0,
  'a rival photographer cannot read another photographer''s bid row'
);

-- 2: P2 cannot forge a bid as P1 (write scoped to auth.uid()).
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-0000000000e1',
            '00000000-0000-0000-0000-0000000000e2', 500, 'Forged bid as P1.')$$,
  '42501',
  null,
  'a photographer cannot insert a bid on behalf of another'
);

-- 3: an authenticated user cannot read the email_outbox at all.
select throws_ok(
  $$select * from public.email_outbox$$,
  '42501',
  null,
  'the email_outbox is not readable by an authenticated user'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Run the test**

Run: `npm run db:test`
Expected: PASS if RLS already holds. If any assertion FAILS, that is a real gap — add a policy migration (`supabase/migrations/20260701010000_rls_gap_<table>.sql`) fixing exactly that table, re-run until green, and note it in `rls-audit.md`.

- [ ] **Step 4: Fill in the audit checklist**

Tick each box in `docs/mobile/rls-audit.md` that the test suite (this file + the existing `rls.test.sql`, `messaging_reviews.test.sql`, `reliability.test.sql`) demonstrably covers. Leave unchecked any table not yet exercised and add a one-line note naming what still needs a test — do not silently tick unverified boxes.

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/database/direct_connection_rls.test.sql docs/mobile/rls-audit.md supabase/migrations/20260701010000_rls_gap_*.sql 2>/dev/null
git commit -m "test(rls): direct-connection audit for the native-app path"
```

---

### Task 4: Expo login walking skeleton

Proves the auth path end-to-end: an Expo app logs in against **local** Supabase, persists the session in secure storage, and shows the signed-in identity. No business features, no billing.

**Files:**
- Create: `mobile/package.json`, `mobile/app.json`, `mobile/App.tsx`, `mobile/lib/supabase.ts`, `mobile/.env.example`, `mobile/.gitignore`, `mobile/README.md`
- Modify: `.gitignore` (repo root — ignore `mobile/node_modules` and `mobile/.env`)

**Interfaces:**
- Consumes: local Supabase Auth (email/password) + the same `auth.users` the web app uses.
- Produces: a runnable Expo app whose single screen authenticates and displays `signed in as <email>`.

- [ ] **Step 1: Scaffold the Expo app**

Run:
```bash
cd mobile 2>/dev/null || mkdir mobile && cd mobile
npx create-expo-app@latest . --template blank-typescript
npx expo install @supabase/supabase-js expo-secure-store @react-native-async-storage/async-storage react-native-url-polyfill
```
Expected: an Expo project in `mobile/` with TypeScript. (If prompts appear, accept defaults.)

- [ ] **Step 2: Add the Supabase client with secure-storage session**

Create `mobile/lib/supabase.ts`:

```ts
import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

// Session lives in the device secure enclave (Keychain/Keystore), never cookies.
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 3: Add the single login screen**

Replace `mobile/App.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { Button, SafeAreaView, Text, TextInput, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }

  if (session) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 18, marginBottom: 16 }}>
          signed in as {session.user.email}
        </Text>
        <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "600" }}>Rintakez (mobile proof)</Text>
        <TextInput
          placeholder="email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 8 }}
        />
        <TextInput
          placeholder="password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 8 }}
        />
        <Button title="Sign in" onPress={signIn} />
        {error ? <Text style={{ color: "crimson" }}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Add env template and ignore rules**

Create `mobile/.env.example`:

```
# From `supabase status` (API URL + anon key). On a device/emulator use your
# machine's LAN IP instead of 127.0.0.1 so the phone can reach local Supabase.
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

Create `mobile/README.md`:

```markdown
# Rintakez mobile (walking skeleton)

Auth-only proof that a native client authenticates against the same Supabase
backend as the web app. Not the production app — no business features, and
**no billing** (subscriptions are web-only).

## Run against local Supabase
1. From the repo root: `supabase start`, then `supabase status` to read the API
   URL and anon key.
2. `cp .env.example .env` and fill in the values. For a physical device or
   emulator, replace `127.0.0.1` with your machine's LAN IP.
3. Create a test user (web signup, or Supabase Studio → Authentication).
4. `npm install` then `npx expo start`. Sign in; the screen should read
   `signed in as <email>`.
```

Append to the repo-root `.gitignore`:

```
# Expo mobile skeleton
mobile/node_modules
mobile/.env
mobile/.expo
```

- [ ] **Step 5: Verify the proof manually**

Run (repo root): `supabase start` then `supabase status`; copy URL + anon key into `mobile/.env`. Create a test user. Then:
```bash
cd mobile && npx expo start
```
Open in Expo Go or a simulator, sign in with the test user.
Expected: the screen shows `signed in as <email>`; killing and reopening the app keeps you signed in (session persisted in secure storage).

- [ ] **Step 6: Commit**

```bash
git add mobile .gitignore
git commit -m "feat(mobile): Expo login walking skeleton against local Supabase"
```

---

## Self-Review

**Spec coverage:**
- Core layer (`src/lib/core/`) → Task 2. ✅
- Critical flows as RPC → Task 1 (`submit_bid`); `accept_bid`/`decline_bid`/`complete_shoot` already exist as RPC (noted, no work needed). ✅
- RLS verification for direct connections → Task 3. ✅
- Expo login walking skeleton (local Supabase) → Task 4. ✅
- Billing web-only constraint → enforced in Global Constraints + Task 4 scope. ✅
- Out-of-scope items (full action migration, mobile UI, push, store submission) → not planned, matching spec. ✅

**Placeholder scan:** No TBD/TODO; every code step shows real code; the only intentionally-unchecked items are the audit checkboxes in Task 3, which the engineer ticks against test evidence. ✅

**Type consistency:** `submit_bid(p_shoot_id, p_amount_chf, p_message)` params match between Task 1 (SQL), Task 2 (`core/bids.ts` rpc call), and Task 3 (test call). `BidResult` / `SubmitBidInput` used consistently. Error string `"already_bid"` consistent across RPC raise, core mapping, and tests. ✅

## Execution Handoff

See offer below.
