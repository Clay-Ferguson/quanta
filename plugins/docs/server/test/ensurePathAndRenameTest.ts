import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function ensurePathAndRenameTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-ensure-path-rename';
    const randomSuffix = Math.floor(Math.random() * 10000);
    
    try {
        console.log('=== VFS Ensure Path and Rename Test Starting ===');

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Initial cleanup failed (this is usually not a problem):', cleanupError);
        }
        
        // Test 1: Use vfs_ensure_path to create a random nested directory structure
        const randomPath = `level1-${randomSuffix}/level2-${randomSuffix}/level3-${randomSuffix}`;
        const fullRandomPath = testParentPath + '/' + randomPath;

        console.log(`Testing vfs_ensure_path for nested path: ${fullRandomPath}`);
        
        const ensurePathResult = await pgdb.query(`
            SELECT vfs_ensure_path($1, $2, $3) as path_created
        `, owner_id, fullRandomPath, testRootKey);
        
        const pathCreated = ensurePathResult.rows[0].path_created;
        console.log(`vfs_ensure_path returned: ${pathCreated}`);
        
        if (pathCreated !== true) {
            throw new Error(`Expected true from vfs_ensure_path, got: ${pathCreated}`);
        }

        console.log('✅ Path creation test passed');

        // Test 2: Verify that all intermediate directories were created
        console.log('Verifying that all intermediate directories were created...');
        
        const expectedPaths = [
            { parent_path: testParentPath, filename: `level1-${randomSuffix}` },
            { parent_path: testParentPath + `/level1-${randomSuffix}`, filename: `level2-${randomSuffix}` },
            { parent_path: testParentPath + `/level1-${randomSuffix}/level2-${randomSuffix}`, filename: `level3-${randomSuffix}` }
        ];
        
        for (const expectedPath of expectedPaths) {
            const existsResult = await pgdb.query(`
                SELECT vfs_exists($1, $2, $3) as dir_exists
            `, expectedPath.parent_path, expectedPath.filename, testRootKey);
            
            const dirExists = existsResult.rows[0].dir_exists;
            console.log(`Directory ${expectedPath.parent_path}/${expectedPath.filename} exists: ${dirExists}`);
            
            if (dirExists !== true) {
                throw new Error(`Expected directory to exist: ${expectedPath.parent_path}/${expectedPath.filename}`);
            }
        }

        console.log('✅ All intermediate directories verification test passed');

        // Test 3: Test renaming a directory using vfs_rename
        const oldDirName = `level3-${randomSuffix}`;
        const newDirName = `level3-renamed-${randomSuffix}`;
        const oldDirParentPath = testParentPath + `/level1-${randomSuffix}/level2-${randomSuffix}`;
        
        console.log(`Testing vfs_rename for directory: ${oldDirParentPath}/${oldDirName} -> ${oldDirParentPath}/${newDirName}`);
        
        const renameResult = await pgdb.query(`
            SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)
        `, owner_id, oldDirParentPath, oldDirName, oldDirParentPath, newDirName, testRootKey);
        
        const renameSuccess = renameResult.rows[0].success;
        const renameDiagnostic = renameResult.rows[0].diagnostic;
        
        console.log(`Rename result - success: ${renameSuccess}, diagnostic: ${renameDiagnostic}`);
        
        if (renameSuccess !== true) {
            throw new Error(`Expected successful rename, got: ${renameSuccess}. Diagnostic: ${renameDiagnostic}`);
        }

        console.log('✅ Directory rename test passed');

        // Test 4: Verify the old directory name no longer exists and new name exists
        console.log('Verifying rename effects...');
        
        const oldNameExists = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as exists
        `, oldDirParentPath, oldDirName, testRootKey);
        
        const newNameExists = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as exists
        `, oldDirParentPath, newDirName, testRootKey);
        
        console.log(`Old name exists: ${oldNameExists.rows[0].exists}`);
        console.log(`New name exists: ${newNameExists.rows[0].exists}`);
        
        if (oldNameExists.rows[0].exists !== false) {
            throw new Error(`Expected old directory name to not exist after rename`);
        }
        
        if (newNameExists.rows[0].exists !== true) {
            throw new Error(`Expected new directory name to exist after rename`);
        }

        console.log('✅ Rename verification test passed');

        console.log('=== VFS Ensure Path and Rename Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Ensure Path and Rename Test Failed ===');
        console.error('Error during VFS ensure path and rename test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}
