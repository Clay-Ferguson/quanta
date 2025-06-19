-- PostgreSQL Functions for Document Filesystem
-- This file contains all PostgreSQL stored procedures for the filesystem abstraction

-- Function: pg_readdir
-- Equivalent to fs.readdirSync() - lists directory contents
-- Returns files/folders in ordinal order with their metadata
-- Uses filename prefix for ordinal ordering instead of separate ordinal column
CREATE OR REPLACE FUNCTION pg_readdir(
    dir_path TEXT,
    root_key TEXT
) 
RETURNS TABLE(
    filename VARCHAR(255),
    ordinal INTEGER,
    is_directory BOOLEAN,
    size_bytes BIGINT,
    content_type VARCHAR(100),
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.filename,
        CASE 
            WHEN n.filename ~ '^[0-9]+_' THEN 
                substring(n.filename FROM '^([0-9]+)_')::INTEGER
            ELSE 
                0
        END as ordinal,
        n.is_directory,
        n.size_bytes,
        n.content_type,
        n.created_time,
        n.modified_time
    FROM fs_nodes n
    WHERE 
        n.doc_root_key = root_key 
        AND n.parent_path = dir_path
    ORDER BY 
        CASE 
            WHEN n.filename ~ '^[0-9]+_' THEN 
                substring(n.filename FROM '^([0-9]+)_')::INTEGER
            ELSE 
                0
        END ASC, 
        n.filename ASC;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_readdir_names
-- Simple version that just returns filenames (like fs.readdirSync() with no options)
CREATE OR REPLACE FUNCTION pg_readdir_names(
    dir_path TEXT,
    root_key TEXT
) 
RETURNS TEXT[] AS $$
DECLARE
    result TEXT[];
BEGIN
    SELECT ARRAY(
        SELECT n.filename
        FROM fs_nodes n
        WHERE 
            n.doc_root_key = root_key 
            AND n.parent_path = dir_path
        ORDER BY 
            CASE 
                WHEN n.filename ~ '^[0-9]+_' THEN 
                    substring(n.filename FROM '^([0-9]+)_')::INTEGER
                ELSE 
                    0
            END ASC, 
            n.filename ASC
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_readdir_numbered
-- Returns only files/folders with ordinal prefixes (matching your current regex filter)
CREATE OR REPLACE FUNCTION pg_readdir_numbered(
    dir_path TEXT,
    root_key TEXT
) 
RETURNS TABLE(
    filename VARCHAR(255),
    ordinal INTEGER,
    is_directory BOOLEAN,
    size_bytes BIGINT,
    content_type VARCHAR(100),
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.filename,
        substring(n.filename FROM '^([0-9]+)_')::INTEGER as ordinal,
        n.is_directory,
        n.size_bytes,
        n.content_type,
        n.created_time,
        n.modified_time
    FROM fs_nodes n
    WHERE 
        n.doc_root_key = root_key 
        AND n.parent_path = dir_path
        AND n.filename ~ '^[0-9]+_'  -- PostgreSQL regex for ordinal prefix
    ORDER BY substring(n.filename FROM '^([0-9]+)_')::INTEGER ASC;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_shift_ordinals_down
-- Equivalent to DocUtil.shiftOrdinalsDown() - creates space for new files by incrementing ordinals
-- This renames files to change their ordinal prefixes, just like the filesystem version
CREATE OR REPLACE FUNCTION pg_shift_ordinals_down(
    slots_to_add INTEGER,
    parent_path_param TEXT,
    insert_ordinal INTEGER,
    root_key TEXT,
    items_to_ignore TEXT[] DEFAULT NULL
) 
RETURNS TABLE(
    old_filename VARCHAR(255),
    new_filename VARCHAR(255),
    old_ordinal INTEGER,
    new_ordinal INTEGER
) AS $$
DECLARE
    file_record RECORD;
    old_ordinal_num INTEGER;
    new_ordinal_num INTEGER;
    name_without_prefix TEXT;
    new_filename_text VARCHAR(255);
    prefix_length INTEGER;
BEGIN
    -- Process files in descending ordinal order to avoid conflicts
    FOR file_record IN
        SELECT filename
        FROM fs_nodes 
        WHERE 
            doc_root_key = root_key
            AND parent_path = parent_path_param
            AND filename ~ '^[0-9]+_'  -- Only files with ordinal prefixes
            AND (items_to_ignore IS NULL OR filename != ALL(items_to_ignore))
            AND substring(filename FROM '^([0-9]+)_')::INTEGER >= insert_ordinal
        ORDER BY substring(filename FROM '^([0-9]+)_')::INTEGER DESC
    LOOP
        -- Extract current ordinal from filename
        old_ordinal_num := substring(file_record.filename FROM '^([0-9]+)_')::INTEGER;
        
        -- Calculate new ordinal
        new_ordinal_num := old_ordinal_num + slots_to_add;
        
        -- Extract the name part after the underscore
        name_without_prefix := substring(file_record.filename FROM '^[0-9]+_(.*)$');
        
        -- Determine prefix length to maintain consistent padding
        prefix_length := position('_' in file_record.filename) - 1;
        IF prefix_length < 4 THEN
            prefix_length := 4; -- Use minimum 4-digit padding
        END IF;
        
        -- Create new filename with updated ordinal prefix
        new_filename_text := lpad(new_ordinal_num::TEXT, prefix_length, '0') || '_' || name_without_prefix;
        
        -- Update the filename in the database
        UPDATE fs_nodes 
        SET 
            filename = new_filename_text,
            modified_time = NOW()
        WHERE 
            doc_root_key = root_key
            AND parent_path = parent_path_param
            AND filename = file_record.filename;
            
        -- Return the mapping for external reference tracking
        old_filename := file_record.filename;
        new_filename := new_filename_text;
        old_ordinal := old_ordinal_num;
        new_ordinal := new_ordinal_num;
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_get_max_ordinal
-- Equivalent to DocUtil.getMaxOrdinal() - finds highest ordinal in a directory
-- Extracts ordinal from filename prefix instead of using ordinal column
CREATE OR REPLACE FUNCTION pg_get_max_ordinal(
    parent_path_param TEXT,
    root_key TEXT
) 
RETURNS INTEGER AS $$
DECLARE
    max_ord INTEGER;
BEGIN
    SELECT COALESCE(MAX(substring(filename FROM '^([0-9]+)_')::INTEGER), 0)
    INTO max_ord
    FROM fs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename ~ '^[0-9]+_';  -- Only consider files with ordinal prefixes
        
    RETURN max_ord;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_get_ordinal_from_name
-- Equivalent to DocUtil.getOrdinalFromName() - extracts ordinal from filename prefix
CREATE OR REPLACE FUNCTION pg_get_ordinal_from_name(
    filename_param TEXT,
    parent_path_param TEXT,
    root_key TEXT
) 
RETURNS INTEGER AS $$
DECLARE
    file_ordinal INTEGER;
BEGIN
    -- First check if file exists
    IF NOT EXISTS (
        SELECT 1 FROM fs_nodes
        WHERE 
            doc_root_key = root_key
            AND parent_path = parent_path_param
            AND filename = filename_param
    ) THEN
        RAISE EXCEPTION 'File not found: %', filename_param;
    END IF;
    
    -- Extract ordinal from filename prefix - filename MUST have ordinal prefix
    IF filename_param ~ '^[0-9]+_' THEN
        file_ordinal := substring(filename_param FROM '^([0-9]+)_')::INTEGER;
    ELSE
        RAISE EXCEPTION 'Invalid file name format: %. All filenames must have ordinal prefix format "NNNN_filename" where N is a digit.', filename_param;
    END IF;
    
    RETURN file_ordinal;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_insert_file_at_ordinal
-- Helper function to insert a new file at a specific ordinal position
-- Automatically shifts existing files down if needed and creates proper ordinal filename
CREATE OR REPLACE FUNCTION pg_insert_file_at_ordinal(
    parent_path_param TEXT,
    filename_param TEXT,
    insert_ordinal INTEGER,
    root_key TEXT,
    is_directory_param BOOLEAN DEFAULT FALSE,
    content_param BYTEA DEFAULT NULL,
    content_type_param TEXT DEFAULT NULL
) 
RETURNS INTEGER AS $$
DECLARE
    new_file_id INTEGER;
    existing_file_count INTEGER;
    final_filename TEXT;
    ordinal_prefix TEXT;
BEGIN
    -- Check if there's already a file at this ordinal position or higher
    SELECT COUNT(*)
    INTO existing_file_count
    FROM fs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename ~ '^[0-9]+_'
        AND substring(filename FROM '^([0-9]+)_')::INTEGER >= insert_ordinal;
    
    -- If files exist at or after this ordinal, shift them down
    IF existing_file_count > 0 THEN
        PERFORM pg_shift_ordinals_down(1, parent_path_param, insert_ordinal, root_key);
    END IF;
    
    -- Filename MUST already have ordinal prefix - no automatic addition
    IF filename_param ~ '^[0-9]+_' THEN
        final_filename := filename_param;
    ELSE
        RAISE EXCEPTION 'Invalid filename: %. All filenames must have ordinal prefix format "NNNN_filename".', filename_param;
    END IF;
    
    -- Insert the new file at the desired ordinal position
    INSERT INTO fs_nodes (
        doc_root_key,
        parent_path,
        filename,
        is_directory,
        content,
        content_type,
        size_bytes,
        created_time,
        modified_time
    ) VALUES (
        root_key,
        parent_path_param,
        final_filename,
        is_directory_param,
        content_param,
        content_type_param,
        COALESCE(LENGTH(content_param), 0),
        NOW(),
        NOW()
    ) RETURNING id INTO new_file_id;
    
    RETURN new_file_id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- BASIC FILE OPERATIONS
-- ==============================================================================

-- Function: pg_read_file
-- Equivalent to fs.readFileSync() - reads file content
CREATE OR REPLACE FUNCTION pg_read_file(
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS BYTEA AS $$
DECLARE
    file_content BYTEA;
BEGIN
    SELECT content
    INTO file_content
    FROM fs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param
        AND is_directory = FALSE;
        
    IF file_content IS NULL THEN
        RAISE EXCEPTION 'File not found: %/%', parent_path_param, filename_param;
    END IF;
    
    RETURN file_content;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_write_file
-- Equivalent to fs.writeFileSync() - writes file content
-- Uses filename prefixes for ordinal management instead of ordinal column
CREATE OR REPLACE FUNCTION pg_write_file(
    parent_path_param TEXT,
    filename_param TEXT,
    content_data BYTEA,
    root_key TEXT,
    content_type_param TEXT DEFAULT 'application/octet-stream'
) 
RETURNS INTEGER AS $$
DECLARE
    file_id INTEGER;
    file_size BIGINT;
    final_filename TEXT;
    max_ordinal INTEGER;
    ordinal_prefix TEXT;
BEGIN
    file_size := LENGTH(content_data);
    
    -- Filename MUST already have ordinal prefix - no automatic addition
    IF filename_param ~ '^[0-9]+_' THEN
        final_filename := filename_param;
    ELSE
        RAISE EXCEPTION 'Invalid filename: %. All filenames must have ordinal prefix format "NNNN_filename".', filename_param;
    END IF;
    
    INSERT INTO fs_nodes (
        doc_root_key,
        parent_path,
        filename,
        is_directory,
        content,
        content_type,
        size_bytes,
        created_time,
        modified_time
    ) VALUES (
        root_key,
        parent_path_param,
        final_filename,
        FALSE,
        content_data,
        content_type_param,
        file_size,
        NOW(),
        NOW()
    )
    ON CONFLICT (doc_root_key, parent_path, filename)
    DO UPDATE SET 
        content = content_data,
        content_type = content_type_param,
        size_bytes = file_size,
        modified_time = NOW()
    RETURNING id INTO file_id;
    
    RETURN file_id;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_exists
-- Equivalent to fs.existsSync() - checks if file or directory exists
CREATE OR REPLACE FUNCTION pg_exists(
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    exists_flag BOOLEAN;
BEGIN
    SELECT COUNT(*) > 0
    INTO exists_flag
    FROM fs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param;
        
    RETURN exists_flag;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_stat
-- Equivalent to fs.statSync() - gets file/directory metadata
-- Extracts ordinal from filename prefix instead of using ordinal column
CREATE OR REPLACE FUNCTION pg_stat(
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS TABLE(
    is_directory BOOLEAN,
    size_bytes BIGINT,
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE,
    content_type VARCHAR(100),
    ordinal INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.is_directory,
        n.size_bytes,
        n.created_time,
        n.modified_time,
        n.content_type,
        CASE 
            WHEN n.filename ~ '^[0-9]+_' THEN 
                substring(n.filename FROM '^([0-9]+)_')::INTEGER
            ELSE 
                0
        END as ordinal
    FROM fs_nodes n
    WHERE 
        n.doc_root_key = root_key
        AND n.parent_path = parent_path_param
        AND n.filename = filename_param;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_unlink
-- Equivalent to fs.unlinkSync() - deletes a file
CREATE OR REPLACE FUNCTION pg_unlink(
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM fs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param
        AND is_directory = FALSE;
        
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count = 0 THEN
        RAISE EXCEPTION 'File not found: %/%', parent_path_param, filename_param;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_rename
-- Equivalent to fs.renameSync() - renames/moves a file or directory
CREATE OR REPLACE FUNCTION pg_rename(
    old_parent_path TEXT,
    old_filename TEXT,
    new_parent_path TEXT,
    new_filename TEXT,
    root_key TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Check if target already exists
    IF pg_exists(new_parent_path, new_filename, root_key) THEN
        RAISE EXCEPTION 'Target already exists: %/%', new_parent_path, new_filename;
    END IF;
    
    -- Update the record
    UPDATE fs_nodes
    SET 
        parent_path = new_parent_path,
        filename = new_filename,
        modified_time = NOW()
    WHERE 
        doc_root_key = root_key
        AND parent_path = old_parent_path
        AND filename = old_filename;
        
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count = 0 THEN
        RAISE EXCEPTION 'Source file not found: %/%', old_parent_path, old_filename;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- DIRECTORY OPERATIONS
-- ==============================================================================

-- Function: pg_mkdir
-- Equivalent to fs.mkdirSync() - creates a directory
-- Uses filename prefixes for ordinal management instead of ordinal column
CREATE OR REPLACE FUNCTION pg_mkdir(
    parent_path_param TEXT,
    dirname_param TEXT,
    root_key TEXT,
    recursive_flag BOOLEAN DEFAULT FALSE
) 
RETURNS INTEGER AS $$
DECLARE
    dir_id INTEGER;
    next_ordinal INTEGER;
    final_dirname TEXT;
    ordinal_prefix TEXT;
BEGIN
    -- Directory name MUST already have ordinal prefix - no automatic addition
    IF dirname_param ~ '^[0-9]+_' THEN
        final_dirname := dirname_param;
        -- Check if directory already exists
        IF pg_exists(parent_path_param, dirname_param, root_key) THEN
            RAISE EXCEPTION 'Directory already exists: %/%', parent_path_param, dirname_param;
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid directory name: %. All directory names must have ordinal prefix format "NNNN_dirname".', dirname_param;
    END IF;
    
    -- Create the directory
    INSERT INTO fs_nodes (
        doc_root_key,
        parent_path,
        filename,
        is_directory,
        content,
        content_type,
        size_bytes,
        created_time,
        modified_time
    ) VALUES (
        root_key,
        parent_path_param,
        final_dirname,
        TRUE,
        NULL,
        'directory',
        0,
        NOW(),
        NOW()
    ) RETURNING id INTO dir_id;
    
    RETURN dir_id;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_rmdir
-- Equivalent to fs.rmSync() - removes a directory (with recursive option)
CREATE OR REPLACE FUNCTION pg_rmdir(
    parent_path_param TEXT,
    dirname_param TEXT,
    root_key TEXT,
    recursive_flag BOOLEAN DEFAULT FALSE,
    force_flag BOOLEAN DEFAULT FALSE
) 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    child_count INTEGER;
    dir_path TEXT;
BEGIN
    -- Build the full path of the directory to delete
    dir_path := parent_path_param;
    IF dir_path != '/' THEN
        dir_path := dir_path || '/' || dirname_param;
    ELSE
        dir_path := '/' || dirname_param;
    END IF;
    
    -- Check if directory exists
    IF NOT pg_exists(parent_path_param, dirname_param, root_key) THEN
        IF NOT force_flag THEN
            RAISE EXCEPTION 'Directory not found: %/%', parent_path_param, dirname_param;
        END IF;
        RETURN 0;
    END IF;
    
    -- Check if directory has children
    SELECT COUNT(*)
    INTO child_count
    FROM fs_nodes
    WHERE doc_root_key = root_key AND parent_path = dir_path;
    
    -- If directory has children and recursive is false, error
    IF child_count > 0 AND NOT recursive_flag THEN
        RAISE EXCEPTION 'Directory not empty: %/% (use recursive option)', parent_path_param, dirname_param;
    END IF;
    
    -- Delete recursively if needed
    IF recursive_flag THEN
        -- Delete all children recursively
        WITH RECURSIVE dir_tree AS (
            -- Base case: direct children
            SELECT id, parent_path, filename, is_directory
            FROM fs_nodes
            WHERE doc_root_key = root_key AND parent_path = dir_path
            
            UNION ALL
            
            -- Recursive case: children of subdirectories
            SELECT n.id, n.parent_path, n.filename, n.is_directory
            FROM fs_nodes n
            INNER JOIN dir_tree dt ON n.parent_path = dt.parent_path || '/' || dt.filename
            WHERE n.doc_root_key = root_key AND dt.is_directory = TRUE
        )
        DELETE FROM fs_nodes
        WHERE id IN (SELECT id FROM dir_tree);
    END IF;
    
    -- Delete the directory itself
    DELETE FROM fs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = dirname_param
        AND is_directory = TRUE;
        
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: pg_is_directory
-- Helper function to check if a path is a directory
CREATE OR REPLACE FUNCTION pg_is_directory(
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    is_dir BOOLEAN;
BEGIN
    SELECT is_directory
    INTO is_dir
    FROM fs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param;
        
    RETURN COALESCE(is_dir, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function: pg_ensure_path
-- Helper function to create directory path recursively (like mkdir -p)
CREATE OR REPLACE FUNCTION pg_ensure_path(
    full_path TEXT,
    root_key TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    path_parts TEXT[];
    current_path TEXT;
    part TEXT;
    i INTEGER;
BEGIN
    -- Split path into parts
    path_parts := string_to_array(trim(both '/' from full_path), '/');
    current_path := '';
    
    -- Create each directory in the path if it doesn't exist
    FOR i IN 1..array_length(path_parts, 1) LOOP
        part := path_parts[i];
        
        -- Skip empty parts
        IF part = '' THEN
            CONTINUE;
        END IF;
        
        -- Check if this directory exists
        IF NOT pg_exists(current_path, part, root_key) THEN
            PERFORM pg_mkdir(current_path, part, root_key, TRUE);
        END IF;
        
        -- Update current path
        IF current_path = '' THEN
            current_path := '/' || part;
        ELSE
            current_path := current_path || '/' || part;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
