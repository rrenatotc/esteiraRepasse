create table public.demandas (
  id uuid primary key default gen_random_uuid(),
  codigo bigint generated always as identity unique,   -- exibir com codigo_demanda()
  veiculo_id uuid not null references public.veiculos,
  placa text not null,
  placa_busca text not null,
  veiculo_snapshot jsonb not null,                     -- RN08, preenchido por trigger
  lojista_id uuid not null references public.lojistas,
  loja_proposta_id smallint not null references public.lojas,
  vendedor_id uuid not null references public.perfis default auth.uid(),
  responsavel_id uuid references public.perfis,
  valor_venda numeric(12, 2) not null check (valor_venda > 0),
  observacao text,
  numero_proposta text,
  data_emissao_proposta date,
  numero_nf text,
  data_emissao_nf date,
  status public.status_demanda not null default 'nova',
  motivo_ultimo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- RN06 também como constraint, além da validação na RPC.
  constraint ck_demandas_proposta check (
    status not in ('proposta_emitida', 'faturada', 'concluida')
    or (numero_proposta is not null and data_emissao_proposta is not null)
  ),
  constraint ck_demandas_nf check (
    status not in ('faturada', 'concluida')
    or (numero_nf is not null and data_emissao_nf is not null)
  )
);

-- RN02: uma demanda aberta por placa.
create unique index uq_demanda_aberta_por_placa
  on public.demandas (placa_busca)
  where status not in ('concluida', 'cancelada');
create index ix_demandas_status on public.demandas (status, created_at desc);
create index ix_demandas_placa_busca on public.demandas (placa_busca, created_at desc);
create index ix_demandas_vendedor on public.demandas (vendedor_id, created_at desc);
create index ix_demandas_veiculo on public.demandas (veiculo_id);
create index ix_demandas_lojista on public.demandas (lojista_id);
create index ix_demandas_loja on public.demandas (loja_proposta_id);
create index ix_demandas_responsavel on public.demandas (responsavel_id);

create trigger trg_demandas_updated_at
  before update on public.demandas
  for each row execute function public.set_updated_at();

-- RN08: copia placa e dados do veículo para a demanda. Roda no insert e
-- quando o vendedor troca o veículo numa demanda pendente. security definer
-- para o snapshot nunca depender da RLS; a policy de insert/update continua
-- decidindo se a escrita é permitida.
create or replace function public.demandas_copiar_veiculo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.veiculos;
begin
  select * into v from public.veiculos where id = new.veiculo_id;
  if not found then
    raise exception 'Veículo não encontrado.' using errcode = '23503';
  end if;
  new.placa := v.placa;
  new.placa_busca := v.placa_busca;
  new.veiculo_snapshot := jsonb_build_object(
    'placa', v.placa,
    'chassi', v.chassi,
    'marca', v.marca,
    'modelo', v.modelo,
    'versao', v.versao,
    'ano_fabricacao', v.ano_fabricacao,
    'ano_modelo', v.ano_modelo,
    'cor', v.cor,
    'km', v.km,
    'filial_estoque', v.filial_estoque,
    'origem', v.origem
  );
  return new;
end;
$$;

create trigger trg_demandas_10_copiar_veiculo
  before insert or update of veiculo_id on public.demandas
  for each row execute function public.demandas_copiar_veiculo();

-- RN02 com mensagem clara. security definer para enxergar demandas de
-- outros vendedores; o índice único continua garantindo a regra.
create or replace function public.demandas_checar_placa_aberta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  aberta record;
begin
  select d.codigo, d.status into aberta
  from public.demandas d
  where d.placa_busca = new.placa_busca
    and d.status not in ('concluida', 'cancelada')
    and d.id <> new.id
  limit 1;
  if found then
    raise exception 'Já existe uma venda aberta para a placa % (%, %).',
      new.placa, public.codigo_demanda(aberta.codigo), lower(public.rotulo_status(aberta.status))
      using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger trg_demandas_20_checar_placa_aberta
  before insert or update of veiculo_id on public.demandas
  for each row execute function public.demandas_checar_placa_aberta();

-- RN07: histórico imutável.
create table public.demanda_eventos (
  id bigint generated always as identity primary key,
  demanda_id uuid not null references public.demandas on delete restrict,
  de_status public.status_demanda,
  para_status public.status_demanda not null,
  autor_id uuid not null references public.perfis,
  comentario text,
  created_at timestamptz not null default now()
);

create index ix_demanda_eventos_demanda on public.demanda_eventos (demanda_id, created_at);
create index ix_demanda_eventos_autor on public.demanda_eventos (autor_id);

create or replace function public.demanda_eventos_imutavel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O histórico da demanda não pode ser alterado nem apagado.' using errcode = '42501';
end;
$$;

create trigger trg_demanda_eventos_imutavel
  before update or delete on public.demanda_eventos
  for each row execute function public.demanda_eventos_imutavel();

-- Primeiro evento (null → nova).
create or replace function public.demandas_evento_inicial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.demanda_eventos (demanda_id, de_status, para_status, autor_id)
  values (new.id, null, new.status, new.vendedor_id);
  return null;
end;
$$;

create trigger trg_demandas_evento_inicial
  after insert on public.demandas
  for each row execute function public.demandas_evento_inicial();
