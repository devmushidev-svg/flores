"use client"

import { Trash2, Printer, FileText } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Pedido } from "@/lib/types"

interface PrintQueueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedidos: Pedido[]
  onRemove: (id: string) => void
  onClear: () => void
  onPrint: () => void
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("es-HN", { day: "numeric", month: "short" })
}

export function PrintQueueDialog({
  open,
  onOpenChange,
  pedidos,
  onRemove,
  onClear,
  onPrint,
}: PrintQueueDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Arreglos a Imprimir</DialogTitle>
          <DialogDescription>
            Junta pedidos y luego imprime 2 por hoja carta en horizontal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 border rounded-lg px-4 py-3 bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {pedidos.length} pedido{pedidos.length === 1 ? "" : "s"} en cola
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClear} disabled={pedidos.length === 0}>
              Limpiar
            </Button>
            <Button size="sm" onClick={onPrint} disabled={pedidos.length === 0}>
              <Printer className="h-4 w-4 mr-1" />
              Imprimir Carta
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {pedidos.length > 0 ? (
            pedidos.map((pedido) => (
              <div key={pedido.id} className="rounded-xl border p-3 flex gap-3 items-start bg-card">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 border">
                  {pedido.arreglos?.foto_url ? (
                    <Image
                      src={pedido.arreglos.foto_url}
                      alt={pedido.arreglos.nombre || "Arreglo"}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <FileText className="h-5 w-5" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{pedido.cliente}</p>
                      <p className="text-sm text-primary truncate">{pedido.arreglos?.nombre || "Arreglo personalizado"}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onRemove(pedido.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Pedido N{pedido.numero_pedido}</span>
                    <span className="text-right">Entrega: {formatDate(pedido.fecha_entrega)}</span>
                    <span>{pedido.arreglos?.codigo?.trim() || "Sin codigo"}</span>
                    <span className="text-right">Total: L{pedido.precio_total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              No hay pedidos en cola. Usa "Agregar a carta" desde cada pedido.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
