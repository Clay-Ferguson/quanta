import vfs from '../VFS.js';

/**
 * Test for moveUpOrDown functionality - simulates ordinal swapping between adjacent items
 * This tests the core logic used by DocMod.moveUpOrDown
 */
export async function moveUpOrDownTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS MoveUpOrDown Test Starting ===');

        // Create test files with specific ordinals
        const testFiles = [
            { name: 'test-move-file1.txt', content: 'File 1', ordinal: 100 },
            { name: 'test-move-file2.txt', content: 'File 2', ordinal: 200 },
            { name: 'test-move-file3.txt', content: 'File 3', ordinal: 300 },
        ];

        console.log('Test 1 - Creating test files with ordinals');
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
        if (ourFiles[0].name !== 'test-move-file1.txt' || 
            ourFiles[1].name !== 'test-move-file2.txt' || 
            ourFiles[2].name !== 'test-move-file3.txt') {
            throw new Error('Test 2 failed! Initial ordering is incorrect');
        }
        console.log('Test 2 - Initial ordering verified');

        // Test 3: Move file2 up (swap with file1)
        console.log('Test 3 - Move file2 up (swap ordinals with file1)');
        const file1 = ourFiles[0];
        const file2 = ourFiles[1];
        
        if (!file1.uuid || !file2.uuid) {
            throw new Error('Test 3 failed! Files should have UUIDs');
        }
        
        const file1Ordinal = file1.ordinal || 0;
        const file2Ordinal = file2.ordinal || 0;
        
        // Swap ordinals using the new atomic swap function
        await vfs.swapOrdinals(file1.uuid, file2.uuid);
        console.log(`Test 3 - Swapped ordinals: ${file1.name} (${file1Ordinal}<->${file2Ordinal}) with ${file2.name} (${file2Ordinal}<->${file1Ordinal})`);
        
        // Verify new ordering
        contents = await vfs.readdirEx(owner_id, '', false);
        ourFiles = contents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        ourFiles.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        console.log('Test 3 - New ordering after move up:');
        ourFiles.forEach((file, idx) => {
            console.log(`  ${idx}: ${file.name} - ordinal ${file.ordinal}`);
        });
        
        if (ourFiles[0].name !== 'test-move-file2.txt' || 
            ourFiles[1].name !== 'test-move-file1.txt' || 
            ourFiles[2].name !== 'test-move-file3.txt') {
            throw new Error('Test 3 failed! Ordering after move up is incorrect');
        }
        console.log('Test 3 - Move up verified');

        // Test 4: Move file2 down (swap with file1 again, back to original)
        console.log('Test 4 - Move file2 down (swap ordinals with file1 again)');
        const newFile1 = ourFiles[1]; // this is actually test-move-file1.txt
        const newFile2 = ourFiles[0]; // this is actually test-move-file2.txt
        
        if (!newFile1.uuid || !newFile2.uuid) {
            throw new Error('Test 4 failed! Files should have UUIDs');
        }
        
        // Swap ordinals back using the atomic swap function
        await vfs.swapOrdinals(newFile1.uuid, newFile2.uuid);
        console.log(`Test 4 - Swapped ordinals back: ${newFile1.name} with ${newFile2.name}`);
        
        // Verify we're back to original ordering
        contents = await vfs.readdirEx(owner_id, '', false);
        ourFiles = contents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        ourFiles.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        console.log('Test 4 - Ordering after move down:');
        ourFiles.forEach((file, idx) => {
            console.log(`  ${idx}: ${file.name} - ordinal ${file.ordinal}`);
        });
        
        if (ourFiles[0].name !== 'test-move-file1.txt' || 
            ourFiles[1].name !== 'test-move-file2.txt' || 
            ourFiles[2].name !== 'test-move-file3.txt') {
            throw new Error('Test 4 failed! Ordering after move down is incorrect');
        }
        console.log('Test 4 - Move down verified');

        // Test 5: Move file3 up twice (to position 0)
        console.log('Test 5 - Move file3 up twice (to first position)');
        const file3 = ourFiles[2];
        const file2Again = ourFiles[1];
        
        if (!file3.uuid || !file2Again.uuid) {
            throw new Error('Test 5 failed! Files should have UUIDs');
        }
        
        // First swap: file3 with file2
        await vfs.swapOrdinals(file3.uuid, file2Again.uuid);
        console.log(`Test 5 - First swap: ${file3.name} with ${file2Again.name}`);
        
        // Refresh and get new positions
        contents = await vfs.readdirEx(owner_id, '', false);
        ourFiles = contents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        ourFiles.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        // Second swap: file3 (now at position 1) with file1 (at position 0)
        const file1Again = ourFiles[0];
        const file3Again = ourFiles[1];
        
        if (!file1Again.uuid || !file3Again.uuid) {
            throw new Error('Test 5 failed! Files should have UUIDs');
        }
        
        await vfs.swapOrdinals(file3Again.uuid, file1Again.uuid);
        console.log(`Test 5 - Second swap: ${file3Again.name} with ${file1Again.name}`);
        
        // Verify final ordering
        contents = await vfs.readdirEx(owner_id, '', false);
        ourFiles = contents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        ourFiles.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        console.log('Test 5 - Final ordering:');
        ourFiles.forEach((file, idx) => {
            console.log(`  ${idx}: ${file.name} - ordinal ${file.ordinal}`);
        });
        
        if (ourFiles[0].name !== 'test-move-file3.txt' || 
            ourFiles[1].name !== 'test-move-file1.txt' || 
            ourFiles[2].name !== 'test-move-file2.txt') {
            throw new Error('Test 5 failed! Final ordering after multiple moves is incorrect');
        }
        console.log('Test 5 - Multiple moves verified');

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

        console.log('✅ All moveUpOrDown tests passed');
        console.log('=== VFS MoveUpOrDown Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS MoveUpOrDown Test Failed ===');
        console.error('Error during VFS moveUpOrDown test:', error);
        throw error;
    }
}
