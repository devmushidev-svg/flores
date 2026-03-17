/**
 * Print utilities for pedidos - thermal and letter size.
 */

import type { Pedido } from "./types"

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" })
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return "No especificada"
  const [h, m] = timeStr.split(":")
  const hour = parseInt(h)
  const ampm = hour >= 12 ? "pm" : "am"
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${ampm}`
}

function doPrint(iframe: HTMLIFrameElement) {
  const win = iframe.contentWindow
  if (!win) return
  let done = false
  const run = () => {
    if (done) return
    done = true
    win.focus()
    win.print()
    setTimeout(() => iframe.parentNode?.removeChild(iframe), 1500)
  }
  win.onload = run
  setTimeout(run, 600)
}

export function printPedidoTermica(pedido: Pedido) {
  const fechaEntrega = formatDateLong(pedido.fecha_entrega)
  const horaEntrega = formatTime(pedido.hora_entrega)
  const arregloNombre = pedido.arreglos?.nombre || "Arreglo personalizado"
  const arregloCodigo = pedido.arreglos?.codigo?.trim() || null // Código del producto en negrita debajo del nombre
  const arregloFoto = pedido.arreglos?.foto_url
  const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "/logo.png"

  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none"
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido N${pedido.numero_pedido}</title>
    <style>
      @page { margin: 0; size: 80mm auto; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 14px; font-weight: 600; width: 80mm; padding: 6px; line-height: 1.3; }
      .header { text-align: center; margin-bottom: 8px; border-bottom: 3px solid #000; padding-bottom: 8px; }
      .logo { width: 50px; height: 50px; margin: 0 auto 6px; }
      .logo img { width: 100%; height: 100%; object-fit: contain; }
      .business-name { font-size: 18px; font-weight: 900; text-transform: uppercase; }
      .business-info { font-size: 11px; margin-top: 4px; }
      .order-number { font-size: 28px; font-weight: 900; margin: 8px 0; text-align: center; background: #000; color: #fff; padding: 6px 4px; }
      .section { margin: 6px 0; padding: 6px 0; border-bottom: 1px dashed #000; }
      .section-title { font-weight: 900; font-size: 13px; margin-bottom: 4px; border-bottom: 1px solid #000; padding-bottom: 2px; }
      .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 13px; }
      .label { font-weight: 700; }
      .value { font-weight: 600; text-align: right; max-width: 55%; word-break: break-word; }
      .full-row { margin: 3px 0; }
      .full-row .label { display: block; margin-bottom: 1px; font-weight: 700; }
      .full-row .value { text-align: left; max-width: 100%; padding-left: 6px; }
      .totals { border: 2px solid #000; padding: 6px; margin: 8px 0; }
      .totals .row { font-size: 14px; font-weight: 700; margin: 2px 0; }
      .totals .total-row { font-size: 20px; font-weight: 900; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
      .arreglo-img { text-align: center; margin: 6px 0; }
      .arreglo-img img { max-width: 90%; max-height: 100px; object-fit: contain; border: 2px solid #000; }
      .footer { text-align: center; margin-top: 8px; font-size: 11px; border-top: 3px solid #000; padding-top: 8px; }
    </style></head><body>
    <div class="header">
      <div class="logo"><img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'" /></div>
      <div class="business-name">Multiplanet Floristeria</div>
      <div class="business-info">Barrio el centro, Tocoa Colon<br>Tel: +504 95841794</div>
    </div>
    <div class="order-number">PEDIDO N${pedido.numero_pedido}</div>
    <div class="section">
      <div class="section-title">Cliente</div>
      <div class="row"><span class="label">Cliente:</span><span class="value">${pedido.cliente}</span></div>
      ${pedido.telefono ? `<div class="row"><span class="label">Telefono:</span><span class="value">${pedido.telefono}</span></div>` : ""}
    </div>
    <div class="section">
      <div class="section-title">Entrega</div>
      <div class="row"><span class="label">Fecha:</span><span class="value">${fechaEntrega}</span></div>
      <div class="row"><span class="label">Hora:</span><span class="value">${horaEntrega}</span></div>
      ${(pedido.domicilio || pedido.direccion) ? `<div class="full-row"><span class="label">DOMICILIO ENTREGA:</span><span class="value" style="font-size:16px;font-weight:900;">${pedido.domicilio || pedido.direccion}</span></div>` : ""}
      ${pedido.direccion && pedido.domicilio && pedido.direccion !== pedido.domicilio ? `<div class="full-row"><span class="label">Dir. cliente:</span><span class="value" style="font-size:11px;">${pedido.direccion}</span></div>` : ""}
    </div>
    <div class="section">
      <div class="section-title">Arreglo</div>
      <div style="text-align:center;font-weight:900;margin:4px 0;">${arregloNombre}</div>
      ${arregloCodigo ? `<div style="text-align:center;font-weight:900;margin:2px 0;font-size:13px;"><strong>${arregloCodigo}</strong></div>` : ""}
      ${arregloFoto ? `<div class="arreglo-img"><img src="${arregloFoto}" alt="${arregloNombre}" onerror="this.style.display='none'" /></div>` : ""}
      ${pedido.descripcion ? `<div style="border:2px solid #000;padding:4px;margin:4px 0;font-size:12px;"><strong>NOTA:</strong> ${pedido.descripcion}</div>` : ""}
      ${pedido.mensaje_tarjeta ? `<div style="border:2px dashed #000;padding:4px;margin:4px 0;font-size:12px;font-style:italic;"><strong>TARJETA:</strong> "${pedido.mensaje_tarjeta}"</div>` : ""}
    </div>
    <div class="totals">
      <div class="section-title">Pago</div>
      <div class="row"><span class="label">Efectivo:</span><span class="value">L${(pedido.pago_efectivo ?? 0).toFixed(2)}</span></div>
      <div class="row"><span class="label">Tarjeta:</span><span class="value">L${(pedido.pago_tarjeta ?? 0).toFixed(2)}</span></div>
      <div class="row"><span class="label">Transferencia:</span><span class="value">L${(pedido.pago_transferencia ?? 0).toFixed(2)}</span></div>
      <div class="row"><span class="label">Abonado:</span><span class="value">L${pedido.abono.toFixed(2)}</span></div>
      <div class="row"><span class="label">Saldo:</span><span class="value">L${pedido.saldo.toFixed(2)}</span></div>
      <div class="row total-row"><span class="label">GRAN TOTAL:</span><span class="value">L${pedido.precio_total.toFixed(2)}</span></div>
    </div>
    <div class="footer">Gracias por su preferencia!<br>Multiplanet Floristeria<br><small>Impreso: ${new Date().toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" })}</small></div>
    </body></html>`)
  doc.close()
  doPrint(iframe)
}

export function printPedidoCarta(pedido: Pedido) {
  const fechaEntrega = formatDateLong(pedido.fecha_entrega)
  const horaEntrega = formatTime(pedido.hora_entrega)
  const arregloNombre = pedido.arreglos?.nombre || "Arreglo personalizado"
  const arregloCodigo = pedido.arreglos?.codigo?.trim() || null // Código del producto en negrita debajo del nombre
  const arregloFoto = pedido.arreglos?.foto_url
  const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "/logo.png"

  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none"
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido N${pedido.numero_pedido}</title>
    <style>
      @page { size: letter; margin: 15mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 14px; padding: 20px; max-width: 210mm; }
      .header { text-align: center; margin-bottom: 16px; border-bottom: 3px solid #000; padding-bottom: 12px; }
      .logo { width: 80px; height: 80px; margin: 0 auto 8px; }
      .logo img { width: 100%; height: 100%; object-fit: contain; }
      .business-name { font-size: 24px; font-weight: 900; text-transform: uppercase; }
      .business-info { font-size: 12px; margin-top: 6px; }
      .order-num { font-size: 32px; font-weight: 900; text-align: center; background: #000; color: #fff; padding: 12px; margin: 12px 0; letter-spacing: 3px; }
      .flex { display: flex; gap: 24px; margin: 16px 0; }
      .foto { flex: 0 0 280px; }
      .foto img { width: 100%; max-height: 320px; object-fit: contain; border: 2px solid #000; }
      .info { flex: 1; }
      .section { margin: 12px 0; padding: 8px 0; border-bottom: 1px dashed #000; }
      .section-title { font-weight: 900; font-size: 14px; margin-bottom: 6px; }
      .row { display: flex; justify-content: space-between; margin: 4px 0; }
      .label { font-weight: 700; }
      .totals { border: 2px solid #000; padding: 12px; margin: 16px 0; }
      .total-row { font-size: 22px; font-weight: 900; margin-top: 8px; padding-top: 8px; border-top: 2px solid #000; }
      .footer { text-align: center; margin-top: 16px; font-size: 12px; border-top: 3px solid #000; padding-top: 12px; }
    </style></head><body>
    <div class="header">
      <div class="logo"><img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'" /></div>
      <div class="business-name">Multiplanet Floristería</div>
      <div class="business-info">Barrio el centro, Tocoa Colón · Tel: +504 95841794</div>
    </div>
    <div class="order-num">PEDIDO N${pedido.numero_pedido}</div>
    <div class="flex">
      <div class="foto">
        ${arregloFoto ? `<img src="${arregloFoto}" alt="${arregloNombre}" onerror="this.style.display='none'" />` : `<div style="height:200px;border:2px dashed #000;display:flex;align-items:center;justify-content:center;color:#666;">Sin imagen</div>`}
      </div>
      <div class="info">
        <div class="section">
          <div class="section-title">Cliente</div>
          <div class="row"><span class="label">Nombre:</span><span>${pedido.cliente}</span></div>
          ${pedido.telefono ? `<div class="row"><span class="label">Teléfono:</span><span>${pedido.telefono}</span></div>` : ""}
        </div>
        <div class="section">
          <div class="section-title">Entrega</div>
          <div class="row"><span class="label">Fecha:</span><span>${fechaEntrega}</span></div>
          <div class="row"><span class="label">Hora:</span><span>${horaEntrega}</span></div>
          ${(pedido.domicilio || pedido.direccion) ? `<div class="row" style="margin-top:8px;"><span class="label" style="font-size:12px;">DOMICILIO ENTREGA:</span></div><div style="font-size:18px;font-weight:900;margin:4px 0;padding:6px;border:2px solid #000;background:#f5f5f5;">${pedido.domicilio || pedido.direccion}</div>` : ""}
          ${pedido.direccion && pedido.domicilio && pedido.direccion !== pedido.domicilio ? `<div class="row" style="margin-top:4px;"><span class="label" style="font-size:11px;">Dir. cliente:</span><span style="font-size:11px;">${pedido.direccion}</span></div>` : ""}
        </div>
        <div class="section">
          <div class="section-title">Arreglo</div>
          <div class="row"><span class="label">${arregloNombre}</span></div>
          ${arregloCodigo ? `<div style="margin-top:2px;font-weight:900;"><strong>${arregloCodigo}</strong></div>` : ""}
          ${pedido.descripcion ? `<p style="margin-top:4px;"><strong>Nota:</strong> ${pedido.descripcion}</p>` : ""}
          ${pedido.mensaje_tarjeta ? `<p style="margin-top:4px;font-style:italic;"><strong>Tarjeta:</strong> "${pedido.mensaje_tarjeta}"</p>` : ""}
        </div>
        <div class="totals">
          <div class="section-title">Pago</div>
          <div class="row"><span>Efectivo:</span><span>L${(pedido.pago_efectivo ?? 0).toFixed(2)}</span></div>
          <div class="row"><span>Tarjeta:</span><span>L${(pedido.pago_tarjeta ?? 0).toFixed(2)}</span></div>
          <div class="row"><span>Transferencia:</span><span>L${(pedido.pago_transferencia ?? 0).toFixed(2)}</span></div>
          <div class="row"><span>Abonado:</span><span>L${pedido.abono.toFixed(2)}</span></div>
          <div class="row"><span>Saldo:</span><span>L${pedido.saldo.toFixed(2)}</span></div>
          <div class="row total-row"><span>GRAN TOTAL:</span><span>L${pedido.precio_total.toFixed(2)}</span></div>
        </div>
      </div>
    </div>
    <div class="footer">Gracias por su preferencia · Multiplanet Floristería<br><small>Impreso: ${new Date().toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" })}</small></div>
    </body></html>`)
  doc.close()
  doPrint(iframe)
}
