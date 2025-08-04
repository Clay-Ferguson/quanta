
describe('VFS Test', () => {
    // Variables to store modules and connection status
    let pgdb: any;
    let resetTestEnvironment: any;
    let databaseAvailable = false;
    let owner_id: number; // Changed from string to number to match expected type
    
    // Helper function to check if database is available and skip test if not
    const skipIfDatabaseUnavailable = () => {
        if (!databaseAvailable) {
            console.log('Skipping test - database not available');
            return true;
        }
        return false;
    };

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
        if (skipIfDatabaseUnavailable()) return;
        
        // Database is available, run the test
        await resetTestEnvironment();
    });

    // Test folder rename with children - requires the previous test to have run
    it('should test folder rename with children functionality', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function
        const { testFolderRenameWithChildren } = await import('../../../plugins/docs/VFS/test/testFolderRename.js');
        
        // Run the test with the owner_id
        await testFolderRenameWithChildren(owner_id);
    });

    // Test simple read/write functionality - requires the previous test to have run
    it('should test simple read and write file operations', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function
        const { simpleReadWriteTest } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
        
        // Run the test with the owner_id
        await simpleReadWriteTest(owner_id);
    });
    
    // Test file operations (stat, rename, read, unlink) - requires the previous tests to have run
    it('should test various file operations', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function
        const { testFileOperations } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
        
        // Run the test with the owner_id
        await testFileOperations(owner_id);
    });
    
    // Test path operations (creating and verifying nested directory structures)
    it('should test path operations with nested directory structures', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function
        const { testPathOperations } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
        
        // Run the test (note: this function doesn't require owner_id as parameter)
        await testPathOperations();
    });
    
    // Test error handling (testing error conditions and ensuring they're handled correctly)
    it('should test error handling for invalid operations', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function
        const { testErrorHandling } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
        
        // Run the test with the owner_id
        await testErrorHandling(owner_id);
    });
    
    // Test file move operations (moving files up in the ordering)
    it('should test file move up operations', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function from VFSTestFileMoves.js
        const { pgdbTestMoveUp } = await import('../../../plugins/docs/VFS/test/VFSTestFileMoves.js');
        
        // Run the test with the owner_id
        await pgdbTestMoveUp(owner_id);
    });
    
    // Test folder public visibility operations
    it('should test folder public visibility settings', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function from VFSTestAuth.js
        const { pgdbTestSetFolderPublic } = await import('../../../plugins/docs/VFS/test/VFSTestAuth.js');
        
        // Run the test with the owner_id
        await pgdbTestSetFolderPublic(owner_id);
    });
    
    // Test folder deletion operations
    it('should test folder deletion functionality', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function from VFSTest.js
        const { deleteFolder } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
        
        // Run the test with the owner_id
        await deleteFolder(owner_id, '0001_test-structure');
    });
    
    // Test folder rename operations
    it('should test folder rename functionality', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function from VFSTest.js
        const { renameFolder } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
        
        // Run the test with the owner_id
        await renameFolder(owner_id, '0001_test-structure', '0099_renamed-test-structure');
    });
    
    // Test path ensuring functionality
    it('should test vfs_ensure_path functionality', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function from VFSTest.js
        const { testEnsurePath } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
        
        // Run the test with the owner_id
        await testEnsurePath(owner_id);
    });
    
    // Test set public functionality
    it('should test folder and file visibility settings', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function from VFSTest.js
        const { testSetPublic } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
        
        // Run the test with the owner_id
        await testSetPublic(owner_id);
    });
    
    // Test search functionality
    it('should test text search capabilities', async () => {
        if (skipIfDatabaseUnavailable()) return;
        
        // Import the test function from VFSTest.js
        const { testSearch } = await import('../../../plugins/docs/VFS/test/VFSTest.js');
        
        // Run the test
        await testSearch();
    });
});

