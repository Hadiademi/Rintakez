// Launch gate: fail if any legal/content placeholder remains in the i18n
// catalogs. The Impressum, data-protection contact, and AGB fee clause ship as
// explicit fill-in markers and are mandatory for a public Swiss launch.
//
// Run `npm run check:legal` before every production deploy — it exits non-zero
// (listing the offending keys) until the placeholders are replaced with the
// operator's real details. It is intentionally NOT part of `npm test`, so the
// dev/CI build stays green while the placeholders are legitimately pending.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = ["de", "fr", "en"];

// A placeholder is an editorial fill-in note wrapped in square brackets, e.g.
// "[BITTE AUSFÜLLEN: …]" / "[À compléter avant le lancement.]". We require BOTH
// the brackets AND a fill-in keyword inside them, so legitimate UI copy that
// merely uses these verbs (e.g. onboarding "Compléter le profil") is not caught.
const BRACKETED = /\[([^\]]+)\]/g;
const KEYWORDS = [
  "ausfüllen", // de
  "vervollständig", // de — "(zu) vervollständigen"
  "vor dem start", // de — "Vor dem Start zu vervollständigen"
  "to complete", // en
  "to be completed", // en
  "complét", // fr — "à compléter" / "À COMPLÉTER" / "complète"
  "lancement", // fr — "avant le lancement"
  "launch", // en
];

function isPlaceholder(value) {
  for (const match of value.matchAll(BRACKETED)) {
    const inner = match[1].toLowerCase();
    if (KEYWORDS.some((k) => inner.includes(k))) return true;
  }
  return false;
}

function walk(node, path, out) {
  if (typeof node === "string") {
    if (isPlaceholder(node)) out.push({ key: path.join("."), value: node });
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(v, [...path, k], out);
  }
}

const findings = [];
for (const loc of LOCALES) {
  const file = join(root, "src/i18n/messages", `${loc}.json`);
  walk(JSON.parse(readFileSync(file, "utf8")), [loc], findings);
}

if (findings.length > 0) {
  console.error(
    `✖ ${findings.length} unfilled placeholder(s) — must be completed before public launch:\n`
  );
  for (const f of findings) console.error(`  ${f.key}\n    ${f.value}\n`);
  console.error("Fill these in src/i18n/messages/{de,fr,en}.json, then re-run.");
  process.exit(1);
}

console.log("✓ No launch placeholders remaining in i18n catalogs.");
