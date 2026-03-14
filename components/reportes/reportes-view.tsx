"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, addDays, parseISO, isWithinInterval } from "date-fns"
import { es } from "date-fns/locale"
import { 
  Calendar as CalendarIcon, 
  DollarSign, 
  Package, 
  TrendingUp, 
  ChevronDown,
  Flower2,
  Users,
  Truck,
  ClipboardList
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { ESTADO_COLORS } from "@/lib/types"
import type { Pedido, ArregloWithFlores } from "@/lib/types"
import type { DateRange } from "react-day-picker"

type PeriodType = "hoy" | "semana" | "mes" | "ultimos30"

const periodLabels: Record<PeriodType, string> = {
  hoy: "Hoy",
  semana: "Esta semana",
  mes: "Este mes",
  ultimos30: "Últimos 30 días"
}

const fetcher = async () => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, arreglos(*)")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data as Pedido[]
}

const fetchArreglos = async () => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("arreglos")
    .select("*, arreglo_flores(*, flores(*))")
    .eq("is_active", true)
  if (error) throw error
  return data as ArregloWithFlores[]
}

// Insumos data types and fetchers
interface ArregloFloresData {
  arreglo_id: string
  flor_id: string
  cantidad: number
  flores: {
    id: string
    nombre: string
  }
}

interface FlowerRequirement {
  flor_id: string
  nombre: string
  cantidad: number
}

async function fetchPedidosByDateRange(dateFrom: string, dateTo: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, fecha_entrega, estado, arreglo_id")
    .gte("fecha_entrega", dateFrom)
    .lte("fecha_entrega", dateTo)
    .in("estado", ["Pendiente", "En preparación"])
  
  if (error) throw error
  return data || []
}

async function fetchArregloFlores(arregloIds: string[]): Promise<ArregloFloresData[]> {
  if (arregloIds.length === 0) return []
  
  const supabase = createClient()
  const { data, error } = await supabase
    .from("arreglo_flores")
    .select(`
      arreglo_id,
      flor_id,
      cantidad,
      flores (
        id,
        nombre
      )
    `)
    .in("arreglo_id", arregloIds)
  
  if (error) throw error
  return (data as unknown as ArregloFloresData[]) || []
}

export function ReportesView() {
  const [activeTab, setActiveTab] = useState<"reportes" | "insumos">("reportes")
  const [period, setPeriod] = useState<PeriodType>("hoy")
  
  // Date range picker state for Insumos
  const today = new Date()
  const [insumosDateRange, setInsumosDateRange] = useState<DateRange | undefined>({
    from: today,
    to: addDays(today, 7)
  })
  
  const { data: pedidos = [], isLoading: loadingPedidos } = useSWR("reportes-pedidos", fetcher)
  const { data: arreglos = [], isLoading: loadingArreglos } = useSWR("reportes-arreglos", fetchArreglos)
  
  // Insumos data fetching
  const insumosDateFrom = insumosDateRange?.from ? format(insumosDateRange.from, "yyyy-MM-dd") : format(today, "yyyy-MM-dd")
  const insumosDateTo = insumosDateRange?.to ? format(insumosDateRange.to, "yyyy-MM-dd") : insumosDateFrom
  
  const { data: insumosPedidos, isLoading: loadingInsumosPedidos } = useSWR(
    activeTab === "insumos" ? `insumos-pedidos-${insumosDateFrom}-${insumosDateTo}` : null,
    () => fetchPedidosByDateRange(insumosDateFrom, insumosDateTo)
  )
  
  const insumosArregloIds = useMemo(() => {
    if (!insumosPedidos) return []
    return [...new Set(insumosPedidos.filter(p => p.arreglo_id).map(p => p.arreglo_id as string))]
  }, [insumosPedidos])
  
  const { data: insumosArregloFlores, isLoading: loadingInsumosFlores } = useSWR(
    insumosArregloIds.length > 0 ? `insumos-flores-${insumosArregloIds.join("-")}` : null,
    () => fetchArregloFlores(insumosArregloIds)
  )
  
  const flowerRequirements = useMemo((): FlowerRequirement[] => {
    if (!insumosPedidos || !insumosArregloFlores) return []

    const arregloCounts: Record<string, number> = {}
    insumosPedidos.forEach(pedido => {
      if (pedido.arreglo_id) {
        arregloCounts[pedido.arreglo_id] = (arregloCounts[pedido.arreglo_id] || 0) + 1
      }
    })

    const flowerTotals: Record<string, { nombre: string; cantidad: number }> = {}
    
    insumosArregloFlores.forEach(af => {
      if (af.flores && af.arreglo_id) {
        const florId = af.flor_id
        const orderCount = arregloCounts[af.arreglo_id] || 0
        
        if (!flowerTotals[florId]) {
          flowerTotals[florId] = { nombre: af.flores.nombre, cantidad: 0 }
        }
        flowerTotals[florId].cantidad += af.cantidad * orderCount
      }
    })

    return Object.entries(flowerTotals)
      .map(([flor_id, data]) => ({
        flor_id,
        nombre: data.nombre,
        cantidad: data.cantidad
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
  }, [insumosPedidos, insumosArregloFlores])
  
  const totalInsumosPedidos = insumosPedidos?.filter(p => p.arreglo_id).length || 0

  const isLoading = loadingPedidos || loadingArreglos

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    switch (period) {
      case "hoy":
        return { start: today, end: new Date() }
      case "semana":
        return { start: startOfWeek(today, { locale: es }), end: endOfWeek(today, { locale: es }) }
      case "mes":
        return { start: startOfMonth(today), end: endOfMonth(today) }
      case "ultimos30":
        return { start: subDays(today, 30), end: new Date() }
    }
  }, [period])

  // Filter pedidos by period (using created_at)
  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      const createdAt = parseISO(p.created_at)
      return isWithinInterval(createdAt, { start: dateRange.start, end: dateRange.end })
    })
  }, [pedidos, dateRange])

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredPedidos.length
    const entregados = filteredPedidos.filter(p => p.estado === "Entregado").length
    const cancelados = filteredPedidos.filter(p => p.estado === "Cancelado").length
    const pendientes = filteredPedidos.filter(p => p.estado === "Pendiente").length
    const enRuta = filteredPedidos.filter(p => p.estado === "En ruta").length
    const enPreparacion = filteredPedidos.filter(p => p.estado === "En preparación").length

    // Revenue calculations (only from delivered orders)
    const ingresos = filteredPedidos
      .filter(p => p.estado === "Entregado")
      .reduce((sum, p) => sum + p.precio_total, 0)
    
    const abonosRecibidos = filteredPedidos.reduce((sum, p) => sum + p.abono, 0)
    const saldoPendiente = filteredPedidos
      .filter(p => p.estado !== "Cancelado")
      .reduce((sum, p) => sum + p.saldo, 0)

    // Average order value
    const promedioOrden = total > 0 ? ingresos / entregados : 0

    // Most popular arreglos
    const arregloCount: Record<string, { nombre: string, count: number }> = {}
    filteredPedidos.forEach(p => {
      if (p.arreglo_id && p.arreglos) {
        if (!arregloCount[p.arreglo_id]) {
          arregloCount[p.arreglo_id] = { nombre: p.arreglos.nombre, count: 0 }
        }
        arregloCount[p.arreglo_id].count++
      }
    })
    const topArreglos = Object.values(arregloCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Unique clients
    const uniqueClients = new Set(filteredPedidos.map(p => p.telefono || p.cliente)).size

    return {
      total,
      entregados,
      cancelados,
      pendientes,
      enRuta,
      enPreparacion,
      ingresos,
      abonosRecibidos,
      saldoPendiente,
      promedioOrden,
      topArreglos,
      uniqueClients,
      tasaEntrega: total > 0 ? (entregados / (total - cancelados)) * 100 : 0
    }
  }, [filteredPedidos])

  return (
    <AppShell>
      <div className="flex flex-col gap-4 p-4 pb-24">
        <PageHeader 
          title="Reportes" 
          description="Análisis de ventas y pedidos"
        />
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "reportes" | "insumos")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reportes" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Ventas
            </TabsTrigger>
            <TabsTrigger value="insumos" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Insumos
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="reportes" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {periodLabels[period]}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(periodLabels) as PeriodType[]).map((p) => (
                <DropdownMenuItem 
                  key={p} 
                  onClick={() => setPeriod(p)}
                  className={period === p ? "bg-muted" : ""}
                >
                  {periodLabels[p]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-green-700" />
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Ingresos</p>
                      <p className="text-xl font-bold text-green-800">L{stats.ingresos.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-sm text-amber-700">Por cobrar</p>
                      <p className="text-xl font-bold text-amber-800">L{stats.saldoPendiente.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Pedidos ({periodLabels[period]})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{stats.total}</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.uniqueClients} clientes
                  </span>
                </div>

                {/* Status breakdown */}
                <div className="space-y-2">
                  {stats.entregados > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${ESTADO_COLORS["Entregado"]}`}>
                          Entregados
                        </span>
                      </div>
                      <span className="font-medium">{stats.entregados}</span>
                    </div>
                  )}
                  {stats.pendientes > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${ESTADO_COLORS["Pendiente"]}`}>
                          Pendientes
                        </span>
                      </div>
                      <span className="font-medium">{stats.pendientes}</span>
                    </div>
                  )}
                  {stats.enPreparacion > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${ESTADO_COLORS["En preparación"]}`}>
                          En preparación
                        </span>
                      </div>
                      <span className="font-medium">{stats.enPreparacion}</span>
                    </div>
                  )}
                  {stats.enRuta > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${ESTADO_COLORS["En ruta"]}`}>
                          En ruta
                        </span>
                      </div>
                      <span className="font-medium">{stats.enRuta}</span>
                    </div>
                  )}
                  {stats.cancelados > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${ESTADO_COLORS["Cancelado"]}`}>
                          Cancelados
                        </span>
                      </div>
                      <span className="font-medium">{stats.cancelados}</span>
                    </div>
                  )}
                </div>

                {/* Delivery rate */}
                {stats.total > 0 && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Tasa de entrega</span>
                      <span className="font-medium">{stats.tasaEntrega.toFixed(0)}%</span>
                    </div>
                    <Progress value={stats.tasaEntrega} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Resumen Financiero
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Abonos recibidos</span>
                  <span className="font-medium">L{stats.abonosRecibidos.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Saldo pendiente</span>
                  <span className="font-medium text-amber-600">L{stats.saldoPendiente.toFixed(2)}</span>
                </div>
                {stats.entregados > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Promedio por pedido</span>
                    <span className="font-medium">L{stats.promedioOrden.toFixed(2)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Arrangements */}
            {stats.topArreglos.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Flower2 className="h-4 w-4" />
                    Arreglos más vendidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.topArreglos.map((arreglo, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                            {index + 1}
                          </span>
                          <span className="text-sm">{arreglo.nombre}</span>
                        </div>
                        <span className="text-sm font-medium">{arreglo.count} pedidos</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold">{stats.uniqueClients}</p>
                  <p className="text-xs text-muted-foreground">Clientes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Package className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Pedidos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Truck className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold">{stats.entregados}</p>
                  <p className="text-xs text-muted-foreground">Entregas</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
          </TabsContent>
          
          {/* Insumos Tab */}
          <TabsContent value="insumos" className="mt-4 space-y-4">
            {/* Date Range Picker */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Seleccionar fechas</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {insumosDateRange?.from ? (
                        insumosDateRange.to ? (
                          <>
                            {format(insumosDateRange.from, "d MMM", { locale: es })} -{" "}
                            {format(insumosDateRange.to, "d MMM", { locale: es })}
                          </>
                        ) : (
                          format(insumosDateRange.from, "d 'de' MMMM", { locale: es })
                        )
                      ) : (
                        <span>Seleccionar fechas</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={insumosDateRange?.from}
                      selected={insumosDateRange}
                      onSelect={setInsumosDateRange}
                      numberOfMonths={1}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Quick date buttons */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInsumosDateRange({ from: today, to: today })}
                  className="flex-shrink-0"
                >
                  Hoy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const tomorrow = addDays(today, 1)
                    setInsumosDateRange({ from: tomorrow, to: tomorrow })
                  }}
                  className="flex-shrink-0"
                >
                  Manana
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInsumosDateRange({ from: today, to: addDays(today, 7) })}
                  className="flex-shrink-0"
                >
                  Proximos 7 dias
                </Button>
              </div>
            </div>

            {/* Date Summary Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary">
                      {insumosDateRange?.from && insumosDateRange?.to 
                        ? `${format(insumosDateRange.from, "d MMM", { locale: es })} - ${format(insumosDateRange.to, "d MMM", { locale: es })}`
                        : insumosDateRange?.from 
                          ? format(insumosDateRange.from, "EEEE d 'de' MMMM", { locale: es })
                          : "Selecciona una fecha"
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {totalInsumosPedidos} {totalInsumosPedidos === 1 ? "pedido activo" : "pedidos activos"} con arreglo
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-primary/50" />
                </div>
              </CardContent>
            </Card>

            {/* Flower Requirements List */}
            {loadingInsumosPedidos || loadingInsumosFlores ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="h-8 w-8 text-primary" />
              </div>
            ) : flowerRequirements.length > 0 ? (
              <div className="space-y-2">
                {flowerRequirements.map((flower) => (
                  <Card key={flower.flor_id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Flower2 className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-medium text-foreground">{flower.nombre}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-primary">{flower.cantidad}</span>
                          <span className="text-sm text-muted-foreground ml-1">unidades</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Flower2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  {totalInsumosPedidos === 0 
                    ? "No hay pedidos activos para estas fechas" 
                    : "Los pedidos no tienen arreglos con flores asignadas"
                  }
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
