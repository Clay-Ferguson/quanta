import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function simpleReadWriteTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS Simple Read/Write Test Starting ===');

        const testParentPath = '/test-documents';
        const testFilename = 'test-file.md';  // VFS doesn't require ordinal prefixes
        const testContent = 'This is a test file created by the VFS test function.';
        const testContentType = 'text/markdown';
        const testOrdinal = 1000;  // Use ordinal column directly

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        await pgdb.query(`
            DELETE FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testParentPath);

        console.log('Creating test record in VFS...');
        
        // Insert a test file record directly into VFS table
        // Note: This is a direct database insert for testing purposes
        // In the actual implementation, we would use VFS SQL functions
        const params = [
            owner_id, 
            testRootKey, 
            testParentPath, 
            testFilename, 
            testOrdinal,
            false,  // is_directory
            false,  // is_public
            testContent,  // content_text
            null,  // content_binary
            false,  // is_binary
            testContentType,  // content_type
            Buffer.from(testContent).length  // size_bytes
        ];
        
        console.log(`Executing INSERT with ${params.length} parameters:`, params);
        
        const result = await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, uuid
        `, ...params);
        
        const fileId = result.rows[0].id;
        const fileUuid = result.rows[0].uuid;
        console.log(`Test file created with ID: ${fileId}, UUID: ${fileUuid}`);

        // Now read the record back
        console.log('Reading test record back from VFS...');
        
        const readResult = await pgdb.query(`
            SELECT content_text, content_type, size_bytes, ordinal, is_binary, 
                   created_time, modified_time, is_directory
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, testFilename);
        
        if (readResult.rows.length === 0) {
            throw new Error('Test file not found after creation');
        }

        const retrievedData = readResult.rows[0];
        const retrievedContent = retrievedData.content_text;
        
        console.log('Retrieved content:', retrievedContent);
        console.log('File metadata:', {
            is_directory: retrievedData.is_directory,
            is_binary: retrievedData.is_binary,
            size_bytes: retrievedData.size_bytes,
            content_type: retrievedData.content_type,
            ordinal: retrievedData.ordinal,
            created_time: retrievedData.created_time,
            modified_time: retrievedData.modified_time
        });

        // Verify content matches
        if (retrievedContent !== testContent) {
            throw new Error(`Content mismatch! Expected: "${testContent}", Got: "${retrievedContent}"`);
        }

        // Test directory listing by ordinal
        console.log('Testing directory listing ordered by ordinal...');
        const dirResult = await pgdb.query(`
            SELECT filename, ordinal, is_directory 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${dirResult.rows.length} items in directory ${testParentPath}:`);
        dirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, ${row.is_directory ? 'directory' : 'file'})`);
        });

        // Clean up test data
        console.log('Cleaning up test data...');
        await pgdb.query(`
            DELETE FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, testFilename);

        console.log('=== VFS Simple Read/Write Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Simple Read/Write Test Failed ===');
        console.error('Error during VFS test:', error);
        throw error;
    }
}
