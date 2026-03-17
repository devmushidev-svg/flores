"use client"

import { useState, useEffect, useRef } from "react"
import useSWR from "swr"
import Image from "next/image"
import { ImageIcon, User, Check, Zap, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/supabase/client"
import type { ArregloWithFlores, Cliente } from "@/lib/types"

interface QuickOrderFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  arreglos: ArregloWithFlores[]
  onSubmit: (data: {
    cliente: string
    telefono: string
    direccion: string
    domicilio: string
    fecha_entrega: string
    hora_entrega: string
    arreglo_id: string | null
    descripcion: string
    mensaje_tarjeta: string
    precio_total: number
    abono: number
    pago_efectivo: number
    pago_tarjeta: number
    pago_transferencia: number
    estado: "Pendiente"
  }) => Promise<void>
}

const fetchClientes = async () => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("updated_at", { ascending: false })
  if (error) throw error
  return data as Cliente[]
}

export function QuickOrderForm({ open, onOpenChange, arreglos, onSubmit }: QuickOrderFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [telefono, setTelefono] = useState("")
  const [cliente, setCliente] = useState("")
  const [direccion, setDireccion] = useState("")
  const [domicilio, setDomicilio] = useState("")
  const [fechaEntrega, setFechaEntrega] = useState(new Date().toISOString().split("T")[0])
  const [horaEntrega, setHoraEntrega] = useState("")
  const [selectedArreglo, setSelectedArreglo] = useState<ArregloWithFlores | null>(null)
  const [precioTotal, setPrecioTotal] = useState("")
  const [abono, setAbono] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchArreglo, setSearchArreglo] = useState("")
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)

  const telefonoRef = useRef<HTMLInputElement>(null)
  
  const { data: clientes = [], mutate: mutateClientes } = useSWR(
    open ? "quick-order-clientes" : null,
    fetchClientes
  )

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1)
      setTelefono("")
      setCliente("")
      setDireccion("")
      setDomicilio("")
      setFechaEntrega(new Date().toISOString().split("T")[0])
      setHoraEntrega("")
      setSelectedArreglo(null)
      setPrecioTotal("")
      setAbono("")
      setSearchArreglo("")
      // Focus phone input
      setTimeout(() => telefonoRef.current?.focus(), 100)
    }
  }, [open])

  // Filter clients by phone
  const filteredClients = clientes.filter(c => 
    telefono.length >= 2 && c.telefono.includes(telefono)
  )

  // Filter arreglos by search
  const filteredArreglos = arreglos.filter(a =>
    a.nombre.toLowerCase().includes(searchArreglo.toLowerCase())
  )

  const handleSelectClient = (selectedClient: Cliente) => {
    setCliente(selectedClient.nombre)
    setTelefono(selectedClient.telefono)
    if (selectedClient.direccion) {
      setDireccion(selectedClient.direccion)
      setDomicilio(selectedClient.direccion)
    }
    setShowClientSuggestions(false)
    // Auto advance to step 2
    setTimeout(() => setStep(2), 100)
  }

  const handleSelectArreglo = (arreglo: ArregloWithFlores) => {
    setSelectedArreglo(arreglo)
    setPrecioTotal(arreglo.precio_real.toString())
    // Auto advance to step 3
    setStep(3)
  }

  // Auto-save client
  const saveClient = async (nombre: string, tel: string, dir: string) => {
    if (!tel || tel.length < 8) return
    const supabase = createClient()
    await supabase
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
    mutateClientes()
  }

  const handleSubmit = async () => {
    if (!cliente.trim() || !selectedArreglo || !precioTotal) return

    setIsSubmitting(true)
    const abonoVal = parseFloat(abono) || 0
    await onSubmit({
      cliente: cliente.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      domicilio: domicilio.trim() || direccion.trim(),
      fecha_entrega: fechaEntrega,
      hora_entrega: horaEntrega,
      arreglo_id: selectedArreglo.id,
      descripcion: "",
      mensaje_tarjeta: "",
      precio_total: parseFloat(precioTotal),
      abono: abonoVal,
      pago_efectivo: abonoVal,
      pago_tarjeta: 0,
      pago_transferencia: 0,
      estado: "Pendiente"
    })
    
    await saveClient(cliente, telefono, direccion)
    
    setIsSubmitting(false)
    onOpenChange(false)
  }

  const canProceedStep1 = cliente.trim() && telefono.trim()
  const canSubmit = canProceedStep1 && selectedArreglo && precioTotal

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] rounded-lg sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Pedido Rápido
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              Paso {step}/3
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1 mb-2">
          {[1, 2, 3].map((s) => (
            <div 
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Client Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2 relative">
              <Label>Teléfono del cliente</Label>
              <Input
                ref={telefonoRef}
                type="tel"
                placeholder="9999-9999"
                value={telefono}
                onChange={(e) => {
                  setTelefono(e.target.value)
                  if (e.target.value.length >= 2) {
                    setShowClientSuggestions(true)
                  }
                }}
                onFocus={() => {
                  if (telefono.length >= 2) {
                    setShowClientSuggestions(true)
                  }
                }}
                className="text-lg"
                autoComplete="off"
              />
              
              {/* Client suggestions */}
              {showClientSuggestions && filteredClients.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full px-3 py-3 text-left hover:bg-muted flex items-center gap-3"
                      onClick={() => handleSelectClient(c)}
                    >
                      <div className="p-2 bg-primary/10 rounded-full">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{c.nombre}</div>
                        <div className="text-sm text-muted-foreground">{c.telefono}</div>
                      </div>
                      <Check className="h-5 w-5 text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nombre del cliente</Label>
              <Input
                placeholder="Nombre"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label>Dirección del cliente (opcional)</Label>
              <Input
                placeholder="Dirección del cliente"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Domicilio de entrega</Label>
              <Input
                placeholder="Donde se va a entregar"
                value={domicilio}
                onChange={(e) => setDomicilio(e.target.value)}
                className="font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora (opcional)</Label>
                <Input
                  type="time"
                  value={horaEntrega}
                  onChange={(e) => setHoraEntrega(e.target.value)}
                />
              </div>
            </div>

            <Button 
              className="w-full h-12 text-base"
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
            >
              Siguiente: Elegir Arreglo
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Step 2: Select Arrangement */}
        {step === 2 && (
          <div className="space-y-3">
            <Input
              placeholder="Buscar arreglo..."
              value={searchArreglo}
              onChange={(e) => setSearchArreglo(e.target.value)}
              className="mb-2"
              autoFocus
            />

            <div className="grid gap-2 max-h-[50vh] overflow-y-auto">
              {filteredArreglos.map((arreglo) => (
                <Card 
                  key={arreglo.id}
                  className={`cursor-pointer transition-all hover:border-primary ${
                    selectedArreglo?.id === arreglo.id ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => handleSelectArreglo(arreglo)}
                >
                  <CardContent className="p-3 flex gap-3 items-center">
                    <div className="w-14 h-14 rounded-xl bg-muted relative overflow-hidden flex-shrink-0 shadow-md ring-1 ring-black/5">
                      {arreglo.foto_url ? (
                        <Image
                          src={arreglo.foto_url}
                          alt={arreglo.nombre}
                          fill
                          className="object-cover rounded-xl"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{arreglo.nombre}</h4>
                      <p className="text-lg text-primary font-bold">
                        L{arreglo.precio_real.toFixed(2)}
                      </p>
                    </div>
                    {selectedArreglo?.id === arreglo.id && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button 
              variant="outline"
              className="w-full"
              onClick={() => setStep(1)}
            >
              Volver
            </Button>
          </div>
        )}

        {/* Step 3: Confirm & Pay */}
        {step === 3 && selectedArreglo && (
          <div className="space-y-4">
            {/* Summary */}
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cliente</span>
                  <span className="font-medium">{cliente}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Teléfono</span>
                  <span>{telefono}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Entrega</span>
                  <span>{fechaEntrega} {horaEntrega && `a las ${horaEntrega}`}</span>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t">
                  <div className="w-12 h-12 rounded-xl bg-muted relative overflow-hidden flex-shrink-0 shadow-md ring-1 ring-black/5">
                    {selectedArreglo.foto_url ? (
                      <Image
                        src={selectedArreglo.foto_url}
                        alt={selectedArreglo.nombre}
                        fill
                        className="object-cover rounded-xl"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{selectedArreglo.nombre}</p>
                    <p className="text-primary font-bold">L{selectedArreglo.precio_real.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Price adjustment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Precio (L)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={precioTotal}
                  onChange={(e) => setPrecioTotal(e.target.value)}
                  className="text-lg font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label>Abono (L)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={abono}
                  onChange={(e) => setAbono(e.target.value)}
                  placeholder="0.00"
                  className="text-lg"
                />
              </div>
            </div>

            {/* Saldo */}
            {precioTotal && (
              <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
                <span className="font-medium">Saldo pendiente:</span>
                <span className="text-xl font-bold text-primary">
                  L{((parseFloat(precioTotal) || 0) - (parseFloat(abono) || 0)).toFixed(2)}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => setStep(2)}
              >
                Volver
              </Button>
              <Button 
                className="flex-1 h-12 text-base"
                onClick={handleSubmit}
                disabled={isSubmitting || !canSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Guardando...
                  </>
                ) : (
                  "Crear Pedido"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
