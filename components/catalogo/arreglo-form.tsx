"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Plus, X, Upload, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { uploadToCloudinary } from "@/lib/cloudinary"
import type { Flor, ArregloWithFlores, ArregloFlor } from "@/lib/types"

interface FlorItem {
  flor_id: string
  cantidad: number
  flor?: Flor
}

interface ArregloFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  arreglo?: ArregloWithFlores | null
  flores: Flor[]
  onSubmit: (data: {
    nombre: string
    descripcion: string
    foto_url: string | null
    precio_real: number
    flores: FlorItem[]
  }) => Promise<void>
}

export function ArregloForm({ open, onOpenChange, arreglo, flores, onSubmit }: ArregloFormProps) {
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [precioReal, setPrecioReal] = useState("")
  const [floresSeleccionadas, setFloresSeleccionadas] = useState<FlorItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const isEditing = !!arreglo

  const resetForm = useCallback(() => {
    setNombre("")
    setDescripcion("")
    setFotoUrl(null)
    setPrecioReal("")
    setFloresSeleccionadas([])
  }, [])

  useEffect(() => {
    if (open && arreglo) {
      setNombre(arreglo.nombre)
      setDescripcion(arreglo.descripcion || "")
      setFotoUrl(arreglo.foto_url)
      setPrecioReal(arreglo.precio_real.toString())
      setFloresSeleccionadas(
        arreglo.arreglo_flores?.map((af: ArregloFlor & { flores: Flor }) => ({
          flor_id: af.flor_id,
          cantidad: af.cantidad,
          flor: af.flores
        })) || []
      )
    } else if (!open) {
      resetForm()
    }
  }, [open, arreglo, resetForm])

  const costoEstimado = floresSeleccionadas.reduce((sum, item) => {
    const flor = item.flor || flores.find(f => f.id === item.flor_id)
    return sum + (flor?.precio_actual || 0) * item.cantidad
  }, 0)

  const gananciaEstimada = precioReal ? parseFloat(precioReal) - costoEstimado : 0

  const handleAddFlor = () => {
    setFloresSeleccionadas([...floresSeleccionadas, { flor_id: "", cantidad: 1 }])
  }

  const handleRemoveFlor = (index: number) => {
    setFloresSeleccionadas(floresSeleccionadas.filter((_, i) => i !== index))
  }

  const handleFlorChange = (index: number, florId: string) => {
    const flor = flores.find(f => f.id === florId)
    const updated = [...floresSeleccionadas]
    updated[index] = { ...updated[index], flor_id: florId, flor }
    setFloresSeleccionadas(updated)
  }

  const handleCantidadChange = (index: number, value: string) => {
    const updated = [...floresSeleccionadas]
    // Allow empty string for easier mobile editing, but ensure min of 1 when saving
    const cantidad = value === "" ? 0 : parseInt(value) || 0
    updated[index] = { ...updated[index], cantidad }
    setFloresSeleccionadas(updated)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const result = await uploadToCloudinary(file)
      setFotoUrl(result.url)
    } catch (error) {
      console.error("Error uploading image:", error)
      alert("Error al subir la imagen. Verifica tu configuracion de Cloudinary.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !precioReal) return

    setIsSubmitting(true)
    await onSubmit({
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      foto_url: fotoUrl,
      precio_real: parseFloat(precioReal),
      flores: floresSeleccionadas
        .filter(f => f.flor_id)
        .map(f => ({ ...f, cantidad: Math.max(1, f.cantidad || 1) }))
    })
    setIsSubmitting(false)
    resetForm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] rounded-lg sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Arreglo" : "Nuevo Arreglo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Foto del arreglo</Label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg bg-muted relative overflow-hidden flex-shrink-0">
                {fotoUrl ? (
                  <Image
                    src={fotoUrl}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={isUploading} asChild>
                    <span>
                      {isUploading ? (
                        <>
                          <Spinner className="mr-2 h-4 w-4" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Subir foto
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del arreglo</Label>
            <Input
              id="nombre"
              placeholder="Ej: Ramo romántico"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              placeholder="Descripción del arreglo..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
            />
          </div>

          {/* Flowers Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Flores del arreglo</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handleAddFlor}
                disabled={flores.length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar flor
              </Button>
            </div>
            
            {floresSeleccionadas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {flores.length === 0 
                  ? "Primero agrega flores en la sección Flores"
                  : "Agrega flores para calcular el costo"
                }
              </p>
            ) : (
              <div className="space-y-2">
                {floresSeleccionadas.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={item.flor_id}
                      onValueChange={(value) => handleFlorChange(index, value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar flor" />
                      </SelectTrigger>
                      <SelectContent>
                        {flores.map((flor) => (
                          <SelectItem key={flor.id} value={flor.id}>
                            {flor.nombre} - L{flor.precio_actual.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      defaultValue={item.cantidad > 0 ? item.cantidad.toString() : ""}
                      key={`${index}-${item.flor_id}`}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "")
                        handleCantidadChange(index, val)
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.trim()
                        if (!val || parseInt(val) < 1) {
                          e.target.value = "1"
                          handleCantidadChange(index, "1")
                        }
                      }}
                      className="w-20 text-center h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                      placeholder="1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFlor(index)}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costo estimado de flores:</span>
              <span className="font-medium">L{costoEstimado.toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="precio_real">Precio real de venta (L)</Label>
              <Input
                id="precio_real"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={precioReal}
                onChange={(e) => setPrecioReal(e.target.value)}
                required
              />
            </div>
            {precioReal && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Ganancia estimada:</span>
                <span className={`font-bold ${gananciaEstimada >= 0 ? "text-green-600" : "text-destructive"}`}>
                  L{gananciaEstimada.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isSubmitting || !nombre.trim() || !precioReal}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Guardando...
                </>
              ) : (
                isEditing ? "Guardar" : "Crear arreglo"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
