-- Reconciliación aditiva del modelo de datos del paciente.
-- Ejecutar en Supabase después de medical_ehr_schema.sql y rls_policies.sql.
-- No elimina ni renombra columnas existentes: sólo agrega lo que falte para
-- que pacientes, antecedentes, consultas, diagnósticos, medicaciones, recetas
-- y estudios tengan exactamente los campos que usa la aplicación.

create extension if not exists pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'antecedente_tipo'
  ) THEN
    CREATE TYPE public.antecedente_tipo AS ENUM ('patologico_personal', 'familiar', 'alergia', 'quirurgico', 'habito');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'estudio_categoria'
  ) THEN
    CREATE TYPE public.estudio_categoria AS ENUM ('laboratorio', 'imagen', 'cardiologia', 'otro');
  END IF;
END$$;

-- 1) Datos personales
alter table public.pacientes
  add column if not exists apellido text,
  add column if not exists fecha_nacimiento date,
  add column if not exists sexo text,
  add column if not exists direccion text,
  add column if not exists obra_social text,
  add column if not exists numero_afiliado text,
  add column if not exists contacto_emergencia_nombre text,
  add column if not exists contacto_emergencia_telefono text,
  add column if not exists metadata jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- 2) Antecedentes
alter table public.antecedentes
  add column if not exists titulo text,
  add column if not exists descripcion text,
  add column if not exists fecha_registro date not null default current_date,
  add column if not exists metadata jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- 3) Consultas
alter table public.consultas
  add column if not exists profesional_id uuid references public.doctors(id) on delete set null,
  add column if not exists motivo_consulta text,
  add column if not exists examen_fisico text,
  add column if not exists observaciones text,
  add column if not exists metadata jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- 4) Diagnósticos
alter table public.diagnosticos
  add column if not exists paciente_id uuid references public.pacientes(id) on delete cascade,
  add column if not exists descripcion text,
  add column if not exists codigo_cie10 text,
  add column if not exists fecha date not null default current_date,
  add column if not exists metadata jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- 5) Medicaciones
alter table public.medicaciones
  add column if not exists paciente_id uuid references public.pacientes(id) on delete cascade,
  add column if not exists consulta_id uuid references public.consultas(id) on delete set null,
  add column if not exists nombre_medicamento text,
  add column if not exists dosis text,
  add column if not exists frecuencia text,
  add column if not exists fecha_inicio date,
  add column if not exists fecha_fin date,
  add column if not exists activa boolean not null default true,
  add column if not exists metadata jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- 6) Recetas
alter table public.recetas
  add column if not exists paciente_id uuid references public.pacientes(id) on delete cascade,
  add column if not exists consulta_id uuid references public.consultas(id) on delete set null,
  add column if not exists fecha_emision date not null default current_date,
  add column if not exists pdf_url text,
  add column if not exists metadata jsonb,
  add column if not exists updated_at timestamptz not null default now();

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

-- 7) Estudios
alter table public.estudios
  add column if not exists paciente_id uuid references public.pacientes(id) on delete cascade,
  add column if not exists consulta_id uuid references public.consultas(id) on delete set null,
  add column if not exists titulo text,
  add column if not exists categoria public.estudio_categoria,
  add column if not exists fecha date not null default current_date,
  add column if not exists archivo_url text,
  add column if not exists es_descargable boolean not null default false,
  add column if not exists metadata jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- Índices para las búsquedas por paciente que usa la ficha clínica
create index if not exists antecedentes_paciente_id_idx on public.antecedentes (paciente_id);
create index if not exists consultas_paciente_id_idx on public.consultas (paciente_id);
create index if not exists diagnosticos_paciente_id_idx on public.diagnosticos (paciente_id);
create index if not exists medicaciones_paciente_id_idx on public.medicaciones (paciente_id);
create index if not exists recetas_paciente_id_idx on public.recetas (paciente_id);
create index if not exists estudios_paciente_id_idx on public.estudios (paciente_id);

-- Trigger genérico de updated_at (ya definido en medical_ehr_schema.sql)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists pacientes_set_updated_at on public.pacientes;
create trigger pacientes_set_updated_at before update on public.pacientes for each row execute function public.set_updated_at();

drop trigger if exists antecedentes_set_updated_at on public.antecedentes;
create trigger antecedentes_set_updated_at before update on public.antecedentes for each row execute function public.set_updated_at();

drop trigger if exists consultas_set_updated_at on public.consultas;
create trigger consultas_set_updated_at before update on public.consultas for each row execute function public.set_updated_at();

drop trigger if exists diagnosticos_set_updated_at on public.diagnosticos;
create trigger diagnosticos_set_updated_at before update on public.diagnosticos for each row execute function public.set_updated_at();

drop trigger if exists medicaciones_set_updated_at on public.medicaciones;
create trigger medicaciones_set_updated_at before update on public.medicaciones for each row execute function public.set_updated_at();

drop trigger if exists recetas_set_updated_at on public.recetas;
create trigger recetas_set_updated_at before update on public.recetas for each row execute function public.set_updated_at();

drop trigger if exists receta_medicaciones_set_updated_at on public.receta_medicaciones;
create trigger receta_medicaciones_set_updated_at before update on public.receta_medicaciones for each row execute function public.set_updated_at();

drop trigger if exists estudios_set_updated_at on public.estudios;
create trigger estudios_set_updated_at before update on public.estudios for each row execute function public.set_updated_at();

-- RLS: médicos gestionan todo; el paciente sólo ve sus propios registros.
alter table public.pacientes enable row level security;
alter table public.antecedentes enable row level security;
alter table public.consultas enable row level security;
alter table public.diagnosticos enable row level security;
alter table public.medicaciones enable row level security;
alter table public.recetas enable row level security;
alter table public.receta_medicaciones enable row level security;
alter table public.estudios enable row level security;

grant select, insert, update, delete on table public.receta_medicaciones to authenticated;

drop policy if exists patient_see_own_pacientes on public.pacientes;
create policy patient_see_own_pacientes on public.pacientes for select using (auth.uid() = user_id);

drop policy if exists patient_see_own_antecedentes on public.antecedentes;
create policy patient_see_own_antecedentes on public.antecedentes for select using (
  exists (select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid())
);

drop policy if exists patient_see_own_consultas on public.consultas;
create policy patient_see_own_consultas on public.consultas for select using (
  exists (select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid())
);

drop policy if exists patient_see_own_diagnosticos on public.diagnosticos;
create policy patient_see_own_diagnosticos on public.diagnosticos for select using (
  exists (select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid())
);

drop policy if exists patient_see_own_medicaciones on public.medicaciones;
create policy patient_see_own_medicaciones on public.medicaciones for select using (
  exists (select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid())
);

drop policy if exists patient_see_own_recetas on public.recetas;
create policy patient_see_own_recetas on public.recetas for select using (
  exists (select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid())
);

drop policy if exists patient_see_own_estudios on public.estudios;
create policy patient_see_own_estudios on public.estudios for select using (
  exists (select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid())
);
