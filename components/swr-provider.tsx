"use client"

import { SWRConfig } from "swr"

/**
 * Configuración global de SWR:
 * - dedupingInterval: si dos pantallas piden lo mismo en 10 s, se hace una sola petición
 * - keepPreviousData: al cambiar de fecha/filtro se mantiene la lista anterior mientras carga
 * - errorRetryCount: no reintentar sin fin si no hay conexión
 */
export function SwrProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 10_000,
        keepPreviousData: true,
        errorRetryCount: 3,
      }}
    >
      {children}
    </SWRConfig>
  )
}
