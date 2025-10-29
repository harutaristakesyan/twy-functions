ALTER TABLE load
    ALTER COLUMN status SET DEFAULT 'Pending';

UPDATE load
SET status = 'Pending'
WHERE status NOT IN ('Pending', 'Approved', 'Denied');
