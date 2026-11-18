import { test, expect, resetDb, seedBasico, getDb, irA, fechaLocal } from "./helpers"

// Recorrido 2: la dueña actualiza precios de flores y arma el catálogo.

test.describe("Flores e insumos", () => {
  test.beforeEach(async () => {
    await resetDb(seedBasico())
  })

  test("agregar, editar y eliminar una flor", async ({ page, jsErrors }) => {
    await irA(page, "/flores")
    await page.getByRole("button", { name: "Agregar" }).first().click()
    const d = page.getByRole("dialog")
    await d.locator("#nombre").fill("Tulipán")
    await d.locator("#precio").fill("55")
    await d.getByRole("button", { name: /Guardar|Agregar|Crear/ }).last().click()
    await expect(d).toBeHidden()
    await expect(page.getByText("Tulipán")).toBeVisible()

    const card = page.locator("[data-slot=card]").filter({ hasText: "Tulipán" })
    await card.getByRole("button", { name: "Editar" }).click()
    await page.getByRole("dialog").locator("#precio").fill("60")
    await page.getByRole("dialog").getByRole("button", { name: /Guardar|Actualizar/ }).click()
    await expect.poll(async () => (await getDb()).flores.find((f) => f.nombre === "Tulipán")!.precio_actual).toBe(60)

    await card.getByRole("button", { name: "Eliminar" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click()
    await expect(page.getByText("Tulipán")).toHaveCount(0)
    // Se desactiva (soft delete), no se borra: los arreglos que la usan siguen bien
    expect((await getDb()).flores.find((f) => f.nombre === "Tulipán")!.is_active).toBe(false)
    expect(jsErrors).toEqual([])
  })

  test("si guardar una flor falla, el formulario muestra el error y se puede reintentar", async ({ page, jsErrors }) => {
    await irA(page, "/flores")
    await page.route("**/rest/v1/flores*", (r) =>
      r.request().method() === "POST" ? r.fulfill({ status: 500, body: '{"message":"sin conexión"}' }) : r.continue(),
    )
    await page.getByRole("button", { name: "Agregar" }).first().click()
    const d = page.getByRole("dialog")
    await d.locator("#nombre").fill("Clavel")
    await d.locator("#precio").fill("10")
    const guardar = d.getByRole("button", { name: /Guardar|Agregar|Crear/ }).last()
    await guardar.click()
    await page.waitForTimeout(1000)
    await expect(d.getByText("Guardando..."), "el botón quedó bloqueado en 'Guardando...'").toHaveCount(0, { timeout: 3000 })
    await expect(guardar).toBeEnabled()
    expect(jsErrors.filter((e) => e.startsWith("pageerror")), "error no manejado").toEqual([])
  })

  test("Proyección: cuenta las flores de pedidos 'En preparación'", async ({ page }) => {
    const s = seedBasico()
    const hoy = fechaLocal()
    s.pedidos = [
      { cliente: "A", precio_total: 650, fecha_entrega: hoy, arreglo_id: "a-ramo12", estado: "Pendiente" },
      { cliente: "B", precio_total: 650, fecha_entrega: hoy, arreglo_id: "a-ramo12", estado: "En preparación" },
    ]
    await resetDb(s)
    await irA(page, "/flores")
    await page.getByRole("tab", { name: /Proyecci/ }).click()
    // 2 pedidos activos × 12 rosas = 24 rosas
    await expect(page.getByText(/2 pedidos activos/)).toBeVisible()
    await expect(page.getByText("24").first()).toBeVisible()
  })
})

test.describe("Catálogo de arreglos", () => {
  test.beforeEach(async () => {
    await resetDb(seedBasico())
  })

  test("crear un arreglo con flores y encontrarlo en la búsqueda", async ({ page, jsErrors }) => {
    await irA(page, "/catalogo")
    await page.getByRole("button", { name: "Nuevo", exact: true }).click()
    const d = page.getByRole("dialog")
    await d.locator("#codigo").fill("AR-010")
    await d.locator("#nombre").fill("Centro primaveral")
    await d.locator("#precio_real").fill("950")
    await d.getByRole("button", { name: /Guardar|Crear/ }).last().click()
    await expect(d).toBeHidden()
    await page.getByPlaceholder("Buscar por codigo, nombre, descripcion o categoria").fill("primaveral")
    await expect(page.getByText("Centro primaveral")).toBeVisible()
    await expect(page.getByText("Ramo 12 rosas")).toHaveCount(0)
    expect(jsErrors).toEqual([])
  })

  test("código duplicado: avisa al usuario y no deja el botón bloqueado", async ({ page, jsErrors }) => {
    await irA(page, "/catalogo")
    await page.getByRole("button", { name: "Nuevo", exact: true }).click()
    const d = page.getByRole("dialog")
    await d.locator("#codigo").fill("AR-001") // ya existe
    await d.locator("#nombre").fill("Otro ramo")
    await d.locator("#precio_real").fill("500")
    const guardar = d.getByRole("button", { name: /Guardar|Crear/ }).last()
    await guardar.click()
    await page.waitForTimeout(1000)
    // Se espera un mensaje visible (toast/alert) y poder corregir el código
    const avisado = jsErrors.some((e) => e.startsWith("dialog")) || (await page.getByText(/duplic|ya existe/i).count()) > 0
    expect(avisado, "el usuario no recibió ningún aviso del error").toBe(true)
    await expect(d.getByText("Guardando..."), "el botón quedó bloqueado en 'Guardando...'").toHaveCount(0, { timeout: 3000 })
    await expect(guardar).toBeEnabled()
  })

  test("duplicar un arreglo copia sus flores", async ({ page }) => {
    await irA(page, "/catalogo")
    const card = page.locator("[data-slot=card]").filter({ hasText: "Ramo 12 rosas" }).first()
    await card.getByRole("button", { name: "Duplicar" }).click()
    await expect.poll(async () => (await getDb()).arreglos.some((a) => a.nombre === "Ramo 12 rosas (copia)")).toBe(true)
    const db = await getDb()
    const copia = db.arreglos.find((a) => a.nombre === "Ramo 12 rosas (copia)")!
    expect(db.arreglo_flores.filter((af) => af.arreglo_id === copia.id)).toHaveLength(1)
  })
})
