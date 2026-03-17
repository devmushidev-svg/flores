"use client"

import { useState, useEffect } from "react"
import { Bell, BellOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function EnablePush() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      setSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

  const handleEnable = async () => {
    if (!supported) return
    try {
      const reg = await navigator.serviceWorker.register("/sw.js")
      await reg.ready
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm === "granted") {
        toast.success("Notificaciones activadas", {
          description: "Recibirás recordatorios de entregas cuando estén configuradas.",
        })
      } else if (perm === "denied") {
        toast.info("Notificaciones bloqueadas", {
          description: "Puedes habilitarlas en la configuración del navegador.",
        })
      }
    } catch (err) {
      console.error("Push setup error:", err)
      toast.error("No se pudo activar. Verifica que la app esté en HTTPS.")
    }
  }

  if (!supported || permission === "granted") return null

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleEnable}
      className="gap-2"
    >
      {permission === "denied" ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {permission === "denied" ? "Notificaciones bloqueadas" : "Habilitar notificaciones"}
    </Button>
  )
}
