create table public.importacoes_estoque (
  id bigint generated always as identity primary key,
  arquivo text not null,
  arquivo_modificado_em timestamptz,
  total_linhas int not null default 0,
  novos int not null default 0,
  atualizados int not null default 0,
  mantidos int not null default 0,
  sairam int not null default 0,
  erros int not null default 0,
  forcado boolean not null default false,
  autor_id uuid not null references public.perfis,
  created_at timestamptz not null default now()
);

create index ix_importacoes_created on public.importacoes_estoque (created_at desc);

-- Cadastro próprio de veículos, de qualquer filial. Nunca é apagado (RN12).
create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,                -- normalizada
  placa_busca text not null unique,          -- formato Mercosul
  chassi text,
  marca text not null check (btrim(marca) <> ''),
  modelo text not null check (btrim(modelo) <> ''),
  versao text,
  ano_fabricacao int check (ano_fabricacao between 1950 and 2100),
  ano_modelo int check (ano_modelo between 1950 and 2101),
  cor text,
  km int check (km >= 0),
  filial_estoque text,
  dados_bravos jsonb,                        -- linha original da planilha
  -- Cadastro manual nasce fora do estoque; só a planilha do Bravos põe em estoque.
  em_estoque boolean not null default false,
  saiu_do_estoque_em timestamptz,
  ultima_importacao_id bigint references public.importacoes_estoque,
  origem text not null default 'manual' check (origem in ('bravos', 'manual')),
  created_by uuid references public.perfis default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_veiculos_em_estoque on public.veiculos (em_estoque) where em_estoque;

-- Normaliza a placa e preenche placa_busca; rejeita placa inválida.
create or replace function public.veiculos_normalizar_placa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.placa := public.normalizar_placa(new.placa);
  new.placa_busca := public.placa_para_mercosul(new.placa);
  if new.placa_busca is null then
    raise exception 'Placa inválida: "%". Use o padrão ABC1234 ou ABC1D23.', new.placa
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger trg_veiculos_placa
  before insert or update of placa on public.veiculos
  for each row execute function public.veiculos_normalizar_placa();

create trigger trg_veiculos_updated_at
  before update on public.veiculos
  for each row execute function public.set_updated_at();
