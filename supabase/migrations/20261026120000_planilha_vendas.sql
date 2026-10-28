-- Planilha "Vendas Repasse <MÊS> <ANO>": cada venda registrada vira uma linha.
-- As colunas A–Q da planilha ficam aqui como valores próprios (snapshot
-- editável), sem depender das regras de status da esteira. Todos os usuários
-- ativos veem a planilha do mês; edita/exclui o vendedor da venda, o repasse
-- e a gestão. Escrita só pelas RPCs abaixo.

create table public.planilha_vendas (
  demanda_id uuid primary key references public.demandas on delete restrict,
  vendedor_id uuid not null references public.perfis,
  anunciante text,                               -- A
  placa text not null,                           -- B
  veiculo text,                                  -- C
  ano text,                                      -- D "2017/2018"
  fipe numeric(12, 2) check (fipe >= 0),         -- E
  valor_compra numeric(12, 2) check (valor_compra >= 0),   -- F
  valor_vendido numeric(12, 2) check (valor_vendido >= 0), -- G
  dias_estoque int check (dias_estoque >= 0),    -- H
  classificacao text,                            -- I
  -- J (lucro) e K (lucro %) são fórmulas na planilha.
  transf_margem numeric(12, 2),                  -- L
  tipo_venda text,                               -- M
  lojista text,                                  -- N
  data_venda date not null,                      -- O
  faturado text,                                 -- P
  repassador text,                               -- Q
  excluida_em timestamptz,
  motivo_exclusao text,
  updated_by uuid references public.perfis,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_planilha_vendas_data on public.planilha_vendas (data_venda) where excluida_em is null;

create trigger trg_planilha_vendas_updated_at
  before update on public.planilha_vendas
  for each row execute function public.set_updated_at();

-- Textos derivados do cadastro, no formato da planilha (maiúsculas).
create or replace function public.planilha_veiculo(s jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(upper(btrim(concat_ws(' ', s ->> 'modelo', s ->> 'versao'))), '')
$$;

create or replace function public.planilha_ano(s jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when s ->> 'ano_fabricacao' is null and s ->> 'ano_modelo' is null then null
    else concat_ws('/', coalesce(s ->> 'ano_fabricacao', s ->> 'ano_modelo'), coalesce(s ->> 'ano_modelo', s ->> 'ano_fabricacao'))
  end
$$;

create or replace function public.planilha_lojista(p_lojista uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select upper(coalesce(nullif(btrim(l.nome_fantasia), ''), l.razao_social))
  from public.lojistas l
  where l.id = p_lojista
$$;

-- Nova demanda → nova linha. security definer: o vendedor não escreve direto
-- na tabela.
create or replace function public.planilha_criar_linha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.planilha_vendas (
    demanda_id, vendedor_id, anunciante, placa, veiculo, ano, valor_vendido, dias_estoque, lojista, data_venda, faturado
  )
  select
    new.id,
    new.vendedor_id,
    (select upper(lj.nome) from public.lojas lj where lj.id = new.loja_proposta_id),
    new.placa,
    public.planilha_veiculo(new.veiculo_snapshot),
    public.planilha_ano(new.veiculo_snapshot),
    new.valor_venda,
    (select v.dias_em_estoque from public.veiculos v where v.id = new.veiculo_id),
    public.planilha_lojista(new.lojista_id),
    (new.created_at at time zone 'America/Sao_Paulo')::date,
    case when new.status in ('faturada', 'concluida') then 'SIM' end
  on conflict (demanda_id) do nothing;
  return new;
end;
$$;

create trigger trg_demandas_30_planilha
  after insert on public.demandas
  for each row execute function public.planilha_criar_linha();

-- Correção da venda (veículo, lojista, valor) e mudança de status refletem na
-- linha: faturada → "SIM"; cancelada → sai da planilha.
create or replace function public.planilha_sincronizar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.veiculo_id is distinct from old.veiculo_id then
    update public.planilha_vendas
    set placa = new.placa,
        veiculo = public.planilha_veiculo(new.veiculo_snapshot),
        ano = public.planilha_ano(new.veiculo_snapshot)
    where demanda_id = new.id;
  end if;
  if new.lojista_id is distinct from old.lojista_id then
    update public.planilha_vendas set lojista = public.planilha_lojista(new.lojista_id) where demanda_id = new.id;
  end if;
  if new.valor_venda is distinct from old.valor_venda then
    update public.planilha_vendas set valor_vendido = new.valor_venda where demanda_id = new.id;
  end if;
  if new.status is distinct from old.status then
    if new.status in ('faturada', 'concluida') then
      update public.planilha_vendas set faturado = 'SIM' where demanda_id = new.id and faturado is null;
    elsif new.status = 'cancelada' then
      update public.planilha_vendas
      set excluida_em = coalesce(excluida_em, now()),
          motivo_exclusao = coalesce(motivo_exclusao, new.motivo_ultimo)
      where demanda_id = new.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_demandas_40_planilha
  after update of veiculo_id, lojista_id, valor_venda, status on public.demandas
  for each row execute function public.planilha_sincronizar();

-- Vendas registradas antes desta versão também entram.
insert into public.planilha_vendas (
  demanda_id, vendedor_id, anunciante, placa, veiculo, ano, valor_vendido, dias_estoque, lojista, data_venda, faturado,
  excluida_em, motivo_exclusao
)
select
  d.id,
  d.vendedor_id,
  upper(lj.nome),
  d.placa,
  public.planilha_veiculo(d.veiculo_snapshot),
  public.planilha_ano(d.veiculo_snapshot),
  d.valor_venda,
  v.dias_em_estoque,
  public.planilha_lojista(d.lojista_id),
  (d.created_at at time zone 'America/Sao_Paulo')::date,
  case when d.status in ('faturada', 'concluida') then 'SIM' end,
  case when d.status = 'cancelada' then d.status_desde end,
  case when d.status = 'cancelada' then d.motivo_ultimo end
from public.demandas d
join public.lojas lj on lj.id = d.loja_proposta_id
join public.veiculos v on v.id = d.veiculo_id
on conflict (demanda_id) do nothing;

-- Quem pode mexer numa linha: o vendedor da venda, o repasse e a gestão.
create or replace function public.planilha_pode_editar(p_vendedor uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.papel_atual() in ('repasse', 'gestor')
    or (public.papel_atual() is not null and p_vendedor = auth.uid())
$$;

create or replace function public.planilha_numero(p_dados jsonb, p_chave text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_texto text := nullif(btrim(p_dados ->> p_chave), '');
begin
  if v_texto is null then
    return null;
  end if;
  return round(v_texto::numeric, 2);
exception when others then
  raise exception 'Valor inválido em "%": %.', p_chave, v_texto using errcode = '22023';
end;
$$;

-- Edita as colunas presentes em p_dados (as ausentes ficam como estão).
create or replace function public.editar_linha_planilha(p_demanda uuid, p_dados jsonb)
returns public.planilha_vendas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dados jsonb := coalesce(p_dados, '{}'::jsonb);
  l public.planilha_vendas;
  v_texto text;
begin
  if public.papel_atual() is null then
    raise exception 'Sessão expirada ou usuário inativo. Entre novamente.' using errcode = '42501';
  end if;
  select * into l from public.planilha_vendas where demanda_id = p_demanda for update;
  if not found then
    raise exception 'Linha da planilha não encontrada.' using errcode = 'P0002';
  end if;
  if not public.planilha_pode_editar(l.vendedor_id) then
    raise exception 'Só o vendedor da venda, o repasse ou a gestão podem alterar esta linha.' using errcode = '42501';
  end if;

  if v_dados ? 'classificacao' then
    v_texto := nullif(upper(btrim(v_dados ->> 'classificacao')), '');
    if v_texto is not null and length(v_texto) > 3 then
      raise exception 'Classificação deve ser uma letra, por exemplo C ou D.' using errcode = '22023';
    end if;
    l.classificacao := v_texto;
  end if;
  if v_dados ? 'tipo_venda' then
    v_texto := nullif(upper(btrim(v_dados ->> 'tipo_venda')), '');
    if v_texto is not null and v_texto not in ('GRUPO', 'PACOTE') then
      raise exception 'Tipo de venda deve ser GRUPO ou PACOTE.' using errcode = '22023';
    end if;
    l.tipo_venda := v_texto;
  end if;
  if v_dados ? 'data_venda' then
    begin
      l.data_venda := coalesce((v_dados ->> 'data_venda')::date, l.data_venda);
    exception when others then
      raise exception 'Data da venda inválida.' using errcode = '22007';
    end;
  end if;
  if v_dados ? 'dias_estoque' then
    begin
      l.dias_estoque := nullif(btrim(v_dados ->> 'dias_estoque'), '')::int;
    exception when others then
      raise exception 'Dias de estoque inválido.' using errcode = '22023';
    end;
  end if;

  update public.planilha_vendas
  set anunciante = case when v_dados ? 'anunciante' then nullif(upper(btrim(v_dados ->> 'anunciante')), '') else anunciante end,
      placa = case when v_dados ? 'placa' then coalesce(nullif(upper(btrim(v_dados ->> 'placa')), ''), placa) else placa end,
      veiculo = case when v_dados ? 'veiculo' then nullif(upper(btrim(v_dados ->> 'veiculo')), '') else veiculo end,
      ano = case when v_dados ? 'ano' then nullif(btrim(v_dados ->> 'ano'), '') else ano end,
      fipe = case when v_dados ? 'fipe' then public.planilha_numero(v_dados, 'fipe') else fipe end,
      valor_compra = case when v_dados ? 'valor_compra' then public.planilha_numero(v_dados, 'valor_compra') else valor_compra end,
      valor_vendido = case when v_dados ? 'valor_vendido' then public.planilha_numero(v_dados, 'valor_vendido') else valor_vendido end,
      dias_estoque = l.dias_estoque,
      classificacao = l.classificacao,
      transf_margem = case when v_dados ? 'transf_margem' then public.planilha_numero(v_dados, 'transf_margem') else transf_margem end,
      tipo_venda = l.tipo_venda,
      lojista = case when v_dados ? 'lojista' then nullif(upper(btrim(v_dados ->> 'lojista')), '') else lojista end,
      data_venda = l.data_venda,
      faturado = case when v_dados ? 'faturado' then nullif(upper(btrim(v_dados ->> 'faturado')), '') else faturado end,
      repassador = case when v_dados ? 'repassador' then nullif(upper(btrim(v_dados ->> 'repassador')), '') else repassador end,
      updated_by = auth.uid()
  where demanda_id = p_demanda
  returning * into l;
  return l;
end;
$$;

-- "Excluir linha" = a venda caiu: cancela a demanda (com histórico) e a linha
-- sai da planilha. Venda já faturada só sai da planilha pelo repasse/gestão.
create or replace function public.excluir_linha_planilha(p_demanda uuid, p_motivo text)
returns public.planilha_vendas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := nullif(btrim(p_motivo), '');
  v_papel public.papel_usuario := public.papel_atual();
  l public.planilha_vendas;
  d public.demandas;
begin
  if v_papel is null then
    raise exception 'Sessão expirada ou usuário inativo. Entre novamente.' using errcode = '42501';
  end if;
  if v_motivo is null then
    raise exception 'Informe o motivo para excluir a venda.' using errcode = '23502';
  end if;
  select * into l from public.planilha_vendas where demanda_id = p_demanda for update;
  if not found then
    raise exception 'Linha da planilha não encontrada.' using errcode = 'P0002';
  end if;
  if not public.planilha_pode_editar(l.vendedor_id) then
    raise exception 'Só o vendedor da venda, o repasse ou a gestão podem excluir esta linha.' using errcode = '42501';
  end if;
  if l.excluida_em is not null then
    return l;
  end if;

  select * into d from public.demandas where id = p_demanda for update;
  if d.status in ('nova', 'em_proposta', 'proposta_emitida', 'pendente') then
    update public.demandas set status = 'cancelada', motivo_ultimo = v_motivo where id = d.id;
    insert into public.demanda_eventos (demanda_id, de_status, para_status, autor_id, comentario)
    values (d.id, d.status, 'cancelada', auth.uid(), v_motivo);
  elsif d.status in ('faturada', 'concluida') and v_papel = 'vendedor' then
    raise exception 'Esta venda já foi faturada. Peça ao repasse para tirá-la da planilha.' using errcode = '42501';
  end if;

  update public.planilha_vendas
  set excluida_em = coalesce(excluida_em, now()),
      motivo_exclusao = coalesce(motivo_exclusao, v_motivo),
      updated_by = auth.uid()
  where demanda_id = p_demanda
  returning * into l;
  return l;
end;
$$;

-- registrar_venda passa a receber as colunas da planilha (FIPE, compra...).
drop function public.registrar_venda(text, smallint, numeric, text, jsonb, uuid, jsonb);

create function public.registrar_venda(
  p_placa text,
  p_loja_proposta_id smallint,
  p_valor_venda numeric,
  p_observacao text default null,
  p_veiculo_manual jsonb default null,   -- {marca, modelo, ano_fabricacao, ano_modelo, cor}
  p_lojista_id uuid default null,
  p_lojista_novo jsonb default null,     -- {tipo, documento, razao_social, nome_fantasia, telefone, email, cidade, uf, situacao_cadastral, origem}
  p_planilha jsonb default null          -- {anunciante, fipe, valor_compra, classificacao, transf_margem, tipo_venda, repassador}
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

  -- A linha da planilha nasce pelo trigger; aqui entram as colunas que só o
  -- vendedor sabe. Só as chaves conhecidas, para não sobrescrever placa/valor.
  if p_planilha is not null then
    perform public.editar_linha_planilha(
      d.id,
      (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
       from jsonb_each(p_planilha) as e(k, v)
       where k in ('anunciante', 'fipe', 'valor_compra', 'classificacao', 'transf_margem', 'tipo_venda', 'repassador'))
    );
  end if;

  return d;
end;
$$;

revoke execute on function public.registrar_venda(text, smallint, numeric, text, jsonb, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_venda(text, smallint, numeric, text, jsonb, uuid, jsonb, jsonb) to authenticated;

-- Permissões -------------------------------------------------------------
alter table public.planilha_vendas enable row level security;
grant select on public.planilha_vendas to authenticated;

create policy planilha_vendas_select on public.planilha_vendas
  for select to authenticated
  using (public.pode_ver_painel());

revoke execute on function public.editar_linha_planilha(uuid, jsonb) from public, anon;
grant execute on function public.editar_linha_planilha(uuid, jsonb) to authenticated;
revoke execute on function public.excluir_linha_planilha(uuid, text) from public, anon;
grant execute on function public.excluir_linha_planilha(uuid, text) to authenticated;
revoke execute on function public.planilha_pode_editar(uuid) from public, anon;
grant execute on function public.planilha_pode_editar(uuid) to authenticated;
revoke execute on function public.planilha_lojista(uuid) from public, anon, authenticated;
revoke execute on function public.planilha_criar_linha() from public, anon, authenticated;
revoke execute on function public.planilha_sincronizar() from public, anon, authenticated;

alter publication supabase_realtime add table public.planilha_vendas;
