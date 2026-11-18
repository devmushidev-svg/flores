import { test, expect, resetDb, seedBasico, irA } from "./helpers"

// Recorrido 1: un usuario abre la app en su teléfono y visita cada sección.

const PAGINAS = [
  { path: "/", titulo: /Inicio|Hoy|Multiplanet|Resumen/i, nav: "Inicio" },
  { path: "/pedidos", titulo: /Pedidos/, nav: "Pedidos" },
  { path: "/flores", titulo: /Insumos/, nav: "Insumos" },
  { path: "/catalogo", titulo: /Cat.*logo de Arreglos/, nav: "Catálogo" },
  { path: "/reportes", titulo: /Reportes/, nav: "Reportes" },
  { path: "/calendario", titulo: /Entregas|Calendario/, nav: "Entregas" },
]

test.beforeEach(async () => {
  await resetDb(seedBasico())
})

for (const p of PAGINAS) {
  test(`la página ${p.path} carga sin errores de JavaScript`, async ({ page, jsErrors }) => {
    await irA(page, p.path)
    await expect(page.getByRole("heading").first()).toBeVisible()
    await expect(page.getByText("Error al cargar")).toHaveCount(0)
    expect(jsErrors, jsErrors.join("\n")).toEqual([])
  })
}

test("el título del catálogo se ve con acentos correctos (sin texto corrupto 'Ã¡')", async ({ page }) => {
  await irA(page, "/catalogo")
  await expect(page.getByRole("heading", { name: /Catálogo de Arreglos/ })).toBeVisible()
  await expect(page.getByText("Ã")).toHaveCount(0)
})

test("la barra de navegación inferior cabe en un teléfono pequeño (375px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 })
  await irA(page, "/")
  const nav = page.locator("nav").last()
  const box = await nav.boundingBox()
  const scrollW = await nav.evaluate((el) => (el.firstElementChild as HTMLElement).scrollWidth)
  expect(box).not.toBeNull()
  // Si el contenido es más ancho que la pantalla, algunos botones quedan cortados
  expect(scrollW, `ancho del menú ${scrollW}px > pantalla 375px`).toBeLessThanOrEqual(375)
  for (const item of PAGINAS) {
    const link = nav.getByRole("link", { name: item.nav })
    const b = await link.boundingBox()
    expect(b, `botón ${item.nav}`).not.toBeNull()
    expect(b!.x, `botón ${item.nav} se sale por la izquierda`).toBeGreaterThanOrEqual(0)
    expect(b!.x + b!.width, `botón ${item.nav} se sale por la derecha`).toBeLessThanOrEqual(375)
  }
})

test("se puede navegar entre secciones con el menú inferior", async ({ page, jsErrors }) => {
  await irA(page, "/")
  for (const p of PAGINAS.slice(1)) {
    await page.locator("nav").last().getByRole("link", { name: p.nav }).click()
    await expect(page).toHaveURL(new RegExp(p.path + "$"))
    await expect(page.getByRole("heading", { name: p.titulo }).first()).toBeVisible()
  }
  expect(jsErrors).toEqual([])
})
