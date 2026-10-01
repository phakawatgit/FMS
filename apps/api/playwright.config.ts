import { defineConfig } from "@playwright/test";

const testDatabaseUrl = process.env.FMS_TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("Set FMS_TEST_DATABASE_URL to a disposable PostgreSQL database before running API E2E tests.");
}
const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\//, ""));
if (!/(?:^|[_-])test(?:$|[_-])/i.test(databaseName)) {
  throw new Error(`Refusing to run E2E tests against "${databaseName}". Use a database such as fms_test.`);
}

const port = 4112;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: "npm run dev",
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      API_PORT: String(port),
    },
  },
});
