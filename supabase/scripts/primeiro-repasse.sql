-- Cria o primeiro operador do repasse (só uma vez, depois disso os
-- usuários são convidados pelo próprio app).
--
-- 1. No painel do Supabase: Authentication → Users → Add user → Create new user
--    (e-mail + senha, marque "Auto Confirm User").
-- 2. No SQL Editor, troque o e-mail abaixo e rode:

update public.perfis
set papel = 'repasse',
    nome = 'Renato',
    loja_id = null,
    ativo = true
where email = 'TROQUE@carburgo.com.br';

-- Deve retornar 1 linha:
select id, nome, email, papel, ativo from public.perfis where papel = 'repasse';
