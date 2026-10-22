-- Lojas do grupo (seção 3). Idempotente: pode rodar várias vezes.
-- Enviar para a nuvem com: npm run db:push   (usa --include-seed)
insert into public.lojas (codigo, nome) values
  ('2.1', 'Novo Hamburgo'),
  ('2.2', 'São Leopoldo'),
  ('2.3', 'Sapiranga'),
  ('2.4', 'Gravataí'),
  ('2.5', 'Shopping'),
  ('2.6', 'Perimetral'),
  ('3.2', 'Kia'),
  ('4.1', 'Premiere NH'),
  ('4.2', 'Premiere Canoas'),
  ('5.1', 'Eiffel'),
  ('6.1', 'Unidos')
on conflict (codigo) do nothing;
