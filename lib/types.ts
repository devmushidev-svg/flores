export interface Cliente {
  id: string
  telefono: string
  nombre: string
  direccion: string | null
  created_at: string
  updated_at: string
}

export interface Flor {
  id: string
  nombre: string
  precio_actual: number
  is_active: boolean
  created_at: string
}

export interface Arreglo {
  id: string
  codigo?: string | null
  nombre: string
  descripcion: string | null
  foto_url: string | null
  precio_real: number
  is_active: boolean
  created_at: string
}

export interface ArregloFlor {
  id: string
  arreglo_id: string
  flor_id: string
  cantidad: number
  created_at: string
  flores?: Flor
}

export interface ArregloWithFlores extends Arreglo {
  arreglo_flores: (ArregloFlor & { flores: Flor })[]
  costo_estimado?: number
  ganancia_estimada?: number
}

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia'

export const METODOS_PAGO: MetodoPago[] = ['efectivo', 'tarjeta', 'transferencia']

export const METODO_PAGO_LABELS: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia'
}

export interface Pedido {
  id: string
  numero_pedido: number
  cliente: string
  telefono: string | null
  direccion: string | null
  fecha_entrega: string
  hora_entrega: string | null
  arreglo_id: string | null
  descripcion: string | null
  mensaje_tarjeta: string | null
  precio_total: number
  abono: number
  saldo: number
  pago_efectivo?: number
  pago_tarjeta?: number
  pago_transferencia?: number
  estado: 'Pendiente' | 'En preparación' | 'En ruta' | 'Entregado' | 'Cancelado'
  created_at: string
  arreglos?: Arreglo
}

export type EstadoPedido = Pedido['estado']

export const ESTADOS_PEDIDO: EstadoPedido[] = [
  'Pendiente',
  'En preparación',
  'En ruta',
  'Entregado',
  'Cancelado'
]

export const ESTADO_COLORS: Record<EstadoPedido, string> = {
  'Pendiente': 'bg-amber-100 text-amber-800',
  'En preparación': 'bg-blue-100 text-blue-800',
  'En ruta': 'bg-purple-100 text-purple-800',
  'Entregado': 'bg-green-100 text-green-800',
  'Cancelado': 'bg-red-100 text-red-800'
}
