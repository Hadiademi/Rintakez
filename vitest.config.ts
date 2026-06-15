import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: [
      // `server-only` is a Next.js build-time marker with no Node entry point;
      // point it at a no-op stub so server-side lib modules can be imported.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(
          new URL("./test/stubs/server-only.ts", import.meta.url)
        ),
      },
      // Mirror the tsconfig "@/*" path alias so tests can import app modules.
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL("./src/", import.meta.url)),
      },
    ],
  },
});
