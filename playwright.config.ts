import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets several checkouts run the suite side by side.
const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * End-to-end tests run against the app in DEMO mode (no backend needed):
 * every test gets a fresh browser profile, hence fresh demo data.
 * The Supabase variables are blanked on purpose, even if .env.local has them.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-CA",
    timezoneId: "America/Toronto",
    viewport: { width: 1440, height: 900 },
    trace: "off",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
