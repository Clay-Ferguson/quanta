import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function readdirByOwnerTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-readdir-by-owner';
    
    try {
        console.log('=== VFS Readdir By Owner Test Starting ===');

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
        
        // Create test files all owned by the same user
        // We'll test the owner filtering by creating files and then using a non-existent owner ID
        // to verify that vfs_readdir_by_owner properly filters by owner
        
        const testFiles = [
            { filename: 'file-a.txt', ordinal: 1000, content: 'Content A' },
            { filename: 'file-b.txt', ordinal: 2000, content: 'Content B' },
            { filename: 'file-c.txt', ordinal: 3000, content: 'Content C' },
            { filename: 'dir-d', ordinal: 4000, isDirectory: true },
            { filename: 'dir-e', ordinal: 5000, isDirectory: true },
        ];

        console.log('Creating test files with the current owner...');
        
        // Insert test files/directories all owned by the current owner
        for (const testFile of testFiles) {
            const params = [
                owner_id, 
                testRootKey, 
                testParentPath, 
                testFile.filename, 
                testFile.ordinal,
                testFile.isDirectory || false,  // is_directory
                false,  // is_public
                testFile.isDirectory ? null : testFile.content,  // content_text (null for directories)
                null,  // content_binary
                false,  // is_binary
                testFile.isDirectory ? 'directory' : 'text/plain',  // content_type
                testFile.isDirectory ? 0 : Buffer.from(testFile.content!).length  // size_bytes
            ];
            
            await pgdb.query(`
                INSERT INTO vfs_nodes (
                    owner_id, doc_root_key, parent_path, filename, ordinal,
                    is_directory, is_public, content_text, content_binary, is_binary, 
                    content_type, size_bytes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, ...params);
            
            console.log(`Created ${testFile.isDirectory ? 'directory' : 'file'}: ${testFile.filename} (ordinal: ${testFile.ordinal}, owner: ${owner_id})`);
        }

        // Test the vfs_readdir_by_owner function for the correct owner
        console.log(`Testing vfs_readdir_by_owner function for correct owner ${owner_id}...`);
        
        const readdirResult = await pgdb.query(`
            SELECT * FROM vfs_readdir_by_owner($1, $2, $3)
        `, owner_id, testParentPath, testRootKey);
        
        console.log(`vfs_readdir_by_owner returned ${readdirResult.rows.length} items for owner ${owner_id}:`);
        
        // Verify the results contain all files owned by the specified owner
        const expectedFiles = ['file-a.txt', 'file-b.txt', 'file-c.txt', 'dir-d', 'dir-e'];
        const actualFilenames = readdirResult.rows.map((row: any) => row.filename);
        
        console.log('Expected files for owner:', expectedFiles);
        console.log('Actual files returned:  ', actualFilenames);
        
        // Check each item in the results
        readdirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, owner: ${row.owner_id}, ${row.is_directory ? 'directory' : 'file'})`);
            
            // Verify owner_id matches
            if (row.owner_id !== owner_id) {
                throw new Error(`Owner mismatch! Expected owner ${owner_id}, got ${row.owner_id} for file ${row.filename}`);
            }
        });

        // Verify the correct files are returned
        for (const filename of actualFilenames) {
            if (!expectedFiles.includes(filename)) {
                throw new Error(`Unexpected file returned: ${filename}`);
            }
        }
        
        // Verify we got all expected files
        for (const expectedFile of expectedFiles) {
            if (!actualFilenames.includes(expectedFile)) {
                throw new Error(`Expected file not returned: ${expectedFile}`);
            }
        }

        // Verify the ordering is correct (by ordinal)
        const expectedOrderByOrdinal = ['file-a.txt', 'file-b.txt', 'file-c.txt', 'dir-d', 'dir-e']; // ordinals: 1000, 2000, 3000, 4000, 5000
        if (JSON.stringify(actualFilenames) !== JSON.stringify(expectedOrderByOrdinal)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrderByOrdinal.join(', ')}, Got: ${actualFilenames.join(', ')}`);
        }

        // Test for a non-existent owner (this should return empty results)
        const nonExistentOwnerId = 999999; // Use a very high ID that's unlikely to exist
        console.log(`Testing vfs_readdir_by_owner function for non-existent owner ${nonExistentOwnerId}...`);
        
        const readdirResult2 = await pgdb.query(`
            SELECT * FROM vfs_readdir_by_owner($1, $2, $3)
        `, nonExistentOwnerId, testParentPath, testRootKey);
        
        console.log(`vfs_readdir_by_owner returned ${readdirResult2.rows.length} items for non-existent owner ${nonExistentOwnerId}:`);
        
        // Verify no files are returned for non-existent owner
        if (readdirResult2.rows.length !== 0) {
            throw new Error(`Expected 0 files for non-existent owner, got: ${readdirResult2.rows.length}`);
        }

        console.log('✅ Owner filtering test passed');
        console.log('=== VFS Readdir By Owner Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Readdir By Owner Test Failed ===');
        console.error('Error during VFS readdir by owner test:', error);
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
