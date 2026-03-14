-- Create clientes table for auto-save and autocomplete
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast phone lookups
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);

-- Enable RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Public access policies
CREATE POLICY "Allow public read clientes" ON clientes FOR SELECT USING (true);
CREATE POLICY "Allow public insert clientes" ON clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update clientes" ON clientes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete clientes" ON clientes FOR DELETE USING (true);
