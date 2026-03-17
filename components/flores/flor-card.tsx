"use client"

import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
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
import type { Flor } from "@/lib/types"

interface FlorCardProps {
  flor: Flor
  onEdit: (flor: Flor) => void
  onDelete: (id: string) => Promise<void>
}

export function FlorCard({ flor, onEdit, onDelete }: FlorCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    await onDelete(flor.id)
    setIsDeleting(false)
    setShowDeleteDialog(false)
  }

  return (
    <>
      <Card className="overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.99]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0 text-white shadow-md">
                <span className="text-xl">🌸</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{flor.nombre}</h3>
                <p className="text-sm text-muted-foreground">
                  L{flor.precio_actual.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9"
                onClick={() => onEdit(flor)}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Editar</span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 text-destructive hover:text-destructive"
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
            <AlertDialogTitle>¿Eliminar flor?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará &quot;{flor.nombre}&quot; del catálogo. Los arreglos existentes no se verán afectados.
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
