"use client"

import { useState } from "react"
import { Pencil, Trash2, Phone, MapPin, Calendar, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import type { Pedido } from "@/lib/types"
import { ESTADO_COLORS } from "@/lib/types"

interface PedidoCardProps {
  pedido: Pedido
  onEdit: (pedido: Pedido) => void
  onDelete: (id: string) => Promise<void>
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("es-HN", { day: "numeric", month: "short" })
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return null
  const [hours, minutes] = timeStr.split(":")
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? "pm" : "am"
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

export function PedidoCard({ pedido, onEdit, onDelete }: PedidoCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    await onDelete(pedido.id)
    setIsDeleting(false)
    setShowDeleteDialog(false)
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground">{pedido.cliente}</h3>
              {pedido.arreglos && (
                <p className="text-sm text-primary font-medium">{pedido.arreglos.nombre}</p>
              )}
            </div>
            <Badge className={ESTADO_COLORS[pedido.estado]}>
              {pedido.estado}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>{formatDate(pedido.fecha_entrega)}</span>
            </div>
            {pedido.hora_entrega && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>{formatTime(pedido.hora_entrega)}</span>
              </div>
            )}
            {pedido.telefono && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <a href={`tel:${pedido.telefono}`} className="hover:underline">{pedido.telefono}</a>
              </div>
            )}
            {pedido.direccion && (
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{pedido.direccion}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm space-y-0.5">
              <div className="font-semibold text-foreground">L{pedido.precio_total.toFixed(2)}</div>
              {pedido.abono > 0 && (
                <div className="text-xs text-muted-foreground">
                  Abono: L{pedido.abono.toFixed(2)} | Saldo: L{pedido.saldo.toFixed(2)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onEdit(pedido)}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Editar</span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Eliminar</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-[90vw] rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el pedido de &quot;{pedido.cliente}&quot;. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
