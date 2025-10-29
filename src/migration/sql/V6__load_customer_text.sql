ALTER TABLE load
    RENAME COLUMN customer_id TO customer;

ALTER TABLE load
    ALTER COLUMN customer TYPE TEXT USING customer::text;
