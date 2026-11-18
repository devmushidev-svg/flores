import fs from "node:fs"
import path from "node:path"
import { test, expect, resetDb, getStats, clearStats, irA, fechaLocal, type Seed } from "./helpers"
import type { Page } from "@playwright/test"

// Medición de rapidez con datos realistas:
//  - ~2 años de historial (≈ 4 pedidos/día ≈ 2.900 pedidos), 80 arreglos, 40 flores, 600 clientes
//  - latencia de red simulada hacia Supabase (por petición)
//  - CPU de teléfono de gama media (throttling 4x)
// Resultado: e2e-results/rendimiento.json + tabla en consola.

const LATENCIA_MS = Number(process.env.PERF_LATENCY_MS || 120)
const DIAS_HISTORIAL = Number(process.env.PERF_DIAS || 730)
const PEDIDOS_POR_DIA = 4
const CPU_THROTTLE = Number(process.env.PERF_CPU || 4)
// Red móvil 4G "regular": 4 Mbps bajada, 1 Mbps subida, 80 ms de latencia extra
const RED = { offline: false, latency: 80, downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (1024 * 1024) / 8 }

function seedGrande(): Seed {
  const flores = Array.from({ length: 40 }, (_, i) => ({ id: `f${i}`, nombre: `Flor ${i}`, precio_actual: 10 + i }))
  const arreglos = Array.from({ length: 80 }, (_, i) => ({
    id: `a${i}`,
    codigo: `AR-${String(i).padStart(3, "0")}`,
    nombre: `Arreglo ${i}`,
    descripcion: "Descripción de prueba del arreglo con varias palabras para simular texto real",
    foto_url: null,
    precio_real: 300 + i * 10,
    categoria: "Ramo",
  }))
  const arreglo_flores = arreglos.flatMap((a, i) =>
    [0, 1, 2].map((k) => ({ arreglo_id: a.id, flor_id: `f${(i + k) % 40}`, cantidad: 3 + k })),
  )
  const clientes = Array.from({ length: 600 }, (_, i) => ({
    telefono: String(90000000 + i),
    nombre: `Cliente ${i}`,
    direccion: `Colonia ${i % 50}, casa ${i}`,
  }))
  const pedidos: Record<string, unknown>[] = []
  for (let d = -DIAS_HISTORIAL; d <= 14; d++) {
    const fecha = fechaLocal(d)
    for (let k = 0; k < PEDIDOS_POR_DIA; k++) {
      const n = pedidos.length
      const pasado = d < 0
      pedidos.push({
        cliente: `Cliente ${n % 600}`,
        telefono: String(90000000 + (n % 600)),
        direccion: `Colonia ${n % 50}`,
        domicilio: `Hospital ${n % 7}`,
        fecha_entrega: fecha,
        hora_entrega: `${String(8 + k * 2).padStart(2, "0")}:00:00`,
        arreglo_id: `a${n % 80}`,
        descripcion: "Colores pastel, sin lirios",
        mensaje_tarjeta: "Con mucho cariño de toda la familia",
        precio_total: 500,
        abono: pasado ? 500 : 200,
        pago_efectivo: pasado ? 500 : 200,
        estado: pasado ? (n % 15 === 0 ? "Cancelado" : "Entregado") : "Pendiente",
      })
    }
  }
  return { flores, arreglos, arreglo_flores, clientes, pedidos }
}

type Medicion = {
  escenario: string
  ms_hasta_contenido: number
  peticiones_supabase: number
  kb_json_supabase: number
  kb_json_gzip: number
  kb_js_descargado: number
  detalle_peticiones: string[]
}

const resultados: Medicion[] = []

async function medir(page: Page, escenario: string, accion: () => Promise<void>, listo: () => Promise<void>) {
  await clearStats()
  let jsBytes = 0
  const onResp = async (r: import("@playwright/test").Response) => {
    if (r.url().includes("/_next/static/") && r.url().endsWith(".js")) {
      try {
        jsBytes += (await r.request().sizes()).responseBodySize
      } catch {}
    }
  }
  page.on("response", onResp)
  const t0 = Date.now()
  await accion()
  await listo()
  const ms = Date.now() - t0
  await page.waitForLoadState("networkidle")
  page.off("response", onResp)
  const st = (await getStats()).filter((s) => s.method !== "OPTIONS")
  resultados.push({
    escenario,
    ms_hasta_contenido: ms,
    peticiones_supabase: st.length,
    kb_json_supabase: Math.round(st.reduce((a, s) => a + s.bytes, 0) / 1024),
    kb_json_gzip: Math.round(st.reduce((a, s) => a + (s.gzipBytes || 0), 0) / 1024),
    kb_js_descargado: Math.round(jsBytes / 1024),
    detalle_peticiones: st.map((s) => `${s.method} ${s.path} ${Math.round(s.bytes / 1024)}KB`),
  })
}

test.describe.configure({ mode: "serial" })

test.describe("Rendimiento con 2 años de datos", () => {
  test.setTimeout(240_000)

  test.beforeAll(async () => {
    await resetDb(seedGrande(), LATENCIA_MS)
  })

  test.beforeEach(async ({ page }) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE })
    await cdp.send("Network.enable")
    await cdp.send("Network.emulateNetworkConditions", RED)
    await page.route(/vercel-insights|_vercel\/insights/, (r) => r.fulfill({ status: 204 }))
  })

  test("carga inicial (en frío) de cada pantalla", async ({ page }) => {
    const pantallas: [string, string, RegExp][] = [
      ["/", "Inicio", /Multiplanet/],
      ["/pedidos", "Pedidos", /Pedidos/],
      ["/calendario", "Entregas", /Calendario de Entregas/],
      ["/reportes", "Reportes", /Reportes/],
      ["/catalogo", "Catálogo", /Arreglos/],
      ["/flores", "Insumos", /Insumos/],
    ]
    for (const [url, nombre, titulo] of pantallas) {
      await page.context().clearCookies()
      await medir(
        page,
        `Abrir ${nombre} (frío)`,
        () => page.goto(url).then(() => undefined),
        async () => {
          await expect(page.getByRole("heading", { name: titulo }).first()).toBeVisible({ timeout: 60_000 })
          // contenido real: desaparece el spinner de carga
          await expect(page.locator("svg.animate-spin")).toHaveCount(0, { timeout: 60_000 })
        },
      )
    }
  })

  test("navegar con el menú: Inicio → Pedidos → Entregas → Reportes → Inicio", async ({ page }) => {
    await irA(page, "/")
    for (const [nav, titulo] of [
      ["Pedidos", /Pedidos/],
      ["Entregas", /Calendario de Entregas/],
      ["Reportes", /Reportes/],
      ["Inicio", /Multiplanet/],
    ] as const) {
      await medir(
        page,
        `Menú → ${nav}`,
        () => page.locator("nav").last().getByRole("link", { name: nav }).click(),
        async () => {
          await expect(page.getByRole("heading", { name: titulo }).first()).toBeVisible({ timeout: 60_000 })
          await expect(page.locator("svg.animate-spin")).toHaveCount(0, { timeout: 60_000 })
        },
      )
    }
  })

  test("Pedidos → 'Ver todos' y búsqueda", async ({ page }) => {
    await irA(page, "/pedidos")
    await medir(
      page,
      "Pedidos: quitar filtro de fecha (ver todos)",
      () => page.locator("button:has(svg.lucide-x)").first().click(),
      async () => {
        // La lista debe mostrar pedidos (la primera página) y terminar de cargar
        await expect(page.locator("[data-slot=card]").nth(20)).toBeAttached({ timeout: 120_000 })
        await expect(page.locator("svg.animate-spin")).toHaveCount(0, { timeout: 120_000 })
      },
    )
    const total = await page.locator("[data-slot=card]").count()
    const ultima = page.locator(".animate-fade-in-up").last()
    const delay = await ultima.evaluate((el) => (el as HTMLElement).style.animationDelay || "0ms")
    resultados.push({
      escenario: `Pedidos: ${total} tarjetas en el DOM; la última aparece tras ${delay}`,
      ms_hasta_contenido: parseInt(delay) || 0,
      peticiones_supabase: 0,
      kb_json_supabase: 0,
      kb_json_gzip: 0,
      kb_js_descargado: 0,
      detalle_peticiones: [],
    })
    // Escribir en el buscador (con "ver todos" activo)
    const input = page.getByPlaceholder("Buscar por cliente, teléfono o arreglo...")
    await medir(
      page,
      "Pedidos: teclear 10 letras en el buscador y ver resultados",
      async () => {
        await input.pressSequentially("Cliente 12", { delay: 0 })
        await expect(input).toHaveValue("Cliente 12")
      },
      async () => {
        await expect(page.locator("[data-slot=card]").first()).toContainText("Cliente 12", { timeout: 120_000 })
      },
    )
  })

  test("abrir formulario 'Nuevo pedido'", async ({ page }) => {
    await irA(page, "/pedidos")
    await medir(
      page,
      "Abrir 'Nuevo pedido'",
      () => page.getByRole("button", { name: "Nuevo", exact: true }).click(),
      () => expect(page.getByRole("dialog")).toBeVisible(),
    )
  })

  test.afterAll(async () => {
    const out = path.join("e2e-results", "rendimiento.json")
    fs.mkdirSync("e2e-results", { recursive: true })
    fs.writeFileSync(
      out,
      JSON.stringify({ latencia_ms: LATENCIA_MS, cpu_throttle: CPU_THROTTLE, dias: DIAS_HISTORIAL, resultados }, null, 2),
    )
    console.log(`\nRENDIMIENTO (red 4G 4Mbps, latencia servidor ${LATENCIA_MS}ms, CPU ${CPU_THROTTLE}x más lenta)`)
    console.table(
      resultados.map((r) => ({
        escenario: r.escenario,
        ms: r.ms_hasta_contenido,
        peticiones: r.peticiones_supabase,
        "KB datos (sin comprimir)": r.kb_json_supabase,
        "KB datos (gzip)": r.kb_json_gzip,
        "KB JS": r.kb_js_descargado,
      })),
    )
  })
})
