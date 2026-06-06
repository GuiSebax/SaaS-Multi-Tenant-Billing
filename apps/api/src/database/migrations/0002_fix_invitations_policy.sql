-- =============================================================================
-- 0002_fix_invitations_policy.sql
-- Splits the single tenant_isolation policy on invitations into per-command
-- policies. SELECT is unrestricted so that acceptInvitation can look up an
-- invitation by token without knowing the organization ID upfront (the random
-- UUID token is the authorization). INSERT, UPDATE, and DELETE remain
-- tenant-scoped.
-- =============================================================================

DROP POLICY tenant_isolation ON invitations;

-- Any app_user can read any invitation row — the token is the access control.
CREATE POLICY invitations_select ON invitations
  FOR SELECT
  USING (true);

-- Only the owning tenant may create invitations.
CREATE POLICY invitations_insert ON invitations
  FOR INSERT
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );

-- Only the owning tenant may update invitations (e.g. mark accepted_at).
CREATE POLICY invitations_update ON invitations
  FOR UPDATE
  USING  (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Only the owning tenant may delete invitations.
CREATE POLICY invitations_delete ON invitations
  FOR DELETE
  USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
