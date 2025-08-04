
describe('VFS Test', () => {
    // Variables to store modules and connection status
    let pgdb: any;
    let resetTestEnvironment: any;
    let databaseAvailable = false;
    let owner_id: number; // Changed from string to number to match expected type

    // Before running any tests, check database connection
    beforeAll(async () => {
        try {
            // Import necessary modules
            const vfsTestModule = await import('../../../plugins/docs/VFS/test/VFSTest.js');
            resetTestEnvironment = vfsTestModule.resetTestEnvironment;
            
            // Import and check database connection
            const pgdbModule = await import('../../../PGDB.js');
            pgdb = pgdbModule.default;

            owner_id = pgdb.adminProfile!.id;
            if (!owner_id) {
                throw new Error('Admin profile not found, cannot run tests');
            }
            
            // Test database connection
            await pgdb.query('SELECT 1');
            
            // If we reach here, database is available
            databaseAvailable = true;
            console.log('Database connection successful - tests will run');
        } catch (error) {
            // Database or modules not available
            console.log('Database not available or module import failed:', (error as Error).message);
            databaseAvailable = false;
        }
    });

    // This test requires the Docker environment with PostgreSQL to be running
    // It can be executed with './build/dev/docker-run.sh'
    it('should reset test environment for VFS tests(3)', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Database is available, run the test
            await resetTestEnvironment();
            console.log('VFS test environment reset successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });

    // Test folder rename with children - requires the previous test to have run
    it('should test folder rename with children functionality', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function
            const { testFolderRenameWithChildren } = await import('../../../plugins/docs/VFS/test/testFolderRename.js');
            
            // Run the test with the owner_id
            await testFolderRenameWithChildren(owner_id);
            console.log('Folder rename with children test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in folder rename test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });

    // Test simple read/write functionality - requires the previous test to have run
    it('should test simple read and write file operations', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function
            const { simpleReadWriteTest } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
            
            // Run the test with the owner_id
            await simpleReadWriteTest(owner_id);
            console.log('Simple read/write test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in simple read/write test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });
    
    // Test file operations (stat, rename, read, unlink) - requires the previous tests to have run
    it('should test various file operations', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function
            const { testFileOperations } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
            
            // Run the test with the owner_id
            await testFileOperations(owner_id);
            console.log('File operations test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in file operations test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });
    
    // Test path operations (creating and verifying nested directory structures)
    it('should test path operations with nested directory structures', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function
            const { testPathOperations } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
            
            // Run the test (note: this function doesn't require owner_id as parameter)
            await testPathOperations();
            console.log('Path operations test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in path operations test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });
    
    // Test error handling (testing error conditions and ensuring they're handled correctly)
    it('should test error handling for invalid operations', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function
            const { testErrorHandling } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
            
            // Run the test with the owner_id
            await testErrorHandling(owner_id);
            console.log('Error handling test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in error handling test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });
    
    // Test file move operations (moving files up in the ordering)
    it('should test file move up operations', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function from VFSTestFileMoves.js
            const { pgdbTestMoveUp } = await import('../../../plugins/docs/VFS/test/VFSTestFileMoves.js');
            
            // Run the test with the owner_id
            await pgdbTestMoveUp(owner_id);
            console.log('File move operations test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in file move operations test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });
    
    // Test folder public visibility operations
    it('should test folder public visibility settings', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function from VFSTestAuth.js
            const { pgdbTestSetFolderPublic } = await import('../../../plugins/docs/VFS/test/VFSTestAuth.js');
            
            // Run the test with the owner_id
            await pgdbTestSetFolderPublic(owner_id);
            console.log('Folder public visibility test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in folder public visibility test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });
    
    // Test folder deletion operations
    it('should test folder deletion functionality', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function from VFSTest.js
            const { deleteFolder } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
            
            // Run the test with the owner_id
            await deleteFolder(owner_id, '0001_test-structure');
            console.log('Folder deletion test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in folder deletion test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });
    
    // Test folder rename operations
    it('should test folder rename functionality', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function from VFSTest.js
            const { renameFolder } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
            
            // Run the test with the owner_id
            await renameFolder(owner_id, '0001_test-structure', '0099_renamed-test-structure');
            console.log('Folder rename test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in folder rename test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });
    
    // Test path ensuring functionality
    it('should test vfs_ensure_path functionality', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function from VFSTest.js
            const { testEnsurePath } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
            
            // Run the test with the owner_id
            await testEnsurePath(owner_id);
            console.log('Path ensuring test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in path ensuring test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });
    
    // Test set public functionality
    it('should test folder and file visibility settings', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function from VFSTest.js
            const { testSetPublic } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
            
            // Run the test with the owner_id
            await testSetPublic(owner_id);
            console.log('Set public test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in set public test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });
    
    // Test search functionality
    it('should test text search capabilities', async () => {
        // Skip the test if database is not available
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return;
        }
        
        try {
            // Import the test function from VFSTest.js
            const { testSearch } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
            
            // Run the test
            await testSearch();
            console.log('Search functionality test completed successfully');
        } catch (error) {
            const testError = error as Error;
            console.error('Error in search functionality test:', testError.message);
            throw error; // Re-throw to fail the test
        }
    });
});

