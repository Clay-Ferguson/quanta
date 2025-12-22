import { docMod } from '../DocMod.js';
import vfs from '../VFS.js';
import { Response } from 'express';

/**
 * Test for saveFile edge cases: renaming, updating existing files, error handling
 * 
 * This test covers scenarios not covered by saveFileTest.ts:
 * - Renaming a file during save (newFileName parameter)
 * - Updating an existing file (preserving ordinal)
 * - Saving to subdirectories
 * - Error cases: missing parameters, invalid paths
 * - Auto-adding .md extension to files without extensions
 */
export async function saveFileEdgeCasesTest(owner_id: number): Promise<void> {
    try {
        console.log('=== SaveFile Edge Cases Test ===');

        // Helper to create mock request/response objects
        const createMockReqRes = (body: any) => {
            const req: any = {
                body,
                userProfile: {
                    id: owner_id
                }
            };

            let responseData: any = null;
            let statusCode = 200;

            const res: any = {
                status: (code: number) => {
                    statusCode = code;
                    return res;
                },
                json: (data: any) => {
                    responseData = data;
                    return res;
                },
                headersSent: false,
                writableEnded: false,
                getStatusCode: () => statusCode,
                getResponseData: () => responseData
            };

            return { req, res };
        };

        // Test 1: Create a file and then update it (should preserve ordinal)
        console.log('Test 1 - Create and update existing file');
        {
            // First create the file
            const { req: req1, res: res1 } = createMockReqRes({
                filename: 'updateTest.md',
                content: 'Original content',
                treeFolder: '/'
            });
            await docMod.saveFile(req1, res1 as Response);

            if (res1.getStatusCode() !== 200) {
                throw new Error(`Test 1a failed! Expected status 200 but got ${res1.getStatusCode()}`);
            }

            // Get the ordinal of the created file
            const fileInfo1: any = {};
            await vfs.exists('/updateTest.md', fileInfo1);
            const originalOrdinal = fileInfo1.node?.ordinal;

            // Now update the file with new content
            const { req: req2, res: res2 } = createMockReqRes({
                filename: 'updateTest.md',
                content: 'Updated content with more text',
                treeFolder: '/'
            });
            await docMod.saveFile(req2, res2 as Response);

            if (res2.getStatusCode() !== 200) {
                throw new Error(`Test 1b failed! Expected status 200 but got ${res2.getStatusCode()}`);
            }

            // Verify content was updated
            const updatedContent = await vfs.readFile(owner_id, '/updateTest.md', 'utf8');
            if (updatedContent.toString() !== 'Updated content with more text') {
                throw new Error('Test 1 failed! Content was not updated correctly');
            }

            // Verify ordinal was preserved
            const fileInfo2: any = {};
            await vfs.exists('/updateTest.md', fileInfo2);
            if (fileInfo2.node?.ordinal !== originalOrdinal) {
                throw new Error(`Test 1 failed! Ordinal changed from ${originalOrdinal} to ${fileInfo2.node?.ordinal}`);
            }

            console.log('✅ Test 1 passed - File update preserves ordinal');
        }

        // Test 2: Rename file during save
        console.log('Test 2 - Rename file during save');
        {
            // Create initial file
            const { req: req1, res: res1 } = createMockReqRes({
                filename: 'beforeRename.md',
                content: 'Content before rename',
                treeFolder: '/'
            });
            await docMod.saveFile(req1, res1 as Response);

            if (res1.getStatusCode() !== 200) {
                throw new Error(`Test 2a failed! Expected status 200 but got ${res1.getStatusCode()}`);
            }

            // Now save with rename
            const { req: req2, res: res2 } = createMockReqRes({
                filename: 'beforeRename.md',
                content: 'Content after rename',
                treeFolder: '/',
                newFileName: 'afterRename.md'
            });
            await docMod.saveFile(req2, res2 as Response);

            if (res2.getStatusCode() !== 200) {
                throw new Error(`Test 2b failed! Expected status 200 but got ${res2.getStatusCode()}`);
            }

            // Verify old file no longer exists
            const oldExists = await vfs.exists('/beforeRename.md');
            if (oldExists) {
                throw new Error('Test 2 failed! Old file should not exist after rename');
            }

            // Verify new file exists with correct content
            const newExists = await vfs.exists('/afterRename.md');
            if (!newExists) {
                throw new Error('Test 2 failed! New file should exist after rename');
            }

            const content = await vfs.readFile(owner_id, '/afterRename.md', 'utf8');
            if (content.toString() !== 'Content after rename') {
                throw new Error('Test 2 failed! Content does not match after rename');
            }

            console.log('✅ Test 2 passed - File renamed successfully during save');
        }

        // Test 3: Auto-add .md extension when newFileName has no extension
        console.log('Test 3 - Auto-add .md extension to newFileName');
        {
            // Create initial file
            const { req: req1, res: res1 } = createMockReqRes({
                filename: 'extensionTest.md',
                content: 'Testing extension handling',
                treeFolder: '/'
            });
            await docMod.saveFile(req1, res1 as Response);

            if (res1.getStatusCode() !== 200) {
                throw new Error(`Test 3a failed! Expected status 200 but got ${res1.getStatusCode()}`);
            }

            // Rename without extension - should auto-add .md
            const { req: req2, res: res2 } = createMockReqRes({
                filename: 'extensionTest.md',
                content: 'Updated extension test',
                treeFolder: '/',
                newFileName: 'newNameNoExt'  // No extension provided
            });
            await docMod.saveFile(req2, res2 as Response);

            if (res2.getStatusCode() !== 200) {
                throw new Error(`Test 3b failed! Expected status 200 but got ${res2.getStatusCode()}`);
            }

            // Verify file exists with .md extension auto-added
            const newExists = await vfs.exists('/newNameNoExt.md');
            if (!newExists) {
                throw new Error('Test 3 failed! File with auto-added .md extension should exist');
            }

            console.log('✅ Test 3 passed - .md extension auto-added');
        }

        // Test 4: Save to subdirectory
        console.log('Test 4 - Save file to subdirectory');
        {
            // First create a subdirectory
            await vfs.mkdirEx(owner_id, '/subdir');

            // Save file to subdirectory
            const { req, res } = createMockReqRes({
                filename: 'subfile.md',
                content: 'File in subdirectory',
                treeFolder: '/subdir'
            });
            await docMod.saveFile(req, res as Response);

            if (res.getStatusCode() !== 200) {
                throw new Error(`Test 4 failed! Expected status 200 but got ${res.getStatusCode()}`);
            }

            // Verify file exists in subdirectory
            const exists = await vfs.exists('/subdir/subfile.md');
            if (!exists) {
                throw new Error('Test 4 failed! File should exist in subdirectory');
            }

            const content = await vfs.readFile(owner_id, '/subdir/subfile.md', 'utf8');
            if (content.toString() !== 'File in subdirectory') {
                throw new Error('Test 4 failed! Content does not match');
            }

            console.log('✅ Test 4 passed - File saved to subdirectory');
        }

        // Test 5: Error case - missing filename
        console.log('Test 5 - Error: missing filename');
        {
            const { req, res } = createMockReqRes({
                content: 'Some content',
                treeFolder: '/'
            });
            await docMod.saveFile(req, res as Response);

            if (res.getStatusCode() !== 400) {
                throw new Error(`Test 5 failed! Expected status 400 but got ${res.getStatusCode()}`);
            }

            console.log('✅ Test 5 passed - Missing filename returns 400');
        }

        // Test 6: Error case - missing treeFolder
        console.log('Test 6 - Error: missing treeFolder');
        {
            const { req, res } = createMockReqRes({
                filename: 'test.md',
                content: 'Some content'
            });
            await docMod.saveFile(req, res as Response);

            if (res.getStatusCode() !== 400) {
                throw new Error(`Test 6 failed! Expected status 400 but got ${res.getStatusCode()}`);
            }

            console.log('✅ Test 6 passed - Missing treeFolder returns 400');
        }

        // Test 7: Error case - non-existent directory
        console.log('Test 7 - Error: non-existent directory');
        {
            const { req, res } = createMockReqRes({
                filename: 'test.md',
                content: 'Some content',
                treeFolder: '/nonexistent/path'
            });
            await docMod.saveFile(req, res as Response);

            if (res.getStatusCode() !== 404) {
                throw new Error(`Test 7 failed! Expected status 404 but got ${res.getStatusCode()}`);
            }

            console.log('✅ Test 7 passed - Non-existent directory returns 404');
        }

        // Test 8: Error case - rename to existing filename (conflict)
        console.log('Test 8 - Error: rename to existing filename');
        {
            // Create two files
            const { req: req1, res: res1 } = createMockReqRes({
                filename: 'fileA.md',
                content: 'File A content',
                treeFolder: '/'
            });
            await docMod.saveFile(req1, res1 as Response);

            const { req: req2, res: res2 } = createMockReqRes({
                filename: 'fileB.md',
                content: 'File B content',
                treeFolder: '/'
            });
            await docMod.saveFile(req2, res2 as Response);

            // Try to rename fileA to fileB (should fail - conflict)
            const { req: req3, res: res3 } = createMockReqRes({
                filename: 'fileA.md',
                content: 'Updated content',
                treeFolder: '/',
                newFileName: 'fileB.md'
            });
            await docMod.saveFile(req3, res3 as Response);

            if (res3.getStatusCode() !== 409) {
                throw new Error(`Test 8 failed! Expected status 409 but got ${res3.getStatusCode()}`);
            }

            console.log('✅ Test 8 passed - Rename conflict returns 409');
        }

        // Test 9: Error case - path is not a directory
        console.log('Test 9 - Error: treeFolder is a file, not directory');
        {
            // Create a file first
            const { req: req1, res: res1 } = createMockReqRes({
                filename: 'notADir.md',
                content: 'This is a file',
                treeFolder: '/'
            });
            await docMod.saveFile(req1, res1 as Response);

            // Try to save to a path where the "folder" is actually a file
            const { req: req2, res: res2 } = createMockReqRes({
                filename: 'child.md',
                content: 'Some content',
                treeFolder: '/notADir.md'  // This is a file, not a directory
            });
            await docMod.saveFile(req2, res2 as Response);

            if (res2.getStatusCode() !== 400) {
                throw new Error(`Test 9 failed! Expected status 400 but got ${res2.getStatusCode()}`);
            }

            const response = res2.getResponseData();
            if (!response.error || !response.error.includes('not a directory')) {
                throw new Error(`Test 9 failed! Expected 'not a directory' error but got: ${JSON.stringify(response)}`);
            }

            console.log('✅ Test 9 passed - Path not a directory returns 400');
        }

        // Test 10: Empty content should still save
        console.log('Test 10 - Save file with empty content');
        {
            const { req, res } = createMockReqRes({
                filename: 'empty.md',
                content: '',
                treeFolder: '/'
            });
            await docMod.saveFile(req, res as Response);

            if (res.getStatusCode() !== 200) {
                throw new Error(`Test 10 failed! Expected status 200 but got ${res.getStatusCode()}`);
            }

            const exists = await vfs.exists('/empty.md');
            if (!exists) {
                throw new Error('Test 10 failed! Empty file should be created');
            }

            const content = await vfs.readFile(owner_id, '/empty.md', 'utf8');
            if (content.toString() !== '') {
                throw new Error('Test 10 failed! Content should be empty');
            }

            console.log('✅ Test 10 passed - Empty content saves successfully');
        }

        console.log('✅ All saveFile edge case tests passed');
        console.log('=== SaveFile Edge Cases Test Completed Successfully ===');

    } catch (error) {
        console.error('=== SaveFile Edge Cases Test Failed ===');
        console.error('Error during saveFile edge case test:', error);
        throw error;
    }
}
