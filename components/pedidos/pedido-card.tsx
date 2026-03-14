"use client"

import { useState } from "react"
import { Pencil, Trash2, Phone, MapPin, Calendar, Clock, MessageCircle, Send, Truck, Printer } from "lucide-react"
import Image from "next/image"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Pedido } from "@/lib/types"
import { ESTADO_COLORS } from "@/lib/types"

interface PedidoCardProps {
  pedido: Pedido
  onEdit: (pedido: Pedido) => void
  onDelete: (id: string) => Promise<void>
  onStatusChange?: (id: string, estado: Pedido['estado']) => Promise<void>
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("es-HN", { day: "numeric", month: "short" })
}

function formatDateLong(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("es-HN", { day: "numeric", month: "long" })
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return null
  const [hours, minutes] = timeStr.split(":")
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? "pm" : "am"
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

function formatPhoneForWhatsApp(telefono: string): string {
  // Remove all non-numeric characters
  const cleaned = telefono.replace(/\D/g, "")
  // If the number doesn't start with country code, assume Honduras (+504)
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

export function PedidoCard({ pedido, onEdit, onDelete, onStatusChange }: PedidoCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)

  const handleStatusChange = async (newStatus: Pedido['estado']) => {
    if (!onStatusChange || newStatus === pedido.estado) return
    setIsChangingStatus(true)
    await onStatusChange(pedido.id, newStatus)
    setIsChangingStatus(false)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    await onDelete(pedido.id)
    setIsDeleting(false)
    setShowDeleteDialog(false)
  }

  // Print thermal receipt
  const handlePrintReceipt = () => {
    const fechaEntrega = formatDateLong(pedido.fecha_entrega)
    const horaEntrega = pedido.hora_entrega ? formatTime(pedido.hora_entrega) : "No especificada"
    const arregloNombre = pedido.arreglos?.nombre || "Arreglo personalizado"
    const arregloFoto = pedido.arreglos?.foto_url
    
    const printWindow = window.open("", "_blank", "width=300,height=600")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Pedido N${pedido.numero_pedido}</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 80mm;
            padding: 8px;
            line-height: 1.4;
          }
          .header { text-align: center; margin-bottom: 12px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
          .logo { width: 60px; height: 60px; margin: 0 auto 8px; }
          .logo img { width: 100%; height: 100%; object-fit: contain; }
          .business-name { font-size: 16px; font-weight: bold; text-transform: uppercase; }
          .business-info { font-size: 10px; margin-top: 4px; }
          .order-number { font-size: 20px; font-weight: bold; margin: 12px 0; text-align: center; background: #000; color: #fff; padding: 8px; }
          .section { margin: 10px 0; padding: 8px 0; border-bottom: 1px dashed #ccc; }
          .section-title { font-weight: bold; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; }
          .row { display: flex; justify-content: space-between; margin: 4px 0; }
          .label { font-weight: bold; }
          .value { text-align: right; max-width: 60%; }
          .full-row { margin: 4px 0; }
          .full-row .label { display: block; margin-bottom: 2px; }
          .full-row .value { text-align: left; max-width: 100%; padding-left: 8px; }
          .totals { background: #f5f5f5; padding: 10px; margin: 10px 0; }
          .totals .row { font-size: 13px; }
          .totals .total-row { font-size: 16px; font-weight: bold; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; }
          .footer { text-align: center; margin-top: 12px; font-size: 10px; border-top: 2px dashed #000; padding-top: 10px; }
          .thank-you { font-weight: bold; font-size: 12px; margin-bottom: 4px; }
          .arreglo-img { text-align: center; margin: 10px 0; }
          .arreglo-img img { max-width: 100%; max-height: 120px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; }
          .nota-box { background: #fff8e1; border: 1px solid #ffcc80; padding: 6px; margin: 6px 0; font-size: 11px; }
          .tarjeta-box { background: #f5f5f5; border-left: 3px solid #666; padding: 6px; margin: 6px 0; font-style: italic; font-size: 11px; }
          @media print {
            body { width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">
            <img src="/logo.png" alt="Logo" onerror="this.style.display='none'" />
          </div>
          <div class="business-name">Multiplanet Floristeria</div>
          <div class="business-info">
            Barrio el centro, Tocoa Colon<br>
            Segunda planta Multiplanet<br>
            Tel: +504 95841794
          </div>
        </div>

        <div class="order-number">PEDIDO N${pedido.numero_pedido}</div>

        <div class="section">
          <div class="section-title">Informacion del Cliente</div>
          <div class="row">
            <span class="label">Cliente:</span>
            <span class="value">${pedido.cliente}</span>
          </div>
          ${pedido.telefono ? `
          <div class="row">
            <span class="label">Telefono:</span>
            <span class="value">${pedido.telefono}</span>
          </div>
          ` : ""}
          ${pedido.direccion ? `
          <div class="full-row">
            <span class="label">Direccion:</span>
            <span class="value">${pedido.direccion}</span>
          </div>
          ` : ""}
        </div>

        <div class="section">
          <div class="section-title">Detalles del Pedido</div>
          <div class="row">
            <span class="label">Fecha entrega:</span>
            <span class="value">${fechaEntrega}</span>
          </div>
          <div class="row">
            <span class="label">Hora:</span>
            <span class="value">${horaEntrega}</span>
          </div>
          <div class="row">
            <span class="label">Arreglo:</span>
            <span class="value">${arregloNombre}</span>
          </div>
          ${arregloFoto ? `
          <div class="arreglo-img">
            <img src="${arregloFoto}" alt="${arregloNombre}" onerror="this.style.display='none'" />
          </div>
          ` : ""}
          ${pedido.descripcion ? `
          <div class="nota-box">
            <strong>Nota:</strong> ${pedido.descripcion}
          </div>
          ` : ""}
          ${pedido.mensaje_tarjeta ? `
          <div class="tarjeta-box">
            <strong>Mensaje tarjeta:</strong><br>"${pedido.mensaje_tarjeta}"
          </div>
          ` : ""}
        </div>

        <div class="totals">
          <div class="section-title">Resumen de Pago</div>
          <div class="row">
            <span class="label">Total:</span>
            <span class="value">L${pedido.precio_total.toFixed(2)}</span>
          </div>
          <div class="row">
            <span class="label">Abono:</span>
            <span class="value">L${pedido.abono.toFixed(2)}</span>
          </div>
          <div class="row total-row">
            <span class="label">SALDO:</span>
            <span class="value">L${pedido.saldo.toFixed(2)}</span>
          </div>
        </div>

        <div class="section">
          <div class="row">
            <span class="label">Estado:</span>
            <span class="value">${pedido.estado}</span>
          </div>
        </div>

        <div class="footer">
          <div class="thank-you">Gracias por su preferencia!</div>
          <div>Multiplanet Floristeria</div>
        </div>
      </body>
      </html>
    `)
    
    printWindow.document.close()
    printWindow.focus()
    
    // Wait for images to load then print
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  // WhatsApp message generators
  const handleChatCliente = () => {
    if (!pedido.telefono) return
    const url = createWhatsAppLink(pedido.telefono, "")
    window.open(url, "_blank")
  }

  const handleEnviarCobro = () => {
    if (!pedido.telefono) return
    const fechaEntrega = formatDateLong(pedido.fecha_entrega)
    const horaEntrega = pedido.hora_entrega ? ` a las ${formatTime(pedido.hora_entrega)}` : ""
    const arregloNombre = pedido.arreglos?.nombre ? `\n\nArreglo: ${pedido.arreglos.nombre}` : ""
    const descripcionText = pedido.descripcion ? `\nNota: ${pedido.descripcion}` : ""
    const mensajeTarjeta = pedido.mensaje_tarjeta ? `\nMensaje de tarjeta: "${pedido.mensaje_tarjeta}"` : ""
    const direccionText = pedido.direccion ? `\nDirección de entrega: ${pedido.direccion}` : ""
    
    const message = `¡Hola ${pedido.cliente}! Recibimos tu pedido N${pedido.numero_pedido} para el ${fechaEntrega}${horaEntrega}.${arregloNombre}${descripcionText}${mensajeTarjeta}${direccionText}\n\nTotal: L${pedido.precio_total.toFixed(2)}\nAbono: L${pedido.abono.toFixed(2)}\nSaldo pendiente: L${pedido.saldo.toFixed(2)}\n\n¡Gracias por tu preferencia!\n- Multiplanet Floristería`
    const url = createWhatsAppLink(pedido.telefono, message)
    window.open(url, "_blank")
  }

  const handleAvisarEnRuta = () => {
    if (!pedido.telefono) return
    const direccionText = pedido.direccion ? ` hacia ${pedido.direccion}` : ""
    const arregloNombre = pedido.arreglos?.nombre ? ` (${pedido.arreglos.nombre})` : ""
    const message = `¡Hola ${pedido.cliente}! Tu arreglo${arregloNombre} ya va en camino${direccionText}. 🛵💐`
    const url = createWhatsAppLink(pedido.telefono, message)
    window.open(url, "_blank")
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {/* Order number badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold bg-foreground text-background px-2 py-0.5 rounded">
              N{pedido.numero_pedido}
            </span>
            <Badge className={ESTADO_COLORS[pedido.estado]}>
              {pedido.estado}
            </Badge>
          </div>

          <div className="flex items-start gap-3">
            {/* Arrangement photo */}
            {pedido.arreglos?.foto_url && (
              <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
                <Image
                  src={pedido.arreglos.foto_url}
                  alt={pedido.arreglos.nombre || "Arreglo"}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">{pedido.cliente}</h3>
              {pedido.arreglos && (
                <p className="text-sm text-primary font-medium">{pedido.arreglos.nombre}</p>
              )}
            </div>
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

          {/* Nota para el arreglo (descripcion) */}
          {pedido.descripcion && (
            <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded p-2">
              <span className="font-medium text-amber-700">Nota:</span> {pedido.descripcion}
            </div>
          )}

          {/* Mensaje de tarjeta */}
          {pedido.mensaje_tarjeta && (
            <div className="text-xs italic text-muted-foreground bg-muted/50 rounded p-2">
              <span className="font-medium not-italic">Tarjeta:</span> &quot;{pedido.mensaje_tarjeta}&quot;
            </div>
          )}

          {/* Quick status buttons */}
          {onStatusChange && pedido.estado !== 'Entregado' && pedido.estado !== 'Cancelado' && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t">
              <span className="text-xs text-muted-foreground w-full mb-1">Cambiar estado:</span>
              {pedido.estado === 'Pendiente' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-7 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  onClick={() => handleStatusChange('En preparación')}
                  disabled={isChangingStatus}
                >
                  En preparación
                </Button>
              )}
              {(pedido.estado === 'Pendiente' || pedido.estado === 'En preparación') && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-7 text-xs bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                  onClick={() => handleStatusChange('En ruta')}
                  disabled={isChangingStatus}
                >
                  En ruta
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline"
                className="h-7 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                onClick={() => handleStatusChange('Entregado')}
                disabled={isChangingStatus}
              >
                Entregado
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="h-7 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                onClick={() => handleStatusChange('Cancelado')}
                disabled={isChangingStatus}
              >
                Cancelar
              </Button>
            </div>
          )}

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
              {/* Print receipt */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={handlePrintReceipt}
              >
                <Printer className="h-4 w-4" />
                <span className="sr-only">Imprimir</span>
              </Button>
              {/* WhatsApp dropdown */}
              {pedido.telefono && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50">
                      <MessageCircle className="h-4 w-4" />
                      <span className="sr-only">WhatsApp</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleChatCliente}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Chat Cliente
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleEnviarCobro}>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Cobro
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAvisarEnRuta}>
                      <Truck className="h-4 w-4 mr-2" />
                      Avisar En Ruta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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
