-- Create table: users
CREATE TABLE IF NOT EXISTS users (
                       id uuid PRIMARY KEY,
                       email VARCHAR(255) UNIQUE NOT NULL,
                       first_name VARCHAR(100) NOT NULL,
                       last_name VARCHAR(100) NOT NULL,
                       role VARCHAR(100),
                       is_active boolean NOT NULL DEFAULT true,
                       branch VARCHAR(255),
                       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                       updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);


