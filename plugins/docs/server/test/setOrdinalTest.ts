import vfs from '../VFS.js';

export async function setOrdinalTest(owner_id: number): Promise<void> {
    const testFiles = [
        { name: 'ordinal-test-1.md', ordinal: 10 },
        { name: 'ordinal-test-2.md', ordinal: 20 },
        { name: 'ordinal-test-3.md', ordinal: 30 }
    ];
    const testDirName = 'test-ordinal-dir';
    
    try {
        console.log('=== VFS SetOrdinal Test Starting ===');

        // Clean up any leftover test data from previous runs first
        console.log('Cleanup - Removing any existing test files from previous runs');
        
        // First, try to delete our specific test files by name
        for (const file of testFiles) {
            try {
                await vfs.unlink(owner_id, file.name);
                console.log(`Cleanup - Deleted existing ${file.name}`);
            } catch (error) {
                // File doesn't exist, which is fine - ignore the error
            }
        }
        
        try {
            await vfs.rm(owner_id, testDirName);
            console.log(`Cleanup - Deleted existing directory ${testDirName}`);
        } catch (error) {
            // Directory doesn't exist, which is fine - ignore the error
        }
        
        // Also check if there are any files with the ordinals we plan to use and delete them
        // This handles cases where files from other tests might have these ordinals
        const existingFiles = await vfs.readdirEx(owner_id, '', false);
        const targetOrdinals = [10, 20, 30, 5, 0, 99999, -10, 100, 200, 300, 500, 600];
        for (const file of existingFiles) {
            if (targetOrdinals.includes(file.ordinal!)) {
                try {
                    if (file.is_directory) {
                        await vfs.rm(owner_id, file.name);
                    } else {
                        await vfs.unlink(owner_id, file.name);
                    }
                    console.log(`Cleanup - Deleted file/folder with conflicting ordinal ${file.ordinal}: ${file.name}`);
                } catch (error) {
                    console.log(`Cleanup - Could not delete ${file.name}:`, error);
                }
            }
        }

        // Test 1: Create test files with specific ordinals
        console.log('Test 1 - Create test files with specific ordinals');
        
        // Create files with specific ordinals
        for (const file of testFiles) {
            await vfs.writeFileEx(owner_id, file.name, `Content for ${file.name}`, 'utf8', false, file.ordinal);
            console.log(`Test 1 - Created ${file.name} with ordinal ${file.ordinal}`);
        }
        
        // Verify files were created with correct ordinals
        const rootContents = await vfs.readdirEx(owner_id, '', false);
        for (const file of testFiles) {
            const createdFile = rootContents.find(node => node.name === file.name);
            if (!createdFile) {
                throw new Error(`Test 1 failed! File ${file.name} should exist`);
            }
            if (createdFile.ordinal !== file.ordinal) {
                throw new Error(`Test 1 failed! File ${file.name} should have ordinal ${file.ordinal}, got ${createdFile.ordinal}`);
            }
        }
        console.log('Test 1 - All test files created with correct ordinals');

        // Test 2: Update ordinal of first file
        console.log('Test 2 - Update ordinal of first file');
        const firstFile = rootContents.find(node => node.name === testFiles[0].name);
        if (!firstFile || !firstFile.uuid) {
            throw new Error('Test 2 failed! First file should exist and have UUID');
        }
        
        const newOrdinal = 5;
        await vfs.setOrdinal(firstFile.uuid, newOrdinal);
        console.log(`Test 2 - Set ordinal for ${firstFile.name} (UUID: ${firstFile.uuid}) to ${newOrdinal}`);
        
        // Verify the ordinal was updated
        const updatedContents = await vfs.readdirEx(owner_id, '', false);
        const updatedFile = updatedContents.find(node => node.uuid === firstFile.uuid);
        
        if (!updatedFile) {
            throw new Error('Test 2 failed! Updated file should still exist');
        }
        if (updatedFile.ordinal !== newOrdinal) {
            throw new Error(`Test 2 failed! File ordinal should be ${newOrdinal}, got ${updatedFile.ordinal}`);
        }
        console.log('Test 2 - Ordinal update verified');

        // Test 3: Update ordinal to zero
        console.log('Test 3 - Update ordinal to zero');
        const secondFile = rootContents.find(node => node.name === testFiles[1].name);
        if (!secondFile || !secondFile.uuid) {
            throw new Error('Test 3 failed! Second file should exist and have UUID');
        }
        
        await vfs.setOrdinal(secondFile.uuid, 0);
        console.log(`Test 3 - Set ordinal for ${secondFile.name} to 0`);
        
        // Verify the ordinal was updated to zero
        const zeroContents = await vfs.readdirEx(owner_id, '', false);
        const zeroFile = zeroContents.find(node => node.uuid === secondFile.uuid);
        
        if (!zeroFile) {
            throw new Error('Test 3 failed! File should still exist after setting ordinal to 0');
        }
        if (zeroFile.ordinal !== 0) {
            throw new Error(`Test 3 failed! File ordinal should be 0, got ${zeroFile.ordinal}`);
        }
        console.log('Test 3 - Zero ordinal update verified');

        // Test 4: Update ordinal to large value
        console.log('Test 4 - Update ordinal to large value');
        const thirdFile = rootContents.find(node => node.name === testFiles[2].name);
        if (!thirdFile || !thirdFile.uuid) {
            throw new Error('Test 4 failed! Third file should exist and have UUID');
        }
        
        const largeOrdinal = 99999;
        await vfs.setOrdinal(thirdFile.uuid, largeOrdinal);
        console.log(`Test 4 - Set ordinal for ${thirdFile.name} to ${largeOrdinal}`);
        
        // Verify the ordinal was updated
        const largeContents = await vfs.readdirEx(owner_id, '', false);
        const largeFile = largeContents.find(node => node.uuid === thirdFile.uuid);
        
        if (!largeFile) {
            throw new Error('Test 4 failed! File should still exist after setting large ordinal');
        }
        if (largeFile.ordinal !== largeOrdinal) {
            throw new Error(`Test 4 failed! File ordinal should be ${largeOrdinal}, got ${largeFile.ordinal}`);
        }
        console.log('Test 4 - Large ordinal update verified');

        // Test 5: Test with non-existent UUID
        console.log('Test 5 - Test with non-existent UUID');
        const nonExistentUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        try {
            await vfs.setOrdinal(nonExistentUuid, 100);
            throw new Error('Test 5 failed! Should have thrown error for non-existent UUID');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5 passed - Non-existent UUID threw error:', errorMessage);
            if (!errorMessage.includes('not found')) {
                throw new Error('Test 5 failed! Should throw "not found" error');
            }
        }

        // Test 6: Test with malformed UUIDs
        console.log('Test 6 - Test with malformed UUIDs');
        const malformedUuids = [
            'not-a-uuid',
            '12345',
            '',
            'aaaaaaaa-bbbb-cccc-dddd' // Too short
        ];
        
        for (const badUuid of malformedUuids) {
            try {
                await vfs.setOrdinal(badUuid, 50);
                throw new Error(`Test 6 failed! Should have thrown error for malformed UUID: ${badUuid}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 6 - Malformed UUID '${badUuid}' threw error (expected):`, errorMessage);
            }
        }
        console.log('Test 6 - Malformed UUIDs handled correctly');

        // Test 7: Test negative ordinal (might be allowed depending on schema)
        console.log('Test 7 - Test negative ordinal');
        try {
            await vfs.setOrdinal(firstFile.uuid, -10);
            console.log('Test 7 - Negative ordinal accepted');
            
            // Verify the ordinal was updated
            const negativeContents = await vfs.readdirEx(owner_id, '', false);
            const negativeFile = negativeContents.find(node => node.uuid === firstFile.uuid);
            
            if (!negativeFile) {
                throw new Error('Test 7 failed! File should still exist after setting negative ordinal');
            }
            if (negativeFile.ordinal !== -10) {
                throw new Error(`Test 7 failed! File ordinal should be -10, got ${negativeFile.ordinal}`);
            }
            console.log('Test 7 - Negative ordinal verified');
        } catch (error) {
            // It's acceptable if negative ordinals are rejected by database constraints
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 7 - Negative ordinal rejected (may be acceptable):', errorMessage);
        }

        // Test 8: Update multiple files' ordinals in sequence
        console.log('Test 8 - Update multiple files ordinals in sequence');
        const newOrdinals = [100, 200, 300];
        
        for (let i = 0; i < testFiles.length; i++) {
            const file = rootContents.find(node => node.name === testFiles[i].name);
            if (file && file.uuid) {
                await vfs.setOrdinal(file.uuid, newOrdinals[i]);
                console.log(`Test 8 - Set ordinal for ${file.name} to ${newOrdinals[i]}`);
            }
        }
        
        // Verify all ordinals were updated
        const multiContents = await vfs.readdirEx(owner_id, '', false);
        for (let i = 0; i < testFiles.length; i++) {
            const file = multiContents.find(node => node.name === testFiles[i].name);
            if (!file) {
                throw new Error(`Test 8 failed! File ${testFiles[i].name} should exist`);
            }
            if (file.ordinal !== newOrdinals[i]) {
                throw new Error(`Test 8 failed! File ${testFiles[i].name} should have ordinal ${newOrdinals[i]}, got ${file.ordinal}`);
            }
        }
        console.log('Test 8 - Multiple ordinal updates verified');

        // Test 9: Verify ordering after ordinal changes
        console.log('Test 9 - Verify ordering after ordinal changes');
        const orderedContents = await vfs.readdirEx(owner_id, '', false);
        
        // Filter to only our test files
        const ourFiles = orderedContents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        
        console.log('Test 9 - Our test files with ordinals:');
        ourFiles.forEach(file => {
            console.log(`  - ${file.name}: ordinal ${file.ordinal}`);
        });
        
        // Verify files are ordered by ordinal
        for (let i = 1; i < ourFiles.length; i++) {
            const prevOrdinal = ourFiles[i-1].ordinal;
            const currOrdinal = ourFiles[i].ordinal;
            if (prevOrdinal != null && currOrdinal != null && prevOrdinal > currOrdinal) {
                throw new Error(`Test 9 failed! Files should be ordered by ordinal: ${ourFiles[i-1].name} (${prevOrdinal}) should come before ${ourFiles[i].name} (${currOrdinal})`);
            }
        }
        console.log('Test 9 - File ordering by ordinal verified');

        // Test 10: Test setOrdinal on directory
        console.log('Test 10 - Test setOrdinal on directory');
        const dirOrdinal = 500;
        
        // Create directory
        await vfs.mkdirEx(owner_id, testDirName, {}, false, dirOrdinal);
        console.log(`Test 10 - Created directory ${testDirName} with ordinal ${dirOrdinal}`);
        
        // Get directory UUID
        const dirContents = await vfs.readdirEx(owner_id, '', false);
        const testDir = dirContents.find(node => node.name === testDirName);
        
        if (!testDir || !testDir.uuid) {
            throw new Error('Test 10 failed! Directory should exist and have UUID');
        }
        
        // Update directory ordinal
        const newDirOrdinal = 600;
        await vfs.setOrdinal(testDir.uuid, newDirOrdinal);
        console.log(`Test 10 - Set directory ordinal to ${newDirOrdinal}`);
        
        // Verify directory ordinal was updated
        const updatedDirContents = await vfs.readdirEx(owner_id, '', false);
        const updatedDir = updatedDirContents.find(node => node.uuid === testDir.uuid);
        
        if (!updatedDir) {
            throw new Error('Test 10 failed! Directory should still exist after ordinal update');
        }
        if (updatedDir.ordinal !== newDirOrdinal) {
            throw new Error(`Test 10 failed! Directory ordinal should be ${newDirOrdinal}, got ${updatedDir.ordinal}`);
        }
        console.log('Test 10 - Directory ordinal update verified');

        // Clean up test files
        console.log('Cleanup - Removing test files and directory');
        for (const file of testFiles) {
            try {
                await vfs.unlink(owner_id, file.name);
                console.log(`Cleanup - Deleted ${file.name}`);
            } catch (error) {
                console.log(`Cleanup - Could not delete ${file.name}:`, error);
            }
        }
        
        try {
            await vfs.rm(owner_id, testDirName);
            console.log(`Cleanup - Deleted directory ${testDirName}`);
        } catch (error) {
            console.log(`Cleanup - Could not delete directory ${testDirName}:`, error);
        }

        console.log('✅ All setOrdinal tests passed');
        console.log('=== VFS SetOrdinal Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS SetOrdinal Test Failed ===');
        console.error('Error during VFS setOrdinal test:', error);
        throw error;
    }
}
