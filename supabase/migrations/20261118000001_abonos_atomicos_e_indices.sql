-- 1) Índice para las consultas por fecha (Inicio, Pedidos, Entregas, Reportes)
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_estado ON pedidos (fecha_entrega, estado);
CREATE INDEX IF NOT EXISTS idx_clientes_updated_at ON clientes (updated_at DESC);

-- 2) Nunca guardar un abono mayor que el total (saldo negativo) ni negativo.
--    NOT VALID: no falla por pedidos antiguos que ya tengan saldo negativo;
--    sí se aplica a todo pedido nuevo o modificado. Para revisar los antiguos:
--      SELECT numero_pedido, cliente, precio_total, abono FROM pedidos WHERE abono > precio_total;
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_abono_valido;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_abono_valido CHECK (abono >= 0 AND abono <= precio_total) NOT VALID;

-- 3) Registrar un abono de forma atómica (evita perder abonos si dos personas
--    cobran el mismo pedido a la vez). La app la usa automáticamente si existe.
CREATE OR REPLACE FUNCTION registrar_abono(p_pedido_id uuid, p_monto numeric, p_metodo text)
RETURNS pedidos
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_pedido pedidos;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor que cero' USING ERRCODE = '22023';
  END IF;
  IF p_metodo NOT IN ('efectivo', 'tarjeta', 'transferencia') THEN
    RAISE EXCEPTION 'Método de pago inválido: %', p_metodo USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pedido FROM pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF p_monto > (v_pedido.precio_total - COALESCE(v_pedido.abono, 0)) + 0.009 THEN
    RAISE EXCEPTION 'El abono no puede ser mayor que el saldo pendiente (L%)',
      round(v_pedido.precio_total - COALESCE(v_pedido.abono, 0), 2) USING ERRCODE = '22023';
  END IF;

  UPDATE pedidos SET
    pago_efectivo      = COALESCE(pago_efectivo, 0)      + CASE WHEN p_metodo = 'efectivo'      THEN p_monto ELSE 0 END,
    pago_tarjeta       = COALESCE(pago_tarjeta, 0)       + CASE WHEN p_metodo = 'tarjeta'       THEN p_monto ELSE 0 END,
    pago_transferencia = COALESCE(pago_transferencia, 0) + CASE WHEN p_metodo = 'transferencia' THEN p_monto ELSE 0 END,
    abono              = COALESCE(abono, 0) + p_monto
  WHERE id = p_pedido_id
  RETURNING * INTO v_pedido;

  RETURN v_pedido;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_abono(uuid, numeric, text) TO anon, authenticated;
