-- Funções utilitárias puras. Equivalentes em TypeScript: src/shared/{placa,documento,horas-uteis}.ts.

-- RN01: maiúsculas, sem traço/espaço/pontuação.
create or replace function public.normalizar_placa(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g')
$$;

-- RN01: chave de busca no formato Mercosul; null se a placa for inválida.
create or replace function public.placa_para_mercosul(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when n ~ '^[A-Z]{3}[0-9]{4}$'
      then substr(n, 1, 4) || chr(ascii('A') + substr(n, 5, 1)::int) || substr(n, 6)
    when n ~ '^[A-Z]{3}[0-9][A-Z][0-9]{2}$'
      then n
  end
  from (select public.normalizar_placa(p) as n) s
$$;

-- RN03: documento sem máscara, maiúsculo (CNPJ pode ser alfanumérico).
create or replace function public.normalizar_documento(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(upper(coalesce(p, '')), '[^0-9A-Z]', '', 'g')
$$;

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
  i int;
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

-- CNPJ numérico e alfanumérico: cada caractere vale ascii − 48; DVs numéricos.
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
  i int;
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

-- RF13: horas úteis (seg–sáb, 08h–18h, America/Sao_Paulo) entre dois instantes.
create or replace function public.horas_uteis_entre(p_inicio timestamptz, p_fim timestamptz)
returns numeric
language sql
stable
parallel safe
set search_path = ''
as $$
  select coalesce(
    round(sum(greatest(0, extract(epoch from (
      least(dia + interval '18 hours', b) - greatest(dia + interval '8 hours', a)
    )))) / 3600, 2),
    0
  )
  from (
    select p_inicio at time zone 'America/Sao_Paulo' as a,
           p_fim at time zone 'America/Sao_Paulo' as b
  ) x
  cross join lateral generate_series(date_trunc('day', x.a), x.b, interval '1 day') as dia
  where x.b > x.a
    and extract(isodow from dia) <> 7
$$;

create or replace function public.codigo_demanda(p_codigo bigint)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'REP-' || lpad(p_codigo::text, 6, '0')
$$;

create or replace function public.rotulo_status(p public.status_demanda)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p
    when 'nova' then 'Nova'
    when 'em_proposta' then 'Em proposta'
    when 'proposta_emitida' then 'Proposta emitida'
    when 'faturada' then 'Faturada'
    when 'concluida' then 'Concluída'
    when 'pendente' then 'Pendente'
    when 'cancelada' then 'Cancelada'
  end
$$;

-- RNF07: updated_at automático.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
