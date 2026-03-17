"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Phone, MapPin, ChevronLeft, ChevronRight, X } from "lucide-react"
import { ListaEntregasDia } from "@/components/pedidos/lista-entregas-dia"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { PageHeader } from "@/components/page-header"
import { createClient } from "@/lib/supabase/client"
import type { Pedido } from "@/lib/types"
import { ESTADO_COLORS } from "@/lib/types"
import { cn } from "@/lib/utils"

async function fetchAllPedidos(): Promise<Pedido[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("pedidos")
    .select(`
      *,
      arreglos (*)
    `)
    .neq("estado", "Cancelado")
    .order("fecha_entrega", { ascending: true })
    .order("hora_entrega", { ascending: true })
  
  if (error) throw error
  return data || []
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return "Sin hora"
  const [hours, minutes] = timeStr.split(":")
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? "pm" : "am"
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

function formatDateLong(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00")
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayStr = today.toISOString().split("T")[0]
  const tomorrowStr = tomorrow.toISOString().split("T")[0]

  if (dateStr === todayStr) {
    return "Hoy"
  } else if (dateStr === tomorrowStr) {
    return "Mañana"
  }

  return date.toLocaleDateString("es-HN", { 
    weekday: "long", 
    day: "numeric", 
    month: "long" 
  })
}

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

interface CalendarGridProps {
  currentMonth: Date
  selectedDate: string | null
  ordersByDate: Record<string, number>
  onSelectDate: (date: string | null) => void
  onChangeMonth: (direction: "prev" | "next") => void
}

function CalendarGrid({ 
  currentMonth, 
  selectedDate, 
  ordersByDate, 
  onSelectDate, 
  onChangeMonth 
}: CalendarGridProps) {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const startingDay = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()
  
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  
  // Generate calendar days
  const calendarDays: (number | null)[] = []
  
  // Add empty cells for days before the first day of month
  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null)
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }
  
  // Pad to complete the last week
  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null)
  }

  const getDateString = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => onChangeMonth("prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-base font-semibold">
            {MONTHS_ES[month]} {year}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => onChangeMonth("next")}
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
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }
            
            const dateStr = getDateString(day)
            const orderCount = ordersByDate[dateStr] || 0
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const hasOrders = orderCount > 0
            
            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(isSelected ? null : dateStr)}
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
                      "absolute bottom-1 text-[10px] font-bold px-1 rounded-full min-w-[16px]",
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
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function CalendarioView() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
  const { data: pedidos, error, isLoading } = useSWR("pedidos-calendario-all", fetchAllPedidos)

  // Count orders by date for calendar indicators
  const ordersByDate = useMemo(() => {
    if (!pedidos) return {}
    
    return pedidos.reduce((counts, pedido) => {
      const date = pedido.fecha_entrega
      counts[date] = (counts[date] || 0) + 1
      return counts
    }, {} as Record<string, number>)
  }, [pedidos])

  // Filter pedidos based on selection
  const filteredPedidos = useMemo(() => {
    if (!pedidos) return []
    
    if (selectedDate) {
      return pedidos.filter(p => p.fecha_entrega === selectedDate)
    }
    
    // Show upcoming orders when no date is selected
    const today = new Date().toISOString().split("T")[0]
    return pedidos.filter(p => p.fecha_entrega >= today)
  }, [pedidos, selectedDate])

  // Group filtered pedidos by date
  const groupedPedidos = useMemo(() => {
    return filteredPedidos.reduce((groups, pedido) => {
      const date = pedido.fecha_entrega
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(pedido)
      return groups
    }, {} as Record<string, Pedido[]>)
  }, [filteredPedidos])

  const sortedDates = useMemo(() => {
    return Object.keys(groupedPedidos).sort()
  }, [groupedPedidos])

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

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Calendario de Entregas" />
        <div className="text-center py-12 text-destructive">
          Error al cargar las entregas
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Calendario de Entregas" 
        description="Vista mensual de entregas"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12 animate-fade-in">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : (
        <>
          {/* Lista de entregas del día (imprimir / Excel) */}
          <ListaEntregasDia />

          {/* Monthly Calendar Grid */}
          <CalendarGrid
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            ordersByDate={ordersByDate}
            onSelectDate={setSelectedDate}
            onChangeMonth={handleChangeMonth}
          />

          {/* Selected date header or clear button */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              {selectedDate 
                ? `Entregas: ${formatDateLong(selectedDate)}`
                : "Próximas entregas"
              }
            </h3>
            {selectedDate && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedDate(null)}
                className="h-8"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Ver todas
              </Button>
            )}
          </div>

          {/* Order cards */}
          {sortedDates.length > 0 ? (
            <div className="space-y-4">
              {sortedDates.map((date) => (
                <Card key={date}>
                  {!selectedDate && (
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-medium capitalize flex items-center gap-2 text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {formatDateLong(date)}
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {groupedPedidos[date].length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                  )}
                  <CardContent className={cn(
                    "space-y-2",
                    selectedDate ? "pt-4" : "pt-0"
                  )}>
                    {groupedPedidos[date].map((pedido) => (
                      <div 
                        key={pedido.id} 
                        className="p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-primary">
                                {formatTime(pedido.hora_entrega)}
                              </span>
                              <Badge className={cn("text-xs", ESTADO_COLORS[pedido.estado])}>
                                {pedido.estado}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-foreground mt-1 truncate">{pedido.cliente}</h4>
                            {pedido.arreglos && (
                              <p className="text-sm text-muted-foreground truncate">{pedido.arreglos.nombre}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold">L{pedido.precio_total.toFixed(0)}</p>
                            {pedido.saldo > 0 && (
                              <p className="text-xs text-amber-600 font-medium">
                                Saldo: L{pedido.saldo.toFixed(0)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-1 text-sm">
                          {pedido.telefono && (
                            <a 
                              href={`tel:${pedido.telefono}`} 
                              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                            >
                              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>{pedido.telefono}</span>
                            </a>
                          )}
                          {pedido.direccion && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{pedido.direccion}</span>
                            </div>
                          )}
                        </div>

                        {pedido.mensaje_tarjeta && (
                          <div className="mt-2 p-2 rounded bg-muted/50 text-sm italic text-muted-foreground">
                            &quot;{pedido.mensaje_tarjeta}&quot;
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  {selectedDate 
                    ? "No hay entregas para esta fecha"
                    : "No hay entregas programadas"
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
