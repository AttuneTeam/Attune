-- Unify todos and action items into a single concept.
-- Personal tasks (no linked interaction) are now stored as action_items
-- with interaction_id = NULL and user_id set to the owning manager.

-- 1. Add user_id column for personal action items
ALTER TABLE action_items
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Make interaction_id nullable
ALTER TABLE action_items
  ALTER COLUMN interaction_id DROP NOT NULL;

-- 3. Enforce: every row must have at least one owner
ALTER TABLE action_items
  ADD CONSTRAINT action_items_owner_check CHECK (
    interaction_id IS NOT NULL OR user_id IS NOT NULL
  );

-- 4. Backfill user_id from parent interaction's manager_id
UPDATE action_items ai
SET user_id = i.manager_id
FROM interactions i
WHERE i.id = ai.interaction_id;

-- 5. Replace old RLS policy with one that covers both cases
DROP POLICY IF EXISTS "action_items_via_interaction" ON action_items;

CREATE POLICY "action_items_access" ON action_items
  FOR ALL USING (
    (interaction_id IS NULL AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM interactions i
      WHERE i.id = action_items.interaction_id
        AND i.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    (interaction_id IS NULL AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM interactions i
      WHERE i.id = action_items.interaction_id
        AND i.manager_id = auth.uid()
    )
  );

-- 6. Migrate existing personal todos into action_items
INSERT INTO action_items (description, status, due_date, user_id, interaction_id, created_at)
SELECT
  content,
  status,
  due_date::timestamptz,
  user_id,
  NULL,
  created_at
FROM personal_items
WHERE type = 'todo';
