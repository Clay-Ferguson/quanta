import pgdb from '../../../../server/db/PGDB.js';
import vfs from '../VFS.js';

const testRootKey = 'usr';

/**
 * Test for the getNodeWithDescendants function in VFS.ts
 * 
 * This test creates a folder structure three levels deep with files at each level,
 * then tests the getNodeWithDescendants method to verify it retrieves all descendants correctly.
 * 
 * Structure created:
 * /test-query-nodes/
 *   ├── file1.txt
 *   ├── file2.txt
 *   ├── level1-folder1/
 *   │   ├── file3.txt
 *   │   ├── file4.txt
 *   │   └── level2-folder1/
 *   │       ├── file7.txt
 *   │       └── file8.txt
 *   └── level1-folder2/
 *       ├── file5.txt
 *       └── file6.txt
 */
export async function queryNodesTest(owner_id: number): Promise<void> {
    const testRootPath = '/test-query-nodes';
    
    try {
        console.log('=== VFS getNodeWithDescendants Test Starting ===');

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testRootPath + '%');
            
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            `, testRootKey, testRootPath);
        } catch (cleanupError) {
            console.log('Warning: Initial cleanup failed (this is usually not a problem):', cleanupError);
        }

        // === Create the folder structure ===
        
        // Create root test folder
        console.log('Creating root test folder...');
        const rootFolderResult = await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, '', testRootPath.substring(1), testRootKey, null, false, false);
        const rootFolderId = rootFolderResult.rows[0].dir_id;
        console.log(`Root test folder created with ID: ${rootFolderId}`);
        
        // Get the UUID of the root folder for querying
        const rootFolderUuidResult = await pgdb.query(`
            SELECT uuid FROM vfs_nodes WHERE id = $1
        `, rootFolderId);
        const rootFolderUuid = rootFolderUuidResult.rows[0].uuid;
        console.log(`Root test folder UUID: ${rootFolderUuid}`);

        // Create files at root level
        console.log('Creating files at root level...');
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testRootPath, 'file1.txt', 1000, false, false, 
        'Content of file1', null, false, 'text/plain', 17);
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testRootPath, 'file2.txt', 2000, false, false, 
        'Content of file2', null, false, 'text/plain', 17);
        
        console.log('Created file1.txt and file2.txt at root level');

        // Create level 1 folder 1
        console.log('Creating level 1 folders...');
        const level1Folder1Result = await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testRootPath, 'level1-folder1', testRootKey, 3000, false, false);
        const level1Folder1Id = level1Folder1Result.rows[0].dir_id;
        console.log(`Level 1 Folder 1 created with ID: ${level1Folder1Id}`);

        // Create files in level 1 folder 1
        const level1Folder1Path = `${testRootPath}/level1-folder1`;
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, level1Folder1Path, 'file3.txt', 1000, false, false, 
        'Content of file3', null, false, 'text/plain', 17);
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, level1Folder1Path, 'file4.txt', 2000, false, false, 
        'Content of file4', null, false, 'text/plain', 17);
        
        console.log('Created file3.txt and file4.txt in level1-folder1');

        // Create level 2 folder inside level 1 folder 1
        console.log('Creating level 2 folder...');
        const level2Folder1Result = await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, level1Folder1Path, 'level2-folder1', testRootKey, 3000, false, false);
        const level2Folder1Id = level2Folder1Result.rows[0].dir_id;
        console.log(`Level 2 Folder 1 created with ID: ${level2Folder1Id}`);

        // Create files in level 2 folder
        const level2Folder1Path = `${level1Folder1Path}/level2-folder1`;
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, level2Folder1Path, 'file7.txt', 1000, false, false, 
        'Content of file7', null, false, 'text/plain', 17);
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, level2Folder1Path, 'file8.txt', 2000, false, false, 
        'Content of file8', null, false, 'text/plain', 17);
        
        console.log('Created file7.txt and file8.txt in level2-folder1');

        // Create level 1 folder 2
        const level1Folder2Result = await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testRootPath, 'level1-folder2', testRootKey, 4000, false, false);
        const level1Folder2Id = level1Folder2Result.rows[0].dir_id;
        console.log(`Level 1 Folder 2 created with ID: ${level1Folder2Id}`);

        // Create files in level 1 folder 2
        const level1Folder2Path = `${testRootPath}/level1-folder2`;
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, level1Folder2Path, 'file5.txt', 1000, false, false, 
        'Content of file5', null, false, 'text/plain', 17);
        
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, level1Folder2Path, 'file6.txt', 2000, false, false, 
        'Content of file6', null, false, 'text/plain', 17);
        
        console.log('Created file5.txt and file6.txt in level1-folder2');

        console.log('✅ All folders and files created successfully');

        // === Test getNodeWithDescendants ===
        
        console.log('\nTesting getNodeWithDescendants...');
        const descendants = await vfs.getNodeWithDescendants(rootFolderUuid, testRootPath);
        
        console.log(`Retrieved ${descendants.length} nodes (including root)`);
        
        // Expected nodes:
        // 1. Root folder (test-query-nodes)
        // 2. file1.txt
        // 3. file2.txt
        // 4. level1-folder1/
        // 5. level1-folder1/file3.txt
        // 6. level1-folder1/file4.txt
        // 7. level1-folder1/level2-folder1/
        // 8. level1-folder1/level2-folder1/file7.txt
        // 9. level1-folder1/level2-folder1/file8.txt
        // 10. level1-folder2/
        // 11. level1-folder2/file5.txt
        // 12. level1-folder2/file6.txt
        // Total: 12 nodes
        
        const expectedNodeCount = 12;
        if (descendants.length !== expectedNodeCount) {
            console.error(`❌ Expected ${expectedNodeCount} nodes but got ${descendants.length}`);
            console.log('Retrieved nodes:');
            descendants.forEach((node: any, index: number) => {
                console.log(`  ${index + 1}. ${node.parent_path}/${node.filename} (${node.is_directory ? 'DIR' : 'FILE'})`);
            });
            throw new Error(`Node count mismatch! Expected: ${expectedNodeCount}, Got: ${descendants.length}`);
        }
        
        console.log('✅ Correct number of nodes retrieved');

        // Verify all expected files are present
        const expectedFiles = [
            'file1.txt', 'file2.txt', 'file3.txt', 'file4.txt', 
            'file5.txt', 'file6.txt', 'file7.txt', 'file8.txt'
        ];
        
        const retrievedFilenames = descendants
            .filter((node: any) => !node.is_directory)
            .map((node: any) => node.filename);
        
        console.log(`\nVerifying all expected files are present...`);
        for (const expectedFile of expectedFiles) {
            if (!retrievedFilenames.includes(expectedFile)) {
                throw new Error(`Missing expected file: ${expectedFile}`);
            }
        }
        console.log('✅ All expected files are present');

        // Verify all expected folders are present
        const expectedFolders = [
            'test-query-nodes', 'level1-folder1', 'level2-folder1', 'level1-folder2'
        ];
        
        const retrievedFoldernames = descendants
            .filter((node: any) => node.is_directory)
            .map((node: any) => node.filename);
        
        console.log(`\nVerifying all expected folders are present...`);
        for (const expectedFolder of expectedFolders) {
            if (!retrievedFoldernames.includes(expectedFolder)) {
                throw new Error(`Missing expected folder: ${expectedFolder}`);
            }
        }
        console.log('✅ All expected folders are present');

        // Verify hierarchical structure by checking parent_path values
        console.log(`\nVerifying hierarchical structure...`);
        
        // Find level2-folder1 node
        const level2Node = descendants.find((node: any) => 
            node.filename === 'level2-folder1' && node.is_directory
        );
        if (!level2Node) {
            throw new Error('level2-folder1 not found in descendants');
        }
        
        // Verify it has the correct parent path
        const expectedLevel2ParentPath = `${testRootPath}/level1-folder1`;
        if (level2Node.parent_path !== expectedLevel2ParentPath) {
            throw new Error(`Level 2 folder has incorrect parent_path. Expected: ${expectedLevel2ParentPath}, Got: ${level2Node.parent_path}`);
        }
        console.log('✅ Hierarchical structure is correct');

        // Verify files in level 2 folder have correct parent path
        const level2Files = descendants.filter((node: any) => 
            !node.is_directory && 
            node.parent_path === `${testRootPath}/level1-folder1/level2-folder1`
        );
        
        if (level2Files.length !== 2) {
            throw new Error(`Expected 2 files in level2-folder1, got ${level2Files.length}`);
        }
        
        const level2Filenames = level2Files.map((node: any) => node.filename).sort();
        const expectedLevel2Filenames = ['file7.txt', 'file8.txt'].sort();
        
        if (JSON.stringify(level2Filenames) !== JSON.stringify(expectedLevel2Filenames)) {
            throw new Error(`Level 2 files mismatch. Expected: ${expectedLevel2Filenames}, Got: ${level2Filenames}`);
        }
        console.log('✅ Level 2 files have correct parent paths');

        // Display the complete structure for verification
        console.log('\nComplete retrieved structure:');
        const sortedDescendants = descendants.sort((a: any, b: any) => {
            const pathA = `${a.parent_path}/${a.filename}`;
            const pathB = `${b.parent_path}/${b.filename}`;
            return pathA.localeCompare(pathB);
        });
        
        sortedDescendants.forEach((node: any) => {
            const type = node.is_directory ? '[DIR]' : '[FILE]';
            const fullPath = `${node.parent_path}/${node.filename}`;
            console.log(`  ${type} ${fullPath}`);
        });

        console.log('\n✅ ALL TESTS PASSED - getNodeWithDescendants is working correctly');

        // Clean up test data
        console.log('\nCleaning up test data...');
        await pgdb.query(`
            DELETE FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path LIKE $2
        `, testRootKey, testRootPath + '%');
        
        await pgdb.query(`
            DELETE FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testRootPath);
        
        console.log('✅ Test data cleaned up successfully');

    } catch (error) {
        console.error('❌ queryNodesTest FAILED:', error);
        
        // Attempt cleanup even on failure
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testRootPath + '%');
            
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            `, testRootKey, testRootPath);
        } catch (cleanupError) {
            console.error('Warning: Cleanup after test failure failed:', cleanupError);
        }
        
        throw error;
    }
}
