import vfs from '../VFS.js';

export async function writeFileAndReadFileTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS WriteFile and ReadFile Test Starting ===');

        // Test 1: Write and read a simple text file
        console.log('Test 1 - Write and read simple text file');
        const testFileName1 = 'test-write-read.md';
        const testContent1 = '# Test File\n\nThis is a test file for writeFile and readFile methods.\n\nIt contains:\n- Markdown content\n- Multiple lines\n- Special characters: äöü @#$%';
        
        // Write the file
        await vfs.writeFile(owner_id, testFileName1, testContent1, 'utf8');
        console.log(`Test 1 - Successfully wrote file: ${testFileName1}`);
        
        // Verify file exists
        const fileExists1 = await vfs.exists(testFileName1);
        if (!fileExists1) {
            throw new Error('Test 1 failed! File should exist after writeFile');
        }
        console.log('Test 1 - File existence verified');
        
        // Read the file back
        const readContent1 = await vfs.readFile(owner_id, testFileName1, 'utf8');
        console.log(`Test 1 - Successfully read file, content length: ${readContent1.toString().length}`);
        
        // Verify content matches
        if (readContent1.toString() !== testContent1) {
            throw new Error('Test 1 failed! Read content does not match written content');
        }
        console.log('Test 1 - Content verification passed');

        // Test 2: Write and read file without encoding (should return Buffer)
        console.log('Test 2 - Write and read file without encoding');
        const testFileName2 = 'test-binary-mode.txt';
        const testContent2 = 'Binary mode test content with special chars: ñáéíóú';
        
        // Write the file
        await vfs.writeFile(owner_id, testFileName2, testContent2);
        console.log(`Test 2 - Successfully wrote file: ${testFileName2}`);
        
        // Read without encoding (should return Buffer)
        const readContent2 = await vfs.readFile(owner_id, testFileName2);
        console.log(`Test 2 - Read without encoding, got type: ${typeof readContent2}, isBuffer: ${Buffer.isBuffer(readContent2)}`);
        
        if (!Buffer.isBuffer(readContent2)) {
            throw new Error('Test 2 failed! Reading without encoding should return Buffer');
        }
        
        // Convert buffer to string and verify content
        const stringContent2 = readContent2.toString('utf8');
        if (stringContent2 !== testContent2) {
            throw new Error('Test 2 failed! Buffer content does not match written content');
        }
        console.log('Test 2 - Buffer content verification passed');

        // Test 3: Write and read with Buffer input
        console.log('Test 3 - Write and read with Buffer input');
        const testFileName3 = 'test-buffer-input.dat';
        const testContent3 = Buffer.from('Buffer input test with binary data: \x00\x01\x02\x03\xFF', 'utf8');
        
        // Write with Buffer
        await vfs.writeFile(owner_id, testFileName3, testContent3, 'utf8');
        console.log(`Test 3 - Successfully wrote file with Buffer: ${testFileName3}`);
        
        // Read back
        const readContent3 = await vfs.readFile(owner_id, testFileName3, 'utf8');
        console.log(`Test 3 - Read back content, length: ${readContent3.toString().length}`);
        
        // Verify content
        if (readContent3.toString() !== testContent3.toString()) {
            throw new Error('Test 3 failed! Buffer read content does not match written content');
        }
        console.log('Test 3 - Buffer input/output verification passed');

        // Test 4: Write and read JSON content
        console.log('Test 4 - Write and read JSON content');
        const testFileName4 = 'test-data.json';
        const testObject = {
            name: 'Test Object',
            values: [1, 2, 3, 'string', true, null],
            nested: {
                property: 'value',
                unicode: 'äöüñáéíóú'
            }
        };
        const testContent4 = JSON.stringify(testObject, null, 2);
        
        // Write JSON
        await vfs.writeFile(owner_id, testFileName4, testContent4, 'utf8');
        console.log(`Test 4 - Successfully wrote JSON file: ${testFileName4}`);
        
        // Read and parse JSON
        const readContent4 = await vfs.readFile(owner_id, testFileName4, 'utf8');
        const parsedObject = JSON.parse(readContent4.toString());
        
        // Verify JSON content
        if (JSON.stringify(parsedObject) !== JSON.stringify(testObject)) {
            throw new Error('Test 4 failed! Parsed JSON does not match original object');
        }
        console.log('Test 4 - JSON content verification passed');

        // Test 5: Overwrite existing file
        console.log('Test 5 - Overwrite existing file');
        const newContent1 = 'This is completely new content that replaces the original.';
        
        await vfs.writeFile(owner_id, testFileName1, newContent1, 'utf8');
        console.log(`Test 5 - Successfully overwrote file: ${testFileName1}`);
        
        const readNewContent = await vfs.readFile(owner_id, testFileName1, 'utf8');
        if (readNewContent.toString() !== newContent1) {
            throw new Error('Test 5 failed! Overwritten content does not match');
        }
        console.log('Test 5 - File overwrite verification passed');

        // Test 6: Test different encodings
        console.log('Test 6 - Test different encodings');
        const testFileName6 = 'test-encoding.txt';
        const testContent6 = 'Encoding test: äöüñáéíóú';
        
        // Write with utf8
        await vfs.writeFile(owner_id, testFileName6, testContent6, 'utf8');
        
        // Read with different encoding methods
        const readUtf8 = await vfs.readFile(owner_id, testFileName6, 'utf8');
        const readBuffer = await vfs.readFile(owner_id, testFileName6);
        const readLatin1 = await vfs.readFile(owner_id, testFileName6, 'latin1');
        
        console.log(`Test 6 - UTF8 read: ${readUtf8.toString().substring(0, 20)}...`);
        console.log(`Test 6 - Buffer read length: ${(readBuffer as Buffer).length}`);
        console.log(`Test 6 - Latin1 read: ${readLatin1.toString().substring(0, 20)}...`);
        
        // UTF8 should match original
        if (readUtf8.toString() !== testContent6) {
            throw new Error('Test 6 failed! UTF8 encoding read does not match');
        }
        
        // Buffer converted to UTF8 should match
        if ((readBuffer as Buffer).toString('utf8') !== testContent6) {
            throw new Error('Test 6 failed! Buffer read converted to UTF8 does not match');
        }
        console.log('Test 6 - Encoding tests passed');

        // Test 7: Test reading non-existent file
        console.log('Test 7 - Test reading non-existent file');
        try {
            await vfs.readFile(owner_id, 'nonexistent-file.txt', 'utf8');
            throw new Error('Test 7 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 7 passed - Non-existent file threw error:', errorMessage);
            if (!errorMessage.includes('File not found')) {
                throw new Error('Test 7 failed! Should throw specific "File not found" error');
            }
        }

        // Test 8: Test writing to non-existent directory
        console.log('Test 8 - Test writing to non-existent directory');
        try {
            await vfs.writeFile(owner_id, 'nonexistent/folder/file.txt', 'content', 'utf8');
            throw new Error('Test 8 failed! Should have thrown error for non-existent directory');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 8 passed - Non-existent directory threw error:', errorMessage);
        }

        // Test 9: Test large file content
        console.log('Test 9 - Test large file content');
        const testFileName9 = 'test-large-file.txt';
        const largeContent = 'A'.repeat(10000) + '\n' + 'Large file test content with many repetitions.\n' + 'B'.repeat(10000);
        
        await vfs.writeFile(owner_id, testFileName9, largeContent, 'utf8');
        console.log(`Test 9 - Successfully wrote large file: ${testFileName9}, size: ${largeContent.length}`);
        
        const readLargeContent = await vfs.readFile(owner_id, testFileName9, 'utf8');
        if (readLargeContent.toString() !== largeContent) {
            throw new Error('Test 9 failed! Large file content does not match');
        }
        console.log('Test 9 - Large file verification passed');

        // Test 10: Verify all files are accessible via directory listing
        console.log('Test 10 - Verify files are accessible via directory listing');
        const rootContents = await vfs.readdirEx(owner_id, '', false);
        const ourTestFiles = rootContents.filter(node => node.name.startsWith('test-'));
        
        console.log(`Test 10 - Found ${ourTestFiles.length} test files in directory:`);
        ourTestFiles.forEach(file => {
            console.log(`  - ${file.name} (ordinal: ${file.ordinal}, directory: ${file.is_directory})`);
        });
        
        // Verify all our test files are present
        const expectedFiles = [testFileName1, testFileName2, testFileName3, testFileName4, testFileName6, testFileName9];
        for (const expectedFile of expectedFiles) {
            const found = ourTestFiles.find(file => file.name === expectedFile);
            if (!found) {
                throw new Error(`Test 10 failed! Expected file ${expectedFile} not found in directory listing`);
            }
            if (found.is_directory) {
                throw new Error(`Test 10 failed! File ${expectedFile} should not be marked as directory`);
            }
        }
        console.log('Test 10 - All files found in directory listing');

        console.log('✅ All writeFile and readFile tests passed');
        console.log('=== VFS WriteFile and ReadFile Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS WriteFile and ReadFile Test Failed ===');
        console.error('Error during VFS writeFile/readFile test:', error);
        throw error;
    }
}
