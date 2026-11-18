import { NextResponse } from "next/server"

// Sólo se descargan archivos de servicios conocidos (antes cualquier URL: proxy abierto / SSRF)
const DOMINIOS_PERMITIDOS = [
  "canva.com",
  "canva.site",
  "canva.link",
  "cloudinary.com",
  "dropbox.com",
  "dropboxusercontent.com",
  "drive.google.com",
  "googleusercontent.com",
]
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB
const MAX_REDIRECCIONES = 5
const TIMEOUT_MS = 20_000

function dominioPermitido(url: URL) {
  if (url.protocol !== "https:") return false
  if (url.port && url.port !== "443") return false
  const host = url.hostname.toLowerCase()
  return DOMINIOS_PERMITIDOS.some((d) => host === d || host.endsWith(`.${d}`))
}

function getFilenameFromUrl(url: string, contentType: string | null) {
  try {
    const pathname = new URL(url).pathname
    const lastSegment = pathname.split("/").filter(Boolean).pop()
    if (lastSegment && /\.[a-z0-9]+$/i.test(lastSegment)) {
      return decodeURIComponent(lastSegment).replace(/["\r\n]/g, "")
    }
  } catch {
    // Fall back to content type based naming below.
  }

  if (contentType?.includes("pdf")) return "catalogo-canva.pdf"
  if (contentType?.includes("png")) return "catalogo-canva.png"
  if (contentType?.includes("webp")) return "catalogo-canva.webp"
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "catalogo-canva.jpg"
  return "catalogo-canva"
}

/** Sigue las redirecciones manualmente, validando el dominio de cada salto. */
async function descargar(url: URL, signal: AbortSignal) {
  let actual = url
  for (let i = 0; i <= MAX_REDIRECCIONES; i++) {
    if (!dominioPermitido(actual)) return { error: "Dominio no permitido", status: 400 as const }
    const res = await fetch(actual.toString(), {
      headers: { Accept: "application/pdf,image/*,*/*" },
      redirect: "manual",
      signal,
    })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (!location) return { error: "Redirección inválida", status: 400 as const }
      actual = new URL(location, actual)
      continue
    }
    return { res, finalUrl: actual }
  }
  return { error: "Demasiadas redirecciones", status: 400 as const }
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL requerida" }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: "URL invalida" }, { status: 400 })
    }

    if (!dominioPermitido(parsedUrl)) {
      return NextResponse.json(
        { error: "Solo se permiten enlaces https de Canva, Cloudinary, Dropbox o Google Drive." },
        { status: 400 }
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const result = await descargar(parsedUrl, controller.signal)
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      const { res: remoteResponse, finalUrl } = result

      if (!remoteResponse.ok) {
        return NextResponse.json(
          { error: `No se pudo descargar el archivo (${remoteResponse.status})` },
          { status: 400 }
        )
      }

      const contentType = remoteResponse.headers.get("content-type")
      if (!contentType || (!contentType.includes("pdf") && !contentType.startsWith("image/"))) {
        return NextResponse.json(
          {
            error:
              "El enlace no apunta a un PDF o imagen. Usa un enlace publico de descarga/exportacion de Canva.",
          },
          { status: 400 }
        )
      }

      const declared = Number(remoteResponse.headers.get("content-length") || 0)
      if (declared > MAX_BYTES) {
        return NextResponse.json({ error: "El archivo es demasiado grande (máx. 25 MB)" }, { status: 413 })
      }

      // Leer con límite de tamaño aunque el servidor no declare content-length
      const reader = remoteResponse.body?.getReader()
      if (!reader) return NextResponse.json({ error: "Respuesta vacía" }, { status: 400 })
      const chunks: Uint8Array[] = []
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > MAX_BYTES) {
          controller.abort()
          return NextResponse.json({ error: "El archivo es demasiado grande (máx. 25 MB)" }, { status: 413 })
        }
        chunks.push(value)
      }
      const body = new Uint8Array(total)
      let offset = 0
      for (const c of chunks) {
        body.set(c, offset)
        offset += c.byteLength
      }

      const filename = getFilenameFromUrl(finalUrl.toString(), contentType)
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    console.error("Error importing remote file:", error)
    return NextResponse.json(
      { error: "No se pudo procesar el enlace remoto" },
      { status: 500 }
    )
  }
}
