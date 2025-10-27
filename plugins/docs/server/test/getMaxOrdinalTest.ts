import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function getMaxOrdinalTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-max-ordinal';
    
    try {
        console.log('=== VFS Get Max Ordinal Test Starting ===');

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
        
        // Test 1: Empty directory should return 0
        console.log('Testing empty directory (should return 0)...');
        
        const emptyResult = await pgdb.query(`
            SELECT vfs_get_max_ordinal($1, $2) as max_ordinal
        `, testParentPath, testRootKey);
        
        const emptyMaxOrdinal = emptyResult.rows[0].max_ordinal;
        console.log(`Max ordinal for empty directory: ${emptyMaxOrdinal}`);
        
        if (emptyMaxOrdinal !== 0) {
            throw new Error(`Expected max ordinal 0 for empty directory, got: ${emptyMaxOrdinal}`);
        }
        
        // Test 2: Create files with various ordinal values and test max ordinal
        const testFiles = [
            { filename: 'file-100.txt', ordinal: 100, content: 'Content 100' },
            { filename: 'file-500.txt', ordinal: 500, content: 'Content 500' },
            { filename: 'file-250.txt', ordinal: 250, content: 'Content 250' },
            { filename: 'dir-750', ordinal: 750, isDirectory: true },
            { filename: 'file-1000.txt', ordinal: 1000, content: 'Content 1000' },
            { filename: 'file-50.txt', ordinal: 50, content: 'Content 50' },
        ];

        console.log('Creating test files with various ordinal values...');
        
        // Insert test files/directories with different ordinal values
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
            
            console.log(`Created ${testFile.isDirectory ? 'directory' : 'file'}: ${testFile.filename} (ordinal: ${testFile.ordinal})`);
        }

        // Test the vfs_get_max_ordinal function
        console.log('Testing vfs_get_max_ordinal function...');
        
        const maxOrdinalResult = await pgdb.query(`
            SELECT vfs_get_max_ordinal($1, $2) as max_ordinal
        `, testParentPath, testRootKey);
        
        const actualMaxOrdinal = maxOrdinalResult.rows[0].max_ordinal;
        const expectedMaxOrdinal = 1000; // Should be the highest ordinal from our test files
        
        console.log(`Max ordinal result: ${actualMaxOrdinal}`);
        console.log(`Expected max ordinal: ${expectedMaxOrdinal}`);
        
        if (actualMaxOrdinal !== expectedMaxOrdinal) {
            throw new Error(`Max ordinal mismatch! Expected: ${expectedMaxOrdinal}, Got: ${actualMaxOrdinal}`);
        }

        // Test 3: Add a file with an even higher ordinal to verify function updates correctly
        console.log('Adding file with higher ordinal (2000) to test function updates...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, 'file-2000.txt', 2000, 
        false, false, 'Content 2000', null, false, 'text/plain', Buffer.from('Content 2000').length);
        
        // Test max ordinal again
        const updatedMaxOrdinalResult = await pgdb.query(`
            SELECT vfs_get_max_ordinal($1, $2) as max_ordinal
        `, testParentPath, testRootKey);
        
        const updatedMaxOrdinal = updatedMaxOrdinalResult.rows[0].max_ordinal;
        const expectedUpdatedMaxOrdinal = 2000;
        
        console.log(`Updated max ordinal result: ${updatedMaxOrdinal}`);
        console.log(`Expected updated max ordinal: ${expectedUpdatedMaxOrdinal}`);
        
        if (updatedMaxOrdinal !== expectedUpdatedMaxOrdinal) {
            throw new Error(`Updated max ordinal mismatch! Expected: ${expectedUpdatedMaxOrdinal}, Got: ${updatedMaxOrdinal}`);
        }

        // Test 4: Test that function only considers direct children (not sub-directories)
        const subDirectoryPath = testParentPath + '/subdir';
        
        console.log('Testing that function only considers direct children...');
        console.log(`Creating file in subdirectory: ${subDirectoryPath}`);
        
        // Create a subdirectory first
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, 'subdir', 800, 
        true, false, null, null, false, 'directory', 0);
        
        // Create a file in the subdirectory with a very high ordinal
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, subDirectoryPath, 'file-9999.txt', 9999, 
        false, false, 'Content 9999', null, false, 'text/plain', Buffer.from('Content 9999').length);
        
        console.log('Created file in subdirectory with ordinal 9999');
        
        // Test max ordinal for parent directory (should still be 2000, not affected by subdirectory content)
        const finalMaxOrdinalResult = await pgdb.query(`
            SELECT vfs_get_max_ordinal($1, $2) as max_ordinal
        `, testParentPath, testRootKey);
        
        const finalMaxOrdinal = finalMaxOrdinalResult.rows[0].max_ordinal;
        const expectedFinalMaxOrdinal = 2000; // Should not include the 9999 from the subdirectory
        
        console.log(`Final max ordinal result (should ignore subdirectory): ${finalMaxOrdinal}`);
        console.log(`Expected final max ordinal: ${expectedFinalMaxOrdinal}`);
        
        if (finalMaxOrdinal !== expectedFinalMaxOrdinal) {
            throw new Error(`Final max ordinal mismatch! Function should only consider direct children. Expected: ${expectedFinalMaxOrdinal}, Got: ${finalMaxOrdinal}`);
        }

        console.log('✅ All max ordinal tests passed');
        console.log('=== VFS Get Max Ordinal Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Get Max Ordinal Test Failed ===');
        console.error('Error during VFS get max ordinal test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            // Clean up subdirectory and its contents first
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
            
            // Clean up main test directory
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            `, testRootKey, testParentPath);
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}
