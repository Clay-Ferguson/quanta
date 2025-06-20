CREATE TABLE IF NOT EXISTS fs_nodes (
    id SERIAL PRIMARY KEY,
    doc_root_key VARCHAR(255) NOT NULL,
    parent_path TEXT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    is_directory BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Hybrid content storage
    content_text TEXT,              -- For text files (.md, .txt, .json, .html, .css, .js, .ts, etc.)
    content_binary BYTEA,           -- For binary files (.jpg, .png, .pdf, .zip, etc.)
    is_binary BOOLEAN DEFAULT FALSE, -- Flag to determine which content column to use
    
    content_type VARCHAR(100),
    size_bytes BIGINT DEFAULT 0,
    created_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modified_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(doc_root_key, parent_path, filename)
);

CREATE INDEX IF NOT EXISTS idx_fs_nodes_parent ON fs_nodes(doc_root_key, parent_path);

-- Index for binary flag to optimize queries
CREATE INDEX IF NOT EXISTS idx_fs_nodes_binary ON fs_nodes(is_binary);