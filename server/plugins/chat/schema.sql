CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room_id INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT,
    public_key TEXT,
    signature TEXT,
    state TEXT,
    FOREIGN KEY (room_id) REFERENCES rooms (id)
);

CREATE TABLE IF NOT EXISTS attachments (
    id SERIAL PRIMARY KEY,
    message_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BYTEA,
    FOREIGN KEY (message_id) REFERENCES messages (id)
);

CREATE TABLE IF NOT EXISTS blocked_keys (
    pub_key TEXT PRIMARY KEY
);

CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages (room_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments (message_id);

