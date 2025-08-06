import pgdb from '../../../PGDB.js';
import { simpleReadWriteTest, testFileOperations, testPathOperations, testErrorHandling, deleteFolder, renameFolder, testEnsurePath, testSetPublic, testSearch, resetTestEnvironment } from '../../../plugins/docs/VFS/test/VFSTest.js';
import { testFolderRenameWithChildren } from '../../../plugins/docs/VFS/test/FolderRenameTest.js';
import { pgdbTestMoveUp } from '../../../plugins/docs/VFS/test/FileMovesTest.js';
import { pgdbTestSetFolderPublic } from '../../../plugins/docs/VFS/test/AuthTest.js';

class TestRunner {
    private successCount: number = 0;
    private failCount: number = 0;

    async run(testName: string, testFunction: () => Promise<void>): Promise<void> {
        console.log(`🧪 Running ${testName}...`);
        
        try {
            await testFunction();
            this.successCount++;
        } catch (error) {
            this.failCount++;
            console.error(`❌ Test failed: ${testName}`, error);

            // todo-0: currently we consider that these tests may be building on top of each other
            // so we rethrow the error to stop the test suite if anything goes wrong.
            throw error;
        }
    }

    report(): void {
        const total = this.successCount + this.failCount;
        console.log(`\n📊 Test Results:`);
        console.log(`✅ Successful: ${this.successCount}`);
        console.log(`❌ Failed: ${this.failCount}`);
        console.log(`📈 Total: ${total}`);
        
        if (this.failCount === 0) {
            console.log("🎉 All tests passed!");
        } else {
            console.log(`⚠️  ${this.failCount} test(s) failed`);
        }
    }
}

export async function runTests() {
    console.log("🚀 Starting VFS embedded tests...");
    
    // Check if database is available
    if (!pgdb.adminProfile?.id) {
        console.log("⚠️  Database not available - skipping VFS tests");
        return;
    }
    
    const owner_id = pgdb.adminProfile.id;
    console.log(`🔧 Running tests with owner_id: ${owner_id}`);
    
    const testRunner = new TestRunner();
    
    try {
        // Run all the tests using the test runner
        await testRunner.run("folderRenameWithChildren", () => testFolderRenameWithChildren(owner_id));
        await testRunner.run("simpleReadWriteTest", () => simpleReadWriteTest(owner_id));
        await testRunner.run("testFileOperations", () => testFileOperations(owner_id));
        await testRunner.run("testPathOperations", () => testPathOperations());
        await testRunner.run("testErrorHandling", () => testErrorHandling(owner_id));        
        await testRunner.run("pgdbTestMoveUp", () => pgdbTestMoveUp(owner_id));
        await testRunner.run("pgdbTestSetFolderPublic", () => pgdbTestSetFolderPublic(owner_id));
        await testRunner.run("deleteFolder", () => deleteFolder(owner_id, '0001_test-structure'));
        await testRunner.run("renameFolder", () => renameFolder(owner_id, '0001_test-structure', '0099_renamed-test-structure'));
        await testRunner.run("testEnsurePath", () => testEnsurePath(owner_id));
        await testRunner.run("testSetPublic", () => testSetPublic(owner_id));
        await testRunner.run("testSearch", () => testSearch());
        await testRunner.run("resetTestEnvironment", () => resetTestEnvironment());
        
        testRunner.report();
        
    } catch (error) {
        console.error("❌ VFS test suite failed:", error);
        testRunner.report();
        throw error;
    }
}