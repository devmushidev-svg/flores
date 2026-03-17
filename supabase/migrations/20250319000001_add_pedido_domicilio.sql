-- Domicilio de entrega: donde se entrega (distinto de direccion del cliente)
-- direccion = direccion del cliente
-- domicilio = donde se va a entregar (destacado en impresiones)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS domicilio TEXT;

-- Migrar datos existentes: copiar direccion a domicilio para pedidos que ya tienen
UPDATE pedidos SET domicilio = direccion WHERE domicilio IS NULL AND direccion IS NOT NULL;
