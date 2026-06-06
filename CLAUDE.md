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
pnpm typecheck    # typecheck em todos os workspaces (sem emit)
pnpm test         # testes unitários em todos os workspaces
pnpm seed         # popula o banco com dados realistas (14 usuários, 3 orgs, ~300 tasks)
```

### Filtros por app/package

```bash
pnpm --filter @saas-platform/api dev
pnpm --filter @saas-platform/api test                          # unitários (*.spec.ts, exclui *.integration.spec.ts)
pnpm --filter @saas-platform/api test:integration              # integração com banco real (*.integration.spec.ts, timeout 30s)
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
- `NODE_ENV=test` **não** desliga STRIPE\_\* no `envSchema` atual — todas as variáveis são obrigatórias. Ajustar `envSchema` em `src/config/env.config.ts` quando necessário.

Variáveis obrigatórias: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (min 32 chars), `JWT_REFRESH_SECRET` (min 32 chars), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

---

## Migrações SQL manuais

`MigrationRunnerService` roda automaticamente no `onModuleInit` quando `DATABASE_ADMIN_URL` está definido. Ele executa arquivos `.sql` (excluindo `.down.sql`) de `src/database/migrations/` em ordem alfabética, controlando quais já foram aplicados via tabela `_migrations` (criada pelo próprio serviço usando a conexão admin).

Dois tipos de migração convivem no projeto:

- **drizzle-kit push** — aplica o schema Drizzle (DDL: `CREATE TABLE`, tipos, etc.) como superuser. Usado no CI e no setup inicial.
- **SQL manuais** (`0001_rls_and_triggers.sql`) — RLS, `FORCE ROW SECURITY`, policies, triggers, indexes. Nunca gerados pelo drizzle-kit; rodados pelo `MigrationRunnerService` (ou manualmente via `psql`).

Downgrade: `src/database/migrations/0001_rls_and_triggers.down.sql` existe mas não é aplicado automaticamente.

---

## `packages/shared` — exports

Importar via alias `@saas-platform/shared` (nunca `packages/shared/src` diretamente):

- **Types**: `Plan`, `Organization`, `User`, `OrganizationMember`
- **Constants**: `PLAN_LIMITS` (objeto com `free/pro/enterprise → { members, projects }`), `JWT_ACCESS_TOKEN_EXPIRY` (`'15m'`), `JWT_REFRESH_TOKEN_EXPIRY` (`'7d'`)

---

## Error response shape

Toda exceção é capturada pelo `HttpExceptionFilter` global e normalizada para:

```json
{
  "error": "HttpExceptionName | InternalServerError",
  "message": "...",
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/..."
}
```

---

## Path aliases (API)

O `tsconfig.json` do `apps/api` define os seguintes aliases — use-os, nunca caminhos relativos longos:

| Alias                   | Aponta para           |
| ----------------------- | --------------------- |
| `@modules/*`            | `src/modules/*`       |
| `@common/*`             | `src/common/*`        |
| `@database/*`           | `src/database/*`      |
| `@config/*`             | `src/config/*`        |
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
- `TenantDbService.withoutTenantContext()` é o método correto para operações sem tenant (criar organização, operações de auth). **Nunca usar `DRIZZLE_DB` injetado diretamente para operações tenant-scoped.**
- `DRIZZLE_DB` token (`@Inject(DRIZZLE_DB)`): apenas para queries cross-tenant administrativas. Para tudo tenant-scoped: `TenantDbService.withTenantContext()`.
- **Nunca enviar `organization_id` no payload de tasks ou task_comments.** O banco deriva via trigger.
- Migrations de RLS, policies e triggers são **arquivos SQL manuais** em `src/database/migrations/` — nunca gerados pelo drizzle-kit.
- A role de banco da aplicação é `app_user` — sem SUPERUSER, sem BYPASSRLS.
- **Toda tabela tenant-scoped exige `FORCE ROW SECURITY` além de `ENABLE ROW LEVEL SECURITY`.** Sem isso, o owner da tabela bypassa o RLS silenciosamente.
- Contrato HTTP de tenant: header `X-Organization-Id: <uuid>` obrigatório em toda rota tenant-scoped. `TenantMiddleware` lê esse header e popula `req.organizationId`. `TenantGuard` (M2) valida que o usuário pertence à organização.
- **GUC de tenant**: `app.current_tenant_id` — este é o nome exato do parâmetro PostgreSQL usado nas RLS policies (`current_setting('app.current_tenant_id', true)`). Definido via `set_config('app.current_tenant_id', tenantId, true)` pelo `TenantDbService`.

### Schema Drizzle (`src/database/schema/`)

Arquivos por domínio (não por módulo NestJS):

| Arquivo            | Tabelas                                                |
| ------------------ | ------------------------------------------------------ |
| `users.ts`         | `users`                                                |
| `organizations.ts` | `organizations`, `organization_members`, `invitations` |
| `projects.ts`      | `projects`                                             |
| `tasks.ts`         | `tasks`, `task_comments`                               |
| `billing.ts`       | `billing_subscriptions`                                |
| `auth.ts`          | `refresh_tokens`, `processed_webhook_events`           |
| `relations.ts`     | Todas as relações Drizzle (sem DDL)                    |
| `index.ts`         | Re-exporta tudo — sempre importe de `@database/schema` |

Notas de design:

- `tasks.organization_id` e `task_comments.organization_id` existem no schema Drizzle mas são **somente leitura** — preenchidos por trigger, nunca inseridos via aplicação.
- `billing_subscriptions` tem `organization_id` com `.unique()` — garante 1 subscription por organização no nível de banco.
- `processed_webhook_events` fica em `auth.ts` (junto com `refresh_tokens`) — ambos são tabelas de controle de sessão/idempotência sem RLS.

### Módulos NestJS

- Estrutura **por domínio**, nunca por camada técnica.
  - ✅ `modules/projects/projects.controller.ts`
  - ❌ `controllers/projects.controller.ts`
- Cada módulo tem seu próprio controller, service e repository internamente.

### Autenticação e autorização

- Pipeline de guards em toda rota autenticada: `JwtAuthGuard → TenantGuard → RolesGuard`
- `JwtAuthGuard` está registrado como `APP_GUARD` global — **todas as rotas são protegidas por padrão**. Use `@Public()` para opt-out em rotas públicas (register, login, refresh).
- `@CurrentUser()` — param decorator que extrai `{ userId: string }` do JWT payload já validado. Disponível em qualquer rota autenticada.
- `TenantGuard` e `RolesGuard` **não são globais** — devem ser aplicados explicitamente com `@UseGuards(TenantGuard, RolesGuard)` nas rotas tenant-scoped. `TenantGuard` verifica membership e popula `req.member: { organizationId, userId, role }`. `RolesGuard` lê o decorator `@RequireRole()`.
- `@RequireRole('owner', 'admin')` — restringe rota a roles específicos. Sem o decorator, `RolesGuard` deixa passar qualquer membro.
- JWT: access token 15min, refresh token 7 dias com rotation.
- Ao usar refresh token: invalidar o atual, emitir novo. Se token já invalidado for usado: revogar toda a família.
- `TenantMiddleware` está definido em `AppModule` mas atualmente com `.forRoutes()` vazio — deve ser populado com as rotas tenant-scoped conforme os módulos forem adicionados em M3+.

### Webhooks Stripe

- Endpoint **sempre** responde 200 imediatamente após validar assinatura.
- Processamento vai para BullMQ — nunca síncrono.
- Idempotência via `INSERT INTO processed_webhook_events (event_id) ON CONFLICT DO NOTHING` **dentro da mesma transação** do processamento.

### Testes

- Testes de integração usam banco real (PostgreSQL rodando via Docker) — nunca mock de banco.
- O teste mais crítico do projeto: token da org A não acessa dados da org B em nenhum endpoint.
- Arquivos de teste de integração: `*.integration.spec.ts`

#### Variáveis de ambiente para testes de integração

```
DATABASE_URL=postgresql://app_user:dev_password@localhost:5432/saas_dev      # app_user — NOSUPERUSER NOBYPASSRLS
DATABASE_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/saas_dev    # superuser — usado apenas em beforeAll/afterAll para setup do schema de teste
```

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
M1 — Fundação          [x] Completo
M2 — Auth              [ ] Em andamento
M3 — Core Tenant       [ ] Pendente
M4 — Core do Produto   [ ] Pendente
M5 — Billing           [ ] Pendente
M6 — Observabilidade   [ ] Pendente
M7 — Frontend          [ ] Pendente
```

**Atualize este bloco manualmente conforme os milestones forem concluídos.**
Marque `[x]` quando o milestone estiver completo.

M1 concluído até agora:

- PRs 1.1–1.5: monorepo, Docker, Makefile, Drizzle + DatabaseModule, TenantDbService (withTenantContext/withoutTenantContext), TenantMiddleware, schema completo (users, orgs, projects, tasks, billing, auth).
- PR 1.6: Migrations SQL manuais (`0001_rls_and_triggers.sql`) — RLS, FORCE ROW LEVEL SECURITY, policies, triggers (organization_id derivado em tasks/task_comments), indexes de performance.
- PR 1.7: CI/CD GitHub Actions (lint/typecheck, test-api com PostgreSQL+Redis reais, build). Jest separado: unitário (`jest.config.ts`) e integração (`jest.integration.config.ts`, 30s timeout).
- PR 1.8: Seed realista e idempotente — 14 usuários, 3 orgs, billing, 16 memberships, 16 projetos, ~300 tasks, ~150 comments. `pnpm seed` na raiz.

M2 concluído até agora:

- PR 2.1: `AuthModule` com `POST /auth/register` e `POST /auth/login` — bcrypt, JWT access + refresh token emitidos.
- PR 2.2: `POST /auth/refresh` (rotation) e `POST /auth/logout` (revogação de família ao detectar roubo).
- PR 2.3: `JwtAuthGuard` global via `APP_GUARD`. Decorators `@Public()` e `@CurrentUser()`.

```
PR atual: M2 - 2.4 - TenantGuard + RolesGuard
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

## Rodar o projeto da api

```
docker compose up -d
docker stop saas-multi-tenant-billing-api-1
cd apps\api && node dist/main.js
```
