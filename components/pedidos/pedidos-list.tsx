"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Plus, Filter, Zap, Calendar, X, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { PedidoCard } from "./pedido-card"
import { PedidoForm } from "./pedido-form"
import { QuickOrderForm } from "./quick-order-form"
import { createClient } from "@/lib/supabase/client"
import { hoyISO, rangoMesISO } from "@/lib/fechas"
import {
  fetchConteoPorFecha,
  fetchPedidosLista,
  fetchPedidosRango,
  PAGINA_PEDIDOS,
  registrarAbono,
  revalidarPedidos,
} from "@/lib/pedidos-data"
import { useDebounce } from "@/hooks/use-debounce"
import type { Flor, ArregloWithFlores, Pedido, EstadoPedido, MetodoPago } from "@/lib/types"
import { ESTADOS_PEDIDO, ESTADO_COLORS } from "@/lib/types"

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
  const { data: arreglos, isLoading: arreglosLoading, mutate: mutateArreglos } = useSWR("arreglos-with-flores", fetchArreglosWithFlores)
  const { data: flores } = useSWR("flores-active", fetchFlores)
  const [showForm, setShowForm] = useState(false)
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null)
  const [filterEstado, setFilterEstado] = useState<EstadoPedido | "todos">("todos")
  // Por defecto se muestran los pedidos de hoy (fecha local del teléfono, no UTC).
  // Se calcula al montar en el navegador: la página se pre-genera en el servidor (en UTC)
  // y calcular "hoy" allí causaba un desajuste de hidratación.
  const [filterFecha, setFilterFecha] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    setFilterFecha((actual) => (actual === undefined ? hoyISO() : actual))
  }, [])
  const fechaLista = filterFecha !== undefined
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [searchTerm, setSearchTerm] = useState("")
  const [limite, setLimite] = useState(PAGINA_PEDIDOS)

  // Búsqueda: diferida para no bloquear el teclado, y con pausa para el servidor
  const deferredSearch = useDeferredValue(searchTerm)
  const normalizedSearch = useMemo(() => deferredSearch.trim().toLowerCase(), [deferredSearch])
  const debouncedSearch = useDebounce(normalizedSearch, 350)

  const arregloIdsCoinciden = useMemo(() => {
    if (!debouncedSearch || !arreglos) return []
    return arreglos.filter((a) => a.nombre.toLowerCase().includes(debouncedSearch)).map((a) => a.id)
  }, [arreglos, debouncedSearch])

  // Con fecha: sólo los pedidos de ese día. Sin fecha: lista paginada desde el servidor.
  const { data: pedidos, error: pedidosError, isLoading: pedidosLoading } = useSWR(
    !fechaLista
      ? null
      : filterFecha
        ? ["pedidos", "rango", filterFecha, filterFecha]
        : ["pedidos", "lista", filterEstado, debouncedSearch, arregloIdsCoinciden.join(","), limite],
    () =>
      filterFecha
        ? fetchPedidosRango(filterFecha, filterFecha)
        : fetchPedidosLista({ limite, estado: filterEstado, busqueda: debouncedSearch, arregloIdsCoinciden }),
    { keepPreviousData: true },
  )

  // Conteo por día para el calendario: sólo el mes visible y sólo la columna fecha
  const mesVisible = rangoMesISO(currentMonth)
  const { data: ordersByDate = {} } = useSWR(
    showCalendar ? ["pedidos", "conteo", mesVisible.desde, mesVisible.hasta] : null,
    () => fetchConteoPorFecha(mesVisible.desde, mesVisible.hasta),
  )

  const handleArreglosChange = () => {
    mutateArreglos()
  }

  const handleCreate = async (data: {
    cliente: string
    telefono: string
    direccion: string
    domicilio: string
    fecha_entrega: string | null
    hora_entrega: string | null
    arreglo_id: string | null
    foto_url: string | null
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
    const today = hoyISO()
    const insertData = {
      ...data,
      fecha_entrega: data.fecha_entrega || today,
      pago_efectivo: data.pago_efectivo ?? (data.abono > 0 ? data.abono : 0),
      pago_tarjeta: data.pago_tarjeta ?? 0,
      pago_transferencia: data.pago_transferencia ?? 0
    }
    const { error } = await supabase.from("pedidos").insert([insertData])
    if (error) throw error
    await revalidarPedidos()
  }

  const handleUpdate = async (data: {
    cliente: string
    telefono: string
    direccion: string
    domicilio: string
    fecha_entrega: string | null
    hora_entrega: string | null
    arreglo_id: string | null
    foto_url: string | null
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
    const today = hoyISO()
    const updateData = {
      ...data,
      fecha_entrega: data.fecha_entrega || editingPedido.fecha_entrega || today,
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
    await revalidarPedidos()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", id)
    if (error) throw error
    await revalidarPedidos()
  }

  const handleStatusChange = async (id: string, estado: EstadoPedido) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("pedidos")
      .update({ estado })
      .eq("id", id)
    if (error) throw error
    await revalidarPedidos()
  }

  const handlePaymentUpdate = async (id: string, amount: number, metodoPago: MetodoPago) => {
    const pedido = pedidos?.find(p => p.id === id)
    if (!pedido) return
    await registrarAbono(pedido, amount, metodoPago)
    await revalidarPedidos()
  }

  const handleEdit = (pedido: Pedido) => {
    setEditingPedido(pedido)
  }

  const isLoading = !fechaLista || pedidosLoading || arreglosLoading

  // Calendar constants
  const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
  const MONTHS_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ]

  // Con fecha seleccionada se filtra en el teléfono (son pocos pedidos);
  // en "ver todos" el servidor ya aplicó estado y búsqueda.
  const filteredPedidos = useMemo(() => {
    if (!pedidos) return []
    if (!filterFecha) return pedidos
    return pedidos.filter((p) => {
      const matchesEstado = filterEstado === "todos" || p.estado === filterEstado
      const matchesSearch =
        !normalizedSearch ||
        (p.cliente || "").toLowerCase().includes(normalizedSearch) ||
        (p.telefono || "").toLowerCase().includes(normalizedSearch) ||
        (p.arreglos?.nombre || "").toLowerCase().includes(normalizedSearch)
      return matchesEstado && matchesSearch
    })
  }, [pedidos, filterFecha, filterEstado, normalizedSearch])

  const hayMas = !filterFecha && (pedidos?.length ?? 0) >= limite

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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por cliente, teléfono o arreglo..."
            className="pl-9"
          />
        </div>
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
                  const todayStr = hoyISO()
                  
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
              style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}
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
          {hayMas && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => setLimite((l) => l + PAGINA_PEDIDOS)}>
                Cargar más pedidos
              </Button>
            </div>
          )}
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
