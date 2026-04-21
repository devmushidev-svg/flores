interface DetectedCatalogItem {
  file: File
  nombre: string
  precio: string
  codigo: string
  descripcion: string
}

interface VisualSegment {
  top: number
  bottom: number
}

interface PdfTextItem {
  text: string
  x: number
  top: number
  bottom: number
  height: number
}

interface PdfLine {
  text: string
  top: number
  bottom: number
  center: number
  height: number
}

const PDF_SCALE = 2

async function getPdfModule() {
  const pdfjs = await import("pdfjs-dist")
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`
  }
  return pdfjs
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("No se pudo cargar la imagen"))
    }
    img.src = url
  })
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function sanitizeNameFromFile(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim()
}

function isDecorativeLine(text: string) {
  const normalized = text.toLowerCase()
  return [
    "multiplanet",
    "floreria",
    "especial",
    "dia de las madres",
    "ramos basicos",
    "arreglos delux",
    "agregar titulo de pagina",
  ].some((fragment) => normalized.includes(fragment))
}

function hasCurrencyPrefix(text: string) {
  return /\bL[\s.]?\s*\d/i.test(text)
}

function parsePrice(text: string) {
  const match = text.match(/\bL[\s.]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d{3,}(?:\.\d{2}))\b/i)
  if (!match) return ""
  const raw = match[1].replace(/,/g, "")
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value.toFixed(2) : ""
}

function parseCode(text: string) {
  const normalized = text.toUpperCase().replace(/\s+/g, "")
  const match = normalized.match(/^([DR])(?::|-)?(\d{1,3})$/)
  if (!match) return ""

  const [, prefix, digits] = match
  if (prefix === "R") {
    return `${prefix}${digits.padStart(2, "0")}`
  }

  return `${prefix}${digits.padStart(3, "0")}`
}

function mergeCloseSegments(segments: VisualSegment[], gap = 0.035) {
  if (segments.length === 0) return segments

  const merged: VisualSegment[] = [segments[0]]
  for (let index = 1; index < segments.length; index++) {
    const current = segments[index]
    const previous = merged[merged.length - 1]
    if (current.top - previous.bottom <= gap) {
      previous.bottom = current.bottom
      continue
    }
    merged.push({ ...current })
  }

  return merged
}

async function detectVisualSegments(file: File): Promise<VisualSegment[]> {
  const image = await loadImage(file)
  const sampleWidth = Math.min(280, image.width)
  const sampleHeight = Math.max(200, Math.round((image.height / image.width) * sampleWidth))
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d", { willReadFrequently: true })

  if (!ctx) throw new Error("No se pudo analizar la imagen")

  canvas.width = sampleWidth
  canvas.height = sampleHeight
  ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight)

  const rowActivity: number[] = []
  for (let y = 0; y < sampleHeight; y++) {
    const data = ctx.getImageData(0, y, sampleWidth, 1).data
    let activePixels = 0
    let samples = 0

    for (let x = 0; x < data.length; x += 16) {
      const r = data[x]
      const g = data[x + 1]
      const b = data[x + 2]
      const alpha = data[x + 3]
      if (alpha < 10) continue
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
      if (luminance < 235) activePixels++
      samples++
    }

    rowActivity.push(samples > 0 ? activePixels / samples : 0)
  }

  const smoothed = rowActivity.map((_, index) => {
    const from = Math.max(0, index - 3)
    const to = Math.min(rowActivity.length - 1, index + 3)
    const slice = rowActivity.slice(from, to + 1)
    return slice.reduce((sum, value) => sum + value, 0) / slice.length
  })

  const rawSegments: VisualSegment[] = []
  const threshold = 0.06
  let start: number | null = null

  for (let index = 0; index < smoothed.length; index++) {
    const active = smoothed[index] >= threshold
    if (active && start === null) {
      start = index
    } else if (!active && start !== null) {
      rawSegments.push({
        top: start / sampleHeight,
        bottom: (index - 1) / sampleHeight,
      })
      start = null
    }
  }

  if (start !== null) {
    rawSegments.push({
      top: start / sampleHeight,
      bottom: 1,
    })
  }

  const minHeight = 0.12
  let segments = rawSegments.filter((segment) => segment.bottom - segment.top >= minHeight)
  segments = mergeCloseSegments(segments)

  if (segments.length > 1) {
    const filtered = segments.filter((segment, index) => {
      const height = segment.bottom - segment.top
      if (index === 0 && segment.top < 0.1 && height < 0.18) return false
      if (index === segments.length - 1 && segment.bottom > 0.9 && height < 0.12) return false
      return true
    })
    if (filtered.length > 0) segments = filtered
  }

  if (segments.length === 0) {
    return [{ top: 0, bottom: 1 }]
  }

  return segments.map((segment) => ({
    top: Math.max(0, segment.top - 0.02),
    bottom: Math.min(1, segment.bottom + 0.02),
  }))
}

async function cropImageByRatio(file: File, topRatio: number, bottomRatio: number, name: string) {
  const image = await loadImage(file)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) throw new Error("No se pudo recortar la imagen")

  const sourceY = Math.max(0, Math.floor(image.height * topRatio))
  const sourceHeight = Math.max(1, Math.floor(image.height * (bottomRatio - topRatio)))

  canvas.width = image.width
  canvas.height = sourceHeight
  ctx.drawImage(image, 0, sourceY, image.width, sourceHeight, 0, 0, image.width, sourceHeight)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, file.type || "image/jpeg", 0.92)
  })

  if (!blob) throw new Error("No se pudo crear el recorte")
  return new File([blob], name, { type: file.type || "image/jpeg" })
}

async function extractPrimarySubject(file: File, name: string) {
  const image = await loadImage(file)
  const sampleWidth = Math.min(240, image.width)
  const sampleHeight = Math.max(180, Math.round((image.height / image.width) * sampleWidth))
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d", { willReadFrequently: true })

  if (!ctx) return file

  canvas.width = sampleWidth
  canvas.height = sampleHeight
  ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight)

  const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight)
  const data = imageData.data
  const mask = new Uint8Array(sampleWidth * sampleHeight)

  for (let y = 0; y < sampleHeight; y++) {
    for (let x = 0; x < sampleWidth; x++) {
      const index = (y * sampleWidth + x) * 4
      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]
      const alpha = data[index + 3]
      if (alpha < 20) continue

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const saturation = max === 0 ? 0 : (max - min) / max
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b

      if (luminance < 242 || saturation > 0.18) {
        mask[y * sampleWidth + x] = 1
      }
    }
  }

  const visited = new Uint8Array(sampleWidth * sampleHeight)
  const components: { area: number; minX: number; minY: number; maxX: number; maxY: number }[] = []
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]

  for (let y = 0; y < sampleHeight; y++) {
    for (let x = 0; x < sampleWidth; x++) {
      const startIndex = y * sampleWidth + x
      if (!mask[startIndex] || visited[startIndex]) continue

      const queue: [number, number][] = [[x, y]]
      visited[startIndex] = 1
      let area = 0
      let minX = x
      let minY = y
      let maxX = x
      let maxY = y

      while (queue.length > 0) {
        const [currentX, currentY] = queue.shift() as [number, number]
        area++
        minX = Math.min(minX, currentX)
        minY = Math.min(minY, currentY)
        maxX = Math.max(maxX, currentX)
        maxY = Math.max(maxY, currentY)

        for (const [dx, dy] of directions) {
          const nextX = currentX + dx
          const nextY = currentY + dy
          if (nextX < 0 || nextY < 0 || nextX >= sampleWidth || nextY >= sampleHeight) continue
          const nextIndex = nextY * sampleWidth + nextX
          if (!mask[nextIndex] || visited[nextIndex]) continue
          visited[nextIndex] = 1
          queue.push([nextX, nextY])
        }
      }

      components.push({ area, minX, minY, maxX, maxY })
    }
  }

  const best = components
    .filter((component) => component.area > sampleWidth * sampleHeight * 0.01)
    .map((component) => {
      const width = component.maxX - component.minX + 1
      const height = component.maxY - component.minY + 1
      const centerX = (component.minX + component.maxX) / 2 / sampleWidth
      const centerY = (component.minY + component.maxY) / 2 / sampleHeight
      const positionBonus = 1 - Math.min(1, Math.abs(centerX - 0.58) * 0.9 + Math.abs(centerY - 0.58) * 0.5)
      const score = component.area * (1 + positionBonus)
      return { ...component, width, height, score }
    })
    .sort((a, b) => b.score - a.score)[0]

  if (!best) return file

  const widthRatio = best.width / sampleWidth
  const heightRatio = best.height / sampleHeight
  if (widthRatio > 0.92 && heightRatio > 0.92) return file

  const paddingX = Math.round(best.width * 0.12)
  const paddingY = Math.round(best.height * 0.12)
  const minX = Math.max(0, best.minX - paddingX)
  const minY = Math.max(0, best.minY - paddingY)
  const maxX = Math.min(sampleWidth - 1, best.maxX + paddingX)
  const maxY = Math.min(sampleHeight - 1, best.maxY + paddingY)

  const cropX = Math.floor((minX / sampleWidth) * image.width)
  const cropY = Math.floor((minY / sampleHeight) * image.height)
  const cropWidth = Math.max(1, Math.floor(((maxX - minX + 1) / sampleWidth) * image.width))
  const cropHeight = Math.max(1, Math.floor(((maxY - minY + 1) / sampleHeight) * image.height))

  const outputCanvas = document.createElement("canvas")
  const outputCtx = outputCanvas.getContext("2d")
  if (!outputCtx) return file

  outputCanvas.width = cropWidth
  outputCanvas.height = cropHeight
  outputCtx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

  const blob = await new Promise<Blob | null>((resolve) => {
    outputCanvas.toBlob(resolve, file.type || "image/jpeg", 0.92)
  })

  if (!blob) return file
  return new File([blob], name, { type: file.type || "image/jpeg" })
}

async function extractPrimarySubjectWithBias(
  file: File,
  name: string,
  options?: { minXRatio?: number; maxXRatio?: number; minYRatio?: number; maxYRatio?: number }
) {
  const image = await loadImage(file)
  const sampleWidth = Math.min(240, image.width)
  const sampleHeight = Math.max(180, Math.round((image.height / image.width) * sampleWidth))
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d", { willReadFrequently: true })

  if (!ctx) return file

  canvas.width = sampleWidth
  canvas.height = sampleHeight
  ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight)

  const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight)
  const data = imageData.data
  const mask = new Uint8Array(sampleWidth * sampleHeight)

  const minX = Math.floor((options?.minXRatio ?? 0) * sampleWidth)
  const maxX = Math.ceil((options?.maxXRatio ?? 1) * sampleWidth)
  const minY = Math.floor((options?.minYRatio ?? 0) * sampleHeight)
  const maxY = Math.ceil((options?.maxYRatio ?? 1) * sampleHeight)

  for (let y = 0; y < sampleHeight; y++) {
    for (let x = 0; x < sampleWidth; x++) {
      if (x < minX || x > maxX || y < minY || y > maxY) continue

      const index = (y * sampleWidth + x) * 4
      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]
      const alpha = data[index + 3]
      if (alpha < 20) continue

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const saturation = max === 0 ? 0 : (max - min) / max
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b

      if (luminance < 244 || saturation > 0.16) {
        mask[y * sampleWidth + x] = 1
      }
    }
  }

  const visited = new Uint8Array(sampleWidth * sampleHeight)
  const components: { area: number; minX: number; minY: number; maxX: number; maxY: number }[] = []
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]

  for (let y = minY; y < Math.min(sampleHeight, maxY); y++) {
    for (let x = minX; x < Math.min(sampleWidth, maxX); x++) {
      const startIndex = y * sampleWidth + x
      if (!mask[startIndex] || visited[startIndex]) continue

      const queue: [number, number][] = [[x, y]]
      visited[startIndex] = 1
      let area = 0
      let compMinX = x
      let compMinY = y
      let compMaxX = x
      let compMaxY = y

      while (queue.length > 0) {
        const [currentX, currentY] = queue.shift() as [number, number]
        area++
        compMinX = Math.min(compMinX, currentX)
        compMinY = Math.min(compMinY, currentY)
        compMaxX = Math.max(compMaxX, currentX)
        compMaxY = Math.max(compMaxY, currentY)

        for (const [dx, dy] of directions) {
          const nextX = currentX + dx
          const nextY = currentY + dy
          if (nextX < minX || nextY < minY || nextX >= Math.min(sampleWidth, maxX) || nextY >= Math.min(sampleHeight, maxY)) continue
          const nextIndex = nextY * sampleWidth + nextX
          if (!mask[nextIndex] || visited[nextIndex]) continue
          visited[nextIndex] = 1
          queue.push([nextX, nextY])
        }
      }

      components.push({ area, minX: compMinX, minY: compMinY, maxX: compMaxX, maxY: compMaxY })
    }
  }

  const best = components
    .filter((component) => component.area > sampleWidth * sampleHeight * 0.006)
    .sort((a, b) => b.area - a.area)[0]

  if (!best) return file

  const paddingX = Math.round((best.maxX - best.minX + 1) * 0.14)
  const paddingY = Math.round((best.maxY - best.minY + 1) * 0.14)
  const cropMinX = Math.max(0, best.minX - paddingX)
  const cropMinY = Math.max(0, best.minY - paddingY)
  const cropMaxX = Math.min(sampleWidth - 1, best.maxX + paddingX)
  const cropMaxY = Math.min(sampleHeight - 1, best.maxY + paddingY)

  const cropX = Math.floor((cropMinX / sampleWidth) * image.width)
  const cropY = Math.floor((cropMinY / sampleHeight) * image.height)
  const cropWidth = Math.max(1, Math.floor(((cropMaxX - cropMinX + 1) / sampleWidth) * image.width))
  const cropHeight = Math.max(1, Math.floor(((cropMaxY - cropMinY + 1) / sampleHeight) * image.height))

  const outputCanvas = document.createElement("canvas")
  const outputCtx = outputCanvas.getContext("2d")
  if (!outputCtx) return file

  outputCanvas.width = cropWidth
  outputCanvas.height = cropHeight
  outputCtx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

  const blob = await new Promise<Blob | null>((resolve) => {
    outputCanvas.toBlob(resolve, file.type || "image/jpeg", 0.92)
  })

  if (!blob) return file
  return new File([blob], name, { type: file.type || "image/jpeg" })
}

function groupPdfItemsIntoLines(items: PdfTextItem[]) {
  const sorted = [...items].sort((a, b) => a.top - b.top || a.x - b.x)
  const lines: { items: PdfTextItem[]; top: number; bottom: number }[] = []

  for (const item of sorted) {
    const existing = lines.find((line) => Math.abs(line.top - item.top) <= Math.max(12, item.height * 0.8))
    if (existing) {
      existing.items.push(item)
      existing.top = Math.min(existing.top, item.top)
      existing.bottom = Math.max(existing.bottom, item.bottom)
      continue
    }
    lines.push({
      items: [item],
      top: item.top,
      bottom: item.bottom,
    })
  }

  return lines
    .map((line) => {
      const sortedItems = [...line.items].sort((a, b) => a.x - b.x)
      const text = normalizeSpaces(sortedItems.map((item) => item.text).join(" "))
      return {
        text,
        top: line.top,
        bottom: line.bottom,
        center: (line.top + line.bottom) / 2,
        height: line.bottom - line.top,
      }
    })
    .filter((line) => line.text.length > 0)
}

function extractSegmentMetadata(lines: PdfLine[]) {
  const visibleLines = lines
    .map((line) => ({ ...line, text: normalizeSpaces(line.text) }))
    .filter((line) => line.text && !isDecorativeLine(line.text))

  const priceLine = visibleLines.find((line) => hasCurrencyPrefix(line.text) && parsePrice(line.text))
  const codeLine = visibleLines.find((line) => parseCode(line.text))
  const precio = priceLine ? parsePrice(priceLine.text) : ""
  const codigo = codeLine ? parseCode(codeLine.text) : ""

  let nombre = ""
  if (priceLine) {
    const candidates = visibleLines
      .filter((line) => line.center < priceLine.center && !parseCode(line.text) && !parsePrice(line.text))
      .sort((a, b) => b.center - a.center)
    nombre = candidates[0]?.text || ""
  }

  const descriptionTop = priceLine?.center ?? 0
  const descriptionBottom = codeLine?.center ?? Number.POSITIVE_INFINITY
  const descripcion = visibleLines
    .filter((line) =>
      line.center > descriptionTop &&
      line.center < descriptionBottom &&
      !parseCode(line.text) &&
      !parsePrice(line.text)
    )
    .map((line) => line.text)
    .join(" ")
    .trim()

  return { nombre, precio, codigo, descripcion }
}

interface ProductBand {
  top: number
  bottom: number
  center: number
  nombre: string
  precio: string
  codigo: string
  descripcion: string
}

function buildProductBands(lines: PdfLine[], pageHeight: number): ProductBand[] {
  const visibleLines = lines
    .map((line) => ({ ...line, text: normalizeSpaces(line.text) }))
    .filter((line) => line.text && !isDecorativeLine(line.text))

  const priceLines = visibleLines
    .filter((line) => hasCurrencyPrefix(line.text) && parsePrice(line.text))
    .sort((a, b) => a.center - b.center)

  if (priceLines.length === 0) {
    const metadata = extractSegmentMetadata(visibleLines)
    return [{
      top: 0,
      bottom: pageHeight,
      center: pageHeight / 2,
      ...metadata,
    }]
  }

  return priceLines.map((priceLine, index) => {
    const prevCenter = index === 0 ? 0 : (priceLines[index - 1].center + priceLine.center) / 2
    const nextCenter =
      index === priceLines.length - 1 ? pageHeight : (priceLine.center + priceLines[index + 1].center) / 2

    const bandLines = visibleLines.filter((line) => line.center >= prevCenter && line.center < nextCenter)
    const nameLine = [...bandLines]
      .filter((line) => line.center < priceLine.center && !parseCode(line.text) && !parsePrice(line.text))
      .sort((a, b) => b.center - a.center || b.height - a.height)[0]

    let codeLine = [...bandLines]
      .filter((line) => line.center > priceLine.center && parseCode(line.text))
      .sort((a, b) => a.center - b.center)[0]

    if (!codeLine) {
      codeLine = visibleLines
        .filter((line) => parseCode(line.text))
        .sort((a, b) => Math.abs(a.center - priceLine.center) - Math.abs(b.center - priceLine.center))[0]
    }

    const descripcion = bandLines
      .filter((line) =>
        line.center > priceLine.center &&
        line.center < nextCenter &&
        !parseCode(line.text) &&
        !parsePrice(line.text) &&
        line.text !== nameLine?.text
      )
      .sort((a, b) => a.center - b.center)
      .map((line) => line.text)
      .join(" ")
      .trim()

    return {
      top: prevCenter,
      bottom: nextCenter,
      center: (prevCenter + nextCenter) / 2,
      nombre: nameLine?.text || `Arreglo ${index + 1}`,
      precio: parsePrice(priceLine.text),
      codigo: codeLine ? parseCode(codeLine.text) : "",
      descripcion,
    }
  })
}

function chooseSegmentsForProducts(segments: VisualSegment[], products: ProductBand[], pageHeight: number) {
  if (segments.length === 0) return []

  const candidates = segments
    .map((segment, index) => ({
      index,
      segment,
      center: ((segment.top + segment.bottom) / 2) * pageHeight,
      height: (segment.bottom - segment.top) * pageHeight,
    }))
    .sort((a, b) => a.center - b.center)

  const chosen: VisualSegment[] = []
  const used = new Set<number>()

  for (const product of products) {
    const best = candidates
      .filter((candidate) => !used.has(candidate.index))
      .sort((a, b) => Math.abs(a.center - product.center) - Math.abs(b.center - product.center))[0]

    if (best) {
      used.add(best.index)
      chosen.push(best.segment)
    }
  }

  return chosen
}

function expandBandCrop(product: ProductBand, pageHeight: number) {
  const topRatio = Math.max(0, product.top / pageHeight - 0.06)
  const bottomRatio = Math.min(1, product.bottom / pageHeight + 0.06)
  return {
    top: topRatio,
    bottom: bottomRatio,
  }
}

function getTemplatePhotoCrop(index: number, totalProducts: number) {
  if (totalProducts !== 2) return null

  const headerHeight = 2.4 / 11
  const topPhotoWidth = 5 / 8.5
  const bottomPhotoWidth = 5 / 8.5
  const photoHeight = 5 / 11

  if (index === 0) {
    const top = Math.max(0, headerHeight - 1 / 11)
    return {
      left: 1 - topPhotoWidth,
      right: 1,
      top,
      bottom: Math.min(1, top + photoHeight),
    }
  }

  return {
    left: 1 - bottomPhotoWidth,
    right: 1,
    top: Math.max(headerHeight, 1 - photoHeight),
    bottom: 1,
  }
}

async function cropImageByBox(
  file: File,
  leftRatio: number,
  topRatio: number,
  rightRatio: number,
  bottomRatio: number,
  name: string
) {
  const image = await loadImage(file)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) throw new Error("No se pudo recortar la imagen")

  const sourceX = Math.max(0, Math.floor(image.width * leftRatio))
  const sourceY = Math.max(0, Math.floor(image.height * topRatio))
  const sourceWidth = Math.max(1, Math.floor(image.width * (rightRatio - leftRatio)))
  const sourceHeight = Math.max(1, Math.floor(image.height * (bottomRatio - topRatio)))

  canvas.width = sourceWidth
  canvas.height = sourceHeight
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, file.type || "image/jpeg", 0.92)
  })

  if (!blob) throw new Error("No se pudo crear el recorte")
  return new File([blob], name, { type: file.type || "image/jpeg" })
}

async function renderPdfPageToImage(page: any, pageNumber: number) {
  const viewport = page.getViewport({ scale: PDF_SCALE })
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo renderizar la pagina del PDF")

  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    intent: "display",
  }).promise

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  })

  if (!blob) throw new Error("No se pudo convertir la pagina del PDF")

  return {
    file: new File([blob], `pagina-${pageNumber}.jpg`, { type: "image/jpeg" }),
    viewport,
  }
}

async function extractPdfLines(page: any, viewport: { height: number }) {
  const textContent = await page.getTextContent()
  const items: PdfTextItem[] = (textContent.items as unknown[])
    .map((item: unknown) => {
      if (!item || typeof item !== "object" || !("str" in item) || !("transform" in item)) return null
      const text = normalizeSpaces(String(item.str))
      if (!text) return null

      const transform = Array.isArray(item.transform) ? item.transform : []
      const x = Number(transform[4] || 0) * PDF_SCALE
      const baseline = viewport.height - Number(transform[5] || 0) * PDF_SCALE
      const height = Math.abs(Number(transform[3] || 0)) * PDF_SCALE || 16
      return {
        text,
        x,
        top: baseline - height,
        bottom: baseline,
        height,
      }
    })
    .filter((item: PdfTextItem | null): item is PdfTextItem => item !== null)

  return groupPdfItemsIntoLines(items)
}

function mapSegmentLines(lines: PdfLine[], segment: VisualSegment, pageHeight: number) {
  const segmentTop = segment.top * pageHeight
  const segmentBottom = segment.bottom * pageHeight
  return lines.filter((line) => line.center >= segmentTop && line.center <= segmentBottom)
}

export async function detectCatalogItemsFromImage(file: File): Promise<DetectedCatalogItem[]> {
  const segments = await detectVisualSegments(file)
  const manySegments = segments.length > 1

  const results = await Promise.all(
    segments.map(async (segment, index) => {
      const baseFile = manySegments
        ? await cropImageByRatio(file, segment.top, segment.bottom, `${index + 1}-${file.name}`)
        : file
      const focusedFile = await extractPrimarySubject(baseFile, `subject-${index + 1}-${file.name}`)

      return {
        file: focusedFile,
        nombre: manySegments ? `${sanitizeNameFromFile(file.name)} ${index + 1}` : sanitizeNameFromFile(file.name),
        precio: "",
        codigo: "",
        descripcion: "",
      }
    })
  )

  return results
}

export async function detectCatalogItemsFromPdf(file: File): Promise<DetectedCatalogItem[]> {
  const pdfjs = await getPdfModule()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const detectedItems: DetectedCatalogItem[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const { file: pageFile, viewport } = await renderPdfPageToImage(page, pageNumber)
    const lines = await extractPdfLines(page, viewport)
    const products = buildProductBands(lines, viewport.height)
    const segments = chooseSegmentsForProducts(await detectVisualSegments(pageFile), products, viewport.height)

    for (let index = 0; index < products.length; index++) {
      const product = products[index]
      const segment = segments[index]
      const templatePhotoCrop = getTemplatePhotoCrop(index, products.length)
      const textBand = expandBandCrop(product, viewport.height)
      const useVisualCrop = products.length === 1 && segment
      const cropTop = useVisualCrop ? segment.top : textBand.top
      const cropBottom = useVisualCrop ? segment.bottom : textBand.bottom
      const croppedFile =
        products.length > 1 || cropTop > 0 || cropBottom < 1
          ? await cropImageByRatio(pageFile, cropTop, cropBottom, `pagina-${pageNumber}-${index + 1}.jpg`)
          : pageFile
      const focusedFile =
        templatePhotoCrop
          ? await cropImageByBox(
              pageFile,
              templatePhotoCrop.left,
              templatePhotoCrop.top,
              templatePhotoCrop.right,
              templatePhotoCrop.bottom,
              `subject-pagina-${pageNumber}-${index + 1}.jpg`
            )
          : products.length === 1
          ? await extractPrimarySubject(croppedFile, `subject-pagina-${pageNumber}-${index + 1}.jpg`)
          : await extractPrimarySubjectWithBias(
              croppedFile,
              `subject-pagina-${pageNumber}-${index + 1}.jpg`,
              { minXRatio: 0.38, maxXRatio: 0.98, minYRatio: 0.12, maxYRatio: 0.95 }
            )

      detectedItems.push({
        file: focusedFile,
        nombre: product.nombre || `Arreglo ${detectedItems.length + 1}`,
        precio: product.precio,
        codigo: product.codigo,
        descripcion: product.descripcion,
      })
    }
  }

  return detectedItems
}
