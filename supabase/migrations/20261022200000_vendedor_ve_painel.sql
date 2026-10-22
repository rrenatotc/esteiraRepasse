-- Vendedores também veem o painel, o estoque (com histórico de atualizações)
-- e as lojas, só para leitura. Aplicar planilha e editar continuam com o repasse.

drop policy importacoes_select on public.importacoes_estoque;
create policy importacoes_select on public.importacoes_estoque
  for select to authenticated
  using (public.papel_atual() is not null);

create or replace function public.pode_ver_painel()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.papel_atual() is not null
$$;

-- indicadores_painel: troca só a checagem de papel.
do $$
declare
  v_def text := pg_get_functiondef('public.indicadores_painel(date, date)'::regprocedure);
begin
  v_def := replace(
    v_def,
    $old$if public.papel_atual() not in ('repasse', 'gestor') or public.papel_atual() is null then
    raise exception 'Apenas repasse e gestão veem o painel.' using errcode = '42501';$old$,
    $new$if not public.pode_ver_painel() then
    raise exception 'Sessão expirada ou usuário inativo. Entre novamente.' using errcode = '42501';$new$
  );
  if position('pode_ver_painel' in v_def) = 0 then
    raise exception 'Não foi possível atualizar indicadores_painel';
  end if;
  execute v_def;
end;
$$;

grant execute on function public.pode_ver_painel() to authenticated;
revoke execute on function public.pode_ver_painel() from anon, public;
