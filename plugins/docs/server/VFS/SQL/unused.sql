-- ************
-- AI Agent generated these functions due to a misunderstood prompt but I want to keep for now.
-- ************

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_get_ordinal_from_name
-- Equivalent to DocUtil.getOrdinalFromName() - extracts ordinal from filename prefix
-----------------------------------------------------------------------------------------------------------
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

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_shift_ordinals_down
-- Equivalent to DocUtil.shiftOrdinalsDown() - creates space for new files by incrementing ordinals
-- This renames files to change their ordinal prefixes, just like the filesystem version
-----------------------------------------------------------------------------------------------------------
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
        
        -- Check if this is a directory before updating
        DECLARE
            node_is_dir BOOLEAN := FALSE;
            old_path TEXT;
            new_path TEXT;
        BEGIN
            -- Check if node is a directory
            SELECT is_directory INTO node_is_dir
            FROM vfs_nodes
            WHERE 
                doc_root_key = root_key
                AND parent_path = parent_path_param
                AND filename = file_record.filename;
                
            -- If it's a directory, prepare paths for child updates
            IF node_is_dir THEN
                -- Construct paths based on parent_path format
                IF parent_path_param = '' THEN
                    old_path := '/' || file_record.filename;
                    new_path := '/' || new_filename_text;
                ELSE
                    old_path := parent_path_param || '/' || file_record.filename;
                    new_path := parent_path_param || '/' || new_filename_text;
                END IF;
            END IF;
            
            -- Update the filename in the database
            UPDATE vfs_nodes 
            SET 
                filename = new_filename_text,
                modified_time = NOW()
            WHERE 
                doc_root_key = root_key
                AND parent_path = parent_path_param
                AND filename = file_record.filename;
                
            -- If it's a directory, update child paths after renaming
            IF node_is_dir THEN
                UPDATE vfs_nodes
                SET 
                    parent_path = new_path || SUBSTRING(parent_path FROM LENGTH(old_path) + 1),
                    modified_time = NOW()
                WHERE 
                    doc_root_key = root_key
                    AND parent_path LIKE old_path || '%';
            END IF;
        END;
        
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

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_insert_file_at_ordinal
-- Helper function to insert a new file at a specific ordinal position
-- Automatically shifts existing files down if needed and creates proper ordinal filename
-----------------------------------------------------------------------------------------------------------
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

-----------------------------------------------------------------------------------------------------------
-- Function: vfs_is_directory
-- Helper function to check if a path is a directory
-----------------------------------------------------------------------------------------------------------
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

