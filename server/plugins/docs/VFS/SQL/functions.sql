-- PostgreSQL Functions for Document Filesystem
-- This file contains all PostgreSQL stored procedures for the filesystem abstraction

-- Function: vfs_readdir
-- Equivalent to fs.readdirSync() - lists directory contents
-- Returns files/folders in ordinal order with their metadata
-- Uses filename prefix for ordinal ordering instead of separate ordinal column
CREATE OR REPLACE FUNCTION vfs_readdir(
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
    FROM vfs_nodes n
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

-- Function: vfs_readdir_names
-- Simple version that just returns filenames (like fs.readdirSync() with no options)
CREATE OR REPLACE FUNCTION vfs_readdir_names(
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

-- Function: vfs_shift_ordinals_down
-- Equivalent to DocUtil.shiftOrdinalsDown() - creates space for new files by incrementing ordinals
-- This renames files to change their ordinal prefixes, just like the filesystem version
CREATE OR REPLACE FUNCTION vfs_shift_ordinals_down(
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
        FROM vfs_nodes 
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
        UPDATE vfs_nodes 
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

-- Function: vfs_get_max_ordinal
-- Equivalent to DocUtil.getMaxOrdinal() - finds highest ordinal in a directory
-- Extracts ordinal from filename prefix instead of using ordinal column
CREATE OR REPLACE FUNCTION vfs_get_max_ordinal(
    parent_path_param TEXT,
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
        AND parent_path = parent_path_param
        AND filename ~ '^[0-9]+_';  -- Only consider files with ordinal prefixes
        
    RETURN max_ord;
END;
$$ LANGUAGE plpgsql;

-- Function: vfs_get_ordinal_from_name
-- Equivalent to DocUtil.getOrdinalFromName() - extracts ordinal from filename prefix
CREATE OR REPLACE FUNCTION vfs_get_ordinal_from_name(
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
        SELECT 1 FROM vfs_nodes
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

-- Function: vfs_insert_file_at_ordinal
-- Helper function to insert a new file at a specific ordinal position
-- Automatically shifts existing files down if needed and creates proper ordinal filename
CREATE OR REPLACE FUNCTION vfs_insert_file_at_ordinal(
    parent_path_param TEXT,
    filename_param TEXT,
    insert_ordinal INTEGER,
    root_key TEXT,
    is_directory_param BOOLEAN DEFAULT FALSE,
    content_param BYTEA DEFAULT NULL,
    content_type_param TEXT DEFAULT NULL,
    is_binary_param BOOLEAN DEFAULT TRUE
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
    FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename ~ '^[0-9]+_'
        AND substring(filename FROM '^([0-9]+)_')::INTEGER >= insert_ordinal;
    
    -- If files exist at or after this ordinal, shift them down
    IF existing_file_count > 0 THEN
        PERFORM vfs_shift_ordinals_down(1, parent_path_param, insert_ordinal, root_key);
    END IF;
    
    -- Filename MUST already have ordinal prefix - no automatic addition
    IF filename_param ~ '^[0-9]+_' THEN
        final_filename := filename_param;
    ELSE
        RAISE EXCEPTION 'Invalid filename: %. All filenames must have ordinal prefix format "NNNN_filename".', filename_param;
    END IF;
    
    -- Insert the new file at the desired ordinal position
    INSERT INTO vfs_nodes (
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
        modified_time
    ) VALUES (
        root_key,
        parent_path_param,
        final_filename,
        is_directory_param,
        CASE 
            WHEN is_directory_param OR content_param IS NULL THEN NULL
            WHEN is_binary_param THEN NULL
            ELSE convert_from(content_param, 'UTF8')
        END,
        CASE 
            WHEN is_directory_param OR content_param IS NULL THEN NULL
            WHEN is_binary_param THEN content_param
            ELSE NULL
        END,
        CASE 
            WHEN is_directory_param THEN FALSE
            ELSE COALESCE(is_binary_param, TRUE)
        END,
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

-- Function: vfs_read_file
-- Equivalent to fs.readFileSync() - reads file content (both text and binary)
-- Returns BYTEA for compatibility, but content comes from appropriate column
CREATE OR REPLACE FUNCTION vfs_read_file(
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
        AND is_directory = FALSE;
        
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

-- Function: vfs_write_text_file
-- Equivalent to fs.writeFileSync() for text files - writes text file content
-- Uses filename prefixes for ordinal management instead of ordinal column
CREATE OR REPLACE FUNCTION vfs_write_text_file(
    parent_path_param TEXT,
    filename_param TEXT,
    content_data TEXT,
    root_key TEXT,
    content_type_param TEXT DEFAULT 'text/plain'
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
        modified_time
    ) VALUES (
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
        NOW()
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

-- Function: vfs_write_binary_file
-- Equivalent to fs.writeFileSync() for binary files - writes binary file content
-- Uses filename prefixes for ordinal management instead of ordinal column
CREATE OR REPLACE FUNCTION vfs_write_binary_file(
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
BEGIN
    file_size := LENGTH(content_data);
    
    -- Filename MUST already have ordinal prefix - no automatic addition
    IF filename_param ~ '^[0-9]+_' THEN
        final_filename := filename_param;
    ELSE
        RAISE EXCEPTION 'Invalid filename: %. All filenames must have ordinal prefix format "NNNN_filename".', filename_param;
    END IF;
    
    INSERT INTO vfs_nodes (
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
        modified_time
    ) VALUES (
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
        NOW()
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

-- Function: vfs_exists
-- Equivalent to fs.existsSync() - checks if file or directory exists
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

-- Function: vfs_stat
-- Equivalent to fs.statSync() - gets file/directory metadata
-- Extracts ordinal from filename prefix instead of using ordinal column
CREATE OR REPLACE FUNCTION vfs_stat(
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
    FROM vfs_nodes n
    WHERE 
        n.doc_root_key = root_key
        AND n.parent_path = parent_path_param
        AND n.filename = filename_param;
END;
$$ LANGUAGE plpgsql;

-- Function: vfs_unlink
-- Equivalent to fs.unlinkSync() - deletes a file
CREATE OR REPLACE FUNCTION vfs_unlink(
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
        AND is_directory = FALSE;
        
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count = 0 THEN
        RAISE EXCEPTION 'File not found: %/%', parent_path_param, filename_param;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: vfs_rename
-- Equivalent to fs.renameSync() - renames/moves a file or directory
-- For directories, also updates the parent_path of all nested children
CREATE OR REPLACE FUNCTION vfs_rename(
    old_parent_path TEXT,
    old_filename TEXT,
    new_parent_path TEXT,
    new_filename TEXT,
    root_key TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER;
    is_dir BOOLEAN;
    old_full_path TEXT;
    new_full_path TEXT;
BEGIN
    -- Check if target already exists
    IF vfs_exists(new_parent_path, new_filename, root_key) THEN
        RAISE EXCEPTION 'Target already exists: %/%', new_parent_path, new_filename;
    END IF;
    
    -- Check if the item being renamed is a directory
    SELECT is_directory INTO is_dir
    FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = old_parent_path
        AND filename = old_filename;
    
    IF is_dir IS NULL THEN
        RAISE EXCEPTION 'Source file not found: %/%', old_parent_path, old_filename;
    END IF;
    
    -- Update the main record
    UPDATE vfs_nodes
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
    
    -- If it's a directory, update all children's parent_path
    IF is_dir THEN
        -- Construct old and new full paths
        old_full_path := CASE 
            WHEN old_parent_path = '' THEN old_filename
            ELSE old_parent_path || '/' || old_filename
        END;
        
        new_full_path := CASE 
            WHEN new_parent_path = '' THEN new_filename
            ELSE new_parent_path || '/' || new_filename
        END;
        
        -- Update all children (files and subdirectories) whose parent_path starts with the old path
        UPDATE vfs_nodes
        SET 
            parent_path = new_full_path || SUBSTRING(parent_path FROM LENGTH(old_full_path) + 1),
            modified_time = NOW()
        WHERE 
            doc_root_key = root_key
            AND parent_path LIKE old_full_path || '%';
            
        -- Log how many children were updated
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE 'Updated % children for directory rename', updated_count;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- DIRECTORY OPERATIONS
-- ==============================================================================

-- Function: vfs_mkdir
-- Equivalent to fs.mkdirSync() - creates a directory
-- Uses filename prefixes for ordinal management instead of ordinal column
CREATE OR REPLACE FUNCTION vfs_mkdir(
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
        IF vfs_exists(parent_path_param, dirname_param, root_key) THEN
            RAISE EXCEPTION 'Directory already exists: %/%', parent_path_param, dirname_param;
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid directory name: %. All directory names must have ordinal prefix format "NNNN_dirname".', dirname_param;
    END IF;
    
    -- Create the directory
    INSERT INTO vfs_nodes (
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
        modified_time
    ) VALUES (
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
        NOW()
    ) RETURNING id INTO dir_id;
    
    RETURN dir_id;
END;
$$ LANGUAGE plpgsql;

-- Function: vfs_rmdir
-- Equivalent to fs.rmSync() - removes a directory (with recursive option)
CREATE OR REPLACE FUNCTION vfs_rmdir(
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
    IF NOT vfs_exists(parent_path_param, dirname_param, root_key) THEN
        IF NOT force_flag THEN
            RAISE EXCEPTION 'Directory not found: %/%', parent_path_param, dirname_param;
        END IF;
        RETURN 0;
    END IF;
    
    -- Check if directory has children
    SELECT COUNT(*)
    INTO child_count
    FROM vfs_nodes
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
            FROM vfs_nodes
            WHERE doc_root_key = root_key AND parent_path = dir_path
            
            UNION ALL
            
            -- Recursive case: children of subdirectories
            SELECT n.id, n.parent_path, n.filename, n.is_directory
            FROM vfs_nodes n
            INNER JOIN dir_tree dt ON n.parent_path = dt.parent_path || '/' || dt.filename
            WHERE n.doc_root_key = root_key AND dt.is_directory = TRUE
        )
        DELETE FROM vfs_nodes
        WHERE id IN (SELECT id FROM dir_tree);
    END IF;
    
    -- Delete the directory itself
    DELETE FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = dirname_param
        AND is_directory = TRUE;
        
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: vfs_is_directory
-- Helper function to check if a path is a directory
CREATE OR REPLACE FUNCTION vfs_is_directory(
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
    FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param;
        
    RETURN COALESCE(is_dir, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function: vfs_ensure_path
-- Helper function to create directory path recursively (like mkdir -p)
CREATE OR REPLACE FUNCTION vfs_ensure_path(
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
            PERFORM vfs_mkdir(current_path, part, root_key, TRUE);
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

-- Function: vfs_search_text
-- PostgreSQL-based text search function for VFS
-- Searches through text content in non-binary files
-- Supports REGEX, MATCH_ANY, and MATCH_ALL search modes
-- Optionally filters by timestamp requirements
CREATE OR REPLACE FUNCTION vfs_search_text(
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
BEGIN
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
    
    -- Build search condition based on mode
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
        END IF;
        
    ELSIF search_mode = 'MATCH_ALL' THEN
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
        WHERE %s
        %s', 
        where_clause, 
        order_clause
    );
END;
$$ LANGUAGE plpgsql;
