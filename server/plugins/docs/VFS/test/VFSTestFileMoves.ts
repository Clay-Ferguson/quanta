import pgdb from '../../../../PGDB.js';
import { wipeTable, createFolderStructureTest } from './VFSTestCore.js';
import { docMod } from '../../DocMod.js';

const testRootKey = 'pgroot';

/**
 * Test function to test file move operations using DocMod.moveUpOrDown
 * 
 * Creates a folder structure and tests moving a file up in the ordering
 * The test moves "0005_file5.md" up in "/0001_test-structure/0002_two" folder
 * 
 * Expected folder structure from createFolderStructureTest:
 * /0001_test-structure/
 *   /0001_one/
 *     0001_file1.md
 *     0002_file2.md
 *     0003_file3.md
 *     0004_file4.md
 *     0005_file5.md
 *     0006_subfolder1/
 *     0007_subfolder2/
 *     0008_subfolder3/
 *     0009_subfolder4/
 *     0010_subfolder5/
 *   /0002_two/  <-- This is where our test will run
 *     0001_file1.md
 *     0002_file2.md
 *     0003_file3.md
 *     0004_file4.md  <-- Will swap with file5.md
 *     0005_file5.md  <-- This is the file we'll move up
 *     0006_subfolder1/
 *     0007_subfolder2/
 *     0008_subfolder3/
 *     0009_subfolder4/
 *     0010_subfolder5/
 *   /0003_three/
 *     (same structure)
 *   /0004_four/
 *     (same structure)  
 *   /0005_five/
 *     (same structure)
 */
export async function pgdbTestMoveUp(): Promise<void> {
    try {
        console.log('=== FILE MOVE TEST Starting ===');
        
        // Step 1: Wipe table to get clean slate
        console.log('Wiping table for clean slate...');
        await wipeTable();
        
        // Step 2: Create folder structure
        console.log('Creating folder structure...');
        await createFolderStructureTest();
        
        // Step 3: Verify the initial structure in the target folder
        const targetFolderPath = '/0001_test-structure/0002_two'; 
        console.log(`\nListing contents of ${targetFolderPath} before move:`);
        
        const beforeResult = await pgdb.query(
            'SELECT * FROM vfs_readdir($1, $2) ORDER BY filename',
            [targetFolderPath, testRootKey]
        );
        
        console.log(`Found ${beforeResult.rows.length} items in target folder:`);
        beforeResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (${row.is_directory ? 'folder' : 'file'})`);
        });
        
        // Look for the target file: "0005_file5.md"
        const targetFilename = '0005_file5.md';
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
                filename: "0005_file5.md",
                treeFolder: "/0001_test-structure/0002_two", // Full path from root
                docRootKey: "pgroot"
            }
        };
        
        const mockRes = {
            status: (code: number) => ({
                json: (data: any) => {
                    console.log(`Response status: ${code}, data:`, data);
                    if (code !== 200) {
                        throw new Error(`Move operation failed with status ${code}: ${JSON.stringify(data)}`);
                    }
                }
            }),
            json: (data: any) => {
                console.log('Move operation successful, response:', data);
                if (!data.success) {
                    throw new Error(`Move operation failed: ${data.message || 'Unknown error'}`);
                }
            }
        };
        
        // Call the moveUpOrDown method directly
        await docMod.moveUpOrDown(mockReq as any, mockRes as any);
        
        // Step 5: Verify the results of the move operation
        console.log('\nVerifying results after move...');
        
        const afterResult = await pgdb.query(
            'SELECT * FROM vfs_readdir($1, $2) ORDER BY filename',
            [targetFolderPath, testRootKey]
        );
        
        console.log(`Contents of ${targetFolderPath} after move:`);
        afterResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (${row.is_directory ? 'folder' : 'file'})`);
        });
        
        // Verify the move worked correctly
        // After moving up, file5.md should now be at position 0004, and the previous 0004_file4.md should be at 0005
        const newFile5Entry = afterResult.rows.find((row: any) => row.filename.endsWith('file5.md'));
        const newFile4Entry = afterResult.rows.find((row: any) => row.filename.endsWith('file4.md'));
        
        if (!newFile5Entry || !newFile4Entry) {
            console.error('❌ Could not find moved files in the result');
            throw new Error('Moved files not found');
        }
        
        // Check that file5 is now at ordinal 0004 and file4 is now at ordinal 0005
        if (newFile5Entry.filename.startsWith('0004_') && newFile4Entry.filename.startsWith('0005_')) {
            console.log('✅ SUCCESS: File move operation completed correctly');
            console.log(`   - file5.md moved from 0005_ to 0004_: ${newFile5Entry.filename}`);
            console.log(`   - file4.md moved from 0004_ to 0005_: ${newFile4Entry.filename}`);
        } else {
            console.error('❌ FAILED: Files did not move to expected ordinal positions');
            console.error(`   - file5.md is now: ${newFile5Entry.filename} (expected to start with 0004_)`);
            console.error(`   - file4.md is now: ${newFile4Entry.filename} (expected to start with 0005_)`);
            throw new Error('Move operation did not produce expected results');
        }
        
        console.log('=== FILE MOVE TEST COMPLETED SUCCESSFULLY ===\n');
        
    } catch (error) {
        console.error('=== FILE MOVE TEST FAILED ===');
        console.error('Error during file move test:', error);
        throw error;
    }
}
