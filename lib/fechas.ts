import { format } from "date-fns"

/**
 * Fechas en la zona horaria del dispositivo (la tienda está en Honduras, UTC-6).
 *
 * No usar `new Date().toISOString().split("T")[0]`: eso devuelve la fecha en UTC,
 * y desde las 6:00 pm en Honduras ya es "mañana" en UTC.
 */
export function fechaISO(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function hoyISO(): string {
  return fechaISO(new Date())
}

/** Fecha local de hoy desplazada `dias` días (negativo = pasado). */
export function diasDesdeHoyISO(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return fechaISO(d)
}

/** Primer y último día (YYYY-MM-DD) del mes que contiene `date`. */
export function rangoMesISO(date: Date): { desde: string; hasta: string } {
  const desde = new Date(date.getFullYear(), date.getMonth(), 1)
  const hasta = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { desde: fechaISO(desde), hasta: fechaISO(hasta) }
}
