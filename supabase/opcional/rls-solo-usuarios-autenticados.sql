-- OPCIONAL — aplicar SÓLO después de:
--   1) crear las cuentas del personal en Supabase (Authentication > Users), y
--   2) activar REQUIRE_AUTH=true en Vercel (Settings > Environment Variables) y redeploy.
-- Si se aplica antes, la app dejará de mostrar datos hasta que se inicie sesión.
--
-- Cambia las políticas públicas (cualquiera con la anon key podía leer/borrar todo)
-- por políticas que exigen un usuario con sesión iniciada.

DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','flores','insumos','arreglos','arreglo_flores','arreglo_insumos','pedidos'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON %I', pol.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
                   'personal_autenticado_' || t, t);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION registrar_abono(uuid, numeric, text) FROM anon;
