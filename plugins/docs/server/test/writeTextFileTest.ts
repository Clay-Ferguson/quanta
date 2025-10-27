import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function writeTextFileTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-write-text-file';
    
    try {
        console.log('=== VFS Write Text File Test Starting ===');

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            `, testRootKey, testParentPath);
        } catch (cleanupError) {
            console.log('Warning: Initial cleanup failed (this is usually not a problem):', cleanupError);
        }
        
        // Test 1: Write a new text file
        const textFilename = 'new-file.md';
        const textContent = 'This is a **new markdown** file created by vfs_write_text_file.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1000;

        console.log('Testing vfs_write_text_file function for new file...');
        
        const writeResult = await pgdb.query(`
            SELECT vfs_write_text_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
        `, owner_id, testParentPath, textFilename, textContent, testRootKey, textOrdinal, textContentType, false);
        
        const fileId = writeResult.rows[0].file_id;
        console.log(`File created with ID: ${fileId}`);
        
        // Verify the file was created correctly by reading it back
        const verifyResult = await pgdb.query(`
            SELECT content_text, content_type, size_bytes, ordinal, is_binary, 
                   is_directory, owner_id, is_public
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (verifyResult.rows.length === 0) {
            throw new Error('File not found after writing');
        }

        const retrievedData = verifyResult.rows[0];
        
        console.log('Verifying written file data...');
        console.log(`Expected content: "${textContent}"`);
        console.log(`Retrieved content: "${retrievedData.content_text}"`);
        
        if (retrievedData.content_text !== textContent) {
            throw new Error(`Content mismatch! Expected: "${textContent}", Got: "${retrievedData.content_text}"`);
        }
        
        if (retrievedData.content_type !== textContentType) {
            throw new Error(`Content type mismatch! Expected: "${textContentType}", Got: "${retrievedData.content_type}"`);
        }
        
        if (Number(retrievedData.size_bytes) !== Buffer.from(textContent).length) {
            throw new Error(`Size mismatch! Expected: ${Buffer.from(textContent).length}, Got: ${retrievedData.size_bytes}`);
        }
        
        if (retrievedData.ordinal !== textOrdinal) {
            throw new Error(`Ordinal mismatch! Expected: ${textOrdinal}, Got: ${retrievedData.ordinal}`);
        }
        
        if (retrievedData.is_binary !== false) {
            throw new Error(`Binary flag mismatch! Expected: false, Got: ${retrievedData.is_binary}`);
        }
        
        if (retrievedData.is_directory !== false) {
            throw new Error(`Directory flag mismatch! Expected: false, Got: ${retrievedData.is_directory}`);
        }
        
        if (retrievedData.owner_id !== owner_id) {
            throw new Error(`Owner ID mismatch! Expected: ${owner_id}, Got: ${retrievedData.owner_id}`);
        }
        
        if (retrievedData.is_public !== false) {
            throw new Error(`Public flag mismatch! Expected: false, Got: ${retrievedData.is_public}`);
        }

        console.log('✅ New file write test passed');

        // Test 2: Update an existing file (ON CONFLICT DO UPDATE)
        const updatedContent = 'This is the **updated content** for the existing file.';
        const updatedContentType = 'text/plain';
        const updatedOrdinal = 1500; // Changed from 2000 to avoid conflict with file-m.txt

        console.log('Testing vfs_write_text_file function for updating existing file...');
        
        const updateResult = await pgdb.query(`
            SELECT vfs_write_text_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
        `, owner_id, testParentPath, textFilename, updatedContent, testRootKey, updatedOrdinal, updatedContentType, true);
        
        const updatedFileId = updateResult.rows[0].file_id;
        console.log(`File updated with ID: ${updatedFileId}`);
        
        // Should be the same file ID since we're updating, not creating new
        if (updatedFileId !== fileId) {
            throw new Error(`File ID changed during update! Expected: ${fileId}, Got: ${updatedFileId}`);
        }
        
        // Verify the file was updated correctly
        const verifyUpdateResult = await pgdb.query(`
            SELECT content_text, content_type, size_bytes, ordinal, is_public, modified_time
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        const updatedData = verifyUpdateResult.rows[0];
        
        console.log('Verifying updated file data...');
        console.log(`Expected updated content: "${updatedContent}"`);
        console.log(`Retrieved updated content: "${updatedData.content_text}"`);
        
        if (updatedData.content_text !== updatedContent) {
            throw new Error(`Updated content mismatch! Expected: "${updatedContent}", Got: "${updatedData.content_text}"`);
        }
        
        if (updatedData.content_type !== updatedContentType) {
            throw new Error(`Updated content type mismatch! Expected: "${updatedContentType}", Got: "${updatedData.content_type}"`);
        }
        
        if (Number(updatedData.size_bytes) !== Buffer.from(updatedContent).length) {
            throw new Error(`Updated size mismatch! Expected: ${Buffer.from(updatedContent).length}, Got: ${updatedData.size_bytes}`);
        }
        
        if (updatedData.ordinal !== updatedOrdinal) {
            throw new Error(`Updated ordinal mismatch! Expected: ${updatedOrdinal}, Got: ${updatedData.ordinal}`);
        }
        
        if (updatedData.is_public !== true) {
            throw new Error(`Updated public flag mismatch! Expected: true, Got: ${updatedData.is_public}`);
        }

        console.log('✅ File update test passed');

        // Test 3: Write files with different ordinals and verify ordering
        console.log('Testing vfs_write_text_file with multiple files for ordinal ordering...');
        
        const testFiles = [
            { filename: 'file-z.txt', ordinal: 3000, content: 'Content Z' },
            { filename: 'file-a.txt', ordinal: 1000, content: 'Content A' },
            { filename: 'file-m.txt', ordinal: 2000, content: 'Content M' },
        ];

        // Write all test files
        for (const testFile of testFiles) {
            await pgdb.query(`
                SELECT vfs_write_text_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
            `, owner_id, testParentPath, testFile.filename, testFile.content, testRootKey, testFile.ordinal, 'text/plain', false);
            
            console.log(`Created file: ${testFile.filename} (ordinal: ${testFile.ordinal})`);
        }
        
        // Verify ordering by reading directory
        const dirResult = await pgdb.query(`
            SELECT filename, ordinal 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC, filename ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${dirResult.rows.length} files in directory (ordered by ordinal):`);
        dirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal})`);
        });
        
        // Verify the ordering is correct (by ordinal, then filename)
        const expectedOrder = ['file-a.txt', 'new-file.md', 'file-m.txt', 'file-z.txt']; // ordinals: 1000, 1500, 2000, 3000
        const actualOrder = dirResult.rows.map((row: any) => row.filename);
        
        if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrder.join(', ')}, Got: ${actualOrder.join(', ')}`);
        }

        console.log('✅ Multiple files with ordinal ordering test passed');
        console.log('=== VFS Write Text File Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Write Text File Test Failed ===');
        console.error('Error during VFS write text file test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            `, testRootKey, testParentPath);
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}
