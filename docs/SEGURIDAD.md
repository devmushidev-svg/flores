# Seguridad y base de datos: pasos manuales

Algunos cambios no se pueden aplicar desde el código. Hay que hacerlos una vez en Supabase y en Vercel.

## 1. Aplicar la migración de abonos (recomendado, sin riesgo)

En Supabase, abre **SQL Editor**, pega el contenido de
`supabase/migrations/20261118000001_abonos_atomicos_e_indices.sql` y ejecútalo.

La migración hace tres cosas:
- Crea índices para que las consultas por fecha sean rápidas.
- Bloquea en la base de datos los abonos mayores que el total (saldo negativo).
- Crea la función `registrar_abono`, que suma los abonos de forma atómica. Así no se pierde un abono aunque dos personas cobren el mismo pedido a la vez.

La app funciona con o sin esta migración: si la función no existe, usa el método anterior, que ahora también valida los montos.

Para encontrar pedidos antiguos que ya tienen saldo negativo:

```sql
SELECT numero_pedido, cliente, precio_total, abono FROM pedidos WHERE abono > precio_total;
```

## 2. Exigir inicio de sesión (muy recomendado)

Hoy la base de datos acepta lecturas y escrituras de cualquiera que tenga la *anon key*, y esa llave es pública porque viaja dentro de la app. Para cerrarla, sigue estos pasos **en este orden**:

1. En Supabase, ve a **Authentication → Users → Add user** y crea una cuenta para cada persona del equipo.
2. En Vercel, ve a **Settings → Environment Variables**, agrega `REQUIRE_AUTH` = `true` y vuelve a desplegar. A partir de ahí la app pide iniciar sesión en `/auth/login`.
3. Entra con una de las cuentas y comprueba que todo funciona.
4. Recién entonces, en el SQL Editor de Supabase, ejecuta
   `supabase/opcional/rls-solo-usuarios-autenticados.sql`. Desde ese momento la base de datos sólo responde a usuarios con sesión iniciada.

> ⚠️ Si ejecutas el paso 4 antes del paso 2, la app dejará de mostrar datos.

## 3. Importar desde un enlace

`/api/import-remote` ahora sólo descarga archivos por https desde Canva, Cloudinary, Dropbox y Google Drive. Limita el tamaño a 25 MB y revisa cada redirección. Si necesitas otro dominio, agrégalo a `DOMINIOS_PERMITIDOS` en `app/api/import-remote/route.ts`.
