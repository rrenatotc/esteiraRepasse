-- Usuários são criados pelo Renato no painel do Supabase (Authentication →
-- Users) e nascem como vendedor inativo; a ativação é feita no app.
-- Trava: o sistema nunca pode ficar sem nenhum repasse ativo.
create or replace function public.perfis_manter_um_repasse()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.perfis where papel = 'repasse' and ativo) then
    raise exception 'Precisa existir pelo menos um usuário do repasse ativo.' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create constraint trigger trg_perfis_manter_um_repasse
  after update of papel, ativo on public.perfis
  deferrable initially immediate
  for each row
  when (old.papel = 'repasse' and old.ativo)
  execute function public.perfis_manter_um_repasse();
