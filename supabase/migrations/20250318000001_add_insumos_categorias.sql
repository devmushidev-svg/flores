-- Insumos (cintas, papel, etc.) - distintos de flores
CREATE TABLE IF NOT EXISTS insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  precio_actual NUMERIC(10,2) NOT NULL DEFAULT 0,
  unidad TEXT DEFAULT 'unidad',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Relación arreglo-insumos (cantidad de insumos por arreglo)
CREATE TABLE IF NOT EXISTS arreglo_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arreglo_id UUID NOT NULL REFERENCES arreglos(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(arreglo_id, insumo_id)
);

-- Categorías de arreglos (Ramo, Centro de mesa, Funeral, etc.)
ALTER TABLE arreglos ADD COLUMN IF NOT EXISTS categoria TEXT;

CREATE INDEX IF NOT EXISTS idx_arreglos_categoria ON arreglos(categoria) WHERE categoria IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_arreglo_insumos_arreglo ON arreglo_insumos(arreglo_id);
CREATE INDEX IF NOT EXISTS idx_arreglo_insumos_insumo ON arreglo_insumos(insumo_id);
