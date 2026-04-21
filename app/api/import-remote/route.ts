import { NextResponse } from "next/server"

function getFilenameFromUrl(url: string, contentType: string | null) {
  try {
    const pathname = new URL(url).pathname
    const lastSegment = pathname.split("/").filter(Boolean).pop()
    if (lastSegment && /\.[a-z0-9]+$/i.test(lastSegment)) {
      return decodeURIComponent(lastSegment)
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

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Solo se permiten URLs http o https" }, { status: 400 })
    }

    const remoteResponse = await fetch(parsedUrl.toString(), {
      headers: {
        Accept: "application/pdf,image/*,*/*",
      },
      redirect: "follow",
    })

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

    const arrayBuffer = await remoteResponse.arrayBuffer()
    const filename = getFilenameFromUrl(parsedUrl.toString(), contentType)

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Error importing remote file:", error)
    return NextResponse.json(
      { error: "No se pudo procesar el enlace remoto" },
      { status: 500 }
    )
  }
}
