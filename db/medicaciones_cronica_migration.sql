-- Agrega el indicador persistente para tratamientos sin fecha de finalizacion.
alter table if exists public.medicaciones
  add column if not exists cronica boolean not null default false;

-- Los registros existentes sin fecha de finalizacion se consideran cronicos.
update public.medicaciones
set cronica = true
where fecha_fin is null;
