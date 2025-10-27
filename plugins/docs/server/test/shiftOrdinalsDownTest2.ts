import vfs from '../VFS.js';

/**
 * Test case that replicates a real-world scenario:
 * 1. Create file "a" with ordinal 0
 * 2. Create file "b" with ordinal 1 (below "a")
 * 3. Insert a new file between "a" and "b" by shifting ordinals
 * 
 * This verifies that ordinal shifting works correctly when inserting files
 * between existing files in the directory structure.
 */
export async function shiftOrdinalsDownTest2(owner_id: number): Promise<void> {
    const testDir = `test_shift_ordinals_${Date.now()}`;
    
    try {
        console.log('=== VFS ShiftOrdinalsDown Real-World Test Starting ===');
        console.log(`Test directory: ${testDir}`);

        // Setup: Create a test directory
        console.log('\n--- Setup: Creating test directory ---');
        await vfs.mkdirEx(owner_id, testDir, { recursive: false }, false, 0);
        console.log(`✅ Created test directory: ${testDir}`);

        // Step 1: Create file "a" with ordinal 0
        console.log('\n--- Step 1: Creating file "a" with ordinal 0 ---');
        const fileAPath = `${testDir}/0000_a.txt`;
        await vfs.writeFileEx(owner_id, fileAPath, 'Content of file A', 'utf8', false, 0);
        console.log(`✅ Created file: ${fileAPath}`);

        // Verify file "a" exists with correct ordinal
        const nodeA = await vfs.getNodeByName(fileAPath);
        if (!nodeA) {
            throw new Error('File "a" was not created successfully');
        }
        if (nodeA.ordinal !== 0) {
            throw new Error(`File "a" has wrong ordinal: ${nodeA.ordinal}, expected 0`);
        }
        console.log(`✅ Verified file "a" has ordinal: ${nodeA.ordinal}`);

        // Step 2: Create file "b" with ordinal 1 (below "a")
        console.log('\n--- Step 2: Creating file "b" with ordinal 1 ---');
        const fileBPath = `${testDir}/0001_b.txt`;
        await vfs.writeFileEx(owner_id, fileBPath, 'Content of file B', 'utf8', false, 1);
        console.log(`✅ Created file: ${fileBPath}`);

        // Verify file "b" exists with correct ordinal
        const nodeB = await vfs.getNodeByName(fileBPath);
        if (!nodeB) {
            throw new Error('File "b" was not created successfully');
        }
        if (nodeB.ordinal !== 1) {
            throw new Error(`File "b" has wrong ordinal: ${nodeB.ordinal}, expected 1`);
        }
        console.log(`✅ Verified file "b" has ordinal: ${nodeB.ordinal}`);

        // List directory before shift
        console.log('\n--- Directory contents before shift ---');
        const beforeShift = await vfs.readdirEx(owner_id, testDir, false);
        beforeShift.forEach(node => {
            console.log(`  - ${node.name}, ordinal: ${node.ordinal}`);
        });

        // Step 3: Shift ordinals to make room for a new file between "a" and "b"
        console.log('\n--- Step 3: Shifting ordinals to insert between "a" and "b" ---');
        console.log('Calling shiftOrdinalsDown with insertOrdinal=1, slotsToAdd=1');
        
        const shiftResult = await vfs.shiftOrdinalsDown(owner_id, testDir, 1, 1);
        console.log(`✅ Shift completed, ${shiftResult.size} files affected`);
        
        if (shiftResult.size > 0) {
            console.log('Files that were shifted:');
            for (const [oldPath, newPath] of shiftResult) {
                console.log(`  - ${oldPath} -> ${newPath}`);
            }
        }

        // List directory after shift
        console.log('\n--- Directory contents after shift ---');
        const afterShift = await vfs.readdirEx(owner_id, testDir, false);
        afterShift.forEach(node => {
            console.log(`  - ${node.name}, ordinal: ${node.ordinal}`);
        });

        // Verify ordinals after shift
        console.log('\n--- Verifying ordinals after shift ---');
        const nodeAAfter = await vfs.getNodeByName(fileAPath);
        const nodeBAfter = await vfs.getNodeByName(fileBPath);

        if (!nodeAAfter) {
            throw new Error('File "a" not found after shift');
        }
        if (!nodeBAfter) {
            throw new Error('File "b" not found after shift');
        }

        console.log(`File "a" ordinal: ${nodeAAfter.ordinal} (expected: 0 - should not change)`);
        console.log(`File "b" ordinal: ${nodeBAfter.ordinal} (expected: 2 - shifted from 1)`);

        if (nodeAAfter.ordinal !== 0) {
            throw new Error(`File "a" ordinal changed unexpectedly: ${nodeAAfter.ordinal}, expected 0`);
        }
        if (nodeBAfter.ordinal !== 2) {
            throw new Error(`File "b" ordinal not shifted correctly: ${nodeBAfter.ordinal}, expected 2`);
        }

        console.log('✅ All ordinals verified correctly');

        // Step 4: Now insert a new file "c" at ordinal 1 (between "a" and "b")
        console.log('\n--- Step 4: Inserting new file "c" at ordinal 1 ---');
        const fileCPath = `${testDir}/0001_c.txt`;
        await vfs.writeFileEx(owner_id, fileCPath, 'Content of file C', 'utf8', false, 1);
        console.log(`✅ Created file: ${fileCPath}`);

        // Verify file "c" exists with correct ordinal
        const nodeC = await vfs.getNodeByName(fileCPath);
        if (!nodeC) {
            throw new Error('File "c" was not created successfully');
        }
        if (nodeC.ordinal !== 1) {
            throw new Error(`File "c" has wrong ordinal: ${nodeC.ordinal}, expected 1`);
        }
        console.log(`✅ Verified file "c" has ordinal: ${nodeC.ordinal}`);

        // Final directory listing
        console.log('\n--- Final directory contents ---');
        const finalContents = await vfs.readdirEx(owner_id, testDir, false);
        finalContents.forEach(node => {
            console.log(`  - ${node.name}, ordinal: ${node.ordinal}`);
        });

        // Verify final state: should have 3 files with ordinals 0, 1, 2
        if (finalContents.length !== 3) {
            throw new Error(`Expected 3 files in directory, found ${finalContents.length}`);
        }

        const ordinals = finalContents.map(n => n.ordinal).sort((a, b) => (a || 0) - (b || 0));
        if (ordinals[0] !== 0 || ordinals[1] !== 1 || ordinals[2] !== 2) {
            throw new Error(`Final ordinals incorrect: ${JSON.stringify(ordinals)}, expected [0, 1, 2]`);
        }

        console.log('✅ Final state verified: files a, c, b with ordinals 0, 1, 2');

        // Cleanup
        console.log('\n--- Cleanup: Removing test directory ---');
        await vfs.rm(owner_id, testDir, { recursive: true });
        console.log(`✅ Removed test directory: ${testDir}`);

        console.log('\n✅ All tests passed - Real-world ordinal shifting works correctly!');
        console.log('=== VFS ShiftOrdinalsDown Real-World Test Completed Successfully ===');
        
    } catch (error) {
        console.error('\n=== VFS ShiftOrdinalsDown Real-World Test Failed ===');
        console.error('Error during test:', error);
        
        // Attempt cleanup on error
        try {
            console.log('Attempting cleanup of test directory...');
            await vfs.rm(owner_id, testDir, { recursive: true, force: true });
            console.log('Cleanup completed');
        } catch (cleanupError) {
            console.error('Cleanup failed:', cleanupError);
        }
        
        throw error;
    }
}
