# Auditoría de Multiplanet Floristería — noviembre 2026

Revisión del código, más pruebas automáticas que usan la app como lo haría una persona en el mostrador, en un teléfono.

**Cómo se probó:** Playwright (Chromium) emulando un Pixel 7, con zona horaria de Honduras (`America/Tegucigalpa`, UTC‑6). La app compilada para producción (`next build && next start`) se conecta a un **Supabase simulado** (`e2e/mock-supabase.mjs`) que reproduce PostgREST: relaciones, filtros, columnas generadas como `saldo`, restricciones `UNIQUE`/`CHECK` y gzip. Así las pruebas son repetibles y no tocan datos reales.

**Resultado:** 38 pruebas. 25 pasan y 13 fallan. Las 13 que fallan son **bugs reales**, no errores de la prueba.

---

## 1. Bugs encontrados (por prioridad)

### 🔴 Críticos: afectan pedidos o dinero

| # | Bug | Dónde | Prueba que lo detecta |
|---|-----|-------|-----------------------|
| B1 | **Fechas en UTC en lugar de la hora de Honduras.** Desde las 6:00 pm, "hoy" pasa a ser *mañana*. El Inicio muestra las entregas de mañana como si fueran de hoy, la lista de Pedidos abre en la fecha equivocada y **un pedido sin fecha creado de noche se guarda para el día siguiente**. Se usa `new Date().toISOString().split("T")[0]` en 15 lugares. | `dashboard-view.tsx`, `pedidos-list.tsx`, `calendario-view.tsx`, `lista-entregas-dia.tsx`, `reportes-view.tsx` | `04-fechas-reportes` (3 pruebas) |
| B2 | **El buscador de Pedidos tumba la pantalla entera.** Si algún pedido no tiene teléfono (`null`), al escribir cualquier letra sale el error `Cannot read properties of null (reading 'toLowerCase')` y la pantalla queda en blanco. TypeScript ya lo detecta, pero `ignoreBuildErrors: true` lo oculta. | `pedidos-list.tsx:221` | `03-pedidos` › buscar pedidos… |
| B3 | **Se aceptan saldos negativos.** Se puede abonar más que el total, tanto al crear el pedido como con el botón "Abonar". Queda guardado un saldo de -L300 / -L500 y los reportes de cobro salen mal. | `pedido-form.tsx`, `pedido-card.tsx` (`max` del input no se valida) | `03-pedidos` (2 pruebas) |
| B4 | **Proyección de flores incompleta.** El filtro busca `"En preparacion"` (sin tilde), pero el estado real es `"En preparación"`. Los pedidos en preparación **no cuentan** al calcular cuántas flores comprar. | `flores-list.tsx:69` | `02-flores-catalogo` › Proyección |
| B5 | **El "Saldo por cobrar" del día suma pedidos cancelados.** "Ingresos" también suma el abono de los cancelados. | `dashboard-view.tsx:80-81` | `04-fechas-reportes` › cancelados |

### 🟠 Altos: la app se queda trabada

| # | Bug | Dónde |
|---|-----|-------|
| B6 | **El Pedido rápido se queda en "Guardando..." para siempre** si falla la red: no hay `try/catch`, el usuario no recibe ningún aviso y el pedido no se guarda. | `quick-order-form.tsx` › `handleSubmit` |
| B7 | **Pasa lo mismo al guardar una flor o un arreglo:** el botón queda en "Guardando...", "Cancelar" queda deshabilitado y no aparece ningún mensaje. Ocurre, por ejemplo, con un **código de arreglo repetido** (`AR-001`). | `flor-form.tsx`, `arreglo-form.tsx`, `insumo-form.tsx` |
| B8 | Los botones de estado, abono, cancelar y eliminar de la tarjeta de pedido tampoco manejan errores. Si la petición falla, quedan deshabilitados. | `pedido-card.tsx` |

### 🟡 Medios: interfaz y datos

| # | Bug |
|---|-----|
| B9 | **Texto corrupto:** el título se ve como "CatÃ¡logo de Arreglos" (problema de codificación). Está en `catalogo-list.tsx` líneas 264, 275 y 381. |
| B10 | **El menú inferior no cabe en teléfonos de 375 px** (iPhone SE/mini): mide 392 px y el último botón ("Entregas") queda cortado. |
| B11 | **Abonos simultáneos se pueden perder:** el nuevo abono se calcula en el teléfono con datos en caché (`pedido.abono + monto`). Si dos personas abonan al mismo pedido a la vez, uno de los abonos se pierde. Conviene hacerlo en la base de datos (función RPC con `abono = abono + x`). |
| B12 | Al editar un arreglo se borran sus flores y luego se vuelven a insertar en dos pasos separados. Si el segundo paso falla, el arreglo queda sin flores, y el error del borrado no se revisa. |
| B13 | `userScalable: false` / `maximumScale: 1` impiden hacer zoom (problema de accesibilidad para personas con baja visión). |

### 🔐 Seguridad (importante)

| # | Hallazgo |
|---|----------|
| S1 | **Cualquiera puede leer, cambiar o borrar todos los datos.** Las políticas RLS son `USING (true)` para el rol anónimo, y la *anon key* viaja dentro del JavaScript público. Con esa llave cualquier persona puede descargar los nombres, teléfonos y direcciones de todos los clientes, o borrar los pedidos. Ya existen páginas de login (`/auth/login`), pero ninguna ruta las exige. **Recomendación:** exigir sesión con un middleware que redirija a `/auth/login` y cambiar las políticas a `TO authenticated`. |
| S2 | **`/api/import-remote` es un proxy abierto:** descarga cualquier URL sin autenticación, sigue redirecciones y no limita el tamaño. Se puede usar para SSRF o para consumir ancho de banda. **Recomendación:** pedir sesión, aceptar sólo dominios de Canva/Cloudinary y limitar el tamaño. |
| S3 | El preset de Cloudinary sin firma y el *cloud name* están escritos en el código como valor por defecto, así que cualquiera puede subir imágenes a esa cuenta. |

---

## 2. Rapidez del sistema (medido)

**Escenario:** 2 años de historial (≈2.980 pedidos, 4 por día), 80 arreglos, 600 clientes, red 4G (4 Mbps), 120 ms de latencia a Supabase y CPU 4× más lenta (teléfono de gama media). Para repetirlo: `pnpm test:perf`.

| Escenario | Tiempo | Datos descargados (gzip / sin comprimir) |
|---|---|---|
| Abrir **Inicio** | 2,8 s | 170 KB / **2,3 MB** |
| Abrir **Pedidos** | 2,6 s | 179 KB / 2,3 MB (3 peticiones) |
| Abrir **Reportes** | 2,4 s | 178 KB / 2,3 MB |
| Abrir **Entregas** | 1,8 s | 159 KB / 2,1 MB |
| Abrir **Catálogo** | 1,7 s | 9 KB / 71 KB |
| Menú → Pedidos (ya abierta la app) | 1,2 s | **vuelve a descargar 2,3 MB** |
| Menú → Reportes | 1,7 s | **vuelve a descargar 2,3 MB** |
| Pedidos → "ver todos" | **26,5 s** | 2.980 tarjetas en pantalla |
| Escribir 10 letras en el buscador (con "ver todos") | **85 s** | — |
| Animación: la tarjeta nº 100 aparece a los… | 5 s | (retraso de 50 ms × posición) |

JavaScript inicial por página: unos 490–620 KB (gzip). Las librerías pesadas (heic2any de 1,3 MB y pdf.js de 400 KB) ya se cargan sólo cuando se usan. Eso está bien.

### Diagnóstico
1. **Cada pantalla descarga todo el historial de pedidos** (`select *, arreglos(*)` sin filtro de fecha ni límite). El Inicio sólo usa hoy y mañana, pero baja 2 años. Esto empeora cada mes.
2. **Cada pantalla usa una clave SWR distinta** (`pedidos`, `pedidos-dashboard`, `reportes-pedidos`…), así que al moverse con el menú se vuelve a descargar lo mismo.
3. **Se dibujan todas las tarjetas a la vez** y cada letra del buscador vuelve a dibujar 3.000 tarjetas. A eso se suma una animación escalonada sin tope.
4. `arreglos(*)` trae todas las columnas del arreglo, incluida la descripción, cuando sólo se usan `nombre` y `foto_url`.
5. `next.config.mjs` tiene `images.unoptimized: true`, así que las fotos de Cloudinary bajan a tamaño completo aunque se muestren en 64×64.

---

## 3. Cómo optimizar (ordenado por impacto/esfuerzo)

### Rápido (1–2 horas, gran impacto)
1. **Filtrar en el servidor por fecha.**
   - Inicio: `.in("fecha_entrega", [hoy, manana])`. Pasa de 2,3 MB a pocos KB.
   - Pedidos: `.eq("fecha_entrega", filtroFecha)` cuando hay filtro. Con "ver todos", usar paginación (`.range(0, 49)`) y un botón "cargar más".
   - Entregas/Calendario: pedir sólo el mes visible con `.gte/.lte`.
   - Reportes: pedir sólo el periodo elegido.
2. **Pedir sólo las columnas necesarias:** `arreglos(nombre, foto_url, codigo)` en vez de `arreglos(*)`.
3. **Topar la animación:** `animationDelay: Math.min(idx, 8) * 50` en `pedidos-list`, `catalogo-list` y `flores-list`.
4. **Usar una función de "fecha local"** en `lib/fechas.ts`, por ejemplo con `format(new Date(), "yyyy-MM-dd")` de date-fns (ya instalado), y reemplazar los 15 `toISOString().split("T")[0]`. Esto también corrige B1.
5. **Quitar `ignoreBuildErrors: true`.** TypeScript ya avisaba del bug B2.

### Medio (medio día)
6. **Un solo hook `usePedidos(rango)`** compartido entre pantallas, con la misma clave SWR. Agregar un `SWRConfig` global con `dedupingInterval: 30000`, para que moverse con el menú sea instantáneo.
7. **Búsqueda con `useDeferredValue`** y, si hay "ver todos", buscar en el servidor (`.or("cliente.ilike.*x*,telefono.ilike.*x*")`).
8. **Autocompletar clientes en el servidor** (`.ilike("telefono", "x%").limit(8)`) en vez de descargar toda la tabla `clientes` cada vez que se abre un formulario.
9. **Fotos más ligeras:** usar URLs de Cloudinary con transformación (`/upload/w_160,h_160,c_fill,f_auto,q_auto/...`) en las miniaturas.

### Estructural
10. **Reportes en SQL:** crear una vista o función RPC que devuelva totales por periodo, en vez de calcularlos en el teléfono.
11. **Abonos atómicos:** función `registrar_abono(pedido_id, monto, metodo)` que valide `monto <= saldo` en la base de datos. Corrige B3 y B11.
12. **Restricción en la base de datos:** `CHECK (abono <= precio_total)`, como última defensa contra saldos negativos.
13. **Índice compuesto** `pedidos(fecha_entrega, estado)` para las consultas filtradas.
14. **Autenticación y RLS** (ver S1).

---

## 4. Cómo correr las pruebas

```bash
pnpm install
pnpm build:e2e        # compila la app apuntando al Supabase simulado
pnpm test:e2e         # todas las pruebas (≈5 min)
pnpm test:perf        # sólo rendimiento; resultado en e2e-results/rendimiento.json
```

Variables opcionales para la prueba de rendimiento: `PERF_LATENCY_MS` (120), `PERF_CPU` (4) y `PERF_DIAS` (730).

Cuando se corrija cada bug, su prueba pasará a verde. Así sirven como red de seguridad para no reintroducirlos.
