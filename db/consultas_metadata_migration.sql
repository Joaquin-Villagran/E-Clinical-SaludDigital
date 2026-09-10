-- Ejecutar en Supabase SQL Editor.
-- La aplicación usa consultas.metadata para guardar turno_id y los datos de agenda.

alter table public.consultas
  add column if not exists metadata jsonb;

alter table public.consultas
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists consultas_set_updated_at on public.consultas;
create trigger consultas_set_updated_at
  before update on public.consultas
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
