-- Ejecutar en Supabase SQL Editor.
-- Garantiza una sola consulta clínica por turno de agenda.

alter table public.consultas
  add column if not exists turno_id uuid references public.turnos(id) on delete set null;

update public.consultas
set turno_id = (metadata->>'turno_id')::uuid
where turno_id is null
  and metadata->>'turno_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- Si ya existen duplicados, conserva la consulta más antigua y mueve sus
-- diagnósticos, medicaciones, recetas y estudios relacionados al registro conservado.
do $$
declare
  rec record;
begin
  for rec in
    select dupe.id as duplicate_id, keeper.id as keeper_id
    from public.consultas dupe
    join public.consultas keeper
      on keeper.turno_id = dupe.turno_id
     and (keeper.created_at, keeper.id) < (dupe.created_at, dupe.id)
    where dupe.turno_id is not null
  loop
    update public.diagnosticos set consulta_id = rec.keeper_id where consulta_id = rec.duplicate_id;
    update public.medicaciones set consulta_id = rec.keeper_id where consulta_id = rec.duplicate_id;
    update public.recetas set consulta_id = rec.keeper_id where consulta_id = rec.duplicate_id;
    update public.estudios set consulta_id = rec.keeper_id where consulta_id = rec.duplicate_id;
    delete from public.consultas where id = rec.duplicate_id;
  end loop;
end $$;

create unique index if not exists consultas_turno_id_unique
  on public.consultas (turno_id)
  where turno_id is not null;

notify pgrst, 'reload schema';
