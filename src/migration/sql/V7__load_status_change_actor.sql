ALTER TABLE load
    DROP COLUMN IF EXISTS status_changed_at,
    ADD COLUMN IF NOT EXISTS status_changed_by VARCHAR(255) NULL;
