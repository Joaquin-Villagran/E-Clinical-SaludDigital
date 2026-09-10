-- Corrige la recursión infinita de RLS al consultar turnos y doctors.
-- Ejecutar en el SQL Editor de Supabase.

alter table if exists public.doctors enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'doctors'
  loop
    execute format('drop policy if exists %I on public.doctors', policy_record.policyname);
  end loop;
end
$$;

create policy doctors_authenticated_select
  on public.doctors
  for select
  to authenticated
  using (auth.uid() is not null);

alter table if exists public.pacientes enable row level security;

drop policy if exists patient_profile_select on public.pacientes;
create policy patient_profile_select
  on public.pacientes
  for select
  to authenticated
  using (auth.uid() = user_id or lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists patient_profile_update on public.pacientes;
create policy patient_profile_update
  on public.pacientes
  for update
  to authenticated
  using (auth.uid() = user_id or lower(email) = lower(auth.jwt() ->> 'email'))
  with check (auth.uid() = user_id);
