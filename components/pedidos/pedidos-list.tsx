"use client"

import { useState } from "react"
import useSWR from "swr"
import { Plus, Filter, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
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

  const handleArreglosChange = () => {
    mutateArreglos()
  }

  const handleCreate = async (data: {
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
  }) => {
    const supabase = createClient()
    const { error } = await supabase.from("pedidos").insert([data])
    if (error) throw error
    mutatePedidos()
  }

  const handleUpdate = async (data: {
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
  }) => {
    if (!editingPedido) return
    const supabase = createClient()
    const { error } = await supabase
      .from("pedidos")
      .update(data)
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

  const handleEdit = (pedido: Pedido) => {
    setEditingPedido(pedido)
  }

  const isLoading = pedidosLoading || arreglosLoading || floresLoading

  const filteredPedidos = pedidos?.filter(p => 
    filterEstado === "todos" || p.estado === filterEstado
  ) || []

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : filteredPedidos.length > 0 ? (
        <div className="space-y-3">
          {filteredPedidos.map((pedido) => (
            <PedidoCard
              key={pedido.id}
              pedido={pedido}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-muted-foreground mb-4">
            {filterEstado === "todos" 
              ? "No hay pedidos registrados" 
              : `No hay pedidos "${filterEstado}"`
            }
          </p>
          {filterEstado === "todos" && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Crear primer pedido
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
