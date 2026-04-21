"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { Upload, X, Loader2, CheckCircle, SplitSquareVertical, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { splitImageInHalf } from "@/lib/image-split"
import { createClient } from "@/lib/supabase/client"
import { detectCatalogItemsFromImage, detectCatalogItemsFromPdf } from "@/lib/catalog-auto-detect"
import {
  clearCatalogImportDraft,
  loadCatalogImportDraft,
  saveCatalogImportDraft,
} from "@/lib/catalog-import-draft"

interface ImportItem {
  id: string
  file: File | null
  preview: string
  codigo: string
  nombre: string
  precio: string
  descripcion: string
  status: "pending" | "uploading" | "done" | "error"
}

interface CatalogoImportProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function uploadToCloudinaryWithRetry(file: File, retries = 2) {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await uploadToCloudinary(file)
    } catch (error) {
      lastError = error
      if (attempt === retries) break
      await wait(800 * (attempt + 1))
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No se pudo subir la imagen")
}

export function CatalogoImport({ open, onOpenChange, onSuccess }: CatalogoImportProps) {
  const [items, setItems] = useState<ImportItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [splittingId, setSplittingId] = useState<string | null>(null)
  const [remoteUrl, setRemoteUrl] = useState("")
  const [isFetchingRemote, setIsFetchingRemote] = useState(false)
  const [currentTask, setCurrentTask] = useState<string>("")
  const [draftRecovered, setDraftRecovered] = useState(false)
  const [importSummary, setImportSummary] = useState<string>("")
  const hasLoadedDraftRef = useRef(false)

  useEffect(() => {
    let isActive = true

    const restoreDraft = async () => {
      try {
        const draftItems = await loadCatalogImportDraft()
        if (!isActive || draftItems.length === 0) return

        setItems((prev) => {
          if (prev.length > 0) return prev
          setDraftRecovered(true)
          return draftItems.map((item) => ({
            ...item,
            file: item.file && item.fileName
              ? new File([item.file], item.fileName, { type: item.file.type || "image/png" })
              : null,
            preview: item.file ? URL.createObjectURL(item.file) : "",
          }))
        })
      } catch (error) {
        console.error("Error loading import draft:", error)
      } finally {
        hasLoadedDraftRef.current = true
      }
    }

    void restoreDraft()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedDraftRef.current) return

    const persistDraft = async () => {
      try {
        if (items.length === 0) {
          await clearCatalogImportDraft()
          return
        }

        await saveCatalogImportDraft(
          items.map((item) => ({
            id: item.id,
            file: item.file,
            fileName: item.file?.name || null,
            codigo: item.codigo,
            nombre: item.nombre,
            precio: item.precio,
            descripcion: item.descripcion,
            status: item.status === "uploading" ? "pending" : item.status,
          }))
        )
      } catch (error) {
        console.error("Error saving import draft:", error)
      }
    }

    void persistDraft()
  }, [items])

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)

    setIsProcessing(true)
    setCurrentTask("Analizando catalogo...")
    const newItems: ImportItem[] = []

    for (const file of fileArray) {
      try {
        setCurrentTask(`Analizando ${file.name}...`)
        const detectedItems =
          file.type === "application/pdf"
            ? await detectCatalogItemsFromPdf(file)
            : file.type.startsWith("image/")
              ? await detectCatalogItemsFromImage(file)
              : []

        for (const detected of detectedItems) {
          const preview = URL.createObjectURL(detected.file)
          newItems.push({
            id: crypto.randomUUID(),
            file: detected.file,
            preview,
            codigo: detected.codigo,
            nombre: detected.nombre,
            precio: detected.precio,
            descripcion: detected.descripcion,
            status: "pending",
          })
        }
      } catch (err) {
        console.error("Error processing catalog file:", err)
        alert("No se pudo analizar uno de los archivos del catalogo.")
      }
    }

    setItems((prev) => [...prev, ...newItems])
    setIsProcessing(false)
    setCurrentTask("")
  }, [])

  const getFilenameFromResponse = (response: Response, fallbackUrl: string) => {
    const disposition = response.headers.get("content-disposition")
    const match = disposition?.match(/filename="?([^"]+)"?/i)
    const filename = match?.[1]
    if (filename) return filename

    try {
      const pathname = new URL(fallbackUrl).pathname
      const lastSegment = pathname.split("/").filter(Boolean).pop()
      if (lastSegment) return decodeURIComponent(lastSegment)
    } catch {
      // Ignore invalid fallback parsing and use generic names below.
    }

    const contentType = response.headers.get("content-type") || ""
    if (contentType.includes("pdf")) return "catalogo-canva.pdf"
    if (contentType.includes("png")) return "catalogo-canva.png"
    if (contentType.includes("webp")) return "catalogo-canva.webp"
    if (contentType.includes("jpeg") || contentType.includes("jpg")) return "catalogo-canva.jpg"
    return "catalogo-canva"
  }

  const handleRemoteImport = async () => {
    const url = remoteUrl.trim()
    if (!url) {
      alert("Pega primero un enlace publico de Canva.")
      return
    }

    setIsFetchingRemote(true)
    setCurrentTask("Descargando archivo de Canva...")
    try {
      const response = await fetch("/api/import-remote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(errorData?.error || "No se pudo descargar el archivo remoto")
      }

      const blob = await response.blob()
      const file = new File([blob], getFilenameFromResponse(response, url), {
        type: blob.type || response.headers.get("content-type") || "application/octet-stream",
      })

      await addFiles([file])
      setRemoteUrl("")
    } catch (error) {
      console.error("Error importing remote catalog:", error)
      const message =
        error instanceof Error ? error.message : "No se pudo importar el enlace de Canva"
      alert(message)
    } finally {
      setIsFetchingRemote(false)
      if (!isProcessing) {
        setCurrentTask("")
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.length) addFiles(files)
    e.target.value = ""
  }

  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((i) => i.id !== id)
    })
  }

  const updateItem = (id: string, field: "nombre" | "precio" | "codigo" | "descripcion", value: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              [field]: value,
              status: i.status === "done" ? "pending" : i.status,
            }
          : i
      )
    )
  }

  const handleSplitItem = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item || item.status === "uploading") return
    if (!item.file) {
      alert("Este borrador ya no tiene imagen para dividir. Si necesitas partirlo otra vez, vuelve a cargar el archivo original.")
      return
    }
    setSplittingId(id)
    try {
      const [topFile, bottomFile] = await splitImageInHalf(item.file)
      const topPreview = URL.createObjectURL(topFile)
      const bottomPreview = URL.createObjectURL(bottomFile)
      const baseName = item.nombre.replace(/\s*\(\d+\)$/, "")
      const newItems: ImportItem[] = [
        {
          id: crypto.randomUUID(),
          file: topFile,
          preview: topPreview,
          codigo: "",
          nombre: `${baseName} (1)`,
          precio: "",
          descripcion: "",
          status: "pending",
        },
        {
          id: crypto.randomUUID(),
          file: bottomFile,
          preview: bottomPreview,
          codigo: "",
          nombre: `${baseName} (2)`,
          precio: "",
          descripcion: "",
          status: "pending",
        },
      ]
      setItems((prev) => {
        URL.revokeObjectURL(item.preview)
        return prev.filter((i) => i.id !== id).concat(newItems)
      })
    } catch (err) {
      console.error("Error splitting image:", err)
      alert("No se pudo dividir la imagen.")
    } finally {
      setSplittingId(null)
    }
  }

  const handleMarkAllForRetry = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        status:
          item.status === "uploading"
            ? "uploading"
            : item.nombre.trim() && item.precio && parseFloat(item.precio) > 0
              ? "pending"
              : item.status,
      }))
    )
    const retryCount = items.filter(
      (item) => item.nombre.trim() && item.precio && parseFloat(item.precio) > 0
    ).length
    setImportSummary(
      retryCount > 0
        ? `${retryCount} arreglos quedaron listos para volver a actualizar.`
        : "No hay arreglos validos para volver a actualizar."
    )
  }

  const handleImport = async () => {
    const toImport = items.filter(
      (i) =>
        i.status !== "done" &&
        i.nombre.trim() &&
        i.precio &&
        parseFloat(i.precio) > 0
    )
    if (toImport.length === 0) {
      alert("No hay arreglos pendientes por importar.")
      return
    }

    setIsImporting(true)
    setCurrentTask("Subiendo arreglos...")
    setImportSummary("")
    const supabase = createClient()
    let successCount = 0
    let failedCount = 0
    const failedItems: string[] = []

    for (const [index, item] of toImport.entries()) {
      setCurrentTask(`Subiendo ${item.nombre} (${index + 1}/${toImport.length})...`)
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "uploading" as const } : i))
      )
      try {
        const payload = {
          codigo: item.codigo.trim() || null,
          nombre: item.nombre.trim(),
          descripcion: item.descripcion.trim() || null,
          precio_real: parseFloat(item.precio),
          is_active: true,
        }

        let error: { message?: string } | null = null

        if (item.file) {
          const { url } = await uploadToCloudinaryWithRetry(item.file)
          const payloadWithPhoto = {
            ...payload,
            foto_url: url,
          }

          const result = item.codigo.trim()
            ? await supabase
                .from("arreglos")
                .upsert([payloadWithPhoto], { onConflict: "codigo" })
            : await supabase.from("arreglos").insert([payloadWithPhoto])

          error = result.error
        } else {
          const codigo = item.codigo.trim()
          if (!codigo) {
            throw new Error("Este borrador ya no tiene imagen. Necesita un codigo para reactivar el arreglo existente.")
          }

          const { data: existing, error: existingError } = await supabase
            .from("arreglos")
            .select("id")
            .eq("codigo", codigo)
            .maybeSingle()

          if (existingError) throw existingError
          if (!existing) {
            throw new Error(`No se encontro un arreglo existente con el codigo ${codigo}.`)
          }

          const result = await supabase
            .from("arreglos")
            .update(payload)
            .eq("id", existing.id)

          error = result.error
        }

        if (error) throw error
        successCount++
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "done" as const } : i))
        )
      } catch (err) {
        failedCount++
        failedItems.push(item.nombre)
        const errorMessage =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : JSON.stringify(err, null, 2)
        console.error("Error importing:", errorMessage, err)
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error" as const } : i))
        )
      }
    }

    setIsImporting(false)
    setCurrentTask("")
    if (successCount > 0) {
      onSuccess()
    }
    if (successCount > 0 && failedCount === 0) {
      setImportSummary(`Se guardaron ${successCount} arreglos. Puedes cerrar con "Listo" o volver a actualizar si hiciste cambios.`)
      return
    }
    if (successCount > 0 && failedCount > 0) {
      const preview = failedItems.slice(0, 5).join(", ")
      setImportSummary(
        `Se guardaron ${successCount} arreglos y ${failedCount} fallaron. Puedes corregirlos y volver a actualizar.${preview ? ` Ejemplos: ${preview}${failedItems.length > 5 ? "..." : ""}` : ""}`
      )
    }
    if (successCount === 0 && failedCount > 0) {
      const preview = failedItems.slice(0, 5).join(", ")
      setImportSummary(
        `No se pudo guardar la tanda. ${failedCount} arreglos fallaron.${preview ? ` Ejemplos: ${preview}${failedItems.length > 5 ? "..." : ""}` : ""}`
      )
    }
  }

  const handleClose = () => {
    if (isImporting || isProcessing || isFetchingRemote) {
      return
    }
    onOpenChange(false)
  }

  const handleFinish = () => {
    if (isImporting || isProcessing || isFetchingRemote) {
      return
    }
    items.forEach((item) => URL.revokeObjectURL(item.preview))
    setItems([])
    setRemoteUrl("")
    setDraftRecovered(false)
    setImportSummary("")
    void clearCatalogImportDraft()
    onOpenChange(false)
  }

  const pendingImportCount = items.filter(
    (i) => i.status !== "done" && i.nombre.trim() && i.precio && parseFloat(i.precio) > 0
  ).length
  const uploadingCount = items.filter((item) => item.status === "uploading").length
  const doneCount = items.filter((item) => item.status === "done").length
  const errorCount = items.filter((item) => item.status === "error").length
  const canRetryImported = doneCount > 0 || !!importSummary
  const hasBusyState = isImporting || isProcessing || isFetchingRemote
  const progressMessage = useMemo(() => {
    if (currentTask) return currentTask
    if (isProcessing) return "Analizando catalogo..."
    if (isFetchingRemote) return "Descargando archivo remoto..."
    if (isImporting) return "Importando arreglos..."
    return ""
  }, [currentTask, isProcessing, isFetchingRemote, isImporting])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) {
        handleClose()
        return
      }
      onOpenChange(true)
    }}>
      <DialogContent className="max-w-[95vw] rounded-lg sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar catalogo</DialogTitle>
          <DialogDescription>
            Sube el PDF de Canva o pega su enlace publico. El sistema detecta automaticamente los arreglos, intenta leer codigo, nombre, precio y descripcion, y luego te deja revisarlos antes de guardar.
          </DialogDescription>
        </DialogHeader>

        {items.length > 0 && !hasBusyState && (
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Borrador guardado en esta ventana. Si cierras el modal y lo vuelves a abrir, los arreglos detectados seguiran aqui hasta que importes o recargues la pagina.
          </div>
        )}

        {draftRecovered && !hasBusyState && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Se recupero un borrador guardado localmente para que no pierdas el avance si la ventana se cierra.
          </div>
        )}

        {importSummary && !hasBusyState && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
            {importSummary}
          </div>
        )}

        {hasBusyState && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <Spinner className="h-5 w-5 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{progressMessage}</p>
                <p className="text-xs text-muted-foreground">
                  No cierres esta ventana hasta que termine.
                  {isImporting ? ` Completados: ${doneCount}, en curso: ${uploadingCount}, errores: ${errorCount}.` : ""}
                </p>
              </div>
            </div>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30"
          }`}
        >
          <input
            type="file"
            accept="image/*,.pdf,application/pdf"
            multiple
            onChange={handleFileInput}
            className="hidden"
            id="catalogo-import-input"
          />
          <label htmlFor="catalogo-import-input" className="cursor-pointer block">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <Spinner className="h-10 w-10 text-primary" />
                <span className="text-sm text-muted-foreground">Procesando archivos...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">
                  Arrastra imagenes o PDF aqui, o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG o PDF exportado desde Canva
                </p>
              </div>
            )}
          </label>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="space-y-1">
            <Label htmlFor="canva-url">Enlace publico de Canva</Label>
            <p className="text-xs text-muted-foreground">
              Pega un enlace directo de descarga o exportacion en PDF, PNG o JPG desde Canva.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="canva-url"
              placeholder="https://..."
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              disabled={isFetchingRemote || isProcessing || isImporting}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleRemoteImport}
              disabled={!remoteUrl.trim() || isFetchingRemote || isProcessing || isImporting}
            >
              {isFetchingRemote ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extrayendo...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Traer de Canva
                </>
              )}
            </Button>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {items.length} arreglos detectados. Revisa los datos y luego confirma la importacion.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMarkAllForRetry}
                disabled={hasBusyState || items.length === 0}
              >
                Actualizar todos
              </Button>
            </div>
            <div className="grid gap-3 max-h-[300px] overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 rounded-lg border bg-card items-center"
                >
                  <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview}
                      alt={item.nombre}
                      className="w-full h-full object-cover"
                    />
                    {item.status === "uploading" && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      </div>
                    )}
                    {item.status === "done" && (
                      <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <Label className="text-xs">Codigo</Label>
                      <Input
                        placeholder="AR-001"
                        value={item.codigo}
                        onChange={(e) => updateItem(item.id, "codigo", e.target.value)}
                        className="h-9 text-sm font-mono"
                        disabled={item.status === "uploading"}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Nombre</Label>
                        <Input
                          placeholder="Ramo romantico"
                          value={item.nombre}
                          onChange={(e) => updateItem(item.id, "nombre", e.target.value)}
                          className="h-9 text-sm"
                          disabled={item.status === "uploading"}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Precio (L)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          value={item.precio}
                          onChange={(e) => updateItem(item.id, "precio", e.target.value)}
                          className="h-9 text-sm"
                          disabled={item.status === "uploading"}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Descripcion</Label>
                      <Textarea
                        placeholder="Descripcion del arreglo"
                        value={item.descripcion}
                        onChange={(e) => updateItem(item.id, "descripcion", e.target.value)}
                        className="min-h-20 text-sm"
                        disabled={item.status === "uploading"}
                      />
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleSplitItem(item.id)}
                      disabled={item.status === "uploading" || splittingId !== null}
                      title="Dividir en 2 (para flyers con varios arreglos)"
                    >
                      {splittingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SplitSquareVertical className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeItem(item.id)}
                      disabled={item.status === "uploading"}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              {hasBusyState ? "Procesando..." : "Cerrar"}
            </Button>
            <Button
              variant="outline"
              onClick={handleFinish}
              disabled={hasBusyState}
            >
              Listo
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || pendingImportCount === 0}
            >
              {isImporting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Importando...
                </>
              ) : (
                canRetryImported
                  ? `Volver a actualizar ${pendingImportCount} arreglo${pendingImportCount !== 1 ? "s" : ""}`
                  : `Importar ${pendingImportCount} arreglo${pendingImportCount !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
