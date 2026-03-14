"use client"

import { useState } from "react"
import useSWR from "swr"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { PageHeader } from "@/components/page-header"
import { FlorCard } from "./flor-card"
import { FlorForm } from "./flor-form"
import { createClient } from "@/lib/supabase/client"
import type { Flor } from "@/lib/types"

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

export function FloresList() {
  const { data: flores, error, isLoading, mutate } = useSWR("flores", fetchFlores)
  const [showForm, setShowForm] = useState(false)
  const [editingFlor, setEditingFlor] = useState<Flor | null>(null)

  const handleCreate = async (data: { nombre: string; precio_actual: number }) => {
    const supabase = createClient()
    const { error } = await supabase.from("flores").insert([data])
    if (error) throw error
    mutate()
  }

  const handleUpdate = async (data: { nombre: string; precio_actual: number }) => {
    if (!editingFlor) return
    const supabase = createClient()
    const { error } = await supabase
      .from("flores")
      .update(data)
      .eq("id", editingFlor.id)
    if (error) throw error
    setEditingFlor(null)
    mutate()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("flores")
      .update({ is_active: false })
      .eq("id", id)
    if (error) throw error
    mutate()
  }

  const handleEdit = (flor: Flor) => {
    setEditingFlor(flor)
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Flores" description="Gestiona los precios de tus flores" />
        <div className="text-center py-12 text-destructive">
          Error al cargar las flores
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Flores" 
        description="Gestiona los precios de tus flores"
        action={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : flores && flores.length > 0 ? (
        <div className="space-y-3">
          {flores.map((flor) => (
            <FlorCard
              key={flor.id}
              flor={flor}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🌸</div>
          <p className="text-muted-foreground mb-4">
            No hay flores registradas
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar primera flor
          </Button>
        </div>
      )}

      <FlorForm
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={handleCreate}
      />

      <FlorForm
        open={!!editingFlor}
        onOpenChange={(open) => !open && setEditingFlor(null)}
        flor={editingFlor}
        onSubmit={handleUpdate}
      />
    </div>
  )
}
