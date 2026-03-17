"use client"

import { useRef } from "react"
import useSWR from "swr"
import { Printer, FileSpreadsheet, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { printPedidoTermica, printPedidoCarta } from "@/lib/print-pedido"
import type { Pedido } from "@/lib/types"
import { ESTADO_COLORS } from "@/lib/types"

async function fetchPedidosHoy(): Promise<Pedido[]> {
  const today = new Date().toISOString().split("T")[0]
  const supabase = createClient()
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, arreglos(*)")
    .eq("fecha_entrega", today)
    .neq("estado", "Cancelado")
    .order("hora_entrega", { ascending: true })
  if (error) throw error
  return data || []
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return "Sin hora"
  const [h, m] = timeStr.split(":")
  const hour = parseInt(h)
  const ampm = hour >= 12 ? "pm" : "am"
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${ampm}`
}

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long" })
}

export function ListaEntregasDia() {
  const { data: pedidos = [], isLoading } = useSWR("pedidos-hoy-lista", fetchPedidosHoy)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    if (!printRef.current) return
    const iframe = document.createElement("iframe")
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none"
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Lista de entregas - ${formatDateLong(new Date().toISOString().split("T")[0])}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 14px; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { text-align: center; margin-bottom: 8px; font-size: 22px; }
          .fecha { text-align: center; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          .estado { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
          .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <h1>Multiplanet Floristería</h1>
        <p class="fecha">Lista de entregas - ${formatDateLong(new Date().toISOString().split("T")[0])}</p>
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Domicilio</th>
              <th>Arreglo</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${pedidos.map((p) => `
              <tr>
                <td>${formatTime(p.hora_entrega)}</td>
                <td>${p.cliente}</td>
                <td>${p.telefono || "-"}</td>
                <td>${p.domicilio || p.direccion || "-"}</td>
                <td>${p.arreglos?.nombre || "-"}${p.arreglos?.codigo?.trim() ? ` <strong>(${p.arreglos.codigo.trim()})</strong>` : ""}</td>
                <td>L${p.precio_total.toFixed(2)}</td>
                <td><span class="estado">${p.estado}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <p class="footer">Total: ${pedidos.length} entrega${pedidos.length !== 1 ? "s" : ""}</p>
      </body>
      </html>
    `)
    doc.close()
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => document.body.removeChild(iframe), 1500)
  }

  const handleExportExcel = () => {
    const headers = ["Hora", "Cliente", "Teléfono", "Domicilio", "Arreglo", "Total", "Estado"]
    const rows = pedidos.map((p) => [
      formatTime(p.hora_entrega),
      p.cliente,
      p.telefono || "",
      p.direccion || "",
      p.arreglos?.codigo?.trim() ? `${p.arreglos?.nombre || ""} (${p.arreglos.codigo.trim()})` : (p.arreglos?.nombre || ""),
      p.precio_total.toFixed(2),
      p.estado,
    ])
    const csv = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `entregas-${new Date().toISOString().split("T")[0]}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return null

  const handlePrintAllCarta = () => {
    pedidos.forEach((p, i) => {
      setTimeout(() => printPedidoCarta(p), i * 2500)
    })
  }

  const handlePrintAllTermica = () => {
    pedidos.forEach((p, i) => {
      setTimeout(() => printPedidoTermica(p), i * 2500)
    })
  }

  return (
    <div ref={printRef} className="space-y-3">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Pedidos del día</p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Lista
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={pedidos.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel
          </Button>
          <Button variant="outline" size="sm" disabled={pedidos.length === 0} onClick={handlePrintAllCarta} title="Imprimir cada pedido en página carta (imagen grande)">
            <FileText className="h-4 w-4 mr-1" />
            Carta (todos)
          </Button>
          <Button variant="outline" size="sm" disabled={pedidos.length === 0} onClick={handlePrintAllTermica} title="Imprimir todos los tickets térmicos">
            <Printer className="h-4 w-4 mr-1" />
            Térmicos (todos)
          </Button>
        </div>
      </div>
      {pedidos.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium">Hora</th>
                <th className="text-left p-2 font-medium">Cliente</th>
                <th className="text-left p-2 font-medium">Teléfono</th>
                <th className="text-left p-2 font-medium">Domicilio</th>
                <th className="text-left p-2 font-medium">Arreglo</th>
                <th className="text-right p-2 font-medium">Total</th>
                <th className="text-left p-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2">{formatTime(p.hora_entrega)}</td>
                  <td className="p-2 font-medium">{p.cliente}</td>
                  <td className="p-2">{p.telefono || "-"}</td>
                  <td className="p-2 max-w-[120px] truncate font-medium" title={p.domicilio || p.direccion || ""}>{p.domicilio || p.direccion || "-"}</td>
                  <td className="p-2">{p.arreglos?.nombre || "-"}{p.arreglos?.codigo?.trim() ? <><br /><span className="font-bold text-xs">{p.arreglos.codigo.trim()}</span></> : null}</td>
                  <td className="p-2 text-right">L{p.precio_total.toFixed(2)}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${ESTADO_COLORS[p.estado]}`}>
                      {p.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
