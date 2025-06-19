CREATE TABLE IF NOT EXISTS fs_nodes (
    id SERIAL PRIMARY KEY,
    doc_root_key VARCHAR(255) NOT NULL,
    parent_path TEXT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    is_directory BOOLEAN NOT NULL DEFAULT FALSE,
    content BYTEA,
    content_type VARCHAR(100),
    size_bytes BIGINT DEFAULT 0,
    created_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modified_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(doc_root_key, parent_path, filename)
);

CREATE INDEX IF NOT EXISTS idx_fs_nodes_parent ON fs_nodes(doc_root_key, parent_path);