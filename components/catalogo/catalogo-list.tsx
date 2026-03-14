"use client"

import { useState } from "react"
import useSWR from "swr"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { PageHeader } from "@/components/page-header"
import { ArregloCard } from "./arreglo-card"
import { ArregloForm } from "./arreglo-form"
import { createClient } from "@/lib/supabase/client"
import type { Flor, ArregloWithFlores } from "@/lib/types"

async function fetchArreglos(): Promise<ArregloWithFlores[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("arreglos")
    .select(`
      *,
      arreglo_flores (
        id,
        flor_id,
        cantidad,
        flores (*)
      )
    `)
    .eq("is_active", true)
    .order("nombre")
  
  if (error) throw error
  return data || []
}

async function fetchFlores(): Promise<Flor[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("flores")
    .select("*")
    .eq("is_active", true)
    .order("nombre")
  
  if (error) throw error
  return data || []
}

interface FlorItem {
  flor_id: string
  cantidad: number
}

export function CatalogoList() {
  const { data: arreglos, error: arreglosError, isLoading: arreglosLoading, mutate: mutateArreglos } = useSWR("arreglos", fetchArreglos)
  const { data: flores, isLoading: floresLoading } = useSWR("flores", fetchFlores)
  const [showForm, setShowForm] = useState(false)
  const [editingArreglo, setEditingArreglo] = useState<ArregloWithFlores | null>(null)

  const handleCreate = async (data: {
    nombre: string
    descripcion: string
    foto_url: string | null
    precio_real: number
    flores: FlorItem[]
  }) => {
    const supabase = createClient()
    
    // Create the arreglo
    const { data: newArreglo, error: arregloError } = await supabase
      .from("arreglos")
      .insert([{
        nombre: data.nombre,
        descripcion: data.descripcion,
        foto_url: data.foto_url,
        precio_real: data.precio_real
      }])
      .select()
      .single()
    
    if (arregloError) throw arregloError

    // Add flores to the arreglo
    if (data.flores.length > 0 && newArreglo) {
      const floresData = data.flores.map(f => ({
        arreglo_id: newArreglo.id,
        flor_id: f.flor_id,
        cantidad: f.cantidad
      }))
      
      const { error: floresError } = await supabase
        .from("arreglo_flores")
        .insert(floresData)
      
      if (floresError) throw floresError
    }

    mutateArreglos()
  }

  const handleUpdate = async (data: {
    nombre: string
    descripcion: string
    foto_url: string | null
    precio_real: number
    flores: FlorItem[]
  }) => {
    if (!editingArreglo) return
    const supabase = createClient()

    // Update the arreglo
    const { error: arregloError } = await supabase
      .from("arreglos")
      .update({
        nombre: data.nombre,
        descripcion: data.descripcion,
        foto_url: data.foto_url,
        precio_real: data.precio_real
      })
      .eq("id", editingArreglo.id)
    
    if (arregloError) throw arregloError

    // Delete existing flores and add new ones
    await supabase
      .from("arreglo_flores")
      .delete()
      .eq("arreglo_id", editingArreglo.id)

    if (data.flores.length > 0) {
      const floresData = data.flores.map(f => ({
        arreglo_id: editingArreglo.id,
        flor_id: f.flor_id,
        cantidad: f.cantidad
      }))
      
      const { error: floresError } = await supabase
        .from("arreglo_flores")
        .insert(floresData)
      
      if (floresError) throw floresError
    }

    setEditingArreglo(null)
    mutateArreglos()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("arreglos")
      .update({ is_active: false })
      .eq("id", id)
    if (error) throw error
    mutateArreglos()
  }

  const handleEdit = (arreglo: ArregloWithFlores) => {
    setEditingArreglo(arreglo)
  }

  const isLoading = arreglosLoading || floresLoading

  if (arreglosError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Catálogo de Arreglos" description="Crea y gestiona tus arreglos florales" />
        <div className="text-center py-12 text-destructive">
          Error al cargar los arreglos
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Catálogo de Arreglos" 
        description="Crea y gestiona tus arreglos florales"
        action={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : arreglos && arreglos.length > 0 ? (
        <div className="space-y-3">
          {arreglos.map((arreglo) => (
            <ArregloCard
              key={arreglo.id}
              arreglo={arreglo}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">💐</div>
          <p className="text-muted-foreground mb-4">
            No hay arreglos en el catálogo
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Crear primer arreglo
          </Button>
        </div>
      )}

      <ArregloForm
        open={showForm}
        onOpenChange={setShowForm}
        flores={flores || []}
        onSubmit={handleCreate}
      />

      <ArregloForm
        open={!!editingArreglo}
        onOpenChange={(open) => !open && setEditingArreglo(null)}
        arreglo={editingArreglo}
        flores={flores || []}
        onSubmit={handleUpdate}
      />
    </div>
  )
}
