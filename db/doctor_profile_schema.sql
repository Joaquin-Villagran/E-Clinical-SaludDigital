-- Perfil profesional. Ejecutar en Supabase después de los esquemas base.
-- Los datos personales permanecen de sólo lectura en la interfaz.
alter table public.doctors
  add column if not exists email text,
  add column if not exists fecha_nacimiento date,
  add column if not exists nacionalidad text,
  add column if not exists direccion text,
  add column if not exists ciudad text,
  add column if not exists provincia text,
  add column if not exists foto_url text,
  add column if not exists matricula text,
  add column if not exists tipo_matricula text;

create index if not exists doctors_email_idx on public.doctors (email);

-- Impide que dos cuentas, sean pacientes o profesionales, compartan el mismo DNI.
create or replace function public.prevent_duplicate_user_dni()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_dni text := nullif(btrim(new.raw_user_meta_data ->> 'documento'), '');
begin
  if new_dni is not null and exists (
    select 1
    from auth.users existing_user
    where existing_user.id <> new.id
      and nullif(btrim(existing_user.raw_user_meta_data ->> 'documento'), '') = new_dni
  ) then
    raise exception 'Ya existe una cuenta registrada con este DNI.' using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists auth_users_prevent_duplicate_dni on auth.users;
create trigger auth_users_prevent_duplicate_dni
  before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.prevent_duplicate_user_dni();