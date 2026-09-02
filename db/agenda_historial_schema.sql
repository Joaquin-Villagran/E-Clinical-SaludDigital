-- Agenda e historial de atenciones. Ejecutar después de los esquemas clínicos base.
alter table public.turnos
  add column if not exists consulta_id uuid references public.consultas(id) on delete set null,
  add column if not exists tipo_consulta text;

create index if not exists turnos_consulta_id_idx on public.turnos (consulta_id);
create index if not exists turnos_doctor_fecha_idx on public.turnos (doctor_id, fecha_preferida, hora_preferida);

-- Cada transición se conserva como un evento inmutable para auditar la atención.
create table if not exists public.turno_eventos (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  paciente_id uuid references public.pacientes(id) on delete set null,
  accion text not null,
  estado_anterior text,
  estado_nuevo text,
  detalle text,
  created_at timestamptz not null default now()
);

create index if not exists turno_eventos_turno_created_idx on public.turno_eventos (turno_id, created_at desc);
create index if not exists turno_eventos_paciente_created_idx on public.turno_eventos (paciente_id, created_at desc);

alter table public.turno_eventos enable row level security;
revoke all on table public.turno_eventos from public;
grant select on table public.turno_eventos to authenticated;

drop policy if exists turno_eventos_doctors_select on public.turno_eventos;
create policy turno_eventos_doctors_select on public.turno_eventos
  for select using (public.is_current_user_doctor());