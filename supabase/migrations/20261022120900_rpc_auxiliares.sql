-- Passo 1 do wizard: o vendedor precisa saber se a placa já tem venda aberta,
-- mesmo que seja de outro vendedor (que a RLS esconde). Devolve só código e status.
create or replace function public.verificar_placa_aberta(p_placa text)
returns table (codigo text, status public.status_demanda, status_rotulo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.papel_atual() is null then
    raise exception 'Sessão expirada ou usuário inativo. Entre novamente.' using errcode = '42501';
  end if;
  return query
    select public.codigo_demanda(d.codigo), d.status, public.rotulo_status(d.status)
    from public.demandas d
    where d.placa_busca = public.placa_para_mercosul(p_placa)
      and d.status not in ('concluida', 'cancelada')
    limit 1;
end;
$$;

revoke execute on function public.verificar_placa_aberta(text) from public, anon;
grant execute on function public.verificar_placa_aberta(text) to authenticated;
