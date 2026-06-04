# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## O que é este projeto

Plataforma de gestão de projetos B2B (Notion/Linear simplificado) com multi-tenancy real,
billing via Stripe e isolamento de dados garantido em nível de banco via PostgreSQL RLS.

Construído como projeto de portfólio nível pleno — cada decisão tem justificativa documentada.

---

## Documentação de referência

Antes de qualquer implementação, leia:

- `docs/architecture/ESCOPO_PROJETO.md` — problema, requisitos funcionais/não funcionais, limitações
- `docs/architecture/ARQUITETURA.md` — stack, modelagem, fluxos críticos, ADRs

Se houver conflito entre este arquivo e os docs acima, os docs acima prevalecem.

---

## Comandos de desenvolvimento

### Setup inicial

```bash
pnpm install
cp apps/api/.env.example apps/api/.env  # preencher valores reais
make up                                  # sobe PostgreSQL + Redis via Docker
```

### Dev (monorepo completo)

```bash
pnpm dev          # inicia api (porta 3001) + web (porta 3000) em paralelo via Turbo
pnpm build        # build de todos os packages e apps (respeita ordem de dependência)
pnpm lint         # lint em todos os workspaces
pnpm test         # testes em todos os workspaces
```

### Filtros por app/package

```bash
pnpm --filter @saas-platform/api dev
pnpm --filter @saas-platform/api test
pnpm --filter @saas-platform/api test -- --testPathPattern=auth
pnpm --filter @saas-platform/web dev
```

### Docker / banco

```bash
make up     # docker compose up -d
make down   # docker compose down
make logs   # docker compose logs -f
make psql   # psql como app_user no saas_dev
```

### Notas de ambiente

- Variáveis de ambiente em `apps/api/.env` (não commitado); template em `apps/api/.env.example`.
- Dentro do Docker, os hostnames são `postgres` e `redis`. Fora do Docker, use `localhost`.
- `NODE_ENV=test` desliga a validação de `STRIPE_*` se necessário para testes locais (ajustar `envSchema` conforme evoluir).

---

## Path aliases (API)

O `tsconfig.json` do `apps/api` define os seguintes aliases — use-os, nunca caminhos relativos longos:

| Alias | Aponta para |
|---|---|
| `@modules/*` | `src/modules/*` |
| `@common/*` | `src/common/*` |
| `@database/*` | `src/database/*` |
| `@config/*` | `src/config/*` |
| `@saas-platform/shared` | `packages/shared/src` |

O `tsc-alias` resolve os aliases no build — o passo `nest build && tsc-alias` é obrigatório.

---

## Stack

| Camada        | Tecnologia                                            |
| ------------- | ----------------------------------------------------- |
| Frontend      | Next.js 14+ com App Router                            |
| Backend       | NestJS — módulos por domínio (não por camada técnica) |
| Banco         | PostgreSQL 16 com RLS habilitado                      |
| ORM           | **Drizzle** (não TypeORM) — controle explícito de SQL |
| Cache / Filas | Redis + BullMQ                                        |
| Billing       | Stripe (Checkout + Webhooks + Customer Portal)        |
| Auth          | JWT (access 15min) + Refresh Token Rotation (7 dias)  |

---

## Estrutura do projeto

```
saas-platform/
├── apps/
│   ├── api/               → NestJS
│   │   └── src/
│   │       ├── modules/   → por domínio: auth, organizations, billing, projects, tasks, webhooks
│   │       ├── common/    → decorators, filters, guards, interceptors, middleware
│   │       ├── database/  → schema Drizzle, migrations SQL, TenantDbService
│   │       └── config/
│   └── web/               → Next.js App Router
│       └── app/
│           ├── (marketing)/
│           └── (dashboard)/
├── packages/
│   └── shared/            → tipos e DTOs compartilhados
├── docs/
│   └── architecture/
│       ├── ESCOPO_PROJETO.md
│       └── ARQUITETURA.md
├── docker-compose.yml
├── CLAUDE.md              → este arquivo
└── Makefile
```

Portas: API em `3001` com prefixo global `/api` (todas as rotas são `/api/...`), Web em `3000`.

O Turbo garante que `packages/shared` seja buildado antes de `apps/api` e `apps/web` — nunca importe de `packages/shared/src` diretamente em produção; use o alias ou o pacote publicado.

---

## Regras inegociáveis — leia antes de gerar qualquer código

### Banco e RLS

- **Drizzle é o ORM.** Nunca usar TypeORM, Prisma ou qualquer outro.
- **`SET LOCAL` sempre dentro de transação explícita.** Nunca `SET SESSION` — em connection pool, vaza o tenant para o próximo request.
- O método correto é `TenantDbService.withTenantContext(tenantId, async (tx) => { ... })`.
- **Nunca enviar `organization_id` no payload de tasks ou task_comments.** O banco deriva via trigger.
- Migrations de RLS, policies e triggers são **arquivos SQL manuais** em `src/database/migrations/` — nunca gerados pelo drizzle-kit.
- A role de banco da aplicação é `app_user` — sem SUPERUSER, sem BYPASSRLS.

### Módulos NestJS

- Estrutura **por domínio**, nunca por camada técnica.
  - ✅ `modules/projects/projects.controller.ts`
  - ❌ `controllers/projects.controller.ts`
- Cada módulo tem seu próprio controller, service e repository internamente.

### Autenticação e autorização

- Pipeline de guards em toda rota autenticada: `AuthGuard → TenantGuard → RolesGuard`
- JWT: access token 15min, refresh token 7 dias com rotation.
- Ao usar refresh token: invalidar o atual, emitir novo. Se token já invalidado for usado: revogar toda a família.

### Webhooks Stripe

- Endpoint **sempre** responde 200 imediatamente após validar assinatura.
- Processamento vai para BullMQ — nunca síncrono.
- Idempotência via `INSERT INTO processed_webhook_events (event_id) ON CONFLICT DO NOTHING` **dentro da mesma transação** do processamento.

### Testes

- Testes de integração usam banco real (PostgreSQL rodando via Docker) — nunca mock de banco.
- O teste mais crítico do projeto: token da org A não acessa dados da org B em nenhum endpoint.
- Arquivos de teste de integração: `*.integration.spec.ts`

### Logs

- Todo log deve ter `request_id`, `tenant_id`, `user_id` em formato JSON estruturado.
- Queries > 100ms: logar SQL anonimizado + duração.

---

## Planos e limites

| Plano      | Membros   | Projetos  |
| ---------- | --------- | --------- |
| free       | 3         | 3         |
| pro        | 25        | ilimitado |
| enterprise | ilimitado | ilimitado |

Erro ao atingir limite:

```json
{
  "error": "PLAN_LIMIT_REACHED",
  "resource": "projects",
  "limit": 3,
  "current": 3,
  "upgrade_url": "/settings/billing"
}
```

---

## Milestones e estado atual

```
M1 — Fundação          [ ] Em andamento
M2 — Auth              [ ] Pendente
M3 — Core Tenant       [ ] Pendente
M4 — Core do Produto   [ ] Pendente
M5 — Billing           [ ] Pendente
M6 — Observabilidade   [ ] Pendente
M7 — Frontend          [ ] Pendente
```

**Atualize este bloco manualmente conforme os milestones forem concluídos.**
Marque `[x]` quando o milestone estiver completo e anote o PR atual abaixo:

```
PR atual: 1.4 - Drizzle Setup + Conexão com Tenant Context
```

---

## Como retomar uma sessão interrompida

Se o contexto desta sessão foi perdido (Claude Code reiniciado):

1. Execute `/init` para ler a estrutura do projeto
2. Diga: "Estamos no PR [número] do milestone [M1/M2/etc]. Leia o CLAUDE.md e os docs de arquitetura antes de continuar."
3. Não recomece do zero — o código já existente é fonte de verdade do estado atual.

---

## O que nunca fazer (geração de código proibida)

- Não gerar `SET SESSION` para tenant context
- Não gerar migrations com drizzle-kit para RLS/triggers/policies
- Não organizar código por camada técnica (controllers/, services/ na raiz)
- Não mockar o banco em testes de integração
- Não processar webhooks do Stripe de forma síncrona
- Não enviar `organization_id` no payload de criação de tasks/task_comments
- Não usar role superuser na connection string da aplicação
