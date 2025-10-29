ALTER TABLE load
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft';

UPDATE load
SET status = 'Draft'
WHERE status IS NULL;

ALTER TABLE load
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'Draft';
