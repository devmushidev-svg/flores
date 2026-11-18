import { test, expect, resetDb, seedBasico, getDb, irA, fechaLocal } from "./helpers"

// Recorrido 4: uso en la noche (después de las 6 pm en Honduras = medianoche UTC)
// y revisión de reportes al cierre del día.

// 17 nov 2026, 7:30 pm hora de Honduras (= 18 nov 01:30 UTC)
const NOCHE = new Date("2026-11-17T19:30:00-06:00")
const HOY = "2026-11-17"
const MANANA = "2026-11-18"

test.describe("Fechas en horario nocturno (UTC-6)", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setSystemTime(NOCHE)
  })

  test("el panel de Inicio muestra los pedidos de HOY, no los de mañana", async ({ page }) => {
    const s = seedBasico()
    s.pedidos = [
      { cliente: "Entrega de hoy", precio_total: 500, fecha_entrega: HOY, estado: "Pendiente" },
      { cliente: "Entrega de mañana", precio_total: 500, fecha_entrega: MANANA, estado: "Pendiente" },
    ]
    await resetDb(s)
    await irA(page, "/")
    await expect(page.getByText("Entrega de hoy")).toBeVisible()
    await expect(page.getByText("Entrega de mañana")).toHaveCount(0)
  })

  test("la lista de Pedidos abre filtrada en la fecha local de hoy", async ({ page }) => {
    const s = seedBasico()
    s.pedidos = [{ cliente: "Entrega de hoy", precio_total: 500, fecha_entrega: HOY }]
    await resetDb(s)
    await irA(page, "/pedidos")
    await expect(page.getByText("Entrega de hoy")).toBeVisible()
  })

  test("un pedido sin fecha creado a las 7:30 pm queda para hoy", async ({ page }) => {
    await resetDb(seedBasico())
    await irA(page, "/pedidos")
    await page.getByRole("button", { name: "Nuevo", exact: true }).click()
    const d = page.getByRole("dialog")
    await d.locator("#cliente").fill("Cliente nocturno")
    await d.locator("#precio").fill("300")
    await d.getByRole("button", { name: /Crear pedido|Guardar/ }).click()
    await expect(d).toBeHidden()
    const p = (await getDb()).pedidos.find((x) => x.cliente === "Cliente nocturno")!
    expect(p.fecha_entrega).toBe(HOY)
  })
})

test.describe("Reportes", () => {
  test("con pedidos pero ninguno entregado, el promedio no muestra NaN", async ({ page, jsErrors }) => {
    const s = seedBasico()
    s.pedidos = [{ cliente: "Pendiente 1", precio_total: 500, fecha_entrega: fechaLocal(), estado: "Pendiente" }]
    await resetDb(s)
    await irA(page, "/reportes")
    await expect(page.getByText("Reportes").first()).toBeVisible()
    await expect(page.getByText(/NaN|Infinity/)).toHaveCount(0)
    expect(jsErrors).toEqual([])
  })

  test("los pedidos cancelados no suman a 'Saldo por cobrar' del día en Inicio", async ({ page }) => {
    const s = seedBasico()
    const hoy = fechaLocal()
    s.pedidos = [
      { cliente: "Activo", precio_total: 500, abono: 100, fecha_entrega: hoy, estado: "Pendiente" },
      { cliente: "Cancelado", precio_total: 900, abono: 0, fecha_entrega: hoy, estado: "Cancelado" },
    ]
    await resetDb(s)
    await irA(page, "/")
    // Saldo real por cobrar: 400 (el cancelado no se cobra)
    await expect(page.getByText(/L\s?1,?300/)).toHaveCount(0)
  })
})
