import vfs from '../VFS.js';

/**
 * Test for cross-folder paste operations with ordinal conflicts
 * 
 * This test reproduces the bug that was causing duplicate key constraint violations
 * when pasting files across folders where the source file's ordinal matched an ordinal
 * in the target folder.
 * 
 * Before the fix: vfs_rename preserved the source file's ordinal, causing duplicate key
 * violations on the unique constraint (doc_root_key, parent_path, ordinal).
 * 
 * After the fix: vfs_rename sets ordinal to -2147483648 (temporary value) during the move,
 * then the calling code sets the correct ordinal, preventing conflicts.
 * 
 * Test scenario:
 * - Source folder: file1 with ordinal=4
 * - Target folder: items with ordinals 0,1,2,3,4,5
 * - Paste file1 into target at position 3 (insertOrdinal=4)
 * - Before fix: Would fail with duplicate key error (two items with ordinal=4)
 * - After fix: Should succeed by using temporary negative ordinal during move
 */
export async function crossFolderPasteTest(owner_id: number): Promise<void> {
    try {
        console.log('=== Cross-Folder Paste Test Starting ===');
        console.log('This test reproduces the ordinal conflict bug during cross-folder paste operations');

        // Test 1: Create source folder and file
        console.log('\nTest 1 - Create source folder with file at ordinal=4');
        await vfs.mkdirEx(owner_id, 'source-folder', { recursive: true }, false, 0);
        await vfs.writeFileEx(owner_id, 'source-folder/file-to-move.txt', 'File content', 'utf8', false, 4);
        console.log('Test 1 - Created source-folder/file-to-move.txt with ordinal=4');

        // Test 2: Create target folder with files at ordinals 0,1,2,3,4,5
        console.log('\nTest 2 - Create target folder with sequential ordinals 0-5');
        await vfs.mkdirEx(owner_id, 'target-folder', { recursive: true }, false, 1);
        
        const targetFiles = [
            { name: 'target-file-0.txt', ordinal: 0 },
            { name: 'target-file-1.txt', ordinal: 1 },
            { name: 'target-file-2.txt', ordinal: 2 },
            { name: 'target-file-3.txt', ordinal: 3 },
            { name: 'target-file-4.txt', ordinal: 4 },
            { name: 'target-file-5.txt', ordinal: 5 }
        ];

        for (const file of targetFiles) {
            await vfs.writeFileEx(owner_id, `target-folder/${file.name}`, `Content ${file.ordinal}`, 'utf8', false, file.ordinal);
            console.log(`Test 2 - Created target-folder/${file.name} with ordinal=${file.ordinal}`);
        }

        // Test 3: Verify initial state
        console.log('\nTest 3 - Verify initial file positions');
        let sourceContents = await vfs.readdirEx(owner_id, 'source-folder', false);
        let targetContents = await vfs.readdirEx(owner_id, 'target-folder', false);
        
        const sourceFile = sourceContents.find(n => n.name === 'file-to-move.txt');
        if (!sourceFile || sourceFile.ordinal !== 4) {
            throw new Error('Test 3 failed! Source file should have ordinal=4');
        }
        console.log(`Test 3 - Source file verified: ordinal=${sourceFile.ordinal}`);

        const targetFile4 = targetContents.find(n => n.name === 'target-file-4.txt');
        if (!targetFile4 || targetFile4.ordinal !== 4) {
            throw new Error('Test 3 failed! Target folder should have file at ordinal=4');
        }
        console.log('Test 3 - Target folder verified: has file at ordinal=4');

        // Test 4: Simulate cross-folder paste operation (insert after position 3)
        // This mimics what DocMod.pasteItems does for cross-folder operations
        console.log('\nTest 4 - Simulate cross-folder paste: move file from source to target at position 3');
        const insertOrdinal = 4; // Insert after ordinal 3 (targetOrdinal=3 means insertOrdinal=4)
        
        // Step 1: Shift ordinals in target folder to make room
        console.log('Test 4.1 - Shift target folder ordinals down to make room');
        await vfs.shiftOrdinalsDown(owner_id, 'target-folder', insertOrdinal, 1);
        
        // Verify shift worked
        targetContents = await vfs.readdirEx(owner_id, 'target-folder', false);
        const shiftedFile = targetContents.find(n => n.name === 'target-file-4.txt');
        if (!shiftedFile || shiftedFile.ordinal !== 5) {
            throw new Error('Test 4.1 failed! target-file-4.txt should have been shifted from ordinal 4 to 5');
        }
        console.log('Test 4.1 - Ordinals shifted successfully: target-file-4.txt now at ordinal=5');

        // Step 2: Move the file (this is where the bug occurred - rename would preserve ordinal=4)
        console.log('Test 4.2 - Rename/move file to target folder');
        await vfs.rename(owner_id, 'source-folder/file-to-move.txt', 'target-folder/file-to-move.txt');
        console.log('Test 4.2 - File moved successfully (no duplicate key error!)');

        // Step 3: Set the correct ordinal (as DocMod.pasteItems does)
        console.log('Test 4.3 - Set correct ordinal for moved file');
        targetContents = await vfs.readdirEx(owner_id, 'target-folder', false);
        const movedFile = targetContents.find(n => n.name === 'file-to-move.txt');
        
        if (!movedFile || !movedFile.uuid) {
            throw new Error('Test 4.3 failed! Moved file not found in target folder');
        }
        
        // Before setting ordinal, verify it has the temporary negative value
        if (movedFile.ordinal !== -2147483648) {
            console.log(`⚠️  Warning: Expected temporary ordinal -2147483648, got ${movedFile.ordinal}`);
        }
        
        await vfs.setOrdinal(movedFile.uuid, insertOrdinal);
        console.log(`Test 4.3 - Set ordinal to ${insertOrdinal}`);

        // Test 5: Verify final state - all files should have correct ordinals
        console.log('\nTest 5 - Verify final file positions');
        targetContents = await vfs.readdirEx(owner_id, 'target-folder', false);
        targetContents.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

        console.log('Test 5 - Final target folder contents (sorted by ordinal):');
        targetContents.forEach(file => {
            console.log(`  - ${file.name}: ordinal=${file.ordinal}`);
        });

        // Verify expected ordinals
        const expectedOrdering = [
            { name: 'target-file-0.txt', ordinal: 0 },
            { name: 'target-file-1.txt', ordinal: 1 },
            { name: 'target-file-2.txt', ordinal: 2 },
            { name: 'target-file-3.txt', ordinal: 3 },
            { name: 'file-to-move.txt', ordinal: 4 },  // Inserted at position 4
            { name: 'target-file-4.txt', ordinal: 5 },  // Shifted from 4 to 5
            { name: 'target-file-5.txt', ordinal: 6 }   // Shifted from 5 to 6
        ];

        for (const expected of expectedOrdering) {
            const file = targetContents.find(f => f.name === expected.name);
            if (!file) {
                throw new Error(`Test 5 failed! File ${expected.name} not found`);
            }
            if (file.ordinal !== expected.ordinal) {
                throw new Error(`Test 5 failed! File ${expected.name} should have ordinal=${expected.ordinal}, got ${file.ordinal}`);
            }
        }

        console.log('Test 5 - All files have correct ordinals after paste operation');

        // Test 6: Verify source folder is now empty (except for the folder itself)
        console.log('\nTest 6 - Verify source folder is empty after move');
        sourceContents = await vfs.readdirEx(owner_id, 'source-folder', false);
        if (sourceContents.length > 0) {
            throw new Error(`Test 6 failed! Source folder should be empty, found ${sourceContents.length} items`);
        }
        console.log('Test 6 - Source folder is empty as expected');

        // Test 7: Test edge case - moving file with ordinal=0 to folder that has ordinal=0
        console.log('\nTest 7 - Test edge case: move file with ordinal=0 to target with ordinal=0');
        await vfs.mkdirEx(owner_id, 'source2-folder', { recursive: true }, false, 2);
        await vfs.writeFileEx(owner_id, 'source2-folder/file-zero.txt', 'Zero content', 'utf8', false, 0);
        
        // Target folder already has file at ordinal=0, shift it and insert new one
        await vfs.shiftOrdinalsDown(owner_id, 'target-folder', 0, 1);
        await vfs.rename(owner_id, 'source2-folder/file-zero.txt', 'target-folder/file-zero.txt');
        
        targetContents = await vfs.readdirEx(owner_id, 'target-folder', false);
        const zeroFile = targetContents.find(n => n.name === 'file-zero.txt');
        if (!zeroFile || !zeroFile.uuid) {
            throw new Error('Test 7 failed! file-zero.txt not found after move');
        }
        
        await vfs.setOrdinal(zeroFile.uuid, 0);
        console.log('Test 7 - Successfully moved file with ordinal=0 (edge case)');

        // Verify no duplicate ordinals in final state
        targetContents = await vfs.readdirEx(owner_id, 'target-folder', false);
        const ordinals = targetContents.map(f => f.ordinal);
        const uniqueOrdinals = new Set(ordinals);
        if (ordinals.length !== uniqueOrdinals.size) {
            throw new Error('Test 7 failed! Found duplicate ordinals in target folder');
        }
        console.log(`Test 7 - No duplicate ordinals found (${ordinals.length} files, ${uniqueOrdinals.size} unique ordinals)`);

        console.log('\n=== ✅ Cross-Folder Paste Test PASSED ===');
        console.log('The fix successfully prevents duplicate key violations during cross-folder paste operations');
        console.log('by using a temporary negative ordinal (-2147483648) during the rename operation.\n');

    } catch (error) {
        console.error('\n=== ❌ Cross-Folder Paste Test FAILED ===');
        console.error('Error:', error);
        throw error;
    }
}
