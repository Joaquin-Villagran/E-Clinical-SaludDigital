-- CRM de cierre de teleconsultas. Ejecutar después de medical_ehr_schema.sql
-- y consultas_turno_id_migration.sql.

create table if not exists public.teleconsulta_feedback (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references public.consultas(id) on delete cascade,
  turno_id uuid not null references public.turnos(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  medico_id uuid not null references public.doctors(id) on delete restrict,
  calificacion smallint not null check (calificacion between 1 and 3),
  resolvio_motivo text not null check (resolvio_motivo in ('si', 'parcialmente', 'no')),
  comentario text,
  fecha_creacion timestamptz not null default now(),
  unique (consulta_id),
  unique (turno_id)
);

create table if not exists public.teleconsulta_interconsultas (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references public.consultas(id) on delete cascade,
  turno_id uuid not null references public.turnos(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  medico_origen_id uuid not null references public.doctors(id) on delete restrict,
  especialidad_destino text not null,
  profesional_destino_id uuid references public.doctors(id) on delete set null,
  sugerida boolean not null default true,
  aceptada boolean,
  turno_generado boolean not null default false,
  fecha timestamptz not null default now(),
  unique (consulta_id)
);

alter table public.teleconsulta_feedback enable row level security;
alter table public.teleconsulta_interconsultas enable row level security;

grant select, insert on public.teleconsulta_feedback to authenticated;
grant select, insert, update on public.teleconsulta_interconsultas to authenticated;

drop policy if exists teleconsulta_feedback_patient_select_insert on public.teleconsulta_feedback;
create policy teleconsulta_feedback_patient_select_insert
  on public.teleconsulta_feedback for all to authenticated
  using (auth.uid() = (select p.user_id from public.pacientes p where p.id = paciente_id))
  with check (auth.uid() = (select p.user_id from public.pacientes p where p.id = paciente_id));

drop policy if exists teleconsulta_interconsulta_patient_select on public.teleconsulta_interconsultas;
create policy teleconsulta_interconsulta_patient_select
  on public.teleconsulta_interconsultas for select to authenticated
  using (auth.uid() = (select p.user_id from public.pacientes p where p.id = paciente_id));

drop policy if exists teleconsulta_interconsulta_doctor_manage on public.teleconsulta_interconsultas;
create policy teleconsulta_interconsulta_doctor_manage
  on public.teleconsulta_interconsultas for all to authenticated
  using (auth.uid() = (select d.user_id from public.doctors d where d.id = medico_origen_id))
  with check (auth.uid() = (select d.user_id from public.doctors d where d.id = medico_origen_id));

create index if not exists teleconsulta_feedback_medico_idx on public.teleconsulta_feedback (medico_id, fecha_creacion);
create index if not exists teleconsulta_feedback_created_idx on public.teleconsulta_feedback (fecha_creacion);
create index if not exists teleconsulta_interconsultas_medico_idx on public.teleconsulta_interconsultas (medico_origen_id, fecha);
