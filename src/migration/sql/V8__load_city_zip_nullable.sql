ALTER TABLE load
    ALTER COLUMN pickup_city_zip_code DROP NOT NULL;

ALTER TABLE load
    ALTER COLUMN dropoff_city_zip_code DROP NOT NULL;
