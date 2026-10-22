create table public.lojas (
  id smallint generated always as identity primary key,
  codigo text not null unique,           -- código do Bravos, ex.: '2.1'
  nome text not null,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.lojas is 'Lojas do grupo. Exibir sempre "código + nome". Seed em supabase/seed.sql.';

create table public.perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  email text,
  papel public.papel_usuario not null default 'vendedor',
  loja_id smallint references public.lojas,   -- loja onde o vendedor está lotado
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_perfis_loja on public.perfis (loja_id);

create trigger trg_perfis_updated_at
  before update on public.perfis
  for each row execute function public.set_updated_at();

-- Papel do usuário logado; null se não logado ou inativo. Base das policies.
-- security definer para não recursar na RLS de perfis.
create or replace function public.papel_atual()
returns public.papel_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select p.papel
  from public.perfis p
  where p.id = auth.uid() and p.ativo
$$;

-- Todo usuário novo nasce como vendedor INATIVO. Quem define papel, loja e
-- ativa é a Edge Function convidar-usuario (service role) ou o script do
-- primeiro repasse. Assim um cadastro indevido nunca ganha acesso.
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email, papel, ativo)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1), 'Usuário'),
    new.email,
    'vendedor',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_auth_users_criar_perfil
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();
