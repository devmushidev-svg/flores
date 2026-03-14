"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { Phone, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { PageHeader } from "@/components/page-header"
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
    .neq("estado", "Cancelado")
    .gte("fecha_entrega", new Date().toISOString().split("T")[0])
    .order("fecha_entrega", { ascending: true })
    .order("hora_entrega", { ascending: true })
  
  if (error) throw error
  return data || []
}

interface GroupedPedidos {
  [date: string]: Pedido[]
}

function formatDate(dateStr: string) {
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

function formatTime(timeStr: string | null) {
  if (!timeStr) return "Sin hora"
  const [hours, minutes] = timeStr.split(":")
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? "pm" : "am"
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

export function CalendarioView() {
  const { data: pedidos, error, isLoading } = useSWR("pedidos-calendario", fetchPedidos)

  const groupedPedidos = useMemo<GroupedPedidos>(() => {
    if (!pedidos) return {}
    
    return pedidos.reduce((groups, pedido) => {
      const date = pedido.fecha_entrega
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(pedido)
      return groups
    }, {} as GroupedPedidos)
  }, [pedidos])

  const sortedDates = useMemo(() => {
    return Object.keys(groupedPedidos).sort()
  }, [groupedPedidos])

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Calendario de Entregas" />
        <div className="text-center py-12 text-destructive">
          Error al cargar las entregas
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Calendario de Entregas" 
        description="Próximas entregas programadas"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : sortedDates.length > 0 ? (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <Card key={date}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg capitalize flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  {formatDate(date)}
                  <Badge variant="secondary" className="ml-auto">
                    {groupedPedidos[date].length} pedido{groupedPedidos[date].length !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {groupedPedidos[date].map((pedido) => (
                  <div 
                    key={pedido.id} 
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary">
                            {formatTime(pedido.hora_entrega)}
                          </span>
                          <Badge className={ESTADO_COLORS[pedido.estado]}>
                            {pedido.estado}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-foreground mt-1">{pedido.cliente}</h4>
                        {pedido.arreglos && (
                          <p className="text-sm text-muted-foreground">{pedido.arreglos.nombre}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">L{pedido.precio_total.toFixed(0)}</p>
                        {pedido.saldo > 0 && (
                          <p className="text-xs text-muted-foreground">
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
                          <Phone className="h-3.5 w-3.5" />
                          {pedido.telefono}
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
                      <div className="mt-2 p-2 rounded bg-muted/50 text-sm italic">
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
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📅</div>
          <p className="text-muted-foreground">
            No hay entregas programadas
          </p>
        </div>
      )}
    </div>
  )
}
