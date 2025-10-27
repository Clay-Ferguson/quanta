import pgdb from '../../../../server/db/PGDB.js';
import { TestRunner } from '../../../../common/TestRunner.js';
import { createFilesTest } from './saveFileTest.js';
import { createFoldersTest } from './createFoldersTest.js';
import { crossFolderPasteTest } from './crossFolderPasteTest.js';
import { sameFolderReorderTest } from './sameFolderReorderTest.js';

export async function runRESTEndpointsTests() {
    console.log("🚀 Starting REST Endpoint embedded tests...");
    
    // Check if database is available
    if (!pgdb.adminProfile?.id) {
        console.log("⚠️  Database not available - skipping REST Endpoint tests");
        return;
    }
    
    const owner_id = pgdb.adminProfile.id;
    console.log(`🔧 Running REST Endpoint tests with owner_id: ${owner_id}`);
    const testRunner = new TestRunner("REST Endpoints");
    
    try {
        // Run the saveFile test - creates three files in root folder
        await pgdb.query('DELETE FROM vfs_nodes;'); 
        await testRunner.run("createFilesTest", () => createFilesTest(owner_id), true);
        
        // Run the createFolder test - creates three folders (cumulative, does NOT clear DB)
        // Note: This test does NOT clear the database, it appends to existing data
        await testRunner.run("createFoldersTest", () => createFoldersTest(owner_id), true);
        
        // Run the cross-folder paste test - regression test for duplicate key bug
        await pgdb.query('DELETE FROM vfs_nodes;'); 
        await testRunner.run("crossFolderPasteTest", () => crossFolderPasteTest(owner_id), true);
        
        // Run the same-folder reorder test - regression test for duplicate key bug
        await pgdb.query('DELETE FROM vfs_nodes;'); 
        await testRunner.run("sameFolderReorderTest", () => sameFolderReorderTest(owner_id), true);
        
        console.log("✅ REST test suite passed");
    } catch {
        console.error("❌ REST test suite failed");
    }
    finally {
        testRunner.report();
    }
}

