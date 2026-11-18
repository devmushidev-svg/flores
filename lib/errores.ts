import { toast } from "sonner"

/** Convierte errores de Supabase/red en un mensaje entendible para el usuario. */
export function mensajeError(error: unknown, porDefecto = "No se pudo guardar. Intenta de nuevo."): string {
  if (!error) return porDefecto
  const e = error as { code?: string; message?: string; name?: string }
  const msg = typeof e.message === "string" ? e.message : ""

  if (e.code === "23505") {
    if (msg.includes("codigo")) return "Ya existe un arreglo con ese código. Usa otro código."
    if (msg.includes("telefono")) return "Ya existe un cliente con ese teléfono."
    return "Ese registro ya existe (dato duplicado)."
  }
  if (e.code === "23514" && msg.includes("abono")) return "El abono no puede ser mayor que el precio total."
  if (e.code === "23503") return "No se puede eliminar porque está en uso en otro registro."
  if (e.name === "TypeError" && /fetch|network/i.test(msg)) return "Sin conexión a internet. Revisa la red e intenta de nuevo."
  if (msg) return msg
  return porDefecto
}

/** Muestra un aviso de error (toast) y lo registra en consola. */
export function avisarError(error: unknown, porDefecto?: string) {
  console.error(error)
  toast.error(mensajeError(error, porDefecto))
}
