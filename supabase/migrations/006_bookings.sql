ALTER TABLE interactions
  ADD COLUMN status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('upcoming', 'completed')),
  ADD COLUMN agenda text;
