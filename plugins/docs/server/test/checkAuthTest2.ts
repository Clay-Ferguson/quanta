import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

/**
 * Extended check auth tests focusing on edge cases not covered in checkAuthTest.ts:
 * 1. Public file access by non-owner (is_public = true behavior)
 * 2. Root path "/" as parent_path
 * 3. Path isolation - same filename in different paths
 * 4. Case sensitivity in filenames
 * 5. Special characters in filenames
 * 6. Empty string edge cases
 * 7. Files owned by different users in same directory
 */
export async function checkAuthTest2(owner_id: number): Promise<void> {
    const testParentPath = '/test-check-auth-2';
    const testParentPath2 = '/test-check-auth-2-alt';
    
    try {
        console.log('=== VFS Check Auth Test 2 (Edge Cases) Starting ===');

        // Clean up any leftover test data from previous runs
        console.log('Cleaning up any existing test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND (parent_path = $2 OR parent_path = $3 OR parent_path = '/')
            `, testRootKey, testParentPath, testParentPath2);
        } catch (cleanupError) {
            console.log('Warning: Initial cleanup failed (this is usually not a problem):', cleanupError);
        }

        // ============================================
        // Test 1: Public file access by non-owner
        // NOTE: vfs_check_auth does NOT consider is_public flag - it only checks ownership
        // This test documents this behavior
        // ============================================
        console.log('\n--- Test 1: Public file access by non-owner ---');
        
        const publicFilename = 'public-file.txt';
        const publicContent = 'This is a public file.';
        const publicOrdinal = 1000;

        console.log('Creating a public file owned by test user...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, publicFilename, publicOrdinal,
        false, true, publicContent, null, false, 'text/plain', Buffer.from(publicContent).length);
        
        console.log(`Created public file: ${publicFilename} with is_public = true`);

        // Verify owner can access
        const ownerPublicResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, publicFilename, testRootKey, false);
        
        if (ownerPublicResult.rows[0].is_authorized !== true) {
            throw new Error(`Expected owner to have access to public file, got: ${ownerPublicResult.rows[0].is_authorized}`);
        }
        console.log('✅ Owner has access to public file');

        // Test non-owner access to public file
        // NOTE: vfs_check_auth returns FALSE because it doesn't check is_public
        const nonOwnerId = owner_id + 999;
        const nonOwnerPublicResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, nonOwnerId, testParentPath, publicFilename, testRootKey, false);
        
        const nonOwnerAuth = nonOwnerPublicResult.rows[0].is_authorized;
        console.log(`Non-owner access to public file: ${nonOwnerAuth} (expected: false - vfs_check_auth doesn't check is_public)`);
        
        // Document the current behavior: vfs_check_auth does NOT grant access based on is_public
        if (nonOwnerAuth !== false) {
            throw new Error(`Expected false for non-owner even on public file (vfs_check_auth ignores is_public), got: ${nonOwnerAuth}`);
        }
        console.log('✅ Non-owner correctly denied by vfs_check_auth (is_public not checked by this function)');

        // ============================================
        // Test 2: Path isolation - same filename in different paths
        // ============================================
        console.log('\n--- Test 2: Path isolation - same filename in different paths ---');
        
        const isolatedFilename = 'isolated-file.txt';
        const content1 = 'Content in path 1';
        const content2 = 'Content in path 2';

        // Create same filename in two different paths with different owners
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, isolatedFilename, 2000,
        false, false, content1, null, false, 'text/plain', Buffer.from(content1).length);

        const otherOwnerId = owner_id + 500;
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, otherOwnerId, testRootKey, testParentPath2, isolatedFilename, 2000,
        false, false, content2, null, false, 'text/plain', Buffer.from(content2).length);

        console.log(`Created ${isolatedFilename} in two different paths with different owners`);

        // owner_id should have access to file in testParentPath
        const pathIsolation1 = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, isolatedFilename, testRootKey, false);
        
        if (pathIsolation1.rows[0].is_authorized !== true) {
            throw new Error(`Expected owner to have access in their path, got: ${pathIsolation1.rows[0].is_authorized}`);
        }

        // owner_id should NOT have access to file in testParentPath2 (owned by otherOwnerId)
        const pathIsolation2 = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath2, isolatedFilename, testRootKey, false);
        
        if (pathIsolation2.rows[0].is_authorized !== false) {
            throw new Error(`Expected no access to file in different path with different owner, got: ${pathIsolation2.rows[0].is_authorized}`);
        }

        console.log('✅ Path isolation works correctly - same filename in different paths are independent');

        // ============================================
        // Test 3: Case sensitivity in filenames
        // ============================================
        console.log('\n--- Test 3: Case sensitivity in filenames ---');
        
        const lowerCaseFile = 'casefile.txt';
        const upperCaseFile = 'CASEFILE.txt';

        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, lowerCaseFile, 3000,
        false, false, 'lowercase', null, false, 'text/plain', 9);

        console.log(`Created file with lowercase name: ${lowerCaseFile}`);

        // Check access with exact case match
        const exactCaseResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, lowerCaseFile, testRootKey, false);
        
        if (exactCaseResult.rows[0].is_authorized !== true) {
            throw new Error(`Expected access with exact case match`);
        }
        console.log('✅ Exact case match works');

        // Check access with different case (should fail - PostgreSQL is case-sensitive by default)
        const differentCaseResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, upperCaseFile, testRootKey, false);
        
        console.log(`Different case (${upperCaseFile}) result: ${differentCaseResult.rows[0].is_authorized}`);
        
        if (differentCaseResult.rows[0].is_authorized !== false) {
            throw new Error(`Expected case-sensitive comparison to return false for different case`);
        }
        console.log('✅ Case sensitivity verified - different case returns false');

        // ============================================
        // Test 4: Special characters in filenames
        // ============================================
        console.log('\n--- Test 4: Special characters in filenames ---');
        
        const specialFiles = [
            'file with spaces.txt',
            'file-with-dashes.txt',
            'file_with_underscores.txt',
            'file.multiple.dots.txt',
            "file'with'quotes.txt",
            'file@special#chars.txt',
        ];

        for (const specialFile of specialFiles) {
            await pgdb.query(`
                INSERT INTO vfs_nodes (
                    owner_id, doc_root_key, parent_path, filename, ordinal,
                    is_directory, is_public, content_text, content_binary, is_binary, 
                    content_type, size_bytes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, owner_id, testRootKey, testParentPath, specialFile, 4000 + specialFiles.indexOf(specialFile),
            false, false, 'content', null, false, 'text/plain', 7);

            const specialResult = await pgdb.query(`
                SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
            `, owner_id, testParentPath, specialFile, testRootKey, false);
            
            if (specialResult.rows[0].is_authorized !== true) {
                throw new Error(`Expected access for file with special chars: ${specialFile}`);
            }
        }
        console.log('✅ All special character filenames work correctly');

        // ============================================
        // Test 5: Root path "/" as parent_path
        // ============================================
        console.log('\n--- Test 5: Root path "/" as parent_path ---');
        
        const rootFilename = 'root-level-file.txt';

        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, '/', rootFilename, 5000,
        false, false, 'root content', null, false, 'text/plain', 12);

        console.log(`Created file at root path: /${rootFilename}`);

        const rootPathResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, '/', rootFilename, testRootKey, false);
        
        if (rootPathResult.rows[0].is_authorized !== true) {
            throw new Error(`Expected access for file at root path`);
        }
        console.log('✅ Root path "/" works correctly');

        // Verify non-owner cannot access root file
        const nonOwnerRootResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, nonOwnerId, '/', rootFilename, testRootKey, false);
        
        if (nonOwnerRootResult.rows[0].is_authorized !== false) {
            throw new Error(`Expected non-owner to be denied access at root path`);
        }
        console.log('✅ Non-owner correctly denied access at root path');

        // ============================================
        // Test 6: Empty string edge cases
        // ============================================
        console.log('\n--- Test 6: Empty string edge cases ---');
        
        // Empty filename should not exist and return false
        const emptyFilenameResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, '', testRootKey, false);
        
        if (emptyFilenameResult.rows[0].is_authorized !== false) {
            throw new Error(`Expected false for empty filename`);
        }
        console.log('✅ Empty filename returns false as expected');

        // Empty root key should not match and return false
        const emptyRootKeyResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, publicFilename, '', false);
        
        if (emptyRootKeyResult.rows[0].is_authorized !== false) {
            throw new Error(`Expected false for empty root key`);
        }
        console.log('✅ Empty root key returns false as expected');

        // ============================================
        // Test 7: Multiple files by different owners in same directory
        // ============================================
        console.log('\n--- Test 7: Multiple files by different owners in same directory ---');
        
        const multiOwnerFile1 = 'multi-owner-file-1.txt';
        const multiOwnerFile2 = 'multi-owner-file-2.txt';
        const owner2Id = owner_id + 123;

        // Create file owned by owner_id
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, multiOwnerFile1, 6000,
        false, false, 'owned by owner1', null, false, 'text/plain', 16);

        // Create file owned by owner2Id in the same directory
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner2Id, testRootKey, testParentPath, multiOwnerFile2, 6001,
        false, false, 'owned by owner2', null, false, 'text/plain', 16);

        console.log(`Created two files in same directory with different owners`);

        // owner_id has access to their file but not the other
        const multiOwner1Access1 = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, multiOwnerFile1, testRootKey, false);
        
        const multiOwner1Access2 = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, testParentPath, multiOwnerFile2, testRootKey, false);

        if (multiOwner1Access1.rows[0].is_authorized !== true) {
            throw new Error(`Expected owner to have access to their own file`);
        }
        if (multiOwner1Access2.rows[0].is_authorized !== false) {
            throw new Error(`Expected owner to NOT have access to other owner's file`);
        }

        // owner2Id has access to their file but not owner_id's file
        const multiOwner2Access1 = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner2Id, testParentPath, multiOwnerFile1, testRootKey, false);
        
        const multiOwner2Access2 = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner2Id, testParentPath, multiOwnerFile2, testRootKey, false);

        if (multiOwner2Access1.rows[0].is_authorized !== false) {
            throw new Error(`Expected owner2 to NOT have access to owner1's file`);
        }
        if (multiOwner2Access2.rows[0].is_authorized !== true) {
            throw new Error(`Expected owner2 to have access to their own file`);
        }

        // Admin (owner_id = 0) has access to both
        const adminAccess1 = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, 0, testParentPath, multiOwnerFile1, testRootKey, false);
        
        const adminAccess2 = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, 0, testParentPath, multiOwnerFile2, testRootKey, false);

        if (adminAccess1.rows[0].is_authorized !== true || adminAccess2.rows[0].is_authorized !== true) {
            throw new Error(`Expected admin to have access to all files`);
        }

        console.log('✅ Multiple owners in same directory works correctly');
        console.log('✅ Admin access to all files verified');

        // ============================================
        // Test 8: Nested path depth
        // ============================================
        console.log('\n--- Test 8: Deeply nested path ---');
        
        const deepPath = '/a/b/c/d/e/f/g/h/i/j';
        const deepFilename = 'deep-file.txt';

        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, deepPath, deepFilename, 7000,
        false, false, 'deep content', null, false, 'text/plain', 12);

        const deepResult = await pgdb.query(`
            SELECT vfs_check_auth($1, $2, $3, $4, $5) as is_authorized
        `, owner_id, deepPath, deepFilename, testRootKey, false);
        
        if (deepResult.rows[0].is_authorized !== true) {
            throw new Error(`Expected access for file in deep nested path`);
        }
        console.log('✅ Deeply nested path works correctly');

        // Clean up deep path test
        await pgdb.query(`
            DELETE FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, deepPath);

        // Summary
        console.log('\n=== VFS Check Auth Test 2 (Edge Cases) Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Check Auth Test 2 Failed ===');
        console.error('Error during VFS check auth test 2:', error);
        throw error;
    } finally {
        // Always clean up test data
        console.log('Final cleanup of test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND (parent_path = $2 OR parent_path = $3 OR parent_path = '/')
            `, testRootKey, testParentPath, testParentPath2);
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}
