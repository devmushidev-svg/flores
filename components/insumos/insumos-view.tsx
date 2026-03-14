"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { format, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarDays, Flower2, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { PageHeader } from "@/components/page-header"
import { createClient } from "@/lib/supabase/client"

interface PedidoWithArreglo {
  id: string
  fecha_entrega: string
  estado: string
  arreglo_id: string | null
}

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

type DateFilter = "hoy" | "manana" | "semana"

async function fetchPedidosByDate(dateFrom: string, dateTo: string): Promise<PedidoWithArreglo[]> {
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

export function InsumosView() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("hoy")
  
  const today = new Date()
  const dateRange = useMemo(() => {
    switch (dateFilter) {
      case "hoy":
        return { from: format(today, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") }
      case "manana":
        const tomorrow = addDays(today, 1)
        return { from: format(tomorrow, "yyyy-MM-dd"), to: format(tomorrow, "yyyy-MM-dd") }
      case "semana":
        return { from: format(today, "yyyy-MM-dd"), to: format(addDays(today, 7), "yyyy-MM-dd") }
      default:
        return { from: format(today, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") }
    }
  }, [dateFilter])

  const { data: pedidos, isLoading: pedidosLoading } = useSWR(
    `pedidos-insumos-${dateRange.from}-${dateRange.to}`,
    () => fetchPedidosByDate(dateRange.from, dateRange.to)
  )

  const arregloIds = useMemo(() => {
    if (!pedidos) return []
    return [...new Set(pedidos.filter(p => p.arreglo_id).map(p => p.arreglo_id as string))]
  }, [pedidos])

  const { data: arregloFlores, isLoading: floresLoading } = useSWR(
    arregloIds.length > 0 ? `arreglo-flores-${arregloIds.join("-")}` : null,
    () => fetchArregloFlores(arregloIds)
  )

  const flowerRequirements = useMemo((): FlowerRequirement[] => {
    if (!pedidos || !arregloFlores) return []

    // Count how many times each arreglo appears in the filtered orders
    const arregloCounts: Record<string, number> = {}
    pedidos.forEach(pedido => {
      if (pedido.arreglo_id) {
        arregloCounts[pedido.arreglo_id] = (arregloCounts[pedido.arreglo_id] || 0) + 1
      }
    })

    // Calculate total flowers needed by multiplying each flower quantity 
    // by the number of orders that use that arreglo
    const flowerTotals: Record<string, { nombre: string; cantidad: number }> = {}
    
    arregloFlores.forEach(af => {
      if (af.flores && af.arreglo_id) {
        const florId = af.flor_id
        const orderCount = arregloCounts[af.arreglo_id] || 0
        
        if (!flowerTotals[florId]) {
          flowerTotals[florId] = { nombre: af.flores.nombre, cantidad: 0 }
        }
        // Multiply flower quantity by number of orders using this arreglo
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
  }, [pedidos, arregloFlores])

  const isLoading = pedidosLoading || floresLoading
  const totalPedidos = pedidos?.filter(p => p.arreglo_id).length || 0

  const getDateLabel = () => {
    switch (dateFilter) {
      case "hoy":
        return format(today, "EEEE d 'de' MMMM", { locale: es })
      case "manana":
        return format(addDays(today, 1), "EEEE d 'de' MMMM", { locale: es })
      case "semana":
        return `${format(today, "d MMM", { locale: es })} - ${format(addDays(today, 7), "d MMM", { locale: es })}`
      default:
        return ""
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Proyección de Insumos" 
        description="Flores necesarias para pedidos"
      />

      {/* Date Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        {[
          { key: "hoy", label: "Hoy" },
          { key: "manana", label: "Mañana" },
          { key: "semana", label: "Próximos 7 días" },
        ].map((option) => (
          <Button
            key={option.key}
            variant={dateFilter === option.key ? "default" : "outline"}
            size="sm"
            className="flex-shrink-0"
            onClick={() => setDateFilter(option.key as DateFilter)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Date Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary capitalize">{getDateLabel()}</p>
              <p className="text-xs text-muted-foreground">
                {totalPedidos} {totalPedidos === 1 ? "pedido activo" : "pedidos activos"} con arreglo
              </p>
            </div>
            <Package className="h-8 w-8 text-primary/50" />
          </div>
        </CardContent>
      </Card>

      {/* Flower Requirements List */}
      {isLoading ? (
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
            {totalPedidos === 0 
              ? "No hay pedidos activos para esta fecha" 
              : "Los pedidos no tienen arreglos con flores asignadas"
            }
          </p>
        </div>
      )}
    </div>
  )
}
