-- Fase 3: registro de venda numa única transação (RF02).
-- SECURITY INVOKER de propósito: roda com as permissões e a RLS de quem
-- chama; só junta veículo manual + lojista novo + demanda num passo atômico,
-- para nada ficar "meio enviado" (RNF10).
create or replace function public.registrar_venda(
  p_placa text,
  p_loja_proposta_id smallint,
  p_valor_venda numeric,
  p_observacao text default null,
  p_veiculo_manual jsonb default null,   -- {marca, modelo, ano_fabricacao, ano_modelo, cor}
  p_lojista_id uuid default null,
  p_lojista_novo jsonb default null      -- {tipo, documento, razao_social, nome_fantasia, telefone, email, cidade, uf, situacao_cadastral, origem}
)
returns public.demandas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_placa_busca text := public.placa_para_mercosul(p_placa);
  v_veiculo uuid;
  v_lojista uuid := p_lojista_id;
  v_documento text;
  d public.demandas;
begin
  if public.papel_atual() is null then
    raise exception 'Sessão expirada ou usuário inativo. Entre novamente.' using errcode = '42501';
  end if;
  if v_placa_busca is null then
    raise exception 'Placa inválida. Use o padrão ABC1234 ou ABC1D23.' using errcode = '22023';
  end if;
  if p_valor_venda is null or p_valor_venda <= 0 then
    raise exception 'O valor de venda precisa ser maior que zero.' using errcode = '22023';
  end if;
  if p_valor_venda >= 10000000000 then
    raise exception 'Valor de venda alto demais. Confira o número digitado.' using errcode = '22003';
  end if;

  -- Veículo: do cadastro, ou manual para o repasse revisar.
  select v.id into v_veiculo from public.veiculos v where v.placa_busca = v_placa_busca;
  if not found then
    if p_veiculo_manual is null then
      raise exception 'Placa não encontrada no estoque. Preencha marca e modelo do veículo.' using errcode = '23502';
    end if;
    insert into public.veiculos (placa, marca, modelo, ano_fabricacao, ano_modelo, cor)
    values (
      p_placa,
      btrim(p_veiculo_manual ->> 'marca'),
      btrim(p_veiculo_manual ->> 'modelo'),
      nullif(p_veiculo_manual ->> 'ano_fabricacao', '')::int,
      nullif(p_veiculo_manual ->> 'ano_modelo', '')::int,
      nullif(btrim(p_veiculo_manual ->> 'cor'), '')
    )
    returning id into v_veiculo;
  end if;

  -- Lojista: existente, ou novo (pode ter sido cadastrado por outro vendedor
  -- enquanto este preenchia; nesse caso reaproveita).
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

  insert into public.demandas (veiculo_id, lojista_id, loja_proposta_id, valor_venda, observacao)
  values (v_veiculo, v_lojista, p_loja_proposta_id, round(p_valor_venda, 2), nullif(btrim(p_observacao), ''))
  returning * into d;

  return d;
end;
$$;

revoke execute on function public.registrar_venda(text, smallint, numeric, text, jsonb, uuid, jsonb) from public, anon;
grant execute on function public.registrar_venda(text, smallint, numeric, text, jsonb, uuid, jsonb) to authenticated;
