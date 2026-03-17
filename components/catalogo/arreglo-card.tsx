"use client"

import { useState } from "react"
import Image from "next/image"
import { Pencil, Trash2, ImageIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import type { ArregloWithFlores } from "@/lib/types"

interface ArregloCardProps {
  arreglo: ArregloWithFlores
  onEdit: (arreglo: ArregloWithFlores) => void
  onDelete: (id: string) => Promise<void>
}

export function ArregloCard({ arreglo, onEdit, onDelete }: ArregloCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    await onDelete(arreglo.id)
    setIsDeleting(false)
    setShowDeleteDialog(false)
  }

  const costoEstimado = arreglo.arreglo_flores?.reduce((sum, af) => {
    return sum + (af.flores?.precio_actual || 0) * af.cantidad
  }, 0) || 0

  const ganancia = arreglo.precio_real - costoEstimado

  return (
    <>
      <Card className="overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.99] group">
        <div className="flex">
          <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 relative shadow-md ring-1 ring-black/5">
            {arreglo.foto_url ? (
              <Image
                src={arreglo.foto_url}
                alt={arreglo.nombre}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105 rounded-xl"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center rounded-xl">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <CardContent className="flex-1 p-3 flex flex-col justify-between min-w-0">
            <div>
              {arreglo.codigo && (
                <span className="text-xs font-mono font-semibold text-primary bg-gradient-to-r from-primary/15 to-primary/10 px-2.5 py-1 rounded-lg mb-1 inline-block border border-primary/20">
                  {arreglo.codigo}
                </span>
              )}
              <h3 className="font-semibold text-foreground truncate">{arreglo.nombre}</h3>
              {arreglo.descripcion && (
                <p className="text-xs text-muted-foreground line-clamp-1">{arreglo.descripcion}</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="text-xs space-y-0.5">
                <div className="text-muted-foreground">
                  Costo: <span className="font-medium">L{costoEstimado.toFixed(2)}</span>
                </div>
                <div className="text-primary font-semibold">
                  Precio: L{arreglo.precio_real.toFixed(2)}
                </div>
                <div className={ganancia >= 0 ? "text-green-600" : "text-destructive"}>
                  Ganancia: L{ganancia.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => onEdit(arreglo)}
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
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-[90vw] rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar arreglo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará &quot;{arreglo.nombre}&quot; del catálogo. Los pedidos existentes no se verán afectados.
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
