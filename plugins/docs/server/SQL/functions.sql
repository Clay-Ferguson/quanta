-- PostgreSQL Functions for VFS Document Filesystem
-- This file contains all PostgreSQL stored procedures for the VFS filesystem abstraction

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_readdir
-- Equivalent to fs.readdirSync() - lists directory contents
-- Returns files/folders in ordinal order with their metadata
-- Uses the ordinal column instead of filename prefix for ordering (key difference from VFS)
-- Optional include_content parameter includes content_text column when true
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_readdir(
    owner_id_arg INTEGER,
    dir_path TEXT,
    root_key TEXT,
    include_content BOOLEAN DEFAULT FALSE
) 
RETURNS TABLE(
    uuid UUID,
    owner_id INTEGER,
    is_public BOOLEAN,
    filename VARCHAR(255),
    is_directory BOOLEAN,
    size_bytes BIGINT,
    content_type VARCHAR(100),
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE,
    ordinal INTEGER,
    content_text TEXT
) AS $$
BEGIN
    IF include_content THEN
        RETURN QUERY
        SELECT 
            n.uuid,
            n.owner_id,
            n.is_public,
            n.filename,
            n.is_directory,
            n.size_bytes,
            n.content_type,
            n.created_time,
            n.modified_time,
            n.ordinal,
            n.content_text
        FROM vfs_nodes n
        WHERE 
            n.doc_root_key = root_key 
            AND n.parent_path = dir_path
            AND (owner_id_arg=0 OR n.owner_id = owner_id_arg OR n.is_public = TRUE) 
        ORDER BY 
            n.ordinal ASC, n.filename ASC;
    ELSE
        RETURN QUERY
        SELECT 
            n.uuid,
            n.owner_id,
            n.is_public,
            n.filename,
            n.is_directory,
            n.size_bytes,
            n.content_type,
            n.created_time,
            n.modified_time,
            n.ordinal,
            NULL::TEXT as content_text
        FROM vfs_nodes n
        WHERE 
            n.doc_root_key = root_key 
            AND n.parent_path = dir_path
            AND (owner_id_arg=0 OR n.owner_id = owner_id_arg OR n.is_public = TRUE) 
        ORDER BY 
            n.ordinal ASC, n.filename ASC;
    END IF;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_readdir_by_owner
-- Finds all files/folders in the specified path owned by the specified owner
-- Returns files/folders in ordinal order with their metadata
-- Uses the ordinal column instead of filename prefix for ordering (key difference from VFS)
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
    modified_time TIMESTAMP WITH TIME ZONE,
    ordinal INTEGER
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
        n.ordinal
    FROM vfs_nodes n
    WHERE 
        n.doc_root_key = root_key 
        AND n.parent_path = dir_path
        AND n.owner_id = owner_id_arg 
    ORDER BY 
        n.ordinal ASC, n.filename ASC;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_get_max_ordinal
-- Equivalent to DocUtil.getMaxOrdinal() - finds highest ordinal in a directory
-- Uses the ordinal column directly instead of parsing filename prefixes (key difference from VFS)
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
    SELECT COALESCE(MAX(ordinal), 0)
    INTO max_ord
    FROM vfs_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_arg;
        
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
-- Uses direct filename matching instead of ordinal prefix parsing (key difference from VFS)
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
-- Uses ordinal column directly instead of filename prefix management (key difference from VFS)
-- Ordinal parameter is optional - if null, automatically calculates next available ordinal (max + 1)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_write_text_file(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    content_data TEXT,
    root_key TEXT,
    ordinal_param INTEGER,
    content_type_param TEXT DEFAULT 'text/plain',
    is_public_param BOOLEAN DEFAULT FALSE
) 
RETURNS INTEGER AS $$
DECLARE
    file_id INTEGER;
    file_size BIGINT;
    final_ordinal INTEGER;
BEGIN
    file_size := LENGTH(content_data);
    
    -- If ordinal is null, calculate the next available ordinal (max + 1)
    IF ordinal_param IS NULL THEN
        SELECT COALESCE(MAX(ordinal), -1) + 1
        INTO final_ordinal
        FROM vfs_nodes 
        WHERE doc_root_key = root_key AND parent_path = parent_path_param;
    ELSE
        final_ordinal := ordinal_param;
    END IF;
    
    INSERT INTO vfs_nodes (
        owner_id,
        doc_root_key,
        parent_path,
        filename,
        ordinal,
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
        filename_param,
        final_ordinal,
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
        ordinal = final_ordinal,
        is_public = is_public_param,
        modified_time = NOW()
    RETURNING id INTO file_id;
    
    RETURN file_id;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_write_binary_file
-- Equivalent to fs.writeFileSync() for binary files - writes binary file content
-- Uses ordinal column directly instead of filename prefix management (key difference from VFS)
-- Ordinal parameter is optional - if null, automatically calculates next available ordinal (max + 1)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_write_binary_file(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    content_data BYTEA,
    root_key TEXT,
    ordinal_param INTEGER,
    content_type_param TEXT DEFAULT 'application/octet-stream',
    is_public_param BOOLEAN DEFAULT FALSE
) 
RETURNS INTEGER AS $$
DECLARE
    file_id INTEGER;
    file_size BIGINT;
    final_ordinal INTEGER;
BEGIN
    file_size := LENGTH(content_data);
    
    -- If ordinal is null, calculate the next available ordinal (max + 1)
    IF ordinal_param IS NULL THEN
        SELECT COALESCE(MAX(ordinal), -1) + 1
        INTO final_ordinal
        FROM vfs_nodes 
        WHERE doc_root_key = root_key AND parent_path = parent_path_param;
    ELSE
        final_ordinal := ordinal_param;
    END IF;
    
    INSERT INTO vfs_nodes (
        owner_id,
        doc_root_key,
        parent_path,
        filename,
        ordinal,
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
        filename_param,
        final_ordinal,
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
        ordinal = final_ordinal,
        is_public = is_public_param,
        modified_time = NOW()
    RETURNING id INTO file_id;
    
    RETURN file_id;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_exists
-- Equivalent to fs.existsSync() - checks if file or directory exists
-- Uses vfs_nodes table instead of vfs_nodes (key difference from VFS)
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
-- Uses vfs_nodes table and includes ordinal column (key difference from VFS)
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
    ordinal INTEGER,
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
        n.ordinal,
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
-- Uses vfs_nodes table and includes ordinal column (key difference from VFS)
-- Returns file/directory metadata including ordinal information
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
    content_type VARCHAR(100),
    ordinal INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.is_public,
        n.is_directory,
        n.size_bytes,
        n.created_time,
        n.modified_time,
        n.content_type,
        n.ordinal
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
-- Uses vfs_nodes table instead of vfs_nodes (key difference from VFS)
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
-- Uses vfs_nodes table instead of vfs_nodes (key difference from VFS)
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

-- ==============================================================================
-- DIRECTORY OPERATIONS
-- ==============================================================================

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_mkdir
-- Equivalent to fs.mkdirSync() - creates a directory
-- Uses ordinal column directly instead of filename prefix management (key difference from VFS)
-- Ordinal parameter is optional - if null, automatically calculates next available ordinal (max + 1)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_mkdir(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    dirname_param TEXT,
    root_key TEXT,
    ordinal_param INTEGER,
    recursive_flag BOOLEAN DEFAULT FALSE,
    is_public_arg BOOLEAN DEFAULT FALSE
) 
RETURNS INTEGER AS $$
DECLARE
    dir_id INTEGER;
    inserted_count INTEGER;
    final_ordinal INTEGER;
BEGIN
    -- Check if directory already exists
    IF vfs_exists(parent_path_param, dirname_param, root_key) THEN
        RAISE EXCEPTION 'Directory already exists: %/%', parent_path_param, dirname_param;
    END IF;
    
    -- If ordinal is null, calculate the next available ordinal (max + 1)
    IF ordinal_param IS NULL THEN
        SELECT COALESCE(MAX(ordinal), -1) + 1
        INTO final_ordinal
        FROM vfs_nodes 
        WHERE doc_root_key = root_key AND parent_path = parent_path_param;
    ELSE
        final_ordinal := ordinal_param;
    END IF;
    
    -- Create the directory
    INSERT INTO vfs_nodes (
        owner_id,
        doc_root_key,
        parent_path,
        filename,
        ordinal,
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
        dirname_param,
        final_ordinal,
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
    
    -- Verify the INSERT actually worked
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    
    IF inserted_count = 0 OR dir_id IS NULL THEN
        RAISE EXCEPTION 'vfs_mkdir: Failed to insert directory [%] in parent [%] - no rows inserted or ID returned', 
            dirname_param, parent_path_param;
    END IF;
    
    -- Double-check that we can find the directory we just created
    IF NOT vfs_exists(parent_path_param, dirname_param, root_key) THEN
        RAISE EXCEPTION 'vfs_mkdir: Directory was inserted (ID: %) but vfs_exists cannot find it: parent=[%] name=[%] root=[%]', 
            dir_id, parent_path_param, dirname_param, root_key;
    END IF;
    
    RETURN dir_id;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_rmdir
-- Equivalent to fs.rmSync() - removes a directory recursively
-- Uses vfs_nodes table instead of vfs_nodes (key difference from VFS)
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
-- Uses vfs_nodes table instead of vfs_nodes (key difference from VFS)
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
-- Function: vfs_ensure_path
-- Helper function to create directory path recursively (like mkdir -p)
-- Uses ordinal column directly instead of filename prefix management (key difference from VFS)
-- Each directory created gets an automatically assigned ordinal based on max ordinal + 1
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
    next_ordinal INTEGER;
    clean_path TEXT;
    dir_id INTEGER;
BEGIN
    -- Clean and normalize the path (preserve leading slash if present)
    clean_path := trim(trailing '/' from full_path);
    
    -- If empty path or just "/", nothing to create
    IF clean_path = '' OR clean_path = '/' THEN
        RETURN TRUE;
    END IF;
    
    -- Remove leading slash for splitting, but we'll add it back for parent paths
    IF clean_path LIKE '/%' THEN
        clean_path := substring(clean_path from 2);
    END IF;
    
    -- Split path into parts
    path_parts := string_to_array(clean_path, '/');
    current_path := '';
    
    -- Create each directory in the path if it doesn't exist
    FOR i IN 1..array_length(path_parts, 1) LOOP
        part := path_parts[i];
        
        -- Skip empty parts
        IF part = '' OR part IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Check if this directory exists
        IF NOT vfs_exists(current_path, part, root_key) THEN
            -- Get the next ordinal for this directory level
            next_ordinal := vfs_get_max_ordinal(current_path, root_key) + 1;
            
            BEGIN
                -- Create the directory with auto-assigned ordinal
                dir_id := vfs_mkdir(owner_id_arg, current_path, part, root_key, next_ordinal, TRUE, FALSE);
                
                -- Verify the directory was actually created
                IF NOT vfs_exists(current_path, part, root_key) THEN
                    RAISE EXCEPTION 'vfs_ensure_path: Directory creation succeeded (ID: %) but vfs_exists still returns false for: parent_path=[%] filename=[%] root_key=[%]', 
                        dir_id, current_path, part, root_key;
                END IF;
                
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE EXCEPTION 'vfs_ensure_path: Failed to create directory [%] in parent path [%]. Original error: %', 
                        part, current_path, SQLERRM;
            END;
        END IF;
        
        -- Update current path for next iteration, maintaining leading slash pattern
        IF current_path = '' THEN
            current_path := '/' || part;
        ELSE
            current_path := current_path || '/' || part;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_rename
-- Equivalent to fs.renameSync() - renames/moves a file or directory
-- For directories, also updates the parent_path of all nested children
-- Returns both success status and diagnostic information
-- Uses vfs_nodes table instead of vfs_nodes (key difference from VFS)
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
    -- For same-folder renames (where parent path doesn't change), we don't need to change ordinal
    -- For cross-folder moves, use a unique temporary negative ordinal to avoid unique constraint violations
    -- We use (-2147483648 + id) to ensure uniqueness since each node has a unique ID
    -- The calling code (DocMod.ts) will set the correct ordinal immediately after rename
    UPDATE vfs_nodes
    SET 
        parent_path = new_parent_path,
        filename = new_filename,
        modified_time = NOW(),
        ordinal = CASE 
            WHEN old_parent_path = new_parent_path THEN ordinal  -- Same folder: keep ordinal
            ELSE -2147483648 + id  -- Cross-folder: use unique temp ordinal based on node ID
        END
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
            END,
            modified_time = NOW()
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

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_set_public
-- Sets the is_public flag for a file or directory
-- Returns true if the operation was successful
-- Uses vfs_nodes table instead of vfs_nodes (key difference from VFS)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_set_public(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT,
    is_public_param BOOLEAN
) 
RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update the is_public flag
    UPDATE vfs_nodes
    SET 
        is_public = is_public_param,
        modified_time = NOW()
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param
        AND (owner_id_arg = 0 OR owner_id = owner_id_arg);
        
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count = 0 THEN
        RAISE EXCEPTION 'File or directory not found or access denied: %/%', parent_path_param, filename_param;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_get_node_by_uuid
-- Gets a VFS node by its UUID, returning the node data including full path reconstruction
-- Used for UUID-based navigation to get the docPath for a specific node
-- Uses vfs_nodes table and includes ordinal column (key difference from VFS)
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
    ordinal INTEGER,
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
        n.ordinal,
        n.content_text
    FROM vfs_nodes n
    WHERE 
        n.uuid = uuid_arg
        AND n.doc_root_key = root_key;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_search_text
-- PostgreSQL-based text search function for VFS
-- Searches through text content in non-binary files
-- Supports REGEX, MATCH_ANY, and MATCH_ALL search modes
-- Optionally filters by timestamp requirements
-- Uses vfs_nodes table instead of vfs_nodes (key difference from VFS)
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
-- Function: vfs_shift_ordinals_down
-- Shifts ordinals down for all files/folders at or above a given ordinal position
-- This creates space for new files to be inserted at specific positions
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_shift_ordinals_down(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    root_key TEXT,
    insert_ordinal INTEGER,
    slots_to_add INTEGER
) 
RETURNS TABLE(
    old_filename VARCHAR(255),
    new_filename VARCHAR(255),
    old_ordinal INTEGER,
    new_ordinal INTEGER
) AS $$
DECLARE
    affected_row RECORD;
    row_count INTEGER := 0;
BEGIN
    -- RAISE NOTICE '[vfs_shift_ordinals_down] Starting with owner_id=%, parent_path=%, root_key=%, insert_ordinal=%, slots_to_add=%', 
    --     owner_id_arg, parent_path_param, root_key, insert_ordinal, slots_to_add;
    
    -- First, lock and select all rows that need to be shifted in reverse ordinal order
    -- This prevents conflicts by updating highest ordinals first
    FOR affected_row IN
        SELECT *
        FROM vfs_nodes
        WHERE 
            doc_root_key = root_key 
            AND parent_path = parent_path_param
            AND owner_id = owner_id_arg
            AND ordinal >= insert_ordinal
        ORDER BY ordinal DESC
        FOR UPDATE
    LOOP
        row_count := row_count + 1;
        -- RAISE NOTICE '[vfs_shift_ordinals_down] Processing row %: filename=%, old_ordinal=%, new_ordinal=%', 
        --     row_count, affected_row.filename, affected_row.ordinal, affected_row.ordinal + slots_to_add;
        
        -- Update each row individually in reverse order to avoid unique constraint violations
        UPDATE vfs_nodes 
        SET ordinal = affected_row.ordinal + slots_to_add
        WHERE uuid = affected_row.uuid;
        
        -- Return the affected item for tracking
        RETURN QUERY SELECT 
            affected_row.filename,
            affected_row.filename,
            affected_row.ordinal,
            affected_row.ordinal + slots_to_add;
    END LOOP;
    
    -- RAISE NOTICE '[vfs_shift_ordinals_down] Completed, processed % rows', row_count;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_swap_ordinals
-- Swaps the ordinal values of two files/folders in a single atomic operation
-- This handles the unique constraint on (doc_root_key, parent_path, ordinal) by using
-- a temporary negative value during the swap operation within a single transaction
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs_swap_ordinals(
    uuid1_arg UUID,
    uuid2_arg UUID,
    root_key TEXT
) 
RETURNS TABLE(
    uuid1 UUID,
    ordinal1 INTEGER,
    uuid2 UUID,
    ordinal2 INTEGER
) AS $$
DECLARE
    ord1 INTEGER;
    ord2 INTEGER;
    temp_ordinal INTEGER;
BEGIN
    -- Get the current ordinals for both items
    SELECT ordinal INTO ord1 
    FROM vfs_nodes 
    WHERE uuid = uuid1_arg AND doc_root_key = root_key;
    
    SELECT ordinal INTO ord2 
    FROM vfs_nodes 
    WHERE uuid = uuid2_arg AND doc_root_key = root_key;
    
    IF ord1 IS NULL THEN
        RAISE EXCEPTION 'Item with UUID % not found', uuid1_arg;
    END IF;
    
    IF ord2 IS NULL THEN
        RAISE EXCEPTION 'Item with UUID % not found', uuid2_arg;
    END IF;
    
    -- Use a unique temporary negative ordinal based on the first item's ID to avoid conflicts
    -- This ensures that even if multiple swaps happen in the same parent folder,
    -- each one uses a different temporary ordinal value
    SELECT (-2147483648 + id) INTO temp_ordinal
    FROM vfs_nodes 
    WHERE uuid = uuid1_arg AND doc_root_key = root_key;
    
    -- Perform the swap in three steps within the same transaction:
    -- 1. Set first item to temporary value
    UPDATE vfs_nodes 
    SET ordinal = temp_ordinal 
    WHERE uuid = uuid1_arg AND doc_root_key = root_key;
    
    -- 2. Set second item to first item's original value
    UPDATE vfs_nodes 
    SET ordinal = ord1 
    WHERE uuid = uuid2_arg AND doc_root_key = root_key;
    
    -- 3. Set first item to second item's original value
    UPDATE vfs_nodes 
    SET ordinal = ord2 
    WHERE uuid = uuid1_arg AND doc_root_key = root_key;
    
    -- Return the swap details
    RETURN QUERY SELECT uuid1_arg, ord2, uuid2_arg, ord1;
END;
$$ LANGUAGE plpgsql;