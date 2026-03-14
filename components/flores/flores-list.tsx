"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { format, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, Flower2, ClipboardList, Calendar as CalendarIcon, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { FlorCard } from "./flor-card"
import { FlorForm } from "./flor-form"
import { createClient } from "@/lib/supabase/client"
import type { Flor } from "@/lib/types"
import type { DateRange } from "react-day-picker"

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
    .in("estado", ["Pendiente", "En preparacion"])
  
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

export function FloresList() {
  const { data: flores, error, isLoading, mutate } = useSWR("flores", fetchFlores)
  const [showForm, setShowForm] = useState(false)
  const [editingFlor, setEditingFlor] = useState<Flor | null>(null)
  const [activeTab, setActiveTab] = useState<"inventario" | "insumos">("inventario")
  
  // Date range picker state for Insumos
  const today = new Date()
  const [insumosDateRange, setInsumosDateRange] = useState<DateRange | undefined>({
    from: today,
    to: addDays(today, 7)
  })
  
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

  const handleCreate = async (data: { nombre: string; precio_actual: number }) => {
    const supabase = createClient()
    const { error } = await supabase.from("flores").insert([data])
    if (error) throw error
    mutate()
  }

  const handleUpdate = async (data: { nombre: string; precio_actual: number }) => {
    if (!editingFlor) return
    const supabase = createClient()
    const { error } = await supabase
      .from("flores")
      .update(data)
      .eq("id", editingFlor.id)
    if (error) throw error
    setEditingFlor(null)
    mutate()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("flores")
      .update({ is_active: false })
      .eq("id", id)
    if (error) throw error
    mutate()
  }

  const handleEdit = (flor: Flor) => {
    setEditingFlor(flor)
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Flores" description="Gestiona los precios de tus flores" />
        <div className="text-center py-12 text-destructive">
          Error al cargar las flores
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <PageHeader 
        title="Flores" 
        description="Gestiona tus flores y proyeccion de insumos"
      />
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "inventario" | "insumos")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inventario" className="gap-2">
            <Flower2 className="h-4 w-4" />
            Inventario
          </TabsTrigger>
          <TabsTrigger value="insumos" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Proyeccion
          </TabsTrigger>
        </TabsList>
        
        {/* Inventario Tab */}
        <TabsContent value="inventario" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8 text-primary" />
            </div>
          ) : flores && flores.length > 0 ? (
            <div className="space-y-3">
              {flores.map((flor) => (
                <FlorCard
                  key={flor.id}
                  flor={flor}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Flower2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">
                No hay flores registradas
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar primera flor
              </Button>
            </div>
          )}
        </TabsContent>
        
        {/* Insumos/Proyeccion Tab */}
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

      <FlorForm
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={handleCreate}
      />

      <FlorForm
        open={!!editingFlor}
        onOpenChange={(open) => !open && setEditingFlor(null)}
        flor={editingFlor}
        onSubmit={handleUpdate}
      />
    </div>
  )
}
