"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import type { Flor } from "@/lib/types"

interface FlorFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  flor?: Flor | null
  onSubmit: (data: { nombre: string; precio_actual: number }) => Promise<void>
}

export function FlorForm({ open, onOpenChange, flor, onSubmit }: FlorFormProps) {
  const [nombre, setNombre] = useState("")
  const [precio, setPrecio] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!flor

  // Sync state when flor prop changes or dialog opens
  useEffect(() => {
    if (open && flor) {
      setNombre(flor.nombre)
      setPrecio(flor.precio_actual.toString())
    } else if (!open) {
      setNombre("")
      setPrecio("")
    }
  }, [open, flor])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !precio) return

    setIsSubmitting(true)
    await onSubmit({
      nombre: nombre.trim(),
      precio_actual: parseFloat(precio)
    })
    setIsSubmitting(false)
    onOpenChange(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[90vw] rounded-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Flor" : "Nueva Flor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre de la flor</Label>
            <Input
              id="nombre"
              placeholder="Ej: Rosa roja"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="precio">Precio actual (L)</Label>
            <Input
              id="precio"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isSubmitting || !nombre.trim() || !precio}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Guardando...
                </>
              ) : (
                isEditing ? "Guardar" : "Agregar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
