import pgdb from '../../../../../server/PGDB.js';
import { resetTestEnvironment } from './VFSTest.js';

const testRootKey = 'usr';

/** 
 * Tests that we can set the `is_public` property of `vfs_nodes`
 * 
📁 0001_test-structure
  📁 0001_one
    📄 0001_file1.md
    📄 0002_file2.md
    📄 0003_file3.md
    📁 0004_subfolder1
    📁 0005_subfolder2
    📁 0006_subfolder3
  📁 0002_two
    📄 0001_file1.md
    📄 0002_file2.md
    📄 0003_file3.md
    📁 0004_subfolder1
    📁 0005_subfolder2
    📁 0006_subfolder3
  📁 0003_three
    📄 0001_file1.md
    📄 0002_file2.md
    📄 0003_file3.md
    📁 0004_subfolder1
    📁 0005_subfolder2
    📁 0006_subfolder3
*/
export async function pgdbTestSetFolderPublic(owner_id: number): Promise<void> {
    try {
        await resetTestEnvironment();
        console.log('=== FOLDER PUBLIC VISIBILITY TEST Starting ===');
        
        // Test 1: Set a single file to public
        await testSetSingleFilePublic(owner_id);
        
        // Test 2: Set a folder to public non-recursively
        await testSetFolderPublicNonRecursive(owner_id);
        
        // Test 3: Set a folder to public recursively
        await testSetFolderPublicRecursive(owner_id);
        
        // Test 4: Test with root level folder (empty parent path)
        await testSetRootFolderPublic(owner_id);
        
        console.log('=== FOLDER PUBLIC VISIBILITY TEST COMPLETED SUCCESSFULLY ===\n');
        
    } catch (error) {
        console.error('=== FOLDER PUBLIC VISIBILITY TEST FAILED ===');
        console.error('Error during visibility test:', error);
        throw error;
    }
}

/**
 * Test setting a single file to public
 */
async function testSetSingleFilePublic(owner_id: number): Promise<void> {
    console.log('\n1. Testing setting a single file to public...');
    
    const filePath = '0001_test-structure/0001_one';
    const fileName = '0001_file1.md';
    
    // First, check the current public status
    const beforeResult = await pgdb.query(
        'SELECT id, is_public FROM vfs_nodes WHERE parent_path = $1 AND filename = $2 AND doc_root_key = $3',
        filePath, fileName, testRootKey
    );
    
    if (beforeResult.rows.length === 0) {
        console.error(`❌ File ${fileName} not found in path ${filePath}!`);
        return;
    }
    
    console.log(`   Before: ${fileName} is_public = ${beforeResult.rows[0].is_public}`);
    
    // Set the file to public
    const setPublicResult = await pgdb.query(
        'SELECT * FROM vfs_set_public($1, $2, $3, $4, $5, $6)',
        owner_id, filePath, fileName, true, false, testRootKey
    );
    
    console.log(`   Result: ${setPublicResult.rows[0].success ? 'Success' : 'Failed'} - ${setPublicResult.rows[0].diagnostic}`);
    
    // Verify the change
    const afterResult = await pgdb.query(
        'SELECT id, is_public FROM vfs_nodes WHERE parent_path = $1 AND filename = $2 AND doc_root_key = $3',
        filePath, fileName, testRootKey
    );
    
    console.log(`   After: ${fileName} is_public = ${afterResult.rows[0].is_public}`);
    
    if (afterResult.rows[0].is_public !== true) {
        throw new Error(`Failed to set ${fileName} to public!`);
    }
    
    // Now set it back to private
    const setPrivateResult = await pgdb.query(
        'SELECT * FROM vfs_set_public($1, $2, $3, $4, $5, $6)',
        owner_id, filePath, fileName, false, false, testRootKey
    );
    
    console.log(`   Set back to private: ${setPrivateResult.rows[0].success ? 'Success' : 'Failed'}`);
    
    // Verify it's back to private
    const finalResult = await pgdb.query(
        'SELECT id, is_public FROM vfs_nodes WHERE parent_path = $1 AND filename = $2 AND doc_root_key = $3',
        filePath, fileName, testRootKey
    );
    
    console.log(`   Final state: ${fileName} is_public = ${finalResult.rows[0].is_public}`);
    
    if (finalResult.rows[0].is_public !== false) {
        throw new Error(`Failed to set ${fileName} back to private!`);
    }
    
    console.log('   ✅ Single file visibility test passed!');
}

/**
 * Test setting a folder to public non-recursively
 */
async function testSetFolderPublicNonRecursive(owner_id: number): Promise<void> {
    console.log('\n2. Testing setting a folder to public non-recursively...');
    
    const folderPath = '0001_test-structure';
    const folderName = '0002_two';
    
    // First, get the current state of the folder
    const beforeFolderResult = await pgdb.query(
        'SELECT id, is_public FROM vfs_nodes WHERE parent_path = $1 AND filename = $2 AND doc_root_key = $3',
        folderPath, folderName, testRootKey
    );
    
    if (beforeFolderResult.rows.length === 0) {
        console.error(`❌ Folder ${folderName} not found in path ${folderPath}!`);
        return;
    }
    
    console.log(`   Before: Folder ${folderName} is_public = ${beforeFolderResult.rows[0].is_public}`);
    
    // Get the state of some child items to verify they don't change
    const childPath = `${folderPath}/${folderName}`;
    const beforeChildrenResult = await pgdb.query(
        'SELECT id, filename, is_public FROM vfs_nodes WHERE parent_path = $1 AND doc_root_key = $2 LIMIT 3',
        childPath, testRootKey
    );
    
    console.log('   Current state of first 3 children:');
    beforeChildrenResult.rows.forEach((row: any) => {
        console.log(`   - ${row.filename} is_public = ${row.is_public}`);
    });
    
    // Set the folder to public NON-recursively
    const setPublicResult = await pgdb.query(
        'SELECT * FROM vfs_set_public($1, $2, $3, $4, $5, $6)',
        owner_id, folderPath, folderName, true, false, testRootKey
    );
    
    console.log(`   Result: ${setPublicResult.rows[0].success ? 'Success' : 'Failed'} - ${setPublicResult.rows[0].diagnostic}`);
    
    // Verify the folder changed
    const afterFolderResult = await pgdb.query(
        'SELECT id, is_public FROM vfs_nodes WHERE parent_path = $1 AND filename = $2 AND doc_root_key = $3',
        folderPath, folderName, testRootKey
    );
    
    console.log(`   After: Folder ${folderName} is_public = ${afterFolderResult.rows[0].is_public}`);
    
    if (afterFolderResult.rows[0].is_public !== true) {
        throw new Error(`Failed to set folder ${folderName} to public!`);
    }
    
    // Verify children did NOT change
    const afterChildrenResult = await pgdb.query(
        'SELECT id, filename, is_public FROM vfs_nodes WHERE parent_path = $1 AND doc_root_key = $2 LIMIT 3',
        childPath, testRootKey
    );
    
    console.log('   State of first 3 children after non-recursive update:');
    
    let childrenChanged = false;
    afterChildrenResult.rows.forEach((row: any, i: number) => {
        const beforeChild = beforeChildrenResult.rows[i];
        console.log(`   - ${row.filename} is_public = ${row.is_public}`);
        if (row.is_public !== beforeChild.is_public) {
            childrenChanged = true;
        }
    });
    
    if (childrenChanged) {
        throw new Error('Children visibility changed when using non-recursive option!');
    } else {
        console.log('   ✅ Children remained unchanged as expected!');
    }
    
    // Reset the folder back to private
    const resetResult = await pgdb.query(
        'SELECT * FROM vfs_set_public($1, $2, $3, $4, $5, $6)',
        owner_id, folderPath, folderName, false, false, testRootKey
    );
    
    console.log(`   Reset folder to private: ${resetResult.rows[0].success ? 'Success' : 'Failed'}`);
    console.log('   ✅ Non-recursive folder visibility test passed!');
}

/**
 * Test setting a folder to public recursively
 */
async function testSetFolderPublicRecursive(owner_id: number): Promise<void> {
    console.log('\n3. Testing setting a folder to public recursively...');
    
    const folderPath = '0001_test-structure';
    const folderName = '0003_three';
    
    // First, get the current state of the folder
    const beforeFolderResult = await pgdb.query(
        'SELECT id, is_public FROM vfs_nodes WHERE parent_path = $1 AND filename = $2 AND doc_root_key = $3',
        folderPath, folderName, testRootKey
    );
    
    if (beforeFolderResult.rows.length === 0) {
        console.error(`❌ Folder ${folderName} not found in path ${folderPath}!`);
        return;
    }
    
    console.log(`   Before: Folder ${folderName} is_public = ${beforeFolderResult.rows[0].is_public}`);
    
    // Get the state of child items to verify they will change
    const childPath = `${folderPath}/${folderName}`;
    const beforeChildrenResult = await pgdb.query(
        'SELECT parent_path, filename, is_public FROM vfs_nodes WHERE parent_path = $1 AND doc_root_key = $2',
        childPath, testRootKey
    );
    
    console.log(`   Before: Found ${beforeChildrenResult.rows.length} children, all with is_public = ${beforeChildrenResult.rows[0].is_public}`);
    
    // Count descendants to verify they'll all be updated
    const countDescendantsResult = await pgdb.query(`
    SELECT COUNT(*) AS count FROM vfs_nodes 
    WHERE (parent_path = $1 OR parent_path LIKE $2) 
    AND doc_root_key = $3`,
    childPath, childPath + '/%', testRootKey
    );
    
    const totalDescendants = parseInt(countDescendantsResult.rows[0].count);
    console.log(`   Total descendants to update: ${totalDescendants}`);
    
    // Set the folder to public RECURSIVELY
    const setPublicResult = await pgdb.query(
        'SELECT * FROM vfs_set_public($1, $2, $3, $4, $5, $6)',
        owner_id, folderPath, folderName, true, true, testRootKey
    );
    
    console.log(`   Result: ${setPublicResult.rows[0].success ? 'Success' : 'Failed'} - ${setPublicResult.rows[0].diagnostic}`);
    
    // Verify the folder changed
    const afterFolderResult = await pgdb.query(
        'SELECT id, is_public FROM vfs_nodes WHERE parent_path = $1 AND filename = $2 AND doc_root_key = $3',
        folderPath, folderName, testRootKey
    );
    
    console.log(`   After: Folder ${folderName} is_public = ${afterFolderResult.rows[0].is_public}`);
    
    if (afterFolderResult.rows[0].is_public !== true) {
        throw new Error(`Failed to set folder ${folderName} to public!`);
    }
    
    // Verify all children changed
    const afterChildrenResult = await pgdb.query(
        'SELECT COUNT(*) AS count FROM vfs_nodes WHERE (parent_path = $1 OR parent_path LIKE $2) AND is_public = true AND doc_root_key = $3',
        childPath, childPath + '/%', testRootKey
    );
    
    const totalPublicDescendants = parseInt(afterChildrenResult.rows[0].count);
    console.log(`   Public descendants after update: ${totalPublicDescendants} of ${totalDescendants}`);
    
    if (totalPublicDescendants !== totalDescendants) {
        throw new Error('Not all descendants were made public!');
    }
    
    // Reset the folder and all children back to private
    const resetResult = await pgdb.query(
        'SELECT * FROM vfs_set_public($1, $2, $3, $4, $5, $6)',
        owner_id, folderPath, folderName, false, true, testRootKey
    );
    
    console.log(`   Reset folder recursively to private: ${resetResult.rows[0].success ? 'Success' : 'Failed'}`);
    
    // Verify all children are private again
    const finalChildrenResult = await pgdb.query(
        'SELECT COUNT(*) AS count FROM vfs_nodes WHERE (parent_path = $1 OR parent_path LIKE $2) AND is_public = false AND doc_root_key = $3',
        childPath, childPath + '/%', testRootKey
    );
    
    const totalPrivateDescendants = parseInt(finalChildrenResult.rows[0].count);
    console.log(`   Private descendants after reset: ${totalPrivateDescendants} of ${totalDescendants}`);
    
    if (totalPrivateDescendants !== totalDescendants) {
        throw new Error('Not all descendants were reset to private!');
    }
    
    console.log('   ✅ Recursive folder visibility test passed!');
}

/**
 * Test setting a root level folder to public (both recursively and non-recursively)
 * This specifically tests the case where the parent path is an empty string ('')
 */
async function testSetRootFolderPublic(owner_id: number): Promise<void> {
    console.log('\n4. Testing setting a root-level folder to public...');
    
    // For this test, we'll use the main test structure folder that's in the root
    const folderPath = ''; // Empty string for root path
    const folderName = '0001_test-structure';
    
    // First, get the current state of the folder
    const beforeFolderResult = await pgdb.query(
        'SELECT id, is_public FROM vfs_nodes WHERE parent_path = $1 AND filename = $2 AND doc_root_key = $3',
        folderPath, folderName, testRootKey
    );
    
    if (beforeFolderResult.rows.length === 0) {
        console.error(`❌ Folder ${folderName} not found in root path!`);
        return;
    }
    
    console.log(`   Before: Root folder ${folderName} is_public = ${beforeFolderResult.rows[0].is_public}`);
    
    // First test: Set to public non-recursively
    console.log('   Testing non-recursive public setting for root folder...');
    
    // Make non-recursive change
    const setPublicNonRecResult = await pgdb.query(
        'SELECT * FROM vfs_set_public($1, $2, $3, $4, $5, $6)',
        owner_id, folderPath, folderName, true, false, testRootKey
    );
    
    console.log(`   Result: ${setPublicNonRecResult.rows[0].success ? 'Success' : 'Failed'} - ${setPublicNonRecResult.rows[0].diagnostic}`);
    
    // Verify the folder changed
    const afterNonRecResult = await pgdb.query(
        'SELECT id, is_public FROM vfs_nodes WHERE parent_path = $1 AND filename = $2 AND doc_root_key = $3',
        folderPath, folderName, testRootKey
    );
    
    console.log(`   After non-recursive: Root folder ${folderName} is_public = ${afterNonRecResult.rows[0].is_public}`);
    
    if (afterNonRecResult.rows[0].is_public !== true) {
        throw new Error(`Failed to set root folder ${folderName} to public!`);
    }
    
    // Check that children didn't change
    const childPath = `/${folderName}`;
    const childrenAfterNonRec = await pgdb.query(
        'SELECT COUNT(*) as total, SUM(CASE WHEN is_public = true THEN 1 ELSE 0 END) as public_count FROM vfs_nodes ' +
        'WHERE parent_path = $1 AND doc_root_key = $2',
        childPath, testRootKey
    );
    
    const totalChildren = parseInt(childrenAfterNonRec.rows[0].total);
    const publicChildren = parseInt(childrenAfterNonRec.rows[0].public_count) || 0;
    
    console.log(`   Children state after non-recursive update: ${publicChildren} public out of ${totalChildren} total`);
    
    if (publicChildren > 0 && publicChildren === totalChildren) {
        console.warn('⚠️ All children were made public when they should not have been!');
    }
    
    // Now test recursive setting to private (reset plus test recursive operation)
    console.log('   Testing recursive setting to private for root folder...');
    
    // Count all descendants before change
    const countAllDescendants = await pgdb.query(
        'SELECT COUNT(*) AS count FROM vfs_nodes ' +
        'WHERE (parent_path = $1 OR parent_path LIKE $2) AND doc_root_key = $3',
        childPath, childPath + '/%', testRootKey
    );
    
    const totalDescendants = parseInt(countAllDescendants.rows[0].count);
    
    // Make recursive change back to private
    const setPrivateRecResult = await pgdb.query(
        'SELECT * FROM vfs_set_public($1, $2, $3, $4, $5, $6)',
        owner_id, folderPath, folderName, false, true, testRootKey
    );
    
    console.log(`   Result: ${setPrivateRecResult.rows[0].success ? 'Success' : 'Failed'} - ${setPrivateRecResult.rows[0].diagnostic}`);
    
    // Verify the folder changed
    const afterRecResult = await pgdb.query(
        'SELECT id, is_public FROM vfs_nodes WHERE parent_path = $1 AND filename = $2 AND doc_root_key = $3',
        folderPath, folderName, testRootKey
    );
    
    console.log(`   After recursive: Root folder ${folderName} is_public = ${afterRecResult.rows[0].is_public}`);
    
    // Verify all descendants changed
    const descendantsAfterRec = await pgdb.query(
        'SELECT COUNT(*) as private_count FROM vfs_nodes ' +
        'WHERE (parent_path = $1 OR parent_path LIKE $2) AND is_public = false AND doc_root_key = $3',
        childPath, childPath + '/%', testRootKey
    );
    
    const privateDescendants = parseInt(descendantsAfterRec.rows[0].private_count);
    
    console.log(`   Descendants state after recursive update: ${privateDescendants} private out of ${totalDescendants} total`);
    
    if (privateDescendants !== totalDescendants) {
        throw new Error(`Not all descendants were set to private! ${privateDescendants} out of ${totalDescendants}`);
    }
    
    if (afterRecResult.rows[0].is_public !== false) {
        throw new Error(`Failed to set root folder ${folderName} back to private!`);
    }
    
    console.log('   ✅ Root folder visibility tests passed!');
}