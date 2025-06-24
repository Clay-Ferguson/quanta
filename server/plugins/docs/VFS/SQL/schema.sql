CREATE TABLE IF NOT EXISTS vfs_nodes (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL,
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
    
    UNIQUE(doc_root_key, parent_path, filename),
    FOREIGN KEY (owner_id) REFERENCES user_info(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vfs_nodes_parent ON vfs_nodes(doc_root_key, parent_path);

-- Index for binary flag to optimize queries
CREATE INDEX IF NOT EXISTS idx_vfs_nodes_binary ON vfs_nodes(is_binary);

-- Index for owner_id foreign key to optimize joins with user_info table
CREATE INDEX IF NOT EXISTS idx_vfs_nodes_owner_id ON vfs_nodes(owner_id);

-- Enable trigram extension for better text search performance (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- We don't need this, according to Claude AI, but it would be useful for older versions of Postgres or something maybe where 'pg_trgm' is not available.
-- Fallback: Basic GIN index without trigrams (still faster than no index)
-- CREATE INDEX IF NOT EXISTS idx_vfs_nodes_content_text_gin ON vfs_nodes USING GIN (to_tsvector('english', content_text)) WHERE is_binary = FALSE;

-- Full-text search index for content_text column (for VFS search functionality)
-- GIN index with trigram extension for efficient ILIKE and text search operations
CREATE INDEX IF NOT EXISTS idx_vfs_nodes_content_text_gin ON vfs_nodes USING GIN (content_text gin_trgm_ops) WHERE is_binary = FALSE;

-- Composite index for search queries (optimizes common search patterns)
CREATE INDEX IF NOT EXISTS idx_vfs_nodes_search ON vfs_nodes(doc_root_key, parent_path, is_binary) WHERE is_binary = FALSE;