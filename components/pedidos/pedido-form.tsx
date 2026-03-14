"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import useSWR from "swr"
import { ImageIcon, X, User, Check } from "lucide-react"
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
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { ArregloSelector } from "./arreglo-selector"
import { createClient } from "@/lib/supabase/client"
import type { Flor, ArregloWithFlores, Pedido, EstadoPedido, Cliente } from "@/lib/types"
import { ESTADOS_PEDIDO } from "@/lib/types"

interface PedidoFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedido?: Pedido | null
  arreglos: ArregloWithFlores[]
  flores: Flor[]
  onSubmit: (data: {
    cliente: string
    telefono: string
    direccion: string
    fecha_entrega: string
    hora_entrega: string
    arreglo_id: string | null
    descripcion: string
    mensaje_tarjeta: string
    precio_total: number
    abono: number
    estado: EstadoPedido
  }) => Promise<void>
  onArreglosChange: () => void
}

const fetcher = async () => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("updated_at", { ascending: false })
  if (error) throw error
  return data as Cliente[]
}

export function PedidoForm({ open, onOpenChange, pedido, arreglos, flores, onSubmit, onArreglosChange }: PedidoFormProps) {
  const [cliente, setCliente] = useState("")
  const [telefono, setTelefono] = useState("")
  const [direccion, setDireccion] = useState("")
  const [fechaEntrega, setFechaEntrega] = useState("")
  const [horaEntrega, setHoraEntrega] = useState("")
  const [selectedArreglo, setSelectedArreglo] = useState<ArregloWithFlores | null>(null)
  const [descripcion, setDescripcion] = useState("")
  const [mensajeTarjeta, setMensajeTarjeta] = useState("")
  const [precioTotal, setPrecioTotal] = useState("")
  const [abono, setAbono] = useState("")
  const [estado, setEstado] = useState<EstadoPedido>("Pendiente")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showArregloSelector, setShowArregloSelector] = useState(false)
  
  // Client autocomplete state
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)
  const [clientSearchFocused, setClientSearchFocused] = useState<'telefono' | 'nombre' | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const { data: clientes = [], mutate: mutateClientes } = useSWR(
    open ? "clientes" : null,
    fetcher
  )

  const isEditing = !!pedido

  const resetForm = useCallback(() => {
    setCliente("")
    setTelefono("")
    setDireccion("")
    setFechaEntrega(new Date().toISOString().split("T")[0])
    setHoraEntrega("")
    setSelectedArreglo(null)
    setDescripcion("")
    setMensajeTarjeta("")
    setPrecioTotal("")
    setAbono("")
    setEstado("Pendiente")
  }, [])

  useEffect(() => {
    if (open && pedido) {
      setCliente(pedido.cliente)
      setTelefono(pedido.telefono || "")
      setDireccion(pedido.direccion || "")
      setFechaEntrega(pedido.fecha_entrega)
      setHoraEntrega(pedido.hora_entrega || "")
      const arreglo = arreglos.find(a => a.id === pedido.arreglo_id) || null
      setSelectedArreglo(arreglo)
      setDescripcion(pedido.descripcion || "")
      setMensajeTarjeta(pedido.mensaje_tarjeta || "")
      setPrecioTotal(pedido.precio_total.toString())
      setAbono(pedido.abono.toString())
      setEstado(pedido.estado)
    } else if (open && !pedido) {
      resetForm()
    }
  }, [open, pedido, arreglos, resetForm])

  // Filter clients based on input
  const filteredClients = clientes.filter(c => {
    if (clientSearchFocused === 'telefono' && telefono.length >= 2) {
      return c.telefono.includes(telefono)
    }
    if (clientSearchFocused === 'nombre' && cliente.length >= 2) {
      return c.nombre.toLowerCase().includes(cliente.toLowerCase())
    }
    return false
  })

  const handleSelectClient = (selectedClient: Cliente) => {
    setCliente(selectedClient.nombre)
    setTelefono(selectedClient.telefono)
    if (selectedClient.direccion) {
      setDireccion(selectedClient.direccion)
    }
    setShowClientSuggestions(false)
  }

  // Handle arreglo selection
  const handleArregloSelect = (arreglo: ArregloWithFlores | null) => {
    setSelectedArreglo(arreglo)
    if (arreglo && !precioTotal) {
      setPrecioTotal(arreglo.precio_real.toString())
    }
  }

  const handleClearArreglo = () => {
    setSelectedArreglo(null)
  }

  // Auto-save client after order submission
  const saveClient = async (nombre: string, tel: string, dir: string) => {
    if (!tel || tel.length < 8) return
    const supabase = createClient()
    
    // Upsert: insert or update based on telefono
    const { error } = await supabase
      .from("clientes")
      .upsert(
        { 
          telefono: tel.trim(), 
          nombre: nombre.trim(), 
          direccion: dir.trim() || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'telefono' }
      )
    
    if (!error) {
      mutateClientes()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente.trim() || !fechaEntrega || !precioTotal) return

    setIsSubmitting(true)
    await onSubmit({
      cliente: cliente.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      fecha_entrega: fechaEntrega,
      hora_entrega: horaEntrega,
      arreglo_id: selectedArreglo?.id || null,
      descripcion: descripcion.trim(),
      mensaje_tarjeta: mensajeTarjeta.trim(),
      precio_total: parseFloat(precioTotal),
      abono: parseFloat(abono) || 0,
      estado
    })
    
    // Auto-save client info
    await saveClient(cliente, telefono, direccion)
    
    setIsSubmitting(false)
    resetForm()
    onOpenChange(false)
  }

  const saldo = (parseFloat(precioTotal) || 0) - (parseFloat(abono) || 0)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] rounded-lg sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Pedido" : "Nuevo Pedido"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Customer Info with Autocomplete */}
            <div className="grid grid-cols-2 gap-3">
              {/* Phone input with autocomplete */}
              <div className="space-y-2 relative">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  type="tel"
                  placeholder="9999-9999"
                  value={telefono}
                  onChange={(e) => {
                    setTelefono(e.target.value)
                    if (e.target.value.length >= 2) {
                      setShowClientSuggestions(true)
                      setClientSearchFocused('telefono')
                    }
                  }}
                  onFocus={() => {
                    if (telefono.length >= 2) {
                      setShowClientSuggestions(true)
                      setClientSearchFocused('telefono')
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowClientSuggestions(false), 200)
                  }}
                  autoComplete="off"
                />
                {/* Suggestions dropdown for phone */}
                {showClientSuggestions && clientSearchFocused === 'telefono' && filteredClients.length > 0 && (
                  <div 
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto"
                  >
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-sm"
                        onClick={() => handleSelectClient(c)}
                      >
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{c.nombre}</div>
                          <div className="text-xs text-muted-foreground">{c.telefono}</div>
                        </div>
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Client name input with autocomplete */}
              <div className="space-y-2 relative">
                <Label htmlFor="cliente">Cliente *</Label>
                <Input
                  id="cliente"
                  placeholder="Nombre"
                  value={cliente}
                  onChange={(e) => {
                    setCliente(e.target.value)
                    if (e.target.value.length >= 2) {
                      setShowClientSuggestions(true)
                      setClientSearchFocused('nombre')
                    }
                  }}
                  onFocus={() => {
                    if (cliente.length >= 2) {
                      setShowClientSuggestions(true)
                      setClientSearchFocused('nombre')
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowClientSuggestions(false), 200)
                  }}
                  required
                  autoComplete="off"
                />
                {/* Suggestions dropdown for name */}
                {showClientSuggestions && clientSearchFocused === 'nombre' && filteredClients.length > 0 && (
                  <div 
                    className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto"
                  >
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-sm"
                        onClick={() => handleSelectClient(c)}
                      >
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{c.nombre}</div>
                          <div className="text-xs text-muted-foreground">{c.telefono}</div>
                        </div>
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección de entrega</Label>
              <Input
                id="direccion"
                placeholder="Dirección de entrega"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </div>

            {/* Delivery Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha de entrega *</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hora">Hora de entrega</Label>
                <Input
                  id="hora"
                  type="time"
                  value={horaEntrega}
                  onChange={(e) => setHoraEntrega(e.target.value)}
                />
              </div>
            </div>

            {/* Arrangement Selection */}
            <div className="space-y-2">
              <Label>Arreglo</Label>
              {selectedArreglo ? (
                <Card className="border-primary/50">
                  <CardContent className="p-3 flex gap-3 items-center">
                    <div className="w-14 h-14 rounded-lg bg-muted relative overflow-hidden flex-shrink-0">
                      {selectedArreglo.foto_url ? (
                        <Image
                          src={selectedArreglo.foto_url}
                          alt={selectedArreglo.nombre}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{selectedArreglo.nombre}</h4>
                      <p className="text-sm text-primary font-semibold">
                        L{selectedArreglo.precio_real.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowArregloSelector(true)}
                      >
                        Cambiar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleClearArreglo}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-16 border-dashed"
                  onClick={() => setShowArregloSelector(true)}
                >
                  <span className="text-muted-foreground">Seleccionar del catálogo</span>
                </Button>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción adicional</Label>
              <Textarea
                id="descripcion"
                placeholder="Notas o especificaciones..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
              />
            </div>

            {/* Card Message */}
            <div className="space-y-2">
              <Label htmlFor="mensaje">Mensaje de tarjeta</Label>
              <Textarea
                id="mensaje"
                placeholder="Mensaje para la tarjeta..."
                value={mensajeTarjeta}
                onChange={(e) => setMensajeTarjeta(e.target.value)}
                rows={2}
              />
            </div>

            {/* Pricing */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio total (L) *</Label>
                  <Input
                    id="precio"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={precioTotal}
                    onChange={(e) => setPrecioTotal(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abono">Abono (L)</Label>
                  <Input
                    id="abono"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={abono}
                    onChange={(e) => setAbono(e.target.value)}
                  />
                </div>
              </div>
              {precioTotal && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Saldo pendiente:</span>
                  <span className="font-bold text-primary">L{saldo.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Status (only for editing) */}
            {isEditing && (
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={estado} onValueChange={(value) => setEstado(value as EstadoPedido)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_PEDIDO.map((est) => (
                      <SelectItem key={est} value={est}>
                        {est}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                disabled={isSubmitting || !cliente.trim() || !fechaEntrega || !precioTotal}
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Guardando...
                  </>
                ) : (
                  isEditing ? "Guardar" : "Crear pedido"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ArregloSelector
        open={showArregloSelector}
        onOpenChange={setShowArregloSelector}
        arreglos={arreglos}
        flores={flores}
        selectedArregloId={selectedArreglo?.id || null}
        onSelect={handleArregloSelect}
        onArreglosChange={onArreglosChange}
      />
    </>
  )
}
