-- Ejecutar después del esquema base de turnos.
alter table public.turnos
  add column if not exists video_room text,
  add column if not exists video_started_at timestamptz,
  add column if not exists video_ended_at timestamptz,
  add column if not exists video_status text not null default 'pending';

alter table public.turnos drop constraint if exists turnos_video_status_check;
alter table public.turnos add constraint turnos_video_status_check
  check (video_status in ('pending', 'waiting', 'in_progress', 'completed'));

create unique index if not exists turnos_video_room_idx on public.turnos (video_room) where video_room is not null;
create index if not exists turnos_video_status_idx on public.turnos (video_status, fecha_preferida, hora_preferida);

alter table public.turnos enable row level security;

drop policy if exists turnos_participant_select on public.turnos;
create policy turnos_participant_select on public.turnos for select to authenticated using (
  paciente_user_id = auth.uid()
  or doctor_id in (select id from public.doctors where user_id = auth.uid())
);

drop policy if exists turnos_participant_update_video on public.turnos;
create policy turnos_participant_update_video on public.turnos for update to authenticated using (
  paciente_user_id = auth.uid()
  or doctor_id in (select id from public.doctors where user_id = auth.uid())
) with check (
  paciente_user_id = auth.uid()
  or doctor_id in (select id from public.doctors where user_id = auth.uid())
);