/**
 * Devuelve una versión reducida de una foto de Cloudinary (recorte cuadrado,
 * formato y calidad automáticos). Para otras URLs devuelve la original.
 * Ej.: miniatura(url, 64) -> .../upload/w_128,h_128,c_fill,f_auto,q_auto/...
 */
export function miniatura(url: string | null | undefined, size: number): string | null {
  if (!url) return null
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url
  // Ya tiene transformación
  if (/\/upload\/[a-z]_[^/]*,/.test(url)) return url
  const px = Math.round(size * 2) // pantallas retina
  return url.replace("/upload/", `/upload/w_${px},h_${px},c_fill,f_auto,q_auto/`)
}
