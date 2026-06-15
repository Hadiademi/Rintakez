// Test stub for the `server-only` marker package. In the app it throws if a
// server module is pulled into a client bundle; under Vitest (plain Node) we
// just want it to be an importable no-op so server-side lib code is testable.
export {};
