-- Disponibilidad que el profesional publica para que el paciente pueda elegir un turno.
create table if not exists public.doctor_disponibilidades (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  intervalo_minutos integer not null default 30 check (intervalo_minutos > 0 and intervalo_minutos <= 240),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint doctor_disponibilidad_horario_valido check (hora_fin > hora_inicio),
  constraint doctor_disponibilidad_unica unique (doctor_id, fecha, hora_inicio, hora_fin)
);

create index if not exists doctor_disponibilidades_busqueda_idx
  on public.doctor_disponibilidades (doctor_id, fecha, activo);

alter table public.doctor_disponibilidades enable row level security;
revoke all on table public.doctor_disponibilidades from public;
grant select, insert, update, delete on table public.doctor_disponibilidades to authenticated;

drop policy if exists doctor_disponibilidades_doctor_manage on public.doctor_disponibilidades;
create policy doctor_disponibilidades_doctor_manage on public.doctor_disponibilidades
  for all using (
    exists (select 1 from public.doctors d where d.id = doctor_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.doctors d where d.id = doctor_id and d.user_id = auth.uid())
  );

drop policy if exists doctor_disponibilidades_authenticated_read on public.doctor_disponibilidades;
create policy doctor_disponibilidades_authenticated_read on public.doctor_disponibilidades
  for select using (auth.uid() is not null);

alter table public.turnos add column if not exists doctor_id uuid references public.doctors(id) on delete set null;
create index if not exists turnos_doctor_fecha_hora_idx on public.turnos (doctor_id, fecha_preferida, hora_preferida);
