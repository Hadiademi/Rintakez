/**
 * Recreate the local test accounts that `supabase db reset` wipes.
 *
 * The seed users in supabase/seed.sql are plain SQL rows, so a reset restores
 * them. These two are created through the Auth admin API instead (a reset only
 * replays seed.sql, so they vanish every time). This script is idempotent —
 * re-running it updates the existing users rather than failing.
 *
 * Usage: node scripts/seed-test-accounts.mjs   (needs the local stack running)
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// .env.local is not auto-loaded outside Next — parse the two keys we need.
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  {
    email: "klient@test.ch",
    password: "test1234",
    profile: {
      role: "client",
      display_name: "Test Klient",
      city: "Zürich",
      canton: "ZH",
      locale: "de",
      is_admin: false,
    },
  },
  {
    email: "fotograf@test.ch",
    password: "test1234",
    profile: {
      role: "photographer",
      display_name: "Test Fotograf",
      city: "Zürich",
      canton: "ZH",
      locale: "de",
      // Kept admin so /admin stays reachable in local testing.
      is_admin: true,
    },
    photographer: {
      specialties: ["wedding", "portrait"],
      coverage_cantons: ["ZH", "AG"],
      disciplines: ["photo"],
      hourly_rate_chf: 180,
      verification_status: "verified",
      plan_tier: "standard",
    },
  },
];

async function findUserByEmail(email) {
  // listUsers is paginated; the local DB is small, so one page is plenty.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

for (const acct of ACCOUNTS) {
  const existing = await findUserByEmail(acct.email);

  let userId;
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: acct.password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = existing.id;
    console.log(`updated auth user  ${acct.email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: acct.email,
      password: acct.password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`created auth user  ${acct.email}`);
  }

  const { error: pErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      ...acct.profile,
      role_confirmed: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: "1.0",
    },
    { onConflict: "id" }
  );
  if (pErr) throw pErr;

  if (acct.photographer) {
    const { error: dErr } = await admin
      .from("photographer_details")
      .upsert({ profile_id: userId, ...acct.photographer }, { onConflict: "profile_id" });
    if (dErr) throw dErr;
  }

  console.log(
    `  profile ok        role=${acct.profile.role} is_admin=${acct.profile.is_admin}`
  );
}

console.log("\nDone. Both accounts use password: test1234");
