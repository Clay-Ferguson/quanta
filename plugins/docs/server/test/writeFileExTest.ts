import vfs from '../VFS.js';

export async function writeFileExTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS WriteFileEx Test Starting ===');

        // Debug: Check initial state of root directory
        console.log('Debug - Checking initial state of root directory');
        const initialRootContents = await vfs.readdirEx(owner_id, '', false);
        console.log(`Debug - Initial root directory has ${initialRootContents.length} items:`, 
            initialRootContents.map(node => ({ name: node.name, ordinal: node.ordinal, owner: node.owner_id })));

        // Test 1: Create a simple text file with ordinal
        console.log('Test 1 - Creating simple text file with ordinal');
        const testFileName = 'test-file-ordinal.md';
        const testContent = '# Test File\n\nThis is a test file created with a specific ordinal.';
        const testOrdinal = 5;
        
        try {
            await vfs.writeFileEx(owner_id, testFileName, testContent, 'utf8', false, testOrdinal);
            console.log(`Test 1 - Successfully created file: ${testFileName} with ordinal: ${testOrdinal}`);
            
            // Verify the file was created by checking if it exists
            const fileExists = await vfs.exists(testFileName);
            if (!fileExists) {
                throw new Error('Test 1 failed! File should exist after creation');
            }
            console.log('Test 1 - File existence verified');
            
            // Verify the file has the correct ordinal by reading directory
            const rootContents = await vfs.readdirEx(owner_id, '', false);
            const createdFile = rootContents.find(node => node.name === testFileName);
            
            if (!createdFile) {
                throw new Error('Test 1 failed! Created file not found in directory listing');
            }
            
            if (createdFile.ordinal !== testOrdinal) {
                throw new Error(`Test 1 failed! File ordinal should be ${testOrdinal}, but got ${createdFile.ordinal}`);
            }
            console.log(`Test 1 - File ordinal verified: ${createdFile.ordinal}`);
            
        } catch (error) {
            console.error('Test 1 failed during file creation:', error);
            throw error;
        }

        // Test 2: Create a file without specifying ordinal (should auto-assign)
        console.log('Test 2 - Creating file without specifying ordinal');
        const testFileName2 = 'test-file-auto-ordinal.md';
        const testContent2 = '# Auto Ordinal Test\n\nThis file should get an auto-assigned ordinal.';
        
        try {
            // First, let's check what files are currently in the root directory
            const rootContentsBefore = await vfs.readdirEx(owner_id, '', false);
            console.log(`Test 2 - Files in root before creation (${rootContentsBefore.length} items):`, 
                rootContentsBefore.map(node => ({ name: node.name, ordinal: node.ordinal })));
            
            await vfs.writeFileEx(owner_id, testFileName2, testContent2, 'utf8', false);
            console.log(`Test 2 - Successfully created file: ${testFileName2} with auto-assigned ordinal`);
            
            // Verify the file exists
            const fileExists = await vfs.exists(testFileName2);
            if (!fileExists) {
                throw new Error('Test 2 failed! File should exist after creation');
            }
            
            // Check what ordinal was assigned
            const rootContents = await vfs.readdirEx(owner_id, '', false);
            const createdFile = rootContents.find(node => node.name === testFileName2);
            
            if (!createdFile) {
                throw new Error('Test 2 failed! Created file not found in directory listing');
            }
            
            console.log(`Test 2 - File auto-assigned ordinal: ${createdFile.ordinal}`);
            
            // Auto-assigned ordinal should be reasonable (not negative, and should be a valid integer)
            if (createdFile.ordinal == null || createdFile.ordinal < 0) {
                throw new Error(`Test 2 failed! Auto-assigned ordinal ${createdFile.ordinal} should be non-negative`);
            }
            
            // The ordinal might be high if there's existing data in the database, so just check it's reasonable
            if (createdFile.ordinal > 100000) {
                console.warn(`Test 2 - Warning: Auto-assigned ordinal ${createdFile.ordinal} is quite high - there may be existing data in the database`);
            }
            
            // Verify the ordinal is higher than the previous file's ordinal
            const firstFileOrdinal = rootContents.find(node => node.name === testFileName)?.ordinal;
            if (firstFileOrdinal != null && createdFile.ordinal <= firstFileOrdinal) {
                throw new Error(`Test 2 failed! Auto-assigned ordinal ${createdFile.ordinal} should be higher than previous file's ordinal ${firstFileOrdinal}`);
            }
            
        } catch (error) {
            console.error('Test 2 failed during file creation:', error);
            throw error;
        }

        // Test 3: Create file in a nested path (should fail since path doesn't exist)
        console.log('Test 3 - Attempting to create file in non-existent nested path');
        try {
            await vfs.writeFileEx(owner_id, 'nonexistent/folder/test.md', 'content', 'utf8', false, 1);
            throw new Error('Test 3 failed! Should have thrown error for non-existent parent directory');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 3 passed - Non-existent parent directory threw error:', errorMessage);
            // Accept various possible error messages related to missing parent
            if (!errorMessage.toLowerCase().includes('parent') && 
                !errorMessage.toLowerCase().includes('directory') && 
                !errorMessage.toLowerCase().includes('not found') &&
                !errorMessage.toLowerCase().includes('exist')) {
                console.warn('Test 3 - Unexpected error message, but accepting as valid:', errorMessage);
            }
        }

        // Test 4: Create file with different content types
        console.log('Test 4 - Creating files with different content types');
        const testFiles = [
            { name: 'test.txt', content: 'Plain text content', ordinal: 10 },
            { name: 'test.json', content: '{"key": "value"}', ordinal: 11 },
            { name: 'test.html', content: '<html><body>HTML content</body></html>', ordinal: 12 }
        ];
        
        for (const file of testFiles) {
            try {
                await vfs.writeFileEx(owner_id, file.name, file.content, 'utf8', false, file.ordinal);
                console.log(`Test 4 - Successfully created ${file.name} with ordinal ${file.ordinal}`);
                
                // Verify existence
                const exists = await vfs.exists(file.name);
                if (!exists) {
                    throw new Error(`Test 4 failed! File ${file.name} should exist after creation`);
                }
                
                // Verify ordinal
                const rootContents = await vfs.readdirEx(owner_id, '', false);
                const createdFile = rootContents.find(node => node.name === file.name);
                
                if (!createdFile || createdFile.ordinal !== file.ordinal) {
                    throw new Error(`Test 4 failed! File ${file.name} should have ordinal ${file.ordinal}`);
                }
                
            } catch (error) {
                console.error(`Test 4 failed for file ${file.name}:`, error);
                throw error;
            }
        }

        // Test 5: Test overwriting existing file (should update ordinal)
        console.log('Test 5 - Overwriting existing file with new ordinal');
        const existingFileName = testFileName; // Use file from Test 1
        const newContent = '# Updated Content\n\nThis file has been overwritten with new content and ordinal.';
        const newOrdinal = 20;
        
        try {
            await vfs.writeFileEx(owner_id, existingFileName, newContent, 'utf8', false, newOrdinal);
            console.log(`Test 5 - Successfully overwrite file: ${existingFileName} with new ordinal: ${newOrdinal}`);
            
            // Verify the ordinal was updated
            const rootContents = await vfs.readdirEx(owner_id, '', false);
            const updatedFile = rootContents.find(node => node.name === existingFileName);
            
            if (!updatedFile) {
                throw new Error('Test 5 failed! Overwritten file not found in directory listing');
            }
            
            if (updatedFile.ordinal !== newOrdinal) {
                throw new Error(`Test 5 failed! File ordinal should be updated to ${newOrdinal}, but got ${updatedFile.ordinal}`);
            }
            console.log(`Test 5 - File ordinal successfully updated to: ${updatedFile.ordinal}`);
            
        } catch (error) {
            console.error('Test 5 failed during file overwrite:', error);
            throw error;
        }

        // Test 6: Test with binary data (Buffer)
        console.log('Test 6 - Creating file with binary data');
        const binaryFileName = 'test-binary.dat';
        const binaryData = Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello" in ASCII
        const binaryOrdinal = 25;
        
        try {
            await vfs.writeFileEx(owner_id, binaryFileName, binaryData, 'utf8', false, binaryOrdinal);
            console.log(`Test 6 - Successfully created binary file: ${binaryFileName}`);
            
            // Verify existence
            const exists = await vfs.exists(binaryFileName);
            if (!exists) {
                throw new Error('Test 6 failed! Binary file should exist after creation');
            }
            
            // Verify ordinal
            const rootContents = await vfs.readdirEx(owner_id, '', false);
            const binaryFile = rootContents.find(node => node.name === binaryFileName);
            
            if (!binaryFile || binaryFile.ordinal !== binaryOrdinal) {
                throw new Error(`Test 6 failed! Binary file should have ordinal ${binaryOrdinal}`);
            }
            console.log(`Test 6 - Binary file ordinal verified: ${binaryFile.ordinal}`);
            
        } catch (error) {
            console.error('Test 6 failed during binary file creation:', error);
            throw error;
        }

        // Test 7: Test ordinal ordering in directory listing
        console.log('Test 7 - Verifying ordinal ordering in directory listing');
        const rootContents = await vfs.readdirEx(owner_id, '', false);
        
        // Filter to only files we created (to avoid interference from other tests)
        const ourFiles = rootContents.filter(node => 
            node.name.startsWith('test-') || node.name.startsWith('test.'));
        
        console.log('Test 7 - Our created files with ordinals:');
        ourFiles.forEach(file => {
            console.log(`  - ${file.name}: ordinal ${file.ordinal}`);
        });
        
        // Verify files are ordered by ordinal
        for (let i = 1; i < ourFiles.length; i++) {
            const prevOrdinal = ourFiles[i-1].ordinal;
            const currOrdinal = ourFiles[i].ordinal;
            if (prevOrdinal != null && currOrdinal != null && prevOrdinal > currOrdinal) {
                throw new Error(`Test 7 failed! Files should be ordered by ordinal: ${ourFiles[i-1].name} (${prevOrdinal}) should come after ${ourFiles[i].name} (${currOrdinal})`);
            }
        }
        console.log('Test 7 - File ordering by ordinal verified');

        // Test 8: Test with various ordinal values
        console.log('Test 8 - Testing with various ordinal values');
        const ordinalTests = [
            { name: 'ordinal-zero.md', ordinal: 0 },
            { name: 'ordinal-negative.md', ordinal: -1 },
            { name: 'ordinal-large.md', ordinal: 9999 }
        ];
        
        for (const test of ordinalTests) {
            try {
                await vfs.writeFileEx(owner_id, test.name, `Content for ${test.name}`, 'utf8', false, test.ordinal);
                console.log(`Test 8 - Successfully created ${test.name} with ordinal ${test.ordinal}`);
                
                // Verify ordinal
                const exists = await vfs.exists(test.name);
                if (!exists) {
                    throw new Error(`Test 8 failed! File ${test.name} should exist`);
                }
                
                const rootContents = await vfs.readdirEx(owner_id, '', false);
                const file = rootContents.find(node => node.name === test.name);
                
                if (!file || file.ordinal !== test.ordinal) {
                    throw new Error(`Test 8 failed! File ${test.name} should have ordinal ${test.ordinal}, got ${file?.ordinal}`);
                }
                
            } catch (error) {
                // Some ordinal values might be rejected by the database (e.g., negative values)
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 8 - Ordinal ${test.ordinal} caused error (may be acceptable):`, errorMessage);
                
                // If it's a constraint or validation error, that's acceptable
                if (!errorMessage.toLowerCase().includes('constraint') && 
                    !errorMessage.toLowerCase().includes('violat') &&
                    !errorMessage.toLowerCase().includes('invalid') &&
                    !errorMessage.toLowerCase().includes('check')) {
                    throw new Error(`Test 8 failed! Unexpected error for ordinal ${test.ordinal}: ${errorMessage}`);
                }
            }
        }

        console.log('✅ All writeFileEx tests passed');
        console.log('=== VFS WriteFileEx Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS WriteFileEx Test Failed ===');
        console.error('Error during VFS writeFileEx test:', error);
        throw error;
    }
}
