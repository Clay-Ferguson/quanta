import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function writeBinaryFileTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-write-binary-file';
    
    try {
        console.log('=== VFS Write Binary File Test Starting ===');

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
        
        // Test 1: Write a new binary file
        const binaryFilename = 'new-image.png';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]); // PNG header + IHDR chunk start
        const binaryContentType = 'image/png';
        const binaryOrdinal = 1000;

        console.log('Testing vfs_write_binary_file function for new file...');
        
        const writeResult = await pgdb.query(`
            SELECT vfs_write_binary_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
        `, owner_id, testParentPath, binaryFilename, binaryContent, testRootKey, binaryOrdinal, binaryContentType, false);
        
        const fileId = writeResult.rows[0].file_id;
        console.log(`Binary file created with ID: ${fileId}`);
        
        // Verify the file was created correctly by reading it back
        const verifyResult = await pgdb.query(`
            SELECT content_binary, content_type, size_bytes, ordinal, is_binary, 
                   is_directory, owner_id, is_public, content_text
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, binaryFilename);
        
        if (verifyResult.rows.length === 0) {
            throw new Error('Binary file not found after writing');
        }

        const retrievedData = verifyResult.rows[0];
        
        console.log('Verifying written binary file data...');
        console.log(`Expected content length: ${binaryContent.length} bytes`);
        console.log(`Retrieved content length: ${retrievedData.content_binary ? retrievedData.content_binary.length : 0} bytes`);
        
        if (!retrievedData.content_binary || !binaryContent.equals(retrievedData.content_binary)) {
            throw new Error(`Binary content mismatch! Expected ${binaryContent.length} bytes, got ${retrievedData.content_binary ? retrievedData.content_binary.length : 0} bytes`);
        }
        
        if (retrievedData.content_type !== binaryContentType) {
            throw new Error(`Content type mismatch! Expected: "${binaryContentType}", Got: "${retrievedData.content_type}"`);
        }
        
        if (Number(retrievedData.size_bytes) !== binaryContent.length) {
            throw new Error(`Size mismatch! Expected: ${binaryContent.length}, Got: ${retrievedData.size_bytes}`);
        }
        
        if (retrievedData.ordinal !== binaryOrdinal) {
            throw new Error(`Ordinal mismatch! Expected: ${binaryOrdinal}, Got: ${retrievedData.ordinal}`);
        }
        
        if (retrievedData.is_binary !== true) {
            throw new Error(`Binary flag mismatch! Expected: true, Got: ${retrievedData.is_binary}`);
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
        
        if (retrievedData.content_text !== null) {
            throw new Error(`Text content should be null for binary file! Got: "${retrievedData.content_text}"`);
        }

        console.log('✅ New binary file write test passed');

        // Test 2: Update an existing binary file (ON CONFLICT DO UPDATE)
        const updatedContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]); // JPEG header
        const updatedContentType = 'image/jpeg';
        const updatedOrdinal = 2000;

        console.log('Testing vfs_write_binary_file function for updating existing file...');
        
        const updateResult = await pgdb.query(`
            SELECT vfs_write_binary_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
        `, owner_id, testParentPath, binaryFilename, updatedContent, testRootKey, updatedOrdinal, updatedContentType, true);
        
        const updatedFileId = updateResult.rows[0].file_id;
        console.log(`Binary file updated with ID: ${updatedFileId}`);
        
        // Should be the same file ID since we're updating, not creating new
        if (updatedFileId !== fileId) {
            throw new Error(`File ID changed during update! Expected: ${fileId}, Got: ${updatedFileId}`);
        }
        
        // Verify the file was updated correctly
        const verifyUpdateResult = await pgdb.query(`
            SELECT content_binary, content_type, size_bytes, ordinal, is_public, modified_time
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, binaryFilename);
        
        const updatedData = verifyUpdateResult.rows[0];
        
        console.log('Verifying updated binary file data...');
        console.log(`Expected updated content length: ${updatedContent.length} bytes`);
        console.log(`Retrieved updated content length: ${updatedData.content_binary ? updatedData.content_binary.length : 0} bytes`);
        
        if (!updatedData.content_binary || !updatedContent.equals(updatedData.content_binary)) {
            throw new Error(`Updated binary content mismatch! Expected ${updatedContent.length} bytes, got ${updatedData.content_binary ? updatedData.content_binary.length : 0} bytes`);
        }
        
        if (updatedData.content_type !== updatedContentType) {
            throw new Error(`Updated content type mismatch! Expected: "${updatedContentType}", Got: "${updatedData.content_type}"`);
        }
        
        if (Number(updatedData.size_bytes) !== updatedContent.length) {
            throw new Error(`Updated size mismatch! Expected: ${updatedContent.length}, Got: ${updatedData.size_bytes}`);
        }
        
        if (updatedData.ordinal !== updatedOrdinal) {
            throw new Error(`Updated ordinal mismatch! Expected: ${updatedOrdinal}, Got: ${updatedData.ordinal}`);
        }
        
        if (updatedData.is_public !== true) {
            throw new Error(`Updated public flag mismatch! Expected: true, Got: ${updatedData.is_public}`);
        }

        console.log('✅ Binary file update test passed');

        // Test 3: Write binary files with different ordinals and verify ordering
        console.log('Testing vfs_write_binary_file with multiple files for ordinal ordering...');
        
        const testFiles = [
            { filename: 'image-z.gif', ordinal: 4000, content: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) }, // GIF89a header
            { filename: 'image-a.bmp', ordinal: 1500, content: Buffer.from([0x42, 0x4D]) }, // BMP header
            { filename: 'image-m.ico', ordinal: 3000, content: Buffer.from([0x00, 0x00, 0x01, 0x00]) }, // ICO header
        ];

        // Write all test files
        for (const testFile of testFiles) {
            await pgdb.query(`
                SELECT vfs_write_binary_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
            `, owner_id, testParentPath, testFile.filename, testFile.content, testRootKey, testFile.ordinal, 'application/octet-stream', false);
            
            console.log(`Created binary file: ${testFile.filename} (ordinal: ${testFile.ordinal})`);
        }
        
        // Verify ordering by reading directory
        const dirResult = await pgdb.query(`
            SELECT filename, ordinal, is_binary, size_bytes
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC, filename ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${dirResult.rows.length} files in directory (ordered by ordinal):`);
        dirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, binary: ${row.is_binary}, size: ${row.size_bytes} bytes)`);
        });
        
        // Verify the ordering is correct (by ordinal, then filename)
        const expectedOrder = ['image-a.bmp', 'new-image.png', 'image-m.ico', 'image-z.gif']; // ordinals: 1500, 2000, 3000, 4000
        const actualOrder = dirResult.rows.map((row: any) => row.filename);
        
        if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrder.join(', ')}, Got: ${actualOrder.join(', ')}`);
        }

        // Test 4: Verify binary files can be read correctly with vfs_read_file
        console.log('Testing that binary files can be read back correctly with vfs_read_file...');
        
        const readResult = await pgdb.query(`
            SELECT vfs_read_file($1, $2, $3, $4) as file_content
        `, owner_id, testParentPath, binaryFilename, testRootKey);
        
        const retrievedBinaryContent = readResult.rows[0].file_content;
        
        if (!retrievedBinaryContent || !updatedContent.equals(retrievedBinaryContent)) {
            throw new Error(`Read binary content mismatch! Expected ${updatedContent.length} bytes, got ${retrievedBinaryContent ? retrievedBinaryContent.length : 0} bytes`);
        }

        console.log('✅ Binary file read-back test passed');
        console.log('✅ Multiple binary files with ordinal ordering test passed');
        console.log('=== VFS Write Binary File Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Write Binary File Test Failed ===');
        console.error('Error during VFS write binary file test:', error);
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
