-- Add payment method breakdown to pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_efectivo DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_tarjeta DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_transferencia DECIMAL(10, 2) DEFAULT 0;

-- Migrate existing data: put current abono in efectivo for old records
UPDATE pedidos 
SET pago_efectivo = abono 
WHERE (pago_efectivo IS NULL OR pago_efectivo = 0) 
  AND (pago_tarjeta IS NULL OR pago_tarjeta = 0) 
  AND (pago_transferencia IS NULL OR pago_transferencia = 0)
  AND abono > 0;
