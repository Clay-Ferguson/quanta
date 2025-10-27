import { docSvc } from '../DocService.js';
import vfs from '../VFS.js';
import { Response } from 'express';

/**
 * Test for the createFolder REST endpoint (docSvc.createFolder)
 * 
 * This test creates three folders in the root folder by calling the createFolder method directly,
 * bypassing the HTTP layer and authentication middleware. This test is cumulative and does NOT
 * clear the database first - it appends to existing data.
 */
export async function createFoldersTest(owner_id: number): Promise<void> {
    try {
        console.log('=== CreateFolder REST Endpoint Test - Creating Folders ===');

        // Create mock request and response objects
        const createMockReqRes = (folderName: string, treeFolder: string = '/', insertAfterNode: string = '') => {
            const req: any = {
                body: {
                    folderName: folderName,
                    treeFolder: treeFolder,
                    insertAfterNode: insertAfterNode
                },
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

        // Test 1: Create first folder
        console.log('Test 1 - Creating first folder: folder1');
        const { req: req1, res: res1 } = createMockReqRes('folder1', '/');
        await docSvc.createFolder(req1, res1 as Response);
        
        const response1 = res1.getResponseData();
        const status1 = res1.getStatusCode();
        
        if (status1 !== 200) {
            throw new Error(`Test 1 failed! Expected status 200 but got ${status1}. Response: ${JSON.stringify(response1)}`);
        }
        
        if (!response1.message || !response1.message.includes('successfully')) {
            throw new Error(`Test 1 failed! Expected success message but got: ${JSON.stringify(response1)}`);
        }
        
        if (!response1.folderName || response1.folderName !== 'folder1') {
            throw new Error(`Test 1 failed! Expected folderName 'folder1' but got: ${response1.folderName}`);
        }
        
        // Verify folder exists
        const folder1Exists = await vfs.exists('/folder1');
        if (!folder1Exists) {
            throw new Error('Test 1 failed! folder1 should exist after createFolder');
        }
        
        // Verify it's a directory
        const folder1Stat = await vfs.stat('/folder1');
        if (!folder1Stat.is_directory) {
            throw new Error('Test 1 failed! folder1 should be a directory');
        }
        
        console.log('✅ Test 1 passed - folder1 created successfully');

        // Test 2: Create second folder
        console.log('Test 2 - Creating second folder: folder2');
        const { req: req2, res: res2 } = createMockReqRes('folder2', '/');
        await docSvc.createFolder(req2, res2 as Response);
        
        const response2 = res2.getResponseData();
        const status2 = res2.getStatusCode();
        
        if (status2 !== 200) {
            throw new Error(`Test 2 failed! Expected status 200 but got ${status2}. Response: ${JSON.stringify(response2)}`);
        }
        
        if (!response2.folderName || response2.folderName !== 'folder2') {
            throw new Error(`Test 2 failed! Expected folderName 'folder2' but got: ${response2.folderName}`);
        }
        
        // Verify folder exists
        const folder2Exists = await vfs.exists('/folder2');
        if (!folder2Exists) {
            throw new Error('Test 2 failed! folder2 should exist after createFolder');
        }
        
        // Verify it's a directory
        const folder2Stat = await vfs.stat('/folder2');
        if (!folder2Stat.is_directory) {
            throw new Error('Test 2 failed! folder2 should be a directory');
        }
        
        console.log('✅ Test 2 passed - folder2 created successfully');

        // Test 3: Create third folder
        console.log('Test 3 - Creating third folder: folder3');
        const { req: req3, res: res3 } = createMockReqRes('folder3', '/');
        await docSvc.createFolder(req3, res3 as Response);
        
        const response3 = res3.getResponseData();
        const status3 = res3.getStatusCode();
        
        if (status3 !== 200) {
            throw new Error(`Test 3 failed! Expected status 200 but got ${status3}. Response: ${JSON.stringify(response3)}`);
        }
        
        if (!response3.folderName || response3.folderName !== 'folder3') {
            throw new Error(`Test 3 failed! Expected folderName 'folder3' but got: ${response3.folderName}`);
        }
        
        // Verify folder exists
        const folder3Exists = await vfs.exists('/folder3');
        if (!folder3Exists) {
            throw new Error('Test 3 failed! folder3 should exist after createFolder');
        }
        
        // Verify it's a directory
        const folder3Stat = await vfs.stat('/folder3');
        if (!folder3Stat.is_directory) {
            throw new Error('Test 3 failed! folder3 should be a directory');
        }
        
        console.log('✅ Test 3 passed - folder3 created successfully');

        // Test 4: Verify all three folders are present in directory listing along with the files from previous test
        console.log('Test 4 - Verifying all folders are in directory listing (cumulative check)');
        const rootContents = await vfs.readdirEx(owner_id, '/', false);
        
        // Check for the three folders from this test
        const testFolders = rootContents.filter(node => 
            node.name === 'folder1' || node.name === 'folder2' || node.name === 'folder3'
        );
        
        if (testFolders.length !== 3) {
            throw new Error(`Test 4 failed! Expected 3 folders but found ${testFolders.length}`);
        }
        
        // Verify all are directories
        testFolders.forEach(folder => {
            if (!folder.is_directory) {
                throw new Error(`Test 4 failed! ${folder.name} should be a directory`);
            }
        });
        
        console.log('Test 4 - Found all 3 folders in directory:');
        testFolders.forEach(folder => {
            console.log(`  - ${folder.name} (ordinal: ${folder.ordinal})`);
        });
        
        // Also verify the files from the previous test are still there
        const testFiles = rootContents.filter(node => 
            node.name === 'file1.md' || node.name === 'file2.md' || node.name === 'file3.md'
        );
        
        if (testFiles.length !== 3) {
            console.warn(`Expected 3 files from previous test, but found ${testFiles.length}. This is okay if previous test didn't run.`);
        } else {
            console.log('Test 4 - Files from previous test still present:');
            testFiles.forEach(file => {
                console.log(`  - ${file.name} (ordinal: ${file.ordinal})`);
            });
        }
        
        console.log(`✅ Test 4 passed - All folders verified (total items in root: ${rootContents.length})`);

        console.log('✅ All createFolder REST endpoint tests passed');
        console.log('=== CreateFolder REST Endpoint Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== CreateFolder REST Endpoint Test Failed ===');
        console.error('Error during createFolder test:', error);
        throw error;
    }
}
