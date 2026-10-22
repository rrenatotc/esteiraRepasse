# Esteira do Repasse

App desktop (Electron + React + Supabase) do setor de Repasse do Grupo Carburgo:
cada venda vira uma demanda rastreável, com fila de trabalho para o repasse e
consulta pública de status por placa.

## Desenvolvimento

```bash
npm install
cp .env.example .env     # preencha URL e chave anon do Supabase
npm run dev
```

| comando | o que faz |
|---|---|
| `npm test` | testes unitários (Vitest) + testes de banco em PGlite (sem Docker) |
| `npm run typecheck` | TypeScript strict no main, preload e renderer |
| `npm run db:push` | aplica as migrations e o seed no projeto Supabase ligado |
| `npm run db:types` | regenera `src/shared/database.types.ts` a partir do banco |
| `node scripts/screenshots.mts` | screenshots do app buildado em 1024 e 1600 px |

## Ligar ao Supabase (uma vez)

```bash
npx supabase login                       # abre o navegador
npx supabase link --project-ref SEU_REF
npm run db:push
npm run db:types
```

Depois crie o primeiro usuário do repasse seguindo `supabase/scripts/primeiro-repasse.sql`.

No painel do Supabase, em Authentication → Sign In / Providers, desligue
"Allow new users to sign up": usuários entram só por convite.

## Estrutura

- `src/main` — processo principal: janela, bandeja, IPC validado com Zod, sessão cifrada (safeStorage)
- `src/preload` — `window.esteira`, a única ponte com o renderer
- `src/renderer` — telas (React, Tailwind, TanStack Query)
- `src/shared` — placa, documento (CPF/CNPJ alfanumérico), moeda, horas úteis, contrato de IPC
- `supabase/migrations` — schema, RLS e RPCs; `supabase/tests` — testes de banco
