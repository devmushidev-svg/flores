import { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import type { EstadoPedido, MetodoPago, Pedido } from "@/lib/types"

/**
 * Capa de datos de pedidos.
 *
 * Todas las consultas filtran en el servidor (por fecha, estado o búsqueda) en lugar
 * de descargar todo el historial. Las claves SWR empiezan con "pedidos" para poder
 * refrescar todas las vistas a la vez con `revalidarPedidos()` tras un cambio.
 */

/** Sólo las columnas del arreglo que usan las vistas de pedidos. */
export const PEDIDO_SELECT = "*, arreglos(id, codigo, nombre, foto_url, precio_real)"

export const PAGINA_PEDIDOS = 50

/** Refresca todas las vistas de pedidos en caché (Inicio, Pedidos, Entregas, Reportes...). */
export function revalidarPedidos() {
  return mutate((key) => Array.isArray(key) && key[0] === "pedidos")
}

/** Pedidos con fecha de entrega entre `desde` y `hasta` (incluidos). */
export async function fetchPedidosRango(
  desde: string,
  hasta: string,
  opciones: { excluirCancelados?: boolean } = {},
): Promise<Pedido[]> {
  const supabase = createClient()
  let query = supabase
    .from("pedidos")
    .select(PEDIDO_SELECT)
    .gte("fecha_entrega", desde)
    .lte("fecha_entrega", hasta)
  if (opciones.excluirCancelados) query = query.neq("estado", "Cancelado")
  const { data, error } = await query
    .order("fecha_entrega", { ascending: true })
    .order("hora_entrega", { ascending: true })
  if (error) throw error
  return (data as Pedido[]) || []
}

/** Cantidad de pedidos por día en un rango (sólo descarga la columna fecha). */
export async function fetchConteoPorFecha(
  desde: string,
  hasta: string,
  opciones: { excluirCancelados?: boolean } = {},
): Promise<Record<string, number>> {
  const supabase = createClient()
  let query = supabase
    .from("pedidos")
    .select("fecha_entrega")
    .gte("fecha_entrega", desde)
    .lte("fecha_entrega", hasta)
  if (opciones.excluirCancelados) query = query.neq("estado", "Cancelado")
  const { data, error } = await query
  if (error) throw error
  const conteo: Record<string, number> = {}
  for (const row of (data as { fecha_entrega: string | null }[]) || []) {
    if (!row.fecha_entrega) continue
    conteo[row.fecha_entrega] = (conteo[row.fecha_entrega] || 0) + 1
  }
  return conteo
}

/** Quita caracteres con significado especial en los filtros de PostgREST. */
function limpiarBusqueda(texto: string) {
  return texto.replace(/[,()*%\\:"]/g, " ").trim()
}

/**
 * Lista de pedidos sin filtro de fecha ("ver todos"): más recientes primero,
 * paginada, con estado y búsqueda resueltos en el servidor.
 */
export async function fetchPedidosLista(params: {
  limite: number
  estado: EstadoPedido | "todos"
  busqueda: string
  arregloIdsCoinciden?: string[]
}): Promise<Pedido[]> {
  const supabase = createClient()
  let query = supabase.from("pedidos").select(PEDIDO_SELECT)
  if (params.estado !== "todos") query = query.eq("estado", params.estado)
  const termino = limpiarBusqueda(params.busqueda)
  if (termino) {
    const condiciones = [`cliente.ilike.*${termino}*`, `telefono.ilike.*${termino}*`]
    const ids = (params.arregloIdsCoinciden || []).slice(0, 50)
    if (ids.length) condiciones.push(`arreglo_id.in.(${ids.join(",")})`)
    query = query.or(condiciones.join(","))
  }
  const { data, error } = await query
    .order("fecha_entrega", { ascending: false, nullsFirst: false })
    .order("hora_entrega", { ascending: true })
    .range(0, params.limite - 1)
  if (error) throw error
  return (data as Pedido[]) || []
}

/** Error con mensaje legible para mostrar al usuario. */
export class ErrorUsuario extends Error {}

/**
 * Registra un abono de forma atómica en la base de datos (función `registrar_abono`).
 * Si la función aún no existe (migración pendiente), usa una actualización normal
 * validando que el abono no supere el saldo.
 */
export async function registrarAbono(pedido: Pedido, monto: number, metodo: MetodoPago) {
  if (!Number.isFinite(monto) || monto <= 0) throw new ErrorUsuario("Ingresa un monto mayor que cero.")
  if (monto > pedido.saldo + 0.009) {
    throw new ErrorUsuario(`El abono no puede ser mayor que el saldo pendiente (L${pedido.saldo.toFixed(2)}).`)
  }
  const supabase = createClient()
  const { error } = await supabase.rpc("registrar_abono", {
    p_pedido_id: pedido.id,
    p_monto: monto,
    p_metodo: metodo,
  })
  if (!error) return
  // PGRST202 / 42883: la función no existe todavía en esta base de datos
  if (error.code !== "PGRST202" && error.code !== "42883") throw error

  const pagoEfectivo = (pedido.pago_efectivo ?? 0) + (metodo === "efectivo" ? monto : 0)
  const pagoTarjeta = (pedido.pago_tarjeta ?? 0) + (metodo === "tarjeta" ? monto : 0)
  const pagoTransferencia = (pedido.pago_transferencia ?? 0) + (metodo === "transferencia" ? monto : 0)
  const { error: updateError } = await supabase
    .from("pedidos")
    .update({
      abono: pagoEfectivo + pagoTarjeta + pagoTransferencia,
      pago_efectivo: pagoEfectivo,
      pago_tarjeta: pagoTarjeta,
      pago_transferencia: pagoTransferencia,
    })
    .eq("id", pedido.id)
  if (updateError) throw updateError
}
