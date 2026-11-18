import { test as base, expect, type Page } from "@playwright/test"

export const MOCK = "http://127.0.0.1:54321"

type Row = Record<string, unknown>
export type Seed = Partial<Record<
  "clientes" | "flores" | "insumos" | "arreglos" | "arreglo_flores" | "arreglo_insumos" | "pedidos",
  Row[]
>>

export async function resetDb(seed: Seed = {}, latencyMs = 0) {
  const r = await fetch(`${MOCK}/__reset`, {
    method: "POST",
    body: JSON.stringify({ seed, latencyMs }),
  })
  if (!r.ok) throw new Error("No se pudo reiniciar el mock")
}

export async function getDb(): Promise<Record<string, Row[]>> {
  return (await fetch(`${MOCK}/__db`)).json()
}

export type ReqStat = { method: string; path: string; query: string; status: number; bytes: number; gzipBytes: number; ms: number }
export async function getStats(): Promise<ReqStat[]> {
  return (await (await fetch(`${MOCK}/__stats`)).json()).requests
}
export async function clearStats() {
  await fetch(`${MOCK}/__stats/clear`)
}

/** Fecha YYYY-MM-DD en la zona horaria de la tienda (Honduras, UTC-6). */
export function fechaLocal(offsetDays = 0, now = new Date()) {
  const d = new Date(now.getTime() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tegucigalpa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

/** Datos base: un catálogo pequeño y realista. */
export function seedBasico(): Seed {
  return {
    flores: [
      { id: "f-rosa", nombre: "Rosa roja", precio_actual: 25 },
      { id: "f-girasol", nombre: "Girasol", precio_actual: 40 },
      { id: "f-lirio", nombre: "Lirio", precio_actual: 35 },
    ],
    insumos: [{ id: "i-cinta", nombre: "Cinta satinada", precio_actual: 15, unidad: "metro" }],
    arreglos: [
      { id: "a-ramo12", codigo: "AR-001", nombre: "Ramo 12 rosas", descripcion: "Clásico", precio_real: 650, categoria: "Ramo" },
      { id: "a-girasoles", codigo: "AR-002", nombre: "Caja de girasoles", descripcion: "Alegre", precio_real: 800, categoria: "Aniversario" },
    ],
    arreglo_flores: [
      { arreglo_id: "a-ramo12", flor_id: "f-rosa", cantidad: 12 },
      { arreglo_id: "a-girasoles", flor_id: "f-girasol", cantidad: 6 },
    ],
    clientes: [{ telefono: "99887766", nombre: "María López", direccion: "Col. Palmira, Tegucigalpa" }],
  }
}

/**
 * Fixture que registra errores de JS y de consola en cada prueba.
 * Así cualquier pantalla que "explote" queda reportada aunque la prueba siga.
 */
export const test = base.extend<{ jsErrors: string[] }>({
  jsErrors: async ({ page }, use, testInfo) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`)
    })
    // Las alertas nativas (window.alert) se aceptan y se registran
    page.on("dialog", async (d) => {
      errors.push(`dialog(${d.type()}): ${d.message()}`)
      await d.dismiss().catch(() => {})
    })
    // Evitar llamadas reales a servicios externos durante las pruebas
    await page.route(/vercel-insights|_vercel\/insights|va\.vercel-scripts/, (r) => r.fulfill({ status: 204 }))
    await use(errors)
    if (errors.length) {
      await testInfo.attach("errores-js", { body: errors.join("\n"), contentType: "text/plain" })
    }
  },
})

export { expect }

export async function irA(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState("networkidle")
}
