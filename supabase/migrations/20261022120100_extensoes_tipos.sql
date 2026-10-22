-- Tipos base da Esteira do Repasse.
-- pg_cron é ativado na migration da consulta pública, só onde existir.

create type public.papel_usuario as enum ('vendedor', 'repasse', 'gestor');

create type public.status_demanda as enum (
  'nova',
  'em_proposta',
  'proposta_emitida',
  'faturada',
  'concluida',
  'pendente',
  'cancelada'
);

create type public.tipo_documento as enum ('cpf', 'cnpj');
