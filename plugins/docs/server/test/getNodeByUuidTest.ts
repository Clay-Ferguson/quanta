import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function getNodeByUuidTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-get-node-by-uuid';
    
    try {
        console.log('=== VFS Get Node By UUID Test Starting ===');

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
        
        // Test 1: Check that non-existent UUID returns no rows
        const nonExistentUuid = '00000000-0000-4000-8000-000000000000'; // A valid UUID format that shouldn't exist
        console.log('Testing vfs_get_node_by_uuid for non-existent UUID...');
        
        const nonExistentResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_uuid($1, $2)
        `, nonExistentUuid, testRootKey);
        
        console.log(`Non-existent UUID query returned ${nonExistentResult.rows.length} rows`);
        
        if (nonExistentResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for non-existent UUID, got: ${nonExistentResult.rows.length}`);
        }

        console.log('✅ Non-existent UUID test passed');

        // Test 2: Create a text file and retrieve it by UUID
        const textFilename = 'test-file.md';
        const textContent = 'This is a **test markdown** file for UUID-based retrieval testing.';
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
        const fileUuid = insertResult.rows[0].uuid;
        const expectedCreatedTime = insertResult.rows[0].created_time;
        const expectedModifiedTime = insertResult.rows[0].modified_time;
        
        console.log(`Created text file: ${textFilename} with ID: ${expectedId}, UUID: ${fileUuid}`);

        // Test retrieving the file by UUID
        console.log('Testing vfs_get_node_by_uuid for existing text file...');
        
        const textFileResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_uuid($1, $2)
        `, fileUuid, testRootKey);
        
        console.log(`Text file UUID query returned ${textFileResult.rows.length} rows`);
        
        if (textFileResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing text file UUID, got: ${textFileResult.rows.length}`);
        }

        const retrievedNode = textFileResult.rows[0];
        
        console.log('Verifying retrieved node data by UUID...');
        console.log(`Expected filename: ${textFilename}, Retrieved filename: ${retrievedNode.filename}`);
        console.log(`Expected parent_path: ${testParentPath}, Retrieved parent_path: ${retrievedNode.parent_path}`);
        console.log(`Expected ordinal: ${textOrdinal}, Retrieved ordinal: ${retrievedNode.ordinal}`);
        console.log(`Expected content: "${textContent.substring(0, 50)}...", Retrieved content: "${retrievedNode.content_text ? retrievedNode.content_text.substring(0, 50) : 'null'}..."`);
        
        // Verify all the node data matches expectations
        if (retrievedNode.owner_id !== owner_id) {
            throw new Error(`Owner ID mismatch! Expected: ${owner_id}, Got: ${retrievedNode.owner_id}`);
        }
        
        if (retrievedNode.is_public !== false) {
            throw new Error(`Public flag mismatch! Expected: false, Got: ${retrievedNode.is_public}`);
        }
        
        if (retrievedNode.filename !== textFilename) {
            throw new Error(`Filename mismatch! Expected: ${textFilename}, Got: ${retrievedNode.filename}`);
        }
        
        if (retrievedNode.is_directory !== false) {
            throw new Error(`Directory flag mismatch! Expected: false, Got: ${retrievedNode.is_directory}`);
        }
        
        if (Number(retrievedNode.size_bytes) !== Buffer.from(textContent).length) {
            throw new Error(`Size mismatch! Expected: ${Buffer.from(textContent).length}, Got: ${retrievedNode.size_bytes}`);
        }
        
        if (retrievedNode.content_type !== textContentType) {
            throw new Error(`Content type mismatch! Expected: ${textContentType}, Got: ${retrievedNode.content_type}`);
        }
        
        if (retrievedNode.parent_path !== testParentPath) {
            throw new Error(`Parent path mismatch! Expected: ${testParentPath}, Got: ${retrievedNode.parent_path}`);
        }
        
        if (retrievedNode.ordinal !== textOrdinal) {
            throw new Error(`Ordinal mismatch! Expected: ${textOrdinal}, Got: ${retrievedNode.ordinal}`);
        }
        
        if (retrievedNode.content_text !== textContent) {
            throw new Error(`Content text mismatch! Expected: "${textContent}", Got: "${retrievedNode.content_text}"`);
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

        console.log('✅ Text file UUID retrieval test passed');

        // Test 3: Create a directory and retrieve it by UUID
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
        const dirUuid = dirInsertResult.rows[0].uuid;
        
        console.log(`Created directory: ${dirFilename} with ID: ${expectedDirId}, UUID: ${dirUuid}`);

        // Test retrieving the directory by UUID
        console.log('Testing vfs_get_node_by_uuid for existing directory...');
        
        const dirResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_uuid($1, $2)
        `, dirUuid, testRootKey);
        
        if (dirResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing directory UUID, got: ${dirResult.rows.length}`);
        }

        const retrievedDir = dirResult.rows[0];
        
        console.log('Verifying retrieved directory node data by UUID...');
        
        if (retrievedDir.filename !== dirFilename) {
            throw new Error(`Directory filename mismatch! Expected: ${dirFilename}, Got: ${retrievedDir.filename}`);
        }
        
        if (retrievedDir.parent_path !== testParentPath) {
            throw new Error(`Directory parent path mismatch! Expected: ${testParentPath}, Got: ${retrievedDir.parent_path}`);
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
        
        if (retrievedDir.content_type !== 'directory') {
            throw new Error(`Directory content_type mismatch! Expected: 'directory', Got: ${retrievedDir.content_type}`);
        }
        
        if (Number(retrievedDir.size_bytes) !== 0) {
            throw new Error(`Directory size_bytes mismatch! Expected: 0, Got: ${retrievedDir.size_bytes}`);
        }

        console.log('✅ Directory UUID retrieval test passed');

        // Test 4: Create a binary file and retrieve it by UUID
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
        const binaryUuid = binaryInsertResult.rows[0].uuid;
        
        console.log(`Created binary file: ${binaryFilename} with ID: ${expectedBinaryId}, UUID: ${binaryUuid}`);

        // Test retrieving the binary file by UUID
        console.log('Testing vfs_get_node_by_uuid for existing binary file...');
        
        const binaryFileResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_uuid($1, $2)
        `, binaryUuid, testRootKey);
        
        if (binaryFileResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing binary file UUID, got: ${binaryFileResult.rows.length}`);
        }

        const retrievedBinary = binaryFileResult.rows[0];
        
        console.log('Verifying retrieved binary file node data by UUID...');
        
        if (retrievedBinary.filename !== binaryFilename) {
            throw new Error(`Binary filename mismatch! Expected: ${binaryFilename}, Got: ${retrievedBinary.filename}`);
        }
        
        if (retrievedBinary.parent_path !== testParentPath) {
            throw new Error(`Binary parent path mismatch! Expected: ${testParentPath}, Got: ${retrievedBinary.parent_path}`);
        }
        
        if (retrievedBinary.ordinal !== binaryOrdinal) {
            throw new Error(`Binary ordinal mismatch! Expected: ${binaryOrdinal}, Got: ${retrievedBinary.ordinal}`);
        }
        
        if (retrievedBinary.is_directory !== false) {
            throw new Error(`Binary directory flag mismatch! Expected: false, Got: ${retrievedBinary.is_directory}`);
        }
        
        if (retrievedBinary.content_text !== null) {
            throw new Error(`Binary content_text should be null! Got: ${retrievedBinary.content_text}`);
        }
        
        if (retrievedBinary.content_type !== binaryContentType) {
            throw new Error(`Binary content_type mismatch! Expected: ${binaryContentType}, Got: ${retrievedBinary.content_type}`);
        }
        
        if (Number(retrievedBinary.size_bytes) !== binaryContent.length) {
            throw new Error(`Binary size_bytes mismatch! Expected: ${binaryContent.length}, Got: ${retrievedBinary.size_bytes}`);
        }

        console.log('✅ Binary file UUID retrieval test passed');

        // Test 5: Test with different root keys (should return no rows)
        console.log('Testing vfs_get_node_by_uuid with different root key...');
        
        const differentRootResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_uuid($1, $2)
        `, fileUuid, 'different-root-key');
        
        console.log(`Different root key query returned ${differentRootResult.rows.length} rows`);
        
        if (differentRootResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for different root key, got: ${differentRootResult.rows.length}`);
        }

        console.log('✅ Different root key test passed');

        // Test 6: Test that UUID can be used for navigation (docPath reconstruction)
        console.log('Testing UUID-based navigation for docPath reconstruction...');
        
        // Use the text file UUID to demonstrate how this function could be used for navigation
        const navResult = await pgdb.query(`
            SELECT * FROM vfs_get_node_by_uuid($1, $2)
        `, fileUuid, testRootKey);
        
        if (navResult.rows.length === 1) {
            const node = navResult.rows[0];
            // Reconstruct the full document path
            let docPath;
            if (node.parent_path === '' || node.parent_path === '/') {
                docPath = '/' + node.filename;
            } else {
                docPath = node.parent_path + '/' + node.filename;
            }
            
            console.log(`Reconstructed docPath from UUID: ${docPath}`);
            const expectedDocPath = testParentPath + '/' + textFilename;
            
            if (docPath !== expectedDocPath) {
                throw new Error(`DocPath reconstruction failed! Expected: ${expectedDocPath}, Got: ${docPath}`);
            }
            
            console.log('✅ UUID-based navigation test passed');
        } else {
            throw new Error('Failed to retrieve node for navigation test');
        }

        // Test 7: Test multiple UUIDs to ensure each returns the correct node
        console.log('Testing multiple UUIDs to ensure correct node retrieval...');
        
        const allUuids = [fileUuid, dirUuid, binaryUuid];
        const expectedFilenames = [textFilename, dirFilename, binaryFilename];
        const expectedTypes = [false, true, false]; // is_directory flags
        
        for (let i = 0; i < allUuids.length; i++) {
            const result = await pgdb.query(`
                SELECT filename, is_directory, ordinal FROM vfs_get_node_by_uuid($1, $2)
            `, allUuids[i], testRootKey);
            
            if (result.rows.length !== 1) {
                throw new Error(`Expected 1 row for UUID ${i}, got: ${result.rows.length}`);
            }
            
            const node = result.rows[0];
            
            if (node.filename !== expectedFilenames[i]) {
                throw new Error(`UUID ${i} filename mismatch! Expected: ${expectedFilenames[i]}, Got: ${node.filename}`);
            }
            
            if (node.is_directory !== expectedTypes[i]) {
                throw new Error(`UUID ${i} is_directory mismatch! Expected: ${expectedTypes[i]}, Got: ${node.is_directory}`);
            }
            
            console.log(`  UUID ${i}: ${node.filename} (${node.is_directory ? 'directory' : 'file'}, ordinal: ${node.ordinal}) ✅`);
        }

        console.log('✅ Multiple UUID test passed');

        // List all created items for verification
        console.log('Verifying all created items in test directory...');
        const allItemsResult = await pgdb.query(`
            SELECT filename, uuid, ordinal, is_directory, content_type
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${allItemsResult.rows.length} items in directory (ordered by ordinal):`);
        allItemsResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (UUID: ${row.uuid}, ordinal: ${row.ordinal}, ${row.is_directory ? 'directory' : 'file'}, type: ${row.content_type})`);
        });

        console.log('=== VFS Get Node By UUID Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Get Node By UUID Test Failed ===');
        console.error('Error during VFS get node by UUID test:', error);
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
