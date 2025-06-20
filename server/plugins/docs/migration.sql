-- Migration script to update fs_nodes table from old schema to new hybrid schema
-- This script safely migrates existing data from the old content column to the new content_text/content_binary columns

-- First, check if we need to migrate (if old content column exists)
DO $$ 
BEGIN
    -- Check if the old content column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'fs_nodes' 
        AND column_name = 'content'
    ) THEN
        RAISE NOTICE 'Starting migration of fs_nodes table...';
        
        -- Add new columns if they don't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'fs_nodes' 
            AND column_name = 'content_text'
        ) THEN
            ALTER TABLE fs_nodes ADD COLUMN content_text TEXT;
            RAISE NOTICE 'Added content_text column';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'fs_nodes' 
            AND column_name = 'content_binary'
        ) THEN
            ALTER TABLE fs_nodes ADD COLUMN content_binary BYTEA;
            RAISE NOTICE 'Added content_binary column';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'fs_nodes' 
            AND column_name = 'is_binary'
        ) THEN
            ALTER TABLE fs_nodes ADD COLUMN is_binary BOOLEAN DEFAULT FALSE;
            RAISE NOTICE 'Added is_binary column';
        END IF;
        
        -- Migrate existing data from content column to appropriate new columns
        -- For now, we'll assume all existing content is text (since it was likely text files in your tests)
        -- In a real migration, you'd need logic to determine binary vs text based on content_type or filename
        UPDATE fs_nodes 
        SET 
            content_text = CASE 
                WHEN content IS NOT NULL AND is_directory = FALSE THEN convert_from(content, 'UTF8')
                ELSE NULL 
            END,
            content_binary = NULL,
            is_binary = FALSE
        WHERE content IS NOT NULL OR is_directory = TRUE;
        
        RAISE NOTICE 'Migrated existing content data';
        
        -- Drop the old content column
        ALTER TABLE fs_nodes DROP COLUMN content;
        RAISE NOTICE 'Dropped old content column';
        
        -- Create missing indexes
        CREATE INDEX IF NOT EXISTS idx_fs_nodes_binary ON fs_nodes(is_binary);
        RAISE NOTICE 'Created missing indexes';
        
        RAISE NOTICE 'Migration completed successfully!';
    ELSE
        RAISE NOTICE 'Migration not needed - new schema already in place';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Migration failed: %', SQLERRM;
END $$;

-- Drop all existing functions to ensure they're recreated with the new schema
-- This ensures that any cached column references are cleared

DROP FUNCTION IF EXISTS pg_readdir(TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_readdir_names(TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_readdir_numbered(TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_shift_ordinals_down(INTEGER, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS pg_get_max_ordinal(TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_insert_file_at_ordinal(TEXT, TEXT, INTEGER, TEXT, BOOLEAN, BYTEA, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS pg_insert_file_at_ordinal(TEXT, TEXT, INTEGER, TEXT, BOOLEAN, BYTEA, TEXT);
DROP FUNCTION IF EXISTS pg_read_file(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_write_file(TEXT, TEXT, BYTEA, TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_write_text_file(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_write_binary_file(TEXT, TEXT, BYTEA, TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_exists(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_stat(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_unlink(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_rename(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_mkdir(TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS pg_ensure_path(TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_rmdir(TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS pg_search_files(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS pg_search_filenames(TEXT, TEXT, TEXT);

-- Functions will be recreated when functions.sql is executed next
