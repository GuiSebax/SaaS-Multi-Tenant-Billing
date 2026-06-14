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

### Rodar a API compilada (sem watch)

```bash
docker compose up -d
docker stop saas-multi-tenant-billing-api-1
cd apps/api && node dist/main.js
```

### Notas de ambiente

- Variáveis de ambiente em `apps/api/.env` (não commitado); template em `apps/api/.env.example`.
- Dentro do Docker, os hostnames são `postgres` e `redis`. Fora do Docker, use `localhost`.
- `NODE_ENV=test` **não** desliga STRIPE\_\* no `envSchema` atual — todas as variáveis são obrigatórias. Ajustar `envSchema` em `src/config/env.config.ts` quando necessário.

Variáveis obrigatórias: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (min 32 chars), `JWT_REFRESH_SECRET` (min 32 chars), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`, `RESEND_API_KEY`.

Variáveis com default: `FRONTEND_URL` (default `http://localhost:3000`), `PORT` (default 3001), `CORS_ORIGIN` (default `http://localhost:3000`), `NODE_ENV` (default `development`).

Web app (`apps/web/.env.local`): `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api`).

Variáveis opcionais: `DATABASE_ADMIN_URL` (migration runner), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (OAuth — não implementado ainda).

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
- `invitations`: expira em 7 dias, `UNIQUE(organization_id, email)` para convites pendentes, campo `accepted_at` marca aceitação. O enum `invitation_role` só tem `'admin' | 'member'` — **não é possível convidar alguém como `'owner'`**.

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
- JWT: access token 15min, refresh token 7 dias com rotation. Access tokens incluem `jti: uuid` (gerado por `crypto.randomUUID()`) para unicidade e rastreabilidade de revogação.
- Ao usar refresh token: invalidar o atual, emitir novo. Se token já invalidado for usado: revogar toda a família.
- `TenantMiddleware` está registrado em `AppModule` via `.forRoutes(OrganizationsController, ProjectsController, ProjectTasksController, TasksController, BillingController)` — cobre todas as rotas tenant-scoped atuais. Ao adicionar novos controllers tenant-scoped, adicionar ao `.forRoutes()` correspondente.

### EmailModule / BullMQ

- Queue registrada com nome `'email'` (BullMQ via `BullModule.registerQueue`).
- Job name: `'send-invitation'` — processado por `EmailProcessor` em `modules/email/`.
- `EmailProcessor` envia emails reais via Resend. `RESEND_CLIENT` token injetado via `resend.provider.ts` — use `@Inject(RESEND_CLIENT)` para acessar o client. `from` atual: `onboarding@resend.dev` (domínio de dev Resend).
- Link de aceite gerado como `${FRONTEND_URL}/invitations/${token}/accept`.
- Para enfileirar: `@InjectQueue('email')` no service e `this.emailQueue.add('send-invitation', payload)`.
- O padrão BullMQ se aplica a **todos** os processamentos assíncronos do projeto (emails, webhooks Stripe).

### BillingModule e WebhooksModule

- Endpoints billing: `GET /billing/subscription`, `POST /billing/create-checkout-session`, `POST /billing/create-portal-session`.
- Endpoint webhook: `POST /webhooks/stripe` — `@Public()`, sem TenantGuard, sem TenantMiddleware.
- `STRIPE_CLIENT` token injetado via `stripe.provider.ts` — use `@Inject(STRIPE_CLIENT)` para acessar o client Stripe. `BillingModule` exporta `BillingService` e `stripeProvider` para uso no `WebhooksModule`.
- Convenção `pending_*` no `stripeCustomerId`: novos orgs são criados com `stripeCustomerId = 'pending_<orgId>'`. O Stripe customer real é criado lazily no primeiro checkout. Nunca criar Stripe customer fora do fluxo de checkout.
- `FRONTEND_URL` é usado para `success_url` e `cancel_url` nas sessions do Stripe — sempre vem do `ConfigService`.
- Checkout cria subscription com `trial_period_days: 14` por padrão.
- **Stripe SDK v22 e tipos**: `Stripe.Subscription`, `Stripe.Event` etc. **não existem** no namespace v22. Use tipos derivados do cliente: `type StripeSubscription = Awaited<ReturnType<StripeClient['subscriptions']['retrieve']>>`. Aplicar o mesmo padrão para `Event` (via `constructEvent`) e `CheckoutSession` (via `checkout.sessions.retrieve`).
- **`current_period_end` removido na API `2026-05-27.dahlia`**: o campo `currentPeriodEnd` da tabela existe mas não é populado pelos webhooks (nullable). Não tentar ler `subscription.current_period_end` — TypeScript vai reclamar e está correto.

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

### Frontend (M7) — Design system "Precision Dark"

Paleta de cores (use estes valores — não inventar outros):

| Elemento           | Valor                                      |
| ------------------ | ------------------------------------------ |
| Background raiz    | `#0A0A0B`                                  |
| Card/superfície    | `#111113` + borda `rgba(255,255,255,0.06)` |
| Input background   | `#0A0A0B` + borda `white/[0.08]`           |
| Input focus border | `indigo-500/60`                            |
| Botão primário     | `bg-indigo-500 hover:bg-indigo-600`        |
| Texto principal    | `white`                                    |
| Texto muted        | `zinc-400`                                 |
| Texto sutil        | `zinc-500`                                 |
| Placeholder        | `zinc-600`                                 |
| Erro               | `red-400`                                  |
| Link               | `indigo-400 hover:indigo-300`              |

Componentes de UI compartilhados ficam em `apps/web/components/`. Por enquanto existe:

- `components/auth/auth-card.tsx` — wrapper com motion entry animation (`framer-motion`) para páginas de auth.

Bibliotecas em uso no frontend:

- `@tanstack/react-query` — data fetching; todos os hooks usam `useQuery`/`useMutation`. `QueryClientProvider` está em `app/providers.tsx` com `staleTime: 60s` global. Ao trocar de organização (`switchOrg`), `queryClient.clear()` descarta todo o cache.
- `react-hook-form` + `@hookform/resolvers/zod` + `zod` — formulários com validação; padrão obrigatório para todo form.
- `framer-motion` — animações de entrada (ex: `AuthCard`).
- `sonner` — toasts; importar `{ toast }` de `sonner`.
- `lucide-react` — ícones.
- `axios` — cliente HTTP (ver abaixo).

#### API client (`apps/web/lib/axios.ts`)

- Instância `api` (export default) com `baseURL = NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'`.
- Interceptor de request injeta `Authorization: Bearer <token>` do `localStorage`.
- Interceptor de response: 401 fora de `/auth/*` → limpa tokens e redireciona para `/auth/login`; 403 com `PLAN_LIMIT_REACHED` → toast de upgrade automático.
- **Sempre importar `api` de `@/lib/axios`** — nunca criar instâncias axios avulsas.

#### Token storage (`apps/web/lib/auth.ts`)

- Tokens armazenados em `localStorage` (keys: `access_token`, `refresh_token`, `current_user`).
- Funções disponíveis: `getAccessToken()`, `getRefreshToken()`, `setTokens(access, refresh)`, `setUser({ name, email })`, `getUser()`, `clearTokens()`, `isAuthenticated()`.
- `clearTokens()` também remove `current_user` e `current_organization_id` — reseta toda a sessão.
- Todas as funções de leitura retornam `null`/`false` em SSR (guard `typeof window === 'undefined'`).

#### Convenções de rota (web)

- Landing: `app/page.tsx` — página de marketing completa (Navbar, Hero, Logos, Features, Pricing inline, CTA, Footer) fora de qualquer route group.
- Auth: `app/auth/login`, `app/auth/register` — layout em `app/auth/layout.tsx` (fundo `#0A0A0B`, logo centralizada, children centralizados).
- Dashboard: `app/(dashboard)/` — route group implementado: `/dashboard`, `/projects`, `/projects/[id]`, `/organizations`, `/settings/billing`. Layout com sidebar fixa 240px + header breadcrumb.
- Marketing: `app/(marketing)/` — route group (stub; apenas `/pricing` existe).
- Invitations: `app/invitations/[token]/accept/page.tsx` — fora de qualquer route group. Se o usuário não estiver autenticado, redireciona para `/auth/login?redirect=/invitations/${token}/accept`. A página de login lê o parâmetro `redirect` e redireciona após login bem-sucedido.

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
M2 — Auth              [x] Completo
M3 — Core Tenant       [x] Completo
M4 — Core do Produto   [x] Completo
M5 — Billing           [x] Completo
M6 — Observabilidade   [x] Completo
M7 — Frontend          [x] Completo
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
- PR 2.3: `JwtAuthGuard` global via `APP_GUARD`. Decorators `@Public()` e `@CurrentUser()`. JWT `jti` (UUID por token) para unicidade. Testes de integração de auth (`auth.integration.spec.ts`).

M3 concluído até agora:

- PR 3.1: `TenantGuard` e `RolesGuard`. Decorators `@RequireRole()`. Augmented `Request` type em `common/types/express-request.d.ts`.
- PR 3.2: `OrganizationsModule` — `POST /organizations` (create) e `GET /organizations` (list user's orgs). Usa `withoutTenantContext`.
- PR 3.3: convites de membros — `POST /organizations/:id/invitations` e `POST /invitations/:token/accept`. `EmailModule` com `EmailProcessor` (BullMQ, job `send-invitation`).
- PR 3.4: gestão de membros — `PATCH /organizations/:id/members/:userId` (promover role) e `DELETE /organizations/:id/members/:userId` (remover). Guard chain: `TenantGuard → RolesGuard → @RequireRole('owner','admin')`. Testes de integração de organizations (`organizations.integration.spec.ts`, 13 testes). Fix RLS: migration `0002_fix_invitations_policy.sql` separa SELECT (irrestrito, para aceite por token) de INSERT/UPDATE/DELETE (exige tenant context). `invite()` corrigido para usar `withTenantContext`; `acceptInvitation()` usa SELECT sem contexto + `withTenantContext` para UPDATE+INSERT.

M4 concluído até agora:

- PR 4.1: `ProjectsModule` — CRUD completo com RLS. `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id` (DELETE = archive, retorna 200). Enforcement de limite de plano via `PLAN_LIMITS` do shared: free=3 projetos, pro/enterprise=ilimitado. Erro 403 com body `{ error: 'PLAN_LIMIT_REACHED', resource, limit, current, upgrade_url }`.
- PR 4.2: `TasksModule` — CRUD completo com RLS e trigger. Dois controllers: `ProjectTasksController` (`GET/POST /projects/:projectId/tasks`) e `TasksController` (`PATCH /tasks/:id`, `PATCH /tasks/:id/move`, `PATCH /tasks/:id/assign`, `GET/POST /tasks/:taskId/comments`, `DELETE /tasks/:taskId/comments/:commentId`). INSERT não inclui `organization_id` (trigger preenche do `project_id`); workaround TypeScript: `as unknown as typeof tasks.$inferInsert`. `move()` suporta mover task entre projetos da mesma org (RLS valida destino). `assign()` verifica membership via `withoutTenantContext` antes do update. `position` calculada como `MAX(position) + 1` por projeto.

M5 concluído até agora:

- PR 5.1: `BillingModule` — `GET /billing/subscription`, `POST /billing/create-checkout-session`, `POST /billing/create-portal-session`. Stripe customer criado lazily no primeiro checkout (convenção `pending_*`). Trial de 14 dias.
- PR 5.2: `WebhooksModule` — `POST /webhooks/stripe` (raw body, validação de assinatura, enfileira em `stripe-webhooks`). `StripeWebhookProcessor` trata `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Idempotência via `processed_webhook_events`. `main.ts` com `bodyParser: false` + `raw()` para `/api/webhooks/stripe` + `json()` global.

M6 concluído até agora:

- PR 6.1: Observabilidade completa — `JsonLoggerService` (implementa `LoggerService`, JSON estruturado no stdout), `RequestIdMiddleware` (UUID por request via header `X-Request-Id` ou gerado), `LoggingInterceptor` (APP_INTERCEPTOR global, loga `{timestamp, level, request_id, tenant_id, user_id, method, path, status, duration_ms, query_count}`). Prometheus via `@willsoto/nestjs-prometheus` em `GET /api/metrics` (`http_request_duration_ms`, `plan_limit_reached_total`, `webhook_processing_duration_ms`, `bullmq_job_failed_total`). `HealthModule` em `GET /api/health` com checks reais de PostgreSQL e Redis (`{status, timestamp, services}`). Slow query log no `TenantDbService.inTransaction` (warn se > 100ms). `JwtAuthGuard` bypass para `/api/metrics`. Métricas criadas com `getSingleMetric` fallback para evitar conflito de registro entre suites de teste.

M7 concluído até agora:

- PR 7.1: Next.js setup — Geist font, shadcn/ui, axios instance (`@/lib/axios`), token storage (`@/lib/auth`), `PlanLimitErrorResponse` em `@saas-platform/shared`, estrutura de rotas (`app/auth/`, `app/(dashboard)/`, `app/(marketing)/`).
- PR 7.2: Páginas de auth — design system "Precision Dark" (fundo `#0A0A0B`, cards `#111113`, primário indigo-500). `AuthCard` com framer-motion. `/auth/login` e `/auth/register` com react-hook-form + zod + sonner. Interceptor axios: 401 → redirect login, 403 PLAN_LIMIT_REACHED → toast com ação upgrade. Login suporta `?redirect=` para retorno pós-autenticação.
- PR 7.3: Dashboard completo — layout com sidebar fixa 240px (`#111113`), workspace switcher (dropdown click-outside), nav com active state (indigo border-l-2 + bg), breadcrumb dinâmico, footer com avatar + logout. Páginas: `/dashboard` (stats cards + recent projects via `useQueries` paralelo), `/projects` (grid stagger +50ms, sheet new project, tooltip plan limit), `/projects/[id]` (kanban 3 colunas, inline task creation), `/organizations` (switch + sheet new org, auto-slug), `/settings/billing` (upgrade card ou manage portal). Hooks em `hooks/`: `useOrganization`, `useProjects`, `useProject`, `useCreateProject`, `useTasks`, `useCreateTask`. Componentes em `components/`: `PlanBadge` (free/pro/enterprise), `StatusDot`, `EmptyState`, `SkeletonCard`, `Sheet` (framer-motion drawer). Axios interceptor inclui `X-Organization-Id` do localStorage. `lib/auth.ts` agora exporta `setUser/getUser` para exibir nome no sidebar.
- PR 7.4: Emails reais via Resend (`resend.provider.ts`, `RESEND_CLIENT` token, `RESEND_API_KEY` obrigatória). Página de aceite de convite (`app/invitations/[token]/accept`).

PR atual: Etapa 8 — Produto real

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
- Não processar webhooks do Stripe de forma síncrono
- Não enviar `organization_id` no payload de criação de tasks/task_comments
- Não usar role superuser na connection string da aplicação
