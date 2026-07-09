import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next only wires a handful of jsx-a11y rules (as "warn").
  // Layer the plugin's full recommended rules on top, scoped to JSX files, so
  // real accessibility defects (missing alt, unassociated labels,
  // non-interactive-element click handlers, etc.) fail the lint gate. The
  // "jsx-a11y" plugin object itself is already registered by
  // eslint-config-next for this file set, so only the rules/languageOptions
  // are merged here — redeclaring the plugin key would throw a ConfigError.
  {
    files: ["**/*.{jsx,tsx}"],
    languageOptions: jsxA11y.flatConfigs.recommended.languageOptions,
    rules: jsxA11y.flatConfigs.recommended.rules,
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
