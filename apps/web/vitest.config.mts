import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const configDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(configDirectory, "../.."),
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js": resolve(configDirectory, "test/mocks/firebase-app.ts"),
      "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js": resolve(configDirectory, "test/mocks/firebase-auth.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [resolve(configDirectory, "vitest.setup.ts")],
    include: [
      "apps/web/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "Back-end/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "Front-end/**/*.{test,spec}.{js,jsx,ts,tsx}",
    ],
    exclude: ["**/node_modules/**", "apps/web/public/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      include: ["apps/web/**/*.{ts,tsx}", "Back-end/src/**/*.js", "Front-end/**/*.js"],
      exclude: ["**/*.{test,spec}.{js,jsx,ts,tsx}", "apps/web/next-env.d.ts", "**/.next/**"],
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: resolve(configDirectory, "coverage"),
    },
  },
});
