"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, parseISO, isWithinInterval } from "date-fns"
import { es } from "date-fns/locale"
import { 
  Calendar, 
  DollarSign, 
  Package, 
  TrendingUp, 
  ChevronDown,
  Flower2,
  Users,
  Truck
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { ESTADO_COLORS } from "@/lib/types"
import type { Pedido, ArregloWithFlores } from "@/lib/types"

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

export function ReportesView() {
  const [period, setPeriod] = useState<PeriodType>("hoy")
  
  const { data: pedidos = [], isLoading: loadingPedidos } = useSWR("reportes-pedidos", fetcher)
  const { data: arreglos = [], isLoading: loadingArreglos } = useSWR("reportes-arreglos", fetchArreglos)

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
        <div className="flex items-center justify-between">
          <PageHeader 
            title="Reportes" 
            description="Análisis de ventas y pedidos"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
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
      </div>
    </AppShell>
  )
}
