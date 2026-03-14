export interface Flor {
  id: string
  nombre: string
  precio_actual: number
  is_active: boolean
  created_at: string
}

export interface Arreglo {
  id: string
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

export interface Pedido {
  id: string
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
