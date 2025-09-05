// Test imports - these will be compiled to .js at build time
import { runTests as runCommonUtilsTests } from '../common/test/CommonUtils.test.js';
import { runTests as runCryptoTests } from '../common/test/Crypto.test.js';
import { runTests as runVfsTests } from '../plugins/docs/server/VFS/test/vfs.test.js';
import { runTests as runLfsTests } from '../plugins/docs/server/LFS/test/lfs.test.js';

/**
 * Run all configured tests based on the environment
 */
export async function runAllTests(): Promise<void> {
    console.log("Running embedded tests...");

    // todo-1: currently we just cram in the 'vfs' testing here, but in the future we want to have a plugin system (i.e. polymorphism/interface) for tests
    // where each plugin can provide its own test entry point to run.
    if (process.env.POSTGRES_HOST) {
        await runVfsTests();
    }
    else {
        await runCommonUtilsTests();
        await runCryptoTests();
        await runLfsTests();
    }
}
