-- RNF03 (< 500 ms): rate limit + consulta numa única chamada ao banco,
-- em vez de duas idas e voltas da Edge Function.
create or replace function public.consulta_publica(p_chave_hash text, p_ip_hash text, p_placa text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_placa text := public.placa_para_mercosul(p_placa);
begin
  if v_placa is null then
    return jsonb_build_object('permitido', true, 'resultado', null);
  end if;
  if not public.registrar_consulta_publica(p_chave_hash, p_ip_hash, v_placa) then
    return jsonb_build_object('permitido', false, 'resultado', null);
  end if;
  return jsonb_build_object('permitido', true, 'resultado', public.consultar_placa_publica(v_placa));
end;
$$;

revoke execute on function public.consulta_publica(text, text, text) from public, anon, authenticated;
grant execute on function public.consulta_publica(text, text, text) to service_role;
