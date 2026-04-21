"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Plus, Upload, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { ArregloCard } from "./arreglo-card"
import { ArregloForm } from "./arreglo-form"
import { CatalogoImport } from "./catalogo-import"
import { createClient } from "@/lib/supabase/client"
import type { Flor, ArregloWithFlores } from "@/lib/types"
import { CATEGORIAS_ARREGLO } from "@/lib/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  const [showImport, setShowImport] = useState(false)
  const [editingArreglo, setEditingArreglo] = useState<ArregloWithFlores | null>(null)
  const [search, setSearch] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas")
  const [sortBy, setSortBy] = useState<"codigo" | "nombre" | "precio_desc" | "precio_asc">("codigo")

  const handleCreate = async (data: {
    codigo?: string | null
    nombre: string
    descripcion: string
    foto_url: string | null
    precio_real: number
    categoria?: string | null
    flores: FlorItem[]
  }) => {
    const supabase = createClient()

    const { data: newArreglo, error: arregloError } = await supabase
      .from("arreglos")
      .insert([{
        codigo: data.codigo || null,
        nombre: data.nombre,
        descripcion: data.descripcion,
        foto_url: data.foto_url,
        precio_real: data.precio_real,
        categoria: data.categoria || null,
      }])
      .select()
      .single()

    if (arregloError) throw arregloError

    if (data.flores.length > 0 && newArreglo) {
      const floresData = data.flores.map((f) => ({
        arreglo_id: newArreglo.id,
        flor_id: f.flor_id,
        cantidad: f.cantidad,
      }))

      const { error: floresError } = await supabase
        .from("arreglo_flores")
        .insert(floresData)

      if (floresError) throw floresError
    }

    mutateArreglos()
  }

  const handleUpdate = async (data: {
    codigo?: string | null
    nombre: string
    descripcion: string
    foto_url: string | null
    precio_real: number
    categoria?: string | null
    flores: FlorItem[]
  }) => {
    if (!editingArreglo) return
    const supabase = createClient()

    const { error: arregloError } = await supabase
      .from("arreglos")
      .update({
        codigo: data.codigo || null,
        nombre: data.nombre,
        descripcion: data.descripcion,
        foto_url: data.foto_url,
        precio_real: data.precio_real,
        categoria: data.categoria || null,
      })
      .eq("id", editingArreglo.id)

    if (arregloError) throw arregloError

    await supabase
      .from("arreglo_flores")
      .delete()
      .eq("arreglo_id", editingArreglo.id)

    if (data.flores.length > 0) {
      const floresData = data.flores.map((f) => ({
        arreglo_id: editingArreglo.id,
        flor_id: f.flor_id,
        cantidad: f.cantidad,
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

  const handleDuplicate = async (arreglo: ArregloWithFlores) => {
    const supabase = createClient()
    const { data: newArreglo, error: arregloError } = await supabase
      .from("arreglos")
      .insert([{
        codigo: arreglo.codigo ? `${arreglo.codigo}-copia` : null,
        nombre: `${arreglo.nombre} (copia)`,
        descripcion: arreglo.descripcion,
        foto_url: arreglo.foto_url,
        precio_real: arreglo.precio_real,
        categoria: arreglo.categoria || null,
      }])
      .select()
      .single()

    if (arregloError) {
      alert("Error al duplicar: " + arregloError.message)
      return
    }

    if (arreglo.arreglo_flores?.length && newArreglo) {
      const floresData = arreglo.arreglo_flores.map((af) => ({
        arreglo_id: newArreglo.id,
        flor_id: af.flor_id,
        cantidad: af.cantidad,
      }))
      await supabase.from("arreglo_flores").insert(floresData)
    }

    mutateArreglos()
    const dupWithFlores: ArregloWithFlores = {
      ...newArreglo,
      arreglo_flores: (arreglo.arreglo_flores || []).map((af) => ({
        ...af,
        id: "",
        arreglo_id: newArreglo.id,
        created_at: "",
        flores: af.flores,
      })),
    }
    setEditingArreglo(dupWithFlores)
    setShowForm(true)
  }

  const isLoading = arreglosLoading || floresLoading

  const filteredArreglos = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = (arreglos || []).filter((arreglo) => {
      const categoria = arreglo.categoria || "Otro"
      const matchesCategoria = categoriaFiltro === "todas" || categoria === categoriaFiltro

      if (!matchesCategoria) return false
      if (!query) return true

      const searchableText = [
        arreglo.codigo || "",
        arreglo.nombre || "",
        arreglo.descripcion || "",
        arreglo.categoria || "",
      ].join(" ").toLowerCase()

      return searchableText.includes(query)
    })

    return filtered.sort((a, b) => {
      if (sortBy === "nombre") {
        return a.nombre.localeCompare(b.nombre, "es", { numeric: true, sensitivity: "base" })
      }

      if (sortBy === "precio_desc") {
        return b.precio_real - a.precio_real
      }

      if (sortBy === "precio_asc") {
        return a.precio_real - b.precio_real
      }

      const aCodigo = (a.codigo || "ZZZ").trim()
      const bCodigo = (b.codigo || "ZZZ").trim()
      return aCodigo.localeCompare(bCodigo, "es", { numeric: true, sensitivity: "base" })
    })
  }, [arreglos, categoriaFiltro, search, sortBy])

  if (arreglosError) {
    return (
      <div className="space-y-6">
        <PageHeader title="CatÃ¡logo de Arreglos" description="Crea y gestiona tus arreglos florales" />
        <div className="text-center py-12 text-destructive">
          Error al cargar los arreglos
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CatÃ¡logo de Arreglos"
        description="Crea y gestiona tus arreglos florales"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Importar
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nuevo
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por codigo, nombre, descripcion o categoria"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-10"
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorias</SelectItem>
              {CATEGORIAS_ARREGLO.map((categoria) => (
                <SelectItem key={categoria} value={categoria}>
                  {categoria}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
            <SelectTrigger>
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="codigo">Codigo A-Z</SelectItem>
              <SelectItem value="nombre">Nombre A-Z</SelectItem>
              <SelectItem value="precio_desc">Precio mayor</SelectItem>
              <SelectItem value="precio_asc">Precio menor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {filteredArreglos.length} de {arreglos?.length || 0} arreglos
          </Badge>
          {categoriaFiltro !== "todas" && (
            <Badge variant="outline">{categoriaFiltro}</Badge>
          )}
          {search && (
            <Badge variant="outline">Busqueda: {search}</Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 animate-fade-in">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : filteredArreglos.length > 0 ? (
        <div className="space-y-3">
          {filteredArreglos.map((arreglo, idx) => (
            <div
              key={arreglo.id}
              className="animate-fade-in-up opacity-0"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <ArregloCard
                arreglo={arreglo}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">ðŸ’</div>
          <p className="text-muted-foreground mb-4">
            {arreglos && arreglos.length > 0
              ? "No hay arreglos que coincidan con los filtros"
              : "No hay arreglos en el catÃ¡logo"}
          </p>
          {arreglos && arreglos.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => {
                setSearch("")
                setCategoriaFiltro("todas")
                setSortBy("codigo")
              }}
            >
              Limpiar filtros
            </Button>
          ) : (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Crear primer arreglo
            </Button>
          )}
        </div>
      )}

      <ArregloForm
        open={showForm}
        onOpenChange={setShowForm}
        flores={flores || []}
        onSubmit={handleCreate}
      />

      <CatalogoImport
        open={showImport}
        onOpenChange={setShowImport}
        onSuccess={() => mutateArreglos()}
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
