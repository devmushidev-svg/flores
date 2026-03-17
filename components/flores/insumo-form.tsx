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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Insumo } from "@/lib/types"

interface InsumoFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  insumo?: Insumo | null
  onSubmit: (data: { nombre: string; precio_actual: number; unidad: string }) => Promise<void>
}

const UNIDADES = ["unidad", "rollo", "metro", "paquete", "caja", "docena"]

export function InsumoForm({ open, onOpenChange, insumo, onSubmit }: InsumoFormProps) {
  const [nombre, setNombre] = useState("")
  const [precio, setPrecio] = useState("")
  const [unidad, setUnidad] = useState("unidad")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && insumo) {
      setNombre(insumo.nombre)
      setPrecio(insumo.precio_actual.toString())
      setUnidad(insumo.unidad || "unidad")
    } else if (!open) {
      setNombre("")
      setPrecio("")
      setUnidad("unidad")
    }
  }, [open, insumo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !precio) return
    setIsSubmitting(true)
    await onSubmit({ nombre: nombre.trim(), precio_actual: parseFloat(precio), unidad })
    setIsSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{insumo ? "Editar insumo" : "Nuevo insumo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              placeholder="Ej: Cinta satín roja, Papel craft"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="precio">Precio (L)</Label>
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
            <div>
              <Label>Unidad</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {insumo ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
