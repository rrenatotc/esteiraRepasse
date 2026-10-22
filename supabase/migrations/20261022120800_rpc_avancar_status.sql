-- Única porta para mudar o status de uma demanda (RN05, RN06, RN07).
create or replace function public.avancar_status(
  p_demanda uuid,
  p_para public.status_demanda,
  p_dados jsonb default '{}'::jsonb,
  p_comentario text default null
)
returns public.demandas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_papel public.papel_usuario := public.papel_atual();
  v_comentario text := nullif(btrim(p_comentario), '');
  v_dados jsonb := coalesce(p_dados, '{}'::jsonb);
  v_permitidas public.status_demanda[];
  v_texto text;
  v_data date;
  d public.demandas;
  v_de public.status_demanda;
begin
  if v_uid is null or v_papel is null then
    raise exception 'Sessão expirada ou usuário inativo. Entre novamente.' using errcode = '42501';
  end if;

  select * into d from public.demandas where id = p_demanda for update;
  if not found then
    raise exception 'Demanda não encontrada.' using errcode = 'P0002';
  end if;
  v_de := d.status;

  -- RN05
  v_permitidas := case v_de
    when 'nova' then array['em_proposta', 'pendente', 'cancelada']::public.status_demanda[]
    when 'em_proposta' then array['proposta_emitida', 'pendente', 'cancelada']::public.status_demanda[]
    when 'proposta_emitida' then array['faturada', 'pendente', 'cancelada']::public.status_demanda[]
    when 'pendente' then array['nova', 'cancelada']::public.status_demanda[]
    when 'faturada' then array['concluida']::public.status_demanda[]
    else array[]::public.status_demanda[]
  end;
  if not (p_para = any (v_permitidas)) then
    raise exception 'Não é possível mudar a demanda % de "%" para "%".',
      public.codigo_demanda(d.codigo), public.rotulo_status(v_de), public.rotulo_status(p_para)
      using errcode = 'P0001';
  end if;

  -- Quem pode: reenvio (pendente → nova) só o vendedor da venda; o resto, só o repasse.
  if p_para = 'nova' then
    if d.vendedor_id <> v_uid then
      raise exception 'Só o vendedor que registrou a venda pode reenviá-la.' using errcode = '42501';
    end if;
  elsif v_papel <> 'repasse' then
    raise exception 'Apenas o repasse pode mudar a demanda para "%".', public.rotulo_status(p_para)
      using errcode = '42501';
  end if;

  -- RN06 + campos de cada transição
  case p_para
    when 'em_proposta' then
      d.responsavel_id := v_uid;

    when 'proposta_emitida' then
      v_texto := nullif(btrim(v_dados ->> 'numero_proposta'), '');
      if v_texto is null then
        raise exception 'Informe o número da proposta.' using errcode = '23502';
      end if;
      begin
        v_data := (v_dados ->> 'data_emissao_proposta')::date;
      exception when others then
        raise exception 'Data de emissão da proposta inválida.' using errcode = '22007';
      end;
      if v_data is null then
        raise exception 'Informe a data de emissão da proposta.' using errcode = '23502';
      end if;
      d.numero_proposta := v_texto;
      d.data_emissao_proposta := v_data;
      d.responsavel_id := coalesce(d.responsavel_id, v_uid);

    when 'faturada' then
      v_texto := nullif(btrim(v_dados ->> 'numero_nf'), '');
      if v_texto is null then
        raise exception 'Informe o número da NF.' using errcode = '23502';
      end if;
      begin
        v_data := (v_dados ->> 'data_emissao_nf')::date;
      exception when others then
        raise exception 'Data de emissão da NF inválida.' using errcode = '22007';
      end;
      if v_data is null then
        raise exception 'Informe a data de emissão da NF.' using errcode = '23502';
      end if;
      d.numero_nf := v_texto;
      d.data_emissao_nf := v_data;

    when 'pendente', 'cancelada' then
      if v_comentario is null then
        raise exception 'Informe o motivo para %.',
          case p_para when 'pendente' then 'devolver ao vendedor' else 'cancelar' end
          using errcode = '23502';
      end if;
      d.motivo_ultimo := v_comentario;

    when 'nova' then
      d.motivo_ultimo := null;

    else
      null; -- concluida: sem campos
  end case;

  update public.demandas
  set status = p_para,
      responsavel_id = d.responsavel_id,
      numero_proposta = d.numero_proposta,
      data_emissao_proposta = d.data_emissao_proposta,
      numero_nf = d.numero_nf,
      data_emissao_nf = d.data_emissao_nf,
      motivo_ultimo = d.motivo_ultimo
  where id = d.id
  returning * into d;

  insert into public.demanda_eventos (demanda_id, de_status, para_status, autor_id, comentario)
  values (d.id, v_de, p_para, v_uid, v_comentario);

  return d;
end;
$$;

revoke execute on function public.avancar_status(uuid, public.status_demanda, jsonb, text) from public, anon;
grant execute on function public.avancar_status(uuid, public.status_demanda, jsonb, text) to authenticated;
