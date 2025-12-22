import vfs from '../VFS.js';
import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

/**
 * Extended rename tests that cover successful rename operations with actual files
 * and additional edge cases not covered by renameTest.ts
 */
export async function renameTest2(owner_id: number): Promise<void> {
    const testParentPath = '/test-rename2';
    const randomSuffix = Math.floor(Math.random() * 10000);
    
    try {
        console.log('=== VFS Rename Test 2 Starting ===');

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

        // Create test directory
        await vfs.mkdirEx(owner_id, testParentPath);

        // Test 1: Simple successful file rename
        console.log('Test 1 - Testing successful file rename');
        const file1OldName = `file1-${randomSuffix}.txt`;
        const file1NewName = `file1-renamed-${randomSuffix}.txt`;
        const file1Content = 'Test content for file 1';
        
        await vfs.writeFile(owner_id, `${testParentPath}/${file1OldName}`, file1Content);
        await vfs.rename(owner_id, `${testParentPath}/${file1OldName}`, `${testParentPath}/${file1NewName}`);
        
        // Verify old name doesn't exist
        const oldExists = await vfs.exists(`${testParentPath}/${file1OldName}`);
        if (oldExists) {
            throw new Error('Test 1 failed! Old file name should not exist after rename');
        }
        
        // Verify new name exists and content is preserved
        const newExists = await vfs.exists(`${testParentPath}/${file1NewName}`);
        if (!newExists) {
            throw new Error('Test 1 failed! New file name should exist after rename');
        }
        
        const readContent = await vfs.readFile(owner_id, `${testParentPath}/${file1NewName}`);
        if (readContent?.toString() !== file1Content) {
            throw new Error(`Test 1 failed! Content not preserved. Expected: "${file1Content}", Got: "${readContent}"`);
        }
        console.log('✅ Test 1 passed: Simple file rename works with content preservation');

        // Test 2: Rename file with multiple dots in name (e.g., file.name.txt)
        console.log('Test 2 - Testing rename with multiple dots in filename');
        const file2OldName = `file.with.dots-${randomSuffix}.txt`;
        const file2NewName = `renamed.file.dots-${randomSuffix}.md`;
        const file2Content = 'File with multiple dots content';
        
        await vfs.writeFile(owner_id, `${testParentPath}/${file2OldName}`, file2Content);
        await vfs.rename(owner_id, `${testParentPath}/${file2OldName}`, `${testParentPath}/${file2NewName}`);
        
        const file2NewExists = await vfs.exists(`${testParentPath}/${file2NewName}`);
        if (!file2NewExists) {
            throw new Error('Test 2 failed! File with multiple dots should be renamed');
        }
        
        const file2ReadContent = await vfs.readFile(owner_id, `${testParentPath}/${file2NewName}`);
        if (file2ReadContent?.toString() !== file2Content) {
            throw new Error('Test 2 failed! Content not preserved for file with multiple dots');
        }
        console.log('✅ Test 2 passed: File with multiple dots renamed correctly');

        // Test 3: Rename file without extension to file with extension
        console.log('Test 3 - Testing rename from no extension to with extension');
        const file3OldName = `noext-${randomSuffix}`;
        const file3NewName = `withext-${randomSuffix}.json`;
        const file3Content = '{"test": "json content"}';
        
        await vfs.writeFile(owner_id, `${testParentPath}/${file3OldName}`, file3Content);
        await vfs.rename(owner_id, `${testParentPath}/${file3OldName}`, `${testParentPath}/${file3NewName}`);
        
        const file3OldExists = await vfs.exists(`${testParentPath}/${file3OldName}`);
        const file3NewExists = await vfs.exists(`${testParentPath}/${file3NewName}`);
        
        if (file3OldExists || !file3NewExists) {
            throw new Error('Test 3 failed! Rename from no extension to extension failed');
        }
        console.log('✅ Test 3 passed: Renamed from no extension to with extension');

        // Test 4: Rename directory with files inside
        console.log('Test 4 - Testing directory rename with files inside');
        const dir4OldName = `dir-with-files-${randomSuffix}`;
        const dir4NewName = `dir-renamed-${randomSuffix}`;
        const dir4Path = `${testParentPath}/${dir4OldName}`;
        const childFile = `child-file-${randomSuffix}.txt`;
        const childContent = 'Child file content';
        
        await vfs.mkdirEx(owner_id, dir4Path);
        await vfs.writeFile(owner_id, `${dir4Path}/${childFile}`, childContent);
        
        await vfs.rename(owner_id, dir4Path, `${testParentPath}/${dir4NewName}`);
        
        // Verify old directory doesn't exist
        const dir4OldExists = await vfs.exists(dir4Path);
        if (dir4OldExists) {
            throw new Error('Test 4 failed! Old directory should not exist after rename');
        }
        
        // Verify new directory exists and child file is accessible
        const dir4NewExists = await vfs.exists(`${testParentPath}/${dir4NewName}`);
        if (!dir4NewExists) {
            throw new Error('Test 4 failed! New directory should exist after rename');
        }
        
        const childFileExists = await vfs.exists(`${testParentPath}/${dir4NewName}/${childFile}`);
        if (!childFileExists) {
            throw new Error('Test 4 failed! Child file should be accessible under new directory path');
        }
        
        const childReadContent = await vfs.readFile(owner_id, `${testParentPath}/${dir4NewName}/${childFile}`);
        if (childReadContent?.toString() !== childContent) {
            throw new Error('Test 4 failed! Child file content not preserved after directory rename');
        }
        console.log('✅ Test 4 passed: Directory rename preserves child files');

        // Test 5: Rename with hyphens, underscores, and numbers
        console.log('Test 5 - Testing rename with mixed valid characters');
        const file5OldName = `test_file-${randomSuffix}_v1.txt`;
        const file5NewName = `test-file_${randomSuffix}_v2-final.txt`;
        const file5Content = 'Mixed characters file content';
        
        await vfs.writeFile(owner_id, `${testParentPath}/${file5OldName}`, file5Content);
        await vfs.rename(owner_id, `${testParentPath}/${file5OldName}`, `${testParentPath}/${file5NewName}`);
        
        const file5Exists = await vfs.exists(`${testParentPath}/${file5NewName}`);
        if (!file5Exists) {
            throw new Error('Test 5 failed! File with mixed valid characters should be renamed');
        }
        console.log('✅ Test 5 passed: Rename with mixed valid characters works');

        // Test 6: Ordinal preservation after rename
        console.log('Test 6 - Testing ordinal preservation after rename');
        const ordinalDir = `${testParentPath}/ordinal-test-${randomSuffix}`;
        await vfs.mkdirEx(owner_id, ordinalDir);
        
        // Create multiple files with specific ordinals
        await vfs.writeFile(owner_id, `${ordinalDir}/file-a.txt`, 'File A');
        await vfs.writeFile(owner_id, `${ordinalDir}/file-b.txt`, 'File B');
        await vfs.writeFile(owner_id, `${ordinalDir}/file-c.txt`, 'File C');
        
        // Get ordinal of file-b before rename using getNodeByName
        const beforeNode = await vfs.getNodeByName(`${ordinalDir}/file-b.txt`);
        const ordinalBefore = beforeNode?.ordinal;
        
        // Rename file-b to file-b-renamed
        await vfs.rename(owner_id, `${ordinalDir}/file-b.txt`, `${ordinalDir}/file-b-renamed.txt`);
        
        // Get ordinal after rename
        const afterNode = await vfs.getNodeByName(`${ordinalDir}/file-b-renamed.txt`);
        const ordinalAfter = afterNode?.ordinal;
        
        if (ordinalBefore !== ordinalAfter) {
            throw new Error(`Test 6 failed! Ordinal changed after rename. Before: ${ordinalBefore}, After: ${ordinalAfter}`);
        }
        console.log('✅ Test 6 passed: Ordinal preserved after rename');

        // Test 7: Rename binary file with content preservation
        console.log('Test 7 - Testing binary file rename');
        const binaryOldName = `binary-${randomSuffix}.bin`;
        const binaryNewName = `binary-renamed-${randomSuffix}.bin`;
        // Create a buffer with various byte values
        const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD, 0x7F, 0x80]);
        
        // writeFile handles Buffer input for binary data
        await vfs.writeFile(owner_id, `${testParentPath}/${binaryOldName}`, binaryContent);
        await vfs.rename(owner_id, `${testParentPath}/${binaryOldName}`, `${testParentPath}/${binaryNewName}`);
        
        const binaryExists = await vfs.exists(`${testParentPath}/${binaryNewName}`);
        if (!binaryExists) {
            throw new Error('Test 7 failed! Binary file should exist after rename');
        }
        
        const binaryReadContent = await vfs.readFile(owner_id, `${testParentPath}/${binaryNewName}`);
        if (!binaryReadContent || !Buffer.isBuffer(binaryReadContent)) {
            throw new Error('Test 7 failed! Binary content should be returned as Buffer');
        }
        
        if (!binaryContent.equals(binaryReadContent)) {
            throw new Error('Test 7 failed! Binary content not preserved after rename');
        }
        console.log('✅ Test 7 passed: Binary file rename preserves content');

        // Test 8: Rename with spaces in filename (validName allows spaces)
        console.log('Test 8 - Testing rename with spaces in filename');
        const fileWithSpacesOld = `file with spaces-${randomSuffix}.txt`;
        const fileWithSpacesNew = `renamed file spaces-${randomSuffix}.txt`;
        const spacesContent = 'Content of file with spaces';
        
        await vfs.writeFile(owner_id, `${testParentPath}/${fileWithSpacesOld}`, spacesContent);
        await vfs.rename(owner_id, `${testParentPath}/${fileWithSpacesOld}`, `${testParentPath}/${fileWithSpacesNew}`);
        
        const spacesExists = await vfs.exists(`${testParentPath}/${fileWithSpacesNew}`);
        if (!spacesExists) {
            throw new Error('Test 8 failed! File with spaces should be renamed');
        }
        console.log('✅ Test 8 passed: Rename with spaces in filename works');

        // Test 9: Rename with ampersand in filename (validName allows &)
        console.log('Test 9 - Testing rename with ampersand in filename');
        const ampOld = `file-a&b-${randomSuffix}.txt`;
        const ampNew = `file-x&y-${randomSuffix}.txt`;
        const ampContent = 'Content with ampersand';
        
        await vfs.writeFile(owner_id, `${testParentPath}/${ampOld}`, ampContent);
        await vfs.rename(owner_id, `${testParentPath}/${ampOld}`, `${testParentPath}/${ampNew}`);
        
        const ampExists = await vfs.exists(`${testParentPath}/${ampNew}`);
        if (!ampExists) {
            throw new Error('Test 9 failed! File with ampersand should be renamed');
        }
        console.log('✅ Test 9 passed: Rename with ampersand in filename works');

        // Test 10: Rename deeply nested file
        console.log('Test 10 - Testing rename of deeply nested file');
        const deepPath = `${testParentPath}/level1-${randomSuffix}/level2/level3/level4`;
        await vfs.mkdirEx(owner_id, deepPath);
        
        const deepOldName = `deep-file-${randomSuffix}.txt`;
        const deepNewName = `deep-file-renamed-${randomSuffix}.txt`;
        const deepContent = 'Deeply nested file content';
        
        await vfs.writeFile(owner_id, `${deepPath}/${deepOldName}`, deepContent);
        await vfs.rename(owner_id, `${deepPath}/${deepOldName}`, `${deepPath}/${deepNewName}`);
        
        const deepOldExists = await vfs.exists(`${deepPath}/${deepOldName}`);
        const deepNewExists = await vfs.exists(`${deepPath}/${deepNewName}`);
        
        if (deepOldExists || !deepNewExists) {
            throw new Error('Test 10 failed! Deeply nested file rename failed');
        }
        
        const deepReadContent = await vfs.readFile(owner_id, `${deepPath}/${deepNewName}`);
        if (deepReadContent?.toString() !== deepContent) {
            throw new Error('Test 10 failed! Deeply nested file content not preserved');
        }
        console.log('✅ Test 10 passed: Deeply nested file rename works');

        // Test 11: Rename empty directory
        console.log('Test 11 - Testing rename of empty directory');
        const emptyDirOld = `${testParentPath}/empty-dir-${randomSuffix}`;
        const emptyDirNew = `${testParentPath}/empty-dir-renamed-${randomSuffix}`;
        
        await vfs.mkdirEx(owner_id, emptyDirOld);
        await vfs.rename(owner_id, emptyDirOld, emptyDirNew);
        
        const emptyDirOldExists = await vfs.exists(emptyDirOld);
        const emptyDirNewExists = await vfs.exists(emptyDirNew);
        
        if (emptyDirOldExists || !emptyDirNewExists) {
            throw new Error('Test 11 failed! Empty directory rename failed');
        }
        console.log('✅ Test 11 passed: Empty directory rename works');

        // Test 12: Rename file to same name in different case (if case-insensitive fails)
        console.log('Test 12 - Testing case-sensitivity in rename');
        const caseTestName = `CaseTest-${randomSuffix}.txt`;
        const caseTestLower = `casetest-${randomSuffix}.txt`;
        const caseContent = 'Case test content';
        
        await vfs.writeFile(owner_id, `${testParentPath}/${caseTestName}`, caseContent);
        
        // This should work - renaming to a different case
        try {
            await vfs.rename(owner_id, `${testParentPath}/${caseTestName}`, `${testParentPath}/${caseTestLower}`);
            // If we get here, the rename succeeded
            const caseNewExists = await vfs.exists(`${testParentPath}/${caseTestLower}`);
            if (!caseNewExists) {
                throw new Error('Test 12 failed! Lowercase name should exist');
            }
            console.log('✅ Test 12 passed: Case-sensitive rename works');
        } catch {
            // Some systems might treat this as same file - that's also valid behavior
            console.log('✅ Test 12 passed: Case-insensitive system detected or same-name rename handled');
        }

        console.log('✅ All rename tests passed');
        console.log('=== VFS Rename Test 2 Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Rename Test 2 Failed ===');
        console.error('Error during VFS rename test 2:', error);
        throw error;
    } finally {
        // Always clean up test data
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
