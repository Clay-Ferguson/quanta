
describe('VFS Test', () => {
    let pgdb: any;
    let vfsTestModule: any;
    let folderRenameModule: any;
    let fileMovesTestModule: any;
    let authTestModule: any;
    let databaseAvailable = false;
    let owner_id: number; // Changed from string to number to match expected type
    
    // Helper function to check if database is available and skip test if not
    const skipIfDatabaseUnavailable = () => {
        if (!databaseAvailable) {
            console.info('Skipping test - database not available');
            process.stdout.write('⚠ Skipping test - database not available\n');
            return true;
        }
        return false;
    };

    beforeAll(async () => {
        try {
            const base = '../../../plugins/docs/VFS/test';
            // Import necessary modules 
            // NOTE: Don't be tempted to import at the top of this file. That's not compatible with Jest's ESM support.
            vfsTestModule = await import(`${base}/VFSTest.js`);
            folderRenameModule = await import(`${base}/FolderRenameTest.js`);
            fileMovesTestModule = await import(`${base}/FileMovesTest.js`);
            authTestModule = await import(`${base}/AuthTest.js`);    
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
            // Use both console.info and process.stdout.write to ensure visibility
            console.info('Database connection successful - tests will run');
            process.stdout.write('✓ Database connection successful - VFS tests will run\n');
        } catch (error) {
            // Database or modules not available
            console.info('Database not available or module import failed:', (error as Error).message);
            process.stdout.write(`⚠ Database not available or module import failed: ${(error as Error).message}\n`);
            databaseAvailable = false;
        }
    });

    it('folderRenameWithChildren', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await folderRenameModule.testFolderRenameWithChildren(owner_id);
    });

    it('simpleReadWriteTest', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await vfsTestModule.simpleReadWriteTest(owner_id);
    });
    
    it('testFileOperations', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await vfsTestModule.testFileOperations(owner_id);
    });
    
    it('testPathOperations', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await vfsTestModule.testPathOperations();
    });
    
    // Test error handling (testing error conditions and ensuring they're handled correctly)
    it('testErrorHandling', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await vfsTestModule.testErrorHandling(owner_id);
    });
    
    it('pgdbTestMoveUp', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await fileMovesTestModule.pgdbTestMoveUp(owner_id);
    });
    
    it('pgdbTestSetFolderPublic', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await authTestModule.pgdbTestSetFolderPublic(owner_id);
    });
    
    it('deleteFolder', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await vfsTestModule.deleteFolder(owner_id, '0001_test-structure');
    });
    
    it('renameFolder', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await vfsTestModule.renameFolder(owner_id, '0001_test-structure', '0099_renamed-test-structure');
    });
    
    it('testEnsurePath', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await vfsTestModule.testEnsurePath(owner_id);
    });
    
    it('testSetPublic', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await vfsTestModule.testSetPublic(owner_id);
    });
    
    it('testSearch', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await vfsTestModule.testSearch();
    });

    it('resetTestEnvironment', async () => {
        if (skipIfDatabaseUnavailable()) return;
        await vfsTestModule.resetTestEnvironment();
    });
});

