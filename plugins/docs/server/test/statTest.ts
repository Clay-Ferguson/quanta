import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function statTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-stat';
    
    try {
        console.log('=== VFS Stat Test Starting ===');

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
        
        // Test 1: Test stat for non-existent file (should return no rows)
        console.log('Testing vfs_stat for non-existent file...');
        
        const nonExistentResult = await pgdb.query(`
            SELECT * FROM vfs_stat($1, $2, $3)
        `, testParentPath, 'non-existent-file.txt', testRootKey);
        
        console.log(`Non-existent file stat returned ${nonExistentResult.rows.length} rows`);
        
        if (nonExistentResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for non-existent file, got: ${nonExistentResult.rows.length}`);
        }

        console.log('✅ Non-existent file test passed');

        // Test 2: Create a text file and get its stat information
        const textFilename = 'test-file.md';
        const textContent = 'This is a **test markdown** file for stat testing.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1500;

        console.log('Creating test text file...');
        
        const insertResult = await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING created_time, modified_time
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, textContentType, Buffer.from(textContent).length);
        
        const expectedCreatedTime = insertResult.rows[0].created_time;
        const expectedModifiedTime = insertResult.rows[0].modified_time;
        
        console.log(`Created text file: ${textFilename} with ordinal: ${textOrdinal}`);

        // Test vfs_stat for the text file
        console.log('Testing vfs_stat for existing text file...');
        
        const textFileStatResult = await pgdb.query(`
            SELECT * FROM vfs_stat($1, $2, $3)
        `, testParentPath, textFilename, testRootKey);
        
        console.log(`Text file stat returned ${textFileStatResult.rows.length} rows`);
        
        if (textFileStatResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing text file, got: ${textFileStatResult.rows.length}`);
        }

        const textFileStat = textFileStatResult.rows[0];
        
        console.log('Verifying text file stat data...');
        console.log(`Stat - is_public: ${textFileStat.is_public}, is_directory: ${textFileStat.is_directory}, size_bytes: ${textFileStat.size_bytes}`);
        console.log(`Stat - content_type: ${textFileStat.content_type}, ordinal: ${textFileStat.ordinal}`);
        console.log(`Stat - created_time: ${textFileStat.created_time}, modified_time: ${textFileStat.modified_time}`);
        
        // Verify all stat data
        if (textFileStat.is_public !== false) {
            throw new Error(`is_public mismatch! Expected: false, Got: ${textFileStat.is_public}`);
        }
        
        if (textFileStat.is_directory !== false) {
            throw new Error(`is_directory mismatch! Expected: false, Got: ${textFileStat.is_directory}`);
        }
        
        if (Number(textFileStat.size_bytes) !== Buffer.from(textContent).length) {
            throw new Error(`size_bytes mismatch! Expected: ${Buffer.from(textContent).length}, Got: ${textFileStat.size_bytes}`);
        }
        
        if (textFileStat.content_type !== textContentType) {
            throw new Error(`content_type mismatch! Expected: ${textContentType}, Got: ${textFileStat.content_type}`);
        }
        
        if (textFileStat.ordinal !== textOrdinal) {
            throw new Error(`ordinal mismatch! Expected: ${textOrdinal}, Got: ${textFileStat.ordinal}`);
        }
        
        // Verify timestamps (allowing for small differences due to precision)
        const createdTimeDiff = Math.abs(new Date(textFileStat.created_time).getTime() - new Date(expectedCreatedTime).getTime());
        const modifiedTimeDiff = Math.abs(new Date(textFileStat.modified_time).getTime() - new Date(expectedModifiedTime).getTime());
        
        if (createdTimeDiff > 1000) { // Allow 1 second difference
            throw new Error(`created_time mismatch! Expected: ${expectedCreatedTime}, Got: ${textFileStat.created_time}`);
        }
        
        if (modifiedTimeDiff > 1000) { // Allow 1 second difference
            throw new Error(`modified_time mismatch! Expected: ${expectedModifiedTime}, Got: ${textFileStat.modified_time}`);
        }

        console.log('✅ Text file stat test passed');

        // Test 3: Create a directory and get its stat information
        const dirFilename = 'test-directory';
        const dirOrdinal = 2500;

        console.log('Creating test directory...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, dirFilename, dirOrdinal,
        true, true, null, null, false, 'directory', 0);
        
        console.log(`Created directory: ${dirFilename} with ordinal: ${dirOrdinal}`);

        // Test vfs_stat for the directory
        console.log('Testing vfs_stat for existing directory...');
        
        const dirStatResult = await pgdb.query(`
            SELECT * FROM vfs_stat($1, $2, $3)
        `, testParentPath, dirFilename, testRootKey);
        
        if (dirStatResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing directory, got: ${dirStatResult.rows.length}`);
        }

        const dirStat = dirStatResult.rows[0];
        
        console.log('Verifying directory stat data...');
        console.log(`Dir Stat - is_public: ${dirStat.is_public}, is_directory: ${dirStat.is_directory}, size_bytes: ${dirStat.size_bytes}`);
        console.log(`Dir Stat - content_type: ${dirStat.content_type}, ordinal: ${dirStat.ordinal}`);
        
        // Verify directory stat data
        if (dirStat.is_public !== true) {
            throw new Error(`Directory is_public mismatch! Expected: true, Got: ${dirStat.is_public}`);
        }
        
        if (dirStat.is_directory !== true) {
            throw new Error(`Directory is_directory mismatch! Expected: true, Got: ${dirStat.is_directory}`);
        }
        
        if (Number(dirStat.size_bytes) !== 0) {
            throw new Error(`Directory size_bytes mismatch! Expected: 0, Got: ${dirStat.size_bytes}`);
        }
        
        if (dirStat.content_type !== 'directory') {
            throw new Error(`Directory content_type mismatch! Expected: 'directory', Got: ${dirStat.content_type}`);
        }
        
        if (dirStat.ordinal !== dirOrdinal) {
            throw new Error(`Directory ordinal mismatch! Expected: ${dirOrdinal}, Got: ${dirStat.ordinal}`);
        }

        console.log('✅ Directory stat test passed');

        // Test 4: Create a binary file and get its stat information
        const binaryFilename = 'test-binary.png';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
        const binaryContentType = 'image/png';
        const binaryOrdinal = 3500;

        console.log('Creating test binary file...');
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, binaryFilename, binaryOrdinal,
        false, false, null, binaryContent, true, binaryContentType, binaryContent.length);
        
        console.log(`Created binary file: ${binaryFilename} with ordinal: ${binaryOrdinal}`);

        // Test vfs_stat for the binary file
        console.log('Testing vfs_stat for existing binary file...');
        
        const binaryStatResult = await pgdb.query(`
            SELECT * FROM vfs_stat($1, $2, $3)
        `, testParentPath, binaryFilename, testRootKey);
        
        if (binaryStatResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing binary file, got: ${binaryStatResult.rows.length}`);
        }

        const binaryStat = binaryStatResult.rows[0];
        
        console.log('Verifying binary file stat data...');
        console.log(`Binary Stat - is_public: ${binaryStat.is_public}, is_directory: ${binaryStat.is_directory}, size_bytes: ${binaryStat.size_bytes}`);
        console.log(`Binary Stat - content_type: ${binaryStat.content_type}, ordinal: ${binaryStat.ordinal}`);
        
        // Verify binary file stat data
        if (binaryStat.is_public !== false) {
            throw new Error(`Binary is_public mismatch! Expected: false, Got: ${binaryStat.is_public}`);
        }
        
        if (binaryStat.is_directory !== false) {
            throw new Error(`Binary is_directory mismatch! Expected: false, Got: ${binaryStat.is_directory}`);
        }
        
        if (Number(binaryStat.size_bytes) !== binaryContent.length) {
            throw new Error(`Binary size_bytes mismatch! Expected: ${binaryContent.length}, Got: ${binaryStat.size_bytes}`);
        }
        
        if (binaryStat.content_type !== binaryContentType) {
            throw new Error(`Binary content_type mismatch! Expected: ${binaryContentType}, Got: ${binaryStat.content_type}`);
        }
        
        if (binaryStat.ordinal !== binaryOrdinal) {
            throw new Error(`Binary ordinal mismatch! Expected: ${binaryOrdinal}, Got: ${binaryStat.ordinal}`);
        }

        console.log('✅ Binary file stat test passed');

        // Test 5: Test with different root keys (should return no rows)
        console.log('Testing vfs_stat with different root key...');
        
        const differentRootResult = await pgdb.query(`
            SELECT * FROM vfs_stat($1, $2, $3)
        `, testParentPath, textFilename, 'different-root-key');
        
        console.log(`Different root key stat returned ${differentRootResult.rows.length} rows`);
        
        if (differentRootResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for different root key, got: ${differentRootResult.rows.length}`);
        }

        console.log('✅ Different root key test passed');

        // Test 6: Test with different parent paths (should return no rows)
        console.log('Testing vfs_stat with different parent path...');
        
        const differentPathResult = await pgdb.query(`
            SELECT * FROM vfs_stat($1, $2, $3)
        `, '/different-parent-path', textFilename, testRootKey);
        
        console.log(`Different parent path stat returned ${differentPathResult.rows.length} rows`);
        
        if (differentPathResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for different parent path, got: ${differentPathResult.rows.length}`);
        }

        console.log('✅ Different parent path test passed');

        // Test 7: Verify ordinal ordering in stat results
        console.log('Testing that multiple stat calls work correctly and verify ordinal ordering...');
        
        // Get stat for all files to verify ordinal ordering
        const allStats = [];
        const allFiles = [
            { filename: textFilename, expectedOrdinal: textOrdinal },
            { filename: dirFilename, expectedOrdinal: dirOrdinal },
            { filename: binaryFilename, expectedOrdinal: binaryOrdinal }
        ];
        
        for (const file of allFiles) {
            const statResult = await pgdb.query(`
                SELECT * FROM vfs_stat($1, $2, $3)
            `, testParentPath, file.filename, testRootKey);
            
            if (statResult.rows.length === 1) {
                allStats.push({ 
                    filename: file.filename, 
                    ordinal: statResult.rows[0].ordinal,
                    expectedOrdinal: file.expectedOrdinal,
                    is_directory: statResult.rows[0].is_directory 
                });
            }
        }
        
        console.log('All stat results:');
        allStats.forEach((stat, index) => {
            console.log(`  ${index + 1}. ${stat.filename} (ordinal: ${stat.ordinal}, ${stat.is_directory ? 'directory' : 'file'})`);
            
            if (stat.ordinal !== stat.expectedOrdinal) {
                throw new Error(`Ordinal mismatch for ${stat.filename}! Expected: ${stat.expectedOrdinal}, Got: ${stat.ordinal}`);
            }
        });
        
        // Sort by ordinal to verify ordering
        allStats.sort((a, b) => a.ordinal - b.ordinal);
        const expectedOrderByOrdinal = [textFilename, dirFilename, binaryFilename]; // ordinals: 1500, 2500, 3500
        const actualOrderByOrdinal = allStats.map(stat => stat.filename);
        
        if (JSON.stringify(actualOrderByOrdinal) !== JSON.stringify(expectedOrderByOrdinal)) {
            throw new Error(`Ordinal ordering incorrect! Expected: ${expectedOrderByOrdinal.join(', ')}, Got: ${actualOrderByOrdinal.join(', ')}`);
        }

        console.log('✅ Multiple stat calls and ordinal ordering test passed');
        console.log('=== VFS Stat Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Stat Test Failed ===');
        console.error('Error during VFS stat test:', error);
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
