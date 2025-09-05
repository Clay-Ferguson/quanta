import pgdb from '../../../../../server/PGDB.js';
import { AuthenticatedRequest } from '../../../../../server/ServerUtil.js';
import { docMod } from '../../../../../plugins/docs/server/DocMod.js';
import { dumpTableStructure, resetTestEnvironment } from './VFSTest.js';

const testRootKey = 'usr';

/**
 * Test function to test file move operations using DocMod.moveUpOrDown
 * 
 * Creates a folder structure and tests moving a file up in the ordering
 * The test moves "0005_file5.md" up in "0001_test-structure/0002_two" folder
 * 
 * Expected folder structure from createFolderStructureTest:
 * 0001_test-structure/
 *   /0001_one/
 *     0001_file1.md
 *     0002_file2.md
 *     0003_file3.md
 *     0004_subfolder1/
 *     0005_subfolder2/
 *     0006_subfolder3/
 *   /0002_two/  <-- This is where our test will run
 *     0001_file1.md
 *     0002_file2.md
 *     0003_file3.md <-- This file will swap with 0002.md
 *     0004_subfolder1/
 *     0005_subfolder2/
 *     0006_subfolder3/
 *   /0003_three/
 *     (same structure)
 */
export async function pgdbTestMoveUp(owner_id: number): Promise<void> {
    try {
        await resetTestEnvironment();
        console.log('=== FILE MOVE TEST Starting ===');
        
        // Step 3: Verify the initial structure in the target folder
        const targetFolderPath = '0001_test-structure/0002_two'; 
        console.log(`\nListing contents of ${targetFolderPath} before move:`);
        
        const beforeResult = await pgdb.query(
            'SELECT * FROM vfs_readdir($1, $2, $3) ORDER BY filename',
            owner_id, targetFolderPath, testRootKey
        );
        
        console.log(`Found ${beforeResult.rows.length} items in target folder:`);
        beforeResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (${row.is_directory ? 'folder' : 'file'})`);
        });
        
        // Look for the target file: "0003_file3.md"
        const targetFilename = '0003_file3.md';
        const targetFile = beforeResult.rows.find((row: any) => row.filename === targetFilename);
        
        if (!targetFile) {
            console.error(`❌ Target file ${targetFilename} not found in the folder!`);
            console.log('   Available files in folder:');
            beforeResult.rows.filter((row: any) => !row.is_directory).forEach((row: any) => {
                console.log(`     - ${row.filename}`);
            });
            throw new Error('Target file not found');
        }
        
        console.log(`✅ Found target file: ${targetFile.filename}`);
        
        // Step 4: Perform the move operation using DocMod.moveUpOrDown
        console.log('\nPerforming move up operation...');
        
        // Create a mock request and response object
        const mockReq = {
            body: {
                direction: "up",
                filename: "0003_file3.md",
                treeFolder: "0001_test-structure/0002_two", // Full path from root
                docRootKey: "usr"
            }
        };
        
        const mockRes = {
            status: (code: number) => ({
                json: (data: any) => {
                    console.log(`Response status: ${code}, data:`, data);
                    if (code !== 200) {
                        console.error(`Move operation failed with. Here's the current DB Dump.`);
                        dumpTableStructure(owner_id);
                        throw new Error(`Move operation failed with status ${code}: ${JSON.stringify(data)}`);
                    }
                }
            }),
            json: (data: any) => {
                console.log('Move operation successful, response:', data);
                if (!data.message || data.message !== 'Files moved successfully') {
                    throw new Error(`Move operation failed: ${data.message || 'Unknown error'}`);
                }
            }
        };
        (mockReq as AuthenticatedRequest).userProfile = pgdb.adminProfile!; // Mock user profile with owner_id
        // Call the moveUpOrDown method directly
        await docMod.moveUpOrDown(mockReq as any, mockRes as any);
        
        // Step 5: Verify the results of the move operation
        console.log('\nVerifying results after move...');
        
        const afterResult = await pgdb.query(
            'SELECT * FROM vfs_readdir($1, $2, $3) ORDER BY filename',
            owner_id, targetFolderPath, testRootKey
        );
        
        console.log(`Contents of ${targetFolderPath} after move:`);
        afterResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (${row.is_directory ? 'folder' : 'file'})`);
        });
        
        // todo-2: Need to explicily read both files (involved in this name swap) and make sure the content has essentially swapped for test to really pass
        console.log('=== FILE MOVE TEST COMPLETED SUCCESSFULLY ===\n');
        
    } catch (error) {
        console.error('=== FILE MOVE TEST FAILED ===');
        console.error('Error during file move test:', error);
        throw error;
    }
}


