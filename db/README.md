# Esquema de base de datos — E-Clinica_SantaMaria

Este archivo contiene el SQL para crear las tablas mínimas usadas por la app: `pacientes`, `turnos`, `estudios`.

Cómo ejecutar en Supabase (recomendado):

1. Abrir tu proyecto en https://app.supabase.com
2. Ir a **SQL Editor** → **New query**
3. Pegar el contenido de `db/schema.sql` y ejecutar (`RUN`)

Alternativa (psql):

```bash
# exportar vars desde Supabase (URL, SERVICE_ROLE_KEY o ANON)
psql "postgresql://<db_user>:<db_pass>@<db_host>:<port>/<db_name>" -f db/schema.sql
```

Notas:
- Se crea la extensión `pgcrypto` para generar UUIDs.
- Ajustá las políticas RLS y permisos en Supabase según tu flujo (producción vs dev).
