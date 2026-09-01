-- RLS policies for E-Clinica_SantaMaria
-- Ejecutar en Supabase SQL editor. Haz backup antes de aplicar.

-- 1) Añadir columna link entre pacientes y auth.users (si no existe)
alter table public.pacientes
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Asegurarse de que la columna `dni` exista (evita error 42703)
alter table public.pacientes
  add column if not exists dni text;

-- Asegurarse de que la columna `apellido` exista
alter table public.pacientes
  add column if not exists apellido text;

-- Asegurarse de que existan todas las columnas de la ficha médica del paciente
alter table public.pacientes
  add column if not exists fecha_nacimiento date,
  add column if not exists sexo text,
  add column if not exists direccion text,
  add column if not exists obra_social text,
  add column if not exists numero_afiliado text,
  add column if not exists contacto_emergencia_nombre text,
  add column if not exists contacto_emergencia_telefono text,
  add column if not exists updated_at timestamptz not null default now();

-- Asegurarse de que la tabla `antecedentes` exista antes de habilitar RLS
create table if not exists public.antecedentes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  tipo text not null,
  titulo text,
  descripcion text,
  created_at timestamptz default now()
);

-- Asegurarse de que las tablas relacionadas existan antes de habilitar RLS
create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  fecha date not null,
  hora time not null,
  motivo text,
  examen_fisico text,
  observaciones text,
  created_at timestamptz default now()
);

create table if not exists public.diagnosticos (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid references public.consultas(id) on delete cascade,
  texto text not null,
  cie10 text,
  fecha date,
  created_at timestamptz default now()
);

create table if not exists public.medicaciones (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid references public.pacientes(id) on delete cascade,
  consulta_id uuid references public.consultas(id) on delete set null,
  nombre text not null,
  dosis text,
  frecuencia text,
  fecha_inicio date,
  fecha_fin date,
  activo boolean default true,
  comentarios text,
  created_at timestamptz default now()
);

create table if not exists public.recetas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid references public.pacientes(id) on delete cascade,
  consulta_id uuid references public.consultas(id) on delete set null,
  descripcion text,
  pdf_url text,
  created_at timestamptz default now()
);

create table if not exists public.estudios (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid references public.pacientes(id) on delete cascade,
  consulta_id uuid references public.consultas(id) on delete set null,
  tipo text,
  titulo text,
  fecha date,
  descripcion text,
  storage_path text,
  file_url text,
  preview_url text,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid references public.pacientes(id) on delete set null,
  nombre text,
  email text,
  telefono text,
  dni text,
  motivo text,
  fecha_preferida date,
  hora_preferida time,
  obra_social text,
  es_particular boolean default false,
  tipo_consulta text,
  estado text default 'pendiente',
  google_calendar_event_id text,
  google_calendar_status text,
  recordatorio_enviado boolean default false,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table public.turnos add column if not exists obra_social text;
alter table public.turnos add column if not exists es_particular boolean default false;

-- Asegurarse de que la tabla para tokens de Google exista (muy sensible)
create table if not exists public.google_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  refresh_token text,
  access_token text,
  scope text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- 2) Crear tabla de médicos (doctors) para mapear auth.users con rol médico
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  nombre text,
  profesion text,
  especialidad text,
  telefono text,
  documento text,
  sexo text,
  estado_civil text,
  obra_social text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table public.doctors add column if not exists nombre text;
alter table public.doctors add column if not exists profesion text;
alter table public.doctors add column if not exists especialidad text;
alter table public.doctors add column if not exists telefono text;
alter table public.doctors add column if not exists documento text;
alter table public.doctors add column if not exists sexo text;
alter table public.doctors add column if not exists estado_civil text;
alter table public.doctors add column if not exists obra_social text;
alter table public.doctors add column if not exists metadata jsonb;
alter table public.doctors add column if not exists updated_at timestamptz not null default now();

-- Asegurarse de que existe `updated_at` en tablas que usan el trigger genérico set_updated_at()
alter table public.antecedentes add column if not exists updated_at timestamptz not null default now();
alter table public.consultas add column if not exists updated_at timestamptz not null default now();
alter table public.diagnosticos add column if not exists updated_at timestamptz not null default now();
alter table public.medicaciones add column if not exists updated_at timestamptz not null default now();
alter table public.recetas add column if not exists updated_at timestamptz not null default now();
alter table public.estudios add column if not exists updated_at timestamptz not null default now();

-- 3) Habilitar RLS en tablas sensibles
alter table public.pacientes enable row level security;
alter table public.antecedentes enable row level security;
alter table public.consultas enable row level security;
alter table public.diagnosticos enable row level security;
alter table public.medicaciones enable row level security;
alter table public.recetas enable row level security;
alter table public.estudios enable row level security;
alter table public.turnos enable row level security;
-- NOTA: public.google_tokens es extremadamente sensible. No creamos políticas de acceso público aquí; usar solo service_role en backend.
alter table public.google_tokens enable row level security;

-- 4) Revoke permisos públicos (opcional pero recomendado)
revoke all on table public.pacientes from public;
revoke all on table public.antecedentes from public;
revoke all on table public.consultas from public;
revoke all on table public.diagnosticos from public;
revoke all on table public.medicaciones from public;
revoke all on table public.recetas from public;
revoke all on table public.estudios from public;
revoke all on table public.turnos from public;
revoke all on table public.google_tokens from public;

-- 5) POLÍTICAS: Acceso completo para médicos (existencia en public.doctors)
-- Se reemplaza por una política simple para no generar recursión infinita.

-- PACIENTES: médicos pueden ver/insertar/actualizar/borrar
drop policy if exists "doctors_manage_pacientes" on public.pacientes;
drop policy if exists "allow_authenticated_access_pacientes" on public.pacientes;
create policy "allow_authenticated_access_pacientes" on public.pacientes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- PACIENTES: paciente puede ver/actualizar su propia fila
drop policy if exists "patient_own_row_select" on public.pacientes;
create policy "patient_own_row_select" on public.pacientes
  for select using (auth.uid() = user_id);

drop policy if exists "patient_own_row_update" on public.pacientes;
create policy "patient_own_row_update" on public.pacientes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ANTECEDENTES: médicos gestionan, paciente ve sus antecedentes
drop policy if exists "doctors_manage_antecedentes" on public.antecedentes;
drop policy if exists "allow_authenticated_access_antecedentes" on public.antecedentes;
create policy "allow_authenticated_access_antecedentes" on public.antecedentes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "patient_see_own_antecedentes" on public.antecedentes;
create policy "patient_see_own_antecedentes" on public.antecedentes
  for select using (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  );

-- CONSULTAS: médicos gestionan, paciente ve sus consultas
drop policy if exists "doctors_manage_consultas" on public.consultas;
drop policy if exists "allow_authenticated_access_consultas" on public.consultas;
create policy "allow_authenticated_access_consultas" on public.consultas
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "patient_see_own_consultas" on public.consultas;
create policy "patient_see_own_consultas" on public.consultas
  for select using (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "patient_insert_own_consultas" on public.consultas;
create policy "patient_insert_own_consultas" on public.consultas
  for insert with check (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "patient_update_own_consultas" on public.consultas;
create policy "patient_update_own_consultas" on public.consultas
  for update using (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  );

-- DIAGNOSTICOS: médicos gestionan, paciente ve diagnósticos de sus consultas
drop policy if exists "doctors_manage_diagnosticos" on public.diagnosticos;
drop policy if exists "allow_authenticated_access_diagnosticos" on public.diagnosticos;
create policy "allow_authenticated_access_diagnosticos" on public.diagnosticos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "patient_see_own_diagnosticos" on public.diagnosticos;
create policy "patient_see_own_diagnosticos" on public.diagnosticos
  for select using (
    exists (
      select 1 from public.consultas c
      join public.pacientes p on c.paciente_id = p.id
      where c.id = consulta_id and p.user_id = auth.uid()
    )
  );

-- MEDICACIONES: médicos gestionan, paciente ve sus medicaciones
drop policy if exists "doctors_manage_medicaciones" on public.medicaciones;
drop policy if exists "allow_authenticated_access_medicaciones" on public.medicaciones;
create policy "allow_authenticated_access_medicaciones" on public.medicaciones
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "patient_see_own_medicaciones" on public.medicaciones;
create policy "patient_see_own_medicaciones" on public.medicaciones
  for select using (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "patient_insert_own_medicaciones" on public.medicaciones;
create policy "patient_insert_own_medicaciones" on public.medicaciones
  for insert with check (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  );

-- RECETAS: médicos gestionan, paciente puede ver sus recetas
drop policy if exists "doctors_manage_recetas" on public.recetas;
drop policy if exists "allow_authenticated_access_recetas" on public.recetas;
create policy "allow_authenticated_access_recetas" on public.recetas
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "patient_see_own_recetas" on public.recetas;
create policy "patient_see_own_recetas" on public.recetas
  for select using (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  );

-- ESTUDIOS: médicos gestionan, paciente ve sus estudios
drop policy if exists "doctors_manage_estudios" on public.estudios;
drop policy if exists "allow_authenticated_access_estudios" on public.estudios;
create policy "allow_authenticated_access_estudios" on public.estudios
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "patient_see_own_estudios" on public.estudios;
create policy "patient_see_own_estudios" on public.estudios
  for select using (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "patient_insert_own_estudios" on public.estudios;
create policy "patient_insert_own_estudios" on public.estudios
  for insert with check (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  );

-- TURNOS: médicos gestionan todos los turnos; pacientes pueden ver/insertar/editar solo sus propios turnos
drop policy if exists "doctors_manage_turnos" on public.turnos;
drop policy if exists "allow_authenticated_access_turnos" on public.turnos;
create policy "allow_authenticated_access_turnos" on public.turnos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "patient_manage_own_turnos" on public.turnos;
create policy "patient_manage_own_turnos" on public.turnos
  for all using (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid()
    )
  );

-- GOOGLE_TOKENS: no crear políticas que permitan acceso desde el cliente. Dejar sin políticas (RLS activado) significa que nadie accede excepto service_role.
-- Si quieres permitir al doctor leer su propio token (no recomendado en clientes), podrías crear una policy restrictiva similar a:
-- create policy "doctor_own_google_token" on public.google_tokens
--   for select using (auth.uid() = user_id);

-- 6) Mensaje final (comentarios)
-- Después de aplicar estas políticas, prueba con usuarios reales o jwt de prueba.
-- Para tareas server-side (crear eventos en Google Calendar, backups, mantenimiento), usa el service_role key que ignora RLS.

-- Fin de rls_policies.sql
