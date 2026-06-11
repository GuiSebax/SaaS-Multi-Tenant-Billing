-- =============================================================================
-- 0003_fix_task_comments_cascade.down.sql
-- Reverts the ON DELETE CASCADE added in 0003_fix_task_comments_cascade.sql,
-- restoring the original FK with no cascade behaviour.
-- =============================================================================

ALTER TABLE task_comments
  DROP CONSTRAINT task_comments_task_id_tasks_id_fk;

ALTER TABLE task_comments
  ADD CONSTRAINT task_comments_task_id_tasks_id_fk
  FOREIGN KEY (task_id) REFERENCES tasks(id);
