import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function getNodeByNameTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-get-node-by-name';
    
    try {
        console.log('=== VFS Get Node By Name Test Starting ===');

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            `, testRootKey, testParentPath);
        } catch (cleanupError) {
            console.log('Warning: Initial cleanup failed (this is usually not a problem):', cleanupError);
        }
        
        // Test 1: Check that non-existent file returns no rows
        console.log('Testing vfs_get_node_by_name for non-existent file...');
        
        const nonExistentResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_name($1, $2, $3)
        `, testParentPath, 'non-existent-file.txt', testRootKey);
        
        console.log(`Non-existent file query returned ${nonExistentResult.rows.length} rows`);
        
        if (nonExistentResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for non-existent file, got: ${nonExistentResult.rows.length}`);
        }

        console.log('✅ Non-existent file test passed');

        // Test 2: Create a text file and verify we can get its node data
        const textFilename = 'test-file.md';
        const textContent = 'This is a **test markdown** file for get_node_by_name testing.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1000;

        console.log('Creating test text file...');
        
        const insertResult = await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, uuid, created_time, modified_time
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, textContentType, Buffer.from(textContent).length);
        
        const expectedId = insertResult.rows[0].id;
        const expectedUuid = insertResult.rows[0].uuid;
        const expectedCreatedTime = insertResult.rows[0].created_time;
        const expectedModifiedTime = insertResult.rows[0].modified_time;
        
        console.log(`Created text file: ${textFilename} with ID: ${expectedId}, UUID: ${expectedUuid}`);

        // Test that we can get the complete node data
        console.log('Testing vfs_get_node_by_name for existing text file...');
        
        const textFileResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_name($1, $2, $3)
        `, testParentPath, textFilename, testRootKey);
        
        console.log(`Text file query returned ${textFileResult.rows.length} rows`);
        
        if (textFileResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing text file, got: ${textFileResult.rows.length}`);
        }

        const retrievedNode = textFileResult.rows[0];
        
        console.log('Verifying retrieved node data...');
        console.log(`Expected ID: ${expectedId}, Retrieved ID: ${retrievedNode.id}`);
        console.log(`Expected UUID: ${expectedUuid}, Retrieved UUID: ${retrievedNode.uuid}`);
        console.log(`Expected filename: ${textFilename}, Retrieved filename: ${retrievedNode.filename}`);
        console.log(`Expected ordinal: ${textOrdinal}, Retrieved ordinal: ${retrievedNode.ordinal}`);
        console.log(`Expected content: "${textContent.substring(0, 50)}...", Retrieved content: "${retrievedNode.content_text ? retrievedNode.content_text.substring(0, 50) : 'null'}..."`);
        
        // Verify all the node data matches expectations
        if (retrievedNode.id !== expectedId) {
            throw new Error(`ID mismatch! Expected: ${expectedId}, Got: ${retrievedNode.id}`);
        }
        
        if (retrievedNode.uuid !== expectedUuid) {
            throw new Error(`UUID mismatch! Expected: ${expectedUuid}, Got: ${retrievedNode.uuid}`);
        }
        
        if (retrievedNode.owner_id !== owner_id) {
            throw new Error(`Owner ID mismatch! Expected: ${owner_id}, Got: ${retrievedNode.owner_id}`);
        }
        
        if (retrievedNode.doc_root_key !== testRootKey) {
            throw new Error(`Doc root key mismatch! Expected: ${testRootKey}, Got: ${retrievedNode.doc_root_key}`);
        }
        
        if (retrievedNode.parent_path !== testParentPath) {
            throw new Error(`Parent path mismatch! Expected: ${testParentPath}, Got: ${retrievedNode.parent_path}`);
        }
        
        if (retrievedNode.filename !== textFilename) {
            throw new Error(`Filename mismatch! Expected: ${textFilename}, Got: ${retrievedNode.filename}`);
        }
        
        if (retrievedNode.ordinal !== textOrdinal) {
            throw new Error(`Ordinal mismatch! Expected: ${textOrdinal}, Got: ${retrievedNode.ordinal}`);
        }
        
        if (retrievedNode.is_directory !== false) {
            throw new Error(`Directory flag mismatch! Expected: false, Got: ${retrievedNode.is_directory}`);
        }
        
        if (retrievedNode.content_text !== textContent) {
            throw new Error(`Content text mismatch! Expected: "${textContent}", Got: "${retrievedNode.content_text}"`);
        }
        
        if (retrievedNode.content_binary !== null) {
            throw new Error(`Content binary should be null for text file! Got: ${retrievedNode.content_binary}`);
        }
        
        if (retrievedNode.is_binary !== false) {
            throw new Error(`Binary flag mismatch! Expected: false, Got: ${retrievedNode.is_binary}`);
        }
        
        if (retrievedNode.content_type !== textContentType) {
            throw new Error(`Content type mismatch! Expected: ${textContentType}, Got: ${retrievedNode.content_type}`);
        }
        
        if (Number(retrievedNode.size_bytes) !== Buffer.from(textContent).length) {
            throw new Error(`Size mismatch! Expected: ${Buffer.from(textContent).length}, Got: ${retrievedNode.size_bytes}`);
        }
        
        if (retrievedNode.is_public !== false) {
            throw new Error(`Public flag mismatch! Expected: false, Got: ${retrievedNode.is_public}`);
        }
        
        // Timestamps should match (allowing for small differences due to precision)
        const createdTimeDiff = Math.abs(new Date(retrievedNode.created_time).getTime() - new Date(expectedCreatedTime).getTime());
        const modifiedTimeDiff = Math.abs(new Date(retrievedNode.modified_time).getTime() - new Date(expectedModifiedTime).getTime());
        
        if (createdTimeDiff > 1000) { // Allow 1 second difference
            throw new Error(`Created time mismatch! Expected: ${expectedCreatedTime}, Got: ${retrievedNode.created_time}`);
        }
        
        if (modifiedTimeDiff > 1000) { // Allow 1 second difference
            throw new Error(`Modified time mismatch! Expected: ${expectedModifiedTime}, Got: ${retrievedNode.modified_time}`);
        }

        console.log('✅ Existing text file node retrieval test passed');

        // Test 3: Create a directory and verify we can get its node data
        const dirFilename = 'test-directory';
        const dirOrdinal = 2000;

        console.log('Creating test directory...');
        
        const dirInsertResult = await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, uuid
        `, owner_id, testRootKey, testParentPath, dirFilename, dirOrdinal,
        true, true, null, null, false, 'directory', 0);
        
        const expectedDirId = dirInsertResult.rows[0].id;
        const expectedDirUuid = dirInsertResult.rows[0].uuid;
        
        console.log(`Created directory: ${dirFilename} with ID: ${expectedDirId}, UUID: ${expectedDirUuid}`);

        // Test that we can get the directory node data
        console.log('Testing vfs_get_node_by_name for existing directory...');
        
        const dirResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_name($1, $2, $3)
        `, testParentPath, dirFilename, testRootKey);
        
        if (dirResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing directory, got: ${dirResult.rows.length}`);
        }

        const retrievedDir = dirResult.rows[0];
        
        console.log('Verifying retrieved directory node data...');
        
        if (retrievedDir.id !== expectedDirId) {
            throw new Error(`Directory ID mismatch! Expected: ${expectedDirId}, Got: ${retrievedDir.id}`);
        }
        
        if (retrievedDir.filename !== dirFilename) {
            throw new Error(`Directory filename mismatch! Expected: ${dirFilename}, Got: ${retrievedDir.filename}`);
        }
        
        if (retrievedDir.ordinal !== dirOrdinal) {
            throw new Error(`Directory ordinal mismatch! Expected: ${dirOrdinal}, Got: ${retrievedDir.ordinal}`);
        }
        
        if (retrievedDir.is_directory !== true) {
            throw new Error(`Directory flag mismatch! Expected: true, Got: ${retrievedDir.is_directory}`);
        }
        
        if (retrievedDir.is_public !== true) {
            throw new Error(`Directory public flag mismatch! Expected: true, Got: ${retrievedDir.is_public}`);
        }
        
        if (retrievedDir.content_text !== null) {
            throw new Error(`Directory content_text should be null! Got: ${retrievedDir.content_text}`);
        }
        
        if (retrievedDir.content_binary !== null) {
            throw new Error(`Directory content_binary should be null! Got: ${retrievedDir.content_binary}`);
        }
        
        if (retrievedDir.content_type !== 'directory') {
            throw new Error(`Directory content_type mismatch! Expected: 'directory', Got: ${retrievedDir.content_type}`);
        }
        
        if (Number(retrievedDir.size_bytes) !== 0) {
            throw new Error(`Directory size_bytes mismatch! Expected: 0, Got: ${retrievedDir.size_bytes}`);
        }

        console.log('✅ Existing directory node retrieval test passed');

        // Test 4: Create a binary file and verify we can get its node data
        const binaryFilename = 'test-binary.png';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
        const binaryContentType = 'image/png';
        const binaryOrdinal = 3000;

        console.log('Creating test binary file...');
        
        const binaryInsertResult = await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, uuid
        `, owner_id, testRootKey, testParentPath, binaryFilename, binaryOrdinal,
        false, false, null, binaryContent, true, binaryContentType, binaryContent.length);
        
        const expectedBinaryId = binaryInsertResult.rows[0].id;
        const expectedBinaryUuid = binaryInsertResult.rows[0].uuid;
        
        console.log(`Created binary file: ${binaryFilename} with ID: ${expectedBinaryId}, UUID: ${expectedBinaryUuid}`);

        // Test that we can get the binary file node data
        console.log('Testing vfs_get_node_by_name for existing binary file...');
        
        const binaryFileResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_name($1, $2, $3)
        `, testParentPath, binaryFilename, testRootKey);
        
        if (binaryFileResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing binary file, got: ${binaryFileResult.rows.length}`);
        }

        const retrievedBinary = binaryFileResult.rows[0];
        
        console.log('Verifying retrieved binary file node data...');
        
        if (retrievedBinary.id !== expectedBinaryId) {
            throw new Error(`Binary file ID mismatch! Expected: ${expectedBinaryId}, Got: ${retrievedBinary.id}`);
        }
        
        if (retrievedBinary.filename !== binaryFilename) {
            throw new Error(`Binary filename mismatch! Expected: ${binaryFilename}, Got: ${retrievedBinary.filename}`);
        }
        
        if (retrievedBinary.ordinal !== binaryOrdinal) {
            throw new Error(`Binary ordinal mismatch! Expected: ${binaryOrdinal}, Got: ${retrievedBinary.ordinal}`);
        }
        
        if (retrievedBinary.is_directory !== false) {
            throw new Error(`Binary directory flag mismatch! Expected: false, Got: ${retrievedBinary.is_directory}`);
        }
        
        if (retrievedBinary.is_binary !== true) {
            throw new Error(`Binary flag mismatch! Expected: true, Got: ${retrievedBinary.is_binary}`);
        }
        
        if (retrievedBinary.content_text !== null) {
            throw new Error(`Binary content_text should be null! Got: ${retrievedBinary.content_text}`);
        }
        
        if (!retrievedBinary.content_binary || !binaryContent.equals(retrievedBinary.content_binary)) {
            throw new Error(`Binary content mismatch! Expected ${binaryContent.length} bytes, got ${retrievedBinary.content_binary ? retrievedBinary.content_binary.length : 0} bytes`);
        }
        
        if (retrievedBinary.content_type !== binaryContentType) {
            throw new Error(`Binary content_type mismatch! Expected: ${binaryContentType}, Got: ${retrievedBinary.content_type}`);
        }
        
        if (Number(retrievedBinary.size_bytes) !== binaryContent.length) {
            throw new Error(`Binary size_bytes mismatch! Expected: ${binaryContent.length}, Got: ${retrievedBinary.size_bytes}`);
        }

        console.log('✅ Existing binary file node retrieval test passed');

        // Test 5: Test with different root keys (should return no rows)
        console.log('Testing vfs_get_node_by_name with different root key...');
        
        const differentRootResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_name($1, $2, $3)
        `, testParentPath, textFilename, 'different-root-key');
        
        console.log(`Different root key query returned ${differentRootResult.rows.length} rows`);
        
        if (differentRootResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for different root key, got: ${differentRootResult.rows.length}`);
        }

        console.log('✅ Different root key test passed');

        // Test 6: Test with different parent paths (should return no rows)
        console.log('Testing vfs_get_node_by_name with different parent path...');
        
        const differentPathResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_name($1, $2, $3)
        `, '/different-parent-path', textFilename, testRootKey);
        
        console.log(`Different parent path query returned ${differentPathResult.rows.length} rows`);
        
        if (differentPathResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for different parent path, got: ${differentPathResult.rows.length}`);
        }

        console.log('✅ Different parent path test passed');

        // Test 7: List all created files to verify they exist and show ordinal ordering
        console.log('Verifying all created files exist and are properly ordered...');
        const allFilesResult = await pgdb.query(`
            SELECT filename, ordinal, is_directory, is_binary, content_type
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC, filename ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${allFilesResult.rows.length} items in directory (ordered by ordinal):`);
        allFilesResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, ${row.is_directory ? 'directory' : 'file'}, ${row.is_binary ? 'binary' : 'text'}, type: ${row.content_type})`);
        });
        
        // Verify the ordering is correct (by ordinal, then filename)
        const expectedOrder = [textFilename, dirFilename, binaryFilename]; // ordinals: 1000, 2000, 3000
        const actualOrder = allFilesResult.rows.map((row: any) => row.filename);
        
        if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrder.join(', ')}, Got: ${actualOrder.join(', ')}`);
        }

        console.log('✅ File ordering verification test passed');
        console.log('=== VFS Get Node By Name Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Get Node By Name Test Failed ===');
        console.error('Error during VFS get node by name test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            `, testRootKey, testParentPath);
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}
