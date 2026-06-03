# Projeto 1 — SaaS Multi-Tenant com Billing

## FASE 2 — Arquitetura Completa

---

## 1. Stack com Justificativa

### Frontend — Next.js 14+ com App Router

| Alternativa             | Por que não                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| Next.js Pages Router    | Em modo de manutenção; novo projeto não justifica                   |
| Remix                   | Bom para data loading, ecossistema menor                            |
| SPA pura (Vite + React) | Perde SSR para marketing pages e Server Components para performance |

**Justificativa:** Marketing site (landing, pricing, login) se beneficia de SSR. Dashboard usa Client Components onde necessário. Separação `app/(marketing)` e `app/(dashboard)` mapeia diretamente para os dois contextos do produto.

---

### Backend — NestJS modular por domínio

| Alternativa  | Por que não                                                                    |
| ------------ | ------------------------------------------------------------------------------ |
| Express puro | Sem estrutura forçada — múltiplos módulos viram bagunça sem disciplina severa  |
| Fastify      | Boa performance, ecossistema enterprise mais fraco                             |
| tRPC         | Acopla frontend e backend — dificulta expor API para outros clientes no futuro |

**Justificativa:** Organizado por domínio, não por camada técnica.

```
# Estrutura correta (por domínio)       # Estrutura errada (por camada)
modules/
  auth/                                 controllers/
  organizations/                        services/
  billing/                              repositories/
  projects/
  tasks/
```

Billing e organizations crescem em complexidade independentemente. Separar por camada cria acoplamento implícito entre domínios.

---

### Banco — PostgreSQL com RLS

| Alternativa | Por que não                                            |
| ----------- | ------------------------------------------------------ |
| MongoDB     | Sem RLS nativo; isolamento forte é mais difícil        |
| MySQL       | Sem RLS nativo, sem pgvector, JSON menos poderoso      |
| PlanetScale | Serverless MySQL — sem RLS, sem transactions completas |

---

### Cache e Jobs — Redis + BullMQ

Redis com dois propósitos (mesma instância, keyspaces separados):

- Cache de sessão e rate limiting por tenant
- BullMQ para jobs assíncronos (e-mails de convite, processamento de webhooks)

**Por que não processar webhooks síncronos:** endpoint do Stripe precisa responder em < 5s. Processamento pesado na fila garante resposta rápida e retry automático em falha.

---

## 2. Arquitetura Geral

```
┌─────────────────────────────────────────────────────┐
│                    Cliente                          │
│              Next.js App Router                     │
│   (marketing: SSR) │ (dashboard: Client Components) │
└──────────────┬──────────────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────────────┐
│                  NestJS API                         │
│                                                     │
│  TenantMiddleware → AuthGuard → TenantGuard         │
│                                                     │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │    Auth     │  │  Orgs    │  │   Billing     │  │
│  │   Module    │  │  Module  │  │    Module     │  │
│  └─────────────┘  └──────────┘  └───────────────┘  │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Projects   │  │  Tasks   │  │   Webhooks    │  │
│  │   Module    │  │  Module  │  │    Module     │  │
│  └─────────────┘  └──────────┘  └───────────────┘  │
└──────┬───────────────────┬───────────────┬──────────┘
       │                   │               │
┌──────▼──────┐   ┌────────▼──────┐  ┌────▼──────────┐
│  PostgreSQL │   │     Redis     │  │  BullMQ       │
│  + RLS      │   │  (cache +     │  │  Workers      │
│             │   │   sessions)   │  │  (email,      │
└─────────────┘   └───────────────┘  │   webhooks)   │
                                     └───────────────┘
                                             │
                                     ┌───────▼───────┐
                                     │    Stripe     │
                                     └───────────────┘
```

**Fluxo de um request autenticado:**

1. Request chega com `Authorization: Bearer <token>` e `X-Organization-Id`
2. `TenantMiddleware` extrai `organization_id` e seta `app.current_tenant_id` na conexão PostgreSQL
3. `AuthGuard` valida JWT e popula `req.user`
4. `TenantGuard` verifica que o usuário pertence à organização do request
5. RLS garante que todas as queries só enxergam dados daquele tenant
6. Response

---

## 3. Modelagem do Banco

### Estratégia de Multi-Tenancy

| Estratégia                 | Vantagem                              | Problema                                            |
| -------------------------- | ------------------------------------- | --------------------------------------------------- |
| Banco separado por tenant  | Isolamento total                      | Custo operacional alto, migrations complexas        |
| Schema separado por tenant | Bom isolamento                        | N connection pools, difícil de gerenciar            |
| **Shared schema + RLS**    | Operacionalmente simples, custo baixo | RLS mal configurado = risco; debugging mais difícil |

**Decisão: Shared schema + RLS.** Quando um tenant crescer a ponto de justificar schema dedicado, a migração é um problema conhecido e documentado. Começar com schemas separados por premissa de escala futura é over-engineering.

---

### Schema

```sql
-- Usuários (cross-tenant)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT,             -- NULL se só usa OAuth
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Organizações (tenants)
CREATE TABLE organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL, -- app.saas.com/[slug]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Membros com papel
CREATE TABLE organization_members (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at       TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

-- Billing (cache do estado do Stripe)
CREATE TABLE billing_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  plan                   TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
  status                 TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  trial_ends_at          TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- Projetos
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Tarefas
-- organization_id é redundante (derivável via project_id → projects.organization_id)
-- Justificativa: RLS exige coluna direta; queries de dashboard evitam joins
-- Consistência garantida via trigger (ver abaixo)
CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  assignee_id     UUID REFERENCES users(id),
  position        INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Comentários
-- organization_id redundante pelas mesmas razões que em tasks
-- Coberto pelo mesmo mecanismo de proteção
CREATE TABLE task_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Convites pendentes
CREATE TABLE invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  token           TEXT UNIQUE NOT NULL,
  invited_by      UUID REFERENCES users(id),
  expires_at      TIMESTAMPTZ NOT NULL,
  accepted_at     TIMESTAMPTZ,
  UNIQUE (organization_id, email)
);

-- Idempotência de webhooks
CREATE TABLE processed_webhook_events (
  event_id     TEXT PRIMARY KEY,  -- Stripe event ID
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

### Trigger — Garantia de Consistência do organization_id Redundante

```sql
-- Aplicado em tasks: sobrescreve organization_id sempre com o valor correto do projeto
CREATE OR REPLACE FUNCTION enforce_task_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id
  FROM projects
  WHERE id = NEW.project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project % not found', NEW.project_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_organization_id_consistency
  BEFORE INSERT OR UPDATE OF project_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_task_organization_id();

-- Mesmo padrão para task_comments: deriva de tasks, não de projects diretamente
CREATE OR REPLACE FUNCTION enforce_comment_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id
  FROM tasks
  WHERE id = NEW.task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task % not found', NEW.task_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_organization_id_consistency
  BEFORE INSERT OR UPDATE OF task_id ON task_comments
  FOR EACH ROW EXECUTE FUNCTION enforce_comment_organization_id();
```

**Regra na aplicação:** nunca enviar `organization_id` no payload de criação de tasks ou task_comments. O banco sempre deriva e sobrescreve.

---

### RLS

```sql
-- Habilitar em todas as tabelas tenant-scoped
ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations    ENABLE ROW LEVEL SECURITY;

-- Policies de isolamento
CREATE POLICY tenant_isolation ON projects
  USING (organization_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON tasks
  USING (organization_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON task_comments
  USING (organization_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON invitations
  USING (organization_id = current_setting('app.current_tenant_id')::UUID);

-- Role de aplicação: NUNCA superuser, NUNCA BYPASSRLS
CREATE ROLE app_user LOGIN PASSWORD '...' NOSUPERUSER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
```

**Como setar o tenant na aplicação:**

```sql
-- SEMPRE dentro de transação (SET LOCAL dura apenas pela transação)
BEGIN;
SET LOCAL app.current_tenant_id = '<uuid>';
-- queries aqui...
COMMIT;

-- NUNCA usar SET SESSION em ambiente com connection pool
-- conexões são reutilizadas; SET SESSION vaza o tenant para o próximo request
```

---

### Índices

```sql
-- Listagem de projetos ativos (query mais frequente do dashboard)
CREATE INDEX idx_projects_org_status
  ON projects(organization_id, status)
  WHERE status = 'active';  -- índice parcial: projetos arquivados raramente consultados

-- Tarefas por projeto (board view)
CREATE INDEX idx_tasks_project
  ON tasks(project_id, status, position);

-- Tarefas atribuídas ao usuário
CREATE INDEX idx_tasks_assignee
  ON tasks(organization_id, assignee_id)
  WHERE assignee_id IS NOT NULL;

-- "Minhas organizações" na troca de workspace
CREATE INDEX idx_members_user
  ON organization_members(user_id);

-- Feed de atividade recente
CREATE INDEX idx_tasks_updated
  ON tasks(organization_id, updated_at DESC);
```

---

## 4. Fluxos Críticos

### Upgrade de Plano

```
Usuário clica "Upgrade para Pro"
  │
  ▼
POST /billing/create-checkout-session
  │
  ▼
BillingService:
  1. Busca ou cria stripe_customer_id
  2. Cria Checkout Session com metadata: { organization_id }
  3. Retorna session URL
  │
  ▼
Stripe Checkout (redirecionamento)
  │
  ▼
Stripe dispara: checkout.session.completed
  │
  ▼
POST /webhooks/stripe
  1. Valida stripe-signature
  2. Publica no BullMQ
  3. Responde 200 imediatamente
  │
  ▼
StripeWebhookProcessor (worker):
  1. BEGIN TRANSACTION
  2. INSERT INTO processed_webhook_events (event_id) ON CONFLICT DO NOTHING
  3. Se 0 rows → duplicata → ROLLBACK, encerra
  4. Extrai organization_id do metadata
  5. UPDATE billing_subscriptions SET plan='pro', status='active'
  6. COMMIT
  │
  ▼
Próximo request do tenant já enxerga plano 'pro'
```

### Enforcement de Limites de Plano

```
POST /projects (org no plano free, já tem 3 projetos)
  │
  ▼
ProjectsService.create():
  1. Busca billing_subscription da org
  2. Conta projetos ativos
  3. Plano free + count >= 3 → lança PlanLimitException
  │
  ▼
Response HTTP 403:
{
  "error": "PLAN_LIMIT_REACHED",
  "resource": "projects",
  "limit": 3,
  "current": 3,
  "upgrade_url": "/settings/billing"
}
  │
  ▼
Frontend exibe modal de upgrade
```

**Por que no service e não em middleware:** limites são por tipo de recurso e dependem do contexto. Middleware genérico replicaria lógica de negócio.

---

## 5. Pontos de Falha e Mitigações

| Ponto de Falha                                      | Cenário                                   | Mitigação                                            |
| --------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| Webhook do Stripe não entrega                       | Stripe tenta por 72h com backoff          | Idempotência garante reprocessamento seguro          |
| Worker BullMQ cai no meio do job                    | Job fica "active" indefinidamente         | `stalledInterval` do BullMQ recoloca na fila         |
| `current_tenant_id` não setado                      | Query sem contexto de tenant              | RLS bloqueia tudo — melhor quebrar do que vazar      |
| Connection pool reutiliza conexão com tenant errado | `SET SESSION` vaza entre requests         | **Sempre `SET LOCAL` dentro de transação explícita** |
| Race condition no check de limite de plano          | Dois requests simultâneos passam no check | `SELECT COUNT(*) FOR UPDATE` na billing_subscription |
| Rate limit do Stripe na criação de customers        | Alto volume de signups                    | BullMQ com concurrency limitada no worker de billing |

---

## 6. Observabilidade

### Estrutura de Log (JSON estruturado — obrigatório)

```json
{
  "timestamp": "2026-01-15T10:30:00Z",
  "level": "info",
  "request_id": "uuid",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "method": "POST",
  "path": "/projects",
  "status": 201,
  "duration_ms": 45,
  "query_count": 3,
  "slow_queries": []
}
```

### O que logar obrigatoriamente

- Toda requisição: `tenant_id`, `user_id`, `duration_ms`, `status`
- Queries > 100ms: SQL anonimizado, duração
- Eventos de billing: toda mudança de plano com `event_id` do Stripe
- Erros de autenticação e tenant mismatch (potencial ataque)

### Métricas (Prometheus-compatible)

- `http_request_duration_ms` por rota e status
- `billing_plan_upgrades_total`
- `plan_limit_reached_total` por recurso — revela fricção de conversão
- `webhook_processing_duration_ms`
- `bullmq_job_failed_total` por job type

### Tracing

OpenTelemetry com trace propagado do NestJS até as queries do PostgreSQL.
Sem isso: você vê latência alta mas não sabe se é código ou banco.

---

## 7. Segurança

### JWT e Refresh Token Rotation

- Access token: 15 minutos
- Refresh token: 7 dias, armazenado hasheado no banco
- Ao usar refresh token: token atual é invalidado, novo é emitido
- Se token já invalidado é usado novamente: toda a família é revogada (sinal de comprometimento)

### Autorização em Camadas

1. `AuthGuard` — token válido?
2. `TenantGuard` — usuário pertence a essa organização?
3. `RolesGuard` — papel suficiente para essa ação?
4. RLS no banco — barreira final, independente da aplicação

### Rate Limiting

- Por IP: 100 req/min para endpoints públicos (login, signup)
- Por tenant: 1000 req/min para endpoints autenticados
- Implementado com `@nestjs/throttler` + Redis store

---

## 8. ADRs — Architecture Decision Records

### ADR-001: Shared Schema com RLS em vez de Schema por Tenant

**Contexto:** Precisamos isolar dados entre tenants num banco compartilhado.

**Decisão:** Shared schema com Row Level Security do PostgreSQL.

**Alternativas rejeitadas:** Schema por tenant.

**Motivo da rejeição:** Requer N connection pools (um por schema ativo), migrations coordenadas em todos os schemas, e dificulta queries cross-tenant para analytics. Custo operacional não justificado no estágio atual.

**Consequências:** Debugging de RLS é mais difícil. `SET LOCAL app.current_tenant_id` deve acontecer dentro de transação — regra obrigatória de onboarding para qualquer dev que toque no projeto.

**Revisão:** Se um único tenant ultrapassar 1M de tarefas ou 10k usuários, avaliar migração para schema dedicado.

---

### ADR-002: Processamento Assíncrono de Webhooks via BullMQ

**Contexto:** Webhooks do Stripe precisam de resposta < 5s. Processamento inclui múltiplas queries e pode incluir envio de e-mail.

**Decisão:** Endpoint recebe, valida assinatura, publica na fila BullMQ, responde 200 imediatamente.

**Consequências:** Latência eventual entre pagamento e atualização do plano (segundos). Aceitável para esse caso de uso. Em troca: resiliência a falhas, retry automático, processamento rastreável.

---

### ADR-003: organization_id Redundante em tasks e task_comments

**Contexto:** `tasks.organization_id` é derivável via `project_id → projects.organization_id`. Manter é redundância.

**Decisão:** Manter `organization_id` redundante em ambas as tabelas.

**Motivo:** RLS exige coluna direta na tabela para funcionar eficientemente (joins em RLS policy degradam performance). Queries de dashboard evitam joins desnecessários.

**Garantia de consistência:** Trigger `BEFORE INSERT OR UPDATE` sobrescreve `organization_id` com o valor correto derivado do `project_id`. A aplicação nunca envia `organization_id` nessas tabelas. Cobre tanto `tasks` quanto `task_comments`.

---
