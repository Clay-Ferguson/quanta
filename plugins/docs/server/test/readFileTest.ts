import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function readFileTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-read-file';
    
    try {
        console.log('=== VFS Read File Test Starting ===');

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
        
        // Test 1: Create and read a text file
        const textFilename = 'test-text.md';
        const textContent = 'This is a **markdown** test file for VFS read function.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1000;

        console.log('Creating test text file...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, textContentType, Buffer.from(textContent).length);
        
        console.log(`Created text file: ${textFilename} with content length: ${textContent.length}`);

        // Test reading the text file using vfs_read_file function
        console.log('Testing vfs_read_file function for text file...');
        
        const textFileResult = await pgdb.query(`
            SELECT vfs_read_file($1, $2, $3, $4) as file_content
        `, owner_id, testParentPath, textFilename, testRootKey);
        
        const retrievedTextBytes = textFileResult.rows[0].file_content;
        const retrievedTextContent = retrievedTextBytes ? retrievedTextBytes.toString('utf8') : null;
        
        console.log(`Retrieved text content: "${retrievedTextContent}"`);
        console.log(`Expected text content:  "${textContent}"`);
        
        if (retrievedTextContent !== textContent) {
            throw new Error(`Text content mismatch! Expected: "${textContent}", Got: "${retrievedTextContent}"`);
        }

        console.log('✅ Text file read test passed');

        // Test 2: Create and read a binary file
        const binaryFilename = 'test-binary.dat';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header bytes
        const binaryContentType = 'application/octet-stream';
        const binaryOrdinal = 2000;

        console.log('Creating test binary file...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, binaryFilename, binaryOrdinal,
        false, false, null, binaryContent, true, binaryContentType, binaryContent.length);
        
        console.log(`Created binary file: ${binaryFilename} with content length: ${binaryContent.length} bytes`);

        // Test reading the binary file using vfs_read_file function
        console.log('Testing vfs_read_file function for binary file...');
        
        const binaryFileResult = await pgdb.query(`
            SELECT vfs_read_file($1, $2, $3, $4) as file_content
        `, owner_id, testParentPath, binaryFilename, testRootKey);
        
        const retrievedBinaryContent = binaryFileResult.rows[0].file_content;
        
        console.log(`Retrieved binary content length: ${retrievedBinaryContent ? retrievedBinaryContent.length : 0} bytes`);
        console.log(`Expected binary content length:  ${binaryContent.length} bytes`);
        
        if (!retrievedBinaryContent || !binaryContent.equals(retrievedBinaryContent)) {
            throw new Error(`Binary content mismatch! Expected ${binaryContent.length} bytes, got ${retrievedBinaryContent ? retrievedBinaryContent.length : 0} bytes`);
        }

        console.log('✅ Binary file read test passed');

        // Test 3: Test reading non-existent file (should throw exception)
        console.log('Testing vfs_read_file function for non-existent file...');
        
        try {
            await pgdb.query(`
                SELECT vfs_read_file($1, $2, $3, $4) as file_content
            `, owner_id, testParentPath, 'non-existent-file.txt', testRootKey);
            
            throw new Error('Expected exception for non-existent file, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File not found')) {
                console.log('✅ Non-existent file test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for non-existent file: ${error.message}`);
            }
        }

        // Test 4: Test admin access (owner_id = 0 should access all files)
        console.log('Testing admin access (owner_id = 0)...');
        
        const adminFileResult = await pgdb.query(`
            SELECT vfs_read_file($1, $2, $3, $4) as file_content
        `, 0, testParentPath, textFilename, testRootKey); // owner_id = 0 (admin)
        
        const retrievedContentAsAdmin = adminFileResult.rows[0].file_content.toString('utf8');
        
        console.log(`Retrieved content as admin: "${retrievedContentAsAdmin}"`);
        console.log(`Expected content:           "${textContent}"`);
        
        if (retrievedContentAsAdmin !== textContent) {
            throw new Error(`Admin access content mismatch! Expected: "${textContent}", Got: "${retrievedContentAsAdmin}"`);
        }

        console.log('✅ Admin access test passed');
        console.log('=== VFS Read File Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Read File Test Failed ===');
        console.error('Error during VFS read file test:', error);
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
