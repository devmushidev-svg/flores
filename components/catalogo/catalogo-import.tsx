"use client"

import { useState, useCallback } from "react"
import { Upload, X, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { pdfPagesToImages } from "@/lib/pdf-utils"
import { createClient } from "@/lib/supabase/client"

interface ImportItem {
  id: string
  file: File
  preview: string
  codigo: string
  nombre: string
  precio: string
  status: "pending" | "uploading" | "done" | "error"
}

interface CatalogoImportProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CatalogoImport({ open, onOpenChange, onSuccess }: CatalogoImportProps) {
  const [items, setItems] = useState<ImportItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const imageFiles: File[] = []
    let pdfFile: File | null = null

    for (const file of fileArray) {
      if (file.type === "application/pdf") {
        pdfFile = file
      } else if (file.type.startsWith("image/")) {
        imageFiles.push(file)
      }
    }

    setIsProcessing(true)
    const newItems: ImportItem[] = []

    // Add image files
    for (const file of imageFiles) {
      const preview = URL.createObjectURL(file)
      newItems.push({
        id: crypto.randomUUID(),
        file,
        preview,
        codigo: "",
        nombre: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
        precio: "",
        status: "pending",
      })
    }

    // Convert PDF pages to images
    if (pdfFile) {
      try {
        const pageFiles = await pdfPagesToImages(pdfFile)
        for (let i = 0; i < pageFiles.length; i++) {
          const file = pageFiles[i]
          const preview = URL.createObjectURL(file)
          newItems.push({
            id: crypto.randomUUID(),
            file,
            preview,
            nombre: `Arreglo ${i + 1}`,
            precio: "",
            status: "pending",
          })
        }
      } catch (err) {
        console.error("Error processing PDF:", err)
        alert("Error al procesar el PDF. Asegúrate de que el archivo no esté corrupto.")
      }
    }

    setItems((prev) => [...prev, ...newItems])
    setIsProcessing(false)
  }, [])

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

  const updateItem = (id: string, field: "nombre" | "precio" | "codigo", value: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    )
  }

  const handleImport = async () => {
    const toImport = items.filter((i) => i.nombre.trim() && i.precio && parseFloat(i.precio) > 0)
    if (toImport.length === 0) {
      alert("Completa al menos un arreglo con nombre y precio.")
      return
    }

    setIsImporting(true)
    const supabase = createClient()
    let successCount = 0

    for (const item of toImport) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "uploading" as const } : i))
      )
      try {
        const { url } = await uploadToCloudinary(item.file)
        const { error } = await supabase.from("arreglos").insert([
          {
            codigo: item.codigo.trim() || null,
            nombre: item.nombre.trim(),
            descripcion: null,
            foto_url: url,
            precio_real: parseFloat(item.precio),
          },
        ])
        if (error) throw error
        successCount++
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "done" as const } : i))
        )
      } catch (err) {
        console.error("Error importing:", err)
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error" as const } : i))
        )
      }
    }

    setIsImporting(false)
    if (successCount > 0) {
      onSuccess()
      onOpenChange(false)
      setItems([])
    }
  }

  const handleClose = () => {
    items.forEach((i) => URL.revokeObjectURL(i.preview))
    setItems([])
    onOpenChange(false)
  }

  const validCount = items.filter((i) => i.nombre.trim() && i.precio && parseFloat(i.precio) > 0).length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-[95vw] rounded-lg sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar catálogo</DialogTitle>
          <DialogDescription>
            Sube imágenes o un PDF desde Canva. Cada imagen o página se convertirá en un arreglo. Completa nombre y precio para cada uno.
          </DialogDescription>
        </DialogHeader>

        {/* Drop zone */}
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
                  Arrastra imágenes o PDF aquí, o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, PDF desde Canva
                </p>
              </div>
            )}
          </label>
        </div>

        {/* Items list */}
        {items.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              {validCount} de {items.length} listos para importar
            </p>
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
                      <Label className="text-xs">Código</Label>
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
                          placeholder="Ramo romántico"
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
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => removeItem(item.id)}
                    disabled={item.status === "uploading"}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {items.length > 0 && (
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || validCount === 0}
            >
              {isImporting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Importando...
                </>
              ) : (
                `Importar ${validCount} arreglo${validCount !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
