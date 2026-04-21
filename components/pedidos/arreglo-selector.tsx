"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import Image from "next/image"
import { Search, Plus, ImageIcon, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { ArregloForm } from "@/components/catalogo/arreglo-form"
import { createClient } from "@/lib/supabase/client"
import type { Flor, ArregloWithFlores } from "@/lib/types"

interface FlorItem {
  flor_id: string
  cantidad: number
}

interface ArregloSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  arreglos: ArregloWithFlores[]
  flores: Flor[]
  selectedArregloId: string | null
  onSelect: (arreglo: ArregloWithFlores | null) => void
  onArreglosChange: () => void
}

export function ArregloSelector({
  open,
  onOpenChange,
  arreglos,
  flores,
  selectedArregloId,
  onSelect,
  onArreglosChange
}: ArregloSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Reset search when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery("")
    }
  }, [open])

  const filteredArreglos = useMemo(() => {
    const sorted = [...arreglos].sort((a, b) => {
      const aCodigo = (a.codigo || "ZZZ").trim()
      const bCodigo = (b.codigo || "ZZZ").trim()
      return aCodigo.localeCompare(bCodigo, "es", { numeric: true, sensitivity: "base" })
    })

    if (!searchQuery.trim()) return sorted

    const query = searchQuery.toLowerCase()
    return sorted.filter((a) =>
      (a.codigo || "").toLowerCase().includes(query) ||
      a.nombre.toLowerCase().includes(query) ||
      a.descripcion?.toLowerCase().includes(query)
    )
  }, [arreglos, searchQuery])

  const handleSelect = (arreglo: ArregloWithFlores) => {
    onSelect(arreglo)
    onOpenChange(false)
  }

  const handleClearSelection = () => {
    onSelect(null)
    onOpenChange(false)
  }

  const handleCreateArreglo = useCallback(async (data: {
    nombre: string
    descripcion: string
    foto_url: string | null
    precio_real: number
    flores: FlorItem[]
  }) => {
    const supabase = createClient()
    
    // Create the arreglo
    const { data: newArreglo, error: arregloError } = await supabase
      .from("arreglos")
      .insert([{
        nombre: data.nombre,
        descripcion: data.descripcion,
        foto_url: data.foto_url,
        precio_real: data.precio_real
      }])
      .select()
      .single()
    
    if (arregloError) throw arregloError

    // Add flores to the arreglo
    if (data.flores.length > 0 && newArreglo) {
      const floresData = data.flores.map(f => ({
        arreglo_id: newArreglo.id,
        flor_id: f.flor_id,
        cantidad: f.cantidad
      }))
      
      await supabase
        .from("arreglo_flores")
        .insert(floresData)
    }

    // Refresh arreglos list
    onArreglosChange()
    setShowCreateForm(false)
  }, [onArreglosChange])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] rounded-lg sm:max-w-lg max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Seleccionar Arreglo</DialogTitle>
          </DialogHeader>
          
          {/* Search & Create */}
          <div className="px-4 py-3 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por codigo, nombre o descripcion..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear nuevo arreglo
            </Button>
          </div>

          {/* Arreglos List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Clear Selection Option */}
            {selectedArregloId && (
              <Card 
                className="cursor-pointer border-dashed hover:border-primary transition-colors"
                onClick={handleClearSelection}
              >
                <CardContent className="p-3 text-center text-muted-foreground">
                  Quitar arreglo seleccionado
                </CardContent>
              </Card>
            )}

            {filteredArreglos.length > 0 ? (
              filteredArreglos.map((arreglo) => {
                const isSelected = arreglo.id === selectedArregloId
                return (
                  <Card 
                    key={arreglo.id}
                    className={`cursor-pointer transition-all ${
                      isSelected 
                        ? "ring-2 ring-primary border-primary" 
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => handleSelect(arreglo)}
                  >
                    <CardContent className="p-3 flex gap-3">
                      {/* Image */}
                      <div className="w-16 h-16 rounded-xl bg-muted relative overflow-hidden flex-shrink-0 shadow-md ring-1 ring-black/5">
                        {arreglo.foto_url ? (
                          <Image
                            src={arreglo.foto_url}
                            alt={arreglo.nombre}
                            fill
                            className="object-cover rounded-xl"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {arreglo.codigo && (
                              <span className="text-xs font-mono text-primary font-medium block mb-0.5">{arreglo.codigo}</span>
                            )}
                            <h4 className="font-medium text-sm truncate">{arreglo.nombre}</h4>
                            {arreglo.descripcion && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {arreglo.descripcion}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <Badge className="bg-primary text-primary-foreground flex-shrink-0">
                              <Check className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary">
                            L{arreglo.precio_real.toFixed(2)}
                          </span>
                          {arreglo.arreglo_flores && arreglo.arreglo_flores.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {arreglo.arreglo_flores.length} flores
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? (
                  <>
                    <p>No se encontraron arreglos</p>
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={() => setShowCreateForm(true)}
                    >
                      Crear "{searchQuery}"
                    </Button>
                  </>
                ) : (
                  <>
                    <p>No hay arreglos en el catálogo</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setShowCreateForm(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Crear primer arreglo
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Arreglo Form */}
      <ArregloForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        flores={flores}
        onSubmit={handleCreateArreglo}
      />
    </>
  )
}
