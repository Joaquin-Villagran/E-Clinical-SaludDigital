-- Ejecutar en el SQL Editor de Supabase.
-- Corrige bases existentes donde antecedentes fue creada sin titulo.

alter table public.antecedentes
  add column if not exists titulo text;

update public.antecedentes
set titulo = case
  when titulo is not null and btrim(titulo) <> '' then titulo
  when descripcion is not null and btrim(descripcion) <> '' then left(btrim(descripcion), 120)
  else 'Antecedente'
end
where titulo is null or btrim(titulo) = '';

alter table public.antecedentes
  alter column titulo set default 'Antecedente',
  alter column titulo set not null;

alter table public.antecedentes
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists antecedentes_set_updated_at on public.antecedentes;
create trigger antecedentes_set_updated_at
  before update on public.antecedentes
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
