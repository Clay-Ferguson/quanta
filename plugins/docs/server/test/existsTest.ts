import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function existsTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-exists';
    
    try {
        console.log('=== VFS Exists Test Starting ===');

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
        
        // Test 1: Check that non-existent file returns false
        console.log('Testing vfs_exists for non-existent file...');
        
        const nonExistentResult = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as file_exists
        `, testParentPath, 'non-existent-file.txt', testRootKey);
        
        const nonExistentExists = nonExistentResult.rows[0].file_exists;
        console.log(`Non-existent file exists: ${nonExistentExists}`);
        
        if (nonExistentExists !== false) {
            throw new Error(`Expected false for non-existent file, got: ${nonExistentExists}`);
        }

        console.log('✅ Non-existent file test passed');

        // Test 2: Create a text file and verify it exists
        const textFilename = 'test-file.txt';
        const textContent = 'This is a test file for exists testing.';
        const textOrdinal = 1000;

        console.log('Creating test text file...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, 'text/plain', Buffer.from(textContent).length);
        
        console.log(`Created text file: ${textFilename}`);

        // Test that the file exists
        console.log('Testing vfs_exists for existing text file...');
        
        const textFileResult = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as file_exists
        `, testParentPath, textFilename, testRootKey);
        
        const textFileExists = textFileResult.rows[0].file_exists;
        console.log(`Text file exists: ${textFileExists}`);
        
        if (textFileExists !== true) {
            throw new Error(`Expected true for existing text file, got: ${textFileExists}`);
        }

        console.log('✅ Existing text file test passed');

        // Test 3: Create a directory and verify it exists
        const dirFilename = 'test-directory';
        const dirOrdinal = 2000;

        console.log('Creating test directory...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, dirFilename, dirOrdinal,
        true, false, null, null, false, 'directory', 0);
        
        console.log(`Created directory: ${dirFilename}`);

        // Test that the directory exists
        console.log('Testing vfs_exists for existing directory...');
        
        const dirResult = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as file_exists
        `, testParentPath, dirFilename, testRootKey);
        
        const dirExists = dirResult.rows[0].file_exists;
        console.log(`Directory exists: ${dirExists}`);
        
        if (dirExists !== true) {
            throw new Error(`Expected true for existing directory, got: ${dirExists}`);
        }

        console.log('✅ Existing directory test passed');

        // Test 4: Create a binary file and verify it exists
        const binaryFilename = 'test-binary.png';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
        const binaryOrdinal = 3000;

        console.log('Creating test binary file...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, binaryFilename, binaryOrdinal,
        false, false, null, binaryContent, true, 'image/png', binaryContent.length);
        
        console.log(`Created binary file: ${binaryFilename}`);

        // Test that the binary file exists
        console.log('Testing vfs_exists for existing binary file...');
        
        const binaryFileResult = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as file_exists
        `, testParentPath, binaryFilename, testRootKey);
        
        const binaryFileExists = binaryFileResult.rows[0].file_exists;
        console.log(`Binary file exists: ${binaryFileExists}`);
        
        if (binaryFileExists !== true) {
            throw new Error(`Expected true for existing binary file, got: ${binaryFileExists}`);
        }

        console.log('✅ Existing binary file test passed');

        // Test 5: Test with different root keys (should return false)
        console.log('Testing vfs_exists with different root key...');
        
        const differentRootResult = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as file_exists
        `, testParentPath, textFilename, 'different-root-key');
        
        const differentRootExists = differentRootResult.rows[0].file_exists;
        console.log(`File exists with different root key: ${differentRootExists}`);
        
        if (differentRootExists !== false) {
            throw new Error(`Expected false for different root key, got: ${differentRootExists}`);
        }

        console.log('✅ Different root key test passed');

        // Test 6: Test with different parent paths (should return false)
        console.log('Testing vfs_exists with different parent path...');
        
        const differentPathResult = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as file_exists
        `, '/different-parent-path', textFilename, testRootKey);
        
        const differentPathExists = differentPathResult.rows[0].file_exists;
        console.log(`File exists with different parent path: ${differentPathExists}`);
        
        if (differentPathExists !== false) {
            throw new Error(`Expected false for different parent path, got: ${differentPathExists}`);
        }

        console.log('✅ Different parent path test passed');

        // Test 7: Delete a file and verify it no longer exists
        console.log('Testing vfs_exists after deleting file...');
        
        await pgdb.query(`
            DELETE FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        console.log(`Deleted text file: ${textFilename}`);
        
        const deletedFileResult = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as file_exists
        `, testParentPath, textFilename, testRootKey);
        
        const deletedFileExists = deletedFileResult.rows[0].file_exists;
        console.log(`Deleted file exists: ${deletedFileExists}`);
        
        if (deletedFileExists !== false) {
            throw new Error(`Expected false for deleted file, got: ${deletedFileExists}`);
        }

        console.log('✅ Deleted file test passed');

        // List remaining files for verification
        console.log('Verifying remaining files in test directory...');
        const remainingResult = await pgdb.query(`
            SELECT filename, is_directory, ordinal 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${remainingResult.rows.length} remaining items in directory:`);
        remainingResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, ${row.is_directory ? 'directory' : 'file'})`);
        });

        console.log('=== VFS Exists Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Exists Test Failed ===');
        console.error('Error during VFS exists test:', error);
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
