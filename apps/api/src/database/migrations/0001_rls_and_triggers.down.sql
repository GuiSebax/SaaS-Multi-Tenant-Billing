-- =============================================================================
-- 0001_rls_and_triggers.down.sql
-- Rollback for 0001_rls_and_triggers.sql
-- =============================================================================

-- ── Indexes ───────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS idx_tasks_updated;
DROP INDEX IF EXISTS idx_members_user;
DROP INDEX IF EXISTS idx_tasks_assignee;
DROP INDEX IF EXISTS idx_tasks_project;
DROP INDEX IF EXISTS idx_projects_org_status;

-- ── Triggers (before functions — triggers depend on functions) ────────────────

DROP TRIGGER IF EXISTS trg_task_comments_enforce_org_id ON task_comments;
DROP TRIGGER IF EXISTS trg_tasks_enforce_org_id ON tasks;

-- ── Functions ─────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS enforce_comment_organization_id();
DROP FUNCTION IF EXISTS enforce_task_organization_id();

-- ── Policies ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tenant_isolation ON invitations;
DROP POLICY IF EXISTS tenant_isolation ON task_comments;
DROP POLICY IF EXISTS tenant_isolation ON tasks;
DROP POLICY IF EXISTS tenant_isolation ON projects;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE invitations   NO FORCE ROW LEVEL SECURITY;
ALTER TABLE invitations   DISABLE  ROW LEVEL SECURITY;

ALTER TABLE task_comments NO FORCE ROW LEVEL SECURITY;
ALTER TABLE task_comments DISABLE  ROW LEVEL SECURITY;

ALTER TABLE tasks         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks         DISABLE  ROW LEVEL SECURITY;

ALTER TABLE projects      NO FORCE ROW LEVEL SECURITY;
ALTER TABLE projects      DISABLE  ROW LEVEL SECURITY;
