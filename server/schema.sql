CREATE TABLE IF NOT EXISTS user_info (
    id SERIAL PRIMARY KEY,
    pub_key TEXT UNIQUE NOT NULL,
    user_name TEXT,
    user_desc TEXT,
    avatar_name TEXT,
    avatar_type TEXT,
    avatar_size INTEGER,
    avatar_data BYTEA
);

CREATE INDEX IF NOT EXISTS idx_user_info_pub_key ON user_info (pub_key);