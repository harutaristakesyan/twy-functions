-- Create table: branch
CREATE TABLE IF NOT EXISTS branch
(
    id uuid PRIMARY KEY,
    name text UNIQUE NOT NULL,
    contact text
);