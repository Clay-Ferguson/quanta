import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function readdirTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS Readdir Test Starting ===');

        const testParentPath = '/test-readdir';
        
        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        await pgdb.query(`
            DELETE FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testParentPath);
        
        const testFiles = [
            { filename: 'file-c.txt', ordinal: 3000, content: 'Content C' },
            { filename: 'file-a.txt', ordinal: 1000, content: 'Content A' },
            { filename: 'file-b.txt', ordinal: 2000, content: 'Content B' },
            { filename: 'dir-d', ordinal: 4000, isDirectory: true },
        ];

        console.log('Creating test files with different ordinals...');
        
        // Insert test files/directories with different ordinal values
        for (const testFile of testFiles) {
            const params = [
                owner_id, 
                testRootKey, 
                testParentPath, 
                testFile.filename, 
                testFile.ordinal,
                testFile.isDirectory || false,  // is_directory
                false,  // is_public
                testFile.isDirectory ? null : testFile.content,  // content_text (null for directories)
                null,  // content_binary
                false,  // is_binary
                testFile.isDirectory ? 'directory' : 'text/plain',  // content_type
                testFile.isDirectory ? 0 : Buffer.from(testFile.content!).length  // size_bytes
            ];
            
            await pgdb.query(`
                INSERT INTO vfs_nodes (
                    owner_id, doc_root_key, parent_path, filename, ordinal,
                    is_directory, is_public, content_text, content_binary, is_binary, 
                    content_type, size_bytes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, ...params);
            
            console.log(`Created ${testFile.isDirectory ? 'directory' : 'file'}: ${testFile.filename} (ordinal: ${testFile.ordinal})`);
        }

        // Now test the vfs_readdir function
        console.log('Testing vfs_readdir function...');
        
        const readdirResult = await pgdb.query(`
            SELECT * FROM vfs_readdir($1, $2, $3, $4)
        `, owner_id, testParentPath, testRootKey, false);  // false = don't include content
        
        console.log(`vfs_readdir returned ${readdirResult.rows.length} items:`);
        
        // Verify the results are ordered by ordinal
        const expectedOrder = ['file-a.txt', 'file-b.txt', 'file-c.txt', 'dir-d'];
        const actualOrder = readdirResult.rows.map((row: any) => row.filename);
        
        console.log('Expected order:', expectedOrder);
        console.log('Actual order:  ', actualOrder);
        
        // Check each item in the results
        readdirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, ${row.is_directory ? 'directory' : 'file'})`);
        });

        // Verify the ordering is correct
        if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrder.join(', ')}, Got: ${actualOrder.join(', ')}`);
        }

        // Test with include_content = true
        console.log('Testing vfs_readdir with include_content=true...');
        
        const readdirWithContentResult = await pgdb.query(`
            SELECT * FROM vfs_readdir($1, $2, $3, $4)
        `, owner_id, testParentPath, testRootKey, true);  // true = include content
        
        // Verify content is included for files but not directories
        const fileWithContent = readdirWithContentResult.rows.find((row: any) => row.filename === 'file-a.txt');
        const directoryRow = readdirWithContentResult.rows.find((row: any) => row.filename === 'dir-d');
        
        if (fileWithContent?.content_text !== 'Content A') {
            throw new Error(`Expected content 'Content A' for file-a.txt, got: ${fileWithContent?.content_text}`);
        }
        
        if (directoryRow?.content_text !== null) {
            throw new Error(`Expected null content for directory dir-d, got: ${directoryRow?.content_text}`);
        }

        console.log('✅ Content inclusion test passed');

        // Clean up test data
        console.log('Cleaning up test data...');
        await pgdb.query(`
            DELETE FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testParentPath);

        console.log('=== VFS Readdir Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Readdir Test Failed ===');
        console.error('Error during VFS readdir test:', error);
        throw error;
    }
}
