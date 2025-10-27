import { docMod } from '../DocMod.js';
import vfs from '../VFS.js';
import { Response } from 'express';

/**
 * Test for the saveFile REST endpoint (docMod.saveFile)
 * 
 * This test creates three files in the root folder by calling the saveFile method directly,
 * bypassing the HTTP layer and authentication middleware.
 */
export async function createFilesTest(owner_id: number): Promise<void> {
    try {
        console.log('=== SaveFile REST Endpoint Test - Creating Files ===');

        // Create mock request and response objects
        const createMockReqRes = (filename: string, content: string, treeFolder: string = '') => {
            const req: any = {
                body: {
                    filename: filename,
                    content: content,
                    treeFolder: treeFolder
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

        // Test 1: Create first file
        console.log('Test 1 - Creating first file: file1.md');
        const { req: req1, res: res1 } = createMockReqRes('file1.md', '# File 1\n\nThis is the first test file.', '/');
        await docMod.saveFile(req1, res1 as Response);
        
        const response1 = res1.getResponseData();
        const status1 = res1.getStatusCode();
        
        if (status1 !== 200) {
            throw new Error(`Test 1 failed! Expected status 200 but got ${status1}. Response: ${JSON.stringify(response1)}`);
        }
        
        if (!response1.message || !response1.message.includes('successfully')) {
            throw new Error(`Test 1 failed! Expected success message but got: ${JSON.stringify(response1)}`);
        }
        
        // Verify file exists
        const file1Exists = await vfs.exists('/file1.md');
        if (!file1Exists) {
            throw new Error('Test 1 failed! file1.md should exist after saveFile');
        }
        
        // Verify content
        const file1Content = await vfs.readFile(owner_id, '/file1.md', 'utf8');
        if (file1Content.toString() !== '# File 1\n\nThis is the first test file.') {
            throw new Error('Test 1 failed! File content does not match');
        }
        
        console.log('✅ Test 1 passed - file1.md created successfully');

        // Test 2: Create second file
        console.log('Test 2 - Creating second file: file2.md');
        const { req: req2, res: res2 } = createMockReqRes('file2.md', '# File 2\n\nThis is the second test file with more content.\n\n- Item 1\n- Item 2\n- Item 3', '/');
        await docMod.saveFile(req2, res2 as Response);
        
        const response2 = res2.getResponseData();
        const status2 = res2.getStatusCode();
        
        if (status2 !== 200) {
            throw new Error(`Test 2 failed! Expected status 200 but got ${status2}. Response: ${JSON.stringify(response2)}`);
        }
        
        // Verify file exists
        const file2Exists = await vfs.exists('/file2.md');
        if (!file2Exists) {
            throw new Error('Test 2 failed! file2.md should exist after saveFile');
        }
        
        // Verify content
        const file2Content = await vfs.readFile(owner_id, '/file2.md', 'utf8');
        if (file2Content.toString() !== '# File 2\n\nThis is the second test file with more content.\n\n- Item 1\n- Item 2\n- Item 3') {
            throw new Error('Test 2 failed! File content does not match');
        }
        
        console.log('✅ Test 2 passed - file2.md created successfully');

        // Test 3: Create third file
        console.log('Test 3 - Creating third file: file3.md');
        const { req: req3, res: res3 } = createMockReqRes('file3.md', '# File 3\n\nThis is the third test file.\n\nIt contains:\n- Special characters: äöüñáéíóú\n- Code block:\n```javascript\nconst test = "hello";\n```\n- **Bold** and *italic* text', '/');
        await docMod.saveFile(req3, res3 as Response);
        
        const response3 = res3.getResponseData();
        const status3 = res3.getStatusCode();
        
        if (status3 !== 200) {
            throw new Error(`Test 3 failed! Expected status 200 but got ${status3}. Response: ${JSON.stringify(response3)}`);
        }
        
        // Verify file exists
        const file3Exists = await vfs.exists('/file3.md');
        if (!file3Exists) {
            throw new Error('Test 3 failed! file3.md should exist after saveFile');
        }
        
        // Verify content
        const file3Content = await vfs.readFile(owner_id, '/file3.md', 'utf8');
        const expectedContent3 = '# File 3\n\nThis is the third test file.\n\nIt contains:\n- Special characters: äöüñáéíóú\n- Code block:\n```javascript\nconst test = "hello";\n```\n- **Bold** and *italic* text';
        if (file3Content.toString() !== expectedContent3) {
            throw new Error('Test 3 failed! File content does not match');
        }
        
        console.log('✅ Test 3 passed - file3.md created successfully');

        // Test 4: Verify all three files are present in directory listing
        console.log('Test 4 - Verifying all files are in directory listing');
        const rootContents = await vfs.readdirEx(owner_id, '/', false);
        const testFiles = rootContents.filter(node => 
            node.name === 'file1.md' || node.name === 'file2.md' || node.name === 'file3.md'
        );
        
        if (testFiles.length !== 3) {
            throw new Error(`Test 4 failed! Expected 3 files in directory but found ${testFiles.length}`);
        }
        
        console.log('Test 4 - Found all 3 files in directory:');
        testFiles.forEach(file => {
            console.log(`  - ${file.name} (ordinal: ${file.ordinal})`);
        });
        
        console.log('✅ Test 4 passed - All files verified in directory listing');

        console.log('✅ All saveFile REST endpoint tests passed');
        console.log('=== SaveFile REST Endpoint Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== SaveFile REST Endpoint Test Failed ===');
        console.error('Error during saveFile test:', error);
        throw error;
    }
}
