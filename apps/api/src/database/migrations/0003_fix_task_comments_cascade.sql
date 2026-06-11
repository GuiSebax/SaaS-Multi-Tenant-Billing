-- =============================================================================
-- 0003_fix_task_comments_cascade.sql
-- Manual migration — never generate with drizzle-kit.
-- Fixes the foreign key on task_comments.task_id to include ON DELETE CASCADE.
-- The Drizzle schema already declares this cascade, but the constraint in the
-- live database was created without it (drizzle-kit push does not alter
-- existing FK definitions). Dropping and re-adding the constraint brings the
-- live schema into sync with the declared schema so that deleting a task also
-- removes its comments automatically.
-- =============================================================================

ALTER TABLE task_comments
  DROP CONSTRAINT task_comments_task_id_tasks_id_fk;

ALTER TABLE task_comments
  ADD CONSTRAINT task_comments_task_id_tasks_id_fk
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
