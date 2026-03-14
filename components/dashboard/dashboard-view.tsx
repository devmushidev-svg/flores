"use client"

import { useMemo } from "react"
import useSWR from "swr"
import Link from "next/link"
import { ShoppingBag, Clock, CheckCircle, DollarSign, Plus, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "./stat-card"
import { createClient } from "@/lib/supabase/client"
import type { Pedido } from "@/lib/types"
import { ESTADO_COLORS } from "@/lib/types"

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

function formatTime(timeStr: string | null) {
  if (!timeStr) return ""
  const [hours, minutes] = timeStr.split(":")
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? "pm" : "am"
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

export function DashboardView() {
  const { data: pedidos, error, isLoading } = useSWR("pedidos-dashboard", fetchPedidos)

  const today = new Date().toISOString().split("T")[0]

  const stats = useMemo(() => {
    if (!pedidos) return { hoy: 0, pendientes: 0, entregados: 0, ingresos: 0 }

    const pedidosHoy = pedidos.filter(p => p.fecha_entrega === today)
    const pendientes = pedidos.filter(p => p.estado === "Pendiente" || p.estado === "En preparación")
    const entregadosHoy = pedidosHoy.filter(p => p.estado === "Entregado")
    const ingresosHoy = entregadosHoy.reduce((sum, p) => sum + p.precio_total, 0)

    return {
      hoy: pedidosHoy.length,
      pendientes: pendientes.length,
      entregados: entregadosHoy.length,
      ingresos: ingresosHoy
    }
  }, [pedidos, today])

  const pedidosProximos = useMemo(() => {
    if (!pedidos) return []
    return pedidos
      .filter(p => p.estado !== "Entregado" && p.estado !== "Cancelado")
      .slice(0, 5)
  }, [pedidos])

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Panel de Control" />
        <div className="text-center py-12 text-destructive">
          Error al cargar los datos
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Panel de Control" 
        description="Vista general de tu florería"
        action={
          <Button size="sm" asChild>
            <Link href="/pedidos">
              <Plus className="h-4 w-4 mr-1" />
              Nuevo pedido
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Pedidos del día"
              value={stats.hoy}
              icon={<ShoppingBag className="h-5 w-5" />}
            />
            <StatCard
              title="Pendientes"
              value={stats.pendientes}
              icon={<Clock className="h-5 w-5" />}
            />
            <StatCard
              title="Entregados hoy"
              value={stats.entregados}
              icon={<CheckCircle className="h-5 w-5" />}
            />
            <StatCard
              title="Ingresos del día"
              value={`L${stats.ingresos.toFixed(0)}`}
              icon={<DollarSign className="h-5 w-5" />}
            />
          </div>

          {/* Upcoming Orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Próximas entregas</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/calendario">
                    Ver todas
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {pedidosProximos.length > 0 ? (
                <div className="space-y-3">
                  {pedidosProximos.map((pedido) => (
                    <div 
                      key={pedido.id} 
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{pedido.cliente}</span>
                          <Badge variant="outline" className={`text-xs ${ESTADO_COLORS[pedido.estado]}`}>
                            {pedido.estado}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {pedido.arreglos?.nombre || "Sin arreglo"}
                          {pedido.hora_entrega && ` - ${formatTime(pedido.hora_entrega)}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">L{pedido.precio_total.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(pedido.fecha_entrega + "T00:00:00").toLocaleDateString("es-HN", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay pedidos pendientes</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-auto py-4" asChild>
              <Link href="/flores" className="flex flex-col items-center gap-2">
                <span className="text-2xl">🌸</span>
                <span className="text-sm">Gestionar flores</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4" asChild>
              <Link href="/catalogo" className="flex flex-col items-center gap-2">
                <span className="text-2xl">💐</span>
                <span className="text-sm">Ver catálogo</span>
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
