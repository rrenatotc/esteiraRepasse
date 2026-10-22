-- Fase 4: fila do repasse.

-- RF13: desde quando a demanda está no status atual ("parada há 3 h").
alter table public.demandas
  add column status_desde timestamptz not null default now();

create or replace function public.demandas_status_desde()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_desde := now();
  end if;
  return new;
end;
$$;

create trigger trg_demandas_status_desde
  before update of status on public.demandas
  for each row execute function public.demandas_status_desde();

create index ix_demandas_abertas on public.demandas (status, status_desde)
  where status not in ('concluida', 'cancelada');

-- Realtime: nova demanda e mudança de status chegam nos apps na hora.
-- A RLS de select decide quem recebe cada evento.
alter publication supabase_realtime add table public.demandas;
