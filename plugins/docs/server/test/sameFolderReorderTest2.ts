import vfs from '../VFS.js';

/**
 * Additional edge case tests for same-folder reordering operations
 * 
 * This test extends sameFolderReorderTest with edge cases not covered in the original:
 * 1. Single item in folder (should be a no-op)
 * 2. Moving item to same position (should work without issues)
 * 3. Larger reordering with 5+ items (complex permutations)
 * 4. Reordering items with non-contiguous ordinals (gaps: 0, 2, 5, 10)
 * 5. Reordering within a subdirectory (not just root)
 * 6. Multiple consecutive reorder operations (chain of moves)
 * 7. Complete reversal of a list (worst case for ordinal conflicts)
 */
export async function sameFolderReorderTest2(owner_id: number): Promise<void> {
    try {
        console.log('=== Same-Folder Reorder Test 2 (Edge Cases) Starting ===');

        // =====================================================
        // TEST 1: Single item in folder (edge case - no reordering needed)
        // =====================================================
        console.log('\n--- Test 1: Single item in folder (no-op case) ---');
        
        await vfs.mkdirEx(owner_id, 'single-item-folder', { recursive: true }, false, 0);
        await vfs.writeFileEx(owner_id, 'single-item-folder/only-file.txt', 'Solo content', 'utf8', false, 0);
        
        let contents = await vfs.readdirEx(owner_id, 'single-item-folder', false);
        if (contents.length !== 1) {
            throw new Error('Test 1 failed! Should have exactly 1 item');
        }
        
        const singleItem = contents[0];
        if (!singleItem.uuid) {
            throw new Error('Test 1 failed! Item missing UUID');
        }
        
        // Attempt to "reorder" a single item (should succeed without issues)
        const tempOrdinal = -2147483648;
        await vfs.setOrdinal(singleItem.uuid, tempOrdinal);
        await vfs.setOrdinal(singleItem.uuid, 0);
        
        contents = await vfs.readdirEx(owner_id, 'single-item-folder', false);
        if (contents[0].ordinal !== 0) {
            throw new Error('Test 1 failed! Single item should remain at ordinal 0');
        }
        console.log('Test 1 - ✅ Single item reorder handled correctly');

        // =====================================================
        // TEST 2: Moving item to same position (identity operation)
        // =====================================================
        console.log('\n--- Test 2: Moving item to same position (identity) ---');
        
        await vfs.mkdirEx(owner_id, 'identity-test-folder', { recursive: true }, false, 1);
        await vfs.writeFileEx(owner_id, 'identity-test-folder/file-a.txt', 'A', 'utf8', false, 0);
        await vfs.writeFileEx(owner_id, 'identity-test-folder/file-b.txt', 'B', 'utf8', false, 1);
        await vfs.writeFileEx(owner_id, 'identity-test-folder/file-c.txt', 'C', 'utf8', false, 2);
        
        contents = await vfs.readdirEx(owner_id, 'identity-test-folder', false);
        const itemsToKeep = contents.filter(n => n.name.startsWith('file-'));
        itemsToKeep.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        // "Move" file-b to its same position (ordinal 1) using two-phase update
        const fileB = itemsToKeep.find(n => n.name === 'file-b.txt');
        if (!fileB?.uuid) throw new Error('Test 2 failed! file-b.txt not found');
        
        let temp = -2147483648;
        for (const item of itemsToKeep) {
            if (item.uuid) {
                await vfs.setOrdinal(item.uuid, temp++);
            }
        }
        
        // Set back to original positions
        for (let i = 0; i < itemsToKeep.length; i++) {
            const item = itemsToKeep[i];
            if (item.uuid) {
                await vfs.setOrdinal(item.uuid, i);
            }
        }
        
        contents = await vfs.readdirEx(owner_id, 'identity-test-folder', false);
        const verifyItems = contents.filter(n => n.name.startsWith('file-'));
        verifyItems.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        if (verifyItems[0].name !== 'file-a.txt' || verifyItems[0].ordinal !== 0) {
            throw new Error('Test 2 failed! file-a.txt should be at ordinal 0');
        }
        if (verifyItems[1].name !== 'file-b.txt' || verifyItems[1].ordinal !== 1) {
            throw new Error('Test 2 failed! file-b.txt should be at ordinal 1');
        }
        if (verifyItems[2].name !== 'file-c.txt' || verifyItems[2].ordinal !== 2) {
            throw new Error('Test 2 failed! file-c.txt should be at ordinal 2');
        }
        console.log('Test 2 - ✅ Identity operation preserved ordering');

        // =====================================================
        // TEST 3: Large reordering (5 items - reverse first and last)
        // =====================================================
        console.log('\n--- Test 3: Large reordering (5 items) ---');
        
        await vfs.mkdirEx(owner_id, 'large-reorder-folder', { recursive: true }, false, 2);
        const largeItems = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
        for (let i = 0; i < largeItems.length; i++) {
            await vfs.writeFileEx(owner_id, `large-reorder-folder/${largeItems[i]}.txt`, largeItems[i], 'utf8', false, i);
        }
        
        contents = await vfs.readdirEx(owner_id, 'large-reorder-folder', false);
        let largeReorderItems = contents.filter(n => largeItems.some(li => n.name === `${li}.txt`));
        largeReorderItems.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        // New order: epsilon(0), beta(1), gamma(2), delta(3), alpha(4)
        // (swap first and last positions)
        const newLargeOrder = ['epsilon.txt', 'beta.txt', 'gamma.txt', 'delta.txt', 'alpha.txt'];
        
        // Phase 1: Temp ordinals
        temp = -2147483648;
        for (const item of largeReorderItems) {
            if (item.uuid) {
                await vfs.setOrdinal(item.uuid, temp++);
            }
        }
        
        // Phase 2: Final ordinals
        for (let i = 0; i < newLargeOrder.length; i++) {
            const item = largeReorderItems.find(n => n.name === newLargeOrder[i]);
            if (item?.uuid) {
                await vfs.setOrdinal(item.uuid, i);
            }
        }
        
        contents = await vfs.readdirEx(owner_id, 'large-reorder-folder', false);
        largeReorderItems = contents.filter(n => largeItems.some(li => n.name === `${li}.txt`));
        largeReorderItems.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        for (let i = 0; i < newLargeOrder.length; i++) {
            if (largeReorderItems[i].name !== newLargeOrder[i]) {
                throw new Error(`Test 3 failed! Expected ${newLargeOrder[i]} at position ${i}, got ${largeReorderItems[i].name}`);
            }
            if (largeReorderItems[i].ordinal !== i) {
                throw new Error(`Test 3 failed! ${largeReorderItems[i].name} should have ordinal ${i}, got ${largeReorderItems[i].ordinal}`);
            }
        }
        console.log('Test 3 - ✅ Large reordering (swap first/last) completed successfully');

        // =====================================================
        // TEST 4: Non-contiguous ordinals (gaps in ordinal sequence)
        // =====================================================
        console.log('\n--- Test 4: Non-contiguous ordinals (gaps: 0, 3, 7, 15) ---');
        
        await vfs.mkdirEx(owner_id, 'gap-ordinal-folder', { recursive: true }, false, 3);
        
        // Create items with gaps in ordinals
        await vfs.writeFileEx(owner_id, 'gap-ordinal-folder/item-0.txt', '0', 'utf8', false, 0);
        await vfs.writeFileEx(owner_id, 'gap-ordinal-folder/item-3.txt', '3', 'utf8', false, 3);
        await vfs.writeFileEx(owner_id, 'gap-ordinal-folder/item-7.txt', '7', 'utf8', false, 7);
        await vfs.writeFileEx(owner_id, 'gap-ordinal-folder/item-15.txt', '15', 'utf8', false, 15);
        
        contents = await vfs.readdirEx(owner_id, 'gap-ordinal-folder', false);
        let gapItems = contents.filter(n => n.name.startsWith('item-'));
        gapItems.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        if (gapItems.length !== 4) {
            throw new Error('Test 4 failed! Should have 4 items');
        }
        
        // Reorder: [item-0, item-3, item-7, item-15] -> [item-15, item-7, item-3, item-0]
        // (complete reversal with non-contiguous ordinals)
        const gapReorderNames = ['item-15.txt', 'item-7.txt', 'item-3.txt', 'item-0.txt'];
        
        // Phase 1: Temp ordinals
        temp = -2147483648;
        for (const item of gapItems) {
            if (item.uuid) {
                await vfs.setOrdinal(item.uuid, temp++);
            }
        }
        
        // Phase 2: Final ordinals (now make them contiguous: 0, 1, 2, 3)
        for (let i = 0; i < gapReorderNames.length; i++) {
            const item = gapItems.find(n => n.name === gapReorderNames[i]);
            if (item?.uuid) {
                await vfs.setOrdinal(item.uuid, i);
            }
        }
        
        contents = await vfs.readdirEx(owner_id, 'gap-ordinal-folder', false);
        gapItems = contents.filter(n => n.name.startsWith('item-'));
        gapItems.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        for (let i = 0; i < gapReorderNames.length; i++) {
            if (gapItems[i].name !== gapReorderNames[i]) {
                throw new Error(`Test 4 failed! Expected ${gapReorderNames[i]} at position ${i}, got ${gapItems[i].name}`);
            }
        }
        
        // Verify ordinals are now contiguous
        for (let i = 0; i < gapItems.length; i++) {
            if (gapItems[i].ordinal !== i) {
                throw new Error(`Test 4 failed! ${gapItems[i].name} should have ordinal ${i}, got ${gapItems[i].ordinal}`);
            }
        }
        console.log('Test 4 - ✅ Non-contiguous ordinals reordered and normalized');

        // =====================================================
        // TEST 5: Reordering within a subdirectory
        // =====================================================
        console.log('\n--- Test 5: Reordering within subdirectory ---');
        
        await vfs.mkdirEx(owner_id, 'parent-dir', { recursive: true }, false, 4);
        await vfs.mkdirEx(owner_id, 'parent-dir/child-dir', { recursive: true }, false, 0);
        await vfs.writeFileEx(owner_id, 'parent-dir/child-dir/sub-a.txt', 'A', 'utf8', false, 0);
        await vfs.writeFileEx(owner_id, 'parent-dir/child-dir/sub-b.txt', 'B', 'utf8', false, 1);
        await vfs.writeFileEx(owner_id, 'parent-dir/child-dir/sub-c.txt', 'C', 'utf8', false, 2);
        
        contents = await vfs.readdirEx(owner_id, 'parent-dir/child-dir', false);
        let subItems = contents.filter(n => n.name.startsWith('sub-'));
        subItems.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        // Reorder within subdirectory: [a, b, c] -> [c, a, b]
        const subReorderNames = ['sub-c.txt', 'sub-a.txt', 'sub-b.txt'];
        
        temp = -2147483648;
        for (const item of subItems) {
            if (item.uuid) await vfs.setOrdinal(item.uuid, temp++);
        }
        
        for (let i = 0; i < subReorderNames.length; i++) {
            const item = subItems.find(n => n.name === subReorderNames[i]);
            if (item?.uuid) await vfs.setOrdinal(item.uuid, i);
        }
        
        contents = await vfs.readdirEx(owner_id, 'parent-dir/child-dir', false);
        subItems = contents.filter(n => n.name.startsWith('sub-'));
        subItems.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        for (let i = 0; i < subReorderNames.length; i++) {
            if (subItems[i].name !== subReorderNames[i] || subItems[i].ordinal !== i) {
                throw new Error(`Test 5 failed! Expected ${subReorderNames[i]} at ordinal ${i}, got ${subItems[i].name} at ${subItems[i].ordinal}`);
            }
        }
        console.log('Test 5 - ✅ Subdirectory reordering completed successfully');

        // =====================================================
        // TEST 6: Multiple consecutive reorder operations
        // =====================================================
        console.log('\n--- Test 6: Multiple consecutive reorder operations ---');
        
        await vfs.mkdirEx(owner_id, 'chain-reorder-folder', { recursive: true }, false, 5);
        await vfs.writeFileEx(owner_id, 'chain-reorder-folder/one.txt', '1', 'utf8', false, 0);
        await vfs.writeFileEx(owner_id, 'chain-reorder-folder/two.txt', '2', 'utf8', false, 1);
        await vfs.writeFileEx(owner_id, 'chain-reorder-folder/three.txt', '3', 'utf8', false, 2);
        await vfs.writeFileEx(owner_id, 'chain-reorder-folder/four.txt', '4', 'utf8', false, 3);
        
        // Perform 3 consecutive reorder operations
        const reorderSequence = [
            ['two.txt', 'one.txt', 'three.txt', 'four.txt'],   // Move two to front
            ['two.txt', 'one.txt', 'four.txt', 'three.txt'],   // Swap three and four
            ['four.txt', 'two.txt', 'one.txt', 'three.txt']    // Move four to front
        ];
        
        for (let round = 0; round < reorderSequence.length; round++) {
            const newOrder = reorderSequence[round];
            console.log(`Test 6.${round + 1} - Reordering to: [${newOrder.join(', ')}]`);
            
            contents = await vfs.readdirEx(owner_id, 'chain-reorder-folder', false);
            let chainItems = contents.filter(n => n.name.endsWith('.txt') && ['one', 'two', 'three', 'four'].some(nm => n.name.startsWith(nm)));
            
            // Phase 1
            temp = -2147483648;
            for (const item of chainItems) {
                if (item.uuid) await vfs.setOrdinal(item.uuid, temp++);
            }
            
            // Phase 2
            for (let i = 0; i < newOrder.length; i++) {
                const item = chainItems.find(n => n.name === newOrder[i]);
                if (item?.uuid) await vfs.setOrdinal(item.uuid, i);
            }
            
            // Verify
            contents = await vfs.readdirEx(owner_id, 'chain-reorder-folder', false);
            chainItems = contents.filter(n => n.name.endsWith('.txt') && ['one', 'two', 'three', 'four'].some(nm => n.name.startsWith(nm)));
            chainItems.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
            
            for (let i = 0; i < newOrder.length; i++) {
                if (chainItems[i].name !== newOrder[i]) {
                    throw new Error(`Test 6.${round + 1} failed! Expected ${newOrder[i]} at position ${i}, got ${chainItems[i].name}`);
                }
            }
        }
        console.log('Test 6 - ✅ Multiple consecutive reorder operations successful');

        // =====================================================
        // TEST 7: Complete reversal (worst case for conflicts)
        // =====================================================
        console.log('\n--- Test 7: Complete reversal (6 items - worst case) ---');
        
        await vfs.mkdirEx(owner_id, 'reversal-folder', { recursive: true }, false, 6);
        const reversalNames = ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt', 'f.txt'];
        
        for (let i = 0; i < reversalNames.length; i++) {
            await vfs.writeFileEx(owner_id, `reversal-folder/${reversalNames[i]}`, reversalNames[i], 'utf8', false, i);
        }
        
        contents = await vfs.readdirEx(owner_id, 'reversal-folder', false);
        let reversalItems = contents.filter(n => reversalNames.includes(n.name));
        reversalItems.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        // Complete reversal: [a,b,c,d,e,f] -> [f,e,d,c,b,a]
        const reversedOrder = [...reversalNames].reverse();
        
        // Phase 1
        temp = -2147483648;
        for (const item of reversalItems) {
            if (item.uuid) await vfs.setOrdinal(item.uuid, temp++);
        }
        
        // Phase 2
        for (let i = 0; i < reversedOrder.length; i++) {
            const item = reversalItems.find(n => n.name === reversedOrder[i]);
            if (item?.uuid) await vfs.setOrdinal(item.uuid, i);
        }
        
        contents = await vfs.readdirEx(owner_id, 'reversal-folder', false);
        reversalItems = contents.filter(n => reversalNames.includes(n.name));
        reversalItems.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        for (let i = 0; i < reversedOrder.length; i++) {
            if (reversalItems[i].name !== reversedOrder[i] || reversalItems[i].ordinal !== i) {
                throw new Error(`Test 7 failed! Expected ${reversedOrder[i]} at ordinal ${i}, got ${reversalItems[i].name} at ${reversalItems[i].ordinal}`);
            }
        }
        
        // Verify no duplicate ordinals
        const finalOrdinals = reversalItems.map(item => item.ordinal);
        const uniqueOrdinals = new Set(finalOrdinals);
        if (finalOrdinals.length !== uniqueOrdinals.size) {
            throw new Error('Test 7 failed! Found duplicate ordinals after reversal');
        }
        console.log('Test 7 - ✅ Complete reversal completed with no ordinal conflicts');

        console.log('\n=== ✅ Same-Folder Reorder Test 2 (Edge Cases) PASSED ===');
        console.log('All edge cases handled correctly with two-phase ordinal update strategy.\n');

    } catch (error) {
        console.error('\n=== ❌ Same-Folder Reorder Test 2 (Edge Cases) FAILED ===');
        console.error('Error:', error);
        throw error;
    }
}
