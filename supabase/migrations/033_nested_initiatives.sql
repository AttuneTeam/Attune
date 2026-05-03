ALTER TABLE strategic_initiatives
  ADD COLUMN parent_id uuid REFERENCES strategic_initiatives(id) ON DELETE CASCADE,
  ADD COLUMN depth     smallint NOT NULL DEFAULT 0
                       CHECK (depth BETWEEN 0 AND 2);

CREATE INDEX initiatives_parent_idx ON strategic_initiatives (parent_id);

ALTER TABLE strategic_initiatives
  ALTER COLUMN title SET DEFAULT 'Untitled Initiative';
