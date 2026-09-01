# Consultorio Santa María

Proyecto inicial de gestión para consultorio médico unipersonal con Next.js App Router, TypeScript, Tailwind CSS y Supabase.

## Inicializar el proyecto

1. Instalar dependencias:

```bash
npm install
```

2. Copiar el archivo de ejemplo de variables de entorno:

```bash
copy .env.local.example .env.local
```

3. Completar las variables de entorno con tus credenciales de Supabase y Resend.

4. Ejecutar el servidor de desarrollo:

```bash
npm run dev
```

5. Abrir [http://localhost:3000](http://localhost:3000).

## Rutas principales

- `/` - Landing pública.
- `/turnos` - Solicitud de turno.
- `/login` - Autenticación con email y contraseña.
- `/panel` - Panel médico protegido.
- `/mi-cuenta` - Panel de paciente protegido.
- `/api/reminders` - Ruta de recordatorio diario preparada para cron.

## Base de datos (esquema SQL)

```sql
create table pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  telefono text,
  created_at timestamptz default now()
);

create table turnos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  telefono text not null,
  motivo text not null,
  fecha_preferida date not null,
  hora_preferida time not null,
  estado text not null default 'pendiente',
  recordatorio_enviado boolean not null default false,
  created_at timestamptz default now()
);

create table estudios (
  id uuid primary key default gen_random_uuid(),
  paciente_email text not null references pacientes(email),
  titulo text not null,
  categoria text not null,
  fecha date not null,
  hora time not null,
  file_url text,
  external_url text,
  created_at timestamptz default now()
);
```

## Recordatorios por email

La integración de recordatorios usa Resend y Supabase.

- Se revisan los turnos con `recordatorio_enviado = false`.
- Si el turno está a 2 días, se prepara un email de recordatorio.
- Después de enviar, el registro se actualiza para no duplicar el aviso.
- Para producción, agrega un cron en Vercel que llame a `/api/reminders` cada día.
# E-Clinical-SaludDigital
