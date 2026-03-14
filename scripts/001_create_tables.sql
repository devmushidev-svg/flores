-- Flower Shop Management Database Schema

-- Table: flores (flowers with prices)
CREATE TABLE IF NOT EXISTS flores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  precio_actual DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: arreglos (flower arrangements/catalog)
CREATE TABLE IF NOT EXISTS arreglos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  foto_url TEXT,
  precio_real DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: arreglo_flores (flowers in each arrangement)
CREATE TABLE IF NOT EXISTS arreglo_flores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arreglo_id UUID NOT NULL REFERENCES arreglos(id) ON DELETE CASCADE,
  flor_id UUID NOT NULL REFERENCES flores(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: pedidos (orders)
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  fecha_entrega DATE NOT NULL,
  hora_entrega TIME,
  arreglo_id UUID REFERENCES arreglos(id) ON DELETE SET NULL,
  descripcion TEXT,
  mensaje_tarjeta TEXT,
  precio_total DECIMAL(10, 2) NOT NULL,
  abono DECIMAL(10, 2) DEFAULT 0,
  saldo DECIMAL(10, 2) GENERATED ALWAYS AS (precio_total - abono) STORED,
  estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En preparación', 'En ruta', 'Entregado', 'Cancelado')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_flores_is_active ON flores(is_active);
CREATE INDEX IF NOT EXISTS idx_arreglos_is_active ON arreglos(is_active);
CREATE INDEX IF NOT EXISTS idx_arreglo_flores_arreglo_id ON arreglo_flores(arreglo_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_entrega ON pedidos(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);

-- Disable RLS for public access (since auth is optional)
ALTER TABLE flores ENABLE ROW LEVEL SECURITY;
ALTER TABLE arreglos ENABLE ROW LEVEL SECURITY;
ALTER TABLE arreglo_flores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no authentication required)
CREATE POLICY "Allow public read flores" ON flores FOR SELECT USING (true);
CREATE POLICY "Allow public insert flores" ON flores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update flores" ON flores FOR UPDATE USING (true);
CREATE POLICY "Allow public delete flores" ON flores FOR DELETE USING (true);

CREATE POLICY "Allow public read arreglos" ON arreglos FOR SELECT USING (true);
CREATE POLICY "Allow public insert arreglos" ON arreglos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update arreglos" ON arreglos FOR UPDATE USING (true);
CREATE POLICY "Allow public delete arreglos" ON arreglos FOR DELETE USING (true);

CREATE POLICY "Allow public read arreglo_flores" ON arreglo_flores FOR SELECT USING (true);
CREATE POLICY "Allow public insert arreglo_flores" ON arreglo_flores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update arreglo_flores" ON arreglo_flores FOR UPDATE USING (true);
CREATE POLICY "Allow public delete arreglo_flores" ON arreglo_flores FOR DELETE USING (true);

CREATE POLICY "Allow public read pedidos" ON pedidos FOR SELECT USING (true);
CREATE POLICY "Allow public insert pedidos" ON pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update pedidos" ON pedidos FOR UPDATE USING (true);
CREATE POLICY "Allow public delete pedidos" ON pedidos FOR DELETE USING (true);
