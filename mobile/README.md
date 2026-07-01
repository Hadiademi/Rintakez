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
