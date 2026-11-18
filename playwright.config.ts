import { defineConfig, devices } from "@playwright/test"

// Pruebas E2E "de usuario común" contra un Supabase simulado (e2e/mock-supabase.mjs).
// Antes de correr:  pnpm build:e2e   (compila la app apuntando al mock)
// Correr:           pnpm test:e2e
const APP_PORT = 3100
const MOCK_PORT = 54321

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // el mock tiene una sola base en memoria
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "e2e-results/results.json" }]],
  outputDir: "e2e-results/artifacts",
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    ...devices["Pixel 7"], // la app es móvil (PWA)
    locale: "es-HN",
    timezoneId: "America/Tegucigalpa", // UTC-6, como la tienda
    trace: "off",
    serviceWorkers: "block",
  },
  webServer: [
    {
      command: `node e2e/mock-supabase.mjs`,
      url: `http://127.0.0.1:${MOCK_PORT}/__stats`,
      env: { MOCK_SUPABASE_PORT: String(MOCK_PORT) },
      reuseExistingServer: true,
    },
    {
      command: `pnpm exec next start -p ${APP_PORT}`,
      url: `http://127.0.0.1:${APP_PORT}/auth/login`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
