import pgdb from '../../../../PDGB.js';

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
        let output = '\n=== FOLDER STRUCTURE VISUALIZATION ===\n';
        const rootPath = '/0001_test-structure';
        output += await buildDirectoryContents(rootPath, testRootKey, 0);
        output += '=== END FOLDER STRUCTURE ===\n';
        
        console.log(output);
        
    } catch (error) {
        console.error('Error printing folder structure:', error);
    }
}

/**
 * Helper function to recursively build directory contents string
 */
async function buildDirectoryContents(dirPath: string, rootKey: string, indentLevel: number): Promise<string> {
    const indent = '  '.repeat(indentLevel);
    let output = '';
    
    // Get directory contents
    const dirResult = await pgdb.query(
        'SELECT * FROM pg_readdir($1, $2)',
        [dirPath, rootKey]
    );
    
    // Sort by ordinal to ensure proper order
    const sortedItems = dirResult.rows.sort((a: any, b: any) => a.ordinal - b.ordinal);
    
    for (const item of sortedItems) {
        const icon = item.is_directory ? '📁' : '📄';
        output += `${indent}${icon} ${item.filename}\n`;
        
        // If it's a directory, recursively build its contents
        if (item.is_directory) {
            const subDirPath = `${dirPath}/${item.filename}`;
            output += await buildDirectoryContents(subDirPath, rootKey, indentLevel + 1);
        }
    }
    
    return output;
}

/**
 * Tests ordinal operations including getting max ordinal, getting ordinal from name,
 * inserting files at specific ordinals, and manual ordinal shifting
 */
export async function testOrdinalOperations(): Promise<void> {
    try {
        console.log('\n=== TESTING ORDINAL OPERATIONS ===');        
        const testPath = '/0001_test-structure/0001_one';  // Test inside one of our existing folders
        
        console.log('1. Testing pg_get_max_ordinal...');
        const maxOrdinalResult = await pgdb.query(
            'SELECT pg_get_max_ordinal($1, $2) as max_ordinal',
            [testPath, testRootKey]
        );
        const currentMaxOrdinal = maxOrdinalResult.rows[0].max_ordinal;
        console.log(`   Current max ordinal in ${testPath}: ${currentMaxOrdinal}`);
        
        console.log('2. Testing pg_get_ordinal_from_name...');
        const ordinalFromNameResult = await pgdb.query(
            'SELECT pg_get_ordinal_from_name($1, $2, $3) as ordinal',
            ['0003_file3.md', testPath, testRootKey]
        );
        console.log(`   Ordinal of '0003_file3.md': ${ordinalFromNameResult.rows[0].ordinal}`);
        
        console.log('3. Testing file insertion at specific ordinal (position 3)...');
        // This should shift files 0003_file3.md and above down by one position
        const insertResult = await pgdb.query(
            'SELECT pg_insert_file_at_ordinal($1, $2, $3, $4, $5, $6, $7) as file_id',
            [
                testPath, 
                '0003_inserted-file.md', 
                3, 
                testRootKey, 
                false, 
                Buffer.from('# Inserted File\n\nThis file was inserted at ordinal position 3.'),
                'text/markdown'
            ]
        );
        console.log(`   Inserted file with ID: ${insertResult.rows[0].file_id}`);
        
        console.log('4. Verifying ordinal shifting occurred...');
        const afterInsertContents = await pgdb.query(
            'SELECT * FROM pg_readdir($1, $2)',
            [testPath, testRootKey]
        );
        
        console.log(`   Contents after insertion (${afterInsertContents.rows.length} items):`);
        const sortedItems = afterInsertContents.rows.sort((a: any, b: any) => a.ordinal - b.ordinal);
        sortedItems.forEach((item: any) => {
            console.log(`     ${item.ordinal}: ${item.filename} (${item.is_directory ? 'folder' : 'file'})`);
        });
        
        console.log('5. Testing manual ordinal shifting...');
        // Create a test file to shift
        await pgdb.query(
            'SELECT pg_write_text_file($1, $2, $3, $4, $5)',
            [testPath, '0020_temp-file.md', 'Temporary file', testRootKey, 'text/markdown']
        );
        
        // Now shift ordinals down from position 8
        const shiftResult = await pgdb.query(
            'SELECT * FROM pg_shift_ordinals_down($1, $2, $3, $4)',
            [2, testPath, 8, testRootKey]  // Add 2 slots starting at ordinal 8
        );
        
        console.log(`   Shifted ${shiftResult.rows.length} files:`);
        shiftResult.rows.forEach((row: any) => {
            console.log(`     ${row.old_filename} (ordinal ${row.old_ordinal}) -> ${row.new_filename} (ordinal ${row.new_ordinal})`);
        });
        
        console.log('6. Testing final max ordinal after operations...');
        const finalMaxResult = await pgdb.query(
            'SELECT pg_get_max_ordinal($1, $2) as max_ordinal',
            [testPath, testRootKey]
        );
        console.log(`   Final max ordinal: ${finalMaxResult.rows[0].max_ordinal}`);
        
        console.log('=== ORDINAL OPERATIONS TEST COMPLETED ===\n');
        
    } catch (error) {
        console.error('=== ORDINAL OPERATIONS TEST FAILED ===');
        console.error('Error during ordinal operations test:', error);
        throw error;
    }
}

/** 
 * Creates the following folder structure:
📁 0001_one
  📄 0001_file1.md
  📄 0002_file2.md
  📄 0003_file3.md
  📄 0004_file4.md
  📄 0005_file5.md
  📁 0006_subfolder1
  📁 0007_subfolder2
  📁 0008_subfolder3
  📁 0009_subfolder4
  📁 0010_subfolder5
📁 0002_two
  📄 0001_file1.md
  📄 0002_file2.md
  📄 0003_file3.md
  📄 0004_file4.md
  📄 0005_file5.md
  📁 0006_subfolder1
  📁 0007_subfolder2
  📁 0008_subfolder3
  📁 0009_subfolder4
  📁 0010_subfolder5
📁 0003_three
  📄 0001_file1.md
  📄 0002_file2.md
  📄 0003_file3.md
  📄 0004_file4.md
  📄 0005_file5.md
  📁 0006_subfolder1
  📁 0007_subfolder2
  📁 0008_subfolder3
  📁 0009_subfolder4
  📁 0010_subfolder5
📁 0004_four
  📄 0001_file1.md
  📄 0002_file2.md
  📄 0003_file3.md
  📄 0004_file4.md
  📄 0005_file5.md
  📁 0006_subfolder1
  📁 0007_subfolder2
  📁 0008_subfolder3
  📁 0009_subfolder4
  📁 0010_subfolder5
📁 0005_five
  📄 0001_file1.md
  📄 0002_file2.md
  📄 0003_file3.md
  📄 0004_file4.md
  📄 0005_file5.md
  📁 0006_subfolder1
  📁 0007_subfolder2
  📁 0008_subfolder3
  📁 0009_subfolder4
  📁 0010_subfolder5
*/
export async function createFolderStructureTest(): Promise<void> {
    try {
        console.log('=== PGDB Folder Structure Test Starting ===');
        const rootPath = '/0001_test-structure';
        
        // First, ensure the root directory structure exists
        console.log('Creating root path...');
        await pgdb.query('SELECT pg_ensure_path($1, $2)', [rootPath, testRootKey]);

        // Create 5 root-level folders
        console.log('Creating 5 root-level folders...');
        const rootFolders = ['one', 'two', 'three', 'four', 'five'];
        
        for (let i = 0; i < rootFolders.length; i++) {
            const folderName = rootFolders[i];
            const ordinalPrefix = (i + 1).toString().padStart(4, '0');
            const fullFolderName = `${ordinalPrefix}_${folderName}`;
            
            console.log(`Creating root folder: ${fullFolderName}`);
            await pgdb.query(
                'SELECT pg_mkdir($1, $2, $3, $4) as folder_id',
                [rootPath, fullFolderName, testRootKey, false]
            );
            
            // Now create contents inside this folder
            const currentFolderPath = `${rootPath}/${fullFolderName}`;
            
            console.log(`Creating 5 files in ${fullFolderName}...`);
            // Create 5 files in this folder
            for (let j = 1; j <= 5; j++) {
                const fileOrdinal = j.toString().padStart(4, '0');
                const fileName = `${fileOrdinal}_file${j}.md`;
                const fileContent = Buffer.from(`# File ${j} in ${folderName}\n\nThis is test file ${j} inside folder ${folderName}.`);
                
                await pgdb.query(
                    'SELECT pg_write_text_file($1, $2, $3, $4, $5) as file_id',
                    [currentFolderPath, fileName, fileContent.toString('utf8'), testRootKey, 'text/markdown']
                );
            }
            
            console.log(`Creating 5 subfolders in ${fullFolderName}...`);
            // Create 5 subfolders in this folder
            for (let k = 6; k <= 10; k++) { // Start at 6 to avoid conflicts with files
                const subfolderOrdinal = k.toString().padStart(4, '0');
                const subfolderName = `${subfolderOrdinal}_subfolder${k - 5}`;
                
                await pgdb.query(
                    'SELECT pg_mkdir($1, $2, $3, $4) as subfolder_id',
                    [currentFolderPath, subfolderName, testRootKey, false]
                );
            }
        }

        // Test the structure by listing contents
        console.log('Verifying folder structure...');
        
        // List root directory
        const rootDirResult = await pgdb.query(
            'SELECT * FROM pg_readdir($1, $2)',
            [rootPath, testRootKey]
        );
        
        console.log(`Root directory contains ${rootDirResult.rows.length} items:`);
        for (const row of rootDirResult.rows) {
            console.log(`  - ${row.filename} (${row.is_directory ? 'folder' : 'file'}, ordinal: ${row.ordinal})`);
            
            // If it's a directory, list its contents too
            if (row.is_directory) {
                const subDirPath = `${rootPath}/${row.filename}`;
                const subDirResult = await pgdb.query(
                    'SELECT * FROM pg_readdir($1, $2)',
                    [subDirPath, testRootKey]
                );
                
                console.log(`    ${row.filename} contains ${subDirResult.rows.length} items:`);
                for (const subRow of subDirResult.rows) {
                    console.log(`      - ${subRow.filename} (${subRow.is_directory ? 'folder' : 'file'}, ordinal: ${subRow.ordinal})`);
                }
            }
        }

        // Test ordinal functions
        console.log('Testing ordinal functions...');
        const maxOrdinal = await pgdb.query(
            'SELECT pg_get_max_ordinal($1, $2) as max_ordinal',
            [rootPath, testRootKey]
        );
        console.log(`Maximum ordinal in root: ${maxOrdinal.rows[0].max_ordinal}`);

        // Test getting ordinal from a specific filename
        const ordinalResult = await pgdb.query(
            'SELECT pg_get_ordinal_from_name($1, $2, $3) as ordinal',
            ['0003_three', rootPath, testRootKey]
        );
        console.log(`Ordinal of '0003_three': ${ordinalResult.rows[0].ordinal}`);

        console.log('=== PGDB Folder Structure Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== PGDB Folder Structure Test Failed ===');
        console.error('Error during PGDB folder structure test:', error);
        throw error;
    }
}
