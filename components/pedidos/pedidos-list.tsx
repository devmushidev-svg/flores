"use client"

import { useState } from "react"
import useSWR from "swr"
import { Plus, Filter, Zap, Calendar, X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { PedidoCard } from "./pedido-card"
import { PedidoForm } from "./pedido-form"
import { QuickOrderForm } from "./quick-order-form"
import { createClient } from "@/lib/supabase/client"
import type { Flor, ArregloWithFlores, Pedido, EstadoPedido } from "@/lib/types"
import { ESTADOS_PEDIDO, ESTADO_COLORS } from "@/lib/types"

async function fetchPedidos(): Promise<Pedido[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("pedidos")
    .select(`
      *,
      arreglos (*)
    `)
    .order("fecha_entrega", { ascending: true })
    .order("hora_entrega", { ascending: true })
  
  if (error) throw error
  return data || []
}

async function fetchArreglosWithFlores(): Promise<ArregloWithFlores[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("arreglos")
    .select(`
      *,
      arreglo_flores (
        id,
        flor_id,
        cantidad,
        flores (*)
      )
    `)
    .eq("is_active", true)
    .order("nombre")
  
  if (error) throw error
  return data || []
}

async function fetchFlores(): Promise<Flor[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("flores")
    .select("*")
    .eq("is_active", true)
    .order("nombre")
  
  if (error) throw error
  return data || []
}

export function PedidosList() {
  const { data: pedidos, error: pedidosError, isLoading: pedidosLoading, mutate: mutatePedidos } = useSWR("pedidos", fetchPedidos)
  const { data: arreglos, isLoading: arreglosLoading, mutate: mutateArreglos } = useSWR("arreglos-with-flores", fetchArreglosWithFlores)
  const { data: flores, isLoading: floresLoading } = useSWR("flores-active", fetchFlores)
  const [showForm, setShowForm] = useState(false)
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null)
  const [filterEstado, setFilterEstado] = useState<EstadoPedido | "todos">("todos")
  // Default to today's date to show today's orders first
  const [filterFecha, setFilterFecha] = useState<string | null>(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => new Date())

  const handleArreglosChange = () => {
    mutateArreglos()
  }

  const handleCreate = async (data: {
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
    pago_efectivo?: number
    pago_tarjeta?: number
    pago_transferencia?: number
    estado: EstadoPedido
  }) => {
    const supabase = createClient()
    const insertData = {
      ...data,
      pago_efectivo: data.pago_efectivo ?? (data.abono > 0 ? data.abono : 0),
      pago_tarjeta: data.pago_tarjeta ?? 0,
      pago_transferencia: data.pago_transferencia ?? 0
    }
    const { error } = await supabase.from("pedidos").insert([insertData])
    if (error) throw error
    mutatePedidos()
  }

  const handleUpdate = async (data: {
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
    pago_efectivo?: number
    pago_tarjeta?: number
    pago_transferencia?: number
    estado: EstadoPedido
  }) => {
    if (!editingPedido) return
    const supabase = createClient()
    const updateData = {
      ...data,
      pago_efectivo: data.pago_efectivo ?? (data.abono > 0 ? data.abono : 0),
      pago_tarjeta: data.pago_tarjeta ?? 0,
      pago_transferencia: data.pago_transferencia ?? 0
    }
    const { error } = await supabase
      .from("pedidos")
      .update(updateData)
      .eq("id", editingPedido.id)
    if (error) throw error
    setEditingPedido(null)
    mutatePedidos()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", id)
    if (error) throw error
    mutatePedidos()
  }

  const handleStatusChange = async (id: string, estado: EstadoPedido) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("pedidos")
      .update({ estado })
      .eq("id", id)
    if (error) throw error
    mutatePedidos()
  }

  const handlePaymentUpdate = async (id: string, amount: number, metodoPago: 'efectivo' | 'tarjeta' | 'transferencia') => {
    const pedido = pedidos?.find(p => p.id === id)
    if (!pedido) return
    const pagoEfectivo = (pedido.pago_efectivo ?? 0) + (metodoPago === 'efectivo' ? amount : 0)
    const pagoTarjeta = (pedido.pago_tarjeta ?? 0) + (metodoPago === 'tarjeta' ? amount : 0)
    const pagoTransferencia = (pedido.pago_transferencia ?? 0) + (metodoPago === 'transferencia' ? amount : 0)
    const nuevoAbono = pagoEfectivo + pagoTarjeta + pagoTransferencia
    const supabase = createClient()
    const { error } = await supabase
      .from("pedidos")
      .update({ abono: nuevoAbono, pago_efectivo: pagoEfectivo, pago_tarjeta: pagoTarjeta, pago_transferencia: pagoTransferencia })
      .eq("id", id)
    if (error) throw error
    mutatePedidos()
  }

  const handleEdit = (pedido: Pedido) => {
    setEditingPedido(pedido)
  }

  const isLoading = pedidosLoading || arreglosLoading || floresLoading

  // Calendar constants
  const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
  const MONTHS_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ]

  // Count orders by date for calendar indicators
  const ordersByDate = pedidos?.reduce((counts, pedido) => {
    const date = pedido.fecha_entrega
    counts[date] = (counts[date] || 0) + 1
    return counts
  }, {} as Record<string, number>) || {}

  const filteredPedidos = pedidos?.filter(p => {
    const matchesEstado = filterEstado === "todos" || p.estado === filterEstado
    const matchesFecha = !filterFecha || p.fecha_entrega === filterFecha
    return matchesEstado && matchesFecha
  }) || []

  const handleChangeMonth = (direction: "prev" | "next") => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }

  const getDateString = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00")
    return date.toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" })
  }

  if (pedidosError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pedidos" description="Gestiona tus pedidos" />
        <div className="text-center py-12 text-destructive">
          Error al cargar los pedidos
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Pedidos" 
        description="Gestiona tus pedidos"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => setShowQuickForm(true)}>
              <Zap className="h-4 w-4 mr-1" />
              Rápido
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nuevo
            </Button>
          </div>
        }
      />

      {/* Filters Section */}
      <div className="space-y-3">
        {/* Date Filter Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={showCalendar || filterFecha ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCalendar(!showCalendar)}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            {filterFecha ? formatDateLabel(filterFecha) : "Filtrar por fecha"}
          </Button>
          {filterFecha && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterFecha(null)
                setShowCalendar(false)
              }}
              className="h-8 px-2"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Calendar Picker */}
        {showCalendar && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => handleChangeMonth("prev")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-sm font-semibold">
                  {MONTHS_ES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => handleChangeMonth("next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {/* Days header */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_ES.map((day) => (
                  <div 
                    key={day} 
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const year = currentMonth.getFullYear()
                  const month = currentMonth.getMonth()
                  const firstDayOfMonth = new Date(year, month, 1)
                  const lastDayOfMonth = new Date(year, month + 1, 0)
                  const startingDay = firstDayOfMonth.getDay()
                  const daysInMonth = lastDayOfMonth.getDate()
                  const today = new Date()
                  const todayStr = today.toISOString().split("T")[0]
                  
                  const calendarDays: (number | null)[] = []
                  for (let i = 0; i < startingDay; i++) calendarDays.push(null)
                  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day)
                  while (calendarDays.length % 7 !== 0) calendarDays.push(null)

                  return calendarDays.map((day, index) => {
                    if (day === null) {
                      return <div key={`empty-${index}`} className="aspect-square" />
                    }
                    
                    const dateStr = getDateString(year, month, day)
                    const orderCount = ordersByDate[dateStr] || 0
                    const isToday = dateStr === todayStr
                    const isSelected = dateStr === filterFecha
                    const hasOrders = orderCount > 0
                    
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => {
                          setFilterFecha(isSelected ? null : dateStr)
                          if (!isSelected) setShowCalendar(false)
                        }}
                        className={cn(
                          "aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all",
                          "text-sm font-medium",
                          isSelected 
                            ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" 
                            : isToday 
                              ? "bg-accent text-accent-foreground" 
                              : "hover:bg-muted",
                          hasOrders && !isSelected && "font-semibold"
                        )}
                      >
                        <span>{day}</span>
                        {hasOrders && (
                          <span 
                            className={cn(
                              "absolute bottom-0.5 text-[9px] font-bold px-1 rounded-full min-w-[14px]",
                              isSelected 
                                ? "bg-primary-foreground/20 text-primary-foreground" 
                                : "bg-primary/15 text-primary"
                            )}
                          >
                            {orderCount}
                          </span>
                        )}
                      </button>
                    )
                  })
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Badge
            variant={filterEstado === "todos" ? "default" : "outline"}
            className="cursor-pointer flex-shrink-0"
            onClick={() => setFilterEstado("todos")}
          >
            Todos
          </Badge>
          {ESTADOS_PEDIDO.map((est) => (
            <Badge
              key={est}
              variant="outline"
              className={`cursor-pointer flex-shrink-0 ${filterEstado === est ? ESTADO_COLORS[est] : ""}`}
              onClick={() => setFilterEstado(est)}
            >
              {est}
            </Badge>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 animate-fade-in">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : filteredPedidos.length > 0 ? (
        <div className="space-y-3">
          {filteredPedidos.map((pedido, idx) => (
            <div 
              key={pedido.id}
              className="animate-fade-in-up opacity-0"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
            <PedidoCard
              pedido={pedido}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onPaymentUpdate={handlePaymentUpdate}
            />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-muted-foreground mb-4">
            {filterFecha 
              ? `No hay pedidos para ${formatDateLabel(filterFecha)}`
              : filterEstado === "todos" 
                ? "No hay pedidos registrados" 
                : `No hay pedidos "${filterEstado}"`
            }
          </p>
          {filterEstado === "todos" && !filterFecha && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Crear primer pedido
            </Button>
          )}
          {filterFecha && (
            <Button variant="outline" onClick={() => setFilterFecha(null)}>
              Ver todos los pedidos
            </Button>
          )}
        </div>
      )}

      <PedidoForm
        open={showForm}
        onOpenChange={setShowForm}
        arreglos={arreglos || []}
        flores={flores || []}
        onSubmit={handleCreate}
        onArreglosChange={handleArreglosChange}
      />

      <PedidoForm
        open={!!editingPedido}
        onOpenChange={(open) => !open && setEditingPedido(null)}
        pedido={editingPedido}
        arreglos={arreglos || []}
        flores={flores || []}
        onSubmit={handleUpdate}
        onArreglosChange={handleArreglosChange}
      />

      <QuickOrderForm
        open={showQuickForm}
        onOpenChange={setShowQuickForm}
        arreglos={arreglos || []}
        onSubmit={handleCreate}
      />
    </div>
  )
}
