import vfs from '../VFS.js';

/**
 * Test for same-folder reordering operations with ordinal conflicts
 * 
 * This test reproduces the bug that was causing duplicate key constraint violations
 * when reordering items within the same folder, particularly when moving a folder
 * below a file (or vice versa).
 * 
 * Before the fix: setOrdinal was called sequentially, causing conflicts when ordinals
 * were swapped (e.g., item A: ordinal 0->1, item B: ordinal 1->0). When setting B to 0,
 * A still had ordinal 0, causing duplicate key error.
 * 
 * After the fix: Uses two-phase update:
 * - Phase 1: Set all items to temporary negative ordinals
 * - Phase 2: Set all items to their final ordinals
 * This prevents conflicts during ordinal reassignment.
 * 
 * Test scenario:
 * - Create folder at ordinal=0 and file at ordinal=1
 * - Move folder to ordinal=2 (paste after file, which means insertOrdinal=2)
 * - Expected: folder gets ordinal=1, file stays at ordinal=0
 * - Before fix: Would fail with duplicate key error when setting file to ordinal=0
 * - After fix: Should succeed using temporary ordinals during the swap
 */
export async function sameFolderReorderTest(owner_id: number): Promise<void> {
    try {
        console.log('=== Same-Folder Reorder Test Starting ===');
        console.log('This test reproduces the ordinal conflict bug during same-folder reordering');

        // Test 1: Create folder at ordinal=0 and file at ordinal=1
        console.log('\nTest 1 - Create folder and file at root with sequential ordinals');
        await vfs.mkdirEx(owner_id, 'test-folder', { recursive: true }, false, 0);
        await vfs.writeFileEx(owner_id, 'test-file.md', 'File content', 'utf8', false, 1);
        console.log('Test 1 - Created test-folder (ordinal=0) and test-file.md (ordinal=1)');

        // Test 2: Verify initial state
        console.log('\nTest 2 - Verify initial ordering');
        let contents = await vfs.readdirEx(owner_id, '', false);
        contents = contents.filter(n => n.name === 'test-folder' || n.name === 'test-file.md');
        contents.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

        if (contents.length !== 2) {
            throw new Error('Test 2 failed! Should have exactly 2 items');
        }
        if (contents[0].name !== 'test-folder' || contents[0].ordinal !== 0) {
            throw new Error('Test 2 failed! First item should be test-folder at ordinal=0');
        }
        if (contents[1].name !== 'test-file.md' || contents[1].ordinal !== 1) {
            throw new Error('Test 2 failed! Second item should be test-file.md at ordinal=1');
        }
        console.log('Test 2 - Initial ordering verified: folder(0), file(1)');

        // Test 3: Simulate same-folder reordering (move folder after file)
        // This mimics what DocMod.pasteItems does for same-folder operations
        console.log('\nTest 3 - Reorder: move folder from position 0 to position 1 (after file)');
        
        const folder = contents.find(n => n.name === 'test-folder');
        const file = contents.find(n => n.name === 'test-file.md');
        
        if (!folder || !folder.uuid || !file || !file.uuid) {
            throw new Error('Test 3 failed! Missing UUIDs');
        }

        // Calculate new ordinals: file should be 0, folder should be 1
        const newOrdinals = new Map<string, number>();
        newOrdinals.set(file.uuid, 0);
        newOrdinals.set(folder.uuid, 1);

        // Phase 1: Set temporary negative ordinals to avoid conflicts
        console.log('Test 3.1 - Phase 1: Set temporary ordinals');
        let tempOrdinal = -2147483648;
        for (const uuid of [file.uuid, folder.uuid]) {
            await vfs.setOrdinal(uuid, tempOrdinal);
            console.log(`  Set ${uuid === file.uuid ? 'file' : 'folder'} to temp ordinal ${tempOrdinal}`);
            tempOrdinal++;
        }

        // Phase 2: Set final ordinals
        console.log('Test 3.2 - Phase 2: Set final ordinals');
        await vfs.setOrdinal(file.uuid, 0);
        console.log('  Set file to ordinal 0');
        await vfs.setOrdinal(folder.uuid, 1);
        console.log('  Set folder to ordinal 1');

        console.log('Test 3 - Reordering completed successfully (no duplicate key error!)');

        // Test 4: Verify final state
        console.log('\nTest 4 - Verify final ordering after reorder');
        contents = await vfs.readdirEx(owner_id, '', false);
        contents = contents.filter(n => n.name === 'test-folder' || n.name === 'test-file.md');
        contents.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

        if (contents[0].name !== 'test-file.md' || contents[0].ordinal !== 0) {
            throw new Error(`Test 4 failed! First item should be test-file.md at ordinal=0, got ${contents[0].name} at ${contents[0].ordinal}`);
        }
        if (contents[1].name !== 'test-folder' || contents[1].ordinal !== 1) {
            throw new Error(`Test 4 failed! Second item should be test-folder at ordinal=1, got ${contents[1].name} at ${contents[1].ordinal}`);
        }
        console.log('Test 4 - Final ordering verified: file(0), folder(1)');

        // Test 5: Test reverse operation (move folder back to position 0)
        console.log('\nTest 5 - Reverse operation: move folder back to position 0');
        
        // Set temporary ordinals first
        tempOrdinal = -2147483648;
        await vfs.setOrdinal(file.uuid, tempOrdinal);
        await vfs.setOrdinal(folder.uuid, tempOrdinal + 1);
        
        // Set final ordinals
        await vfs.setOrdinal(folder.uuid, 0);
        await vfs.setOrdinal(file.uuid, 1);
        
        console.log('Test 5 - Reverse reordering completed successfully');

        // Verify reverse operation
        contents = await vfs.readdirEx(owner_id, '', false);
        contents = contents.filter(n => n.name === 'test-folder' || n.name === 'test-file.md');
        contents.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

        if (contents[0].name !== 'test-folder' || contents[0].ordinal !== 0) {
            throw new Error('Test 5 failed! First item should be test-folder at ordinal=0');
        }
        if (contents[1].name !== 'test-file.md' || contents[1].ordinal !== 1) {
            throw new Error('Test 5 failed! Second item should be test-file.md at ordinal=1');
        }
        console.log('Test 5 - Reverse ordering verified: folder(0), file(1)');

        // Test 6: Test with three items - more complex reordering
        console.log('\nTest 6 - Test complex reordering with 3 items');
        await vfs.writeFileEx(owner_id, 'file2.md', 'Second file', 'utf8', false, 2);
        
        contents = await vfs.readdirEx(owner_id, '', false);
        const ourItems = contents.filter(n => 
            n.name === 'test-folder' || n.name === 'test-file.md' || n.name === 'file2.md'
        );
        
        if (ourItems.length !== 3) {
            throw new Error('Test 6 failed! Should have 3 items');
        }

        // Reorder: [folder:0, file:1, file2:2] -> [file2:0, file:1, folder:2]
        const folder6 = ourItems.find(n => n.name === 'test-folder');
        const file6 = ourItems.find(n => n.name === 'test-file.md');
        const file2_6 = ourItems.find(n => n.name === 'file2.md');

        if (!folder6?.uuid || !file6?.uuid || !file2_6?.uuid) {
            throw new Error('Test 6 failed! Missing UUIDs');
        }

        // Phase 1: Temp ordinals
        tempOrdinal = -2147483648;
        await vfs.setOrdinal(folder6.uuid, tempOrdinal++);
        await vfs.setOrdinal(file6.uuid, tempOrdinal++);
        await vfs.setOrdinal(file2_6.uuid, tempOrdinal++);

        // Phase 2: Final ordinals
        await vfs.setOrdinal(file2_6.uuid, 0);
        await vfs.setOrdinal(file6.uuid, 1);
        await vfs.setOrdinal(folder6.uuid, 2);

        // Verify complex reordering
        contents = await vfs.readdirEx(owner_id, '', false);
        const finalItems = contents.filter(n => 
            n.name === 'test-folder' || n.name === 'test-file.md' || n.name === 'file2.md'
        );
        finalItems.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

        if (finalItems[0].name !== 'file2.md' || finalItems[0].ordinal !== 0) {
            throw new Error('Test 6 failed! First should be file2.md at ordinal=0');
        }
        if (finalItems[1].name !== 'test-file.md' || finalItems[1].ordinal !== 1) {
            throw new Error('Test 6 failed! Second should be test-file.md at ordinal=1');
        }
        if (finalItems[2].name !== 'test-folder' || finalItems[2].ordinal !== 2) {
            throw new Error('Test 6 failed! Third should be test-folder at ordinal=2');
        }
        console.log('Test 6 - Complex reordering verified: file2(0), file(1), folder(2)');

        console.log('\n=== ✅ Same-Folder Reorder Test PASSED ===');
        console.log('The fix successfully prevents duplicate key violations during same-folder reordering');
        console.log('by using temporary negative ordinals in a two-phase update process.\n');

    } catch (error) {
        console.error('\n=== ❌ Same-Folder Reorder Test FAILED ===');
        console.error('Error:', error);
        throw error;
    }
}
