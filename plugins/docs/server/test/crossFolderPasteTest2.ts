import vfs from '../VFS.js';

/**
 * Test for cross-folder paste operations with MULTIPLE items and nested folders
 * 
 * This test extends crossFolderPasteTest by testing more complex scenarios:
 * 1. Moving multiple items at once (not just one)
 * 2. Moving a folder with nested children to verify child paths are updated
 * 3. Pasting at the very beginning of the target folder (targetOrdinal = -1, insertOrdinal = 0)
 * 4. Pasting into an empty target folder
 * 5. Verifying ordinals remain consecutive with no gaps or duplicates
 * 
 * These scenarios exercise the shiftOrdinalsDown logic with larger offsets and
 * ensure proper ordinal assignment when moving multiple items.
 */
export async function crossFolderPasteTest2(owner_id: number): Promise<void> {
    try {
        console.log('=== Cross-Folder Paste Test 2 (Multiple Items & Nested Folders) Starting ===');

        // =====================================================
        // SECTION A: Move multiple items at once to middle of target folder
        // =====================================================
        console.log('\n--- Section A: Move multiple items to middle of target folder ---');

        // Create source folder with 3 items to move
        console.log('\nA.1 - Create source folder with 3 items');
        await vfs.mkdirEx(owner_id, 'multi-source', { recursive: true }, false, 0);
        await vfs.writeFileEx(owner_id, 'multi-source/item-a.txt', 'Content A', 'utf8', false, 0);
        await vfs.writeFileEx(owner_id, 'multi-source/item-b.txt', 'Content B', 'utf8', false, 1);
        await vfs.writeFileEx(owner_id, 'multi-source/item-c.txt', 'Content C', 'utf8', false, 2);
        console.log('A.1 - Created multi-source with item-a.txt(0), item-b.txt(1), item-c.txt(2)');

        // Create target folder with 4 existing items
        console.log('\nA.2 - Create target folder with 4 items at ordinals 0,1,2,3');
        await vfs.mkdirEx(owner_id, 'multi-target', { recursive: true }, false, 1);
        await vfs.writeFileEx(owner_id, 'multi-target/target-0.txt', 'Target 0', 'utf8', false, 0);
        await vfs.writeFileEx(owner_id, 'multi-target/target-1.txt', 'Target 1', 'utf8', false, 1);
        await vfs.writeFileEx(owner_id, 'multi-target/target-2.txt', 'Target 2', 'utf8', false, 2);
        await vfs.writeFileEx(owner_id, 'multi-target/target-3.txt', 'Target 3', 'utf8', false, 3);
        console.log('A.2 - Created multi-target with target-0.txt through target-3.txt');

        // A.3: Move all 3 source items to target folder at position after ordinal 1
        // insertOrdinal = targetOrdinal + 1 = 1 + 1 = 2
        console.log('\nA.3 - Move 3 items from source to target after ordinal 1 (insertOrdinal=2)');
        const insertOrdinalA = 2;
        const numItemsToMoveA = 3;

        // Step 1: Shift ordinals in target folder
        await vfs.shiftOrdinalsDown(owner_id, 'multi-target', insertOrdinalA, numItemsToMoveA);
        console.log(`A.3.1 - Shifted target ordinals >= ${insertOrdinalA} down by ${numItemsToMoveA}`);

        // Step 2: Move each file and set ordinal
        const sourceItemsA = ['item-a.txt', 'item-b.txt', 'item-c.txt'];
        for (let i = 0; i < sourceItemsA.length; i++) {
            const itemName = sourceItemsA[i];
            await vfs.rename(owner_id, `multi-source/${itemName}`, `multi-target/${itemName}`);
            
            const targetContents = await vfs.readdirEx(owner_id, 'multi-target', false);
            const movedNode = targetContents.find(n => n.name === itemName);
            if (!movedNode || !movedNode.uuid) {
                throw new Error(`A.3.2 failed! Could not find moved item ${itemName}`);
            }
            
            await vfs.setOrdinal(movedNode.uuid, insertOrdinalA + i);
            console.log(`A.3.2 - Moved ${itemName} and set ordinal to ${insertOrdinalA + i}`);
        }

        // A.4: Verify final state
        console.log('\nA.4 - Verify final ordering in multi-target');
        const targetContentsA = await vfs.readdirEx(owner_id, 'multi-target', false);
        targetContentsA.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

        const expectedOrderingA = [
            { name: 'target-0.txt', ordinal: 0 },
            { name: 'target-1.txt', ordinal: 1 },
            { name: 'item-a.txt', ordinal: 2 },   // Inserted
            { name: 'item-b.txt', ordinal: 3 },   // Inserted
            { name: 'item-c.txt', ordinal: 4 },   // Inserted
            { name: 'target-2.txt', ordinal: 5 }, // Shifted from 2 to 5
            { name: 'target-3.txt', ordinal: 6 }  // Shifted from 3 to 6
        ];

        console.log('A.4 - Actual ordering:');
        for (const file of targetContentsA) {
            console.log(`  ${file.name}: ordinal=${file.ordinal}`);
        }

        for (const expected of expectedOrderingA) {
            const file = targetContentsA.find(f => f.name === expected.name);
            if (!file) {
                throw new Error(`A.4 failed! File ${expected.name} not found`);
            }
            if (file.ordinal !== expected.ordinal) {
                throw new Error(`A.4 failed! File ${expected.name} should have ordinal=${expected.ordinal}, got ${file.ordinal}`);
            }
        }
        console.log('A.4 - ✅ All ordinals correct after moving multiple items');

        // Verify no duplicate ordinals
        const ordinalsA = targetContentsA.map(f => f.ordinal);
        const uniqueOrdinalsA = new Set(ordinalsA);
        if (ordinalsA.length !== uniqueOrdinalsA.size) {
            throw new Error('A.4 failed! Found duplicate ordinals');
        }
        console.log('A.4 - ✅ No duplicate ordinals');

        // =====================================================
        // SECTION B: Move folder with nested children
        // =====================================================
        console.log('\n--- Section B: Move folder with nested children ---');

        // Create a folder structure with nested files
        console.log('\nB.1 - Create folder with nested structure');
        await vfs.mkdirEx(owner_id, 'parent-folder', { recursive: true }, false, 2);
        await vfs.mkdirEx(owner_id, 'parent-folder/child-folder', { recursive: true }, false, 0);
        await vfs.writeFileEx(owner_id, 'parent-folder/child-folder/nested-file.txt', 'Nested content', 'utf8', false, 0);
        await vfs.writeFileEx(owner_id, 'parent-folder/sibling-file.txt', 'Sibling content', 'utf8', false, 1);
        console.log('B.1 - Created parent-folder with child-folder/nested-file.txt and sibling-file.txt');

        // Verify nested structure exists
        const nestedBefore = await vfs.readdirEx(owner_id, 'parent-folder/child-folder', false);
        if (nestedBefore.length !== 1 || nestedBefore[0].name !== 'nested-file.txt') {
            throw new Error('B.1 failed! Nested structure not created correctly');
        }
        console.log('B.1 - ✅ Nested structure verified');

        // Create target folder for the folder move
        console.log('\nB.2 - Create folder-target with one existing item');
        await vfs.mkdirEx(owner_id, 'folder-target', { recursive: true }, false, 3);
        await vfs.writeFileEx(owner_id, 'folder-target/existing.txt', 'Existing', 'utf8', false, 0);

        // B.3: Move the entire parent-folder into folder-target
        console.log('\nB.3 - Move parent-folder into folder-target');
        const insertOrdinalB = 1; // Insert at position 1 (after existing.txt)
        
        await vfs.shiftOrdinalsDown(owner_id, 'folder-target', insertOrdinalB, 1);
        await vfs.rename(owner_id, 'parent-folder', 'folder-target/parent-folder');
        
        const folderTargetContents = await vfs.readdirEx(owner_id, 'folder-target', false);
        const movedFolder = folderTargetContents.find(n => n.name === 'parent-folder');
        if (!movedFolder || !movedFolder.uuid) {
            throw new Error('B.3 failed! parent-folder not found after move');
        }
        await vfs.setOrdinal(movedFolder.uuid, insertOrdinalB);
        console.log('B.3 - parent-folder moved and ordinal set');

        // B.4: Verify the nested structure is preserved after the move
        console.log('\nB.4 - Verify nested structure is preserved');
        
        // Check the moved folder's children
        const movedFolderContents = await vfs.readdirEx(owner_id, 'folder-target/parent-folder', false);
        if (movedFolderContents.length !== 2) {
            throw new Error(`B.4 failed! parent-folder should have 2 children, found ${movedFolderContents.length}`);
        }
        console.log('B.4 - parent-folder has correct number of children');

        // Check the deeply nested file
        const nestedAfter = await vfs.readdirEx(owner_id, 'folder-target/parent-folder/child-folder', false);
        if (nestedAfter.length !== 1 || nestedAfter[0].name !== 'nested-file.txt') {
            throw new Error('B.4 failed! Nested file not preserved after move');
        }
        
        // Verify content of nested file
        const nestedContent = await vfs.readFile(owner_id, 'folder-target/parent-folder/child-folder/nested-file.txt', 'utf8');
        if (nestedContent !== 'Nested content') {
            throw new Error('B.4 failed! Nested file content corrupted after move');
        }
        console.log('B.4 - ✅ Nested structure and content preserved');

        // =====================================================
        // SECTION C: Paste at the very beginning (insertOrdinal = 0)
        // =====================================================
        console.log('\n--- Section C: Paste at the very beginning of folder ---');

        // Create source with items to move to the beginning
        console.log('\nC.1 - Create source items for beginning-paste');
        await vfs.mkdirEx(owner_id, 'begin-source', { recursive: true }, false, 4);
        await vfs.writeFileEx(owner_id, 'begin-source/first.txt', 'First', 'utf8', false, 0);
        await vfs.writeFileEx(owner_id, 'begin-source/second.txt', 'Second', 'utf8', false, 1);

        // Create target with existing items
        console.log('\nC.2 - Create target folder with items at 0, 1, 2');
        await vfs.mkdirEx(owner_id, 'begin-target', { recursive: true }, false, 5);
        await vfs.writeFileEx(owner_id, 'begin-target/existing-0.txt', 'E0', 'utf8', false, 0);
        await vfs.writeFileEx(owner_id, 'begin-target/existing-1.txt', 'E1', 'utf8', false, 1);
        await vfs.writeFileEx(owner_id, 'begin-target/existing-2.txt', 'E2', 'utf8', false, 2);

        // C.3: Paste at the beginning (insertOrdinal = 0, which means targetOrdinal = -1)
        console.log('\nC.3 - Paste 2 items at the beginning (insertOrdinal=0)');
        const insertOrdinalC = 0;
        const numItemsC = 2;
        
        await vfs.shiftOrdinalsDown(owner_id, 'begin-target', insertOrdinalC, numItemsC);
        console.log('C.3.1 - Shifted all target ordinals down by 2');

        const sourceItemsC = ['first.txt', 'second.txt'];
        for (let i = 0; i < sourceItemsC.length; i++) {
            const itemName = sourceItemsC[i];
            await vfs.rename(owner_id, `begin-source/${itemName}`, `begin-target/${itemName}`);
            
            const targetContents = await vfs.readdirEx(owner_id, 'begin-target', false);
            const movedNode = targetContents.find(n => n.name === itemName);
            if (!movedNode || !movedNode.uuid) {
                throw new Error(`C.3.2 failed! Could not find moved item ${itemName}`);
            }
            
            await vfs.setOrdinal(movedNode.uuid, insertOrdinalC + i);
            console.log(`C.3.2 - Moved ${itemName} and set ordinal to ${insertOrdinalC + i}`);
        }

        // C.4: Verify ordering - new items should be at the beginning
        console.log('\nC.4 - Verify new items are at the beginning');
        const targetContentsC = await vfs.readdirEx(owner_id, 'begin-target', false);
        targetContentsC.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

        const expectedOrderingC = [
            { name: 'first.txt', ordinal: 0 },
            { name: 'second.txt', ordinal: 1 },
            { name: 'existing-0.txt', ordinal: 2 }, // Shifted from 0 to 2
            { name: 'existing-1.txt', ordinal: 3 }, // Shifted from 1 to 3
            { name: 'existing-2.txt', ordinal: 4 }  // Shifted from 2 to 4
        ];

        console.log('C.4 - Actual ordering:');
        for (const file of targetContentsC) {
            console.log(`  ${file.name}: ordinal=${file.ordinal}`);
        }

        for (const expected of expectedOrderingC) {
            const file = targetContentsC.find(f => f.name === expected.name);
            if (!file) {
                throw new Error(`C.4 failed! File ${expected.name} not found`);
            }
            if (file.ordinal !== expected.ordinal) {
                throw new Error(`C.4 failed! File ${expected.name} should have ordinal=${expected.ordinal}, got ${file.ordinal}`);
            }
        }
        console.log('C.4 - ✅ Items correctly pasted at the beginning');

        // =====================================================
        // SECTION D: Paste into an empty target folder
        // =====================================================
        console.log('\n--- Section D: Paste into empty folder ---');

        // Create source items
        console.log('\nD.1 - Create source items for empty-folder-paste');
        await vfs.mkdirEx(owner_id, 'empty-source', { recursive: true }, false, 6);
        await vfs.writeFileEx(owner_id, 'empty-source/alpha.txt', 'Alpha', 'utf8', false, 0);
        await vfs.writeFileEx(owner_id, 'empty-source/beta.txt', 'Beta', 'utf8', false, 1);
        await vfs.writeFileEx(owner_id, 'empty-source/gamma.txt', 'Gamma', 'utf8', false, 2);

        // Create empty target folder
        console.log('\nD.2 - Create empty target folder');
        await vfs.mkdirEx(owner_id, 'empty-target', { recursive: true }, false, 7);

        // Verify target is empty
        const emptyCheck = await vfs.readdirEx(owner_id, 'empty-target', false);
        if (emptyCheck.length !== 0) {
            throw new Error('D.2 failed! empty-target should be empty');
        }
        console.log('D.2 - ✅ Verified target folder is empty');

        // D.3: Paste into empty folder (no shift needed since it's empty)
        console.log('\nD.3 - Paste 3 items into empty folder');
        const insertOrdinalD = 0;
        
        // Shift would be no-op on empty folder but should not error
        await vfs.shiftOrdinalsDown(owner_id, 'empty-target', insertOrdinalD, 3);
        console.log('D.3.1 - Shift on empty folder completed (should be no-op)');

        const sourceItemsD = ['alpha.txt', 'beta.txt', 'gamma.txt'];
        for (let i = 0; i < sourceItemsD.length; i++) {
            const itemName = sourceItemsD[i];
            await vfs.rename(owner_id, `empty-source/${itemName}`, `empty-target/${itemName}`);
            
            const targetContents = await vfs.readdirEx(owner_id, 'empty-target', false);
            const movedNode = targetContents.find(n => n.name === itemName);
            if (!movedNode || !movedNode.uuid) {
                throw new Error(`D.3.2 failed! Could not find moved item ${itemName}`);
            }
            
            await vfs.setOrdinal(movedNode.uuid, insertOrdinalD + i);
            console.log(`D.3.2 - Moved ${itemName} and set ordinal to ${insertOrdinalD + i}`);
        }

        // D.4: Verify final state
        console.log('\nD.4 - Verify items in previously empty folder');
        const targetContentsD = await vfs.readdirEx(owner_id, 'empty-target', false);
        targetContentsD.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

        if (targetContentsD.length !== 3) {
            throw new Error(`D.4 failed! Should have 3 items, found ${targetContentsD.length}`);
        }

        const expectedOrderingD = [
            { name: 'alpha.txt', ordinal: 0 },
            { name: 'beta.txt', ordinal: 1 },
            { name: 'gamma.txt', ordinal: 2 }
        ];

        for (const expected of expectedOrderingD) {
            const file = targetContentsD.find(f => f.name === expected.name);
            if (!file) {
                throw new Error(`D.4 failed! File ${expected.name} not found`);
            }
            if (file.ordinal !== expected.ordinal) {
                throw new Error(`D.4 failed! File ${expected.name} should have ordinal=${expected.ordinal}, got ${file.ordinal}`);
            }
        }
        console.log('D.4 - ✅ Items correctly pasted into empty folder');

        // =====================================================
        // SECTION E: Verify source folders are empty after all moves
        // =====================================================
        console.log('\n--- Section E: Verify source folders are empty ---');
        
        const sourceFolders = ['multi-source', 'begin-source', 'empty-source'];
        for (const folder of sourceFolders) {
            const contents = await vfs.readdirEx(owner_id, folder, false);
            if (contents.length !== 0) {
                throw new Error(`E failed! ${folder} should be empty after move, found ${contents.length} items`);
            }
        }
        console.log('E - ✅ All source folders are empty after moves');

        console.log('\n=== ✅ Cross-Folder Paste Test 2 PASSED ===');
        console.log('Successfully tested:');
        console.log('  - Moving multiple items at once with proper ordinal assignment');
        console.log('  - Moving folders with nested children (paths updated correctly)');
        console.log('  - Pasting at the beginning of a folder (insertOrdinal=0)');
        console.log('  - Pasting into an empty folder');
        console.log('  - No duplicate ordinals and proper consecutive ordering\n');

    } catch (error) {
        console.error('\n=== ❌ Cross-Folder Paste Test 2 FAILED ===');
        console.error('Error:', error);
        throw error;
    }
}
