/**
 * Converts PDF pages to image Files for upload.
 * Uses pdfjs-dist - must be called client-side only.
 */

export async function pdfPagesToImages(file: File): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist")
  const { getDocument, GlobalWorkerOptions } = pdfjs

  if (typeof window !== "undefined") {
    GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const numPages = pdf.numPages
  const scale = 2 // Higher quality for catalog images
  const files: File[] = []

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not get canvas context")
    const renderTask = page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      intent: "display",
    })
    await renderTask.promise

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    })
    if (!blob) throw new Error("Could not convert page to image")
    const pageFile = new File(
      [blob],
      `pagina-${i}.jpg`,
      { type: "image/jpeg" }
    )
    files.push(pageFile)
  }

  return files
}
