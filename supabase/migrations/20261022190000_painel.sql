-- Fase 6: indicadores do painel (RF17). Faturamento conta pela data de
-- emissão da NF (a mesma data do Bravos); vendas registradas, pela data de
-- registro. Datas em America/Sao_Paulo (RN11).
create or replace function public.indicadores_painel(p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ini timestamptz := p_inicio::timestamp at time zone 'America/Sao_Paulo';
  v_fim timestamptz := (p_fim + 1)::timestamp at time zone 'America/Sao_Paulo';
  v_resultado jsonb;
begin
  if public.papel_atual() not in ('repasse', 'gestor') or public.papel_atual() is null then
    raise exception 'Apenas repasse e gestão veem o painel.' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;

  with faturadas as (
    select d.*,
           (select min(e.created_at) from public.demanda_eventos e
             where e.demanda_id = d.id and e.para_status = 'faturada') as faturada_em
    from public.demandas d
    where d.status in ('faturada', 'concluida')
      and d.data_emissao_nf between p_inicio and p_fim
  ),
  registradas as (
    select d.* from public.demandas d where d.created_at >= v_ini and d.created_at < v_fim
  ),
  meses as (
    select generate_series(date_trunc('month', p_fim) - interval '11 months', date_trunc('month', p_fim), interval '1 month')::date as mes
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'registradas', (select count(*) from registradas),
    'canceladas', (select count(*) from registradas where status = 'cancelada'),
    'faturadas', (select count(*) from faturadas),
    'valor_faturado', (select coalesce(sum(valor_venda), 0) from faturadas),
    'ticket_medio', (select round(avg(valor_venda), 2) from faturadas),
    'horas_ate_faturar', (select round(avg(extract(epoch from (faturada_em - created_at)) / 3600)::numeric, 1) from faturadas),
    'horas_uteis_ate_faturar', (select round(avg(public.horas_uteis_entre(created_at, faturada_em)), 1) from faturadas),
    'pendencias_abertas', (select count(*) from public.demandas where status = 'pendente'),
    'abertas_por_status', (
      select jsonb_object_agg(s, (select count(*) from public.demandas d where d.status = s::public.status_demanda))
      from unnest(array['nova', 'em_proposta', 'proposta_emitida', 'faturada', 'pendente']) s
    ),
    'por_loja', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'codigo', l.codigo,
        'nome', l.nome,
        'registradas', (select count(*) from registradas r where r.loja_proposta_id = l.id),
        'faturadas', (select count(*) from faturadas f where f.loja_proposta_id = l.id),
        'valor_faturado', (select coalesce(sum(f.valor_venda), 0) from faturadas f where f.loja_proposta_id = l.id)
      ) order by l.codigo), '[]'::jsonb)
      from public.lojas l
      where l.ativa or exists (select 1 from faturadas f where f.loja_proposta_id = l.id)
    ),
    'por_mes', (
      select jsonb_agg(jsonb_build_object(
        'mes', to_char(m.mes, 'YYYY-MM'),
        'faturadas', (select count(*) from public.demandas d
                      where d.status in ('faturada', 'concluida') and date_trunc('month', d.data_emissao_nf) = m.mes),
        'valor_faturado', (select coalesce(sum(d.valor_venda), 0) from public.demandas d
                           where d.status in ('faturada', 'concluida') and date_trunc('month', d.data_emissao_nf) = m.mes)
      ) order by m.mes)
      from meses m
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke execute on function public.indicadores_painel(date, date) from public, anon;
grant execute on function public.indicadores_painel(date, date) to authenticated;
