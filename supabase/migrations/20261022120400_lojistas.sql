create table public.lojistas (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_documento not null,
  documento text not null unique,            -- sem máscara; CNPJ pode ser alfanumérico
  razao_social text not null check (btrim(razao_social) <> ''),
  nome_fantasia text,
  telefone text,
  email text,
  cidade text,
  uf char(2),
  situacao_cadastral text,
  origem text not null default 'manual' check (origem in ('brasilapi', 'opencnpj', 'manual')),
  created_by uuid references public.perfis default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_lojistas_documento_normalizado check (documento = public.normalizar_documento(documento)),
  constraint ck_lojistas_documento_valido check (
    (tipo = 'cpf' and public.validar_cpf(documento))
    or (tipo = 'cnpj' and public.validar_cnpj(documento))
  )
);

create trigger trg_lojistas_updated_at
  before update on public.lojistas
  for each row execute function public.set_updated_at();
