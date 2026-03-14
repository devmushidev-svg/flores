"use client"

import { useMemo } from "react"
import useSWR from "swr"
import Link from "next/link"
import { ShoppingBag, Clock, CheckCircle, DollarSign, Plus, ChevronRight, Wallet, MapPin, Phone, MessageCircle, Send, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

function formatDateLong(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("es-HN", { day: "numeric", month: "long" })
}

function formatPhoneForWhatsApp(telefono: string): string {
  const cleaned = telefono.replace(/\D/g, "")
  if (cleaned.length === 8) {
    return `504${cleaned}`
  }
  return cleaned
}

function createWhatsAppLink(telefono: string, message: string): string {
  const phone = formatPhoneForWhatsApp(telefono)
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/${phone}?text=${encodedMessage}`
}

export function DashboardView() {
  const { data: pedidos, error, isLoading } = useSWR("pedidos-dashboard", fetchPedidos)

  const today = new Date().toISOString().split("T")[0]

  const stats = useMemo(() => {
    if (!pedidos) return { hoy: 0, pendientes: 0, entregados: 0, ingresos: 0, saldoPorCobrar: 0, totalHoy: 0 }

    const pedidosHoy = pedidos.filter(p => p.fecha_entrega === today)
    const entregadosHoy = pedidosHoy.filter(p => p.estado === "Entregado")
    const ingresosHoy = pedidosHoy.reduce((sum, p) => sum + p.abono, 0)
    const saldoPorCobrarHoy = pedidosHoy.reduce((sum, p) => sum + p.saldo, 0)

    return {
      hoy: pedidosHoy.length,
      pendientes: pedidosHoy.filter(p => p.estado !== "Entregado" && p.estado !== "Cancelado").length,
      entregados: entregadosHoy.length,
      ingresos: ingresosHoy,
      saldoPorCobrar: saldoPorCobrarHoy,
      totalHoy: pedidosHoy.length
    }
  }, [pedidos, today])

  const pedidosHoyList = useMemo(() => {
    if (!pedidos) return []
    return pedidos
      .filter(p => p.fecha_entrega === today && p.estado !== "Cancelado")
      .sort((a, b) => {
        // Sort by time, nulls last
        if (!a.hora_entrega && !b.hora_entrega) return 0
        if (!a.hora_entrega) return 1
        if (!b.hora_entrega) return -1
        return a.hora_entrega.localeCompare(b.hora_entrega)
      })
  }, [pedidos, today])

  const progressValue = stats.totalHoy > 0 ? (stats.entregados / stats.totalHoy) * 100 : 0

  // WhatsApp handlers
  const handleChatCliente = (pedido: Pedido) => {
    if (!pedido.telefono) return
    const url = createWhatsAppLink(pedido.telefono, "")
    window.open(url, "_blank")
  }

  const handleEnviarCobro = (pedido: Pedido) => {
    if (!pedido.telefono) return
    const message = `¡Hola ${pedido.cliente}! Recibimos tu pedido para el ${formatDateLong(pedido.fecha_entrega)}. El total es L${pedido.precio_total.toFixed(2)}. Tu abono es L${pedido.abono.toFixed(2)}, saldo pendiente: L${pedido.saldo.toFixed(2)}. ¡Gracias por tu preferencia!`
    const url = createWhatsAppLink(pedido.telefono, message)
    window.open(url, "_blank")
  }

  const handleAvisarEnRuta = (pedido: Pedido) => {
    if (!pedido.telefono) return
    const direccionText = pedido.direccion ? ` hacia ${pedido.direccion}` : ""
    const message = `¡Hola ${pedido.cliente}! Tu arreglo ya va en camino${direccionText}. 🛵💐`
    const url = createWhatsAppLink(pedido.telefono, message)
    window.open(url, "_blank")
  }

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
              title="Pedidos hoy"
              value={stats.hoy}
              icon={<ShoppingBag className="h-5 w-5" />}
            />
            <StatCard
              title="Por entregar"
              value={stats.pendientes}
              icon={<Clock className="h-5 w-5" />}
            />
            <StatCard
              title="Ingresos hoy"
              value={`L${stats.ingresos.toFixed(0)}`}
              icon={<DollarSign className="h-5 w-5" />}
            />
            <StatCard
              title="Saldo por cobrar"
              value={`L${stats.saldoPorCobrar.toFixed(0)}`}
              icon={<Wallet className="h-5 w-5" />}
              highlight={stats.saldoPorCobrar > 0}
            />
          </div>

          {/* Progress Bar */}
          {stats.totalHoy > 0 && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progreso del día</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.entregados} / {stats.totalHoy} entregados
                  </span>
                </div>
                <Progress value={progressValue} className="h-3" />
              </CardContent>
            </Card>
          )}

          {/* Today's Orders List */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Entregas de hoy
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/calendario">
                    Ver calendario
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {pedidosHoyList.length > 0 ? (
                <div className="space-y-3">
                  {pedidosHoyList.map((pedido) => (
                    <div 
                      key={pedido.id} 
                      className="p-3 rounded-lg bg-muted/50 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{pedido.cliente}</span>
                            <Badge variant="outline" className={`text-xs ${ESTADO_COLORS[pedido.estado]}`}>
                              {pedido.estado}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {pedido.arreglos?.nombre || "Sin arreglo"}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold">L{pedido.precio_total.toFixed(0)}</p>
                          {pedido.hora_entrega && (
                            <p className="text-xs text-primary font-medium">
                              {formatTime(pedido.hora_entrega)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Extra info row */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          {pedido.direccion && (
                            <span className="flex items-center gap-1 truncate max-w-[150px]">
                              <MapPin className="h-3 w-3" />
                              {pedido.direccion}
                            </span>
                          )}
                          {pedido.telefono && (
                            <a href={`tel:${pedido.telefono}`} className="flex items-center gap-1 hover:text-foreground">
                              <Phone className="h-3 w-3" />
                              {pedido.telefono}
                            </a>
                          )}
                        </div>
                        
                        {/* WhatsApp Actions */}
                        {pedido.telefono && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50">
                                <MessageCircle className="h-3.5 w-3.5 mr-1" />
                                WhatsApp
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleChatCliente(pedido)}>
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Chat Cliente
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEnviarCobro(pedido)}>
                                <Send className="h-4 w-4 mr-2" />
                                Enviar Cobro
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAvisarEnRuta(pedido)}>
                                <Truck className="h-4 w-4 mr-2" />
                                Avisar En Ruta
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {/* Payment info */}
                      {pedido.saldo > 0 && (
                        <div className="text-xs bg-amber-50 text-amber-700 rounded px-2 py-1 flex items-center justify-between">
                          <span>Abono: L{pedido.abono.toFixed(0)}</span>
                          <span className="font-semibold">Saldo: L{pedido.saldo.toFixed(0)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay entregas programadas para hoy</p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <Link href="/pedidos">
                      <Plus className="h-4 w-4 mr-1" />
                      Crear pedido
                    </Link>
                  </Button>
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
