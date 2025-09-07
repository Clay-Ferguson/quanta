// Test imports - these will be compiled to .js at build time
import { runTests as runCommonUtilsTests } from '../common/test/CommonUtils.test.js';
import { runTests as runCryptoTests } from '../common/test/Crypto.test.js';
import { svrUtil } from './ServerUtil.js';

/**
 * Run all configured tests based on the environment
 */
export async function runAllTests(): Promise<void> {
    console.log("Running embedded tests...");

    for (const plugin of svrUtil.pluginsArray) {
        await plugin.runAllTests();
    }

    if (!process.env.POSTGRES_HOST) {
        await runCommonUtilsTests();
        await runCryptoTests();
    }
}
