-- PostgreSQL Functions for Document Filesystem
-- This file contains all PostgreSQL stored procedures for the filesystem abstraction

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_readdir
-- Equivalent to fs.readdirSync() - lists directory contents
-- Returns files/folders in ordinal order with their metadata
-- Uses filename prefix for ordinal ordering instead of separate ordinal column
-- Optional include_content parameter includes content_text column when true
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_readdir(
    owner_id_arg INTEGER,
    dir_path TEXT,
    root_key TEXT,
    include_content BOOLEAN DEFAULT FALSE
) 
RETURNS TABLE(
    owner_id INTEGER,
    is_public BOOLEAN,
    filename VARCHAR(255),
    is_directory BOOLEAN,
    size_bytes BIGINT,
    content_type VARCHAR(100),
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE,
    content_text TEXT
) AS $$
BEGIN
    IF include_content THEN
        RETURN QUERY
        SELECT 
            n.owner_id,
            n.is_public,
            n.filename,
            n.is_directory,
            n.size_bytes,
            n.content_type,
            n.created_time,
            n.modified_time,
            n.content_text
        FROM vfs_nodes n
        WHERE 
            n.doc_root_key = root_key 
            AND n.parent_path = dir_path
            AND (owner_id_arg=0 OR n.owner_id = owner_id_arg OR n.is_public = TRUE) 
        ORDER BY 
            n.filename ASC;
    ELSE
        RETURN QUERY
        SELECT 
            n.owner_id,
            n.is_public,
            n.filename,
            n.is_directory,
            n.size_bytes,
            n.content_type,
            n.created_time,
            n.modified_time,
            NULL::TEXT as content_text
        FROM vfs_nodes n
        WHERE 
            n.doc_root_key = root_key 
            AND n.parent_path = dir_path
            AND (owner_id_arg=0 OR n.owner_id = owner_id_arg OR n.is_public = TRUE) 
        ORDER BY 
            n.filename ASC;
    END IF;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_readdir_by_owner
-- Finds all files/folders in the specified path owned by the specified owner
-- Returns files/folders in ordinal order with their metadata
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_readdir_by_owner(
    owner_id_arg INTEGER,
    dir_path TEXT,
    root_key TEXT
) 
RETURNS TABLE(
    owner_id INTEGER,
    is_public BOOLEAN,
    filename VARCHAR(255),
    is_directory BOOLEAN,
    size_bytes BIGINT,
    content_type VARCHAR(100),
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.owner_id,
        n.is_public,
        n.filename,
        n.is_directory,
        n.size_bytes,
        n.content_type,
        n.created_time,
        n.modified_time
    FROM vfs_nodes n
    WHERE 
        n.doc_root_key = root_key 
        AND n.parent_path = dir_path
        AND n.owner_id = owner_id_arg 
    ORDER BY 
        n.filename ASC;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_readdir_names
-- Simple version that just returns filenames (like fs.readdirSync() with no options)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_readdir_names(
    owner_id_arg INTEGER,
    dir_path TEXT,
    root_key TEXT
) 
RETURNS TEXT[] AS $$
DECLARE
    result TEXT[];
BEGIN
    SELECT ARRAY(
        SELECT n.filename
        FROM vfs_nodes n
        WHERE 
            n.doc_root_key = root_key 
            AND n.parent_path = dir_path
            --  user can read files they own, or public files
            AND (owner_id_arg=0 OR n.owner_id = owner_id_arg OR n.is_public = TRUE) 
        ORDER BY 
            n.filename ASC
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_get_max_ordinal
-- Equivalent to DocUtil.getMaxOrdinal() - finds highest ordinal in a directory
-- Extracts ordinal from filename prefix instead of using ordinal column
-- Returns the maximum ordinal value from direct children in the given path
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_get_max_ordinal(
    parent_path_arg TEXT,
    root_key TEXT
) 
RETURNS INTEGER AS $$
DECLARE
    max_ord INTEGER;
BEGIN
    SELECT COALESCE(MAX(substring(filename FROM '^([0-9]+)_')::INTEGER), 0)
    INTO max_ord
    FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_arg
        AND filename ~ '^[0-9]+_';  -- Only consider files with ordinal prefixes
        
    RETURN max_ord;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- BASIC FILE OPERATIONS
-- ==============================================================================

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_read_file
-- Equivalent to fs.readFileSync() - reads file content (both text and binary)
-- Returns BYTEA for compatibility, but content comes from appropriate column
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_read_file(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS BYTEA AS $$
DECLARE
    file_content BYTEA;
    text_content TEXT;
    is_binary_file BOOLEAN;
BEGIN
    SELECT is_binary, content_text, content_binary
    INTO is_binary_file, text_content, file_content
    FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param
        AND is_directory = FALSE
        AND (owner_id_arg = 0 OR owner_id = owner_id_arg OR is_public = TRUE); 
        
    -- Check if file was found
    IF is_binary_file IS NULL THEN
        RAISE EXCEPTION 'File not found: %/%', parent_path_param, filename_param;
    END IF;
    
    -- Return appropriate content based on file type
    IF is_binary_file THEN
        RETURN file_content;
    ELSE
        -- Convert text to BYTEA for return
        RETURN convert_to(text_content, 'UTF8');
    END IF;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_write_text_file
-- Equivalent to fs.writeFileSync() for text files - writes text file content
-- Uses filename prefixes for ordinal management instead of ordinal column
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_write_text_file(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    content_data TEXT,
    root_key TEXT,
    content_type_param TEXT DEFAULT 'text/plain',
    is_public_param BOOLEAN DEFAULT FALSE
) 
RETURNS INTEGER AS $$
DECLARE
    file_id INTEGER;
    file_size BIGINT;
    final_filename TEXT;
BEGIN
    file_size := LENGTH(content_data);
    
    -- Filename MUST already have ordinal prefix - no automatic addition
    IF filename_param ~ '^[0-9]+_' THEN
        final_filename := filename_param;
    ELSE
        RAISE EXCEPTION 'Invalid filename: %. All filenames must have ordinal prefix format "NNNN_filename".', filename_param;
    END IF;
    
    INSERT INTO vfs_nodes (
        owner_id,
        doc_root_key,
        parent_path,
        filename,
        is_directory,
        content_text,
        content_binary,
        is_binary,
        content_type,
        size_bytes,
        created_time,
        modified_time,
        is_public
    ) VALUES (
        owner_id_arg,
        root_key,
        parent_path_param,
        final_filename,
        FALSE,
        content_data,
        NULL,
        FALSE,
        content_type_param,
        file_size,
        NOW(),
        NOW(),
        is_public_param
    )
    ON CONFLICT (doc_root_key, parent_path, filename)
    DO UPDATE SET 
        content_text = content_data,
        content_binary = NULL,
        is_binary = FALSE,
        content_type = content_type_param,
        size_bytes = file_size,
        modified_time = NOW()
    RETURNING id INTO file_id;
    
    RETURN file_id;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_write_binary_file
-- Equivalent to fs.writeFileSync() for binary files - writes binary file content
-- Uses filename prefixes for ordinal management instead of ordinal column
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_write_binary_file(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    content_data BYTEA,
    root_key TEXT,
    content_type_param TEXT DEFAULT 'application/octet-stream',
    is_public_param BOOLEAN DEFAULT FALSE
) 
RETURNS INTEGER AS $$
DECLARE
    file_id INTEGER;
    file_size BIGINT;
    final_filename TEXT;
BEGIN
    file_size := LENGTH(content_data);
    
    -- Filename MUST already have ordinal prefix - no automatic addition
    IF filename_param ~ '^[0-9]+_' THEN
        final_filename := filename_param;
    ELSE
        RAISE EXCEPTION 'Invalid filename: %. All filenames must have ordinal prefix format "NNNN_filename".', filename_param;
    END IF;
    
    INSERT INTO vfs_nodes (
        owner_id,
        doc_root_key,
        parent_path,
        filename,
        is_directory,
        content_text,
        content_binary,
        is_binary,
        content_type,
        size_bytes,
        created_time,
        modified_time,
        is_public
    ) VALUES (
        owner_id_arg,
        root_key,
        parent_path_param,
        final_filename,
        FALSE,
        NULL,
        content_data,
        TRUE,
        content_type_param,
        file_size,
        NOW(),
        NOW(),
        is_public_param
    )
    ON CONFLICT (doc_root_key, parent_path, filename)
    DO UPDATE SET 
        content_text = NULL,
        content_binary = content_data,
        is_binary = TRUE,
        content_type = content_type_param,
        size_bytes = file_size,
        modified_time = NOW()
    RETURNING id INTO file_id;
    
    RETURN file_id;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_exists
-- Equivalent to fs.existsSync() - checks if file or directory exists
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_exists(
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
    FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param;
        
    RETURN exists_flag;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_get_node_by_name 
-- Similar to vfs_exists but returns the entire node row if found, or null if not found
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_get_node_by_name(
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS TABLE(
    id INTEGER,
    uuid UUID,
    owner_id INTEGER,
    doc_root_key VARCHAR(255),
    parent_path TEXT,
    filename VARCHAR(255),
    is_directory BOOLEAN,
    content_text TEXT,
    content_binary BYTEA,
    is_binary BOOLEAN,
    content_type VARCHAR(100),
    size_bytes BIGINT,
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE,
    is_public BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.uuid,
        n.owner_id,
        n.doc_root_key,
        n.parent_path,
        n.filename,
        n.is_directory,
        n.content_text,
        n.content_binary,
        n.is_binary,
        n.content_type,
        n.size_bytes,
        n.created_time,
        n.modified_time,
        n.is_public
    FROM vfs_nodes n
    WHERE 
        n.doc_root_key = root_key
        AND n.parent_path = parent_path_param
        AND n.filename = filename_param;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_stat
-- Equivalent to fs.statSync() - gets file/directory metadata
-- Extracts ordinal from filename prefix instead of using ordinal column
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_stat(
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS TABLE(
    is_public BOOLEAN,
    is_directory BOOLEAN,
    size_bytes BIGINT,
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE,
    content_type VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.is_public,
        n.is_directory,
        n.size_bytes,
        n.created_time,
        n.modified_time,
        n.content_type
    FROM vfs_nodes n
    WHERE 
        n.doc_root_key = root_key
        AND n.parent_path = parent_path_param
        AND n.filename = filename_param;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_unlink
-- Equivalent to fs.unlinkSync() - deletes a file
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_unlink(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param
        AND is_directory = FALSE
        AND (owner_id_arg = 0 OR owner_id = owner_id_arg);
        
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count = 0 THEN
        RAISE EXCEPTION 'File not found: %/%', parent_path_param, filename_param;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_children_exist
-- Checks if a directory has any children (files or folders)
-- Returns true if the specified path has any files or folders in it
-- Used to determine if a directory is empty
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_children_exist(
    owner_id_arg INTEGER,
    path_param TEXT,
    root_key TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    has_children BOOLEAN;
BEGIN
    SELECT COUNT(*) > 0
    INTO has_children
    FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = path_param
        AND (owner_id_arg = 0 OR owner_id = owner_id_arg OR is_public = TRUE);
        
    RETURN has_children;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_rename
-- Equivalent to fs.renameSync() - renames/moves a file or directory
-- For directories, also updates the parent_path of all nested children
-- Returns both success status and diagnostic information
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_rename(
    owner_id_arg INTEGER,
    old_parent_path TEXT,
    old_filename TEXT,
    new_parent_path TEXT,
    new_filename TEXT,
    root_key TEXT
) 
RETURNS TABLE(success BOOLEAN, diagnostic TEXT) AS $$
DECLARE
    updated_count INTEGER;
    child_count INTEGER := 0;
    is_dir BOOLEAN;
    old_path TEXT;
    new_path TEXT;
BEGIN
    -- Check if target already exists
    IF vfs_exists(new_parent_path, new_filename, root_key) THEN
        RETURN QUERY SELECT FALSE AS success, 
                     format('Target already exists: %s/%s', new_parent_path, new_filename) AS diagnostic;
        RETURN;
    END IF;
    
    -- Check if the item being renamed is a directory
    SELECT is_directory INTO is_dir
    FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = old_parent_path
        AND filename = old_filename
        AND (owner_id_arg = 0 OR owner_id = owner_id_arg);
    
    IF is_dir IS NULL THEN
        RETURN QUERY SELECT FALSE AS success, 
                     format('Source file not found: path=[%s] name=[%s] doc_root_key=[%s] owner_id_arg=[%L]', old_parent_path, old_filename, root_key, owner_id_arg) AS diagnostic;
        RETURN;
    END IF;
    
    -- Update the main record
    UPDATE vfs_nodes
    SET 
        parent_path = new_parent_path,
        filename = new_filename
    WHERE 
        doc_root_key = root_key
        AND parent_path = old_parent_path
        AND filename = old_filename;
    
    -- If it's a directory, update all children's parent paths
    IF is_dir THEN
        -- Build the old and new paths for child updates
        -- Handle empty string (root) vs non-empty parent paths correctly
        IF old_parent_path = '' THEN
            old_path := old_filename;
        ELSE
            old_path := old_parent_path || '/' || old_filename;
        END IF;
        
        IF new_parent_path = '' THEN
            new_path := new_filename;
        ELSE
            new_path := new_parent_path || '/' || new_filename;
        END IF;
        
        -- Update all children's parent paths
        UPDATE vfs_nodes
        SET 
            parent_path = CASE
                -- Direct child of the renamed directory
                WHEN parent_path = old_path THEN new_path
                -- Deeper descendants - replace the prefix
                ELSE regexp_replace(parent_path, '^' || old_path || '/', new_path || '/')
            END
        WHERE 
            doc_root_key = root_key
            AND (parent_path = old_path OR parent_path LIKE old_path || '/%');
        
        GET DIAGNOSTICS child_count = ROW_COUNT;
        
        RETURN QUERY SELECT TRUE AS success, 
                     format('Renamed directory from %s/%s to %s/%s. Updated %s children.', 
                           old_parent_path, old_filename, new_parent_path, new_filename, child_count) AS diagnostic;
    ELSE
        -- For files, just return success
        RETURN QUERY SELECT TRUE AS success,
                     format('Renamed file from %s/%s to %s/%s', 
                           old_parent_path, old_filename, new_parent_path, new_filename) AS diagnostic;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- DIRECTORY OPERATIONS
-- ==============================================================================

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_mkdir
-- Equivalent to fs.mkdirSync() - creates a directory
-- Uses filename prefixes for ordinal management instead of ordinal column
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_mkdir(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    dirname_param TEXT,
    root_key TEXT,
    recursive_flag BOOLEAN DEFAULT FALSE,
    is_public_arg BOOLEAN DEFAULT FALSE
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
        IF vfs_exists(parent_path_param, dirname_param, root_key) THEN
            RAISE EXCEPTION 'Directory already exists: %/%', parent_path_param, dirname_param;
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid directory name: %. All directory names must have ordinal prefix format "NNNN_dirname".', dirname_param;
    END IF;
    
    -- Create the directory
    INSERT INTO vfs_nodes (
        owner_id,
        doc_root_key,
        parent_path,
        filename,
        is_directory,
        content_text,
        content_binary,
        is_binary,
        content_type,
        size_bytes,
        created_time,
        modified_time,
        is_public
    ) VALUES (
        owner_id_arg,
        root_key,
        parent_path_param,
        final_dirname,
        TRUE,
        NULL,
        NULL,
        FALSE,
        'directory',
        0,
        NOW(),
        NOW(),
        is_public_arg
    ) RETURNING id INTO dir_id;
    
    RETURN dir_id;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_rmdir
-- Equivalent to fs.rmSync() - removes a directory recursively
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_rmdir(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    dirname_param TEXT,
    root_key TEXT
) 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    dir_path TEXT;
BEGIN
    -- Build the full path of the directory to delete
    -- Handle empty string (root) vs non-empty parent paths
    IF parent_path_param = '' THEN
        dir_path := dirname_param;
    ELSE
        dir_path := parent_path_param || '/' || dirname_param;
    END IF;
    
    -- Check if directory exists
    IF NOT vfs_exists(parent_path_param, dirname_param, root_key) THEN
        RAISE EXCEPTION 'Directory not found: %s/%s', parent_path_param, dirname_param;
    END IF;
    
    -- Check authorization
    IF NOT vfs_check_auth(owner_id_arg, parent_path_param, dirname_param, root_key, TRUE) THEN
        RAISE EXCEPTION 'Not authorized to remove directory: %s/%s', parent_path_param, dirname_param;
    END IF;
    
    -- Delete all children recursively first (using a simpler approach)
    -- Delete all descendants where parent_path starts with our directory path
    DELETE FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND (
            parent_path = dir_path OR 
            parent_path LIKE dir_path || '/%'
        );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete the directory itself
    DELETE FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = dirname_param
        AND is_directory = TRUE;
        
    -- Add the directory itself to the count
    deleted_count := deleted_count + 1;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_check_auth
-- Checks if a user is authorized to access/modify a file or directory
-- Returns true if:
-- 1. User is the owner of the file/folder
-- 2. User has admin privileges (owner_id_arg = 0)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_check_auth(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT,
    is_directory_param BOOLEAN DEFAULT NULL
) 
RETURNS BOOLEAN AS $$
DECLARE
    item_owner_id INTEGER;
    item_exists BOOLEAN;
    item_is_directory BOOLEAN;
BEGIN
    -- Check if the item exists and get its owner_id
    SELECT 
        owner_id, 
        TRUE, 
        is_directory
    INTO 
        item_owner_id, 
        item_exists, 
        item_is_directory
    FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param
        AND (is_directory_param IS NULL OR is_directory = is_directory_param);
    
    -- Item doesn't exist
    IF item_exists IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Admin always has access
    IF owner_id_arg = 0 THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is the owner
    RETURN item_owner_id = owner_id_arg;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_search_text
-- PostgreSQL-based text search function for VFS
-- Searches through text content in non-binary files
-- Supports REGEX, MATCH_ANY, and MATCH_ALL search modes
-- Optionally filters by timestamp requirements
-- 
-- Empty Query Handling:
-- - Empty, null, or undefined queries are treated as "match everything"
-- - Automatically converts to REGEX mode with pattern ".*" to match all content
-- - Returns file-level results for all text files in the specified path
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_search_text(
    owner_id_arg INTEGER,
    search_query TEXT,
    search_path TEXT,
    root_key TEXT,
    search_mode TEXT DEFAULT 'MATCH_ANY',
    require_date BOOLEAN DEFAULT FALSE,
    search_order TEXT DEFAULT 'MOD_TIME'
) 
RETURNS TABLE(
    file VARCHAR(255),
    full_path TEXT,
    content_type VARCHAR(100),
    size_bytes BIGINT,
    modified_time TIMESTAMP WITH TIME ZONE,
    created_time TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    date_regex TEXT := '^\[[0-9]{4}/[0-9]{2}/[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} (AM|PM)\]';
    search_terms TEXT[];
    term TEXT;
    where_clause TEXT := '';
    order_clause TEXT := '';
    is_empty_query BOOLEAN;
BEGIN
    -- Handle empty, null, or undefined query as "match everything"
    is_empty_query := (search_query IS NULL OR trim(search_query) = '');
    
    IF is_empty_query THEN
        -- For empty queries, we'll match all files without content filtering
        search_query := '.*';  -- This won't be used but kept for consistency
        search_mode := 'REGEX';  -- Force REGEX mode but we'll handle it specially
    END IF;
    
    -- Build the base WHERE clause
    -- Handle root path search specially
    IF search_path = '/' THEN
        -- Search all files when path is root
        where_clause := format('doc_root_key = %L AND is_binary = FALSE AND content_text IS NOT NULL',
                              root_key);
    ELSE
        -- Search within specific path
        where_clause := format('doc_root_key = %L AND parent_path LIKE %L AND is_binary = FALSE AND content_text IS NOT NULL',
                              root_key, search_path || '%');
    END IF;
    
    -- Add timestamp filter if required
    IF require_date THEN
        where_clause := where_clause || format(' AND content_text ~* %L', date_regex);
    END IF;
    
    -- Build search condition based on mode (skip content filtering for empty queries)
    IF NOT is_empty_query THEN
        IF search_mode = 'REGEX' THEN
            -- REGEX mode: use the query as-is as a regex pattern
            where_clause := where_clause || format(' AND content_text ~* %L', search_query);
            
        ELSIF search_mode = 'MATCH_ANY' THEN
            -- MATCH_ANY mode: split query into terms and search for any term (OR logic)
            -- Simple word splitting on whitespace, handling quoted phrases
        SELECT string_to_array(
            regexp_replace(
                regexp_replace(search_query, '"([^"]*)"', '\1', 'g'), 
                '\s+', ' ', 'g'
            ), 
            ' '
        ) INTO search_terms;
        
        -- Remove empty terms
        search_terms := array_remove(search_terms, '');
        
        IF array_length(search_terms, 1) > 0 THEN
            -- Build OR condition for any term match
            where_clause := where_clause || ' AND (';
            FOR i IN 1..array_length(search_terms, 1) LOOP
                IF i > 1 THEN
                    where_clause := where_clause || ' OR ';
                END IF;
                where_clause := where_clause || format('content_text ILIKE %L', '%' || search_terms[i] || '%');
            END LOOP;
            where_clause := where_clause || ')';
        END IF;        ELSIF search_mode = 'MATCH_ALL' THEN
            -- MATCH_ALL mode: split query into terms and search for all terms (AND logic)
            SELECT string_to_array(
                regexp_replace(
                    regexp_replace(search_query, '"([^"]*)"', '\1', 'g'), 
                    '\s+', ' ', 'g'
                ), 
                ' '
            ) INTO search_terms;
            
            -- Remove empty terms
            search_terms := array_remove(search_terms, '');
            
            IF array_length(search_terms, 1) > 0 THEN
                -- Build AND condition for all terms match
                FOR i IN 1..array_length(search_terms, 1) LOOP
                    where_clause := where_clause || format(' AND content_text ILIKE %L', '%' || search_terms[i] || '%');
                END LOOP;
            END IF;
        END IF;
    END IF;  -- End of NOT is_empty_query condition
    
    -- Build ORDER BY clause
    IF search_order = 'MOD_TIME' THEN
        order_clause := 'ORDER BY modified_time DESC, filename ASC';
    ELSIF search_order = 'DATE' THEN
        -- For DATE ordering, we need to extract the timestamp from content
        -- This is complex, so for now we'll fall back to modification time
        order_clause := 'ORDER BY modified_time DESC, filename ASC';
    ELSE
        order_clause := 'ORDER BY filename ASC';
    END IF;
    
    -- Execute the dynamic query
    RETURN QUERY EXECUTE format('
        SELECT 
            n.filename as file,
            n.parent_path || ''/'' || n.filename as full_path,
            n.content_type,
            n.size_bytes,
            n.modified_time,
            n.created_time
        FROM vfs_nodes n 
        WHERE %s AND (%s=0 OR n.owner_id = %s OR n.is_public = TRUE) 
        %s', 
        where_clause, 
        owner_id_arg,
        owner_id_arg,
        order_clause
    );
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_ensure_path
-- Helper function to create directory path recursively (like mkdir -p)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_ensure_path(
    owner_id_arg INTEGER,
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
        IF NOT vfs_exists(current_path, part, root_key) THEN
            PERFORM vfs_mkdir(owner_id_arg, current_path, part, root_key, TRUE);
        END IF;
        
        -- Update current path
        IF current_path = '' THEN
            current_path := part;
        ELSE
            current_path := current_path || '/' || part;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_set_public
-- Sets the is_public flag on a file or directory, with option to recursively apply to children
-- Returns both success status and diagnostic information
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_set_public(
    owner_id_arg INTEGER,
    parent_path_arg TEXT,
    filename_arg TEXT,
    is_public_arg BOOLEAN,
    recursive BOOLEAN,
    root_key TEXT
)
RETURNS TABLE(success BOOLEAN, diagnostic TEXT) AS $$
DECLARE
    updated_count INTEGER := 0;
    child_count INTEGER := 0;
    is_dir BOOLEAN;
    full_path TEXT;
    target_id INTEGER;
BEGIN
    -- Check if the target exists
    SELECT id, is_directory INTO target_id, is_dir
    FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_arg
        AND filename = filename_arg
        -- It is correct and not a mistake the we don't give admin authority to do this
        AND owner_id = owner_id_arg;
    
    IF target_id IS NULL THEN
        RETURN QUERY SELECT FALSE AS success, 
                     format('Target not found: parent=[%s] file=[%s]', parent_path_arg, filename_arg) AS diagnostic;
        RETURN;
    END IF;

    -- Update the main record
    UPDATE vfs_nodes
    SET 
        is_public = is_public_arg
    WHERE 
        id = target_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- If it's a directory and recursive flag is true, update all children
    IF is_dir AND recursive THEN
        -- Build the full path for child updates
        -- Handle empty string (root) vs non-empty parent paths correctly
        IF parent_path_arg = '' THEN
            full_path := filename_arg;
        ELSE
            full_path := parent_path_arg || '/' || filename_arg;
        END IF;
        
        -- Update all children recursively
        UPDATE vfs_nodes
        SET 
            is_public = is_public_arg
        WHERE 
            doc_root_key = root_key
            AND (
                -- Direct children (parent_path = full_path)
                parent_path = full_path
                -- Or descendants (parent_path starts with full_path/)
                OR parent_path LIKE full_path || '/%'
            )
            AND owner_id = owner_id_arg;
        
        GET DIAGNOSTICS child_count = ROW_COUNT;
        
        RETURN QUERY SELECT TRUE AS success, 
                     format('Updated visibility of %s%s%s to %s. Additionally updated %s child items.', 
                           CASE WHEN parent_path_arg = '' THEN '/' ELSE parent_path_arg END,
                           CASE WHEN parent_path_arg = '' OR parent_path_arg = '/' THEN '' ELSE '/' END,
                           filename_arg, 
                           CASE WHEN is_public_arg THEN 'public' ELSE 'private' END, 
                           child_count) AS diagnostic;
    ELSE
        -- For non-recursive updates or single files
        RETURN QUERY SELECT TRUE AS success, 
                     format('Updated visibility of %s%s%s to %s.', 
                           CASE WHEN parent_path_arg = '' THEN '/' ELSE parent_path_arg END,
                           CASE WHEN parent_path_arg = '' OR parent_path_arg = '/' THEN '' ELSE '/' END,
                           filename_arg,
                           CASE WHEN is_public_arg THEN 'public' ELSE 'private' END) AS diagnostic;
    END IF;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_get_node_by_uuid
-- Gets a VFS node by its UUID, returning the node data including full path reconstruction
-- Used for UUID-based navigation to get the docPath for a specific node
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_get_node_by_uuid(
    uuid_arg UUID,
    root_key TEXT
) 
RETURNS TABLE(
    owner_id INTEGER,
    is_public BOOLEAN,
    filename VARCHAR(255),
    is_directory BOOLEAN,
    size_bytes BIGINT,
    content_type VARCHAR(100),
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE,
    parent_path TEXT,
    content_text TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.owner_id,
        n.is_public,
        n.filename,
        n.is_directory,
        n.size_bytes,
        n.content_type,
        n.created_time,
        n.modified_time,
        n.parent_path,
        n.content_text
    FROM vfs_nodes n
    WHERE 
        n.uuid = uuid_arg
        AND n.doc_root_key = root_key;
END;
$$ LANGUAGE plpgsql;
