import pgdb from '../../PDGB.js';

/**
 * Test function to verify PostgreSQL database functionality
 * Creates a test file record and reads it back to verify everything is working
 */
export async function pgdbTest(): Promise<void> {
    try {
        console.log('=== PGDB Test Starting ===');

        const testRootKey = 'test-root';
        const testParentPath = '/test-documents';
        const testFilename = 'test-file.md';
        const testContent = Buffer.from('# Test Document 2\n\nThis is a test file created by the PGDB test function.');
        const testContentType = 'text/markdown';

        console.log('Creating test record...');
        
        // Insert a test file record using our PostgreSQL function
        const result = await pgdb.query(
            'SELECT pg_write_file($1, $2, $3, $4, $5) as file_id',
            [testParentPath, testFilename, testContent, testRootKey, testContentType]
        );
        
        const fileId = result.rows[0].file_id;
        console.log(`Test file created with ID: ${fileId}`);

        // Now read the record back
        console.log('Reading test record back...');
        
        const readResult = await pgdb.query(
            'SELECT pg_read_file($1, $2, $3) as content',
            [testParentPath, testFilename, testRootKey]
        );
        
        const retrievedContent = readResult.rows[0].content;
        const contentAsString = retrievedContent.toString('utf8');
        
        console.log('Retrieved content:', contentAsString);
        
        // Also get file metadata using pg_stat
        const statResult = await pgdb.query(
            'SELECT * FROM pg_stat($1, $2, $3)',
            [testParentPath, testFilename, testRootKey]
        );
        
        if (statResult.rows.length > 0) {
            const fileStats = statResult.rows[0];
            console.log('File metadata:', {
                is_directory: fileStats.is_directory,
                size_bytes: fileStats.size_bytes,
                content_type: fileStats.content_type,
                ordinal: fileStats.ordinal,
                created_time: fileStats.created_time,
                modified_time: fileStats.modified_time
            });
        }

        // Test directory listing
        console.log('Testing directory listing...');
        const dirResult = await pgdb.query(
            'SELECT * FROM pg_readdir($1, $2)',
            [testParentPath, testRootKey]
        );
        
        console.log(`Found ${dirResult.rows.length} files in directory ${testParentPath}:`);
        dirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (${row.is_directory ? 'directory' : 'file'}, ordinal: ${row.ordinal})`);
        });

        console.log('=== PGDB Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== PGDB Test Failed ===');
        console.error('Error during PGDB test:', error);
        throw error;
    }
}