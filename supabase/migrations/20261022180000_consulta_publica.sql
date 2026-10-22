-- Fase 5: consulta pública por placa (RF01, RN10) e correção de pendência (RF04).

-- Rate limit da consulta pública. Nunca guarda IP puro, só hashes.
create table public.consulta_publica_log (
  id bigint generated always as identity primary key,
  chave_hash text not null,   -- hash(ip + instalação): limite por PC
  ip_hash text not null,      -- hash(ip): teto por rede (vários PCs atrás do mesmo IP)
  placa_busca text not null,
  created_at timestamptz not null default now()
);
create index ix_consulta_log_chave on public.consulta_publica_log (chave_hash, created_at desc);
create index ix_consulta_log_ip on public.consulta_publica_log (ip_hash, created_at desc);

alter table public.consulta_publica_log enable row level security;
revoke all on public.consulta_publica_log from anon, authenticated;

-- 20 consultas/min por instalação e 200/min por IP. Devolve false se estourou.
create or replace function public.registrar_consulta_publica(p_chave_hash text, p_ip_hash text, p_placa_busca text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.consulta_publica_log
      where chave_hash = p_chave_hash and created_at > now() - interval '1 minute') >= 20
     or (select count(*) from public.consulta_publica_log
      where ip_hash = p_ip_hash and created_at > now() - interval '1 minute') >= 200 then
    return false;
  end if;
  insert into public.consulta_publica_log (chave_hash, ip_hash, placa_busca) values (p_chave_hash, p_ip_hash, p_placa_busca);
  return true;
end;
$$;

-- RN10: busca exata, só a demanda mais recente, só os campos públicos.
-- Nunca devolve valor, lojista, documento, vendedor, responsável, observação
-- nem comentários; a linha do tempo não tem nomes.
create or replace function public.consultar_placa_publica(p_placa text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'placa', d.placa,
    'marca', d.veiculo_snapshot ->> 'marca',
    'modelo', d.veiculo_snapshot ->> 'modelo',
    'status', d.status,
    'loja', jsonb_build_object('codigo', l.codigo, 'nome', l.nome),
    'numero_proposta', d.numero_proposta,
    'data_emissao_proposta', d.data_emissao_proposta,
    'numero_nf', d.numero_nf,
    'data_emissao_nf', d.data_emissao_nf,
    'linha_do_tempo', (
      select coalesce(jsonb_agg(jsonb_build_object('status', e.para_status, 'em', e.created_at) order by e.created_at, e.id), '[]'::jsonb)
      from public.demanda_eventos e
      where e.demanda_id = d.id
    )
  )
  from public.demandas d
  join public.lojas l on l.id = d.loja_proposta_id
  where d.placa_busca = public.placa_para_mercosul(p_placa)
  order by d.created_at desc
  limit 1
$$;

revoke execute on function public.registrar_consulta_publica(text, text, text) from public, anon, authenticated;
revoke execute on function public.consultar_placa_publica(text) from public, anon, authenticated;
grant execute on function public.registrar_consulta_publica(text, text, text) to service_role;
grant execute on function public.consultar_placa_publica(text) to service_role;

-- Limpeza diária do log com mais de 7 dias (pg_cron, quando disponível).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'limpar-consulta-publica-log',
      '17 6 * * *',  -- 03:17 em São Paulo
      $cron$delete from public.consulta_publica_log where created_at < now() - interval '7 days'$cron$
    );
  end if;
end;
$$;

-- RF04/RN09: vendedor corrige a própria venda (em nova ou pendente) numa
-- transação; se estava pendente, reenvia ao repasse (pendente → nova).
-- SECURITY INVOKER: a RLS de update de demandas decide se pode.
create or replace function public.corrigir_venda(
  p_demanda uuid,
  p_loja_proposta_id smallint,
  p_valor_venda numeric,
  p_observacao text default null,
  p_lojista_id uuid default null,
  p_lojista_novo jsonb default null
)
returns public.demandas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lojista uuid := p_lojista_id;
  v_documento text;
  d public.demandas;
begin
  if p_valor_venda is null or p_valor_venda <= 0 then
    raise exception 'O valor de venda precisa ser maior que zero.' using errcode = '22023';
  end if;

  if v_lojista is null then
    if p_lojista_novo is null then
      raise exception 'Informe o lojista.' using errcode = '23502';
    end if;
    v_documento := public.normalizar_documento(p_lojista_novo ->> 'documento');
    select l.id into v_lojista from public.lojistas l where l.documento = v_documento;
    if not found then
      insert into public.lojistas (
        tipo, documento, razao_social, nome_fantasia, telefone, email, cidade, uf, situacao_cadastral, origem
      ) values (
        (p_lojista_novo ->> 'tipo')::public.tipo_documento,
        v_documento,
        btrim(p_lojista_novo ->> 'razao_social'),
        nullif(btrim(p_lojista_novo ->> 'nome_fantasia'), ''),
        nullif(btrim(p_lojista_novo ->> 'telefone'), ''),
        nullif(btrim(p_lojista_novo ->> 'email'), ''),
        nullif(btrim(p_lojista_novo ->> 'cidade'), ''),
        nullif(upper(btrim(p_lojista_novo ->> 'uf')), ''),
        nullif(btrim(p_lojista_novo ->> 'situacao_cadastral'), ''),
        coalesce(nullif(p_lojista_novo ->> 'origem', ''), 'manual')
      )
      returning id into v_lojista;
    end if;
  end if;

  update public.demandas
  set lojista_id = v_lojista,
      loja_proposta_id = p_loja_proposta_id,
      valor_venda = round(p_valor_venda, 2),
      observacao = nullif(btrim(p_observacao), '')
  where id = p_demanda
  returning * into d;
  if not found then
    raise exception 'Esta venda não pode mais ser alterada por você (já foi assumida pelo repasse ou não é sua).'
      using errcode = '42501';
  end if;

  if d.status = 'pendente' then
    d := public.avancar_status(d.id, 'nova', '{}'::jsonb, 'Corrigida pelo vendedor');
  end if;
  return d;
end;
$$;

revoke execute on function public.corrigir_venda(uuid, smallint, numeric, text, uuid, jsonb) from public, anon;
grant execute on function public.corrigir_venda(uuid, smallint, numeric, text, uuid, jsonb) to authenticated;
