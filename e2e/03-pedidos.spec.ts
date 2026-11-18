import { test, expect, resetDb, seedBasico, getDb, irA, fechaLocal } from "./helpers"
import type { Page } from "@playwright/test"

// Recorrido 3: la persona de mostrador toma pedidos, cobra y entrega.

const dialogo = (page: Page) => page.getByRole("dialog")

async function abrirNuevoPedido(page: Page) {
  await irA(page, "/pedidos")
  await page.getByRole("button", { name: "Nuevo", exact: true }).click()
  await expect(dialogo(page)).toBeVisible()
}

test.describe("Pedido completo (formulario Nuevo)", () => {
  test.beforeEach(async () => {
    await resetDb(seedBasico())
  })

  test("crear un pedido con arreglo, abono dividido y cliente nuevo", async ({ page, jsErrors }) => {
    const hoy = fechaLocal()
    await abrirNuevoPedido(page)
    const d = dialogo(page)
    await d.locator("#telefono").fill("33445566")
    await d.locator("#cliente").fill("Carlos Pérez")
    await d.locator("#direccion").fill("Res. Las Uvas")
    await d.locator("#domicilio").fill("Hospital Escuela, sala 3")
    await d.locator("#fecha").fill(hoy)
    await d.locator("#hora").fill("15:30")

    // Elegir arreglo del catálogo
    await d.getByRole("button", { name: /Seleccionar arreglo|Elegir arreglo|arreglo/i }).first().click()
    const selector = page.getByRole("dialog", { name: "Seleccionar Arreglo" })
    await selector.getByText("Ramo 12 rosas").click()
    await expect(selector).toBeHidden()
    // El precio se autocompleta con el del arreglo
    await expect(d.locator("#precio")).toHaveValue("650")

    await d.locator("#mensaje").fill("¡Feliz cumpleaños!")
    await d.locator("#pago-efectivo").fill("200")
    await d.locator("#pago-tarjeta").fill("100")

    await d.getByRole("button", { name: /Crear pedido|Guardar/ }).click()
    await expect(d).toBeHidden()

    // Aparece en la lista (filtro por defecto: hoy)
    const card = page.locator("div.rounded-xl, [data-slot=card]").filter({ hasText: "Carlos Pérez" }).first()
    await expect(card).toBeVisible()
    await expect(card).toContainText("Ramo 12 rosas")

    const db = await getDb()
    const p = db.pedidos.find((x) => x.cliente === "Carlos Pérez")!
    expect(p).toMatchObject({
      fecha_entrega: hoy,
      precio_total: 650,
      abono: 300,
      pago_efectivo: 200,
      pago_tarjeta: 100,
      saldo: 350,
      domicilio: "Hospital Escuela, sala 3",
      arreglo_id: "a-ramo12",
    })
    // El cliente queda guardado para autocompletar la próxima vez
    expect(db.clientes.some((c) => c.telefono === "33445566" && c.nombre === "Carlos Pérez")).toBe(true)
    expect(jsErrors).toEqual([])
  })

  test("autocompletar cliente existente al escribir el teléfono", async ({ page }) => {
    await abrirNuevoPedido(page)
    const d = dialogo(page)
    await d.locator("#telefono").fill("9988")
    await d.getByRole("button", { name: /María López/ }).click()
    await expect(d.locator("#cliente")).toHaveValue("María López")
    await expect(d.locator("#domicilio")).toHaveValue("Col. Palmira, Tegucigalpa")
  })

  test("no permite abonar más que el precio total (saldo negativo)", async ({ page }) => {
    await abrirNuevoPedido(page)
    const d = dialogo(page)
    await d.locator("#cliente").fill("Prueba Sobrepago")
    await d.locator("#precio").fill("500")
    await d.locator("#pago-efectivo").fill("800")
    await d.getByRole("button", { name: /Crear pedido|Guardar/ }).click()
    await page.waitForTimeout(1000)
    const db = await getDb()
    const p = db.pedidos.find((x) => x.cliente === "Prueba Sobrepago")
    // Comportamiento esperado: rechazar o advertir; nunca guardar saldo negativo
    expect(p?.saldo ?? 0, "se guardó un pedido con saldo negativo").toBeGreaterThanOrEqual(0)
  })

  test("si el servidor falla al guardar, se informa y el formulario no queda bloqueado", async ({ page, jsErrors }) => {
    await abrirNuevoPedido(page)
    await page.route("**/rest/v1/pedidos*", (r) =>
      r.request().method() === "POST"
        ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "fallo de red simulado" }) })
        : r.continue(),
    )
    const d = dialogo(page)
    await d.locator("#cliente").fill("Cliente Error")
    await d.locator("#precio").fill("300")
    await d.getByRole("button", { name: /Crear pedido|Guardar/ }).click()
    await expect.poll(() => jsErrors.some((e) => e.includes("fallo de red simulado"))).toBe(true)
    // El botón debe volver a estar disponible para reintentar
    await expect(d.getByRole("button", { name: /Crear pedido|Guardar/ })).toBeEnabled()
  })
})

test.describe("Pedido rápido (3 pasos)", () => {
  test.beforeEach(async () => {
    await resetDb(seedBasico())
  })

  test("cliente existente → arreglo → abono", async ({ page, jsErrors }) => {
    await irA(page, "/pedidos")
    await page.getByRole("button", { name: "Rápido" }).click()
    const d = dialogo(page)
    await expect(d).toContainText("Paso 1/3")
    await d.getByPlaceholder("9999-9999").fill("9988")
    await d.getByRole("button", { name: /María López/ }).click()
    await expect(d).toContainText("Paso 2/3")
    await d.getByText("Caja de girasoles").click()
    await expect(d).toContainText("Paso 3/3")
    await d.getByPlaceholder("0.00").fill("400")
    await d.getByRole("button", { name: /Crear|Guardar|Confirmar/ }).last().click()
    await expect(d).toBeHidden()
    const db = await getDb()
    const p = db.pedidos.find((x) => x.cliente === "María López")!
    expect(p).toMatchObject({ precio_total: 800, abono: 400, saldo: 400, arreglo_id: "a-girasoles" })
    expect(jsErrors).toEqual([])
  })

  test("si el guardado falla, el botón no se queda en 'Guardando...' para siempre", async ({ page, jsErrors }) => {
    await irA(page, "/pedidos")
    await page.route("**/rest/v1/pedidos*", (r) =>
      r.request().method() === "POST" ? r.fulfill({ status: 500, body: "{}" }) : r.continue(),
    )
    await page.getByRole("button", { name: "Rápido" }).click()
    const d = dialogo(page)
    await d.getByPlaceholder("9999-9999").fill("9988")
    await d.getByRole("button", { name: /María López/ }).click()
    await d.getByText("Caja de girasoles").click()
    await d.getByRole("button", { name: /Crear|Guardar|Confirmar/ }).last().click()
    await page.waitForTimeout(1500)
    await expect(d.getByText("Guardando...")).toHaveCount(0)
    expect(jsErrors.join("\n")).not.toMatch(/Unhandled|Uncaught/)
  })
})

test.describe("Gestión de pedidos existentes", () => {
  const hoy = fechaLocal()
  const base = (extra: Record<string, unknown>) => ({
    cliente: "Ana",
    telefono: "99001122",
    fecha_entrega: hoy,
    precio_total: 1000,
    abono: 0,
    arreglo_id: "a-ramo12",
    ...extra,
  })

  test.beforeEach(async () => {
    const s = seedBasico()
    s.pedidos = [
      base({ id: "p1", cliente: "Ana Martínez", hora_entrega: "10:00:00" }),
      base({ id: "p2", cliente: "Pedido Mostrador", telefono: null, hora_entrega: "11:00:00" }),
    ]
    await resetDb(s)
  })

  test("avanzar estados: Pendiente → En preparación → En ruta → Entregado", async ({ page, jsErrors }) => {
    await irA(page, "/pedidos")
    const card = page.locator("[data-slot=card]").filter({ hasText: "Ana Martínez" })
    await card.getByRole("button", { name: "En preparación" }).click()
    await expect(card.getByText("En preparación").first()).toBeVisible()
    await card.getByRole("button", { name: "En ruta" }).click()
    await expect(card.getByRole("button", { name: "En ruta" })).toHaveCount(0)
    await card.getByRole("button", { name: "Entregado" }).click()
    await expect.poll(async () => (await getDb()).pedidos.find((p) => p.id === "p1")!.estado).toBe("Entregado")
    expect(jsErrors).toEqual([])
  })

  test("registrar abonos por método de pago", async ({ page }) => {
    await irA(page, "/pedidos")
    const card = page.locator("[data-slot=card]").filter({ hasText: "Ana Martínez" })
    await card.getByRole("button", { name: "Abonar" }).click()
    const d = page.getByRole("dialog", { name: /Registrar Abono/ })
    await d.getByRole("button", { name: "Transferencia" }).click()
    await d.getByRole("button", { name: "L500" }).click()
    await d.getByRole("button", { name: /Registrar|Confirmar|Abonar/ }).last().click()
    await expect(d).toBeHidden()
    await expect.poll(async () => (await getDb()).pedidos.find((p) => p.id === "p1")).toMatchObject({
      abono: 500,
      pago_transferencia: 500,
      saldo: 500,
    })
  })

  test("un abono mayor al saldo no debe dejar saldo negativo", async ({ page }) => {
    await irA(page, "/pedidos")
    const card = page.locator("[data-slot=card]").filter({ hasText: "Ana Martínez" })
    await card.getByRole("button", { name: "Abonar" }).click()
    const d = page.getByRole("dialog", { name: /Registrar Abono/ })
    await d.locator("#payment-amount").fill("1500")
    await d.getByRole("button", { name: /Registrar|Confirmar|Abonar/ }).last().click()
    await page.waitForTimeout(800)
    const p = (await getDb()).pedidos.find((x) => x.id === "p1")!
    expect(p.saldo as number, "saldo negativo guardado").toBeGreaterThanOrEqual(0)
  })

  test("cancelar un pedido desde la tarjeta", async ({ page }) => {
    await irA(page, "/pedidos")
    const card = page.locator("[data-slot=card]").filter({ hasText: "Ana Martínez" })
    await card.getByRole("button", { name: "Cancelar" }).click()
    await expect.poll(async () => (await getDb()).pedidos.find((p) => p.id === "p1")!.estado).toBe("Cancelado")
  })

  test("eliminar un pedido pide confirmación", async ({ page }) => {
    await irA(page, "/pedidos")
    const card = page.locator("[data-slot=card]").filter({ hasText: "Ana Martínez" })
    await card.getByRole("button", { name: "Eliminar" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click()
    await expect.poll(async () => (await getDb()).pedidos.some((p) => p.id === "p1")).toBe(false)
  })

  test("editar un pedido conserva el abono y cambia la hora", async ({ page }) => {
    await irA(page, "/pedidos")
    const card = page.locator("[data-slot=card]").filter({ hasText: "Ana Martínez" })
    await card.getByRole("button", { name: "Editar" }).click()
    const d = dialogo(page)
    await expect(d.locator("#cliente")).toHaveValue("Ana Martínez")
    await d.locator("#hora").fill("16:45")
    await d.getByRole("button", { name: /Guardar|Actualizar/ }).click()
    await expect(d).toBeHidden()
    await expect.poll(async () => (await getDb()).pedidos.find((p) => p.id === "p1")!.hora_entrega).toMatch(/^16:45/)
  })

  test("buscar pedidos cuando algún pedido no tiene teléfono no rompe la pantalla", async ({ page, jsErrors }) => {
    await irA(page, "/pedidos")
    await page.getByPlaceholder("Buscar por cliente, teléfono o arreglo...").fill("ana")
    await expect(page.getByText("Ana Martínez")).toBeVisible()
    expect(jsErrors.join("\n")).not.toMatch(/toLowerCase/)
  })

  test("la lista de 'hoy' sólo muestra pedidos de hoy y muestra la hora", async ({ page }) => {
    await irA(page, "/pedidos")
    await expect(page.getByText("Ana Martínez")).toBeVisible()
    await expect(page.getByText("10:00 am").first()).toBeVisible()
  })
})
