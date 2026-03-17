"use client"

import { useMemo, useEffect, useRef } from "react"
import { toast } from "sonner"
import useSWR from "swr"
import Link from "next/link"
import { ShoppingBag, Clock, CheckCircle, DollarSign, Plus, ChevronRight, Wallet, MapPin, Phone, MessageCircle, Send, Truck, Flower2, BookOpen } from "lucide-react"
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
import { EnablePush } from "@/components/notifications/enable-push"
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

  const tomorrow = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split("T")[0]
  }, [])

  const pedidosManana = useMemo(() => {
    if (!pedidos) return []
    return pedidos.filter(
      p => p.fecha_entrega === tomorrow && p.estado !== "Cancelado"
    )
  }, [pedidos, tomorrow])

  const reminderShown = useRef(false)
  useEffect(() => {
    if (!pedidosManana.length || reminderShown.current) return
    const hour = new Date().getHours()
    const isEvening = hour >= 18 && hour <= 23
    if (!isEvening) return
    const key = `reminder-${tomorrow}`
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) return
    reminderShown.current = true
    sessionStorage.setItem(key, "1")
    toast.info("Recordatorio", {
      description: `Tienes ${pedidosManana.length} entrega${pedidosManana.length !== 1 ? "s" : ""} mañana. ¡Prepárate!`,
      duration: 8000,
    })
  }, [pedidosManana.length, tomorrow])

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
    const direccionText = (pedido.domicilio || pedido.direccion) ? ` hacia ${pedido.domicilio || pedido.direccion}` : ""
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
      <div className="animate-fade-in-up opacity-0">
        <PageHeader 
        title="Multiplanet" 
        description="Vista general de tu florería"
        showLogo
        action={
          <div className="flex gap-2 items-center">
            <EnablePush />
            <Button size="sm" asChild>
              <Link href="/pedidos">
                <Plus className="h-4 w-4 mr-1" />
                Nuevo pedido
              </Link>
            </Button>
          </div>
        }
      />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 animate-fade-in">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="animate-fade-in-up opacity-0" style={{ animationDelay: "50ms" }}>
              <StatCard
                title="Pedidos hoy"
                value={stats.hoy}
                icon={<ShoppingBag className="h-5 w-5" />}
              />
            </div>
            <div className="animate-fade-in-up opacity-0" style={{ animationDelay: "100ms" }}>
              <StatCard
                title="Por entregar"
                value={stats.pendientes}
                icon={<Clock className="h-5 w-5" />}
              />
            </div>
            <div className="animate-fade-in-up opacity-0" style={{ animationDelay: "150ms" }}>
              <StatCard
                title="Ingresos hoy"
                value={`L${stats.ingresos.toFixed(0)}`}
                icon={<DollarSign className="h-5 w-5" />}
              />
            </div>
            <div className="animate-fade-in-up opacity-0" style={{ animationDelay: "200ms" }}>
              <StatCard
                title="Saldo por cobrar"
                value={`L${stats.saldoPorCobrar.toFixed(0)}`}
                icon={<Wallet className="h-5 w-5" />}
                highlight={stats.saldoPorCobrar > 0}
              />
            </div>
          </div>

          {/* Progress Bar */}
          {stats.totalHoy > 0 && (
            <Card className="animate-fade-in-up opacity-0" style={{ animationDelay: "250ms" }}>
              <CardContent className="py-5">
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
          <Card className="animate-fade-in-up opacity-0" style={{ animationDelay: "300ms" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
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
                  {pedidosHoyList.map((pedido, idx) => (
                    <div 
                      key={pedido.id} 
                      className="p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-white/60 space-y-2 transition-all duration-200 hover:shadow-md hover:border-primary/20 active:scale-[0.99]"
                      style={{ animation: "fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards", animationDelay: `${350 + idx * 50}ms`, opacity: 0 }}
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
                          {(pedido.domicilio || pedido.direccion) && (
                            <span className="flex items-center gap-1 truncate max-w-[150px]">
                              <MapPin className="h-3 w-3" />
                              {pedido.domicilio || pedido.direccion}
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
                        <div className="text-xs bg-gradient-to-r from-amber-50 to-amber-100/80 text-amber-800 rounded-lg px-3 py-2 flex items-center justify-between border border-amber-200/60">
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
            <Button variant="outline" className="h-auto py-5 animate-fade-in-up opacity-0 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] rounded-2xl border-2" style={{ animationDelay: "400ms" }} asChild>
              <Link href="/flores" className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center text-white shadow-md">
                  <Flower2 className="h-6 w-6" />
                </div>
                <span className="text-sm font-semibold">Gestionar flores</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-5 animate-fade-in-up opacity-0 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] rounded-2xl border-2" style={{ animationDelay: "450ms" }} asChild>
              <Link href="/catalogo" className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center text-white shadow-md">
                  <BookOpen className="h-6 w-6" />
                </div>
                <span className="text-sm font-semibold">Ver catálogo</span>
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
