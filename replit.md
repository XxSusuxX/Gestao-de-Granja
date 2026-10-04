# Gestão da Granja

Sistema mobile-first para pequenos criadores de galinhas controlarem estoque, movimentações e contas com poucos toques.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/gestao-granja` — interface web responsiva e fluxos principais
- `artifacts/api-server/src/routes/farm.ts` — operações da granja
- `lib/api-spec/openapi.yaml` — contrato da API e origem do codegen
- `lib/db/src/schema/` — tabelas de produtos, movimentações e contas

## Architecture decisions

- Estoque é atualizado por movimentações de entrada e saída; não permitir saída maior que o saldo.
- Valores financeiros são guardados em centavos para evitar erros de arredondamento.
- Os números anotados à mão nas fotos são referências não confirmadas e não devem ser cadastrados como dados reais.

## Product

- Visão geral com ações rápidas, alertas de estoque mínimo e totais em aberto.
- Cadastro de produtos e histórico de entradas/saídas; opções rápidas incluem ração, milho, soja, núcleo, sal, calcário e remédios.
- Contas a pagar e a receber, com vencimento, edição e marcação como resolvida.

## User preferences

- Os clientes pediram botões intuitivos e o mínimo possível de digitação.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
