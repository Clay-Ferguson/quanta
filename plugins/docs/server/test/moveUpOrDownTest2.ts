import vfs from '../VFS.js';

/**
 * Test for moveUpOrDown functionality with ordinals 0 and 1
 * This test reproduces the unique constraint violation bug when swapping
 * two files with consecutive ordinals starting from 0.
 * 
 * Expected error: "duplicate key value violates unique constraint 
 * vfs_nodes_doc_root_key_parent_path_ordinal_key"
 */
export async function moveUpOrDownTest2(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS MoveUpOrDown Test 2 Starting ===');
        console.log('Testing ordinal swap with initial ordinals 0 and 1');

        // Create test files with ordinals 0 and 1 at root level
        const testFiles = [
            { name: 'test-move2-file1.txt', content: 'File 1', ordinal: 0 },
            { name: 'test-move2-file2.txt', content: 'File 2', ordinal: 1 },
        ];

        console.log('Test 1 - Creating test files with ordinals 0 and 1');
        for (const file of testFiles) {
            await vfs.writeFileEx(owner_id, file.name, file.content, 'utf8', false, file.ordinal);
            console.log(`Test 1 - Created ${file.name} with ordinal ${file.ordinal}`);
        }

        // Test 2: Read directory and verify initial ordering
        console.log('Test 2 - Verify initial file ordering');
        let contents = await vfs.readdirEx(owner_id, '', false);
        let ourFiles = contents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        
        ourFiles.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        console.log('Test 2 - Initial ordering:');
        ourFiles.forEach((file, idx) => {
            console.log(`  ${idx}: ${file.name} - ordinal ${file.ordinal}`);
        });
        
        // Verify initial order
        if (ourFiles[0].name !== 'test-move2-file1.txt' || 
            ourFiles[1].name !== 'test-move2-file2.txt') {
            throw new Error('Test 2 failed! Initial ordering is incorrect');
        }
        
        if (ourFiles[0].ordinal !== 0 || ourFiles[1].ordinal !== 1) {
            throw new Error('Test 2 failed! Initial ordinals should be 0 and 1');
        }
        console.log('Test 2 - Initial ordering verified');

        // Test 3: Move file2 up (swap with file1)
        // This is where the bug should occur - swapping ordinals 0 and 1
        console.log('Test 3 - Move file2 up (swap ordinals 0 and 1)');
        const file1 = ourFiles[0];
        const file2 = ourFiles[1];
        
        if (!file1.uuid || !file2.uuid) {
            throw new Error('Test 4 failed! Files should have UUIDs');
        }
        
        const file1Ordinal = file1.ordinal || 0;
        const file2Ordinal = file2.ordinal || 0;
        
        console.log(`Test 3 - Attempting to swap ordinals: ${file1.name} (${file1Ordinal}) with ${file2.name} (${file2Ordinal})`);
        
        // Use the new atomic swap function which handles the unique constraint properly
        try {
            await vfs.swapOrdinals(file1.uuid, file2.uuid);
            console.log(`Test 3 - Successfully swapped ordinals using atomic swap function`);
        } catch (error: any) {
            if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
                console.error('Test 3 - REPRODUCED THE BUG! Unique constraint violation occurred');
                console.error('Error message:', error.message);
                throw new Error('SUCCESSFULLY REPRODUCED: Unique constraint violation when swapping ordinals 0 and 1');
            }
            throw error;
        }
        
        // Verify new ordering
        contents = await vfs.readdirEx(owner_id, '', false);
        ourFiles = contents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        ourFiles.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        console.log('Test 3 - New ordering after move up:');
        ourFiles.forEach((file, idx) => {
            console.log(`  ${idx}: ${file.name} - ordinal ${file.ordinal}`);
        });
        
        if (ourFiles[0].name !== 'test-move2-file2.txt' || 
            ourFiles[1].name !== 'test-move2-file1.txt') {
            throw new Error('Test 3 failed! Ordering after move up is incorrect');
        }
        
        if (ourFiles[0].ordinal !== 0 || ourFiles[1].ordinal !== 1) {
            throw new Error('Test 3 failed! Ordinals after swap should still be 0 and 1');
        }
        console.log('Test 3 - Move up verified');

        // Cleanup
        console.log('Cleanup - Removing test files');
        for (const file of testFiles) {
            try {
                await vfs.unlink(owner_id, file.name);
                console.log(`Cleanup - Deleted ${file.name}`);
            } catch (error) {
                console.log(`Cleanup - Could not delete ${file.name}:`, error);
            }
        }

        console.log('✅ All moveUpOrDown test 2 cases passed');
        console.log('=== VFS MoveUpOrDown Test 2 Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS MoveUpOrDown Test 2 Failed ===');
        console.error('Error during VFS moveUpOrDown test 2:', error);
        throw error;
    }
}
