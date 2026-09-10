-- Turnos puntuales que el profesional decide retirar sin borrar toda la jornada.
create table if not exists public.doctor_disponibilidad_exclusiones (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  fecha date not null,
  hora time not null,
  created_at timestamptz not null default now(),
  constraint doctor_disponibilidad_exclusion_unica unique (doctor_id, fecha, hora)
);

create index if not exists doctor_disponibilidad_exclusiones_busqueda_idx
  on public.doctor_disponibilidad_exclusiones (doctor_id, fecha, hora);

alter table public.doctor_disponibilidad_exclusiones enable row level security;
revoke all on table public.doctor_disponibilidad_exclusiones from public;
grant select, insert, delete on table public.doctor_disponibilidad_exclusiones to authenticated;

drop policy if exists doctor_disponibilidad_exclusiones_doctor_manage on public.doctor_disponibilidad_exclusiones;
create policy doctor_disponibilidad_exclusiones_doctor_manage
  on public.doctor_disponibilidad_exclusiones for all to authenticated
  using (exists (select 1 from public.doctors d where d.id = doctor_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.doctors d where d.id = doctor_id and d.user_id = auth.uid()));

drop policy if exists doctor_disponibilidad_exclusiones_authenticated_read on public.doctor_disponibilidad_exclusiones;
create policy doctor_disponibilidad_exclusiones_authenticated_read
  on public.doctor_disponibilidad_exclusiones for select to authenticated
  using (auth.uid() is not null);
