import pgdb from '../../../../../server/PGDB.js';
import { simpleReadWriteTest, testFileOperations, testPathOperations, testErrorHandling, deleteFolder, renameFolder, testEnsurePath, testSetPublic, testSearch, resetTestEnvironment } from './VFSTest.js';
import { testFolderRenameWithChildren } from './FolderRenameTest.js';
import { pgdbTestMoveUp } from './FileMovesTest.js';
import { pgdbTestSetFolderPublic } from './AuthTest.js';
import { TestRunner } from '../../../../../common/TestRunner.js';

export async function runTests() {
    console.log("🚀 Starting VFS embedded tests...");
    
    // Check if database is available
    if (!pgdb.adminProfile?.id) {
        console.log("⚠️  Database not available - skipping VFS tests");
        return;
    }
    
    const owner_id = pgdb.adminProfile.id;
    console.log(`🔧 Running tests with owner_id: ${owner_id}`);
    
    const testRunner = new TestRunner("VFS");
    
    try {
        // Run all the tests using the test runner. We pass rethrow as true to ensure any test failures will halt the test suite
        await testRunner.run("folderRenameWithChildren", () => testFolderRenameWithChildren(owner_id), true);
        await testRunner.run("simpleReadWriteTest", () => simpleReadWriteTest(owner_id), true);
        await testRunner.run("testFileOperations", () => testFileOperations(owner_id), true);
        await testRunner.run("testPathOperations", () => testPathOperations(), true);
        await testRunner.run("testErrorHandling", () => testErrorHandling(owner_id), true);        
        await testRunner.run("pgdbTestMoveUp", () => pgdbTestMoveUp(owner_id), true);
        await testRunner.run("pgdbTestSetFolderPublic", () => pgdbTestSetFolderPublic(owner_id), true);
        await testRunner.run("deleteFolder", () => deleteFolder(owner_id, '0001_test-structure'), true);
        await testRunner.run("renameFolder", () => renameFolder(owner_id, '0001_test-structure', '0099_renamed-test-structure'), true);
        await testRunner.run("testEnsurePath", () => testEnsurePath(owner_id), true);
        await testRunner.run("testSetPublic", () => testSetPublic(owner_id), true);
        await testRunner.run("testSearch", () => testSearch(), true);
        await testRunner.run("resetTestEnvironment", () => resetTestEnvironment(), true);
    } catch {
        console.error("❌ VFS test suite failed");
    }
    finally {
        testRunner.report();
    }
}