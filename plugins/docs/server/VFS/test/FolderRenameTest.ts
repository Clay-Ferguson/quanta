import pgdb from '../../../../../server/PGDB.js';
import { resetTestEnvironment } from './VFSTest.js';

const testRootKey = 'usr';

/**
 * Test function to verify that renaming folders properly updates all child paths
 * Uses our vfs_rename function to rename folders and checks if child paths are updated
 */
export async function testFolderRenameWithChildren(owner_id: number): Promise<void> {
    try {
        await resetTestEnvironment();
        console.log('\n=== TESTING FOLDER RENAME WITH CHILDREN ===');
        
        // Now rename one of the folders (e.g., '0001_test-structure/0001_one' to '0001_test-structure/0001_one-renamed')
        const oldParentPath = '0001_test-structure';
        const oldFolderName = '0001_one';
        const newParentPath = '0001_test-structure';
        const newFolderName = '0001_one-renamed';
        
        console.log(`\nRenaming folder: ${oldParentPath}/${oldFolderName} to ${newParentPath}/${newFolderName}`);
        
        // Execute the rename
        const renameResult = await pgdb.query(
            'SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)',
            owner_id, oldParentPath, oldFolderName, newParentPath, newFolderName, testRootKey
        );
        
        console.log(`Rename operation result: ${renameResult.rows[0].success ? 'Success' : 'Failed'}`);
        console.log(`Diagnostic information: ${renameResult.rows[0].diagnostic}`);
        
        // Now verify that child paths were properly updated
        console.log('\nVerifying child paths were updated correctly...');
        
        // Check if files under the renamed folder exist with their new paths
        const childPath = '0001_test-structure/0001_one-renamed';
        const childFiles = await pgdb.query(
            'SELECT * FROM vfs_readdir($1, $2, $3)',
            owner_id, childPath, testRootKey
        );
        
        console.log(`Found ${childFiles.rows.length} items in renamed folder:`);
        childFiles.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.is_directory ? '📁' : '📄'} ${row.filename}`);
        });
        
        // Also check a subdirectory to make sure its contents are still accessible
        const subfolderPath = `${childPath}/0006_subfolder1`;
        console.log(`\nChecking if subfolder path "${subfolderPath}" exists...`);
        
        const subfolderExists = await pgdb.query(
            'SELECT vfs_exists($1, $2, $3) as exists',
            childPath, '0006_subfolder1', testRootKey
        );
        
        console.log(`Subfolder exists: ${subfolderExists.rows[0].exists ? 'Yes' : 'No'}`);
        
        // Test a path traversal rename (moving folder to another parent)
        console.log('\n=== TESTING CROSS-DIRECTORY RENAME (MOVE) ===');
        
        const sourcePath = '0001_test-structure';
        const sourceFolder = '0003_three';
        const destPath = '0001_test-structure/0002_two';
        const destFolder = '0100_moved-three';
        
        console.log(`Moving folder: ${sourcePath}/${sourceFolder} to ${destPath}/${destFolder}`);
        
        const moveResult = await pgdb.query(
            'SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)',
            owner_id, sourcePath, sourceFolder, destPath, destFolder, testRootKey
        );
        
        console.log(`Move operation result: ${moveResult.rows[0].success ? 'Success' : 'Failed'}`);
        console.log(`Diagnostic information: ${moveResult.rows[0].diagnostic}`);
        
        // Verify that files in the moved folder are accessible
        const movedPath = `${destPath}/${destFolder}`;
        const movedFiles = await pgdb.query(
            'SELECT * FROM vfs_readdir($1, $2, $3)',
            owner_id, movedPath, testRootKey
        );
        
        console.log(`\nFound ${movedFiles.rows.length} items in moved folder:`);
        movedFiles.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.is_directory ? '📁' : '📄'} ${row.filename}`);
        });
        
        console.log('\n=== FOLDER RENAME TEST COMPLETED SUCCESSFULLY ===');
        
    } catch (error) {
        console.error('=== FOLDER RENAME TEST FAILED ===');
        console.error('Error during folder rename test:', error);
        throw error;
    }
}
