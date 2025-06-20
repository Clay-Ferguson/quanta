import pgdb from '../../PDGB.js';

const testRootKey = 'pgroot';

/**
 * Wipes all records from the fs_nodes table
 */
export async function wipeTable(): Promise<void> {
    try {
        console.log('=== WIPING fs_nodes TABLE ===');
        
        // Delete all records from the fs_nodes table
        const result = await pgdb.query('DELETE FROM fs_nodes');
        
        console.log(`Successfully wiped fs_nodes table. ${result.rowCount || 0} rows deleted.`);
        console.log('=== TABLE WIPE COMPLETED ===');
        
    } catch (error) {
        console.error('=== TABLE WIPE FAILED ===');
        console.error('Error wiping fs_nodes table:', error);
        throw error;
    }
}

/**
 * Prints the folder structure starting from the test root
 */
export async function printFolderStructure(): Promise<void> {
    try {
        console.log('\n=== FOLDER STRUCTURE VISUALIZATION ===');
        const rootPath = '/0001_test-structure';
        await printDirectoryContents(rootPath, testRootKey, 0);
        console.log('=== END FOLDER STRUCTURE ===\n');
        
    } catch (error) {
        console.error('Error printing folder structure:', error);
    }
}

/**
 * Helper function to recursively print directory contents
 */
async function printDirectoryContents(dirPath: string, rootKey: string, indentLevel: number): Promise<void> {
    const indent = '  '.repeat(indentLevel);
    
    // Get directory contents
    const dirResult = await pgdb.query(
        'SELECT * FROM pg_readdir($1, $2)',
        [dirPath, rootKey]
    );
    
    // Sort by ordinal to ensure proper order
    const sortedItems = dirResult.rows.sort((a: any, b: any) => a.ordinal - b.ordinal);
    
    for (const item of sortedItems) {
        const icon = item.is_directory ? '📁' : '📄';
        console.log(`${indent}${icon} ${item.filename}`);
        
        // If it's a directory, recursively print its contents
        if (item.is_directory) {
            const subDirPath = `${dirPath}/${item.filename}`;
            await printDirectoryContents(subDirPath, rootKey, indentLevel + 1);
        }
    }
}
