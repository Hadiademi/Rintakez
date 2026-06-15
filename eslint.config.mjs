import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The demo mock layer stands in for the dynamically-typed supabase-js client,
  // so it legitimately traffics in `any`. Relax the rule for this folder only.
  {
    files: ["src/lib/demo/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design prototype — reference only, not production code.
    "prototype/**",
  ]),
]);

export default eslintConfig;
