-- Fase 2: estoque a partir da planilha do Bravos (seção 6.1, RN12–RN14).

-- Dados que o repasse usa do Bravos além de placa/marca/modelo.
alter table public.veiculos
  add column codigo_bravos text,          -- "Cód.Veículo" do Bravos
  add column dias_em_estoque int check (dias_em_estoque >= 0);  -- "Dias", na data da última importação

create index ix_veiculos_codigo_bravos on public.veiculos (codigo_bravos);

-- Lint: as variáveis de laço já são declaradas pelo FOR (sem mudança de lógica).
create or replace function public.validar_cpf(p text)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  d text := public.normalizar_documento(p);
  t int;
  soma int;
  resto int;
begin
  if d !~ '^[0-9]{11}$' or d ~ '^(.)\1{10}$' then
    return false;
  end if;
  foreach t in array array[9, 10] loop
    soma := 0;
    for i in 1..t loop
      soma := soma + substr(d, i, 1)::int * (t + 2 - i);
    end loop;
    resto := (soma * 10) % 11;
    if resto = 10 then resto := 0; end if;
    if resto <> substr(d, t + 1, 1)::int then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.validar_cnpj(p text)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  d text := public.normalizar_documento(p);
  pesos int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  soma int;
  dv1 int;
  dv2 int;
begin
  if d !~ '^[0-9A-Z]{12}[0-9]{2}$' or d ~ '^(.)\1{13}$' then
    return false;
  end if;
  soma := 0;
  for i in 1..12 loop
    soma := soma + (ascii(substr(d, i, 1)) - 48) * pesos[i + 1];
  end loop;
  dv1 := case when soma % 11 < 2 then 0 else 11 - soma % 11 end;
  soma := dv1 * pesos[13];
  for i in 1..12 loop
    soma := soma + (ascii(substr(d, i, 1)) - 48) * pesos[i];
  end loop;
  dv2 := case when soma % 11 < 2 then 0 else 11 - soma % 11 end;
  return dv1 = substr(d, 13, 1)::int and dv2 = substr(d, 14, 1)::int;
end;
$$;

-- Itens que o app manda (já normalizados pelo parser do main):
-- [{placa, marca, modelo, codigo_bravos, dias_em_estoque, ano_fabricacao,
--   ano_modelo, cor, km, filial_estoque, dados_bravos}, ...]

-- Compara a planilha com o cadastro, sem gravar nada. Usada pela
-- pré-visualização e pela própria sincronização.
create or replace function public.previa_estoque(p_itens jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invalida text;
  v_duplicada text;
  v_resultado jsonb;
begin
  if public.papel_atual() is distinct from 'repasse' then
    raise exception 'Apenas o repasse pode atualizar o estoque.' using errcode = '42501';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'Lista de veículos inválida.' using errcode = '22023';
  end if;

  select i.placa into v_invalida
  from jsonb_to_recordset(p_itens) as i(placa text, marca text, modelo text)
  where public.placa_para_mercosul(i.placa) is null
     or nullif(btrim(i.marca), '') is null
     or nullif(btrim(i.modelo), '') is null
  limit 1;
  if found then
    raise exception 'Veículo inválido na planilha (placa "%"): placa, marca e modelo são obrigatórios.',
      coalesce(v_invalida, '') using errcode = '22023';
  end if;

  select public.placa_para_mercosul(i.placa) into v_duplicada
  from jsonb_to_recordset(p_itens) as i(placa text)
  group by 1
  having count(*) > 1
  limit 1;
  if found then
    raise exception 'A placa % aparece mais de uma vez na planilha.', v_duplicada using errcode = '23505';
  end if;

  with itens as (
    select public.placa_para_mercosul(i.placa) as pb,
           public.normalizar_placa(i.placa) as placa,
           btrim(i.marca) as marca,
           btrim(i.modelo) as modelo,
           nullif(btrim(i.codigo_bravos), '') as codigo_bravos,
           i.ano_fabricacao, i.ano_modelo,
           nullif(btrim(i.cor), '') as cor,
           i.km,
           nullif(btrim(i.filial_estoque), '') as filial_estoque
    from jsonb_to_recordset(p_itens) as i(
      placa text, marca text, modelo text, codigo_bravos text, ano_fabricacao int,
      ano_modelo int, cor text, km int, filial_estoque text
    )
  ),
  comparacao as (
    select it.placa, it.modelo,
           v.id is null as novo,
           v.id is not null and v.origem = 'manual' as mesclado,
           v.id is not null and v.origem = 'bravos' and not v.em_estoque as voltou,
           v.id is not null and (
             not v.em_estoque or v.origem <> 'bravos'
             or row(v.marca, v.modelo, v.codigo_bravos, v.ano_fabricacao, v.ano_modelo, v.cor, v.km, v.filial_estoque)
                is distinct from
                row(it.marca, it.modelo, it.codigo_bravos, it.ano_fabricacao, it.ano_modelo, it.cor, it.km, it.filial_estoque)
           ) as atualizado
    from itens it
    left join public.veiculos v on v.placa_busca = it.pb
  ),
  saem as (
    select v.placa, v.marca, v.modelo
    from public.veiculos v
    where v.em_estoque
      and not exists (select 1 from itens it where it.pb = v.placa_busca)
  ),
  totais as (
    select (select count(*) from itens) as total,
           (select count(*) from public.veiculos where em_estoque) as em_estoque_atual
  )
  select jsonb_build_object(
    'total', t.total,
    'em_estoque_atual', t.em_estoque_atual,
    'novos', (select count(*) from comparacao where novo),
    'atualizados', (select count(*) from comparacao where atualizado),
    'mantidos', (select count(*) from comparacao where not novo and not atualizado),
    'mesclados', (select count(*) from comparacao where mesclado),
    'voltaram', (select count(*) from comparacao where voltou),
    'sairam', (select count(*) from saem),
    'placas_novas', coalesce((select jsonb_agg(jsonb_build_object('placa', placa, 'modelo', modelo) order by placa) from comparacao where novo), '[]'::jsonb),
    'placas_sairam', coalesce((select jsonb_agg(jsonb_build_object('placa', placa, 'modelo', marca || ' ' || modelo) order by placa) from saem), '[]'::jsonb),
    -- RN13: trava contra arquivo errado ou exportação incompleta.
    'bloqueado', t.total = 0 or (t.em_estoque_atual > 0 and t.total < t.em_estoque_atual * 0.5),
    'motivo_bloqueio', case
      when t.total = 0 then
        'A planilha não tem nenhum veículo de repasse. Exporte o estoque completo do Bravos e tente de novo.'
      when t.em_estoque_atual > 0 and t.total < t.em_estoque_atual * 0.5 then
        format('A planilha tem %s veículos, menos da metade dos %s em estoque hoje. Provavelmente é o arquivo errado ou a exportação veio incompleta.',
               t.total, t.em_estoque_atual)
    end
  ) into v_resultado
  from totais t;

  return v_resultado;
end;
$$;

-- Aplica a planilha numa única transação: upsert por placa, quem não veio sai
-- do estoque, nada é apagado (RN12), manual vira bravos (RN14).
create or replace function public.sincronizar_estoque(
  p_arquivo text,
  p_arquivo_modificado_em timestamptz,
  p_itens jsonb,
  p_forcar boolean default false,
  p_erros int default 0,
  p_total_linhas int default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_previa jsonb;
  v_bloqueado boolean;
  v_importacao bigint;
  v_sairam int;
begin
  if public.papel_atual() is distinct from 'repasse' then
    raise exception 'Apenas o repasse pode atualizar o estoque.' using errcode = '42501';
  end if;
  if nullif(btrim(p_arquivo), '') is null then
    raise exception 'Informe o nome do arquivo.' using errcode = '23502';
  end if;

  -- Uma atualização por vez.
  perform pg_advisory_xact_lock(hashtext('esteira.sincronizar_estoque'));

  v_previa := public.previa_estoque(p_itens);
  v_bloqueado := (v_previa ->> 'bloqueado')::boolean;
  if v_bloqueado and not coalesce(p_forcar, false) then
    raise exception '%', v_previa ->> 'motivo_bloqueio' using errcode = 'P0001';
  end if;

  insert into public.importacoes_estoque (
    arquivo, arquivo_modificado_em, total_linhas, novos, atualizados, mantidos, sairam, erros, forcado, autor_id
  ) values (
    btrim(p_arquivo),
    p_arquivo_modificado_em,
    coalesce(p_total_linhas, (v_previa ->> 'total')::int + coalesce(p_erros, 0)),
    (v_previa ->> 'novos')::int,
    (v_previa ->> 'atualizados')::int,
    (v_previa ->> 'mantidos')::int,
    (v_previa ->> 'sairam')::int,
    coalesce(p_erros, 0),
    v_bloqueado,
    v_uid
  )
  returning id into v_importacao;

  insert into public.veiculos as v (
    placa, marca, modelo, codigo_bravos, dias_em_estoque, ano_fabricacao, ano_modelo, cor, km,
    filial_estoque, dados_bravos, em_estoque, saiu_do_estoque_em, ultima_importacao_id, origem, created_by
  )
  select i.placa, btrim(i.marca), btrim(i.modelo), nullif(btrim(i.codigo_bravos), ''), i.dias_em_estoque,
         i.ano_fabricacao, i.ano_modelo, nullif(btrim(i.cor), ''), i.km, nullif(btrim(i.filial_estoque), ''),
         i.dados_bravos, true, null, v_importacao, 'bravos', v_uid
  from jsonb_to_recordset(p_itens) as i(
    placa text, marca text, modelo text, codigo_bravos text, dias_em_estoque int, ano_fabricacao int,
    ano_modelo int, cor text, km int, filial_estoque text, dados_bravos jsonb
  )
  on conflict (placa_busca) do update set
    placa = excluded.placa,
    marca = excluded.marca,
    modelo = excluded.modelo,
    codigo_bravos = excluded.codigo_bravos,
    dias_em_estoque = excluded.dias_em_estoque,
    ano_fabricacao = excluded.ano_fabricacao,
    ano_modelo = excluded.ano_modelo,
    cor = excluded.cor,
    km = excluded.km,
    filial_estoque = excluded.filial_estoque,
    dados_bravos = excluded.dados_bravos,
    em_estoque = true,
    saiu_do_estoque_em = null,
    ultima_importacao_id = excluded.ultima_importacao_id,
    origem = 'bravos';

  update public.veiculos v
  set em_estoque = false,
      saiu_do_estoque_em = now()
  where v.em_estoque
    and v.ultima_importacao_id is distinct from v_importacao;
  get diagnostics v_sairam = row_count;

  return v_previa || jsonb_build_object('importacao_id', v_importacao, 'sairam', v_sairam, 'forcado', v_bloqueado);
end;
$$;

-- "Estoque atualizado em …" para qualquer usuário ativo (o vendedor não lê
-- importacoes_estoque, mas o wizard mostra essa data).
create or replace function public.estoque_atualizado_em()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(i.created_at)
  from public.importacoes_estoque i
  where public.papel_atual() is not null
$$;

revoke execute on function public.previa_estoque(jsonb) from public, anon;
revoke execute on function public.sincronizar_estoque(text, timestamptz, jsonb, boolean, int, int) from public, anon;
revoke execute on function public.estoque_atualizado_em() from public, anon;
grant execute on function public.previa_estoque(jsonb) to authenticated;
grant execute on function public.sincronizar_estoque(text, timestamptz, jsonb, boolean, int, int) to authenticated;
grant execute on function public.estoque_atualizado_em() to authenticated;
