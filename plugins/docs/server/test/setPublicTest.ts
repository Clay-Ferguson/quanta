import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function setPublicTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-set-public';
    
    try {
        console.log('=== VFS Set Public Test Starting ===');

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
        
        // Test 1: Create a private file and then make it public
        const textFilename = 'test-file.md';
        const textContent = 'This is a test file for set_public testing.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1000;

        console.log('Creating test text file (initially private)...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, textContentType, Buffer.from(textContent).length);
        
        console.log(`Created private text file: ${textFilename}`);

        // Verify file is initially private
        const initialStatusResult = await pgdb.query(`
            SELECT is_public FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (initialStatusResult.rows[0].is_public !== false) {
            throw new Error(`Expected file to be initially private (false), got: ${initialStatusResult.rows[0].is_public}`);
        }

        console.log('✅ File initially private as expected');

        // Test setting file to public
        console.log('Testing vfs_set_public to make file public...');
        
        const setPublicResult = await pgdb.query(`
            SELECT vfs_set_public($1, $2, $3, $4, $5) as success
        `, owner_id, testParentPath, textFilename, testRootKey, true);
        
        const setPublicSuccess = setPublicResult.rows[0].success;
        console.log(`vfs_set_public returned: ${setPublicSuccess}`);
        
        if (setPublicSuccess !== true) {
            throw new Error(`Expected vfs_set_public to return true, got: ${setPublicSuccess}`);
        }

        // Verify file is now public
        const publicStatusResult = await pgdb.query(`
            SELECT is_public, modified_time FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (publicStatusResult.rows[0].is_public !== true) {
            throw new Error(`Expected file to be public after vfs_set_public, got: ${publicStatusResult.rows[0].is_public}`);
        }

        console.log('✅ File successfully set to public');

        // Test setting file back to private
        console.log('Testing vfs_set_public to make file private again...');
        
        const setPrivateResult = await pgdb.query(`
            SELECT vfs_set_public($1, $2, $3, $4, $5) as success
        `, owner_id, testParentPath, textFilename, testRootKey, false);
        
        const setPrivateSuccess = setPrivateResult.rows[0].success;
        console.log(`vfs_set_public(false) returned: ${setPrivateSuccess}`);
        
        if (setPrivateSuccess !== true) {
            throw new Error(`Expected vfs_set_public(false) to return true, got: ${setPrivateSuccess}`);
        }

        // Verify file is now private again
        const privateStatusResult = await pgdb.query(`
            SELECT is_public FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (privateStatusResult.rows[0].is_public !== false) {
            throw new Error(`Expected file to be private after vfs_set_public(false), got: ${privateStatusResult.rows[0].is_public}`);
        }

        console.log('✅ File successfully set back to private');

        // Test 2: Create a directory and test setting its public status
        const dirFilename = 'test-directory';
        const dirOrdinal = 2000;

        console.log('Creating test directory (initially private)...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, dirFilename, dirOrdinal,
        true, false, null, null, false, 'directory', 0);
        
        console.log(`Created private directory: ${dirFilename}`);

        // Test setting directory to public
        console.log('Testing vfs_set_public to make directory public...');
        
        const setDirPublicResult = await pgdb.query(`
            SELECT vfs_set_public($1, $2, $3, $4, $5) as success
        `, owner_id, testParentPath, dirFilename, testRootKey, true);
        
        const setDirPublicSuccess = setDirPublicResult.rows[0].success;
        
        if (setDirPublicSuccess !== true) {
            throw new Error(`Expected vfs_set_public for directory to return true, got: ${setDirPublicSuccess}`);
        }

        // Verify directory is now public
        const dirPublicStatusResult = await pgdb.query(`
            SELECT is_public FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, dirFilename);
        
        if (dirPublicStatusResult.rows[0].is_public !== true) {
            throw new Error(`Expected directory to be public after vfs_set_public, got: ${dirPublicStatusResult.rows[0].is_public}`);
        }

        console.log('✅ Directory successfully set to public');

        // Test 3: Test admin access (owner_id = 0 should be able to modify any file)
        console.log('Testing admin access (owner_id = 0)...');
        
        const adminSetResult = await pgdb.query(`
            SELECT vfs_set_public($1, $2, $3, $4, $5) as success
        `, 0, testParentPath, textFilename, testRootKey, true); // owner_id = 0 (admin)
        
        const adminSetSuccess = adminSetResult.rows[0].success;
        
        if (adminSetSuccess !== true) {
            throw new Error(`Expected admin vfs_set_public to return true, got: ${adminSetSuccess}`);
        }

        // Verify file was modified by admin
        const adminModifiedResult = await pgdb.query(`
            SELECT is_public FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (adminModifiedResult.rows[0].is_public !== true) {
            throw new Error(`Expected file to be public after admin modification, got: ${adminModifiedResult.rows[0].is_public}`);
        }

        console.log('✅ Admin access test passed');

        // Test 4: Test access denied for wrong owner
        console.log('Testing access denied for wrong owner...');
        
        const wrongOwnerId = 999999; // Use a very high ID that's unlikely to exist
        
        try {
            await pgdb.query(`
                SELECT vfs_set_public($1, $2, $3, $4, $5) as success
            `, wrongOwnerId, testParentPath, textFilename, testRootKey, false);
            
            throw new Error('Expected exception for wrong owner, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File or directory not found or access denied')) {
                console.log('✅ Access denied test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for wrong owner: ${error.message}`);
            }
        }

        // Test 5: Test setting public status for non-existent file
        console.log('Testing vfs_set_public for non-existent file...');
        
        try {
            await pgdb.query(`
                SELECT vfs_set_public($1, $2, $3, $4, $5) as success
            `, owner_id, testParentPath, 'non-existent-file.txt', testRootKey, true);
            
            throw new Error('Expected exception for non-existent file, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File or directory not found or access denied')) {
                console.log('✅ Non-existent file test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for non-existent file: ${error.message}`);
            }
        }

        // Test 6: Verify modified_time is updated when setting public status
        console.log('Testing that modified_time is updated...');
        
        // Get current modified_time
        const beforeTimeResult = await pgdb.query(`
            SELECT modified_time FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, dirFilename);
        
        const beforeTime = new Date(beforeTimeResult.rows[0].modified_time);
        
        // Wait a small amount to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Change public status
        await pgdb.query(`
            SELECT vfs_set_public($1, $2, $3, $4, $5) as success
        `, owner_id, testParentPath, dirFilename, testRootKey, false);
        
        // Get new modified_time
        const afterTimeResult = await pgdb.query(`
            SELECT modified_time FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, dirFilename);
        
        const afterTime = new Date(afterTimeResult.rows[0].modified_time);
        
        if (afterTime.getTime() <= beforeTime.getTime()) {
            throw new Error(`Expected modified_time to be updated. Before: ${beforeTime}, After: ${afterTime}`);
        }

        console.log('✅ Modified time update test passed');

        // Show final status of all files
        console.log('Final status of all test files:');
        const finalStatusResult = await pgdb.query(`
            SELECT filename, is_directory, is_public, ordinal
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC
        `, testRootKey, testParentPath);
        
        finalStatusResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (${row.is_directory ? 'directory' : 'file'}, public: ${row.is_public}, ordinal: ${row.ordinal})`);
        });

        console.log('=== VFS Set Public Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Set Public Test Failed ===');
        console.error('Error during VFS set public test:', error);
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