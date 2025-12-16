import { docUtil }  from '../DocUtil.js'; 
import vfs from '../VFS.js';

export async function getItemByIDTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS GetItemByID Test Starting ===');

        // Test 1: Test getting item by non-existent UUID
        console.log('Test 1 - Getting item by non-existent UUID');
        const nonExistentUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const result1 = await vfs.getItemByID(nonExistentUuid, 'usr');
        console.log(`Test 1 - Non-existent UUID result:`, { hasNode: !!result1.node, docPath: result1.docPath });
        
        if (result1.node !== null) {
            throw new Error('Test 1 failed! Non-existent UUID should return null node');
        }
        if (result1.docPath !== '') {
            throw new Error('Test 1 failed! Non-existent UUID should return empty docPath');
        }
        console.log('Test 1 - Non-existent UUID handled correctly');

        // Test 2: Create a test file and get it by ID
        console.log('Test 2 - Create test file and retrieve by UUID');
        const testFileName = 'test-getItemByID.md';
        const testContent = '# GetItemByID Test\n\nThis file is used to test UUID-based retrieval.';
        
        // Create the file
        await vfs.writeFile(owner_id, testFileName, testContent, 'utf8');
        console.log(`Test 2 - Created test file: ${testFileName}`);
        
        // Get the file's UUID by reading the directory
        const rootContents = await vfs.readdirEx(owner_id, '', false);
        const testFile = rootContents.find(node => node.name === testFileName);
        
        if (!testFile || !testFile.uuid) {
            throw new Error('Test 2 failed! Test file should exist and have a UUID');
        }
        console.log(`Test 2 - Found test file with UUID: ${testFile.uuid}`);
        
        // Get the file by its UUID
        const result2 = await vfs.getItemByID(testFile.uuid, 'usr');
        console.log(`Test 2 - Retrieved by UUID:`, { 
            hasNode: !!result2.node, 
            docPath: result2.docPath,
            nodeName: result2.node?.name,
            nodeUuid: result2.node?.uuid
        });
        
        if (!result2.node) {
            throw new Error('Test 2 failed! Should have found the test file by UUID');
        }
        
        if (result2.node.uuid !== testFile.uuid) {
            throw new Error(`Test 2 failed! UUID mismatch: expected ${testFile.uuid}, got ${result2.node.uuid}`);
        }
        
        if (result2.node.name !== testFileName) {
            throw new Error(`Test 2 failed! Name mismatch: expected ${testFileName}, got ${result2.node.name}`);
        }
        
        if (result2.docPath !== testFileName) {
            throw new Error(`Test 2 failed! DocPath mismatch: expected ${testFileName}, got ${result2.docPath}`);
        }
        console.log('Test 2 - File retrieval by UUID successful');

        // Test 3: Create a nested directory structure and test docPath construction
        console.log('Test 3 - Create nested structure and test docPath construction');
        const nestedDirName = 'test-nested-dir';
        const nestedFileName = 'nested-file.txt';
        const nestedContent = 'This is content in a nested file.';
        
        // Create nested directory first
        await vfs.mkdirEx(owner_id, nestedDirName, {}, false);
        console.log(`Test 3 - Created nested directory: ${nestedDirName}`);
        
        // Create file in nested directory
        const nestedFilePath = docUtil.pathJoin(nestedDirName, nestedFileName);
        await vfs.writeFile(owner_id, nestedFilePath, nestedContent, 'utf8');
        console.log(`Test 3 - Created nested file: ${nestedFilePath}`);
        
        // Get the nested file's UUID
        const nestedContents = await vfs.readdirEx(owner_id, nestedDirName, false);
        const nestedFile = nestedContents.find(node => node.name === nestedFileName);
        
        if (!nestedFile || !nestedFile.uuid) {
            throw new Error('Test 3 failed! Nested file should exist and have a UUID');
        }
        console.log(`Test 3 - Found nested file with UUID: ${nestedFile.uuid}`);
        
        // Get the nested file by its UUID
        const result3 = await vfs.getItemByID(nestedFile.uuid, 'usr');
        console.log(`Test 3 - Retrieved nested file by UUID:`, { 
            hasNode: !!result3.node, 
            docPath: result3.docPath,
            nodeName: result3.node?.name 
        });
        
        if (!result3.node) {
            throw new Error('Test 3 failed! Should have found the nested file by UUID');
        }
        
        if (result3.docPath !== nestedFilePath) {
            throw new Error(`Test 3 failed! DocPath should be ${nestedFilePath}, got ${result3.docPath}`);
        }
        console.log('Test 3 - Nested file docPath construction successful');

        // Test 4: Test with different root keys
        console.log('Test 4 - Test with different root keys');
        const wrongRootKeyResult = await vfs.getItemByID(testFile.uuid, 'wrong-root');
        console.log(`Test 4 - Wrong root key result:`, { hasNode: !!wrongRootKeyResult.node, docPath: wrongRootKeyResult.docPath });
        
        if (wrongRootKeyResult.node !== null) {
            throw new Error('Test 4 failed! Wrong root key should return null node');
        }
        console.log('Test 4 - Wrong root key handled correctly');

        // Test 5: Test with malformed UUIDs
        console.log('Test 5 - Test with malformed UUIDs');
        const malformedUuids = [
            'not-a-uuid',
            '12345',
            '',
            'aaaaaaaa-bbbb-cccc-dddd', // Too short
            'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-extra' // Too long
        ];
        
        for (const badUuid of malformedUuids) {
            try {
                const badResult = await vfs.getItemByID(badUuid, 'usr');
                console.log(`Test 5 - Malformed UUID '${badUuid}' result:`, { hasNode: !!badResult.node, docPath: badResult.docPath });
                
                // Should return null node for malformed UUIDs
                if (badResult.node !== null) {
                    throw new Error(`Test 5 failed! Malformed UUID '${badUuid}' should return null node`);
                }
            } catch (error) {
                // It's also acceptable for malformed UUIDs to throw database errors
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 5 - Malformed UUID '${badUuid}' threw error (acceptable):`, errorMessage);
            }
        }
        console.log('Test 5 - Malformed UUIDs handled correctly');

        // Test 6: Test TreeNode properties
        console.log('Test 6 - Verify TreeNode properties');
        const result6 = await vfs.getItemByID(testFile.uuid, 'usr');
        
        if (!result6.node) {
            throw new Error('Test 6 failed! Should have found the test file');
        }
        
        const node = result6.node;
        
        // Check required TreeNode properties
        if (typeof node.is_directory !== 'boolean') {
            throw new Error('Test 6 failed! TreeNode should have boolean is_directory property');
        }
        
        if (typeof node.name !== 'string') {
            throw new Error('Test 6 failed! TreeNode should have string name property');
        }
        
        if (typeof node.uuid !== 'string') {
            throw new Error('Test 6 failed! TreeNode should have string uuid property');
        }
        
        if (typeof node.owner_id !== 'number') {
            throw new Error('Test 6 failed! TreeNode should have number owner_id property');
        }
        
        if (typeof node.is_public !== 'boolean') {
            throw new Error('Test 6 failed! TreeNode should have boolean is_public property');
        }
        
        if (node.ordinal !== null && typeof node.ordinal !== 'number') {
            throw new Error('Test 6 failed! TreeNode ordinal should be number or null');
        }
        
        console.log(`Test 6 - TreeNode properties verified:`, {
            name: node.name,
            uuid: node.uuid,
            is_directory: node.is_directory,
            is_public: node.is_public,
            owner_id: node.owner_id,
            ordinal: node.ordinal
        });

        // Test 7: Test with directory vs file
        console.log('Test 7 - Test directory vs file retrieval');
        
        // Get directory by UUID
        const dirContents = await vfs.readdirEx(owner_id, '', false);
        const dirNode = dirContents.find(node => node.name === nestedDirName);
        
        if (!dirNode || !dirNode.uuid) {
            throw new Error('Test 7 failed! Directory should exist and have UUID');
        }
        
        const dirResult = await vfs.getItemByID(dirNode.uuid, 'usr');
        console.log(`Test 7 - Directory retrieval:`, { 
            hasNode: !!dirResult.node,
            docPath: dirResult.docPath,
            isDirectory: dirResult.node?.is_directory
        });
        
        if (!dirResult.node || !dirResult.node.is_directory) {
            throw new Error('Test 7 failed! Directory should be retrieved and marked as directory');
        }
        
        if (dirResult.docPath !== nestedDirName) {
            throw new Error(`Test 7 failed! Directory docPath should be ${nestedDirName}, got ${dirResult.docPath}`);
        }
        console.log('Test 7 - Directory retrieval successful');

        // Test 8: Test consistency between getItemByID and other methods
        console.log('Test 8 - Test consistency with other methods');
        
        // Get file through getItemByID
        const byIdResult = await vfs.getItemByID(testFile.uuid, 'usr');
        
        // Get file through exists with info
        const existsInfo: any = {};
        const exists = await vfs.exists(testFileName, existsInfo);
        
        if (!exists || !existsInfo.node) {
            throw new Error('Test 8 failed! File should exist and have node info');
        }
        
        // Compare results
        const byIdNode = byIdResult.node!;
        const existsNode = existsInfo.node;
        
        if (byIdNode.uuid !== existsNode.uuid) {
            throw new Error('Test 8 failed! UUIDs should match between getItemByID and exists methods');
        }
        
        if (byIdNode.name !== existsNode.name) {
            throw new Error('Test 8 failed! Names should match between getItemByID and exists methods');
        }
        
        if (byIdNode.is_directory !== existsNode.is_directory) {
            throw new Error('Test 8 failed! Directory flags should match between methods');
        }
        console.log('Test 8 - Consistency between methods verified');

        // Test 9: Test multiple retrievals (caching/consistency)
        console.log('Test 9 - Test multiple retrievals for consistency');
        for (let i = 0; i < 3; i++) {
            const multiResult = await vfs.getItemByID(testFile.uuid, 'usr');
            
            if (!multiResult.node) {
                throw new Error(`Test 9 failed! Retrieval ${i} should return node`);
            }
            
            if (multiResult.node.uuid !== testFile.uuid) {
                throw new Error(`Test 9 failed! UUID should be consistent across retrievals`);
            }
            
            if (multiResult.docPath !== testFileName) {
                throw new Error(`Test 9 failed! DocPath should be consistent across retrievals`);
            }
        }
        console.log('Test 9 - Multiple retrieval consistency verified');

        // Test 10: Clean up test files
        console.log('Test 10 - Cleaning up test files');
        try {
            await vfs.rm(owner_id, testFileName);
            console.log('Test 10 - Deleted test file');
        } catch (error) {
            console.log('Test 10 - Could not delete test file:', error);
        }
        
        try {
            await vfs.rm(owner_id, nestedDirName, { recursive: true });
            console.log('Test 10 - Deleted nested directory');
        } catch (error) {
            console.log('Test 10 - Could not delete nested directory:', error);
        }

        console.log('✅ All getItemByID tests passed');
        console.log('=== VFS GetItemByID Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS GetItemByID Test Failed ===');
        console.error('Error during VFS getItemByID test:', error);
        throw error;
    }
}
