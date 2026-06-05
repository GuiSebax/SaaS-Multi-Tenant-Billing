-- =============================================================================
-- 0001_rls_and_triggers.sql
-- Manual migration — never generate with drizzle-kit.
-- Applies RLS, FORCE RLS, tenant isolation policies, org_id triggers, indexes.
-- =============================================================================

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects      FORCE  ROW LEVEL SECURITY;

ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks         FORCE  ROW LEVEL SECURITY;

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments FORCE  ROW LEVEL SECURITY;

ALTER TABLE invitations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations   FORCE  ROW LEVEL SECURITY;

-- ── Tenant isolation policies ─────────────────────────────────────────────────
-- NULLIF handles the empty string returned by current_setting when the GUC is
-- unset on the current connection (reverts to '' after SET LOCAL is discarded
-- on COMMIT). NULL::UUID comparison evaluates to NULL → no rows are visible.

CREATE POLICY tenant_isolation ON projects
  USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation ON tasks
  USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation ON task_comments
  USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation ON invitations
  USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- ── Trigger: derive tasks.organization_id from project ───────────────────────
-- The application never sends organization_id in task payloads.
-- This trigger overwrites it on every INSERT and on UPDATE of project_id.
-- Runs as SECURITY INVOKER (app_user), so the SELECT on projects is
-- subject to projects' RLS — cross-tenant project references are rejected.

CREATE OR REPLACE FUNCTION enforce_task_organization_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT p.organization_id INTO v_org_id
    FROM projects p
   WHERE p.id = NEW.project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project % not found', NEW.project_id;
  END IF;

  NEW.organization_id := v_org_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_enforce_org_id
  BEFORE INSERT OR UPDATE OF project_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_task_organization_id();

-- ── Trigger: derive task_comments.organization_id from task ──────────────────

CREATE OR REPLACE FUNCTION enforce_comment_organization_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT t.organization_id INTO v_org_id
    FROM tasks t
   WHERE t.id = NEW.task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'task % not found', NEW.task_id;
  END IF;

  NEW.organization_id := v_org_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_comments_enforce_org_id
  BEFORE INSERT OR UPDATE OF task_id ON task_comments
  FOR EACH ROW EXECUTE FUNCTION enforce_comment_organization_id();

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Listagem de projetos ativos (query mais frequente do dashboard)
CREATE INDEX idx_projects_org_status ON projects (organization_id, status) WHERE status = 'active';

-- Board view: tarefas de um projeto ordenadas por posição
CREATE INDEX idx_tasks_project ON tasks (project_id, status, position);

-- Tarefas atribuídas ao usuário (parcial: ignora não-atribuídas)
CREATE INDEX idx_tasks_assignee ON tasks (organization_id, assignee_id) WHERE assignee_id IS NOT NULL;

-- "Minhas organizações" na troca de workspace
CREATE INDEX idx_members_user ON organization_members (user_id);

-- Feed de atividade recente
CREATE INDEX idx_tasks_updated ON tasks (organization_id, updated_at DESC);
