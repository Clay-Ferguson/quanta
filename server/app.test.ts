// Test imports - these will be compiled to .js at build time
import { runTests as runCommonUtilsTests } from '../tests/CommonUtils.test.js';
import { runTests as runVfsTests } from './plugins/docs/VFS/test/vfs.test.js';
import { runTests as runLfsTests } from './plugins/docs/IFS/test/lfs.test.js';

/**
 * Run all configured tests based on the environment
 */
export async function runAllTests(): Promise<void> {
    console.log("Running embedded tests...");

    // todo-0: currently we just cram in the 'vfs' testing here, but in the future we want to have a plugin system for tests
    // where each plugin can provide its own test entry point to run.
    if (process.env.POSTGRES_HOST) {
        await runVfsTests();
    }
    // run non-Docker tests here
    else {
        // Run CommonUtils tests
        await runCommonUtilsTests();
    
        // Run DocService tests
        await runLfsTests();
    }
}
