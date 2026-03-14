-- Add order number to pedidos table
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero_pedido SERIAL;

-- Create a unique index on numero_pedido
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_numero_pedido ON pedidos(numero_pedido);
