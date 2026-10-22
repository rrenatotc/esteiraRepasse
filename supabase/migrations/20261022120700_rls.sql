-- RNF01 / seção 5.2: RLS em todas as tabelas, anon sem acesso a nada,
-- privilégios mínimos por coluna para o papel authenticated.

alter table public.lojas enable row level security;
alter table public.perfis enable row level security;
alter table public.lojistas enable row level security;
alter table public.veiculos enable row level security;
alter table public.importacoes_estoque enable row level security;
alter table public.demandas enable row level security;
alter table public.demanda_eventos enable row level security;

-- Zera os grants padrão do Supabase e concede só o necessário.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Funções puras e helpers usados pelo app e pelas policies.
grant execute on function
  public.normalizar_placa(text),
  public.placa_para_mercosul(text),
  public.normalizar_documento(text),
  public.validar_cpf(text),
  public.validar_cnpj(text),
  public.horas_uteis_entre(timestamptz, timestamptz),
  public.codigo_demanda(bigint),
  public.rotulo_status(public.status_demanda),
  public.papel_atual()
to authenticated;

-- lojas ------------------------------------------------------------------
grant select, insert, update on public.lojas to authenticated;

create policy lojas_select on public.lojas
  for select to authenticated
  using (public.papel_atual() is not null);

create policy lojas_insert on public.lojas
  for insert to authenticated
  with check (public.papel_atual() = 'repasse');

create policy lojas_update on public.lojas
  for update to authenticated
  using (public.papel_atual() = 'repasse')
  with check (public.papel_atual() = 'repasse');

-- perfis -----------------------------------------------------------------
grant select on public.perfis to authenticated;
grant update (nome, papel, loja_id, ativo) on public.perfis to authenticated;

create policy perfis_select on public.perfis
  for select to authenticated
  using (id = auth.uid() or public.papel_atual() in ('repasse', 'gestor'));

create policy perfis_update on public.perfis
  for update to authenticated
  using (public.papel_atual() = 'repasse')
  with check (public.papel_atual() = 'repasse');

-- lojistas ---------------------------------------------------------------
grant select on public.lojistas to authenticated;
grant insert (tipo, documento, razao_social, nome_fantasia, telefone, email, cidade, uf, situacao_cadastral, origem)
  on public.lojistas to authenticated;
grant update (razao_social, nome_fantasia, telefone, email, cidade, uf, situacao_cadastral, origem)
  on public.lojistas to authenticated;

create policy lojistas_select on public.lojistas
  for select to authenticated
  using (public.papel_atual() is not null);

create policy lojistas_insert on public.lojistas
  for insert to authenticated
  with check (public.papel_atual() is not null and created_by = auth.uid());

create policy lojistas_update on public.lojistas
  for update to authenticated
  using (public.papel_atual() = 'repasse')
  with check (public.papel_atual() = 'repasse');

-- veiculos ---------------------------------------------------------------
-- Cadastro manual por qualquer autenticado; estoque só via sincronizar_estoque.
grant select on public.veiculos to authenticated;
grant insert (placa, chassi, marca, modelo, versao, ano_fabricacao, ano_modelo, cor, km)
  on public.veiculos to authenticated;
grant update (placa, chassi, marca, modelo, versao, ano_fabricacao, ano_modelo, cor, km, filial_estoque)
  on public.veiculos to authenticated;

create policy veiculos_select on public.veiculos
  for select to authenticated
  using (public.papel_atual() is not null);

create policy veiculos_insert on public.veiculos
  for insert to authenticated
  with check (
    public.papel_atual() is not null
    and created_by = auth.uid()
    and origem = 'manual'
    and em_estoque = false
  );

create policy veiculos_update on public.veiculos
  for update to authenticated
  using (public.papel_atual() = 'repasse')
  with check (public.papel_atual() = 'repasse');

-- importacoes_estoque ----------------------------------------------------
grant select on public.importacoes_estoque to authenticated;

create policy importacoes_select on public.importacoes_estoque
  for select to authenticated
  using (public.papel_atual() in ('repasse', 'gestor'));

-- demandas ---------------------------------------------------------------
-- Status, responsável, proposta e NF só mudam pela RPC avancar_status.
grant select on public.demandas to authenticated;
grant insert (veiculo_id, lojista_id, loja_proposta_id, valor_venda, observacao)
  on public.demandas to authenticated;
grant update (veiculo_id, lojista_id, loja_proposta_id, valor_venda, observacao)
  on public.demandas to authenticated;

create policy demandas_select on public.demandas
  for select to authenticated
  using (
    public.papel_atual() in ('repasse', 'gestor')
    or (public.papel_atual() is not null and vendedor_id = auth.uid())
  );

create policy demandas_insert on public.demandas
  for insert to authenticated
  with check (
    public.papel_atual() in ('vendedor', 'repasse')
    and vendedor_id = auth.uid()
    and status = 'nova'
  );

-- RN09: vendedor edita a própria demanda só em nova (antes de assumida) e pendente.
create policy demandas_update_vendedor on public.demandas
  for update to authenticated
  using (
    public.papel_atual() is not null
    and vendedor_id = auth.uid()
    and status in ('nova', 'pendente')
    and (status = 'pendente' or responsavel_id is null)
  )
  with check (vendedor_id = auth.uid() and status in ('nova', 'pendente'));

-- demanda_eventos --------------------------------------------------------
-- Leitura segue a demanda; ninguém altera nem apaga.
grant select on public.demanda_eventos to authenticated;

create policy demanda_eventos_select on public.demanda_eventos
  for select to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id));
