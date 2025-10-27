import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function unlinkTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-unlink';
    
    try {
        console.log('=== VFS Unlink Test Starting ===');

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
        
        // Test 1: Create text and binary files, then delete them with vfs_unlink
        const textFilename = 'test-text-file.md';
        const textContent = 'This is a **test markdown** file that will be deleted.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1000;

        const binaryFilename = 'test-binary-file.png';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
        const binaryContentType = 'image/png';
        const binaryOrdinal = 2000;

        console.log('Creating test files for deletion...');
        
        // Create text file
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, textContentType, Buffer.from(textContent).length);
        
        console.log(`Created text file: ${textFilename}`);
        
        // Create binary file
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, binaryFilename, binaryOrdinal,
        false, false, null, binaryContent, true, binaryContentType, binaryContent.length);
        
        console.log(`Created binary file: ${binaryFilename}`);

        // Verify both files exist before deletion
        console.log('Verifying files exist before deletion...');
        
        const beforeResult = await pgdb.query(`
            SELECT filename, is_directory 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${beforeResult.rows.length} items before deletion:`);
        beforeResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (${row.is_directory ? 'directory' : 'file'})`);
        });
        
        if (beforeResult.rows.length !== 2) {
            throw new Error(`Expected 2 files before deletion, got: ${beforeResult.rows.length}`);
        }

        // Test vfs_unlink for text file
        console.log('Testing vfs_unlink for text file...');
        
        const unlinkTextResult = await pgdb.query(`
            SELECT vfs_unlink($1, $2, $3, $4) as success
        `, owner_id, testParentPath, textFilename, testRootKey);
        
        const textUnlinkSuccess = unlinkTextResult.rows[0].success;
        console.log(`Text file unlink result: ${textUnlinkSuccess}`);
        
        if (textUnlinkSuccess !== true) {
            throw new Error(`Expected true for successful text file unlink, got: ${textUnlinkSuccess}`);
        }

        // Verify text file was deleted
        console.log('Verifying text file was deleted...');
        
        const afterTextDeleteResult = await pgdb.query(`
            SELECT filename 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (afterTextDeleteResult.rows.length !== 0) {
            throw new Error(`Text file still exists after deletion! Found ${afterTextDeleteResult.rows.length} rows`);
        }

        console.log('✅ Text file unlink test passed');

        // Test vfs_unlink for binary file
        console.log('Testing vfs_unlink for binary file...');
        
        const unlinkBinaryResult = await pgdb.query(`
            SELECT vfs_unlink($1, $2, $3, $4) as success
        `, owner_id, testParentPath, binaryFilename, testRootKey);
        
        const binaryUnlinkSuccess = unlinkBinaryResult.rows[0].success;
        console.log(`Binary file unlink result: ${binaryUnlinkSuccess}`);
        
        if (binaryUnlinkSuccess !== true) {
            throw new Error(`Expected true for successful binary file unlink, got: ${binaryUnlinkSuccess}`);
        }

        // Verify binary file was deleted
        console.log('Verifying binary file was deleted...');
        
        const afterBinaryDeleteResult = await pgdb.query(`
            SELECT filename 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, binaryFilename);
        
        if (afterBinaryDeleteResult.rows.length !== 0) {
            throw new Error(`Binary file still exists after deletion! Found ${afterBinaryDeleteResult.rows.length} rows`);
        }

        console.log('✅ Binary file unlink test passed');

        // Verify directory is now empty
        console.log('Verifying directory is now empty...');
        
        const afterAllDeletesResult = await pgdb.query(`
            SELECT filename 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testParentPath);
        
        console.log(`Found ${afterAllDeletesResult.rows.length} items after all deletions`);
        
        if (afterAllDeletesResult.rows.length !== 0) {
            throw new Error(`Expected empty directory after all deletions, got: ${afterAllDeletesResult.rows.length} items`);
        }

        console.log('✅ Directory cleanup verification test passed');

        // Test 2: Try to delete non-existent file (should throw exception)
        console.log('Testing vfs_unlink for non-existent file (should throw exception)...');
        
        try {
            await pgdb.query(`
                SELECT vfs_unlink($1, $2, $3, $4) as success
            `, owner_id, testParentPath, 'non-existent-file.txt', testRootKey);
            
            throw new Error('Expected exception for non-existent file, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File not found')) {
                console.log('✅ Non-existent file test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for non-existent file: ${error.message}`);
            }
        }

        // Test 3: Create a directory and verify that unlink cannot delete it
        const dirFilename = 'test-directory';
        const dirOrdinal = 3000;

        console.log('Testing that vfs_unlink cannot delete directories...');
        
        // Create directory
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, dirFilename, dirOrdinal,
        true, false, null, null, false, 'directory', 0);
        
        console.log(`Created directory: ${dirFilename}`);

        // Try to unlink the directory (should fail because is_directory = TRUE)
        try {
            await pgdb.query(`
                SELECT vfs_unlink($1, $2, $3, $4) as success
            `, owner_id, testParentPath, dirFilename, testRootKey);
            
            throw new Error('Expected exception when trying to unlink directory, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File not found')) {
                console.log('✅ Directory unlink prevention test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error when trying to unlink directory: ${error.message}`);
            }
        }

        // Verify directory still exists after failed unlink attempt
        const dirStillExistsResult = await pgdb.query(`
            SELECT filename, is_directory 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, dirFilename);
        
        if (dirStillExistsResult.rows.length !== 1 || !dirStillExistsResult.rows[0].is_directory) {
            throw new Error('Directory should still exist after failed unlink attempt');
        }

        console.log('✅ Directory still exists after failed unlink test passed');

        // Test 4: Test admin access (owner_id = 0 should be able to delete any file)
        const adminTestFilename = 'admin-delete-test.txt';
        const adminTestContent = 'This file will be deleted by admin.';
        const adminTestOrdinal = 4000;

        console.log('Testing admin access for file deletion...');
        
        // Create file owned by the regular user
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, adminTestFilename, adminTestOrdinal,
        false, false, adminTestContent, null, false, 'text/plain', Buffer.from(adminTestContent).length);
        
        console.log(`Created file owned by user ${owner_id}: ${adminTestFilename}`);

        // Delete it as admin (owner_id = 0)
        const adminUnlinkResult = await pgdb.query(`
            SELECT vfs_unlink($1, $2, $3, $4) as success
        `, 0, testParentPath, adminTestFilename, testRootKey); // owner_id = 0 (admin)
        
        const adminUnlinkSuccess = adminUnlinkResult.rows[0].success;
        console.log(`Admin unlink result: ${adminUnlinkSuccess}`);
        
        if (adminUnlinkSuccess !== true) {
            throw new Error(`Expected true for successful admin unlink, got: ${adminUnlinkSuccess}`);
        }

        // Verify file was deleted by admin
        const afterAdminDeleteResult = await pgdb.query(`
            SELECT filename 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, adminTestFilename);
        
        if (afterAdminDeleteResult.rows.length !== 0) {
            throw new Error(`File still exists after admin deletion! Found ${afterAdminDeleteResult.rows.length} rows`);
        }

        console.log('✅ Admin access test passed');

        // Test 5: Test owner access control (non-owner should not be able to delete file)
        const ownerTestFilename = 'owner-test-file.txt';
        const ownerTestContent = 'This file should only be deletable by its owner.';
        const ownerTestOrdinal = 5000;
        const nonOwnerUserId = 999999; // Use a very high ID that's unlikely to exist

        console.log('Testing owner access control...');
        
        // Create file owned by the regular user
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, ownerTestFilename, ownerTestOrdinal,
        false, false, ownerTestContent, null, false, 'text/plain', Buffer.from(ownerTestContent).length);
        
        console.log(`Created file owned by user ${owner_id}: ${ownerTestFilename}`);

        // Try to delete it as a different user (should fail)
        try {
            await pgdb.query(`
                SELECT vfs_unlink($1, $2, $3, $4) as success
            `, nonOwnerUserId, testParentPath, ownerTestFilename, testRootKey);
            
            throw new Error('Expected exception when non-owner tries to delete file, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File not found')) {
                console.log('✅ Non-owner access control test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error when non-owner tries to delete file: ${error.message}`);
            }
        }

        // Verify file still exists after failed non-owner delete attempt
        const fileStillExistsResult = await pgdb.query(`
            SELECT filename, owner_id 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, ownerTestFilename);
        
        if (fileStillExistsResult.rows.length !== 1 || fileStillExistsResult.rows[0].owner_id !== owner_id) {
            throw new Error('File should still exist and be owned by original owner after failed non-owner delete');
        }

        console.log('✅ File still exists after failed non-owner delete test passed');

        // Now delete it as the actual owner (should succeed)
        console.log('Testing that actual owner can delete their own file...');
        
        const ownerUnlinkResult = await pgdb.query(`
            SELECT vfs_unlink($1, $2, $3, $4) as success
        `, owner_id, testParentPath, ownerTestFilename, testRootKey); // actual owner
        
        const ownerUnlinkSuccess = ownerUnlinkResult.rows[0].success;
        console.log(`Owner unlink result: ${ownerUnlinkSuccess}`);
        
        if (ownerUnlinkSuccess !== true) {
            throw new Error(`Expected true for successful owner unlink, got: ${ownerUnlinkSuccess}`);
        }

        // Verify file was deleted by owner
        const afterOwnerDeleteResult = await pgdb.query(`
            SELECT filename 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, ownerTestFilename);
        
        if (afterOwnerDeleteResult.rows.length !== 0) {
            throw new Error(`File still exists after owner deletion! Found ${afterOwnerDeleteResult.rows.length} rows`);
        }

        console.log('✅ Owner access test passed');

        console.log('=== VFS Unlink Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Unlink Test Failed ===');
        console.error('Error during VFS unlink test:', error);
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
