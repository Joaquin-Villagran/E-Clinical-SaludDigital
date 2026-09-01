-- SQL completo para Historias Clínicas Electrónicas
-- Incluye tablas, relaciones, timestamps automáticos y políticas RLS para médicos.

-- Extensión necesaria para gen_random_uuid()
create extension if not exists pgcrypto;

-- Enums de dominio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'antecedente_tipo'
  ) THEN
    CREATE TYPE public.antecedente_tipo AS ENUM (
      'patologico_personal',
      'familiar',
      'alergia',
      'quirurgico',
      'habito'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'estudio_categoria'
  ) THEN
    CREATE TYPE public.estudio_categoria AS ENUM (
      'laboratorio',
      'imagen',
      'cardiologia',
      'otro'
    );
  END IF;
END$$;

-- Tabla de profesionales médicos (doctors) para auditoría y control de acceso
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  nombre text not null,
  profesion text,
  especialidad text,
  telefono text,
  documento text,
  sexo text,
  estado_civil text,
  obra_social text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabla de pacientes
create table if not exists public.pacientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  nombre text not null,
  apellido text not null,
  dni text not null,
  fecha_nacimiento date,
  sexo text,
  direccion text,
  telefono text,
  email text,
  obra_social text,
  numero_afiliado text,
  contacto_emergencia_nombre text,
  contacto_emergencia_telefono text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pacientes_dni_unique unique (dni)
);

-- Tabla de antecedentes
create table if not exists public.antecedentes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  tipo public.antecedente_tipo not null,
  titulo text not null,
  descripcion text,
  fecha_registro date not null default current_date,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabla de consultas
create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  profesional_id uuid references public.doctors(id) on delete set null,
  fecha date not null,
  motivo_consulta text,
  examen_fisico text,
  observaciones text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabla de diagnósticos
create table if not exists public.diagnosticos (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references public.consultas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  descripcion text not null,
  codigo_cie10 text,
  fecha date not null default current_date,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabla de medicaciones
create table if not exists public.medicaciones (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  consulta_id uuid references public.consultas(id) on delete set null,
  nombre_medicamento text not null,
  dosis text,
  frecuencia text,
  fecha_inicio date,
  fecha_fin date,
  activa boolean not null default true,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabla de recetas
create table if not exists public.recetas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  consulta_id uuid references public.consultas(id) on delete set null,
  fecha_emision date not null default current_date,
  pdf_url text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Medicaciones específicas por receta (tabla relacionada limpia y extensible)
create table if not exists public.receta_medicaciones (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas(id) on delete cascade,
  nombre_medicamento text not null,
  dosis text,
  frecuencia text,
  instrucciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabla de estudios
create table if not exists public.estudios (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  consulta_id uuid references public.consultas(id) on delete set null,
  titulo text not null,
  categoria public.estudio_categoria not null,
  fecha date not null,
  archivo_url text,
  es_descargable boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Función genérica para actualizar updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Helper para verificar si el usuario autenticado es profesional sin disparar recursión en RLS
create or replace function public.is_current_user_doctor()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.doctors d
    where d.user_id = auth.uid()
  );
$$;

-- Triggers para actualizar updated_at automáticamente
 drop trigger if exists pacientes_set_updated_at on public.pacientes;
 create trigger pacientes_set_updated_at
   before update on public.pacientes
   for each row execute function public.set_updated_at();

 drop trigger if exists antecedentes_set_updated_at on public.antecedentes;
 create trigger antecedentes_set_updated_at
   before update on public.antecedentes
   for each row execute function public.set_updated_at();

 drop trigger if exists consultas_set_updated_at on public.consultas;
 create trigger consultas_set_updated_at
   before update on public.consultas
   for each row execute function public.set_updated_at();

 drop trigger if exists diagnosticos_set_updated_at on public.diagnosticos;
 create trigger diagnosticos_set_updated_at
   before update on public.diagnosticos
   for each row execute function public.set_updated_at();

 drop trigger if exists medicaciones_set_updated_at on public.medicaciones;
 create trigger medicaciones_set_updated_at
   before update on public.medicaciones
   for each row execute function public.set_updated_at();

 drop trigger if exists recetas_set_updated_at on public.recetas;
 create trigger recetas_set_updated_at
   before update on public.recetas
   for each row execute function public.set_updated_at();

 drop trigger if exists receta_medicaciones_set_updated_at on public.receta_medicaciones;
 create trigger receta_medicaciones_set_updated_at
   before update on public.receta_medicaciones
   for each row execute function public.set_updated_at();

 drop trigger if exists estudios_set_updated_at on public.estudios;
 create trigger estudios_set_updated_at
   before update on public.estudios
   for each row execute function public.set_updated_at();

 drop trigger if exists doctors_set_updated_at on public.doctors;
 create trigger doctors_set_updated_at
   before update on public.doctors
   for each row execute function public.set_updated_at();

-- Habilitar RLS en tablas sensibles
alter table public.pacientes enable row level security;
alter table public.antecedentes enable row level security;
alter table public.consultas enable row level security;
alter table public.diagnosticos enable row level security;
alter table public.medicaciones enable row level security;
alter table public.recetas enable row level security;
alter table public.receta_medicaciones enable row level security;
alter table public.estudios enable row level security;
alter table public.doctors enable row level security;

-- Revocar permisos públicos completamente
revoke all on table public.pacientes from public;
revoke all on table public.antecedentes from public;
revoke all on table public.consultas from public;
revoke all on table public.diagnosticos from public;
revoke all on table public.medicaciones from public;
revoke all on table public.recetas from public;
revoke all on table public.receta_medicaciones from public;
revoke all on table public.estudios from public;
revoke all on table public.doctors from public;

-- Conceder permisos al rol autenticado para que las políticas RLS funcionen correctamente
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.pacientes to authenticated;
grant select, insert, update, delete on table public.antecedentes to authenticated;
grant select, insert, update, delete on table public.consultas to authenticated;
grant select, insert, update, delete on table public.diagnosticos to authenticated;
grant select, insert, update, delete on table public.medicaciones to authenticated;
grant select, insert, update, delete on table public.recetas to authenticated;
grant select, insert, update, delete on table public.receta_medicaciones to authenticated;
grant select, insert, update, delete on table public.estudios to authenticated;
grant select, insert, update, delete on table public.doctors to authenticated;
grant execute on function public.is_current_user_doctor() to authenticated;

-- Políticas RLS: solo profesionales autenticados pueden acceder a la EHR
-- Se hace de forma segura sin recursión.

-- doctors: el propio médico puede ver su fila
drop policy if exists doctors_self_select on public.doctors;
create policy doctors_self_select on public.doctors
  for select using (auth.uid() = user_id);

-- pacientes: el profesional autenticado puede ver/editar toda la ficha
drop policy if exists doctors_manage_pacientes on public.pacientes;
create policy doctors_manage_pacientes on public.pacientes
  for all using (auth.uid() is not null and public.is_current_user_doctor())
  with check (auth.uid() is not null and public.is_current_user_doctor());

-- antecedentes
drop policy if exists doctors_manage_antecedentes on public.antecedentes;
create policy doctors_manage_antecedentes on public.antecedentes
  for all using (auth.uid() is not null and public.is_current_user_doctor())
  with check (auth.uid() is not null and public.is_current_user_doctor());

-- consultas
drop policy if exists doctors_manage_consultas on public.consultas;
create policy doctors_manage_consultas on public.consultas
  for all using (auth.uid() is not null and public.is_current_user_doctor())
  with check (auth.uid() is not null and public.is_current_user_doctor());

-- diagnosticos
drop policy if exists doctors_manage_diagnosticos on public.diagnosticos;
create policy doctors_manage_diagnosticos on public.diagnosticos
  for all using (auth.uid() is not null and public.is_current_user_doctor())
  with check (auth.uid() is not null and public.is_current_user_doctor());

-- medicaciones
drop policy if exists doctors_manage_medicaciones on public.medicaciones;
create policy doctors_manage_medicaciones on public.medicaciones
  for all using (auth.uid() is not null and public.is_current_user_doctor())
  with check (auth.uid() is not null and public.is_current_user_doctor());

-- recetas
drop policy if exists doctors_manage_recetas on public.recetas;
create policy doctors_manage_recetas on public.recetas
  for all using (auth.uid() is not null and public.is_current_user_doctor())
  with check (auth.uid() is not null and public.is_current_user_doctor());

-- receta_medicaciones
drop policy if exists doctors_manage_receta_medicaciones on public.receta_medicaciones;
create policy doctors_manage_receta_medicaciones on public.receta_medicaciones
  for all using (auth.uid() is not null and public.is_current_user_doctor())
  with check (auth.uid() is not null and public.is_current_user_doctor());

-- estudios
drop policy if exists doctors_manage_estudios on public.estudios;
create policy doctors_manage_estudios on public.estudios
  for all using (auth.uid() is not null and public.is_current_user_doctor())
  with check (auth.uid() is not null and public.is_current_user_doctor());

-- Para seguridad adicional, puede agregarse una política de fila por paciente, pero aquí
-- respetamos el requisito de que solo el profesional autenticado acceda a los datos.
