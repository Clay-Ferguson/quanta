import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function checkAuthTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-check-auth';
    
    try {
        console.log('=== VFS Check Auth Test Starting ===');

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
        
        // Test 1: Check auth for non-existent file (should return false)
        console.log('Testing vfs_check_auth for non-existent file...');
        
        const nonExistentResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, 'non-existent-file.txt', testRootKey, null);
        
        const nonExistentAuth = nonExistentResult.rows[0].is_authorized;
        console.log(`Non-existent file auth result: ${nonExistentAuth}`);
        
        if (nonExistentAuth !== false) {
            throw new Error(`Expected false for non-existent file, got: ${nonExistentAuth}`);
        }

        console.log('✅ Non-existent file auth test passed');

        // Test 2: Create a file owned by the test user and verify owner access
        const textFilename = 'owned-file.txt';
        const textContent = 'This file is owned by the test user.';
        const textOrdinal = 1000;

        console.log('Creating test file owned by current user...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, 'text/plain', Buffer.from(textContent).length);
        
        console.log(`Created file: ${textFilename} owned by user: ${owner_id}`);

        // Test owner access
        console.log('Testing vfs_check_auth for file owner...');
        
        const ownerAuthResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, textFilename, testRootKey, false);
        
        const ownerAuth = ownerAuthResult.rows[0].is_authorized;
        console.log(`Owner auth result: ${ownerAuth}`);
        
        if (ownerAuth !== true) {
            throw new Error(`Expected true for file owner, got: ${ownerAuth}`);
        }

        console.log('✅ File owner auth test passed');

        // Test 3: Test non-owner access (should return false)
        const nonOwnerId = owner_id + 1000; // Use a different user ID
        console.log(`Testing vfs_check_auth for non-owner (user ${nonOwnerId})...`);
        
        const nonOwnerAuthResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, nonOwnerId, testParentPath, textFilename, testRootKey, false);
        
        const nonOwnerAuth = nonOwnerAuthResult.rows[0].is_authorized;
        console.log(`Non-owner auth result: ${nonOwnerAuth}`);
        
        if (nonOwnerAuth !== false) {
            throw new Error(`Expected false for non-owner, got: ${nonOwnerAuth}`);
        }

        console.log('✅ Non-owner auth test passed');

        // Test 4: Test admin access (owner_id = 0 should always have access)
        console.log('Testing vfs_check_auth for admin user (owner_id = 0)...');
        
        const adminAuthResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, 0, testParentPath, textFilename, testRootKey, false);
        
        const adminAuth = adminAuthResult.rows[0].is_authorized;
        console.log(`Admin auth result: ${adminAuth}`);
        
        if (adminAuth !== true) {
            throw new Error(`Expected true for admin user, got: ${adminAuth}`);
        }

        console.log('✅ Admin auth test passed');

        // Test 5: Create a directory and test directory-specific auth
        const dirFilename = 'owned-directory';
        const dirOrdinal = 2000;

        console.log('Creating test directory owned by current user...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, dirFilename, dirOrdinal,
        true, false, null, null, false, 'directory', 0);
        
        console.log(`Created directory: ${dirFilename} owned by user: ${owner_id}`);

        // Test directory owner access with is_directory_param = true
        console.log('Testing vfs_check_auth for directory owner with is_directory_param = true...');
        
        const dirOwnerAuthResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, dirFilename, testRootKey, true);
        
        const dirOwnerAuth = dirOwnerAuthResult.rows[0].is_authorized;
        console.log(`Directory owner auth result: ${dirOwnerAuth}`);
        
        if (dirOwnerAuth !== true) {
            throw new Error(`Expected true for directory owner, got: ${dirOwnerAuth}`);
        }

        console.log('✅ Directory owner auth test passed');

        // Test directory access with wrong is_directory_param (should return false)
        console.log('Testing vfs_check_auth for directory with is_directory_param = false...');
        
        const dirWrongTypeResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, dirFilename, testRootKey, false);
        
        const dirWrongTypeAuth = dirWrongTypeResult.rows[0].is_authorized;
        console.log(`Directory wrong type auth result: ${dirWrongTypeAuth}`);
        
        if (dirWrongTypeAuth !== false) {
            throw new Error(`Expected false for directory with wrong is_directory_param, got: ${dirWrongTypeAuth}`);
        }

        console.log('✅ Directory wrong type auth test passed');

        // Test 6: Test file access with wrong is_directory_param (should return false)
        console.log('Testing vfs_check_auth for file with is_directory_param = true...');
        
        const fileWrongTypeResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, textFilename, testRootKey, true);
        
        const fileWrongTypeAuth = fileWrongTypeResult.rows[0].is_authorized;
        console.log(`File wrong type auth result: ${fileWrongTypeAuth}`);
        
        if (fileWrongTypeAuth !== false) {
            throw new Error(`Expected false for file with wrong is_directory_param, got: ${fileWrongTypeAuth}`);
        }

        console.log('✅ File wrong type auth test passed');

        // Test 7: Test auth with is_directory_param = null (should work for both files and directories)
        console.log('Testing vfs_check_auth with is_directory_param = null...');
        
        const nullTypeFileResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, textFilename, testRootKey, null);
        
        const nullTypeFileAuth = nullTypeFileResult.rows[0].is_authorized;
        console.log(`File with null is_directory_param auth result: ${nullTypeFileAuth}`);
        
        if (nullTypeFileAuth !== true) {
            throw new Error(`Expected true for file with null is_directory_param, got: ${nullTypeFileAuth}`);
        }
        
        const nullTypeDirResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, dirFilename, testRootKey, null);
        
        const nullTypeDirAuth = nullTypeDirResult.rows[0].is_authorized;
        console.log(`Directory with null is_directory_param auth result: ${nullTypeDirAuth}`);
        
        if (nullTypeDirAuth !== true) {
            throw new Error(`Expected true for directory with null is_directory_param, got: ${nullTypeDirAuth}`);
        }

        console.log('✅ Null is_directory_param auth test passed');

        // Test 8: Test auth with different root key (should return false)
        console.log('Testing vfs_check_auth with different root key...');
        
        const differentRootResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, textFilename, 'different-root-key', false);
        
        const differentRootAuth = differentRootResult.rows[0].is_authorized;
        console.log(`Different root key auth result: ${differentRootAuth}`);
        
        if (differentRootAuth !== false) {
            throw new Error(`Expected false for different root key, got: ${differentRootAuth}`);
        }

        console.log('✅ Different root key auth test passed');

        // List all created items for verification
        console.log('Verifying all created items in test directory...');
        const allItemsResult = await pgdb.query(`
            SELECT filename, is_directory, owner_id, ordinal
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${allItemsResult.rows.length} items in directory:`);
        allItemsResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, ${row.is_directory ? 'directory' : 'file'}, owner: ${row.owner_id})`);
        });

        console.log('=== VFS Check Auth Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Check Auth Test Failed ===');
        console.error('Error during VFS check auth test:', error);
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