-- Ampliación de turnos para teleconsultas.
-- Ejecutar después de db/rls_policies.sql en el SQL Editor de Supabase.

alter table public.turnos
  add column if not exists paciente_user_id uuid references auth.users(id) on delete set null,
  add column if not exists doctor_id uuid references public.doctors(id) on delete set null,
  add column if not exists duracion_minutos integer not null default 30,
  add column if not exists meet_link text,
  add column if not exists fecha_hora_inicio_real timestamptz,
  add column if not exists fecha_hora_fin_real timestamptz;

alter table public.turnos
  drop constraint if exists turnos_duracion_minutos_positiva;

alter table public.turnos
  add constraint turnos_duracion_minutos_positiva check (duracion_minutos > 0 and duracion_minutos <= 240);

create index if not exists turnos_paciente_user_id_idx on public.turnos (paciente_user_id);
create index if not exists turnos_doctor_id_idx on public.turnos (doctor_id);

-- SECURITY DEFINER evita que la comprobación de pertenencia dispare políticas RLS
-- heredadas sobre doctors mientras se evalúa una política de turnos.
create or replace function public.is_current_user_turno_doctor(target_doctor_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.doctors d
    where d.id = target_doctor_id and d.user_id = auth.uid()
  );
$$;

grant execute on function public.is_current_user_turno_doctor(uuid) to authenticated;

-- La política heredada otorgaba acceso a cualquier usuario autenticado.
-- La sesión clínica sólo debe ser legible por las dos partes del turno.
drop policy if exists "allow_authenticated_access_turnos" on public.turnos;
drop policy if exists "patient_manage_own_turnos" on public.turnos;
drop policy if exists "teleconsulta_patient_own_turnos" on public.turnos;
drop policy if exists "teleconsulta_doctor_own_turnos" on public.turnos;

create policy "teleconsulta_patient_own_turnos" on public.turnos
  for select using (paciente_user_id = auth.uid());

create policy "teleconsulta_doctor_own_turnos" on public.turnos
  for select using (public.is_current_user_turno_doctor(doctor_id));
